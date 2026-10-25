// Tooltips show on hover and keyboard focus-visible, not on mouse-click focus.
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:18px/1.6 serif;margin:40px">
<p id="p1">Plain words to mark in the first paragraph here.</p></body></html>`;
const tipShown = p => p.evaluate(() => !window.__hl.labelTipEl.hidden);
(async () => {
  const browser = await L.launch();
  const { page: p } = await L.open(browser, { html: HTML });
  await L.selStr(p, '#p1', 'Plain words'); await p.waitForTimeout(400);
  await L.altKey(p, 'n'); await L.until(p, () => !window.__hl.editorEl.hidden);
  await p.evaluate(() => Promise.all(window.__hl.editorEl.getAnimations({ subtree: true }).map(a => a.finished.catch(() => {}))));
  const box = await p.evaluate(() => { const r = window.__hl.uiRoot.querySelector('button[data-label="Discard changes"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  // pressing the button focuses it with the mouse; the tip must not come from that focus
  await p.mouse.move(box.x, box.y); await p.waitForTimeout(500);
  await p.mouse.down();
  await p.evaluate(() => { window.__hl.labelTipEl.hidden = true; });
  await p.waitForTimeout(500);
  L.check('mouse-click focus shows no tooltip', !(await tipShown(p)));
  await p.mouse.move(box.x, box.y + 400); await p.mouse.up();
  await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.__hl.uiRoot.activeElement && window.__hl.uiRoot.activeElement.blur(); });
  await p.keyboard.press('Tab'); await p.waitForTimeout(500);
  const f = await p.evaluate(() => { const a = window.__hl.uiRoot.activeElement; return a && a.dataset.label; });
  L.check('keyboard focus shows the tooltip', f && await tipShown(p), f);
  await L.done(browser);
})();
