import { describe, expect, it } from "vitest";
import { codexV1States, codexV2States, unionBounds } from "../src/bake.js";

describe("Codex bake helpers", () => {
  it("uses the fixed nine-row state order for v1", () => {
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

  it("uses the fixed eleven-row state order for v2", () => {
    expect(codexV2States).toEqual([
      "idle",
      "running-right",
      "running-left",
      "waving",
      "jumping",
      "failed",
      "waiting",
      "running",
      "review",
      "look-directions-a",
      "look-directions-b",
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
