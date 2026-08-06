const multiWordOptions = new Set([
  "--skin",
  "--view",
  "--display-name",
  "--description",
]);

function isOptionToken(value: string): boolean {
  return value.startsWith("-");
}

export function normalizeMultiWordOptionValues(argv: string[]):string[] {
  const normalized: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    normalized.push(token);

    if (token === "--") {
      normalized.push(...argv.slice(index + 1));
      return normalized;
    }

    if (!multiWordOptions.has(token)) {
      continue;
    }

    const parts: string[] = [];
    while (index + 1 < argv.length) {
      const next = argv[index + 1]!;
      if (isOptionToken(next)) {
        break;
      }
      parts.push(next);
      index += 1;
    }

    if (parts.length === 1) {
      normalized.push(parts[0]!);
    } else if (parts.length > 1) {
      normalized.push(parts.join(" "));
    }
  }

  return normalized;
}
