// Joins .cache/metrics.tsv (written by release.sh) with git history and Claude Code transcripts.
// Usage: node highlighter/tools/metrics-report.js [days-for-rework=7]
//   turns       user prompts in the session that ran release.sh for that version
//   test-first  yes if the first Edit/Write to test/ came before the first one to src/ in that session
//   test-touch  release commit changes files under highlighter/test
//   rework      a later commit within N days touches the same src files and says fix/revert/regress
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

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

function readSession(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  let turns = 0, firstTest = -1, firstSrc = -1, i = 0;
  const pushed = new Set();
  for (const l of lines) {
    i++;
    let e; try { e = JSON.parse(l); } catch { continue; }
    const c = e.message && e.message.content;
    if (e.type === 'user' && !e.isSidechain && c && (typeof c === 'string' || c.some(p => p.type === 'text'))) turns++;
    if (e.type === 'assistant' && Array.isArray(c)) {
      for (const p of c) {
        if (p.type !== 'tool_use') continue;
        const fp = ((p.input && (p.input.file_path || p.input.path)) || '').replace(/\\/g, '/');
        if (/^(Edit|Write)$/.test(p.name)) {
          if (/highlighter\/test\//.test(fp) && firstTest < 0) firstTest = i;
          if (/highlighter\/src\//.test(fp) && firstSrc < 0) firstSrc = i;
        }
      }
    }
    const m = l.match(/PUSHED (\d+\.\d+)/g);
    if (m) m.forEach(x => pushed.add(x.slice(7)));
  }
  return { turns, testFirst: firstTest < 0 ? 'n/a' : (firstSrc < 0 || firstTest < firstSrc ? 'yes' : 'no'), pushed };
}
const bySession = sessions.map(readSession);

const rows = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'));
const out = [['version', 'tier', 'cycle', 'size', 'turns', 'test-first', 'test-touch', 'rework']];
for (const [date, ver, tier, , attempts, cycle, ...stat] of rows) {
  const s = bySession.find(x => x.pushed.has(ver));
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
  out.push([ver, tier, cycle.replace('cycle=', ''), `${n(/(d+) file/)}f +${n(/(d+) insertion/)} -${n(/(d+) deletion/)}`,
    s ? s.turns : '?', s ? s.testFirst : '?', touch, rework]);
}
const w = out[0].map((_, i) => Math.max(...out.map(r => String(r[i]).length)));
for (const r of out) console.log(r.map((c, i) => String(c).padEnd(w[i])).join('  ').trimEnd());
