#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <角色名> [skin] [view] [output]"
  echo "Example: $0 佩佩 默认 基建 dist/pepe"
  exit 1
fi

ROLE_NAME="$1"
SKIN="${2:-默认}"
VIEW="${3:-基建}"
OUTPUT_DIR="${4:-}"

ARGS=("$ROLE_NAME" "--skin" "$SKIN" "--view" "$VIEW")

if [ -n "$OUTPUT_DIR" ]; then
  ARGS+=("--output" "$OUTPUT_DIR")
fi

ARK_PET_BROWSER=chrome pnpm exec tsx src/cli.ts generate "${ARGS[@]}"
