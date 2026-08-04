import { describe, expect, it } from "vitest";
import { codexV1States, unionBounds } from "../src/bake.js";

describe("Codex V1 bake helpers", () => {
  it("uses the fixed nine-row state order", () => {
    expect(codexV1States).toEqual([
      "idle",
      "running-right",
      "running-left",
      "waving",
      "jumping",
      "failed",
      "waiting",
      "running",
      "review",
    ]);
  });

  it("unions animation bounds", () => {
    expect(
      unionBounds([
        { x: -10, y: -20, width: 20, height: 30 },
        { x: -30, y: -5, width: 50, height: 15 },
      ]),
    ).toEqual({ x: -30, y: -20, width: 50, height: 30 });
  });
});
