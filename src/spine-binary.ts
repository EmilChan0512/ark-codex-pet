export interface SpineBinaryHeader {
  hash: string | null;
  version: string | null;
  majorMinor: string | null;
}

class BinaryCursor {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  readByte(): number {
    if (this.offset >= this.bytes.length) {
      throw new Error("Unexpected end of Spine binary data");
    }
    return this.bytes[this.offset++]!;
  }

  readVarint(optimizePositive = true): number {
    let value = 0;
    let shift = 0;

    while (shift < 35) {
      const byte = this.readByte();
      value |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) {
        if (!optimizePositive) {
          return (value >>> 1) ^ -(value & 1);
        }
        return value >>> 0;
      }
      shift += 7;
    }

    throw new Error("Invalid Spine varint");
  }

  readString(): string | null {
    const byteCount = this.readVarint(true);
    if (byteCount === 0) return null;
    if (byteCount === 1) return "";

    const length = byteCount - 1;
    const end = this.offset + length;
    if (end > this.bytes.length) {
      throw new Error("Invalid Spine string length");
    }

    const value = new TextDecoder("utf-8", { fatal: false }).decode(
      this.bytes.subarray(this.offset, end),
    );
    this.offset = end;
    return value;
  }
}

/**
 * Reads the stable leading fields used by Spine binary exports: hash and
 * exporter version. It intentionally does not parse the remaining skeleton,
 * whose layout varies significantly between Spine versions.
 */
export function readSpineBinaryHeader(input: ArrayBuffer | Uint8Array): SpineBinaryHeader {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const cursor = new BinaryCursor(bytes);
  const hash = cursor.readString();
  const version = cursor.readString();
  const match = version?.match(/^(\d+)\.(\d+)/);

  return {
    hash,
    version,
    majorMinor: match ? `${match[1]}.${match[2]}` : null,
  };
}

export function recommendRuntime(version: string | null): string {
  if (!version) return "unknown";
  const match = version.match(/^(\d+)\.(\d+)/);
  if (!match) return "unknown";
  return `spine-${match[1]}.${match[2]}`;
}
