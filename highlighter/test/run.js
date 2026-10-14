#!/usr/bin/env node
// Runs every *.test.js in this folder against the built userscript, several at a time, and
// prints one line per file. Exits 1 if any check failed, a file crashed or timed out, or the
// built file is not up to date with src/.
//   node run.js                 every file
//   node run.js panel note      only files whose name contains one of these words
//   HL_SCRIPT=other.user.js     test another build
//   HL_JOBS=3                   files run at once (default 6)
// Needs Playwright with Chromium (npm install playwright && npx playwright install chromium).
'use strict';
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TIMEOUT_MS = 240000;
// Most of a file's time is waiting on timers, not CPU, so run more files than there are cores.
const JOBS = +process.env.HL_JOBS || 6;
// Started first so the longest file is not the last one left running.
const SLOW = ['missing.test.js'];
const dir = __dirname;
const filters = process.argv.slice(2);
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js'))
    .filter(f => !filters.length || filters.some(w => f.includes(w))).sort();
if (!files.length) { console.error('no test files match'); process.exit(1); }

let failed = 0;
if (!process.env.HL_SCRIPT) {
    try { execFileSync(process.execPath, [path.join(dir, '..', 'build.js'), '--check'], { stdio: 'pipe' }); }
    catch (e) { console.log(`FAIL build: ${String(e.stdout).trim()}`); failed++; }
}

function runFile(file) {
    return new Promise(resolve => {
        const started = Date.now();
        const child = spawn(process.execPath, [file], { cwd: dir, env: process.env });
        let out = '';
        child.stdout.on('data', d => { out += d; });
        child.stderr.on('data', d => { out += d; });
        const timer = setTimeout(() => { out += '\ntimed out'; child.kill('SIGKILL'); }, TIMEOUT_MS);
        child.on('close', code => {
            clearTimeout(timer);
            const lines = out.split('\n');
            const passes = lines.filter(l => l.startsWith('PASS ')).length;
            const fails = lines.filter(l => l.startsWith('FAIL '));
            const ok = code === 0 && !fails.length && passes > 0;
            resolve({ file, ok, passes, fails, out, secs: ((Date.now() - started) / 1000).toFixed(0) });
        });
    });
}

(async () => {
    const queue = files.filter(f => SLOW.includes(f)).concat(files.filter(f => !SLOW.includes(f)));
    const results = [];
    const workers = Array.from({ length: JOBS }, async () => {
        while (queue.length) {
            const r = await runFile(queue.shift());
            results.push(r);
            console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.file}: ${r.passes} passed${r.fails.length ? `, ${r.fails.length} failed` : ''} (${r.secs} s)`);
            r.fails.forEach(l => console.log(`       ${l}`));
            if (!r.ok && !r.fails.length) console.log(r.out.trim().split('\n').slice(-15).map(l => `       ${l}`).join('\n'));
        }
    });
    await Promise.all(workers);
    failed += results.filter(r => !r.ok).length;
    const checks = results.reduce((n, r) => n + r.passes, 0);
    console.log(failed ? `\n${failed} of ${files.length} files failed` : `\nall ${files.length} files passed (${checks} checks)`);
    process.exit(failed ? 1 : 0);
})();
