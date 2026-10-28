#!/usr/bin/env bash
# Releases the local highlighter change to main in one go, after the User's PUSH:
# commit (if needed), fetch, rebase, pick @version as main's + 1,
# build, check, push; on a rejected push it starts again from the fetch.
# Usage: highlighter/tools/release.sh "Theme" "What's in it" "Commit message (body and trailers allowed)"
# Don't bump @version or commit the built file yourself; this does it.
set -euo pipefail
[ $# -eq 3 ] || { echo 'usage: release.sh "Theme" "What'"'"'s in it" "Commit message"'; exit 2; }
theme=$1 what=$2 msg=$3
tools=$(cd "$(dirname "$0")" && pwd)
cd "$(git rev-parse --show-toplevel)"
H=highlighter

if [ -n "$(git status --porcelain -- $H)" ]; then
    git checkout -q HEAD -- $H/Highlighter.user.js   # rebuilt below
    git add -A $H
    git diff --cached --quiet || git commit -q -m "$msg"
fi

for attempt in 1 2 3; do
    "$tools/sync.sh" || exit 1
    [ -n "$(git log --oneline origin/main..HEAD)" ] || { echo 'nothing to release'; exit 1; }
    code=$(git rev-parse HEAD)
    base=$(git rev-parse origin/main)
    first=$(git log --format=%ct "$base..HEAD" | tail -1)
    cur=$(git show origin/main:$H/src/header.js | sed -n 's/^\/\/ @version *//p' | head -1)
    ver="${cur%%.*}.$(( ${cur#*.} + 1 ))"
    sed -i "s/^\(\/\/ @version *\).*/\1$ver/" $H/src/header.js
    (cd $H && node build.js >/dev/null && node build.js --check)
    git add $H/src/header.js $H/Highlighter.user.js
    git commit -q --amend -m "$ver: $msg"
    if git push -q origin HEAD:main; then
        echo "PUSHED $ver ($(git rev-parse --short HEAD)) to main"
        # Metrics: tier is passed in (TIER=T0..T3); the rest is measured here. Log is git-ignored (.cache/).
        mins=$(( ($(date +%s) - first) / 60 ))
        stat=$(git diff --shortstat "$base" HEAD | sed 's/^ *//')
        line="$(date +%F)	$ver	${TIER:-?}	$theme	push-attempts=$attempt	cycle=${mins}m	$stat"
        mkdir -p .cache && echo "$line" >> .cache/metrics.tsv
        echo "METRICS $line"; exit 0
    fi
    git reset -q --hard "$code"   # drop this attempt's version and build, then retry
done
echo 'push rejected 3 times'; exit 1
