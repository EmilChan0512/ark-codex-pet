import type { AnimationInspectionReport } from "./inspect-animations.js";
import type { ResourceManifest } from "./types.js";
import type { BakeConfig, CodexState, CodexVersion } from "./bake.js";

export interface AutoConfigOptions {
  codexVersion?: CodexVersion;
  baselineY?: number;
  padding?: number;
  petId?: string;
  displayName?: string;
  description?: string;
}

export interface AutoConfigResult {
  config: BakeConfig;
  warnings: string[];
}

const jumpOffsetY = [0, -6, -12, -18, -18, -12, -6, 0] as const;

const animationAliases = {
  idle: ["Relax", "Idle", "Default", "Stand", "Idle_Loop", "Loop"],
  running: ["Move", "Run", "Walk", "Running", "Move_Loop"],
  waving: ["Interact", "Hello", "Wave", "Cheer", "Special"],
  failed: ["Sleep", "Fail", "Down", "Dead", "Knockout"],
  waiting: ["Sit", "Wait", "Rest", "Standby", "Idle_2", "Idle2"],
} as const;

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function derivePetId(characterId: string): string {
  const match = characterId.match(/^char_\d+_(.+)$/);
  return (match?.[1] ?? characterId).replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
}

function findAnimation(
  report: AnimationInspectionReport,
  aliases: readonly string[],
): string | undefined {
  const exactLookup = new Map(
    report.animations.map((animation) => [normalizeName(animation.name), animation.name]),
  );

  for (const alias of aliases) {
    const hit = exactLookup.get(normalizeName(alias));
    if (hit) {
      return hit;
    }
  }

  const normalizedAliases = aliases.map(normalizeName);
  return report.animations.find((animation) =>
    normalizedAliases.some((alias) => normalizeName(animation.name).includes(alias)),
  )?.name;
}

function pickAnimation(
  report: AnimationInspectionReport,
  key: keyof typeof animationAliases,
  warnings: string[],
  fallback?: string,
): string {
  const match = findAnimation(report, animationAliases[key]);
  if (match) {
    return match;
  }
  if (fallback) {
    warnings.push(`Missing ${key} animation; reusing ${fallback}.`);
    return fallback;
  }
  throw new Error(
    `Could not find a usable ${key} animation. Available animations: ${report.animations
      .map((animation) => animation.name)
      .join(", ")}`,
  );
}

export function createAutomaticBakeConfig(
  manifest: ResourceManifest,
  report: AnimationInspectionReport,
  options: AutoConfigOptions = {},
): AutoConfigResult {
  const warnings: string[] = [];
  const codexVersion = options.codexVersion ?? 2;
  const displayName = options.displayName ?? manifest.name;
  const petId = options.petId ?? derivePetId(manifest.characterId);
  const description = options.description ?? `Arknights operator ${displayName}`;

  const idle = pickAnimation(report, "idle", warnings);
  const running = pickAnimation(report, "running", warnings);
  const waving = pickAnimation(report, "waving", warnings, idle);
  const failed = pickAnimation(report, "failed", warnings, idle);
  const waiting = pickAnimation(report, "waiting", warnings, idle);

  const states: BakeConfig["states"] = {
    idle: { animation: idle, frames: 8 },
    "running-right": { animation: running, frames: 8 },
    "running-left": { deriveFrom: "running-right", flipX: true },
    waving: { animation: waving, frames: 8 },
    jumping: { deriveFrom: "idle", offsetY: [...jumpOffsetY] },
    failed: { animation: failed, frames: 8 },
    waiting: { animation: waiting, frames: 8 },
    running: { animation: running, frames: 8 },
    review: { animation: waving, frames: 8 },
    "look-directions-a": { animation: idle, frames: 8 },
    "look-directions-b": { animation: idle, frames: 8 },
  };

  return {
    warnings,
    config: {
      schemaVersion: 1,
      characterId: manifest.characterId,
      skin: manifest.skin,
      view: manifest.view,
      codexVersion,
      pet: {
        id: petId,
        displayName,
        description,
      },
      normalization: {
        cellWidth: 192,
        cellHeight: 208,
        anchor: "bottom-center",
        baselineY: options.baselineY ?? 198,
        padding: options.padding ?? 10,
      },
      states,
    },
  };
}

export function summarizeAutoConfigMappings(config: BakeConfig): Record<CodexState, string> {
  return Object.fromEntries(
    Object.entries(config.states).map(([state, mapping]) => [
      state,
      "animation" in mapping ? mapping.animation : mapping.deriveFrom,
    ]),
  ) as Record<CodexState, string>;
}
