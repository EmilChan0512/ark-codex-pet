import { describe, expect, it } from "vitest";
import { readSpineBinaryHeader, recommendRuntime } from "../src/spine-binary.js";

function encodeVarint(value: number): number[] {
  const output: number[] = [];
  let current = value >>> 0;
  while (true) {
    const byte = current & 0x7f;
    current >>>= 7;
    if (current === 0) {
      output.push(byte);
      return output;
    }
    output.push(byte | 0x80);
  }
}

function encodeString(value: string | null): number[] {
  if (value === null) return [0];
  const bytes = Array.from(new TextEncoder().encode(value));
  return [...encodeVarint(bytes.length + 1), ...bytes];
}

describe("readSpineBinaryHeader", () => {
  it("reads hash and exporter version", () => {
    const bytes = new Uint8Array([
      ...encodeString("abc123"),
      ...encodeString("3.8.99"),
      0,
      0,
    ]);

    expect(readSpineBinaryHeader(bytes)).toEqual({
      hash: "abc123",
      version: "3.8.99",
      majorMinor: "3.8",
    });
    expect(recommendRuntime("3.8.99")).toBe("spine-3.8");
  });

  it("supports null metadata fields", () => {
    expect(readSpineBinaryHeader(new Uint8Array([0, 0]))).toEqual({
      hash: null,
      version: null,
      majorMinor: null,
    });
  });
});
