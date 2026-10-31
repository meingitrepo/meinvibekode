// tools/typecheck.js: tsc (non-strict checkJs) on the built file, errors mapped back to src/ lines, compared with a recorded baseline.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('./lib');
const HL = path.resolve(__dirname, '..');
const { typecheck, update, ensureTsc } = require(path.join(HL, 'tools', 'typecheck.js'));
const check = L.check;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'typecheck-'));
const REAL_BASELINE = path.join(HL, 'tools', 'typecheck-baseline.txt');

// A copy of src/ and build.js built in a temp folder, optionally edited first, so the real src/ is never touched.
function copy(edit) {
  const d = fs.mkdtempSync(path.join(tmp, 'r-'));
  fs.cpSync(path.join(HL, 'src'), path.join(d, 'src'), { recursive: true });
  fs.copyFileSync(path.join(HL, 'build.js'), path.join(d, 'build.js'));
  if (edit) edit(d);
  execFileSync(process.execPath, [path.join(d, 'build.js')], { stdio: 'pipe' });
  return d;
}

(async () => {
  check('typescript is available', !!ensureTsc(), null);

  const real = typecheck({ root: HL });
  check('the repo has no type errors beyond the recorded baseline', real.fresh.length === 0, real.fresh);

  const FILE = 'toast-and-jump.js';
  const lines = fs.readFileSync(path.join(HL, 'src', FILE), 'utf8').split('\n').length - 1;
  const typo = copy(d => fs.appendFileSync(path.join(d, 'src', FILE), 'const typoProbe = noSuchNameForTypecheckTest;\n'));
  const t = typecheck({ root: typo });
  check('a misspelled name is reported at its src file and line', t.fresh.length === 1 && t.fresh[0].src === FILE && t.fresh[0].line === lines + 1 && t.fresh[0].code === 'TS2304', t.fresh);

  const empty = path.join(tmp, 'empty.txt'); fs.writeFileSync(empty, '');
  const e = typecheck({ root: HL, baselineFile: empty });
  check('with an empty baseline every error is new', e.errors.length > 0 && e.fresh.length === e.errors.length, e.errors.length);

  const keep = path.join(tmp, 'keep.txt'); fs.copyFileSync(REAL_BASELINE, keep);
  const u1 = update({ root: typo, baselineFile: keep });
  check('update refuses while there are new errors and leaves the baseline alone', u1.updated === false && fs.readFileSync(keep, 'utf8') === fs.readFileSync(REAL_BASELINE, 'utf8'), u1);

  const stale = path.join(tmp, 'stale.txt'); fs.writeFileSync(stale, fs.readFileSync(REAL_BASELINE, 'utf8') + `${FILE}: TS9999: an error that was fixed\n`);
  const f = typecheck({ root: HL, baselineFile: stale });
  check('an error fixed since the baseline is reported as fixed, not as new', f.fresh.length === 0 && f.fixed.length === 1, f.fixed);
  const u2 = update({ root: HL, baselineFile: stale });
  check('update shrinks the baseline to the current errors', u2.updated === true && fs.readFileSync(stale, 'utf8') === fs.readFileSync(REAL_BASELINE, 'utf8'), u2);

  fs.rmSync(tmp, { recursive: true, force: true });
  await L.done();
})();
