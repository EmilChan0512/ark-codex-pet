//
// 从 PRTS 托管服务器拉取单个角色的 meta.json / .atlas / .skel。
// 按需加载单个资源包，适合个人参考或研究使用。
//

import { parseAtlasPageNames } from "./atlas.js";
import { readSpineBinaryHeader, recommendRuntime } from "./spine-binary.js";
import {
  prtsMetaSchema,
  type PrtsMeta,
  type ResourceManifest,
  type VariantChoice,
} from "./types.js";

const PRTS_ROOT = "https://torappu.prts.wiki/assets/char_spine/";

const REQUEST_INTERVAL_MS = 600;
let lastRequestAt = 0;

async function politeDelay(): Promise<void> {
  const now = Date.now();
  const wait = REQUEST_INTERVAL_MS - (now - lastRequestAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt = Date.now();
}

async function fetchResponse(url: string): Promise<Response> {
  await politeDelay();
  const response = await fetch(url, {
    headers: { "user-agent": "ark-codex-pet/0.1" },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response;
}

async function fetchText(url: string): Promise<string> {
  return (await fetchResponse(url)).text();
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  return new Uint8Array(await (await fetchResponse(url)).arrayBuffer());
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

//
// 解析单个角色的 manifest：只拉取 meta.json / .atlas / .skel，
// 并计算出纹理 URL。不会下载纹理 PNG，下不下载完全由调用者决定。
//
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
  const skeletonUrl = `${baseUrl}.skel`;
  const [atlasText, skeletonBytes] = await Promise.all([
    fetchText(atlasUrl),
    fetchBytes(skeletonUrl),
  ]);
  const pageNames = parseAtlasPageNames(atlasText);

  if (pageNames.length === 0) {
    throw new Error(`No texture pages found in atlas: ${atlasUrl}`);
  }

  const spine = readSpineBinaryHeader(skeletonBytes);

  return {
    schemaVersion: 1,
    characterId,
    name: meta.name,
    skin: selected.skin,
    view: selected.view,
    sourceMetaUrl,
    baseUrl,
    skeletonUrl,
    atlasUrl,
    // 只输出纹理 URL，不实际下载 PNG。下载由调用者显式决定。
    textureUrls: pageNames.map((name) => new URL(name, atlasUrl).href),
    spine: {
      hash: spine.hash,
      version: spine.version,
      majorMinor: spine.majorMinor,
      recommendedRuntime: recommendRuntime(spine.version),
    },
  };
}
