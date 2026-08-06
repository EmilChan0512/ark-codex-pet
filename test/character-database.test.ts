import { describe, expect, it } from "vitest";
import {
  buildLookupKeys,
  findCharacterRecords,
  parseCharacterPageInfo,
  suggestCharacterRecords,
} from "../src/character-database.js";

describe("character database helpers", () => {
  it("extracts names and character id from operator wikitext", () => {
    const wikitext = `{{干员页面名|佩佩|Pepe|ペペ}}
{{CharinfoV2
|干员名=佩佩
|干员id=char_4058_pepe
}}`;

    expect(parseCharacterPageInfo("佩佩", wikitext)).toEqual({
      title: "佩佩",
      name: "佩佩",
      enName: "Pepe",
      jpName: "ペペ",
      characterId: "char_4058_pepe",
    });
  });

  it("builds unique lookup keys for title aliases and ids", () => {
    expect(
      buildLookupKeys({
        title: "阿米娅(近卫)",
        name: "阿米娅",
        enName: "Amiya",
        jpName: "アーミヤ",
        characterId: "char_002_amiya2",
      }),
    ).toEqual([
      "阿米娅(近卫)",
      "阿米娅",
      "amiya",
      "アーミヤ",
      "char_002_amiya2",
    ]);
  });

  it("matches 特蕾西娅 when the stored role name is 魔王", () => {
    const database = {
      schemaVersion: 1 as const,
      generatedAt: new Date().toISOString(),
      source: "prts.wiki" as const,
      characters: [
        {
          title: "魔王",
          name: "魔王",
          characterId: "char_999_devil",
          sourcePageUrl: "https://example.com/devil",
          metaUrl: "https://example.com/devil/meta.json",
          hasMeta: true,
          variants: [],
        },
      ],
    };

    expect(findCharacterRecords(database, "特蕾西娅")).toHaveLength(1);
    expect(suggestCharacterRecords(database, "特蕾西娅")).toHaveLength(1);
  });
});
