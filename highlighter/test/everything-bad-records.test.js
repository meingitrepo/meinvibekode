// Alt+Shift+O must survive stored records with empty text, and must only link to http(s) pages.
const L = require('./lib');
const check = L.check;
const HTML = '<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body><p id="p1">Here is some text.</p></body></html>';
const r = (text, extra = {}) => ({ xpath: '/p', startOffset: 0, length: 5, key: 'h', text, ...extra });
const KEY = 'https://other.test/post';
const settings = { 'rnh:settings': JSON.stringify({ disabled: [] }) };
const items = p => p.evaluate(() => {
  const hl = window.__hl;
  if (hl.everythingEl.hidden) return null;
  const head = hl.everythingList.querySelector('.page-head');
  if (head && head.getAttribute('aria-expanded') !== 'true') head.click();
  return Array.from(hl.everythingList.querySelectorAll('a.item-main')).map(a => [a.querySelector('.item-text').textContent, a.getAttribute('href')]);
});

async function emptyText(browser) {
  const store = { ...settings, [KEY]: JSON.stringify([r('kept one', { group: 'g0' }), r('', { group: 'g5' }), r('   ', { group: 'g6' })]) };
  const { ctx, page: p } = await L.open(browser, { html: HTML, store });
  const outcome = await Promise.race([L.altKey(p, 'o', true).then(() => 'ok'), new Promise(res => setTimeout(() => res('HUNG'), 8000))]);
  check('empty-text records do not hang or throw in Alt+Shift+O', outcome === 'ok' && !p.__errors.length, [outcome, p.__errors]);
  if (outcome === 'ok') {
    const list = await items(p);
    check('empty and blank quotes are left out', list && list.length === 1 && list[0][0] === 'kept one', list);
  }
  await ctx.close().catch(() => {});
}

async function pages(browser) {
  const store = { ...settings, [KEY]: JSON.stringify([
    r('good page', { group: 'g0', page: 'https://other.test/moved' }),
    r('planted script', { group: 'g1', page: 'javascript:alert(1)' }),
    r('number page', { group: 'g2', page: 42 }),
    r('ftp page', { group: 'g3', page: 'ftp://x.test/f' }),
    r('relative page', { group: 'g4', page: '/just/a/path' })]) };
  const { ctx, page: p } = await L.open(browser, { html: HTML, store });
  await L.altKey(p, 'o', true);
  const list = await items(p);
  const by = Object.fromEntries(list || []);
  check('a bad page value does not break the list', list && list.length === 5 && !p.__errors.length, [list, p.__errors]);
  check('a valid https page is kept', (by['good page'] || '').startsWith('https://other.test/moved#:~:'), by);
  ['planted script', 'number page', 'ftp page', 'relative page'].forEach(t =>
    check(`${t}: links to the storage key`, (by[t] || '').startsWith(KEY + '#:~:'), by[t]));
  await ctx.close().catch(() => {});
}

(async () => {
  const browser = await L.launch();
  await Promise.all([emptyText, pages].map(f => f(browser).catch(e => check(`${f.name} crashed`, false, e.stack))));
  await L.done(browser);
})();
