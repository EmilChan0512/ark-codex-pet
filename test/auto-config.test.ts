import { describe, expect, it } from "vitest";
import { createAutomaticBakeConfig } from "../src/auto-config.js";
import type { AnimationInspectionReport } from "../src/inspect-animations.js";
import type { ResourceManifest } from "../src/types.js";

const manifest: ResourceManifest = {
  schemaVersion: 1,
  characterId: "char_4058_pepe",
  name: "佩佩",
  skin: "默认",
  view: "基建",
  sourceMetaUrl: "https://example.com/meta.json",
  baseUrl: "https://example.com/char_4058_pepe",
  skeletonUrl: "https://example.com/char_4058_pepe.skel",
  atlasUrl: "https://example.com/char_4058_pepe.atlas",
  textureUrls: ["https://example.com/char_4058_pepe.png"],
  spine: {
    hash: null,
    version: "3.8.99",
    majorMinor: "3.8",
    recommendedRuntime: "spine-3.8",
  },
};

function createReport(names: string[]): AnimationInspectionReport {
  return {
    schemaVersion: 1,
    runtime: "spine-3.8",
    exporterVersion: "3.8.99",
    samplesPerAnimation: 16,
    setupPoseBounds: null,
    animations: names.map((name) => ({
      name,
      duration: 1,
      sampledBounds: null,
    })),
  };
}

describe("createAutomaticBakeConfig", () => {
  it("maps standard Arknights animation names to Codex states", () => {
    const result = createAutomaticBakeConfig(
      manifest,
      createReport(["Relax", "Move", "Interact", "Sleep", "Sit"]),
    );

    expect(result.warnings).toEqual([]);
    expect(result.config.pet.id).toBe("pepe");
    expect(result.config.states.idle).toEqual({ animation: "Relax", frames: 8 });
    expect(result.config.states["running-right"]).toEqual({
      animation: "Move",
      frames: 8,
    });
    expect(result.config.states.waiting).toEqual({ animation: "Sit", frames: 8 });
  });

  it("falls back to idle when optional animations are missing", () => {
    const result = createAutomaticBakeConfig(manifest, createReport(["Idle", "Run"]));

    expect(result.warnings).toEqual([
      "Missing waving animation; reusing Idle.",
      "Missing failed animation; reusing Idle.",
      "Missing waiting animation; reusing Idle.",
    ]);
    expect(result.config.states.waving).toEqual({ animation: "Idle", frames: 8 });
    expect(result.config.states.failed).toEqual({ animation: "Idle", frames: 8 });
    expect(result.config.states.waiting).toEqual({ animation: "Idle", frames: 8 });
  });
});
