#!/usr/bin/env bash
# Releases the local highlighter change to main in one go, after Mhmd's PUSH:
# commit (if needed), fetch, rebase, pick @version as main's + 1, add the ROADMAP-SHIPPED row,
# build, check, push; on a rejected push it starts again from the fetch.
# Usage: highlighter/release.sh "Theme" "What's in it" "Commit message (body and trailers allowed)"
# Don't bump @version, touch ROADMAP files or commit the built file yourself; this does it.
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
    git fetch -q origin main
    [ -n "$(git log --oneline origin/main..HEAD)" ] || { echo 'nothing to release'; exit 1; }
    base=$(git merge-base HEAD origin/main)
    overlap=$(comm -12 <(git diff --name-only "$base" origin/main | sort) \
                       <(git diff --name-only "$base" HEAD | grep -v -e Highlighter.user.js -e ROADMAP -e header.js | sort) || true)
    if ! git rebase -q origin/main; then
        echo 'REBASE CONFLICT: resolve keeping BOTH changes, git rebase --continue, rerun related tests, then run this again'
        exit 1
    fi
    if [ -n "$overlap" ]; then
        echo "Main changed files you also changed (merged in, rebased):"; echo "$overlap"
        echo 'Rerun the related tests, then run this again. Mention the merged-in change in your reply.'
        exit 1
    fi
    code=$(git rev-parse HEAD)
    cur=$(git show origin/main:$H/src/header.js | sed -n 's/^\/\/ @version *//p' | head -1)
    ver="${cur%%.*}.$(( ${cur#*.} + 1 ))"
    sed -i "s/^\(\/\/ @version *\).*/\1$ver/" $H/src/header.js
    last=$(grep -n '^| [0-9]*\.[0-9]* |' $H/ROADMAP-SHIPPED.md | tail -1 | cut -d: -f1)
    VER="$ver" THEME="$theme" WHAT="$what" LAST="$last" node -e '
        const fs = require("fs"), f = "highlighter/ROADMAP-SHIPPED.md", e = process.env;
        const lines = fs.readFileSync(f, "utf8").split("\n");
        lines.splice(+e.LAST, 0, `| ${e.VER} | ${e.THEME} | ${e.WHAT} |`);
        fs.writeFileSync(f, lines.join("\n"));'
    (cd $H && node build.js >/dev/null && node build.js --check)
    git add $H/src/header.js $H/ROADMAP-SHIPPED.md $H/Highlighter.user.js
    git commit -q --amend -m "$ver: $msg"
    if git push -q origin HEAD:main; then
        echo "PUSHED $ver ($(git rev-parse --short HEAD)) to main"; exit 0
    fi
    git reset -q --hard "$code"   # drop this attempt's version, row and build, then retry
done
echo 'push rejected 3 times'; exit 1
