#!/usr/bin/env bash
# Empties .cache/ but keeps the folders listed in KEEP (specs, plans, and the slow-to-reinstall playwright).
# Usage: highlighter/tools/clear-cache.sh [--all] [--dry-run]
#   --all      wipe everything, keep list included
#   --dry-run  only list what would be removed (with sizes) and what is kept; delete nothing
set -euo pipefail
KEEP=(specs plans playwright)
root=$(git rev-parse --show-toplevel)
cache="$root/.cache"
[ -d "$cache" ] || { echo 'no .cache'; exit 0; }
all=0 dry=0
for a in "$@"; do
    case $a in
        --all) all=1 ;;
        --dry-run) dry=1 ;;
        *) echo "unknown option: $a"; exit 2 ;;
    esac
done
removed=0 kept=()
for p in "$cache"/* "$cache"/.[!.]*; do
    [ -e "$p" ] || continue
    name=$(basename "$p")
    if [ $all -eq 0 ]; then
        skip=0; for k in "${KEEP[@]}"; do [ "$name" = "$k" ] && skip=1; done
        if [ $skip -eq 1 ]; then kept+=("$name"); continue; fi
    fi
    if [ $dry -eq 1 ]; then echo "would remove: $name ($(du -sh "$p" | cut -f1))"
    else rm -rf "$p"; fi
    removed=$((removed+1))
done
verb=cleared; [ $dry -eq 1 ] && verb='would clear'
echo "$verb $removed item(s) from .cache (kept: ${kept[*]:-nothing})"
