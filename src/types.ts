import { z } from "zod";

export const prtsVariantSchema = z.object({
  file: z.string().min(1),
});

export const prtsMetaSchema = z.object({
  prefix: z.string().url(),
  name: z.string().min(1),
  skin: z.record(z.string(), z.record(z.string(), prtsVariantSchema)),
});

export type PrtsMeta = z.infer<typeof prtsMetaSchema>;

export interface VariantChoice {
  skin: string;
  view: string;
  file: string;
}

export interface ResourceManifest {
  schemaVersion: 1;
  characterId: string;
  name: string;
  skin: string;
  view: string;
  sourceMetaUrl: string;
  baseUrl: string;
  skeletonUrl: string;
  atlasUrl: string;
  textureUrls: string[];
}
