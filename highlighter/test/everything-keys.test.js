// 9.1: arrow keys move through the Alt+Shift+O tree (Up/Down between rows, Right/Left open and close pages, Shift+arrow ticks).
const L = require('./lib');
const CTX = 24;
function rec(xpath, block, text, { key = 'h', group, extra = {} } = {}) {
  const at = block.indexOf(text);
  return { xpath, startOffset: at, length: text.length, key, text, prefix: block.slice(Math.max(0, at - CTX), at), suffix: block.slice(at + text.length, at + text.length + CTX), group, ...extra };
}
const HERE = 'https://example.test/a';
const P1 = 'Here is the alpha passage on this page with words.';
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:16px/1.5 serif;margin:40px">
<p id="p1">${P1}</p>${'<p>filler text</p>'.repeat(60)}</body></html>`;
const T = d => Date.UTC(2026, 0, d);
const store = {
  [HERE]: JSON.stringify([rec('//*[@id="p1"]', P1, 'alpha passage', { group: 'gH', extra: { added: T(5), note: 'note here' } })]),
  'https://other.test/blog/post-one': JSON.stringify([
    { xpath: '/p', startOffset: 0, length: 10, key: 'h2', text: 'The quick brown fox jumps', group: 'gO1', added: T(10), note: 'about #foxes' },
    { xpath: '/p', startOffset: 0, length: 10, key: 'u', text: 'lazy dog', group: 'gO2', added: T(9) }]),
  'https://www.third.test/old': JSON.stringify([{ xpath: '/p', startOffset: 0, length: 5, key: 'h', text: 'ancient words', group: 'gT', added: T(1) }]),
  'rnh:settings': JSON.stringify({ disabled: [] })
};
const check = L.check;
const focus = p => p.evaluate(() => { const a = window.__hl.uiRoot.activeElement; return a === window.__hl.everythingFilter ? 'filter' : a ? (a.classList.contains('page-head') ? 'head:' + a.dataset.key : 'item:' + a.dataset.group) : null; });
const key = async (p, k, mods = []) => { for (const m of mods) await p.keyboard.down(m); await p.keyboard.press(k); for (const m of mods) await p.keyboard.up(m); await p.waitForTimeout(450); };
(async () => {
  const browser = await L.launch();
  const { ctx, page: p } = await L.open(browser, { html: HTML, store });
  await L.altKey(p, 'o', true);
  await key(p, 'ArrowDown');
  check('Down from the search box goes to the first page', await focus(p) === 'head:https://other.test/blog/post-one', await focus(p));
  await key(p, 'ArrowDown');
  check('Down goes to the next page (closed pages have no rows)', await focus(p) === 'head:' + HERE, await focus(p));
  await key(p, 'ArrowUp');
  await key(p, 'ArrowRight');
  check('Right opens the page', await p.evaluate(() => window.__hl.everythingList.querySelector('.page-head').getAttribute('aria-expanded')) === 'true' && await focus(p) === 'head:https://other.test/blog/post-one', await focus(p));
  await key(p, 'ArrowDown');
  check('Down goes into its first quote', await focus(p) === 'item:gO1', await focus(p));
  await key(p, 'ArrowDown', ['Shift']);
  check('Shift+Down ticks both quotes', await p.evaluate(() => window.__hl.everythingList.querySelectorAll('input.check:checked').length) === 2 && await focus(p) === 'item:gO2', await focus(p));
  await key(p, 'ArrowUp');
  check('Up goes back a quote', await focus(p) === 'item:gO1', await focus(p));
  await key(p, 'ArrowLeft');
  check('Left on a quote goes to its page', await focus(p) === 'head:https://other.test/blog/post-one', await focus(p));
  await key(p, 'ArrowLeft');
  check('Left on an open page closes it', await p.evaluate(() => window.__hl.everythingList.querySelector('.page-head').getAttribute('aria-expanded')) === 'false', null);
  await key(p, 'ArrowUp');
  check('Up from the first page goes to the search box', await focus(p) === 'filter', await focus(p));
  await ctx.close(); await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
