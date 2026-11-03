#!/usr/bin/env bash
# Full verification of the current tree in one call and one line: build check, typecheck against the
# baseline, every suite (a 0-check or short file fails), bar-check against origin/main.
# Prints only the failing lines. Meant for tasks about the tests, a merged main, or when the User asks;
# CLAUDE.md still says no full run before PUSH on an ordinary change (use verify.sh <keyword>).
# Usage: highlighter/tools/verify-all.sh            HL_UPDATE_COUNTS=1 also refreshes test/checks-baseline.json
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
T=highlighter/tools
bad=0; parts=()
b=$($T/build.sh 2>&1) && parts+=("build ok") || { parts+=("build FAIL"); bad=1; echo "$b"; }
t=$($T/typecheck.sh 2>&1) && parts+=("$(echo "$t" | tail -1 | sed 's/^typecheck: //; s/ errors, / errors (/; s/ new (baseline.*/ new)/')") || { parts+=("typecheck FAIL"); bad=1; echo "$t" | tail -8; }
r=$($T/test-env.sh 2>&1); rc=$?
echo "$r" | grep -E '^(FAIL|       |[0-9]+ of )' || true
sum=$(echo "$r" | grep -E '^all [0-9]+ files passed' | sed 's/all \([0-9]*\) files passed (\([0-9]*\) checks)/\1 files \/ \2 checks/')
[ $rc -eq 0 ] && [ -n "$sum" ] && parts+=("$sum") || { parts+=("tests FAIL"); bad=1; }
zero=$(echo "$r" | grep -E '^ok +[^:]+: 0 passed' || true); [ -z "$zero" ] || { parts+=("zero-check files"); bad=1; echo "$zero"; }
c=$($T/bar-check.sh 2>&1) && parts+=("$(echo "$c" | head -1 | sed 's/^no lowered bar$/bar ok/')") || { parts+=("BAR LOWERED"); bad=1; echo "$c"; }
printf '%s' "$([ $bad -eq 0 ] && echo OK || echo FAIL)"; printf ' | %s' "${parts[@]}"; echo
exit $bad
