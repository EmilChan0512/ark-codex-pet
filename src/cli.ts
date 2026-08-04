import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { fetchPrtsMeta, listVariants, resolveManifest } from "./prts-client.js";

const program = new Command()
  .name("ark-pet")
  .description("Convert PRTS Spine resources into Codex pet assets")
  .showHelpAfterError();

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

      const json = `${JSON.stringify(result, null, 2)}\n`;
      if (options.output) {
        const output = path.resolve(options.output);
        await mkdir(path.dirname(output), { recursive: true });
        await writeFile(output, json, "utf8");
        process.stderr.write(`Wrote ${output}\n`);
      } else {
        process.stdout.write(json);
      }
    },
  );

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ark-pet: ${message}\n`);
  process.exitCode = 1;
});
