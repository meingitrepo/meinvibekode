#!/usr/bin/env bash
# Releases the local highlighter change to main in one go, after the User's PUSH:
# commit (if needed), fetch, rebase, pick @version as main's + 1,
# build, check, push; on a rejected push it starts again from the fetch.
# Usage: highlighter/tools/release.sh "Theme" "What's in it" "Commit message (body and trailers allowed)"
# Don't bump @version or commit the built file yourself; this does it.
set -euo pipefail

# Log row (tab-separated, plain values): date, version, tier, attempts, files, insertions, deletions.
# Usage: log_row <version> <attempt> <from> <to>
log_row() {
    printf '%s	%s	%s	%s	%s
' "$(date +%F)" "$1" "${TIER:-?}" "$2" \
        "$(git diff --numstat "$3" "$4" | awk '{f++; if ($1 != "-") {i += $1; d += $2}} END {printf "%d	%d	%d", f, i, d}')"
}

# Prints a log row as one readable line.
show_metrics() {
    local date ver tier attempts files ins del
    IFS=$'	' read -r date ver tier attempts files ins del <<< "$1"
    echo "METRICS $date · $tier · attempts $attempts · ${files}f +$ins -$del"
}

# Files mode, for changes outside highlighter/ (settings, docs): commit only the named files, no @version bump or build.
# Usage: release.sh --files "path1 path2" "Theme" "What's in it" "Commit message"   (paths without spaces)
if [ "${1:-}" = --files ]; then
    [ $# -eq 5 ] || { echo 'usage: release.sh --files "paths" "Theme" "What'"'"'s in it" "Commit message"'; exit 2; }
    read -ra files <<< "$2"; theme=$3 msg="cfg: $5"
    cd "$(git rev-parse --show-toplevel)"
    other=$(git status --porcelain -- . "${files[@]/#/:(exclude)}")
    [ -z "$other" ] || { echo 'REFUSED: other changes in the tree, commit or stash them first:'; echo "$other"; exit 1; }
    git add -- "${files[@]}"
    git diff --cached --quiet && { echo 'nothing to release'; exit 1; }
    git commit -q -m "$msg"
    for attempt in 1 2 3; do
        git fetch -q origin main
        git rebase -q origin/main || { echo 'REBASE CONFLICT: resolve keeping BOTH changes, git rebase --continue, rerun'; exit 1; }
        if git push -q origin HEAD:main; then
            echo "PUSHED cfg ($(git rev-parse --short HEAD)) to main"
            line=$(log_row cfg "$attempt" HEAD~1 HEAD)
            mkdir -p .cache && echo "$line" >> .cache/metrics.tsv
            show_metrics "$line"; exit 0
        fi
    done
    echo 'push rejected 3 times'; exit 1
fi

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
    cur=$(git show origin/main:$H/src/header.js | sed -n 's/^\/\/ @version *//p' | head -1)
    ver="${cur%%.*}.$(( ${cur#*.} + 1 ))"
    sed -i "s/^\(\/\/ @version *\).*/\1$ver/" $H/src/header.js
    (cd $H && node build.js >/dev/null && node build.js --check)
    git add $H/src/header.js $H/Highlighter.user.js
    git commit -q --amend -m "$ver: $msg"
    if git push -q origin HEAD:main; then
        echo "PUSHED $ver ($(git rev-parse --short HEAD)) to main"
        # Metrics: tier is passed in (TIER=T0..T3); the rest is measured here. Log is git-ignored (.cache/).
        line=$(log_row "$ver" "$attempt" "$base" HEAD)
        mkdir -p .cache && echo "$line" >> .cache/metrics.tsv
        show_metrics "$line"; exit 0
    fi
    git reset -q --hard "$code"   # drop this attempt's version and build, then retry
done
echo 'push rejected 3 times'; exit 1
