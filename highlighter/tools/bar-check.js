#!/usr/bin/env node
// The CLAUDE.md guardrail "scan the diff for a lowered bar", as a script. Compares the working tree
// with a base (default origin/main) and reports:
//   SUPPRESSION  a new .skip/.only/xit/@ts-ignore/@ts-nocheck/eslint-disable/process.exit(0)
//   DROPPED      a test file with fewer L.check calls than before, with the messages that vanished
//   BASELINE     typecheck-baseline.txt grew, or a number in test/checks-baseline.json went down
//   REVIEW       an assertion kept its message but changed (a number or the condition): read it
// Exit 1 on the first four; REVIEW alone exits 0 but is printed. Prints "no lowered bar" when clean.
// Usage: node highlighter/tools/bar-check.js [base-ref]   (or tools/bar-check.sh)
'use strict';
const { execFileSync } = require('child_process');

const base = process.argv[2] || 'origin/main';
const diff = execFileSync('git', ['diff', '-U0', '--no-color', base, '--', '.', ':!highlighter/Highlighter.user.js'],
    { encoding: 'utf8', maxBuffer: 1 << 28 });

const files = new Map();   // path -> { added: [], removed: [] }
let cur = null;
for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) { const p = line.slice(4).replace(/^b\//, ''); cur = p === '/dev/null' ? null : (files.set(p, files.get(p) || { added: [], removed: [] }), files.get(p)); }
    else if (line.startsWith('--- ')) { const p = line.slice(4).replace(/^a\//, ''); if (p !== '/dev/null') cur = files.get(p) || (files.set(p, { added: [], removed: [] }), files.get(p)); }
    else if (cur && line.startsWith('+')) cur.added.push(line.slice(1));
    else if (cur && line.startsWith('-')) cur.removed.push(line.slice(1));
}

const SUPPRESS = /\.(skip|only)\(|\b(xit|xdescribe|xtest)\b|@ts-ignore|@ts-nocheck|eslint-disable|process\.exit\(0\)/;
const CHECK = /L\.check\(\s*(['"`])((?:\\.|(?!\1).)*)\1/;
const msgOf = l => { const m = CHECK.exec(l); return m ? m[2] : null; };
const noDigits = l => l.replace(/\d+(\.\d+)?/g, '#').replace(/\s+/g, ' ').trim();
const SELF = /^highlighter\/tools\/bar-check\.js$|\.md$/;

const hard = [], review = [];
for (const [path, { added, removed }] of files) {
    if (!SELF.test(path)) {
        added.filter(l => SUPPRESS.test(l)).forEach(l => hard.push(`SUPPRESSION ${path}: ${l.trim()}`));
    }
    if (/\/test\/.*\.test\.js$/.test(path)) {
        const a = added.filter(l => CHECK.test(l)), r = removed.filter(l => CHECK.test(l));
        if (r.length > a.length) {
            const kept = new Set(a.map(msgOf));
            const lost = r.map(msgOf).filter(m => !kept.has(m));
            hard.push(`DROPPED ${path}: ${r.length} L.check removed, ${a.length} added (net -${r.length - a.length})${lost.length ? '; gone: ' + lost.map(m => `"${m}"`).join(', ') : ''}`);
        }
        const addedByMsg = new Map(a.map(l => [msgOf(l), l]));
        r.forEach(l => {
            const now = addedByMsg.get(msgOf(l));
            if (now && now.trim() !== l.trim()) review.push(`REVIEW ${path}: "${msgOf(l)}" ${noDigits(now) === noDigits(l) ? 'a number changed' : 'the condition changed'}\n    - ${l.trim()}\n    + ${now.trim()}`);
        });
    }
    if (/typecheck-baseline\.txt$/.test(path) && added.length > removed.length) hard.push(`BASELINE ${path}: ${added.length - removed.length} more known error(s); fix errors, never add to the baseline`);
    if (/checks-baseline\.json$/.test(path)) {
        const num = ls => new Map(ls.map(l => /"([^"]+)":\s*(\d+)/.exec(l)).filter(Boolean).map(m => [m[1], +m[2]]));
        const was = num(removed), now = num(added);
        was.forEach((n, f) => { if (!now.has(f)) hard.push(`BASELINE ${path}: ${f} removed (had ${n} checks)`); else if (now.get(f) < n) hard.push(`BASELINE ${path}: ${f} ${n} -> ${now.get(f)}`); });
    }
}

[...hard, ...review].forEach(l => console.log(l));
if (!hard.length && !review.length) console.log('no lowered bar');
else if (!hard.length) console.log('\nno hard drops; read the REVIEW lines above');
process.exit(hard.length ? 1 : 0);
