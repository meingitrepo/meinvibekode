#!/usr/bin/env bash
# Lists test lines (file:line) that mention a retired key, color or behaviour term,
# so they can be updated or removed before asking PUSH.
# Usage: highlighter/tools/stale-checks.sh <old-term> [more terms...]
set -euo pipefail
[ $# -ge 1 ] || { echo 'usage: stale-checks.sh <old-term> [...]'; exit 2; }
cd "$(dirname "$0")/../test"
for t in "$@"; do echo "== $t"; grep -n -i -F -- "$t" *.test.js lib.js playground.html || echo "(none)"; done
