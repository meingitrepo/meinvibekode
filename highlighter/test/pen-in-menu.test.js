// The pen bar lives inside the sticky menu: shown while the pen is on and the menu is open,
// hidden with the menu (collapsed or Alt+Shift+M) while the pen keeps drawing.
const L = require('./lib');
const html = `<html><body style="font:16px sans-serif;margin:200px 40px">
<p id="p">Alpha bravo charlie delta echo foxtrot golf hotel india juliet.</p></body></html>`;
const seen = page => page.evaluate(() => window.__hl.penEl.checkVisibility());
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, { html, menu: true });
  L.check('pen off: no bar', !(await seen(page)), null);
  await L.altKey(page, 'KeyP');
  L.check('pen on, menu collapsed: bar hidden, pen on', !(await seen(page)) && await page.evaluate(() => !!window.__hl.penKey), null);
  await L.openMenu(page);
  L.check('menu open: bar shown', await seen(page), null);
  L.check('the bar eases in when it is revealed (animation on the bar and its divider)', await page.evaluate(() => { const r = window.__hl; return getComputedStyle(r.penEl).animationName === 'highlighter-pen-in' && getComputedStyle(r.penEl.previousElementSibling).animationName === 'highlighter-pen-in'; }), await page.evaluate(() => getComputedStyle(window.__hl.penEl).animationName));
  L.check('the bar is inside the menu', await page.evaluate(() => window.__hl.menuEl.contains(window.__hl.penEl)), null);
  L.check('the bar takes the menu theme', await page.evaluate(() => { const h = window.__hl.menuEl.getRootNode().host; return !window.__hl.penEl.hasAttribute('data-theme') || window.__hl.penEl.getAttribute('data-theme') === h.getAttribute('data-theme'); }), null);
  // Roving focus with the arrow keys works in the menu's own root.
  await page.evaluate(() => [...window.__hl.penEl.querySelectorAll('button:not(:disabled)')].find(x => x.tabIndex === 0).focus());
  const at = () => page.evaluate(() => { const bs = [...window.__hl.penEl.querySelectorAll('button:not(:disabled)')]; return bs.indexOf(window.__hl.penEl.getRootNode().activeElement); });
  const i0 = await at();
  await page.keyboard.press('ArrowRight');
  L.check('ArrowRight moves focus along the bar', (await at()) === i0 + 1, [i0, await at()]);
  await page.evaluate(() => window.__hl.penEl.getRootNode().activeElement.blur());
  // Clicking a style button keeps the page selection and changes the pen.
  await L.selStr(page, '#p', 'golf');
  const before = await page.evaluate(() => window.__hl.penKey);
  const menuAt = await page.evaluate(() => window.__hl.menuEl.style.left + window.__hl.menuEl.style.top);
  const r = await page.evaluate(k => { const x = [...window.__hl.penEl.querySelectorAll('button[aria-pressed="false"]')].find(b => !/eraser/i.test(b.dataset.label)).getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  await page.mouse.click(r.x, r.y); await page.waitForTimeout(200);
  L.check('style click changes the pen', await page.evaluate(k => window.__hl.penKey !== k, before), null);
  L.check('style click keeps the page selection', await page.evaluate(() => getSelection().toString()) === 'golf', await page.evaluate(() => getSelection().toString()));
  L.check('style click annotates nothing', (await L.wr(page)).length === 0, await L.wr(page));
  L.check('style click does not move the menu', await page.evaluate(() => window.__hl.menuEl.style.left + window.__hl.menuEl.style.top) === menuAt, null);
  await page.evaluate(() => getSelection().removeAllRanges());
  // Esc with focus in the pen bar still turns the pen off (review I1).
  await page.evaluate(() => [...window.__hl.penEl.querySelectorAll('button:not(:disabled)')].find(x => x.tabIndex === 0).focus());
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  L.check('Esc in the pen bar turns the pen off', await page.evaluate(() => window.__hl.penKey === null), null);
  await L.altKey(page, 'KeyP'); await L.openMenu(page);
  // Hiding the menu hides the bar; the pen still draws.
  await L.altKey(page, 'KeyM', true); await page.waitForTimeout(200);
  L.check('menu hidden: bar hidden, pen still on', !(await seen(page)) && await page.evaluate(() => !!window.__hl.penKey), null);
  await L.drag(page, '#p', 'bravo'); await page.waitForTimeout(300);
  L.check('pen still draws', (await L.wr(page)).some(w => w.t === 'bravo'), await L.wr(page));
  await L.altKey(page, 'KeyM', true); await page.waitForTimeout(200);
  L.check('menu back: bar back', await seen(page), null);
  // Key pressed without altKey's 150ms wait, which would outlast the fade.
  await page.keyboard.down('Alt'); await page.keyboard.press('KeyP'); await page.keyboard.up('Alt');
  await page.waitForTimeout(50);
  const mid = await page.evaluate(() => ({ shown: window.__hl.penEl.checkVisibility(), op: Number(getComputedStyle(window.__hl.penEl).opacity) }));
  await page.waitForTimeout(300);
  L.check('pen off: the bar fades out instead of vanishing (still painted mid-fade, then gone)', mid.shown && mid.op > 0 && mid.op < 1 && !(await seen(page)), mid);
  L.check('no page errors', page.__errors.length === 0, page.__errors);
  await L.done(b);
})();
