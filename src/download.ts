//
// 按 manifest 列出的 URL，将单个角色的 .skel / .atlas / 纹理文件下载到本地。
// 适合个人参考或研究，按需加载单个资源包。
//

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ResourceManifest } from "./types.js";

const REQUEST_INTERVAL_MS = 800;
let lastRequestAt = 0;

async function politeDelay(): Promise<void> {
  const now = Date.now();
  const wait = REQUEST_INTERVAL_MS - (now - lastRequestAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt = Date.now();
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  await politeDelay();
  const response = await fetch(url, {
    headers: { "user-agent": "ark-codex-pet/0.1" },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function safeBasename(url: string): string {
  const name = path.posix.basename(new URL(url).pathname);
  if (!name || name === "." || name === "/") {
    throw new Error(`Cannot derive filename from ${url}`);
  }
  return name;
}

export interface DownloadResult {
  directory: string;
  manifestPath: string;
  files: Array<{ url: string; path: string; bytes: number }>;
}

//
// 将 manifest 中列出的资源 URL 下载到本地目录。
// 供单个角色单次使用，不适合批量循环调用。
//
export async function downloadManifestAssets(
  manifest: ResourceManifest,
  outputDirectory: string,
): Promise<DownloadResult> {
  const directory = path.resolve(outputDirectory);
  await mkdir(directory, { recursive: true });

  const resources = [
    manifest.skeletonUrl,
    manifest.atlasUrl,
    ...manifest.textureUrls,
  ];

  const downloaded: Array<{ url: string; bytes: Uint8Array }> = [];
  for (const url of resources) {
    downloaded.push({ url, bytes: await fetchBytes(url) });
  }

  const files: DownloadResult["files"] = [];
  for (const item of downloaded) {
    const destination = path.join(directory, safeBasename(item.url));
    await writeFile(destination, item.bytes);
    files.push({ url: item.url, path: destination, bytes: item.bytes.byteLength });
  }

  const localManifest = {
    ...manifest,
    localFiles: Object.fromEntries(
      files.map((file) => [file.url, path.basename(file.path)]),
    ),
  };
  const manifestPath = path.join(directory, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(localManifest, null, 2)}\n`, "utf8");

  return { directory, manifestPath, files };
}
