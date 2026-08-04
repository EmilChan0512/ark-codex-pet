# ark-codex-pet

Convert Arknights Spine assets described by PRTS metadata into deterministic sprite sheets for Codex custom pets.

> Early prototype: the first milestone builds a stable resource manifest before deterministic Spine frame baking.

## Pipeline

```text
PRTS meta.json
  -> resolve .skel/.atlas/texture URLs
  -> inspect Spine animations
  -> map animations to Codex states
  -> deterministically sample transparent frames
  -> normalize scale and baseline
  -> compose spritesheet.webp + pet.json
```

## Current milestone

- fetch and validate PRTS `meta.json`
- list available skins and views
- resolve `.skel` and `.atlas` URLs
- parse one or more texture pages from a Spine atlas
- emit a normalized manifest for the future baker

## Usage

Requires Node.js 20+ and pnpm 9+.

```bash
pnpm install
pnpm inspect -- char_4058_pepe --list
pnpm inspect -- char_4058_pepe --skin 默认 --view 基建
pnpm inspect -- char_4058_pepe --skin 默认 --view 基建 \
  --output .cache/pepe.manifest.json
```

## Why this shape

The conversion is treated as an offline animation-baking pipeline, not as a PixiJS-to-image conversion. PixiJS/Spine Runtime will later render deterministic timestamps into transparent frames. A separate compositor will normalize union bounds and foot baseline, then create the fixed Codex sprite sheet.

Texture filenames are read from `.atlas`; the tool does not assume `${base}.png`, because an atlas can contain multiple texture pages.

## Next milestone

Add a browser-based Spine runtime adapter and an `inspect-animations` command that reports:

- Spine export/runtime version
- animation names and durations
- setup-pose and sampled bounds
- preview contact sheets

## Legal note

Publicly reachable assets are not automatically licensed for redistribution. Confirm the rights for game assets and the Spine Runtime before packaging or publishing generated pets.
