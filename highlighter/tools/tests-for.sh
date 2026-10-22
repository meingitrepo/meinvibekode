#!/usr/bin/env bash
# Lists the test suites whose source mentions a keyword (feature, key, color), then runs them.
# Usage: highlighter/tools/tests-for.sh <keyword> [--list]
set -euo pipefail
[ $# -ge 1 ] || { echo 'usage: tests-for.sh <keyword> [--list]'; exit 2; }
cd "$(dirname "$0")/../test"
mapfile -t files < <(grep -l -i -F -- "$1" *.test.js || true)
[ ${#files[@]} -gt 0 ] || { echo "no suite mentions '$1'"; exit 0; }
words=(); for f in "${files[@]}"; do words+=("${f%.test.js}"); done
echo "suites: ${words[*]}"
[ "${2:-}" = "--list" ] && exit 0
NODE_PATH=${NODE_PATH:-/opt/node22/lib/node_modules} node run.js "${words[@]}"
