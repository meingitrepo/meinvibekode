#!/usr/bin/env bash
# Nothing reaches main until the User has said PUSH. The word PUSH is answered with `allow`, which
# opens a one-shot flag for ONE worktree for 30 minutes; release.sh checks it before it commits
# anything and consumes it after a successful push; the pre-push hook (install-hooks.sh) refuses
# a plain `git push` to main without it. Sessions never call `allow` themselves.
# Usage: push-guard.sh allow [worktree-path]   (default: this worktree)
#        push-guard.sh check [worktree-path]   exit 0 if open, 1 (with a message) if not
#        push-guard.sh consume [worktree-path]
set -euo pipefail
TTL=1800
cmd=${1:-}; path=${2:-.}
root=$(git -C "$path" rev-parse --show-toplevel)
dir="$(cd "$root" && git rev-parse --git-common-dir)/hl-push-ok"
dir=$(cd "$root" && cd "$dir" 2>/dev/null && pwd || { mkdir -p "$dir" && cd "$dir" && pwd; })
flag="$dir/$(printf %s "$root" | git hash-object --stdin)"
case "$cmd" in
    allow)   date +%s > "$flag"; echo "push allowed for $root for $((TTL / 60)) minutes, once" ;;
    consume) rm -f "$flag" ;;
    check)
        if [ -f "$flag" ] && [ $(( $(date +%s) - $(cat "$flag") )) -lt "$TTL" ]; then exit 0; fi
        echo "REFUSED: no PUSH from the User for $root. Commit locally, show the result, and ask: Reply PUSH to push it to main."
        exit 1 ;;
    *) echo 'usage: push-guard.sh allow|check|consume [worktree-path]'; exit 2 ;;
esac
