#!/usr/bin/env bash
# One table for "is it stuck?": every worktree with its branch, commits ahead of origin/main, uncommitted files,
# minutes since the last file change or commit, and whether its work is already on main.
# Usage: highlighter/tools/sessions-status.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git fetch -q origin main 2>/dev/null || true
now=$(date +%s)
printf '%-34s %-26s %5s %6s %8s  %s\n' WORKTREE BRANCH AHEAD DIRTY IDLE_MIN ON_MAIN
git worktree list --porcelain | awk '/^worktree /{print substr($0, 10)}' | while read -r wt; do
    [ -d "$wt" ] || continue
    branch=$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')
    ahead=$(git -C "$wt" rev-list --count origin/main..HEAD 2>/dev/null || echo '?')
    dirty=$(git -C "$wt" status --porcelain 2>/dev/null | wc -l)
    last=$(git -C "$wt" log -1 --format=%ct 2>/dev/null || echo 0)
    while read -r _ f; do
        [ -n "$f" ] && [ -e "$wt/$f" ] && { m=$(stat -c %Y "$wt/$f" 2>/dev/null || echo 0); [ "$m" -gt "$last" ] && last=$m; }
    done < <(git -C "$wt" status --porcelain 2>/dev/null | sed 's/^...//; s/^/x /')
    if git -C "$wt" merge-base --is-ancestor HEAD origin/main 2>/dev/null; then onmain=yes; else onmain=no; fi
    printf '%-34s %-26s %5s %6s %8s  %s\n' "$(basename "$wt")" "${branch:0:26}" "$ahead" "$dirty" "$(( (now - last) / 60 ))" "$onmain"
done
