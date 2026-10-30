#!/usr/bin/env bash
# Runs the current test suites against an older build (default: the last release on origin/main) and against the
# current build, so a new test can be seen failing on the code before the fix.
# Usage: highlighter/tools/vs-prev.sh <suite-word> [git-ref]
#   Only the tests are current; the userscript under test is `git show <ref>:highlighter/Highlighter.user.js`.
#   A feature the old build never had can make a test red for the wrong reason: read the failures.
set -uo pipefail
[ $# -ge 1 ] || { echo 'usage: vs-prev.sh <suite-word> [git-ref]'; exit 2; }
cd "$(dirname "$0")/../.."
word="$1"; ref="${2:-origin/main}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git show "$ref:highlighter/Highlighter.user.js" > "$tmp/old.user.js" || { echo "cannot read the build at $ref"; exit 2; }
old="$tmp/old.user.js"
command -v cygpath >/dev/null 2>&1 && old="$(cygpath -m "$old")"   # node needs a Windows path on Windows

echo "=== '$word' against the build at $ref ($(git rev-parse --short "$ref"))"
HL_SCRIPT="$old" highlighter/tools/test-env.sh "$word"; before=$?
highlighter/tools/build.sh >/dev/null
echo "=== '$word' against the current build"
highlighter/tools/test-env.sh "$word"; after=$?
echo "=== previous: $([ $before -eq 0 ] && echo green || echo RED) · current: $([ $after -eq 0 ] && echo green || echo RED)"
[ $before -ne 0 ] && [ $after -eq 0 ] && echo "good: it fails before and passes now"
exit $after
