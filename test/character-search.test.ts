import { describe, expect, it } from "vitest";
import {
  formatCharacterSearchTextResult,
  summarizeCharacterSearchEntry,
} from "../src/character-search.js";

describe("character search summaries", () => {
  it("includes sorted variants so users can copy skin and view values directly", () => {
    const summary = summarizeCharacterSearchEntry({
      title: "白金",
      name: "白金",
      characterId: "char_204_platnm",
      sourcePageUrl: "https://example.com",
      metaUrl: "https://example.com/meta.json",
      hasMeta: true,
      variants: [
        {
          skin: "灿阳朝露 SD05",
          view: "正面",
          file: "char_204_platnm_summer_3/front/char_204_platnm_summer_3",
        },
        {
          skin: "默认",
          view: "基建",
          file: "char_204_platnm/building/char_204_platnm",
        },
      ],
    });

    expect(summary).toMatchObject({
      title: "白金",
      variantCount: 2,
      commands: {
        generate: 'pnpm generate "白金" --skin "默认" --view "基建"',
        generateChrome: 'pnpm generate:chrome "白金" --skin "默认" --view "基建"',
      },
      variants: [
        {
          skin: "默认",
          view: "基建",
          file: "char_204_platnm/building/char_204_platnm",
          commands: {
            generate: 'pnpm generate "白金" --skin "默认" --view "基建"',
            generateChrome: 'pnpm generate:chrome "白金" --skin "默认" --view "基建"',
          },
        },
        {
          skin: "灿阳朝露 SD05",
          view: "正面",
          file: "char_204_platnm_summer_3/front/char_204_platnm_summer_3",
          commands: {
            generate: 'pnpm generate "白金" --skin "灿阳朝露 SD05" --view "正面"',
            generateChrome:
              'pnpm generate:chrome "白金" --skin "灿阳朝露 SD05" --view "正面"',
          },
        },
      ],
    });

    expect(
      formatCharacterSearchTextResult("/tmp/prts-characters.json", [summary], {
        color: false,
      }),
    ).toContain('pnpm generate:chrome "白金" --skin "灿阳朝露 SD05" --view "正面"');
  });
});
