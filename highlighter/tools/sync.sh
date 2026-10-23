#!/usr/bin/env bash
# Rebases local work onto the latest origin/main (uncommitted work is kept), rebuilds, and reports conflicts
# and files main changed that you also changed. Run it before asking PUSH; release.sh uses it too.
# Usage: highlighter/tools/sync.sh        exit 0 clean, 1 conflict, 3 rebased but main touched files you changed
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
H=highlighter
git checkout -q HEAD -- $H/Highlighter.user.js   # built file is regenerated, never merged
git fetch -q origin main
base=$(git merge-base HEAD origin/main)
overlap=$(comm -12 <(git diff --name-only "$base" origin/main | sort) \
                   <({ git diff --name-only "$base"; git ls-files -o --exclude-standard; } | grep -v -e Highlighter.user.js -e header.js | sort -u) || true)
if ! git rebase -q --autostash origin/main; then
    echo 'REBASE CONFLICT: resolve keeping BOTH changes, git rebase --continue (or git stash pop), rerun related tests, then run this again'
    exit 1
fi
(cd $H && node build.js >/dev/null && node build.js --check)
echo "On top of origin/main $(git rev-parse --short origin/main); $(git log --oneline origin/main..HEAD | wc -l) local commit(s)"
if [ -n "$overlap" ]; then
    echo "Main changed files you also changed (merged in, rebased):"; echo "$overlap"
    echo 'Rerun the related tests and mention the merged-in change in your reply.'
    exit 3
fi
