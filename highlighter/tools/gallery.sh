#!/usr/bin/env bash
# Renders every UI state of the built userscript, light and dark, into .cache/gallery/index.html.
# Usage: highlighter/tools/gallery.sh [--only id,id] [--variants file.json] [--watch]
set -euo pipefail
. "$(dirname "$0")/test-env.sh"   # Playwright: /opt/node22 on the sandbox, else the repo-root .cache/playwright
exec node "$(dirname "$0")/gallery.js" "$@"
