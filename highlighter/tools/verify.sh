#!/usr/bin/env bash
# One call for the usual pre-PUSH loop: build + check, the suites that mention each keyword, then the diffstat.
# Usage: highlighter/tools/verify.sh <keyword> [more keywords...]
set -euo pipefail
[ $# -ge 1 ] || { echo 'usage: verify.sh <keyword> [more keywords...]'; exit 2; }
cd "$(dirname "$0")/../.."
highlighter/tools/build.sh
status=0
echo "--- typecheck"; highlighter/tools/typecheck.sh || status=1
for k in "$@"; do
    echo "--- suites for '$k'"
    highlighter/tools/tests-for.sh "$k" || status=1
done
echo "--- changes"; git diff HEAD --stat -- . ':!highlighter/Highlighter.user.js'
exit $status
