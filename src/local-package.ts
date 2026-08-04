import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { resourceManifestSchema, type ResourceManifest } from "./types.js";

const localManifestSchema = resourceManifestSchema.extend({
  localFiles: z.record(z.string(), z.string().min(1)),
});

export interface LocalResourceManifest extends ResourceManifest {
  localFiles: Record<string, string>;
}

export interface LocalSpinePackage {
  directory: string;
  manifestPath: string;
  manifest: LocalResourceManifest;
  skeletonPath: string;
  atlasPath: string;
  texturePaths: string[];
}

function resolveLocalFile(
  directory: string,
  manifest: LocalResourceManifest,
  url: string,
): string {
  const filename = manifest.localFiles[url];
  if (!filename) {
    throw new Error(`Local package is missing a file mapping for ${url}`);
  }

  const resolved = path.resolve(directory, filename);
  const relative = path.relative(directory, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Local file escapes the package directory: ${filename}`);
  }
  return resolved;
}

export async function loadLocalSpinePackage(
  inputDirectory: string,
): Promise<LocalSpinePackage> {
  const directory = path.resolve(inputDirectory);
  const manifestPath = path.join(directory, "manifest.json");
  const raw = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  const manifest = localManifestSchema.parse(raw) as LocalResourceManifest;

  return {
    directory,
    manifestPath,
    manifest,
    skeletonPath: resolveLocalFile(directory, manifest, manifest.skeletonUrl),
    atlasPath: resolveLocalFile(directory, manifest, manifest.atlasUrl),
    texturePaths: manifest.textureUrls.map((url) =>
      resolveLocalFile(directory, manifest, url),
    ),
  };
}
