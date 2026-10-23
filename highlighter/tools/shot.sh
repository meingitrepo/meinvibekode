#!/usr/bin/env bash
# Screenshots the built userscript on the test playground page.
# Usage: highlighter/tools/shot.sh <out.png> [light|dark] [js to run in the page first]
#   SHOT_FIXTURE=tools/shot-fixture.json seeds saved annotations (pages and notes) for panel shots.
#   Preset names instead of js (seed the fixture themselves): panel, panel-ticked, all, all-ticked.
#   e.g. shot.sh /tmp/p.png dark "__hl.openPanel()"
set -euo pipefail
[ $# -ge 1 ] || { echo 'usage: shot.sh <out.png> [light|dark] [js]'; exit 2; }
export NODE_PATH=${NODE_PATH:-/opt/node22/lib/node_modules}
exec node "$(dirname "$0")/shot.js" "$@"
