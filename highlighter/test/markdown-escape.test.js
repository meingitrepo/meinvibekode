// Copied Markdown: the page title and notes are escaped like the quoted text, so they cannot
// become headings, rules, links or markup in the export.
const L = require('./lib');
const CTX = 24;
const P1 = 'Some alpha words to annotate in this paragraph.';
const NOTE = 'first\n## [x](https://evil.test)\n---\n> quoted\n===\n**bold** <b>h</b>';
const TITLE = '<img src=x onerror=alert(1)> **x**';
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>${TITLE.replace(/</g, '&lt;')}</title></head><body style="font:18px/1.6 serif;margin:40px"><p id="p1">${P1}</p></body></html>`;
const at = P1.indexOf('alpha words');
const store = { 'https://example.test/a': JSON.stringify([{ xpath: '//*[@id="p1"]', startOffset: at, length: 11, key: 'h', text: 'alpha words', prefix: P1.slice(0, at), suffix: P1.slice(at + 11, at + 11 + CTX), group: 'gA', note: NOTE }]) };
(async () => {
  const browser = await L.launch();
  try {
    const { page } = await L.open(browser, { html: HTML, store });
    await page.evaluate(() => window.__hl.copyAnnotations()); await page.waitForTimeout(100);
    const md = await page.evaluate(() => window.__clip);
    const lines = md.split('\n');
    L.check('title is escaped', lines[0].startsWith('## [\\<img src=x onerror=alert(1)\\> \\*\\*x\\*\\*]('), lines[0]);
    const note = lines.slice(lines.findIndex(l => l.startsWith('> ')) + 1).filter(Boolean);
    L.check('no note line starts a heading, rule, setext line or link', note.every(l => !/^(#|-{3}|={3}|\[)/.test(l)), note);
    L.check('note lines are escaped', note.includes('first') && note.includes('\\## \\[x\\](https://evil.test)') && note.includes('\\---') && note.includes('\\> quoted') && note.includes('\\===') && note.includes('\\*\\*bold\\*\\* \\<b\\>h\\</b\\>'), note);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
