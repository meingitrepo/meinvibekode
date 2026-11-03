#!/usr/bin/env bash
# Regenerates .cache/specs/status.md (git-ignored) from main's history: one line per release, newest first.
# After a compaction or in a new thread read this file instead of the specs and plans. Text you write below
# the "<!-- notes -->" line (open items, decisions) is kept.
# Usage: highlighter/tools/status.sh [how-many-releases=40]
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git fetch -q origin main 2>/dev/null || true
out=.cache/specs/status.md
mkdir -p .cache/specs
notes='<!-- notes -->'
tail=
[ -f "$out" ] && tail=$(sed -n "/^$notes\$/,\$p" "$out" | tr -d '\r')
{
    echo "# Status (generated $(date '+%Y-%m-%d %H:%M') from origin/main $(git rev-parse --short origin/main))"
    echo
    echo "Current version: $(git show origin/main:highlighter/src/header.js | sed -n 's/^\/\/ @version *//p' | head -1)"
    echo
    git log origin/main -"${1:-40}" --no-merges --format='- %h %s' -E --grep='^([0-9]+\.[0-9]+|cfg):'
    echo
    if [ -n "$tail" ]; then echo "$tail"; else echo "$notes"; fi
} > "$out"
echo "wrote $out ($(grep -c '^- ' "$out") releases)"
