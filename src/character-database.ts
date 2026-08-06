import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  characterDatabaseSchema,
  type CharacterDatabase,
  type CharacterDatabaseEntry,
  type CharacterVariantRecord,
} from "./types.js";
import { fetchPrtsMeta, getMetaUrl, listVariants } from "./prts-client.js";

const PRTS_API_ROOT = "https://m.prts.wiki/api.php";
const PRTS_PAGE_ROOT = "https://m.prts.wiki/w/";
const USER_AGENT = "ark-codex-pet/0.1";

interface CategoryMembersResponse {
  continue?: {
    cmcontinue?: string;
    continue: string;
  };
  query?: {
    categorymembers?: Array<{
      title: string;
    }>;
  };
}

interface ParseWikitextResponse {
  parse?: {
    wikitext?: string;
  };
}

export interface CharacterPageInfo {
  title: string;
  name: string;
  enName?: string;
  jpName?: string;
  characterId: string;
}

function normalizeKey(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return (await response.json()) as T;
}

async function fetchOperatorTitles(): Promise<string[]> {
  const titles: string[] = [];
  let cmcontinue: string | undefined;

  while (true) {
    const url = new URL(PRTS_API_ROOT);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "categorymembers");
    url.searchParams.set("cmtitle", "Category:干员");
    url.searchParams.set("cmlimit", "500");
    url.searchParams.set("format", "json");
    if (cmcontinue) {
      url.searchParams.set("cmcontinue", cmcontinue);
    }

    const payload = await fetchJson<CategoryMembersResponse>(url.href);
    titles.push(...(payload.query?.categorymembers ?? []).map((item) => item.title));

    cmcontinue = payload.continue?.cmcontinue;
    if (!cmcontinue) {
      return titles;
    }
  }
}

async function fetchPageWikitext(title: string): Promise<string> {
  const url = new URL(PRTS_API_ROOT);
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", title);
  url.searchParams.set("prop", "wikitext");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("format", "json");

  const payload = await fetchJson<ParseWikitextResponse>(url.href);
  const wikitext = payload.parse?.wikitext;
  if (!wikitext) {
    throw new Error(`Missing wikitext for ${title}`);
  }
  return wikitext;
}

function toPageUrl(title: string): string {
  return new URL(encodeURIComponent(title), PRTS_PAGE_ROOT).href;
}

export function parseCharacterPageInfo(
  title: string,
  wikitext: string,
): CharacterPageInfo | null {
  const titleMatch = wikitext.match(/\{\{干员页面名\|([^}]*)\}\}/);
  const idMatch = wikitext.match(/\|\s*干员id\s*=\s*(char_[A-Za-z0-9_]+)/);
  if (!titleMatch || !idMatch) {
    return null;
  }

  const [name = "", enName = "", jpName = ""] = (titleMatch[1] ?? "")
    .split("|")
    .map((value) => value.trim());

  if (!name) {
    return null;
  }

  return {
    title,
    name,
    characterId: idMatch[1]!,
    ...(enName ? { enName } : {}),
    ...(jpName ? { jpName } : {}),
  };
}

export function buildLookupKeys(entry: Pick<
  CharacterDatabaseEntry,
  "title" | "name" | "enName" | "jpName" | "characterId"
>): string[] {
  const values = [entry.title, entry.name, entry.enName, entry.jpName, entry.characterId].filter(
    (value): value is string => Boolean(value && value.trim()),
  );
  return [...new Set(values.map(normalizeKey))];
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= values.length) {
        return;
      }
      results[currentIndex] = await mapper(values[currentIndex]!, currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

function compareVariants(
  left: CharacterVariantRecord,
  right: CharacterVariantRecord,
): number {
  return (
    left.skin.localeCompare(right.skin, "zh-Hans-CN") ||
    left.view.localeCompare(right.view, "zh-Hans-CN") ||
    left.file.localeCompare(right.file, "en")
  );
}

async function buildDatabaseEntry(page: CharacterPageInfo): Promise<CharacterDatabaseEntry> {
  const metaUrl = getMetaUrl(page.characterId);
  const sharedFields = {
    title: page.title,
    name: page.name,
    characterId: page.characterId,
    sourcePageUrl: toPageUrl(page.title),
    metaUrl,
    ...(page.enName ? { enName: page.enName } : {}),
    ...(page.jpName ? { jpName: page.jpName } : {}),
  };

  try {
    const meta = await fetchPrtsMeta(page.characterId);
    return {
      ...sharedFields,
      hasMeta: true,
      prefix: meta.prefix,
      variants: listVariants(meta).sort(compareVariants),
    };
  } catch (error) {
    return {
      ...sharedFields,
      hasMeta: false,
      variants: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function buildCharacterDatabase(): Promise<CharacterDatabase> {
  const titles = await fetchOperatorTitles();
  const parsedPages = await mapWithConcurrency(titles, 8, async (title) =>
    parseCharacterPageInfo(title, await fetchPageWikitext(title)),
  );
  const operators = parsedPages.filter((entry): entry is CharacterPageInfo => entry !== null);
  const characters = await mapWithConcurrency(operators, 6, buildDatabaseEntry);

  characters.sort(
    (left, right) =>
      left.name.localeCompare(right.name, "zh-Hans-CN") ||
      left.characterId.localeCompare(right.characterId, "en"),
  );

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: "prts.wiki",
    characters,
  };
}

export async function writeCharacterDatabase(
  database: CharacterDatabase,
  outputFile: string,
): Promise<string> {
  const resolved = path.resolve(outputFile);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(database, null, 2)}\n`, "utf8");
  return resolved;
}

export async function syncCharacterDatabase(outputFile: string): Promise<{
  outputFile: string;
  total: number;
  available: number;
  unavailable: number;
}> {
  const database = await buildCharacterDatabase();
  const outputPath = await writeCharacterDatabase(database, outputFile);
  const available = database.characters.filter((entry) => entry.hasMeta).length;
  return {
    outputFile: outputPath,
    total: database.characters.length,
    available,
    unavailable: database.characters.length - available,
  };
}

export async function loadCharacterDatabase(inputFile: string): Promise<CharacterDatabase> {
  const raw = JSON.parse(await readFile(path.resolve(inputFile), "utf8")) as unknown;
  return characterDatabaseSchema.parse(raw);
}

export function findCharacterRecords(
  database: CharacterDatabase,
  query: string,
): CharacterDatabaseEntry[] {
  const key = normalizeKey(query);
  return database.characters.filter((entry) => buildLookupKeys(entry).includes(key));
}

export function suggestCharacterRecords(
  database: CharacterDatabase,
  query: string,
  limit = 10,
): CharacterDatabaseEntry[] {
  const key = normalizeKey(query);
  return database.characters
    .filter((entry) => buildLookupKeys(entry).some((candidate) => candidate.includes(key)))
    .slice(0, limit);
}
