#!/usr/bin/env bash
# Empties .cache/ but keeps the folders listed in KEEP (specs, plans, and the slow-to-reinstall playwright).
# Usage: highlighter/tools/clear-cache.sh [--all]    (--all wipes everything, keep list included)
set -euo pipefail
KEEP=(specs plans playwright)
root=$(git rev-parse --show-toplevel)
cache="$root/.cache"
[ -d "$cache" ] || { echo 'no .cache'; exit 0; }
all=0; [ "${1:-}" = --all ] && all=1
removed=0
for p in "$cache"/* "$cache"/.[!.]*; do
    [ -e "$p" ] || continue
    name=$(basename "$p")
    if [ $all -eq 0 ]; then
        skip=0; for k in "${KEEP[@]}"; do [ "$name" = "$k" ] && skip=1; done
        [ $skip -eq 1 ] && continue
    fi
    rm -rf "$p"; removed=$((removed+1))
done
echo "cleared $removed item(s) from .cache (kept: $([ $all -eq 1 ] && echo nothing || echo "${KEEP[*]}"))"
