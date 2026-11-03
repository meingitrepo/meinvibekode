#!/usr/bin/env bash
# Tells a flaky check from a real failure: runs the suites matching a word N times and counts, per failing
# line, how many runs it failed in. "3/5" with other runs green is flaky (still a finding, but not this change);
# "5/5" is real.
# Usage: highlighter/tools/flaky.sh <suite-word> [runs=5]     exit 1 if any run failed
set -uo pipefail
[ $# -ge 1 ] || { echo 'usage: flaky.sh <suite-word> [runs=5]'; exit 2; }
word=$1 n=${2:-5}
cd "$(git rev-parse --show-toplevel)"
out=$(mktemp); red=0
for i in $(seq 1 "$n"); do
    r=$(highlighter/tools/test-env.sh "$word" 2>&1) && : || red=$((red + 1))
    echo "$r" | grep -E '^(FAIL|       FAIL)' | sed 's/^ *//; s/ ([0-9]* s)$//' | sort -u >> "$out"
done
echo "$red of $n runs had a failure"
[ -s "$out" ] && sort "$out" | uniq -c | sort -rn | awk -v n="$n" '{c=$1; $1=""; printf "%d/%d %s\n", c, n, $0}'
rm -f "$out"
[ "$red" -eq 0 ]
