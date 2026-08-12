# ark-codex-pet
![ark-codex-pet 像素风新手引导图](./docs/readme-onboarding-banner.png)

## Quick Start

```bash
pnpm sync-db
```

```bash
pnpm find Pepe
```

```bash
pnpm generate:chrome Pepe --skin 默认 --view 基建
```

Requires Node.js 20+ and pnpm 9+.

> If local Chrome is unavailable, use `pnpm generate`.
> 🔎 Search roles with `pnpm find Pepe`.
> 🎨 To find skin names, run `pnpm find <role>` first. The result now lists available `skin` / `view` values and ready-to-copy generate commands.
> 🧾 If you need JSON output, run `pnpm find Pepe --json`.

Convert Arknights Spine assets described by PRTS metadata into deterministic sprite sheets for Codex custom pets.

> Production-ready workflow for role-name lookup, automatic PRTS asset resolution, Codex config generation, and final pet package output.
> Successful `generate` runs also write a readable config copy to `examples/auto/<role-name>.codex.json` for manual edits.

## Pipeline

```text
PRTS meta.json
  -> resolve .skel/.atlas/texture URLs
  -> detect Spine exporter version
  -> select a matching runtime adapter
  -> inspect and map animations to Codex states
  -> deterministically sample transparent frames
  -> normalize scale and baseline
  -> compose spritesheet.webp + pet.json
```

## Current milestone

- fetch and validate PRTS `meta.json`
- list available skins and views
- resolve `.skel` and `.atlas` URLs
- parse one or more texture pages from a Spine atlas
- read hash and exporter version from the binary `.skel` header
- recommend a versioned runtime key such as `spine-3.8`
- download a deterministic local Spine package
- inspect Spine 3.8 animation names, durations, setup-pose bounds, and sampled bounds
- run typecheck and unit tests in GitHub Actions

## Usage

Requires Node.js 20+ and pnpm 9+.

### How to find skin names

Many users want a non-default skin instead of the base model. The simplest workflow is:

1. Search the role. `pnpm find` now returns the role's available `variants` and ready-to-copy `generate` / `generate:chrome` commands:

```bash
pnpm find Platina
```

2. Copy the `skin` and `view` values directly into `generate`:

```bash
pnpm generate:chrome Platina --skin 灿阳朝露 SD05 --view 正面
```

3. If you want to double-check manually, open the local database file:

```text
database/prts-characters.json
```

4. Search for the role name or `characterId`, then inspect the `variants` array:

```json
{
  "skin": "灿阳朝露 SD05",
  "view": "正面",
  "file": "char_204_platnm_summer_3/front/char_204_platnm_summer_3"
}
```

```bash
pnpm install
pnpm sync-db
pnpm characters --query Pepe
pnpm generate:chrome Pepe --skin 默认 --view 基建
pnpm inspect -- char_4058_pepe --list
pnpm inspect -- char_4058_pepe --skin 默认 --view 基建
pnpm inspect -- char_4058_pepe --skin 默认 --view 基建 \
  --output .cache/pepe.manifest.json
pnpm download -- .cache/pepe.manifest.json --output .cache/pepe
pnpm inspect-animations -- .cache/pepe \
  --output .cache/pepe.animations.json
pnpm exec playwright install chromium
pnpm preview -- .cache/pepe --animation Move --frames 8 \
  --width 512 --height 512 --output .cache/preview-move
pnpm bake -- .cache/pepe \
  --config examples/char_4058_pepe.codex.json \
  --output dist/pepe
```

If you already have Google Chrome installed locally, you can skip `playwright install` and use the `:chrome` command variants to drive the system Chrome directly:

```bash
pnpm preview:chrome -- .cache/pepe --animation Move --frames 8 \
  --width 512 --height 512 --output .cache/preview-move
pnpm bake:chrome -- .cache/pepe \
  --config examples/char_4058_pepe.codex.json \
  --output dist/pepe
```

## Local character database and one-shot generation

The project now supports a local PRTS character database at `database/prts-characters.json`.
It stores role names, `char_xxx` ids, and the available `skin/view/file` mappings resolved from PRTS metadata without downloading full Spine packages.

```bash
pnpm sync-db
pnpm characters --query Ifrit
pnpm generate:chrome Ifrit --skin 默认 --view 基建
./scripts/generate-codex.sh Pepe 默认 基建
scripts\generate-codex.bat Pepe 默认 基建
```

`generate` is a new aggregate command that chains database lookup, manifest resolution, resource download, animation inspection, automatic bake-config generation, and final Codex baking in one call.
It reads the local `database/prts-characters.json` file as-is and does not refresh it automatically; run `pnpm sync-db` manually when you want to update the JSON.

A resolved manifest now includes:

```json
{
  "spine": {
    "hash": "...",
    "version": "3.8.xx",
    "majorMinor": "3.8",
    "recommendedRuntime": "spine-3.8"
  }
}
```

The concrete version above is illustrative; the command reads the version from the selected model instead of assuming it. The first installed adapter targets Spine 3.8, which is the exporter family used by Pepe's base model.

`inspect-animations` samples each animation at 16 deterministic timestamps by default. Use `--samples` to trade speed for a denser union-bounds estimate. The command reports unsupported exporter families explicitly instead of attempting to parse them with an incompatible runtime.

`preview` launches a controlled headless Chromium instance, seeks the selected Spine animation to deterministic timestamps, and writes transparent PNG frames plus `contact-sheet.png`. Some PRTS packages declare a larger Atlas page than the PNG currently served by the CDN (Pepe declares 624×624 but receives 416×416); the preview server detects this mismatch and normalizes the texture to the Atlas dimensions in memory without modifying the downloaded source package.

`bake` renders only the unique mapped animations, applies one shared scale and bottom-center baseline, derives transformed states such as mirrored left-running and synthesized jumping, and emits a Codex V1 package:

```text
dist/pepe/
├── pet.json
├── spritesheet.webp       # 1536×1872, transparent, lossless
├── mapping.json
└── qa/
    ├── contact-sheet.png
    ├── validation.json
    ├── animations/
    └── states/
```

## Why version detection comes first

Spine binary data is runtime-version-sensitive. The browser renderer must use a runtime compatible with the model's exporter version. The project therefore routes a model through a versioned adapter before trying to load animations.

The conversion is treated as an offline animation-baking pipeline, not as a PixiJS-to-image conversion. PixiJS/Spine Runtime will later render deterministic timestamps into transparent frames. A separate compositor will normalize union bounds and foot baseline, then create the fixed Codex sprite sheet.

Texture filenames are read from `.atlas`; the tool does not assume `${base}.png`, because an atlas can contain multiple texture pages.

## Codex version support and switching

This project supports two versions of the Codex pet specification, switchable via a single field in the bake config JSON:

| Version | State rows | Spritesheet size | State list |
|---------|------------|------------------|------------|
| V1 (`codexVersion: 1`) | 9 rows | 1536 × 1872 (192×8 × 208×9) | idle, running-right, running-left, waving, jumping, failed, waiting, running, review |
| V2 (`codexVersion: 2`) | 11 rows | 1536 × 2288 (192×8 × 208×11) | All V1 states + look-directions-a, look-directions-b |

**How to switch**: simply set `codexVersion` in your config JSON to `1` or `2`. The bake pipeline automatically:
1. Validates that `states` covers every required state for that version (missing any → Zod error)
2. Generates the matching number of rows (fixed 8 frames per row, 192×208 px each)
3. Writes `spriteVersionNumber` with the matching version into the output `pet.json`

> V2 is a strict superset of V1: a V2 config can be baked as V1 output (just drops the last two rows), but a V1 config cannot be baked as V2 output (the two new states would be missing).

---

## Bake config JSON — complete reference

The `bake` command accepts a "Codex state mapping config JSON" via the `--config` option. This config is strictly validated against a Zod schema in [`src/bake.ts` L58–L85](src/bake.ts#L58-L85). Below is a detailed breakdown of every field.

### Top-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | `1` | ✅ | Config schema version. Currently a literal `1`, reserved for future forward compatibility. |
| `characterId` | string | ✅ | PRTS character id, e.g. `char_4058_pepe`. **Must exactly match the downloaded Spine package manifest**, or bake refuses to run. |
| `skin` | string | ✅ | Skin name, e.g. `默认`. Same — must match the manifest. |
| `view` | string | ✅ | View name, e.g. `基建`. Same — must match the manifest. |
| `codexVersion` | `1 \| 2` | ✅ | Codex pet spec version. Decides which states are required and how many rows the output spritesheet has. |
| `pet` | object | ✅ | Output pet metadata object, written verbatim into the final `pet.json`. |
| `normalization` | object | ✅ | Frame normalization parameters — per-frame size, baseline position, etc. |
| `states` | object | ✅ | The core mapping: each Codex state → either a source animation or a derivation rule. |

### `pet` object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Pet unique id, regex-validated: `^[a-z0-9][a-z0-9_-]*$` (starts with lowercase letter or digit, allows `_` and `-`). |
| `displayName` | string | Pet display name, any non-empty string. |
| `description` | string | Pet description text, any non-empty string. |

### `normalization` object (frame normalization)

Every field is either a fixed literal or bounded by strict range checks:

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| `cellWidth` | `192` | literal | Single frame width in px. Codex spec currently fixes this at 192. |
| `cellHeight` | `208` | literal | Single frame height in px. Codex spec currently fixes this at 208. |
| `anchor` | `"bottom-center"` | literal | Anchor point. Only "bottom-center" is supported. |
| `baselineY` | integer | 1 ≤ x ≤ 207 | Foot baseline Y coordinate in px (measured from frame top). The character's feet align to this horizontal line, preventing the character from bobbing between animations. Tune this by eye via `preview` and then `qa/contact-sheet.png`. |
| `padding` | integer | 0 ≤ x ≤ 95 | Transparent inner padding on all sides in px. Prevents clipping on large-motion animations. |

### `states` object (core mapping)

Keys must be **every state required by the configured `codexVersion`** (missing keys fail validation; key order does not matter). Each value takes one of two forms: **direct animation map** or **derived state**.

#### Form A: Direct animation map (renders a source Spine animation)

```json
{
  "animation": "Relax",
  "frames": 8
}
```

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| `animation` | string | non-empty | The source Spine animation name. Must appear in the `inspect-animations` output, or bake throws. |
| `frames` | `8` | literal | Number of sampled frames. Codex spec fixes every state at exactly 8 frames. |

> bake computes a single **shared union bounds (sharedBounds)** across all "direct-mapped" animations and renders them all with the same scale factor, so the character stays a consistent size across every state.

#### Form B: Derived state (transformed from an already-defined state)

Re-renders nothing — produces frames by image-transforming an existing state. Two transforms are available; use either or both (at least one is required):

```json
{
  "deriveFrom": "running-right",
  "flipX": true
}
```

```json
{
  "deriveFrom": "idle",
  "offsetY": [0, -6, -12, -18, -18, -12, -6, 0]
}
```

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| `deriveFrom` | string | Must be an already-defined Codex state name | The source state. **Must be declared before this state in the config** (derivations are processed in order). |
| `flipX` | `true` | optional, literal | Horizontal flip (mirror). Typical use: derive "running-left" from "running-right". |
| `offsetY` | `number[8]` | optional, length-8 integer array | Per-frame vertical offset in px (positive = down, negative = up). Used to synthesize missing source animations such as jumping: an upward arc is simulated with negative offsets. The 8 entries correspond to frame 0…7 respectively. |

> ⚠️ Validation rule for derived states: must supply at least one of `flipX` **or** `offsetY` (both together is fine). Supplying neither is rejected by Zod.

### Full example with line-by-line comments

```jsonc
{
  // Fixed: schema version literal
  "schemaVersion": 1,
  // Character identifiers — must exactly match the downloaded Spine manifest
  "characterId": "char_4058_pepe",
  "skin": "默认",
  "view": "基建",

  // Codex version — set to 1 to require only the first 9 states
  "codexVersion": 2,

  // Output pet metadata
  "pet": {
    "id": "pepe",
    "displayName": "佩佩",
    "description": "Arknights operator Pepe"
  },

  // Frame normalization
  "normalization": {
    "cellWidth": 192,
    "cellHeight": 208,
    "anchor": "bottom-center",
    "baselineY": 198,   // foot baseline; tune per character
    "padding": 10       // anti-clipping padding
  },

  // State mapping: key order doesn't matter, but all states for codexVersion must be present
  "states": {
    // === These 9 are common to V1 and V2 ===
    "idle":     { "animation": "Relax",    "frames": 8 },
    "running-right": { "animation": "Move", "frames": 8 },

    // Derived: mirror run-right → run-left (no re-render)
    "running-left":  { "deriveFrom": "running-right", "flipX": true },

    "waving":   { "animation": "Interact", "frames": 8 },

    // Derived: idle frames + vertical offset arc → jump animation
    "jumping":  {
      "deriveFrom": "idle",
      "offsetY": [0, -6, -12, -18, -18, -12, -6, 0]
    },

    "failed":   { "animation": "Sleep",    "frames": 8 },
    "waiting":  { "animation": "Sit",      "frames": 8 },
    "running":  { "animation": "Move",     "frames": 8 },
    "review":   { "animation": "Interact", "frames": 8 },

    // === These 2 are V2-only ===
    "look-directions-a": { "animation": "Relax", "frames": 8 },
    "look-directions-b": { "animation": "Relax", "frames": 8 }
  }
}
```

### Recommended workflow for authoring a config

1. **Run `inspect-animations`** to get the list of source animation names.
2. **Run `preview`** on candidate animations to visually match them to Codex semantics (e.g. Relax → idle).
3. **Reuse animations where possible**: multiple Codex states can point to the same source animation (in the example, both `review` and `waving` use `Interact`). bake renders each unique animation only once, so this saves time.
4. **Fill derived states**:
   - For left/right running: typically define one direction and mirror the other.
   - If no jump animation exists: synthesize it from idle with an `offsetY` arc.
5. **Tune `baselineY` and `padding`**: start with rule-of-thumb values (e.g. `baselineY: 198`, `padding: 10`), bake once, then inspect `qa/contact-sheet.png` for clipping or bobbing and iterate.
6. **Run bake once end-to-end**: Zod emits precise errors on any missing state or typo (e.g. `states must cover all required rows`).

---

The generated QA report verifies dimensions, alpha support, row order, mapping, shared source bounds, and a SHA-256 digest of the final WebP.

The first adapter will be selected from the exporter version reported by the PRTS model manifest rather than hard-coded to the newest Pixi runtime.

## Legal note

Publicly reachable assets are not automatically licensed for redistribution. Confirm the rights for game assets and the Spine Runtime before packaging or publishing generated pets.
