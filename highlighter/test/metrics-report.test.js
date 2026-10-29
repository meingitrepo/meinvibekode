// metrics-report.js must score each release on its own slice of a session, not the whole session.
const { segments, parseRow } = require('../tools/metrics-report.js');
let fails = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' ' + JSON.stringify(got)}`); if (!ok) fails++; };

const prompt = (text) => ({ type: 'user', message: { content: [{ type: 'text', text }] } });
const edit = (file) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'C:/r/highlighter/' + file } }] } });
const pushed = (v) => ({ type: 'user', message: { content: [{ type: 'tool_result', content: `PUSHED ${v} ok` }] } });
const session = [
  prompt('first task'), edit('src/a.js'), edit('test/a.test.js'), pushed('9.1'),
  prompt('second task'), edit('test/b.test.js'), edit('src/b.js'), prompt('tweak'), pushed('9.2'),
  prompt('third task'), edit('src/c.js'), pushed('9.3'),
].map(e => JSON.stringify(e));

const s = segments(session);
check('one segment per release', s.map(x => x.version).join() === '9.1,9.2,9.3', s.map(x => x.version));
check('first release: src before test is test-first no', s[0].testFirst === 'no', s[0]);
check('second release ignores the first release src edit', s[1].testFirst === 'yes', s[1]);
check('release with no test edit is n/a', s[2].testFirst === 'n/a', s[2]);
check('turns count only the segment', [s[0].turns, s[1].turns, s[2].turns].join() === '1,2,1', s.map(x => x.turns));

const r = parseRow('2026-10-29	9.21	T1	2	4	30	3');
check('log row is plain values: date, version, tier, attempts, files, insertions, deletions',
  JSON.stringify(r) === JSON.stringify({ date: '2026-10-29', ver: '9.21', tier: 'T1', attempts: 2, files: 4, ins: 30, del: 3 }), r);
process.exit(fails ? 1 : 0);
