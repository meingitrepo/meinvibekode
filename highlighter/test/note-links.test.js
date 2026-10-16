// 7.34 item 11: web addresses in a note are links in the note card.
const L = require('./lib');
const CTX = 24;
const P1 = 'Some alpha words to annotate in this paragraph.';
const NOTE = 'See https://example.org/a_(b). Also (www.test.org/x), and javascript:alert(1) and <b>not html</b>.';
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:18px/1.6 serif;margin:40px"><p id="p1">${P1}</p></body></html>`;
const at = P1.indexOf('alpha words');
const store = { 'https://example.test/a': JSON.stringify([{ xpath: '//*[@id="p1"]', startOffset: at, length: 11, key: 'h', text: 'alpha words', prefix: P1.slice(0, at), suffix: P1.slice(at + 11, at + 11 + CTX), group: 'gA', note: NOTE }]) };
const results = [];
const check = (name, ok, info) => results.push([name, ok, info]);
(async () => {
  const browser = await L.launch();
  try {
    const { ctx, page: p } = await L.open(browser, { html: HTML, store });
    await p.mouse.move(...await L.badge(p, 'gA')); await p.waitForTimeout(500);
    const c = await p.evaluate(() => { const t = window.__hl.cardText; return { text: t.textContent, links: Array.from(t.querySelectorAll('a')).map(a => [a.textContent, a.getAttribute('href'), a.target, a.rel]), b: t.querySelectorAll('b').length }; });
    check('the card shows the whole note as text', c.text === NOTE, c.text);
    check('addresses are links, without the punctuation after them', JSON.stringify(c.links.map(l => l.slice(0, 2))) === JSON.stringify([['https://example.org/a_(b)', 'https://example.org/a_(b)'], ['www.test.org/x', 'https://www.test.org/x']]), c.links);
    check('links open in a new tab, without a referrer', c.links.every(l => l[2] === '_blank' && l[3] === 'noopener noreferrer'), c.links);
    check('no other markup is made from the note', c.b === 0, c.b);
    check('no page errors', p.__errors.length === 0, p.__errors);
    await ctx.close();
  } catch (e) { check('crashed', false, e.stack); }
  await browser.close();
  let fails = 0;
  results.forEach(([name, ok, info]) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' :: ' + JSON.stringify(info)}`); if (!ok) fails++; });
  console.log(`FAILS ${fails}`);
  process.exit(fails);
})();
