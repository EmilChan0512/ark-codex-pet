import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { inspectAnimations, type Bounds } from "./inspect-animations.js";
import type { LocalSpinePackage } from "./local-package.js";
import { renderAnimationPreview } from "./render-preview.js";

export const codexV1States = [
  "idle",
  "running-right",
  "running-left",
  "waving",
  "jumping",
  "failed",
  "waiting",
  "running",
  "review",
] as const;

export const codexV2States = [
  ...codexV1States,
  "look-directions-a",
  "look-directions-b",
] as const;

const codexStateSets = {
  1: codexV1States,
  2: codexV2States,
} as const;

export type CodexVersion = keyof typeof codexStateSets;
export type CodexState = (typeof codexV2States)[number];

const animationStateSchema = z.object({
  animation: z.string().min(1),
  frames: z.literal(8),
});

const derivedStateSchema = z.object({
  deriveFrom: z.enum(codexV2States),
  flipX: z.literal(true).optional(),
  offsetY: z.tuple([
    z.number().int(),
    z.number().int(),
    z.number().int(),
    z.number().int(),
    z.number().int(),
    z.number().int(),
    z.number().int(),
    z.number().int(),
  ]).optional(),
}).refine((value) => value.flipX || value.offsetY, {
  message: "A derived state needs flipX or offsetY",
});

export const bakeConfigSchema = z.object({
  schemaVersion: z.literal(1),
  characterId: z.string().min(1),
  skin: z.string().min(1),
  view: z.string().min(1),
  codexVersion: z.union([z.literal(1), z.literal(2)]),
  pet: z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
    displayName: z.string().min(1),
    description: z.string().min(1),
  }),
  normalization: z.object({
    cellWidth: z.literal(192),
    cellHeight: z.literal(208),
    anchor: z.literal("bottom-center"),
    baselineY: z.number().int().min(1).max(207),
    padding: z.number().int().min(0).max(95),
  }),
  states: z.record(z.enum(codexV2States), z.union([animationStateSchema, derivedStateSchema])),
}).refine(
  (config) => {
    const requiredStates = codexStateSets[config.codexVersion];
    return requiredStates.every((state) => state in config.states);
  },
  {
    message: "states must cover all required rows for the given codexVersion",
  },
);

export type BakeConfig = z.infer<typeof bakeConfigSchema>;

export interface BakeResult {
  outputDirectory: string;
  petJsonPath: string;
  spritesheetPath: string;
  previewPath: string;
  validationPath: string;
  width: number;
  height: number;
  sha256: string;
}

export function unionBounds(bounds: Bounds[]): Bounds {
  if (bounds.length === 0) throw new Error("Cannot union an empty bounds list");
  const minX = Math.min(...bounds.map((item) => item.x));
  const minY = Math.min(...bounds.map((item) => item.y));
  const maxX = Math.max(...bounds.map((item) => item.x + item.width));
  const maxY = Math.max(...bounds.map((item) => item.y + item.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

async function readConfig(configPath: string): Promise<BakeConfig> {
  const raw = JSON.parse(await readFile(path.resolve(configPath), "utf8")) as unknown;
  return bakeConfigSchema.parse(raw);
}

function sha256(input: Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function bakeCodexV1(
  spinePackage: LocalSpinePackage,
  configPath: string,
  requestedOutputDirectory: string,
): Promise<BakeResult> {
  const config = await readConfig(configPath);
  const manifest = spinePackage.manifest;
  if (
    config.characterId !== manifest.characterId ||
    config.skin !== manifest.skin ||
    config.view !== manifest.view
  ) {
    throw new Error("Bake config character, skin, or view does not match the local package");
  }

  const codexStates = codexStateSets[config.codexVersion];
  const codexVersion = config.codexVersion;

  const outputDirectory = path.resolve(requestedOutputDirectory);
  const qaDirectory = path.join(outputDirectory, "qa");
  const animationDirectory = path.join(qaDirectory, "animations");
  const stateDirectory = path.join(qaDirectory, "states");
  await Promise.all([
    mkdir(animationDirectory, { recursive: true }),
    mkdir(stateDirectory, { recursive: true }),
  ]);

  const report = await inspectAnimations(spinePackage, 48);
  const animationNames = new Set(
    codexStates.flatMap((state) => {
      const mapping = config.states[state];
      return "animation" in mapping ? [mapping.animation] : [];
    }),
  );
  const selected = [...animationNames].map((name) => {
    const animation = report.animations.find((item) => item.name === name);
    if (!animation) throw new Error(`Mapped animation does not exist: ${name}`);
    if (!animation.sampledBounds) throw new Error(`Mapped animation has no visible bounds: ${name}`);
    return animation;
  });
  const sharedBounds = unionBounds(selected.map((animation) => animation.sampledBounds!));

  const animationFrames = new Map<string, string[]>();
  for (const animation of selected) {
    const preview = await renderAnimationPreview(spinePackage, {
      animation: animation.name,
      frames: 8,
      width: config.normalization.cellWidth,
      height: config.normalization.cellHeight,
      padding: config.normalization.padding,
      baselineY: config.normalization.baselineY,
      fitBounds: sharedBounds,
      outputDirectory: path.join(animationDirectory, animation.name),
    });
    animationFrames.set(animation.name, preview.framePaths);
  }

  const stateFrames = new Map<CodexState, string[]>();
  for (const state of codexStates) {
    const mapping = config.states[state];
    if ("animation" in mapping) {
      stateFrames.set(state, animationFrames.get(mapping.animation)!);
      continue;
    }

    const sourceFrames = stateFrames.get(mapping.deriveFrom);
    if (!sourceFrames) {
      throw new Error(`Derived state must follow its source state: ${state}`);
    }
    const destination = path.join(stateDirectory, state);
    await mkdir(destination, { recursive: true });
    const frames: string[] = [];
    for (let index = 0; index < sourceFrames.length; index += 1) {
      const framePath = path.join(destination, `frame-${String(index).padStart(2, "0")}.png`);
      let input: Buffer<ArrayBufferLike> = await readFile(sourceFrames[index]!);
      if (mapping.flipX) input = await sharp(input).flop().png().toBuffer();
      const offsetY = mapping.offsetY?.[index] ?? 0;
      if (offsetY === 0) {
        await writeFile(framePath, input);
      } else {
        await sharp({
          create: {
            width: config.normalization.cellWidth,
            height: config.normalization.cellHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        })
          .composite([{ input, left: 0, top: offsetY }])
          .png()
          .toFile(framePath);
      }
      frames.push(framePath);
    }
    stateFrames.set(state, frames);
  }

  const cellWidth = config.normalization.cellWidth;
  const cellHeight = config.normalization.cellHeight;
  const sheetWidth = cellWidth * 8;
  const sheetHeight = cellHeight * codexStates.length;
  const composites: sharp.OverlayOptions[] = [];
  for (let row = 0; row < codexStates.length; row += 1) {
    const frames = stateFrames.get(codexStates[row]!)!;
    for (let column = 0; column < 8; column += 1) {
      composites.push({
        input: await readFile(frames[column]!),
        left: column * cellWidth,
        top: row * cellHeight,
      });
    }
  }

  const sheet = sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(composites);
  const previewPath = path.join(qaDirectory, "contact-sheet.png");
  const spritesheetPath = path.join(outputDirectory, "spritesheet.webp");
  await Promise.all([
    sheet.clone().png().toFile(previewPath),
    sheet.clone().webp({ lossless: true, quality: 100, alphaQuality: 100 }).toFile(spritesheetPath),
  ]);

  const petJsonPath = path.join(outputDirectory, "pet.json");
  const mappingPath = path.join(outputDirectory, "mapping.json");
  await Promise.all([
    writeFile(
      petJsonPath,
      `${JSON.stringify(
        {
          id: config.pet.id,
          displayName: config.pet.displayName,
          description: config.pet.description,
          spritesheetPath: "spritesheet.webp",
          spriteVersionNumber: codexVersion,
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
    writeFile(mappingPath, `${JSON.stringify(config, null, 2)}\n`, "utf8"),
  ]);

  const webp = await readFile(spritesheetPath);
  const metadata = await sharp(webp).metadata();
  const validation = {
    valid:
      metadata.width === sheetWidth &&
      metadata.height === sheetHeight &&
      metadata.format === "webp" &&
      metadata.hasAlpha === true,
    codexVersion,
    dimensions: { width: metadata.width, height: metadata.height },
    cell: { width: cellWidth, height: cellHeight },
    rows: codexStates,
    sharedBounds,
    sourceAnimations: Object.fromEntries(
      codexStates.map((state) => [state, config.states[state]]),
    ),
    sha256: sha256(webp),
  };
  const validationPath = path.join(qaDirectory, "validation.json");
  await writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
  if (!validation.valid) throw new Error("Generated sprite sheet failed Codex V1 validation");

  return {
    outputDirectory,
    petJsonPath,
    spritesheetPath,
    previewPath,
    validationPath,
    width: sheetWidth,
    height: sheetHeight,
    sha256: validation.sha256,
  };
}
