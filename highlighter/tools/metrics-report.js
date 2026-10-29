// Joins .cache/metrics.tsv (written by release.sh) with git history and Claude Code transcripts.
// Usage: node highlighter/tools/metrics-report.js [days-for-rework=7]
//   elapsed     first user prompt after the previous release -> PUSHED (idle time included)
//   turns       user prompts in that same slice of the session
//   test-first  yes if the first Edit/Write to test/ came before the first one to src/ in that slice
//   test-touch  release commit changes files under highlighter/test
//   rework      a later commit within N days touches the same src files and says fix/revert/regress
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// Splits a session into one slice per release: a slice ends at the first tool result that prints
// "PUSHED <ver>" and starts after the previous one, so each release is scored on its own work.
function segments(lines) {
  const out = [];
  let turns = 0, firstTest = -1, firstSrc = -1, i = 0, start = null;
  for (const l of lines) {
    i++;
    let e; try { e = JSON.parse(l); } catch { continue; }
    const c = e.message && e.message.content;
    const ts = e.timestamp ? Date.parse(e.timestamp) : null;
    if (e.type === 'user' && !e.isSidechain && c && (typeof c === 'string' || c.some(p => p.type === 'text'))) {
      turns++;
      if (start === null) start = ts;
    }
    if (e.type === 'assistant' && Array.isArray(c)) {
      for (const p of c) {
        if (p.type !== 'tool_use') continue;
        const fp = ((p.input && (p.input.file_path || p.input.path)) || '').replace(/\\/g, '/');
        if (/^(Edit|Write)$/.test(p.name)) {
          if (fp.includes('highlighter/test/') && firstTest < 0) firstTest = i;
          if (fp.includes('highlighter/src/') && firstSrc < 0) firstSrc = i;
        }
      }
    }
    const m = e.type === 'user' && Array.isArray(c) && c.some(p => p.type === 'tool_result') && l.match(/PUSHED ([0-9]+[.][0-9]+)/);
    if (m) {
      out.push({
        version: m[1], turns,
        testFirst: firstTest < 0 ? 'n/a' : (firstSrc < 0 || firstTest < firstSrc ? 'yes' : 'no'),
        cycleMin: start === null || ts === null ? null : Math.round((ts - start) / 60000),
      });
      turns = 0; firstTest = firstSrc = -1; start = null;
    }
  }
  return out;
}
module.exports = { segments };
if (require.main !== module) return;

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const days = +(process.argv[2] || 7);
const logFile = path.join(root, '.cache', 'metrics.tsv');
if (!fs.existsSync(logFile)) { console.log('no .cache/metrics.tsv yet (written by release.sh)'); process.exit(0); }

// Transcripts: ~/.claude/projects/<repo path with non-alphanumerics as "-">[-worktree suffix]/*.jsonl
const slug = root.replace(/[^A-Za-z0-9]/g, '-');
const projDir = path.join(os.homedir(), '.claude', 'projects');
const sessions = [];
if (fs.existsSync(projDir)) {
  for (const d of fs.readdirSync(projDir).filter(d => d.startsWith(slug))) {
    for (const f of fs.readdirSync(path.join(projDir, d)).filter(f => f.endsWith('.jsonl'))) {
      sessions.push(path.join(projDir, d, f));
    }
  }
}

const bySession = sessions.map(f => segments(fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)));

const rows = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'));
const out = [['version', 'tier', 'elapsed', 'size', 'turns', 'test-first', 'test-touch', 'rework']];
for (const [date, ver, tier, , attempts, , ...stat] of rows) {
  const s = bySession.flat().filter(x => x.version === ver).pop();
  const sha = git('log', '--format=%H', '-1', `--grep=^${ver.replace('.', '\\.')}: `);
  let touch = '?', rework = '?';
  if (sha) {
    const files = git('show', '--name-only', '--format=', sha).split('\n').filter(Boolean);
    touch = files.some(f => f.startsWith('highlighter/test/')) ? 'yes' : 'no';
    const src = files.filter(f => f.startsWith('highlighter/src/'));
    const until = new Date(new Date(date).getTime() + days * 864e5).toISOString().slice(0, 10);
    const later = src.length ? git('log', '--format=%h %s', `--since=${date}`, `--until=${until}`, `${sha}..HEAD`, '--', ...src)
      .split('\n').filter(l => /fix|revert|regress/i.test(l)) : [];
    rework = later.length ? `${later.length} (${later[later.length - 1].split(' ')[0]}...)` : 'no';
  }
  const st = stat.join(' '), n = re => (st.match(re) || [, 0])[1];
  out.push([ver, tier, s && s.cycleMin !== null ? `${s.cycleMin}m` : '?', `${n(/(\d+) file/)}f +${n(/(\d+) insertion/)} -${n(/(\d+) deletion/)}`,
    s ? s.turns : '?', s ? s.testFirst : '?', touch, rework]);
}
const w = out[0].map((_, i) => Math.max(...out.map(r => String(r[i]).length)));
for (const r of out) console.log(r.map((c, i) => String(c).padEnd(w[i])).join('  ').trimEnd());
