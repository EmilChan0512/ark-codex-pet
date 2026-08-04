import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
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

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ark-pet: ${message}\n`);
  process.exitCode = 1;
});
