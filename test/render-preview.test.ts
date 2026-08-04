import { describe, expect, it } from "vitest";
import { transformForBaseline, transformForBounds } from "../src/render-preview.js";

describe("transformForBounds", () => {
  it("fits and centers model bounds inside padded output", () => {
    expect(
      transformForBounds({ x: -50, y: -100, width: 100, height: 200 }, 200, 300, 20),
    ).toEqual({ scale: 1.3, x: 100, y: 150 });
  });

  it("rejects empty bounds", () => {
    expect(() =>
      transformForBounds({ x: 0, y: 0, width: 0, height: 10 }, 200, 200, 10),
    ).toThrow("positive dimensions");
  });

  it("aligns the union bound bottom to a fixed baseline", () => {
    expect(
      transformForBaseline({ x: -50, y: -190, width: 100, height: 200 }, 192, 198, 10),
    ).toEqual({ scale: 0.94, x: 96, y: 188.6 });
  });
});
