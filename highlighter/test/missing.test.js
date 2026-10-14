// 7.30: the missing-annotations notice, menu labels with counts, the light late-content watcher
// (with background tabs), and pages that share a canonical URL. Scenarios run side by side.
const L = require('./lib');
const CTX = 24;
function rec(xpath, block, text, { key = 'h', group = 'g' + Math.random().toString(36).slice(2, 8), extra = {} } = {}) {
  const at = block.indexOf(text);
  if (at < 0) throw new Error('not in text: ' + text);
  return { xpath, startOffset: at, length: text.length, key, text, prefix: block.slice(Math.max(0, at - CTX), at), suffix: block.slice(at + text.length, at + text.length + CTX), group, ...extra };
}
const KEY = 'https://example.test/a';
const P1 = 'Paragraph alpha one is here with some words.';
const P2 = 'Paragraph beta two is here with other words.';
const GONE = 'This gamma three paragraph was removed by the site.';
const GONE2 = 'And this delta four paragraph is gone as well.';
const LATE = 'A late comment arrives with epsilon five inside it.';
const page = (body, head = '') => `<!doctype html><html><head><meta charset="utf-8"><title>t</title>${head}</head><body style="font:16px/1.5 serif;margin:40px">${body}</body></html>`;
const base = page(`<p id="p1">${P1}</p><p id="p2">${P2}</p><div id="slot"></div>`);
const recA = () => rec('//*[@id="p1"]', P1, 'alpha one', { group: 'gA' });
const recB = () => rec('//*[@id="p2"]', P2, 'beta two', { key: 'u', group: 'gB' });
const recGone = () => rec('//*[@id="p3"]', GONE, 'gamma three', { group: 'gC' });
const recGone2 = () => rec('//*[@id="p4"]', GONE2, 'delta four', { group: 'gD' });
const recLate = () => rec('//*[@id="late"]', LATE, 'epsilon five', { group: 'gE' });
const addLate = p => p.evaluate(t => { const d = document.createElement('div'); d.id = 'late'; d.textContent = t; document.getElementById('slot').appendChild(d); }, LATE);
// Watches the toast from now for `ms`, returns the texts it showed.
async function watchToast(p, ms) {
  const seen = [];
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const t = await L.toast(p);
    if (t && seen[seen.length - 1] !== t) seen.push(t);
    await p.waitForTimeout(250);
  }
  return seen;
}
const storedOf = async (p, key, group) => (await L.stored(p, key)).filter(r => r.group === group);
const results = [];
const check = (name, ok, info) => results.push([name, ok, info]);

async function scenarioNotice(browser) {
  const { ctx, page: p } = await L.open(browser, { html: base, store: { [KEY]: JSON.stringify([recA(), recB(), recGone()]) } });
  await p.waitForTimeout(1300);
  let menu = await L.menu(p);
  check('menu: Clear with count', menu.includes('Clear 3 annotations on this page'), menu);
  check('menu: Forget with count', menu.includes('Forget 1 annotation not found'), menu);
  const regs = await p.evaluate(() => window.__menuLog);
  await p.waitForTimeout(3000);
  check('menu: not registered again while nothing changes', (await p.evaluate(() => window.__menuLog)) === regs, regs);
  check('no notice during the first window', (await L.toast(p)) === null, await L.toast(p));
  const seen = await watchToast(p, 13000);   // until ~18.5 s after load
  check('notice after the first window', seen.includes('1x annotation not found · Show'), seen);
  check('miss counted once', (await storedOf(p, KEY, 'gC'))[0].misses === 1, await storedOf(p, KEY, 'gC'));
  // Show: the panel, at "Not found"
  const shown = await p.evaluate(() => {
    const r = window.__hl; r.toastAction.click();
    const title = r.panelList.querySelector('[data-section="missing"]');
    const lr = r.panelList.getBoundingClientRect(); const tr = title && title.getBoundingClientRect();
    return { open: !r.panelEl.hidden, title: title && title.textContent, inView: !!tr && tr.top >= lr.top - 1 && tr.bottom <= lr.bottom + 1 };
  });
  check('Show opens the panel at Not found', shown.open && shown.title === 'Not found on the page (1)' && shown.inView, shown);
  // Forget from the menu; the label goes, Clear's count follows
  await p.evaluate(() => window.__menu['Forget 1 annotation not found']());
  await p.waitForTimeout(200);
  check('Forget from the menu', (await L.toast(p)) === '1x annotation forgotten · Undo', await L.toast(p));
  await p.waitForTimeout(1200);
  menu = await L.menu(p);
  check('menu after Forget: no Forget item, Clear 2', !menu.some(m => m.startsWith('Forget')) && menu.includes('Clear 2 annotations on this page'), menu);
  // a new annotation updates the count
  await p.evaluate(() => window.__hl.closePanel());
  await L.selStr(p, '#p2', 'other words'); await L.altKey(p, 'KeyS'); await p.waitForTimeout(1200);
  menu = await L.menu(p);
  check('menu after a new annotation: Clear 3', menu.includes('Clear 3 annotations on this page'), menu);
  // undo restarts the watcher; the notice isn't repeated (nothing missing now anyway), and not twice per page
  check('notice remembered for the page', await p.evaluate(k => window.__hl.noticedKeys.has(k), KEY), null);
  check('no page errors', p.__errors.length === 0, p.__errors);
  await ctx.close();
}

async function scenarioAllMissing(browser) {
  const { ctx, page: p } = await L.open(browser, { html: base, store: { [KEY]: JSON.stringify([recGone(), recGone2()]) } });
  const seen = await watchToast(p, 18000);
  check('all missing: wording', seen.includes('2x annotations not found · Show'), seen);
  const menu = await L.menu(p);
  check('all missing: menu', menu.includes('Clear 2 annotations on this page') && menu.includes('Forget 2 annotations not found'), menu);
  await ctx.close();
}

async function scenarioEditor(browser) {
  const { ctx, page: p } = await L.open(browser, { html: base, store: { [KEY]: JSON.stringify([recA(), recGone()]) } });
  await p.waitForTimeout(11000);
  await L.selStr(p, '#p1', 'alpha one'); await L.altKey(p, 'KeyN'); await p.waitForTimeout(200);
  await p.keyboard.type('a draft');
  const seen = await watchToast(p, 6500);
  check('editor: notice shown while writing a note', seen.includes('1x annotation not found · Show'), seen);
  const st = await p.evaluate(() => { const r = window.__hl; r.toastAction.click(); return { editor: !!r.editor, draft: r.noteInput.value, panel: !r.panelEl.hidden }; });
  check('editor: Show leaves the note being written open', st.editor && st.draft === 'a draft' && st.panel, st);
  await ctx.close();
}

async function scenarioLate(browser) {
  const { ctx, page: p } = await L.open(browser, { html: base, store: { [KEY]: JSON.stringify([recA(), recLate()]) } });
  await p.waitForTimeout(16500);
  const w0 = await p.evaluate(() => { const s = window.__hl.lateWatcher; return s && { slow: s.slow, all: s.all }; });
  check('late: watcher in its light phase after the window', w0 && w0.slow && !w0.all, w0);
  check('late: counted as missed once', (await storedOf(p, KEY, 'gE'))[0].misses === 1, await storedOf(p, KEY, 'gE'));
  await p.waitForTimeout(3000);
  const t0 = Date.now();
  await addLate(p);
  let placed = -1;
  for (let i = 0; i < 20; i++) { await p.waitForTimeout(250); if ((await L.wr(p)).some(x => x.g === 'gE')) { placed = Date.now() - t0; break; } }
  check('late: text arriving after the window gets its annotation within ~2.5 s', placed > 0 && placed < 3000, placed);
  await p.waitForTimeout(500);
  const st = await storedOf(p, KEY, 'gE');
  check('late: saved without misses once found', st.length === 1 && !st[0].misses, st);
  check('late: watcher stopped when nothing waits', (await p.evaluate(() => window.__hl.lateWatcher)) === null, null);
  await ctx.close();
}

async function scenarioHidden(browser) {
  const { ctx, page: p } = await L.open(browser, { html: base, hidden: true, store: { [KEY]: JSON.stringify([recA(), recGone(), recLate()]) } });
  await p.waitForTimeout(2000);
  await addLate(p);   // while hidden, during the (not yet started) first window: still placed
  await p.waitForTimeout(1500);
  check('hidden: content added in a background tab is annotated', (await L.wr(p)).some(x => x.g === 'gE'), await L.wr(p));
  await p.waitForTimeout(15000);   // ~18.5 s after load, still hidden
  const w = await p.evaluate(() => { const s = window.__hl.lateWatcher; return s && { slow: s.slow, started: s.startedAt !== null }; });
  check('hidden: the first window waits until the tab is shown', w && !w.slow && !w.started, w);
  check('hidden: no miss counted while hidden', !(await storedOf(p, KEY, 'gC'))[0].misses, await storedOf(p, KEY, 'gC'));
  check('hidden: no notice while hidden', (await L.toast(p)) === null, await L.toast(p));
  await L.setHidden(p, false);
  await p.waitForTimeout(13000);
  check('hidden: no notice before the window ends', (await L.toast(p)) === null, await L.toast(p));
  const seen = await watchToast(p, 4500);
  check('hidden: window runs once shown, then the notice', seen.includes('1x annotation not found · Show'), seen);
  check('hidden: miss counted after the window', (await storedOf(p, KEY, 'gC'))[0].misses === 1, await storedOf(p, KEY, 'gC'));
  await ctx.close();
}

async function scenarioPaused(browser) {
  const { ctx, page: p } = await L.open(browser, { html: base, hidden: false, store: { [KEY]: JSON.stringify([recA(), recLate()]) } });
  await p.waitForTimeout(16500);
  await L.setHidden(p, true);
  await addLate(p);
  await p.waitForTimeout(4000);
  check('paused: no retry in a background tab', !(await L.wr(p)).some(x => x.g === 'gE'), await L.wr(p));
  await L.setHidden(p, false);
  await p.waitForTimeout(600);
  check('paused: retried when shown', (await L.wr(p)).some(x => x.g === 'gE'), await L.wr(p));
  await ctx.close();
}

async function scenarioPages(browser) {
  const CANON = 'https://example.test/t';
  const head = `<link rel="canonical" href="${CANON}">`;
  const T1 = 'Page one has alpha words in its first post.';
  const T2 = 'Page two has beta words in its first post.';
  const routes = { '/t': page(`<p id="post">${T1}</p>`, head), '/t?page=2': page(`<p id="post">${T2}</p>`, head) };
  const LEG = 'An old record saved before pages were remembered.';
  // On page 2: a page-1 record (page ''), a legacy missing record (no page), and a new annotation.
  const alpha = rec('//*[@id="post"]', T1, 'alpha words', { group: 'gP1', extra: { page: '' } });
  const legacy = rec('//*[@id="old"]', LEG, 'old record', { group: 'gLeg' });
  let { ctx, page: p } = await L.open(browser, { html: routes['/t'], routes, url: CANON + '?page=2', store: { [CANON]: JSON.stringify([alpha, legacy]) } });
  await L.selStr(p, '#post', 'beta words'); await L.altKey(p, 'KeyH'); await p.waitForTimeout(300);
  let st = await L.stored(p, CANON);
  const beta = st.find(r => r.text === 'beta words');
  check('pages: new annotation remembers its page', beta && beta.page === CANON + '?page=2', beta);
  check('pages: page-1 record kept', st.some(r => r.group === 'gP1' && r.page === ''), st);
  check('pages: other page not missing', await p.evaluate(() => JSON.stringify(window.__hl.pageCounts())) === JSON.stringify({ total: 2, present: 1, missing: 1 }), await p.evaluate(() => window.__hl.pageCounts()));
  await p.waitForTimeout(1200);
  let menu = await L.menu(p);
  check('pages: menu counts this page only', menu.includes('Clear 2 annotations on this page') && menu.includes('Forget 1 annotation not found'), menu);
  const seen = await watchToast(p, 17000);
  check('pages: notice counts this page only', seen.includes('1x annotation not found · Show'), seen);
  st = await L.stored(p, CANON);
  check('pages: no miss for the other page\'s record', !st.find(r => r.group === 'gP1').misses && st.find(r => r.group === 'gLeg').misses === 1, st);
  const panel = await p.evaluate(() => { const r = window.__hl; r.openPanel({ focus: false }); r.renderPanel(); return Array.from(r.panelList.querySelectorAll('.section-title, .item-meta')).map(e => e.textContent); });
  check('pages: panel lists it under Saved on other pages', panel.length === 5 && panel[1] === 'Not found on the page (1)' && !panel[2].includes(' on ') && panel[3] === 'Saved on other pages (1)' && panel[4].endsWith(' · on /t'), panel);
  await p.evaluate(() => window.__menu['Clear 2 annotations on this page']());
  await p.waitForTimeout(300);
  check('pages: Clear says what it cleared', (await L.toast(p)) === '2x annotations cleared · Undo', await L.toast(p));
  st = await L.stored(p, CANON);
  check('pages: Clear keeps the other page\'s annotation', st.length === 1 && st[0].group === 'gP1', st);
  await ctx.close();
  // On page 1 (the canonical itself): page 2's annotation is elsewhere.
  ({ ctx, page: p } = await L.open(browser, { html: routes['/t'], routes, url: CANON, store: { [CANON]: JSON.stringify([alpha, { ...beta }]) } }));
  await p.waitForTimeout(1200);
  check('pages: page-1 record placed on page 1', (await L.wr(p)).some(x => x.g === 'gP1'), await L.wr(p));
  menu = await L.menu(p);
  check('pages: page 1 menu has no Forget', menu.includes('Clear 1 annotation on this page') && !menu.some(m => m.startsWith('Forget')), menu);
  await L.selStr(p, '#post', 'its first post'); await L.altKey(p, 'KeyU'); await p.waitForTimeout(300);
  st = await L.stored(p, CANON);
  check('pages: annotation made on the canonical page gets page ""', st.find(r => r.text === 'its first post').page === '', st);
  const seen1 = await watchToast(p, 16500);
  check('pages: no notice on page 1', seen1.length === 0, seen1);
  await ctx.close();
}

async function scenarioNoCanonical(browser) {
  const { ctx, page: p } = await L.open(browser, { html: base });
  await L.selStr(p, '#p1', 'alpha one'); await L.altKey(p, 'KeyH'); await p.waitForTimeout(300);
  const st = await L.stored(p, KEY);
  check('no canonical: no page field', st.length === 1 && !('page' in st[0]), st);
  await ctx.close();
}

(async () => {
  const browser = await L.launch();
  await Promise.all([scenarioNotice, scenarioAllMissing, scenarioEditor, scenarioLate, scenarioHidden, scenarioPaused, scenarioPages, scenarioNoCanonical]
    .map(f => f(browser).catch(e => check(f.name + ' threw', false, String(e && e.stack || e)))));
  results.forEach(([n, ok, info]) => L.check(n, ok, info));
  console.log('FAILS', L.fails);
  await browser.close();
})();
