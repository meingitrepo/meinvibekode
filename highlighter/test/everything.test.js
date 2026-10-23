// 7.34 item 7: Alt+Shift+O shows every page's saved annotations, searchable.
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
const results = [];
const check = (name, ok, info) => results.push([name, ok, info]);
const state = p => p.evaluate(() => { const r = window.__hl; if (r.everythingEl.hidden) return null;
  return { count: r.everythingCount.textContent, pages: Array.from(r.everythingList.querySelectorAll('.page')).map(s => ({
    head: s.querySelector('.page-head').textContent, open: s.querySelector('.page-head').getAttribute('aria-expanded'),
    items: Array.from(s.querySelectorAll('a.item-main')).map(a => ({ text: a.querySelector('.item-text').textContent, note: (a.querySelector('.item-note') || {}).textContent, href: a.getAttribute('href') })) })) }; });
const clickHead = (p, i) => p.evaluate(i => window.__hl.everythingList.querySelectorAll('.page-head')[i].click(), i);

async function main(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store });
  await L.altKey(p, 'o', true);
  let s = await state(p);
  check('Alt+Shift+O opens it with every page, newest first', s && s.pages.map(x => x.head.split(/\d/)[0]).join('|') === 'other.test/blog/post-one|example.test/a|third.test/old', s);
  check('the count says annotations and pages', s && s.count === '4 Annotations on 3 pages', s && s.count);
  check('pages start closed', s && s.pages.every(x => x.open === 'false' && !x.items.length), s);
  check('focus is in the search box', await p.evaluate(() => window.__hl.uiRoot.activeElement === window.__hl.everythingFilter), null);
  await clickHead(p, 0);
  s = await state(p);
  const fox = s.pages[0].items.find(i => i.text === 'The quick brown fox jumps');
  check('a click opens a page to its quotes and notes', s.pages[0].open === 'true' && s.pages[0].items.length === 2 && fox && fox.note === 'about #foxes', s.pages[0]);
  check('a quote links to its passage', fox && fox.href === 'https://other.test/blog/post-one#:~:text=The%20quick%20brown%20fox%20jumps', fox && fox.href);
  await p.evaluate(() => window.__hl.everythingFilter.focus());
  await p.keyboard.type('#foxes'); await p.waitForTimeout(100);
  s = await state(p);
  check('searching finds notes on any page, opened', s.pages.length === 1 && s.pages[0].open === 'true' && s.pages[0].items.length === 1 && s.count === '1 of 4 Annotations on 1 page', s);
  await p.evaluate(() => { const f = window.__hl.everythingFilter; f.value = 'third'; f.dispatchEvent(new Event('input')); });
  s = await state(p);
  check('searching a site name shows its page', s.pages.length === 1 && s.pages[0].items[0].text === 'ancient words', s);
  await p.evaluate(() => { const f = window.__hl.everythingFilter; f.value = 'zzz'; f.dispatchEvent(new Event('input')); });
  s = await state(p);
  check('nothing matching says so', s.pages.length === 0 && /Nothing matches/.test(await p.evaluate(() => window.__hl.everythingList.textContent)), s);
  const inside = () => p.evaluate(() => !!window.__hl.uiRoot.activeElement && window.__hl.everythingEl.contains(window.__hl.uiRoot.activeElement));
  let trapped = true;
  for (let i = 0; i < 40 && trapped; i++) { await p.keyboard.press('Tab'); trapped = await inside(); }
  for (let i = 0; i < 40 && trapped; i++) { await p.keyboard.press('Shift+Tab'); trapped = await inside(); }
  check('Tab and Shift+Tab stay inside it', trapped, null);
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  check('Esc closes it', (await state(p)) === null, null);
  // this page's quote scrolls here
  await L.altKey(p, 'o', true);
  await clickHead(p, 1);
  await p.evaluate(() => window.scrollTo(0, 2000));
  await p.evaluate(() => Array.from(window.__hl.everythingList.querySelectorAll('a.item-main')).find(a => a.textContent.includes('alpha passage')).click());
  await p.waitForTimeout(100); await L.scrolled(p);
  const vis = await p.evaluate(() => { const r = document.getElementById('p1').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  check('a quote from this page closes it and scrolls to the passage', (await state(p)) === null && vis, vis);
  // selection: ticks on the left, header select/copy/forget/close
  await L.altKey(p, 'o', true);
  await clickHead(p, 0);
  const hdr = await p.evaluate(() => { const r = window.__hl; const kids = Array.from(r.everythingSelectAll.parentElement.children);
    const item = r.everythingList.querySelector('.item'); return { order: kids.map(b => [r.everythingSelectAll, r.everythingCopy, r.everythingForget, r.everythingClose].indexOf(b)).join(''),
      copyOff: r.everythingCopy.disabled, forgetOff: r.everythingForget.disabled, checkFirst: item.firstElementChild.classList.contains('check') }; });
  check('header order select/copy/forget/close, copy grayed, tick on the left', hdr.order === '0123' && hdr.copyOff && hdr.forgetOff && hdr.checkFirst, hdr);
  await p.evaluate(() => window.__hl.everythingSelectAll.click());
  const sel = await p.evaluate(() => ({ n: window.__hl.everythingCount.textContent, copyOn: !window.__hl.everythingCopy.disabled }));
  check('select all ticks everything, count and copy follow', sel.n === '4 Annotations selected on 3 pages' && sel.copyOn, sel);
  await p.evaluate(() => window.__hl.everythingSelectAll.click());
  // three steps: untick one quote, then select all grows to its page, then all pages, then none
  const cnt = () => p.evaluate(() => ({ n: window.__hl.everythingCount.textContent, tip: window.__hl.everythingSelectAll.dataset.label }));
  await p.evaluate(() => { const c = window.__hl.everythingList.querySelectorAll('.item .check'); c.forEach(x => { if (x.checked) x.click(); }); });
  await p.evaluate(() => window.__hl.everythingList.querySelector('.item .check').click());
  let st = await cnt();
  check('one ticked: the button offers the same page first', st.n === '1 Annotation selected on 1 page' && st.tip === 'Select all on these pages', st);
  await p.evaluate(() => window.__hl.everythingSelectAll.click()); st = await cnt();
  check('click 1 ticks that page only', st.n === '2 Annotations selected on 1 page' && st.tip === 'Select all', st);
  await p.evaluate(() => window.__hl.everythingSelectAll.click()); st = await cnt();
  check('click 2 ticks every page', st.n === '4 Annotations selected on 3 pages' && st.tip === 'Select none', st);
  await p.evaluate(() => window.__hl.everythingSelectAll.click()); st = await cnt();
  check('click 3 ticks nothing', st.n === '4 Annotations on 3 pages', st);
  await p.evaluate(() => window.__hl.everythingList.querySelector('.item .check').click());
  await p.evaluate(() => window.__hl.everythingCopy.click()); await p.waitForTimeout(100);
  const md = await p.evaluate(() => window.__clip);
  check('copy writes the ticked quote with its page heading', /^## \[other\.test\/blog\/post\-one\]\(https:\/\/other\.test\/blog\/post-one\)\n\n> The quick brown fox jumps \[↗\]/.test(md || ''), md);
  await p.evaluate(() => window.__hl.everythingForget.click()); await p.waitForTimeout(150);
  const left = await state(p);
  check('forget removes it from storage and the list', left && left.count === '3 Annotations on 3 pages' && !left.pages[0].items.some(i => i.text === 'The quick brown fox jumps'), left);
  await p.keyboard.press('Escape');
  // menu
  check('the menu has it', (await L.menu(p)).includes('Search all pages'), await L.menu(p));
  // clicking the backdrop closes
  await L.altKey(p, 'o', true);
  await p.mouse.click(5, 5); await p.waitForTimeout(100);
  check('clicking outside closes it', (await state(p)) === null, null);
  check('no page errors', p.__errors.length === 0, p.__errors);
  await ctx.close();
}

async function empty(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store: {} });
  await L.altKey(p, 'o', true);
  check('with nothing saved it says so', /No annotations saved yet/.test(await p.evaluate(() => window.__hl.everythingList.textContent)), null);
  await ctx.close();
}

async function dark(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML.replace('<body style="', '<body style="background:#111;color:#eee;'), store, scheme: 'dark' });
  await L.altKey(p, 'o', true);
  check('it follows a dark page', (await p.evaluate(() => window.__hl.everythingEl.getAttribute('data-theme'))) === 'dark', null);
  await ctx.close();
}

(async () => {
  const browser = await L.launch();
  await Promise.all([main, empty, dark].map(f => f(browser).catch(e => check(`${f.name} crashed`, false, e.stack))));
  await browser.close();
  let fails = 0;
  results.forEach(([name, ok, info]) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' :: ' + JSON.stringify(info)}`); if (!ok) fails++; });
  console.log(`FAILS ${fails}`);
  process.exit(fails);
})();
