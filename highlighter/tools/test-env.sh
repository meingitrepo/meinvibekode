#!/usr/bin/env bash
# Runs the Playwright suites with a local, git-ignored Playwright + Chromium (repo-root .cache/playwright),
# installed once on first use. On the Linux sandbox (/opt/node22) it uses what is already there.
# Usage: highlighter/tools/test-env.sh <word>   (same arguments as node highlighter/test/run.js)
# Source it (. test-env.sh) to only set the environment.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ -d /opt/node22/lib/node_modules ]; then
    export NODE_PATH=/opt/node22/lib/node_modules
else
    PW="$ROOT/.cache/playwright"
    export NODE_PATH="$PW/node_modules"
    export PLAYWRIGHT_BROWSERS_PATH="$PW/browsers"
    if [ ! -d "$NODE_PATH/playwright" ] || [ ! -d "$PLAYWRIGHT_BROWSERS_PATH" ]; then
        mkdir -p "$PW"
        (cd "$PW" && npm install --no-save --no-package-lock --prefix . playwright@1.56.1 && node node_modules/playwright/cli.js install chromium)
    fi
fi
if [ "${BASH_SOURCE[0]}" = "$0" ]; then exec node "$ROOT/highlighter/test/run.js" "$@"; fi
