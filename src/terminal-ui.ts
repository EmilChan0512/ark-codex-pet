type TerminalStream = Pick<NodeJS.WriteStream, "isTTY">;

type TextStyle = "bold" | "dim" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan";

const styleCodes: Record<TextStyle, [string, string]> = {
  bold: ["\u001B[1m", "\u001B[22m"],
  dim: ["\u001B[2m", "\u001B[22m"],
  red: ["\u001B[31m", "\u001B[39m"],
  green: ["\u001B[32m", "\u001B[39m"],
  yellow: ["\u001B[33m", "\u001B[39m"],
  blue: ["\u001B[34m", "\u001B[39m"],
  magenta: ["\u001B[35m", "\u001B[39m"],
  cyan: ["\u001B[36m", "\u001B[39m"],
};

export interface TextFormatOptions {
  color?: boolean;
}

export function shouldUseColor(
  stream: TerminalStream,
  options: TextFormatOptions = {},
): boolean {
  if (typeof options.color === "boolean") {
    return options.color;
  }

  if (process.env.NO_COLOR) {
    return false;
  }

  if (process.env.FORCE_COLOR === "0") {
    return false;
  }

  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== "0") {
    return true;
  }

  return Boolean(stream.isTTY);
}

export function paint(
  text: string,
  styles: TextStyle | TextStyle[],
  options: TextFormatOptions = {},
): string {
  const enabled = shouldUseColor(process.stdout, options);
  if (!enabled) {
    return text;
  }

  const styleList = Array.isArray(styles) ? styles : [styles];
  return styleList.reduce((value, style) => {
    const [open, close] = styleCodes[style];
    return `${open}${value}${close}`;
  }, text);
}

export function paintForStream(
  stream: TerminalStream,
  text: string,
  styles: TextStyle | TextStyle[],
  options: TextFormatOptions = {},
): string {
  const enabled = shouldUseColor(stream, options);
  if (!enabled) {
    return text;
  }

  const styleList = Array.isArray(styles) ? styles : [styles];
  return styleList.reduce((value, style) => {
    const [open, close] = styleCodes[style];
    return `${open}${value}${close}`;
  }, text);
}

export function formatStepLabel(
  step: number,
  total: number,
  stream: TerminalStream,
  options: TextFormatOptions = {},
): string {
  return paintForStream(stream, `[${step}/${total}]`, ["bold", "cyan"], options);
}
