#!/usr/bin/env bash
# Checks CLAUDE.md's Map lists the same src/ files as PARTS in build.js, in the same order.
# Usage: highlighter/tools/map-check.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
a=$(grep -oE "^\s+'[a-z-]+\.js'" highlighter/build.js | tr -d " '" | sed 's/\.js$//')
b=$(sed -n '/^## Map/,$p' CLAUDE.md | grep -oE '^- `[a-z-]+`' | sed 's/^- `//; s/`$//')
if [ "$a" = "$b" ]; then echo "map ok"; else diff <(echo "$a") <(echo "$b") || true; echo "map out of date"; exit 1; fi
