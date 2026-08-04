import { describe, expect, it } from "vitest";
import { parseAtlasPageNames } from "../src/atlas.js";

describe("parseAtlasPageNames", () => {
  it("distinguishes texture pages from region names", () => {
    const atlas = `pet.png
size: 1024,1024
format: RGBA8888
filter: Linear,Linear
repeat: none
region/head
  rotate: false
  xy: 0, 0
  size: 100, 100

pet-effects.png
size: 512,512
filter: Linear,Linear
repeat: none
effect/glow
  rotate: false
  xy: 0, 0
  size: 50, 50
`;
    expect(parseAtlasPageNames(atlas)).toEqual(["pet.png", "pet-effects.png"]);
  });
});
