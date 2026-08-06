const multiWordOptions = new Set([
  "--skin",
  "--view",
  "--display-name",
  "--description",
]);

function isOptionToken(value: string): boolean {
  return value.startsWith("-");
}

export function unwrapShellQuotedValue(value: string): string {
  let unwrapped = value;

  while (true) {
    if (
      (unwrapped.startsWith('\\"') && unwrapped.endsWith('\\"')) ||
      (unwrapped.startsWith("\\'") && unwrapped.endsWith("\\'"))
    ) {
      unwrapped = unwrapped.slice(2, -2);
      continue;
    }

    if (
      (unwrapped.startsWith('"') && unwrapped.endsWith('"')) ||
      (unwrapped.startsWith("'") && unwrapped.endsWith("'"))
    ) {
      unwrapped = unwrapped.slice(1, -1);
      continue;
    }

    return unwrapped;
  }
}

export function normalizeMultiWordOptionValues(argv: string[]): string[] {
  const normalized: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    normalized.push(isOptionToken(token) ? token : unwrapShellQuotedValue(token));

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
      normalized.push(unwrapShellQuotedValue(parts[0]!));
    } else if (parts.length > 1) {
      normalized.push(unwrapShellQuotedValue(parts.join(" ")));
    }
  }

  return normalized;
}
