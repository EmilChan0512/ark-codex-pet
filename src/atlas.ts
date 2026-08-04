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
    if (!line || rawLine.startsWith(" ") || rawLine.startsWith("\t")) {
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
