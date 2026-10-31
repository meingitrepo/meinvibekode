#!/usr/bin/env bash
# Type-checks the built userscript (tsc, non-strict) and fails on errors beyond tools/typecheck-baseline.txt.
# Usage: highlighter/tools/typecheck.sh [--update]   (--update lowers the baseline after errors were fixed)
set -euo pipefail
exec node "$(dirname "$0")/typecheck.js" "$@"
