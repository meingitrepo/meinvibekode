#!/usr/bin/env bash
# Mutation check: breaks one line of a src file, rebuilds, runs the suites, then ALWAYS restores the file and rebuilds.
# A test that stays green with the line broken proves nothing about that line.
# Usage: highlighter/tools/mutate.sh <src-file> <old-text> <new-text> <suite-word>
#   <old-text> must occur exactly once in the file. Refuses to run if the file has uncommitted changes.
# Prints MUTANT KILLED (a suite went red: good) or MUTANT SURVIVED (no suite noticed: add a check).
set -uo pipefail
[ $# -eq 4 ] || { echo 'usage: mutate.sh <src-file> <old-text> <new-text> <suite-word>'; exit 2; }
cd "$(dirname "$0")/../.."
file="$1"; word="$4"
[ -f "$file" ] || { echo "no such file: $file"; exit 2; }
git diff --quiet HEAD -- "$file" || { echo "refusing: $file has uncommitted changes (commit or stash first)"; exit 2; }

restore() {
    git checkout -- "$file" && highlighter/tools/build.sh >/dev/null && echo "restored $file and rebuilt"
}
trap restore EXIT

OLD="$2" NEW="$3" FILE="$file" node -e '
const fs = require("fs");
const { OLD, NEW, FILE } = process.env;
const src = fs.readFileSync(FILE, "utf8");
const n = src.split(OLD).length - 1;
if (n !== 1) { console.error(`old text occurs ${n} times in ${FILE}, need exactly 1`); process.exit(2); }
fs.writeFileSync(FILE, src.replace(OLD, () => NEW));
' || exit 2

highlighter/tools/build.sh || { echo "mutant does not build: pick a mutation that does"; exit 2; }
if highlighter/tools/test-env.sh "$word"; then
    echo "MUTANT SURVIVED: '$word' suites stayed green with the line broken"
    status=1
else
    echo "MUTANT KILLED: '$word' suites went red"
    status=0
fi
exit $status
