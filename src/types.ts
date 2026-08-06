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

export const characterVariantSchema = z.object({
  skin: z.string().min(1),
  view: z.string().min(1),
  file: z.string().min(1),
});

export type CharacterVariantRecord = z.infer<typeof characterVariantSchema>;

export const characterDatabaseEntrySchema = z.object({
  title: z.string().min(1),
  name: z.string().min(1),
  enName: z.string().min(1).optional(),
  jpName: z.string().min(1).optional(),
  characterId: z.string().regex(/^char_[A-Za-z0-9_]+$/),
  sourcePageUrl: z.string().url(),
  metaUrl: z.string().url(),
  hasMeta: z.boolean(),
  prefix: z.string().url().optional(),
  variants: z.array(characterVariantSchema),
  error: z.string().min(1).optional(),
});

export type CharacterDatabaseEntry = z.infer<typeof characterDatabaseEntrySchema>;

export const characterDatabaseSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  source: z.literal("prts.wiki"),
  characters: z.array(characterDatabaseEntrySchema),
});

export type CharacterDatabase = z.infer<typeof characterDatabaseSchema>;

export interface SpineSourceInfo {
  hash: string | null;
  version: string | null;
  majorMinor: string | null;
  recommendedRuntime: string;
}

export const resourceManifestSchema = z.object({
  schemaVersion: z.literal(1),
  characterId: z.string().min(1),
  name: z.string().min(1),
  skin: z.string().min(1),
  view: z.string().min(1),
  sourceMetaUrl: z.string().url(),
  baseUrl: z.string().url(),
  skeletonUrl: z.string().url(),
  atlasUrl: z.string().url(),
  textureUrls: z.array(z.string().url()),
  spine: z.object({
    hash: z.string().nullable(),
    version: z.string().nullable(),
    majorMinor: z.string().nullable(),
    recommendedRuntime: z.string(),
  }),
});

export type ResourceManifest = z.infer<typeof resourceManifestSchema>;
