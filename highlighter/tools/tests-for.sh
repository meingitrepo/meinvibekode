#!/usr/bin/env bash
# Lists the test suites whose source mentions a keyword (feature, key, color), then runs them.
# Usage: highlighter/tools/tests-for.sh <keyword> [--list]
set -euo pipefail
[ $# -ge 1 ] || { echo 'usage: tests-for.sh <keyword> [--list]'; exit 2; }
TOOLS="$(cd "$(dirname "$0")" && pwd)"
cd "$TOOLS/../test"
mapfile -t files < <(grep -l -i -F -- "$1" *.test.js || true)
[ ${#files[@]} -gt 0 ] || { echo "no suite mentions '$1'"; exit 0; }
words=(); for f in "${files[@]}"; do words+=("${f%.test.js}"); done
echo "suites: ${words[*]}"
[ "${2:-}" = "--list" ] && exit 0
. "$TOOLS/test-env.sh"   # Playwright: /opt/node22 on the sandbox, else the repo-root .cache/playwright
node run.js "${words[@]}"
