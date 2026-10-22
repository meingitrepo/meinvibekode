#!/usr/bin/env bash
# Screenshots the built userscript on the test playground page.
# Usage: highlighter/tools/shot.sh <out.png> [light|dark] [js to run in the page first]
#   e.g. shot.sh /tmp/p.png dark "__hl.openPanel()"
set -euo pipefail
[ $# -ge 1 ] || { echo 'usage: shot.sh <out.png> [light|dark] [js]'; exit 2; }
export NODE_PATH=${NODE_PATH:-/opt/node22/lib/node_modules}
exec node "$(dirname "$0")/shot.js" "$@"
