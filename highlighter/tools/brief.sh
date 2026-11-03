#!/usr/bin/env bash
# Prints a session brief for start_session: the same rules every time (CLAUDE.md, tier, no push, report format),
# so only the task itself has to be written. Put the output in the session's prompt.
# Usage: highlighter/tools/brief.sh <name> --task "what to do" [--tier T1] [--files "src files / area"] [--done "what done looks like"] [--readonly]
set -euo pipefail
[ $# -ge 1 ] || { echo 'usage: brief.sh <name> --task "..." [--tier T1] [--files "..."] [--done "..."] [--readonly]'; exit 2; }
name=$1; shift
task= tier=T1 files= done= readonly=
while [ $# -gt 0 ]; do
    case "$1" in
        --task) task=$2; shift 2;; --tier) tier=$2; shift 2;; --files) files=$2; shift 2;;
        --done) done=$2; shift 2;; --readonly) readonly=1; shift;; *) echo "unknown option $1"; exit 2;;
    esac
done
[ -n "$task" ] || { echo 'brief.sh: --task is required'; exit 2; }
echo "# $name"
echo
echo "Task: $task"
[ -z "$files" ] || echo "Files / area: $files"
[ -z "$done" ] || echo "Done means: $done"
echo
if [ -n "$readonly" ]; then
    echo "This is read-only: change no file, make no commit. Answer with facts and file:line references."
else
    cat <<EOF
Follow CLAUDE.md in this repo. Tier: $tier (state it in one line first). Work only in your own worktree and branch.
- Reproduce first, at the trigger named above; the first test captures it and is seen red before the fix.
- Run \`highlighter/tools/verify.sh <keyword>\` for the related suites, \`highlighter/tools/mutate.sh\` on each new guard, and \`highlighter/tools/bar-check.sh\` before every commit.
- Commit locally with a short message. NEVER push, never run release.sh, never run push-guard.sh allow: only the User's word PUSH (relayed by the orchestrator) authorises that.
- Last step: \`highlighter/tools/report.sh write $name --tests "what ran, result" --deviations "..." --left "..."\`. Then end your reply with one line: what changed, tests, anything left.
EOF
fi
