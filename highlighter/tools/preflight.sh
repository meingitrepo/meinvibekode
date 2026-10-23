#!/usr/bin/env bash
# Before asking PUSH: build + check, then show what changed and the release.sh line to run.
# Usage: highlighter/tools/preflight.sh ["Theme" "What's in it" "Commit message"]
set -euo pipefail
cd "$(dirname "$0")/../.."
highlighter/tools/build.sh
git fetch -q origin main || true
echo "--- local vs origin/main"; git status -sb | head -1
echo "--- changes"; git diff HEAD --stat -- . ':!highlighter/Highlighter.user.js'; git log --oneline origin/main..HEAD 2>/dev/null
if [ $# -eq 3 ]; then
    printf -- '--- on PUSH run:\nhighlighter/tools/release.sh %q %q %q\n' "$1" "$2" "$3"
else
    echo '--- on PUSH run: highlighter/tools/release.sh "Theme" "What'"'"'s in it" "Commit message"'
fi
