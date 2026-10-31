// Type-checks the built userscript with tsc (JS, non-strict) and reports only errors that are not in the recorded
// baseline (tools/typecheck-baseline.txt), each mapped back to its src/ file and line.
// Usage: highlighter/tools/typecheck.sh [--update]
//   --update  rewrites the baseline to the current errors; refused while there are new ones, so it can only shrink
//             (the first run, with no baseline file yet, may create it).
// It checks the built file because src/config.js opens the IIFE that start-and-boot.js closes: no single src file parses alone.
// A baseline entry is "<src file>: <TS code>: <message>" without line numbers, so edits that move code do not change it.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');
const HL = path.resolve(__dirname, '..');
const REPO = path.resolve(HL, '..');
const TS_VERSION = '5.6.3';
const BASELINE = path.join(__dirname, 'typecheck-baseline.txt');
const FLAGS = ['--allowJs', '--checkJs', '--noEmit', '--target', 'ES2022', '--lib', 'ES2022,DOM,DOM.iterable', '--skipLibCheck', '--pretty', 'false'];
const tscIn = dir => path.join(dir, '.cache', 'ts', 'node_modules', 'typescript', 'bin', 'tsc');

// tsc from $TSC, this checkout's .cache/ts, or the main checkout's (worktrees share it); installed there on first use.
// Returns null when it is missing and cannot be installed.
function ensureTsc() {
    if (process.env.TSC) return process.env.TSC;
    let main = REPO;
    try { main = path.dirname(path.resolve(REPO, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: REPO, encoding: 'utf8' }).trim())); } catch (e) { /* not a git checkout: use this folder */ }
    for (const dir of [REPO, main]) if (fs.existsSync(tscIn(dir))) return tscIn(dir);
    try {
        const prefix = path.join(main, '.cache', 'ts');
        fs.mkdirSync(prefix, { recursive: true });
        const win = process.platform === 'win32';
        execFileSync(win ? 'npm.cmd' : 'npm', ['install', '--no-save', '--no-package-lock', '--prefix', prefix, `typescript@${TS_VERSION}`], { stdio: 'pipe', shell: win });
        return fs.existsSync(tscIn(main)) ? tscIn(main) : null;
    } catch (e) { return null; }
}

// build.js's PARTS in order, with each file's first built line, to turn a built line into a src file and line.
function srcMap(root) {
    const m = fs.readFileSync(path.join(root, 'build.js'), 'utf8').match(/const PARTS = \[([\s\S]*?)\];/);
    if (!m) throw new Error('PARTS not found in build.js');
    let start = 0;
    return [...m[1].matchAll(/'([^']+\.js)'/g)].map(x => {
        const lines = fs.readFileSync(path.join(root, 'src', x[1]), 'utf8').split('\n').length - 1;
        const part = { file: x[1], start, end: start + lines };
        start += lines;
        return part;
    });
}

// typecheck({ root, baselineFile }) -> { errors, fresh, fixed }
//   errors: every tsc error { src, line, code, msg, fingerprint }; fresh: those beyond the baseline; fixed: baseline entries no longer reported.
function typecheck({ root = HL, baselineFile = BASELINE } = {}) {
    const tsc = ensureTsc();
    if (!tsc) throw new Error('typescript is not installed and could not be installed');
    const built = path.join(root, 'Highlighter.user.js');
    const r = spawnSync(process.execPath, [tsc, ...FLAGS, built, path.join(__dirname, 'gm.d.ts')], { encoding: 'utf8', maxBuffer: 1 << 26 });
    const map = srcMap(root);
    const errors = [];
    for (const line of (r.stdout || '').split(/\r?\n/)) {
        const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
        if (!m) continue;
        const at = path.basename(m[1]) === 'Highlighter.user.js' ? map.find(p => +m[2] > p.start && +m[2] <= p.end) : null;
        const src = at ? at.file : path.basename(m[1]);
        const e = { src, line: at ? +m[2] - at.start : +m[2], code: m[4], msg: m[5] };
        e.fingerprint = `${e.src}: ${e.code}: ${e.msg}`;
        errors.push(e);
    }
    if (r.status !== 0 && !errors.length) throw new Error(`tsc failed: ${r.stderr || r.stdout}`);
    const left = new Map();
    if (fs.existsSync(baselineFile)) for (const l of fs.readFileSync(baselineFile, 'utf8').split('\n').filter(Boolean)) left.set(l, (left.get(l) || 0) + 1);
    const fresh = errors.filter(e => { const n = left.get(e.fingerprint) || 0; if (n) left.set(e.fingerprint, n - 1); return !n; });
    const fixed = [...left].flatMap(([l, n]) => Array(n).fill(l));
    return { errors, fresh, fixed };
}

// Rewrites the baseline to the current errors, unless there are errors beyond it (so it only ever shrinks).
function update({ root = HL, baselineFile = BASELINE } = {}) {
    const r = typecheck({ root, baselineFile });
    if (fs.existsSync(baselineFile) && r.fresh.length) return { updated: false, fresh: r.fresh };
    fs.writeFileSync(baselineFile, r.errors.map(e => e.fingerprint).sort().join('\n') + '\n');
    return { updated: true, written: r.errors.length };
}

function main(argv) {
    if (!ensureTsc()) { console.log('typecheck: SKIPPED (typescript is not installed and npm install failed)'); process.exit(0); }
    const show = e => console.log(`src/${e.src}:${e.line}: ${e.code}: ${e.msg}`);
    if (argv.includes('--update')) {
        const u = update();
        if (!u.updated) { u.fresh.forEach(show); console.log(`typecheck: baseline not changed, ${u.fresh.length} new errors`); process.exit(1); }
        console.log(`typecheck: baseline now has ${u.written} errors`);
        return;
    }
    const r = typecheck();
    r.fresh.forEach(show);
    console.log(`typecheck: ${r.errors.length} errors, ${r.fresh.length} new (baseline ${r.errors.length - r.fresh.length + r.fixed.length})`);
    if (r.fixed.length) console.log(`typecheck: ${r.fixed.length} baseline errors no longer occur; run typecheck.sh --update to lower the baseline`);
    process.exit(r.fresh.length ? 1 : 0);
}

module.exports = { typecheck, update, ensureTsc };
if (require.main === module) main(process.argv.slice(2));
