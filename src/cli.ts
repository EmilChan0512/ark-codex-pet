import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { normalizeMultiWordOptionValues } from "./argv-normalize.js";
import { createAutomaticBakeConfig, summarizeAutoConfigMappings } from "./auto-config.js";
import { bakeCodexV1 } from "./bake.js";
import {
  findCharacterRecords,
  loadCharacterDatabase,
  suggestCharacterRecords,
  syncCharacterDatabase,
} from "./character-database.js";
import { downloadManifestAssets } from "./download.js";
import { inspectAnimations } from "./inspect-animations.js";
import { loadLocalSpinePackage } from "./local-package.js";
import { fetchPrtsMeta, listVariants, resolveManifest } from "./prts-client.js";
import { renderAnimationPreview } from "./render-preview.js";
import { resourceManifestSchema } from "./types.js";

const program = new Command()
  .name("ark-pet")
  .description("Convert PRTS Spine resources into Codex pet assets")
  .showHelpAfterError();

const defaultDatabasePath = path.resolve("database/prts-characters.json");

async function emitJson(result: unknown, outputFile?: string): Promise<void> {
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (outputFile) {
    const output = path.resolve(outputFile);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, json, "utf8");
    process.stderr.write(`Wrote ${output}\n`);
  } else {
    process.stdout.write(json);
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(path.resolve(targetPath));
    return true;
  } catch {
    return false;
  }
}

async function requireCharacterDatabase(databaseFile: string): Promise<string> {
  const resolved = path.resolve(databaseFile);
  if (!(await pathExists(resolved))) {
    throw new Error(
      `Character database not found: ${resolved}. Run "pnpm sync-db" once to create the local JSON database.`,
    );
  }
  return resolved;
}

function parseIntegerOption(
  value: string,
  optionName: string,
  minimum: number,
  maximum: number,
): number {
  const integer = Number.parseInt(value, 10);
  if (!Number.isInteger(integer) || integer < minimum || integer > maximum) {
    throw new Error(`${optionName} must be an integer between ${minimum} and ${maximum}`);
  }
  return integer;
}

function sanitizeSegment(value: string): string {
  const normalized = value.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-");
  return normalized || "default";
}

program
  .command("sync-db")
  .option(
    "-o, --output <file>",
    "write the local character database to a file",
    defaultDatabasePath,
  )
  .action(async (options: { output: string }) => {
    const result = await syncCharacterDatabase(options.output);
    await emitJson(result);
  });

program
  .command("characters")
  .option("--query <name>", "filter by role name, alias, or character id")
  .option("--available-only", "show only entries with PRTS meta", true)
  .option("--database <file>", "local character database file", defaultDatabasePath)
  .option("-o, --output <file>", "write JSON result to a file")
  .action(
    async (options: {
      query?: string;
      availableOnly?: boolean;
      database: string;
      output?: string;
    }) => {
      const databasePath = await requireCharacterDatabase(options.database);
      const database = await loadCharacterDatabase(databasePath);
      const key = options.query?.trim();
      const matches = key
        ? database.characters.filter((entry) =>
            suggestCharacterRecords(database, key, database.characters.length).includes(entry),
          )
        : database.characters;
      const filtered = (options.availableOnly ?? true)
        ? matches.filter((entry) => entry.hasMeta)
        : matches;

      await emitJson(
        {
          databasePath,
          total: filtered.length,
          characters: filtered.map((entry) => ({
            name: entry.name,
            enName: entry.enName,
            jpName: entry.jpName,
            title: entry.title,
            characterId: entry.characterId,
            hasMeta: entry.hasMeta,
            variantCount: entry.variants.length,
          })),
        },
        options.output,
      );
    },
  );

program
  .command("inspect")
  .argument("<character-id>", "PRTS character id, for example char_4058_pepe")
  .option("--skin <name>", "skin name")
  .option("--view <name>", "view name, for example 基建")
  .option("--list", "list variants without resolving atlas resources")
  .option("-o, --output <file>", "write JSON result to a file")
  .action(
    async (
      characterId: string,
      options: {
        skin?: string;
        view?: string;
        list?: boolean;
        output?: string;
      },
    ) => {
      let result: unknown;

      if (options.list) {
        const meta = await fetchPrtsMeta(characterId);
        result = {
          characterId,
          ...meta,
          variants: listVariants(meta),
        };
      } else {
        result = await resolveManifest(characterId, options.skin, options.view);
      }

      await emitJson(result, options.output);
    },
  );

program
  .command("download")
  .argument("<manifest-file>", "manifest JSON produced by inspect")
  .requiredOption("-o, --output <directory>", "local package directory")
  .action(async (manifestFile: string, options: { output: string }) => {
    const raw = JSON.parse(await readFile(path.resolve(manifestFile), "utf8")) as unknown;
    const manifest = resourceManifestSchema.parse(raw);
    const result = await downloadManifestAssets(manifest, options.output);
    await emitJson(result);
  });

program
  .command("inspect-animations")
  .argument("<package-directory>", "directory produced by download")
  .option("--samples <count>", "bounds samples per animation", "16")
  .option("-o, --output <file>", "write JSON report to a file")
  .action(
    async (
      packageDirectory: string,
      options: { samples: string; output?: string },
    ) => {
      const samples = Number.parseInt(options.samples, 10);
      if (!Number.isInteger(samples) || samples < 2 || samples > 240) {
        throw new Error("--samples must be an integer between 2 and 240");
      }
      const spinePackage = await loadLocalSpinePackage(packageDirectory);
      const report = await inspectAnimations(spinePackage, samples);
      await emitJson(report, options.output);
    },
  );

program
  .command("preview")
  .argument("<package-directory>", "directory produced by download")
  .requiredOption("--animation <name>", "animation to render")
  .option("--frames <count>", "number of frames", "8")
  .option("--width <pixels>", "frame width", "512")
  .option("--height <pixels>", "frame height", "512")
  .option("--padding <pixels>", "transparent padding", "24")
  .requiredOption("-o, --output <directory>", "preview output directory")
  .action(
    async (
      packageDirectory: string,
      options: {
        animation: string;
        frames: string;
        width: string;
        height: string;
        padding: string;
        output: string;
      },
    ) => {
      const integers = Object.fromEntries(
        ["frames", "width", "height", "padding"].map((key) => [
          key,
          Number.parseInt(options[key as keyof typeof options], 10),
        ]),
      ) as Record<"frames" | "width" | "height" | "padding", number>;
      if (
        !Number.isInteger(integers.width) ||
        !Number.isInteger(integers.height) ||
        integers.width < 32 ||
        integers.height < 32 ||
        integers.width > 4096 ||
        integers.height > 4096
      ) {
        throw new Error("preview dimensions must be integers between 32 and 4096");
      }
      if (!Number.isInteger(integers.padding) || integers.padding < 0) {
        throw new Error("--padding must be a non-negative integer");
      }
      const spinePackage = await loadLocalSpinePackage(packageDirectory);
      const result = await renderAnimationPreview(spinePackage, {
        animation: options.animation,
        frames: integers.frames,
        width: integers.width,
        height: integers.height,
        padding: integers.padding,
        outputDirectory: options.output,
      });
      await emitJson(result);
    },
  );

program
  .command("bake")
  .argument("<package-directory>", "directory produced by download")
  .requiredOption("--config <file>", "Codex state mapping JSON")
  .requiredOption("-o, --output <directory>", "Codex pet output directory")
  .action(
    async (
      packageDirectory: string,
      options: { config: string; output: string },
    ) => {
      const spinePackage = await loadLocalSpinePackage(packageDirectory);
      const result = await bakeCodexV1(
        spinePackage,
        options.config,
        options.output,
      );
      await emitJson(result);
    },
  );

program
  .command("generate")
  .argument("<character-name>", "role name, alias, or character id from the local database")
  .option("--skin <name>", "skin name", "默认")
  .option("--view <name>", "view name", "基建")
  .option("--database <file>", "local character database file", defaultDatabasePath)
  .option("--cache-root <directory>", "cache root directory", ".cache/generated")
  .option("--codex-version <version>", "codex version to generate", "2")
  .option("--baselineY <pixels>", "baseline position", "198")
  .option("--padding <pixels>", "transparent padding", "10")
  .option("--pet-id <id>", "override generated pet id")
  .option("--display-name <name>", "override generated pet display name")
  .option("--description <text>", "override generated pet description")
  .option("--config-output <file>", "write generated bake config to a file")
  .option("-o, --output <directory>", "Codex pet output directory")
  .action(
    async (
      characterName: string,
      options: {
        skin: string;
        view: string;
        database: string;
        cacheRoot: string;
        codexVersion: string;
        baselineY: string;
        padding: string;
        petId?: string;
        displayName?: string;
        description?: string;
        configOutput?: string;
        output?: string;
      },
    ) => {
      const databasePath = await requireCharacterDatabase(options.database);
      const database = await loadCharacterDatabase(databasePath);
      const matches = findCharacterRecords(database, characterName);

      if (matches.length === 0) {
        const suggestions = suggestCharacterRecords(database, characterName)
          .map((entry) => `${entry.name} (${entry.characterId})`)
          .join(", ");
        throw new Error(
          suggestions
            ? `Character not found: ${characterName}. Suggestions: ${suggestions}`
            : `Character not found: ${characterName}`,
        );
      }

      if (matches.length > 1) {
        throw new Error(
          `Character query is ambiguous: ${matches
            .map((entry) => `${entry.name} (${entry.characterId})`)
            .join(", ")}`,
        );
      }

      const record = matches[0]!;
      if (!record.hasMeta) {
        throw new Error(
          `Character ${record.name} does not have a usable PRTS spine meta entry: ${record.error ?? "unknown error"}`,
        );
      }

      const codexVersion = parseIntegerOption(
        options.codexVersion,
        "--codex-version",
        1,
        2,
      ) as 1 | 2;
      const baselineY = parseIntegerOption(options.baselineY, "--baselineY", 1, 207);
      const padding = parseIntegerOption(options.padding, "--padding", 0, 95);

      const manifest = await resolveManifest(record.characterId, options.skin, options.view);
      const variantKey = `${sanitizeSegment(manifest.skin)}-${sanitizeSegment(manifest.view)}`;
      const cacheDirectory = path.resolve(options.cacheRoot, manifest.characterId, variantKey);
      const packageDirectory = path.join(cacheDirectory, "package");

      await mkdir(cacheDirectory, { recursive: true });
      await downloadManifestAssets(manifest, packageDirectory);

      process.env.ARK_PET_BROWSER = "chrome";
      const spinePackage = await loadLocalSpinePackage(packageDirectory);
      const report = await inspectAnimations(spinePackage);
      const autoConfig = createAutomaticBakeConfig(manifest, report, {
        codexVersion,
        baselineY,
        padding,
        displayName: options.displayName ?? record.name,
        ...(options.petId ? { petId: options.petId } : {}),
        ...(options.description ? { description: options.description } : {}),
      });

      const configPath = path.resolve(
        options.configOutput ?? path.join(cacheDirectory, "auto.codex.json"),
      );
      await writeFile(configPath, `${JSON.stringify(autoConfig.config, null, 2)}\n`, "utf8");

      const outputDirectory = path.resolve(
        options.output ?? path.join("dist", autoConfig.config.pet.id),
      );
      const bakeResult = await bakeCodexV1(spinePackage, configPath, outputDirectory);

      await emitJson({
        databasePath,
        browser: "chrome",
        character: {
          query: characterName,
          name: record.name,
          characterId: record.characterId,
          skin: manifest.skin,
          view: manifest.view,
        },
        autoConfig: {
          configPath,
          warnings: autoConfig.warnings,
          mappings: summarizeAutoConfigMappings(autoConfig.config),
        },
        animationCount: report.animations.length,
        packageDirectory,
        outputDirectory,
        bake: bakeResult,
      });
    },
  );

program.parseAsync(normalizeMultiWordOptionValues(process.argv)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ark-pet: ${message}\n`);
  process.exitCode = 1;
});
