// Joins .cache/metrics.tsv (written by release.sh) with git history and Claude Code transcripts.
// Usage: node highlighter/tools/metrics-report.js [days-for-rework=7]
//   turns       user prompts in that same slice of the session
//   tokens      model input + output + cache writes in that slice (cache reads left out), in thousands
//   test-first  yes if the first Edit/Write to test/ came before the first one to src/ in that slice
//   test-touch  release commit changes files under highlighter/test
//   rework      a later commit within N days touches the same src files and says fix/revert/regress
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// Splits a session into one slice per release: a slice ends at the first tool result that prints
// "PUSHED <ver>" and starts after the previous one, so each release is scored on its own work.
// With withOpen, the work after the last PUSHED is returned as a final slice with version and sha null.
function segments(lines, withOpen = false) {
  const out = [];
  let turns = 0, firstTest = -1, firstSrc = -1, i = 0, usage = new Map();
  const slice = (version, sha) => ({
    version, sha, turns,
    testFirst: firstTest < 0 ? 'n/a' : (firstSrc < 0 || firstTest < firstSrc ? 'yes' : 'no'),
    tokens: [...usage.values()].reduce((n, u) => n + (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0), 0),
  });
  for (const l of lines) {
    i++;
    let e; try { e = JSON.parse(l); } catch { continue; }
    const c = e.message && e.message.content;
    if (e.type === 'user' && !e.isSidechain && c && (typeof c === 'string' || c.some(p => p.type === 'text'))) turns++;
    // A message is logged once per content block with the same usage: keep one entry per message id.
    if (e.type === 'assistant' && e.message.usage && e.message.id) usage.set(e.message.id, e.message.usage);
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
    const m = e.type === 'user' && Array.isArray(c) && c.some(p => p.type === 'tool_result') && l.match(/PUSHED ([^ ]+) [(]([0-9a-f]{7,40})[)]/);
    if (m) {
      out.push(slice(m[1], m[2]));
      turns = 0; firstTest = firstSrc = -1; usage = new Map();
    }
  }
  if (withOpen) out.push(slice(null, null));
  return out;
}
// One tab-separated log row, written by release.sh: date, version, tier, attempts, files, insertions, deletions, sha, turns, k tokens.
// Rows from before the sha was logged have 7 fields (sha is ''); older rows lack turns and k tokens (null).
function parseRow(line) {
  const [date, ver, tier, attempts, files, ins, del, sha = '', turns = '', ktokens = ''] = line.split('\t');
  return { date, ver, tier, attempts: +attempts, files: +files, ins: +ins, del: +del, sha,
    turns: turns === '' ? null : +turns, ktokens: ktokens === '' ? null : +ktokens };
}
// The transcript of the running session: Claude Code names it <CLAUDE_CODE_SESSION_ID>.jsonl.
// Without a matching file, the most recently modified one. files is [[mtimeMs, path], ...].
function pickSession(files, id) {
  const mine = id && files.find(([, f]) => path.basename(f) === id + '.jsonl');
  return (mine || [...files].sort((a, b) => b[0] - a[0])[0] || [])[1];
}
module.exports = { segments, parseRow, pickSession };
if (require.main !== module) return;

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const days = +(process.argv[2] || 7);
const mainRoot = path.resolve(root, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim(), '..'); // worktrees share the main checkout log
const logFile = path.join(mainRoot, '.cache', 'metrics.tsv');
if (process.argv[2] !== '--now' && !fs.existsSync(logFile)) { console.log('no .cache/metrics.tsv yet (written by release.sh)'); process.exit(0); }

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

// --now: "<turns> <k tokens>" since the last PUSHED in the running session, for release.sh to print.
if (process.argv[2] === '--now') {
  const file = pickSession(sessions.map(f => [fs.statSync(f).mtimeMs, f]), process.env.CLAUDE_CODE_SESSION_ID);
  const open = file && segments(fs.readFileSync(file, 'utf8').split('\n').filter(Boolean), true).pop();
  if (open) console.log(`${open.turns} ${Math.round(open.tokens / 1000)}`);
  process.exit(0);
}

const bySession = sessions.map(f => segments(fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)));

const rows = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map(parseRow);
const out = [['version', 'tier', 'size', 'turns', 'tokens', 'test-first', 'test-touch', 'rework']];
for (const { date, ver, tier, files: nFiles, ins, del, sha: short, turns: loggedTurns, ktokens: loggedK } of rows) {
  // Match by commit sha; rows without one fall back to the version (impossible for old cfg releases).
  const byVersion = ver !== 'cfg';
  const s = bySession.flat().filter(x => short ? x.sha === short : byVersion && x.version === ver).pop();
  const sha = short ? git('rev-parse', short) : byVersion ? git('log', '--format=%H', '-1', `--grep=^${ver.replace('.', '\\.')}: `) : '';
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
  out.push([ver, tier, `${nFiles}f +${ins} -${del}`,
    loggedTurns ?? (s ? s.turns : '?'), loggedK != null ? `${loggedK}k` : s ? `${Math.round(s.tokens / 1000)}k` : '?',
    s ? s.testFirst : '?', touch, rework]);
}
const w = out[0].map((_, i) => Math.max(...out.map(r => String(r[i]).length)));
for (const r of out) console.log(r.map((c, i) => String(c).padEnd(w[i])).join('  ').trimEnd());
