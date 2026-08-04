/**
 * Return texture page names from a Spine atlas.
 *
 * A page begins at a non-indented line followed by page-level metadata such as
 * `size:`, `format:`, `filter:`, `repeat:` or `pma:`. Region names are also
 * non-indented, so the look-ahead is important.
 */
export function parseAtlasPageNames(atlasText: string): string[] {
  const lines = atlasText.replace(/\r\n?/g, "\n").split("\n");
  const pageMetadata = /^(size|format|filter|repeat|pma|scale):\s*/;
  const names: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trim();
    if (
      !line ||
      line.includes(":") ||
      rawLine.startsWith(" ") ||
      rawLine.startsWith("\t")
    ) {
      continue;
    }

    let nextNonEmpty = "";
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const candidate = lines[cursor]?.trim() ?? "";
      if (candidate) {
        nextNonEmpty = candidate;
        break;
      }
    }

    if (pageMetadata.test(nextNonEmpty)) {
      names.push(line);
    }
  }

  return [...new Set(names)];
}

export interface AtlasPageInfo {
  name: string;
  width: number | null;
  height: number | null;
}

export function parseAtlasPages(atlasText: string): AtlasPageInfo[] {
  const lines = atlasText.replace(/\r\n?/g, "\n").split("\n");
  const names = new Set(parseAtlasPageNames(atlasText));
  const pages: AtlasPageInfo[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const name = lines[index]?.trim() ?? "";
    if (!names.has(name)) continue;
    let width: number | null = null;
    let height: number | null = null;

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const raw = lines[cursor] ?? "";
      const line = raw.trim();
      if (!line) break;
      if (!raw.startsWith(" ") && !raw.startsWith("\t") && !line.includes(":")) {
        break;
      }
      const match = line.match(/^size:\s*(\d+)\s*,\s*(\d+)$/);
      if (match) {
        width = Number(match[1]);
        height = Number(match[2]);
        break;
      }
    }
    pages.push({ name, width, height });
  }
  return pages;
}
