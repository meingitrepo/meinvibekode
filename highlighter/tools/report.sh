#!/usr/bin/env bash
# Session reports in one fixed shape, so the orchestrator reads one short file per session instead of its
# transcript. The facts (branch, commit, version, diffstat, files, pushed or not, bar-check) are read from git,
# never typed; the session adds only what it did to verify, what it did differently, and what it left.
# Reports live in the git directory shared by all worktrees, so they are visible from any of them.
# Usage: highlighter/tools/report.sh write <name> --tests "what ran, result" [--deviations "..."] [--left "..."]
#        highlighter/tools/report.sh show [name]     all reports, newest first, or one
#        highlighter/tools/report.sh clear [name]    remove one report, or all
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
dir="$(git rev-parse --git-common-dir)/hl-reports"
cmd=${1:-}; name=${2:-}
case "$cmd" in
    write)
        [ -n "$name" ] || { echo 'usage: report.sh write <name> --tests "..." [--deviations "..."] [--left "..."]'; exit 2; }
        shift 2; tests= dev= left=
        while [ $# -gt 0 ]; do
            case "$1" in --tests) tests=$2;; --deviations) dev=$2;; --left) left=$2;; *) echo "unknown option $1"; exit 2;; esac
            shift 2
        done
        [ -n "$tests" ] || { echo 'report.sh: --tests is required (what you ran and how it ended)'; exit 2; }
        mkdir -p "$dir"
        git fetch -q origin main 2>/dev/null || true
        sha=$(git rev-parse --short HEAD)
        ver=$(sed -n 's/^\/\/ @version *//p' highlighter/src/header.js | head -1)
        if git merge-base --is-ancestor HEAD origin/main 2>/dev/null; then pushed="yes, on main"; else pushed="no, local only ($(git rev-list --count origin/main..HEAD) commit(s) ahead)"; fi
        dirty=$(git status --porcelain | wc -l)
        bar=$(bash highlighter/tools/bar-check.sh 2>&1 | head -3 | tr '\n' ' ') || true
        {
            echo "# $name"
            echo "- when: $(date '+%Y-%m-%d %H:%M')   branch: $(git rev-parse --abbrev-ref HEAD)   commit: $sha   @version in tree: $ver"
            echo "- pushed: $pushed   uncommitted files: $dirty"
            echo "- change: $(git diff --shortstat origin/main HEAD -- . ':!highlighter/Highlighter.user.js')"
            echo "- files: $(git diff --name-only origin/main HEAD -- . ':!highlighter/Highlighter.user.js' | head -15 | tr '\n' ' ')"
            echo "- bar-check: ${bar:-no output}"
            echo "- tests: $tests"
            echo "- deviations: ${dev:-none}"
            echo "- left: ${left:-nothing}"
        } > "$dir/$name.md"
        echo "report written: $dir/$name.md" ;;
    show)
        [ -d "$dir" ] || { echo 'no reports'; exit 0; }
        if [ -n "$name" ]; then cat "$dir/$name.md"; else
            for f in $(ls -t "$dir"/*.md 2>/dev/null); do cat "$f"; echo; done
        fi ;;
    clear)
        if [ -n "$name" ]; then rm -f "$dir/$name.md"; else rm -rf "$dir"; fi; echo cleared ;;
    *) echo 'usage: report.sh write|show|clear [name] ...'; exit 2 ;;
esac
