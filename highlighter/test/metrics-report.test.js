// metrics-report.js must score each release on its own slice of a session, not the whole session.
const { segments } = require('../tools/metrics-report.js');
let fails = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' ' + JSON.stringify(got)}`); if (!ok) fails++; };

const at = m => new Date(Date.UTC(2026, 9, 29, 10, m)).toISOString();
const prompt = (m, text) => ({ type: 'user', timestamp: at(m), message: { content: [{ type: 'text', text }] } });
const edit = (m, file) => ({ type: 'assistant', timestamp: at(m), message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'C:/r/highlighter/' + file } }] } });
const pushed = (m, v) => ({ type: 'user', timestamp: at(m), message: { content: [{ type: 'tool_result', content: `PUSHED ${v} ok` }] } });
const session = [
  prompt(0, 'first task'), edit(1, 'src/a.js'), edit(2, 'test/a.test.js'), pushed(10, '9.1'),
  prompt(20, 'second task'), edit(21, 'test/b.test.js'), edit(22, 'src/b.js'), prompt(23, 'tweak'), pushed(30, '9.2'),
  prompt(40, 'third task'), edit(41, 'src/c.js'), pushed(45, '9.3'),
].map(e => JSON.stringify(e));

const s = segments(session);
check('one segment per release', s.map(x => x.version).join() === '9.1,9.2,9.3', s.map(x => x.version));
check('first release: src before test is test-first no', s[0].testFirst === 'no', s[0]);
check('second release ignores the first release src edit', s[1].testFirst === 'yes', s[1]);
check('release with no test edit is n/a', s[2].testFirst === 'n/a', s[2]);
check('turns count only the segment', [s[0].turns, s[1].turns, s[2].turns].join() === '1,2,1', s.map(x => x.turns));
check('cycle runs from the segment first prompt to PUSHED', [s[0].cycleMin, s[1].cycleMin, s[2].cycleMin].join() === '10,10,5', s.map(x => x.cycleMin));
process.exit(fails ? 1 : 0);
