import { describe, expect, it } from "vitest";
import { normalizeMultiWordOptionValues } from "../src/argv-normalize.js";

describe("normalizeMultiWordOptionValues", () => {
  it("merges unquoted skin and view values containing spaces", () => {
    expect(
      normalizeMultiWordOptionValues([
        "node",
        "src/cli.ts",
        "inspect",
        "char_204_platnm",
        "--skin",
        "灿阳朝露",
        "SD05",
        "--view",
        "基建",
      ]),
    ).toEqual([
      "node",
      "src/cli.ts",
      "inspect",
      "char_204_platnm",
      "--skin",
      "灿阳朝露 SD05",
      "--view",
      "基建",
    ]);
  });

  it("keeps already well-formed arguments unchanged", () => {
    expect(
      normalizeMultiWordOptionValues([
        "node",
        "src/cli.ts",
        "generate",
        "白金",
        "--skin",
        "灿阳朝露 SD05",
        "--view",
        "正面",
        "--output",
        "dist/platnm",
      ]),
    ).toEqual([
      "node",
      "src/cli.ts",
      "generate",
      "白金",
      "--skin",
      "灿阳朝露 SD05",
      "--view",
      "正面",
      "--output",
      "dist/platnm",
    ]);
  });
});
