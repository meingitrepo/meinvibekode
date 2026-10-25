#!/usr/bin/env bash
# Captures frames of an animation on the test playground page.
# Usage: highlighter/tools/film.sh <out-prefix> [light|dark] <js that starts the animation> [frames=6] [gap-ms=40]
#   e.g. film.sh /tmp/f dark "__hl.openEverything()"  -> /tmp/f-0.png ... /tmp/f-5.png
set -euo pipefail
[ $# -ge 3 ] || { echo 'usage: film.sh <out-prefix> [light|dark] <js> [frames] [gap-ms]'; exit 2; }
. "$(dirname "$0")/test-env.sh"   # Playwright: /opt/node22 on the sandbox, else the repo-root .cache/playwright
exec node "$(dirname "$0")/film.js" "$@"
