// Alt+O title wording (found / matched / "2 of 5 ... selected"), Windows-style Ctrl/Shift selection in the
// Alt+O and Alt+Shift+O lists, and toast actions as small subtle buttons with tooltips.
const L = require('./lib');
const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];
const P = (i, w) => `<p id="p${i}">Row ${i} holds the word ${w} and a few more words.</p>`;
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:16px/1.5 serif;margin:40px">
${WORDS.map((w, i) => P(i, w)).join('')}</body></html>`;
const click = (page, sel, i, mods = {}) => page.evaluate(([sel, i, mods]) => {
  const h = window.__hl; const root = sel.startsWith('E') ? h.everythingList : h.panelList; const q = sel.slice(1);
  const el = root.querySelectorAll(q)[i];
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, ...mods }));
}, [sel, i, mods]);
const ticks = page => page.evaluate(() => Array.from(window.__hl.panelList.querySelectorAll('.check')).map(c => c.checked ? 1 : 0).join(''));
const eTicks = page => page.evaluate(() => Array.from(window.__hl.everythingList.querySelectorAll('.check')).map(c => c.checked ? 1 : 0).join(''));
(async () => {
  const browser = await L.launch();
  const { page } = await L.open(browser, { html: HTML });
  for (let i = 0; i < 5; i++) { await L.selStr(page, `#p${i}`, WORDS[i]); await L.altKey(page, '1'); }
  await L.altKey(page, 'o'); await page.waitForTimeout(200);
  const title = () => page.evaluate(() => window.__hl.panelCount.textContent);
  // 1: title wording
  L.check('idle title says found', (await title()) === '5 annotations found', await title());
  await page.keyboard.type('a'); await page.waitForTimeout(150);
  const n = await page.evaluate(() => window.__hl.panelList.querySelectorAll('.item').length);
  L.check("searching title says matched, without the term", (await title()) === `${n} of 5 annotations matched`, await title());
  await page.evaluate(() => { const f = window.__hl.panelFilter; f.value = ''; f.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(100);
  await click(page, 'P[data-act="check"]', 1); await click(page, 'P[data-act="check"]', 3);
  L.check('selected title uses "of"', (await title()) === '2 of 5 annotations selected', await title());
  L.check('title stays on one line', await page.evaluate(() => window.__hl.panelCount.getBoundingClientRect().height < 24), null);
  // 2: Ctrl/Shift in the Alt+O list. Ticked: rows 1 and 3.
  await click(page, 'P[data-act="jump"]', 0, { ctrlKey: true });
  L.check('Ctrl+click on a row toggles it', (await ticks(page)) === '11010', await ticks(page));
  await click(page, 'P[data-act="jump"]', 4, { shiftKey: true });
  L.check('Shift+click ticks the range from the last ticked row', (await ticks(page)) === '11111', await ticks(page));
  L.check('no jump happened: still a list of ticks', await page.evaluate(() => window.__hl.selectedGroups.length > 1), null);
  await page.evaluate(() => window.__hl.panelSelectAll.click());
  await click(page, 'P[data-act="check"]', 1);
  await click(page, 'P[data-act="check"]', 3, { shiftKey: true });
  L.check('Shift+click on a tick ticks the range', (await ticks(page)) === '01110', await ticks(page));
  // keyboard: Shift+ArrowDown extends from the focused row
  await page.evaluate(() => window.__hl.panelList.querySelectorAll('[data-act="jump"]')[3].focus());
  await page.keyboard.press('Shift+ArrowDown'); await page.waitForTimeout(100);
  L.check('Shift+Arrow ticks the row it moves to', (await ticks(page)) === '01111', await ticks(page));
  await page.evaluate(() => window.__hl.panelList.querySelectorAll('[data-act="jump"]')[0].focus());
  await page.keyboard.press('Shift+Space'); await page.waitForTimeout(100);
  L.check('Shift+Space ticks the range up to the focused row', (await ticks(page)) === '11111', await ticks(page));
  // a plain click on a row with a tick still jumps
  await page.evaluate(() => window.__hl.panelSelectAll.click());
  await click(page, 'P[data-act="check"]', 2);
  await click(page, 'P[data-act="jump"]', 0);
  L.check('a plain click on a row still jumps (selects that one)', await page.evaluate(() => window.__hl.selectedGroups.length === 1), null);
  await L.altKey(page, 'o'); await page.waitForTimeout(100);
  // Alt+Shift+O list: needs its own page records in storage, so use the saved list of this page
  await L.altKey(page, 'o', true); await page.waitForTimeout(400);
  await page.evaluate(() => { const h = window.__hl.everythingList.querySelector('.page-head'); if (h && h.getAttribute('aria-expanded') !== 'true') h.click(); });
  await page.waitForTimeout(400);
  const rows = await page.evaluate(() => window.__hl.everythingList.querySelectorAll('.item').length);
  L.check('saved list has the five rows', rows === 5, rows);
  await click(page, 'E.check', 1);
  await click(page, 'E a.item-main', 3, { ctrlKey: true });
  L.check('saved list: Ctrl+click on a row toggles it', (await eTicks(page)) === '01010', await eTicks(page));
  await click(page, 'E a.item-main', 0, { shiftKey: true });
  L.check('saved list: Shift+click ticks the range', (await eTicks(page)) === '11110' || (await eTicks(page)) === '11010', await eTicks(page));
  await click(page, 'E .check', 4, { shiftKey: true });
  L.check('saved list: Shift+click on a tick reaches the end', (await eTicks(page)).endsWith('1'), await eTicks(page));
  await L.altKey(page, 'o', true); await page.waitForTimeout(100);
  // 3 + 4: no toast has a button (Undo and Show are gone; Alt+Z and Alt+V do the same)
  await L.selStr(page, '#p0', 'alpha'); await L.altKey(page, 'd'); await page.waitForTimeout(300);
  L.check('erase says so', (await L.toast(page)) === '1 annotation erased', await L.toast(page));
  await L.altKey(page, 'z'); await page.waitForTimeout(200);
  await L.altKey(page, 'v'); await page.waitForTimeout(300);
  const s = await page.evaluate(() => { const a = window.__hl.toastAction; return { text: a.textContent, icon: !!a.querySelector('svg'), label: a.dataset.label, key: a.dataset.shortcut || '', cls: a.className }; });
  L.check('Annotations hidden has no button', s.text === '' && !s.icon, s);
  await page.evaluate(() => window.__hl.toastAction.click()); await page.waitForTimeout(200);
  await page.evaluate(() => window.__hl.showToast('Plain message'));
  L.check('a toast without an action hides the button', await page.evaluate(() => window.__hl.toastAction.hidden), null);
  await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
