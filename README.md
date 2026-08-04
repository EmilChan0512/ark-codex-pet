# ark-codex-pet

Convert Arknights Spine assets described by PRTS metadata into deterministic sprite sheets for Codex custom pets.

> Early prototype: build a stable, version-aware resource manifest before deterministic Spine frame baking.

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
- emit a normalized manifest for the future baker
- run typecheck and unit tests in GitHub Actions

## Usage

Requires Node.js 20+ and pnpm 9+.

```bash
pnpm install
pnpm inspect -- char_4058_pepe --list
pnpm inspect -- char_4058_pepe --skin 默认 --view 基建
pnpm inspect -- char_4058_pepe --skin 默认 --view 基建 \
  --output .cache/pepe.manifest.json
```

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

The concrete version above is illustrative; the command reads the version from the selected model instead of assuming it.

## Why version detection comes first

Spine binary data is runtime-version-sensitive. The browser renderer must use a runtime compatible with the model's exporter version. The project therefore routes a model through a versioned adapter before trying to load animations.

The conversion is treated as an offline animation-baking pipeline, not as a PixiJS-to-image conversion. PixiJS/Spine Runtime will later render deterministic timestamps into transparent frames. A separate compositor will normalize union bounds and foot baseline, then create the fixed Codex sprite sheet.

Texture filenames are read from `.atlas`; the tool does not assume `${base}.png`, because an atlas can contain multiple texture pages.

## Next milestone

Add versioned browser runtime adapters and an `inspect-animations` command that reports:

- animation names and durations
- setup-pose bounds
- sampled union bounds per animation
- runtime compatibility failures with actionable diagnostics
- preview contact sheets

The first adapter will be selected from the exporter version reported by the PRTS model manifest rather than hard-coded to the newest Pixi runtime.

## Legal note

Publicly reachable assets are not automatically licensed for redistribution. Confirm the rights for game assets and the Spine Runtime before packaging or publishing generated pets.
