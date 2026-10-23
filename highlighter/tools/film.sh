#!/usr/bin/env bash
# Captures frames of an animation on the test playground page.
# Usage: highlighter/tools/film.sh <out-prefix> [light|dark] <js that starts the animation> [frames=6] [gap-ms=40]
#   e.g. film.sh /tmp/f dark "__hl.openEverything()"  -> /tmp/f-0.png ... /tmp/f-5.png
set -euo pipefail
[ $# -ge 3 ] || { echo 'usage: film.sh <out-prefix> [light|dark] <js> [frames] [gap-ms]'; exit 2; }
export NODE_PATH=${NODE_PATH:-/opt/node22/lib/node_modules}
exec node "$(dirname "$0")/film.js" "$@"
