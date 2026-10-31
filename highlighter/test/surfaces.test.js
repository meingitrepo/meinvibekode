// Surfaces (toast, panel, dialog, tree, pen bar): behaviour only; design values live in anthropic-style.test.js.
const L = require('./lib');
const HTML = `<!doctype html><html><body style="font: 16px/1.5 sans-serif; margin: 40px">
<p id="p1">Alpha beta gamma delta epsilon zeta eta theta iota kappa.</p></body></html>`;
(async () => {
  const browser = await L.launch();
  const store = { 'https://example.test/a': JSON.stringify([
    { xpath: '//*[@id="p1"]', startOffset: 6, length: 4, key: 'h', text: 'beta', prefix: 'Alpha ', suffix: ' gamma', group: 'mg0abcde00001' }
  ]) };
  const { ctx, page } = await L.open(browser, { html: HTML, store });
  const css = (get, props) => page.evaluate(([get, props]) => { const el = eval(get); const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return Object.assign({ w: Math.round(r.width) }, ...props.map(p => ({ [p]: s[p] }))); }, [get, props]);

  await page.evaluate(() => window.__hl.showToast('A toast title that is long enough to wrap onto a second line when the toast is narrow, to test the width')); await page.waitForTimeout(300);
  // 13: toast
  const toast = await css('window.__hl.toastEl', ['bottom']);
  const geo = await page.evaluate(() => { const r = window.__hl.toastEl.getBoundingClientRect(); return { mid: Math.round(r.left + r.width / 2), vw: innerWidth, left: Math.round(r.left), right: Math.round(r.right) }; });
  L.check('13: toast is centred at the bottom, 16px up', toast.bottom === '16px' && Math.abs(geo.mid - geo.vw / 2) <= 1, { toast, geo });
  L.check('13: a long toast wraps inside the view', geo.left >= 16 && geo.right <= geo.vw - 16, geo);
  await page.evaluate(() => window.__hl.openPanel()); await page.waitForTimeout(300);
  const panelBox = await css('window.__hl.panelEl', []);
  L.check('22: panel is 400px wide (widened so the selected count fits one line)', panelBox.w === 400, panelBox);
  const one = await page.evaluate(() => { const c = window.__hl.panelCount; c.replaceChildren('10/10 ', Object.assign(document.createElement('span'), { className: 'panel-title', textContent: 'Annotations' }), ' selected'); return c.getBoundingClientRect().height; });
  L.check('2: "N/N Annotations selected" stays on one line', one === 24, one);
  const fit = await page.evaluate(() => { const c = window.__hl.panelCount; return { scroll: c.scrollWidth, client: c.clientWidth }; });
  L.check('2: "N/N Annotations selected" is not cut off', fit.scroll <= fit.client, fit);
  const fit3 = await page.evaluate(() => { const c = window.__hl.panelCount; c.firstChild.textContent = '100/100 '; return { scroll: c.scrollWidth, client: c.clientWidth, font: getComputedStyle(c).fontFamily }; });
  L.check('2: a three-digit count is not cut off either', fit3.scroll <= fit3.client, fit3);
  await page.evaluate(() => window.__hl.closePanel());
  await page.keyboard.press('Alt+Shift+O'); await page.waitForTimeout(400);
  const left = await page.evaluate(() => { const r = window.__hl; const b = r.everythingEl.firstElementChild.getBoundingClientRect(); return { count: r.everythingCount.getBoundingClientRect().left - b.left, field: r.everythingFilter.parentElement.getBoundingClientRect().left - b.left }; });
  L.check('22: dialog title and search field line up', left.count === left.field, left);
  // 25: pages are tree items, annotations their children
  const tree = await page.evaluate(() => { const r = window.__hl; let head = r.everythingList.querySelector('.page-head'); head.click(); head = r.everythingList.querySelector('.page-head'); const page = head.closest('.page');
    const row = r.everythingList.querySelector('.item'), item = row?.querySelector('a.item-main'), box = row?.querySelector('.check');
    return { list: r.everythingList.getAttribute('role'), multi: r.everythingList.getAttribute('aria-multiselectable'), page: page.getAttribute('role'), head: [head.getAttribute('role'), head.getAttribute('aria-level'), head.getAttribute('aria-expanded')], group: r.everythingList.querySelector('.page-items')?.getAttribute('role'),
      row: row?.getAttribute('role'), item: [item?.getAttribute('role'), item?.getAttribute('aria-level'), item?.getAttribute('aria-selected')], box: [box?.getAttribute('aria-hidden'), box?.tabIndex] }; });
  L.check('25: list is a multi-select tree', tree.list === 'tree' && tree.multi === 'true', tree);
  L.check('25: page head is a level-1 treeitem with aria-expanded', tree.page === 'none' && tree.head[0] === 'treeitem' && tree.head[1] === '1' && tree.head[2] === 'true', tree);
  // 9.2: the focusable quote link is the level-2 treeitem (so screen readers announce its level and
  // selection when it gets focus); its row wrapper is presentational; the checkbox is a mouse aid only.
  L.check('25: annotations: the focused link is a level-2 treeitem in a group, unselected', tree.group === 'group' && tree.row === 'none' && tree.item.join() === 'treeitem,2,false', tree);
  L.check('25: row checkbox is hidden from screen readers and out of the Tab order', tree.box[0] === 'true' && tree.box[1] === -1, tree);
  const spaced = await page.evaluate(() => { const a = window.__hl.everythingList.querySelector('a.item-main'); a.focus(); a.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    const b = window.__hl.everythingList.querySelector('a.item-main'); return { sel: b.getAttribute('aria-selected'), checked: b.closest('.item').querySelector('.check').checked, focused: window.__hl.uiRoot.activeElement === b }; });
  L.check('25: Space ticks the focused annotation (aria-selected, checkbox) and keeps focus on it', spaced.sel === 'true' && spaced.checked && spaced.focused, spaced);
  await page.keyboard.press('Escape');
  // 10 reversed: no pen label
  await page.evaluate(() => { window.__hl.everythingClose.click(); });
  await L.altKey(page, 'p'); await page.waitForTimeout(300);
  const pen = await page.evaluate(() => ({ label: !!window.__hl.penEl.querySelector('.pen-text'), pressed: window.__hl.penEl.querySelectorAll('button[aria-pressed="true"]').length }));
  L.check('10 (reversed): the pen bar has no text label, one tool shows pressed', !pen.label && pen.pressed === 1, pen);
  // 6 (9.2): expand/collapse is a short ease-out fade (Anthropic motion), no height slide
  await page.evaluate(() => { window.__anim = []; const o = Element.prototype.animate; Element.prototype.animate = function (k, opt) { window.__anim.push({ cls: this.className, opt, props: [].concat(k).flatMap(f => Object.keys(f)) }); return o.call(this, k, opt); }; });
  await page.keyboard.press('Alt+Shift+O'); await page.waitForTimeout(400);
  const toggle = async () => { await page.evaluate(() => window.__hl.everythingList.querySelector('.page-head').click()); await page.waitForTimeout(500); };
  const state = () => page.evaluate(() => ({ open: window.__hl.everythingList.querySelector('.page-head').getAttribute('aria-expanded'), list: !!window.__hl.everythingList.querySelector('.page-items'), anim: window.__anim.splice(0) }));
  const s0 = await state();
  if (s0.open === 'true') await toggle();
  await page.evaluate(() => { window.__anim = []; });
  await toggle(); const exp = await state();
  L.check('6: expanding fades the list in, 150ms ease-out, no height slide', exp.open === 'true' && exp.list && exp.anim.some(a => a.cls === 'page-items' && a.opt.duration === 150 && a.opt.easing === 'ease-out' && !a.props.includes('height')), exp);
  await toggle(); const col = await state();
  L.check('6: collapsing fades the list out, 150ms ease-out, then removes it', col.open === 'false' && !col.list && col.anim.some(a => a.cls === 'page-items' && a.opt.duration === 150 && a.opt.easing === 'ease-out' && !a.props.includes('height')), col);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toggle(); const red = await state(); await toggle(); const red2 = await state();
  L.check('6: reduced motion toggles with no animation', red.open === 'true' && red.list && !red.anim.length && red2.open === 'false' && !red2.list && !red2.anim.length, { red, red2 });
  await ctx.close(); await L.done(browser);
})();
