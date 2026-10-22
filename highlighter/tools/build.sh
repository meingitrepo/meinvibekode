#!/usr/bin/env bash
# Builds the userscript from src/ and verifies it: prints one line.
# Usage: highlighter/tools/build.sh
set -euo pipefail
cd "$(dirname "$0")/.."
node build.js >/dev/null && node build.js --check && node --check Highlighter.user.js && echo "build ok"
