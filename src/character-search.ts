import type { CharacterDatabaseEntry, CharacterVariantRecord } from "./types.js";
import { paint, type TextFormatOptions } from "./terminal-ui.js";

export interface CharacterSearchVariantSummary extends CharacterVariantRecord {
  commands: {
    generate: string;
    generateChrome: string;
  };
}

export interface CharacterSearchEntrySummary {
  name: string;
  enName: string | undefined;
  jpName: string | undefined;
  title: string;
  characterId: string;
  hasMeta: boolean;
  variantCount: number;
  variants: CharacterSearchVariantSummary[];
  commands:
    | {
        generate: string;
        generateChrome: string;
      }
    | undefined;
}

const preferredSkinOrder = new Map([["默认", 0]]);
const preferredViewOrder = new Map([
  ["基建", 0],
  ["正面", 1],
  ["背面", 2],
]);

function compareVariants(
  left: CharacterVariantRecord,
  right: CharacterVariantRecord,
): number {
  return (
    (preferredSkinOrder.get(left.skin) ?? Number.MAX_SAFE_INTEGER) -
      (preferredSkinOrder.get(right.skin) ?? Number.MAX_SAFE_INTEGER) ||
    left.skin.localeCompare(right.skin, "zh-Hans-CN") ||
    (preferredViewOrder.get(left.view) ?? Number.MAX_SAFE_INTEGER) -
      (preferredViewOrder.get(right.view) ?? Number.MAX_SAFE_INTEGER) ||
    left.view.localeCompare(right.view, "zh-Hans-CN") ||
    left.file.localeCompare(right.file, "en-US")
  );
}

function shellQuote(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function buildGenerateCommand(
  characterName: string,
  variant: CharacterVariantRecord,
  chrome = false,
): string {
  const command = chrome ? "pnpm generate:chrome" : "pnpm generate";
  return `${command} ${shellQuote(characterName)} --skin ${shellQuote(variant.skin)} --view ${shellQuote(variant.view)}`;
}

export function summarizeCharacterVariants(
  variants: CharacterVariantRecord[],
): CharacterVariantRecord[] {
  const seen = new Set<string>();

  return [...variants]
    .sort(compareVariants)
    .filter((variant) => {
      const key = `${variant.skin}\u0000${variant.view}\u0000${variant.file}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

export function summarizeCharacterSearchEntry(
  entry: CharacterDatabaseEntry,
): CharacterSearchEntrySummary {
  const variants = summarizeCharacterVariants(entry.variants).map((variant) => ({
    ...variant,
    commands: {
      generate: buildGenerateCommand(entry.title, variant),
      generateChrome: buildGenerateCommand(entry.title, variant, true),
    },
  }));

  return {
    name: entry.name,
    enName: entry.enName,
    jpName: entry.jpName,
    title: entry.title,
    characterId: entry.characterId,
    hasMeta: entry.hasMeta,
    variantCount: entry.variants.length,
    variants,
    commands:
      variants.length > 0
        ? {
            generate: variants[0]!.commands.generate,
            generateChrome: variants[0]!.commands.generateChrome,
          }
        : undefined,
  };
}

export function formatCharacterSearchTextResult(
  databasePath: string,
  characters: CharacterSearchEntrySummary[],
  options: TextFormatOptions = {},
): string {
  if (characters.length === 0) {
    return `${paint("No matching characters found.", ["bold", "red"], options)}\n${paint("Database:", "dim", options)} ${paint(databasePath, "blue", options)}\n`;
  }

  const lines = [
    paint(`Found ${characters.length} character(s)`, ["bold", "green"], options),
    `${paint("Database:", "dim", options)} ${paint(databasePath, "blue", options)}`,
    "",
  ];

  for (const [index, character] of characters.entries()) {
    lines.push(
      `${paint(character.title, ["bold", "magenta"], options)} ${paint("|", "dim", options)} ${paint(character.characterId, "cyan", options)}`,
    );

    if (character.variants.length === 0) {
      lines.push(`  ${paint("No variants available", "yellow", options)}`);
    }

    for (const variant of character.variants) {
      lines.push(
        `  ${paint(variant.skin, "yellow", options)} ${paint("|", "dim", options)} ${paint(variant.view, "cyan", options)}`,
      );
      lines.push(`  ${paint(variant.commands.generateChrome, "green", options)}`);
    }

    if (index < characters.length - 1) {
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}
