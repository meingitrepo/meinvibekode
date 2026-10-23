#!/usr/bin/env bash
# Releases the local highlighter change to main in one go, after Mhmd's PUSH:
# commit (if needed), fetch, rebase, pick @version as main's + 1,
# build, check, push; on a rejected push it starts again from the fetch.
# Usage: highlighter/tools/release.sh "Theme" "What's in it" "Commit message (body and trailers allowed)"
# Don't bump @version or commit the built file yourself; this does it.
set -euo pipefail
[ $# -eq 3 ] || { echo 'usage: release.sh "Theme" "What'"'"'s in it" "Commit message"'; exit 2; }
theme=$1 what=$2 msg=$3
cd "$(git rev-parse --show-toplevel)"
H=highlighter

if [ -n "$(git status --porcelain -- $H)" ]; then
    git checkout -q HEAD -- $H/Highlighter.user.js   # rebuilt below
    git add -A $H
    git diff --cached --quiet || git commit -q -m "$msg"
fi

for attempt in 1 2 3; do
    tools=$(dirname "$0")
    $tools/sync.sh || exit 1
    [ -n "$(git log --oneline origin/main..HEAD)" ] || { echo 'nothing to release'; exit 1; }
    code=$(git rev-parse HEAD)
    cur=$(git show origin/main:$H/src/header.js | sed -n 's/^\/\/ @version *//p' | head -1)
    ver="${cur%%.*}.$(( ${cur#*.} + 1 ))"
    sed -i "s/^\(\/\/ @version *\).*/\1$ver/" $H/src/header.js
    (cd $H && node build.js >/dev/null && node build.js --check)
    git add $H/src/header.js $H/Highlighter.user.js
    git commit -q --amend -m "$ver: $msg"
    if git push -q origin HEAD:main; then
        echo "PUSHED $ver ($(git rev-parse --short HEAD)) to main"; exit 0
    fi
    git reset -q --hard "$code"   # drop this attempt's version and build, then retry
done
echo 'push rejected 3 times'; exit 1
