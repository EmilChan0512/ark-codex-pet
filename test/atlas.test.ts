import { describe, expect, it } from "vitest";
import { parseAtlasPageNames, parseAtlasPages } from "../src/atlas.js";

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

  it("does not treat unindented page metadata as texture pages", () => {
    const atlas = `build_char.png
size: 624,624
format: RGBA8888
filter: Linear,Linear
repeat: none
body
  rotate: false
  xy: 0, 0
  size: 100, 100
`;

    expect(parseAtlasPageNames(atlas)).toEqual(["build_char.png"]);
    expect(parseAtlasPages(atlas)).toEqual([
      { name: "build_char.png", width: 624, height: 624 },
    ]);
  });
});
