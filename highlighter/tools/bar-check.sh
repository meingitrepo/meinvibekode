#!/usr/bin/env bash
# The "scan the diff for a lowered bar" guardrail in one call (details in bar-check.js).
# Usage: highlighter/tools/bar-check.sh [base-ref]     default origin/main; exit 1 if the bar was lowered
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
exec node highlighter/tools/bar-check.js "$@"
