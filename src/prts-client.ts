import { parseAtlasPageNames } from "./atlas.js";
import {
  prtsMetaSchema,
  type PrtsMeta,
  type ResourceManifest,
  type VariantChoice,
} from "./types.js";

const PRTS_ROOT = "https://torappu.prts.wiki/assets/char_spine/";

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "user-agent": "ark-codex-pet/0.1" },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.text();
}

export function getMetaUrl(characterId: string): string {
  const safeId = characterId.trim();
  if (!/^char_[a-zA-Z0-9_]+$/.test(safeId)) {
    throw new Error(`Invalid character id: ${characterId}`);
  }
  return new URL(`${safeId}/meta.json`, PRTS_ROOT).href;
}

export async function fetchPrtsMeta(characterId: string): Promise<PrtsMeta> {
  const metaUrl = getMetaUrl(characterId);
  const raw = JSON.parse(await fetchText(metaUrl)) as unknown;
  return prtsMetaSchema.parse(raw);
}

export function listVariants(meta: PrtsMeta): VariantChoice[] {
  const variants: VariantChoice[] = [];
  for (const [skin, views] of Object.entries(meta.skin)) {
    for (const [view, value] of Object.entries(views)) {
      variants.push({ skin, view, file: value.file });
    }
  }
  return variants;
}

export function selectVariant(
  meta: PrtsMeta,
  requestedSkin?: string,
  requestedView?: string,
): VariantChoice {
  const variants = listVariants(meta);
  if (variants.length === 0) {
    throw new Error("PRTS metadata contains no model variants");
  }

  const match = variants.find(
    (variant) =>
      (!requestedSkin || variant.skin === requestedSkin) &&
      (!requestedView || variant.view === requestedView),
  );

  if (!match) {
    throw new Error(
      `Variant not found: skin=${requestedSkin ?? "*"}, view=${requestedView ?? "*"}`,
    );
  }
  return match;
}

export async function resolveManifest(
  characterId: string,
  skin?: string,
  view?: string,
): Promise<ResourceManifest> {
  const sourceMetaUrl = getMetaUrl(characterId);
  const meta = await fetchPrtsMeta(characterId);
  const selected = selectVariant(meta, skin, view);
  const baseUrl = new URL(selected.file, meta.prefix).href;
  const atlasUrl = `${baseUrl}.atlas`;
  const atlasText = await fetchText(atlasUrl);
  const pageNames = parseAtlasPageNames(atlasText);

  if (pageNames.length === 0) {
    throw new Error(`No texture pages found in atlas: ${atlasUrl}`);
  }

  return {
    schemaVersion: 1,
    characterId,
    name: meta.name,
    skin: selected.skin,
    view: selected.view,
    sourceMetaUrl,
    baseUrl,
    skeletonUrl: `${baseUrl}.skel`,
    atlasUrl,
    textureUrls: pageNames.map((name) => new URL(name, atlasUrl).href),
  };
}
