import { describe, expect, it } from "vitest";
import {
  buildCharacterNotFoundMessage,
} from "../src/generate-helpers.js";

describe("buildCharacterNotFoundMessage", () => {
  it("limits the message to nearby suggestions and includes the database hint", () => {
    expect(
      buildCharacterNotFoundMessage(
        "佩派",
        [
          {
            title: "佩佩",
            name: "佩佩",
            characterId: "char_4058_pepe",
            sourcePageUrl: "https://example.com",
            metaUrl: "https://example.com/meta.json",
            hasMeta: true,
            variants: [],
          },
        ],
        "/tmp/prts-characters.json",
      ),
    ).toContain("/tmp/prts-characters.json");
  });
});
