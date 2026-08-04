import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ResourceManifest } from "./types.js";

async function fetchBytes(url: string): Promise<Uint8Array> {
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

  const downloaded = await Promise.all(
    resources.map(async (url) => ({ url, bytes: await fetchBytes(url) })),
  );

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
