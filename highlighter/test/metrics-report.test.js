// metrics-report.js must score each release on its own slice of a session, not the whole session.
const { segments, parseRow, pickSession } = require('../tools/metrics-report.js');
let fails = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' ' + JSON.stringify(got)}`); if (!ok) fails++; };

const prompt = (text) => ({ type: 'user', message: { content: [{ type: 'text', text }] } });
const edit = (file) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'C:/r/highlighter/' + file } }] } });
const pushed = (v, sha) => ({ type: 'user', message: { content: [{ type: 'tool_result', content: `PUSHED ${v} (${sha}) to main` }] } });
const said = (id, i, o, cc) => ({ type: 'assistant', message: { id, content: [{ type: 'text', text: 'x' }], usage: { input_tokens: i, output_tokens: o, cache_creation_input_tokens: cc, cache_read_input_tokens: 9999 } } });
const session = [
  prompt('first task'), edit('src/a.js'), edit('test/a.test.js'), said('m1', 100, 50, 10), said('m1', 100, 50, 10), said('m2', 200, 20, 0), pushed('9.1', 'aaaaaaa'),
  prompt('second task'), edit('test/b.test.js'), edit('src/b.js'), prompt('tweak'), pushed('9.2', 'bbbbbbb'),
  prompt('third task'), edit('src/c.js'), pushed('9.3', 'ccccccc'),
  prompt('settings'), edit('src/d.js'), pushed('cfg', 'ddddddd'),
].map(e => JSON.stringify(e));

const s = segments(session);
// The work since the last PUSHED, not yet released: what release.sh prints for the release in progress.
const tail = segments(session.concat([prompt('next'), said('m9', 1000, 500, 0), said('m9', 1000, 500, 0)].map(e => JSON.stringify(e))), true).pop();
check('open slice after the last PUSHED has its turns and tokens', tail.version === null && tail.turns === 1 && tail.tokens === 1500, tail);
check('without the flag only finished releases are returned', s.length === 4 && s.every(x => x.version), s.map(x => x.version));
check('one segment per release', s.map(x => x.version).join() === '9.1,9.2,9.3,cfg', s.map(x => x.version));
check('segments carry the pushed commit sha', s.map(x => x.sha).join() === 'aaaaaaa,bbbbbbb,ccccccc,ddddddd', s.map(x => x.sha));
check('a cfg release gets its own slice and turns', s[3].turns === 1, s[3]);
check('first release: src before test is test-first no', s[0].testFirst === 'no', s[0]);
check('second release ignores the first release src edit', s[1].testFirst === 'yes', s[1]);
check('release with no test edit is n/a', s[2].testFirst === 'n/a', s[2]);
check('turns count only the segment', [s[0].turns, s[1].turns, s[2].turns].join() === '1,2,1', s.map(x => x.turns));

check('tokens: input + output + cache writes, once per message, no cache reads', s[0].tokens === 380, s[0]);
check('tokens: a release with no model output counts 0', s[1].tokens === 0, s[1]);

const r = parseRow('2026-10-29	9.21	T1	2	4	30	3	3f9c2ab');
const old = parseRow('2026-10-29	9.12	T2	1	6	122	19');
check('an old row without a sha parses with sha empty', old.sha === '' && old.files === 6, old);
check('log row is plain values: date, version, tier, attempts, files, insertions, deletions, sha (turns and tokens null when absent)',
  JSON.stringify(r) === JSON.stringify({ date: '2026-10-29', ver: '9.21', tier: 'T1', attempts: 2, files: 4, ins: 30, del: 3, sha: '3f9c2ab', turns: null, ktokens: null }), r);
const withUsage = parseRow('2026-10-29	9.22	T1	1	2	10	1	4d1e0aa	7	212');
const noUsage = parseRow('2026-10-29	9.23	T1	1	2	10	1	4d1e0aa		');
check('log row carries turns and k tokens', withUsage.turns === 7 && withUsage.ktokens === 212, withUsage);
check('empty turns and tokens fields parse as null, not 0', noUsage.turns === null && noUsage.ktokens === null, noUsage);

const files = [[300, '/p/new.jsonl'], [100, '/p/mine.jsonl'], [200, '/p/other.jsonl']];
check('pickSession uses the session id even when another file is newer', pickSession(files, 'mine') === '/p/mine.jsonl', pickSession(files, 'mine'));
check('pickSession falls back to the newest file without an id', pickSession(files, undefined) === '/p/new.jsonl', pickSession(files));
check('pickSession falls back to the newest file when the id has no file', pickSession(files, 'gone') === '/p/new.jsonl', pickSession(files, 'gone'));
check('pickSession returns undefined with no files', pickSession([], 'mine') === undefined);
process.exit(fails ? 1 : 0);
