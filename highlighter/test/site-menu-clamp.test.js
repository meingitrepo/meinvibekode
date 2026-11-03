// The sticky menu stays fully on screen: a place saved on a larger screen, a smaller window and a drag to the edge all clamp it.
const L = require('./lib');
const HTML = '<!doctype html><html><head><meta charset="utf-8"></head><body style="font:16px sans-serif;margin:200px 40px"><p>text</p></body></html>';
const inside = page => page.evaluate(() => {
  const r = window.__hl.menuEl.getBoundingClientRect();
  return { ok: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight, r: JSON.parse(JSON.stringify(r)), w: window.innerWidth, h: window.innerHeight };
});
(async () => {
  const browser = await L.launch();
  const store = { 'rnh:settings': JSON.stringify({ menuPos: { left: 1000, top: 680 } }) };
  let { ctx, page } = await L.open(browser, { html: HTML, menu: true, defaults: true, store });
  let s = await inside(page);
  L.check('a place saved off the right/bottom edge is clamped on load (collapsed)', s.ok, s);
  await page.evaluate(() => window.__hl.menuExpand.click()); await page.waitForTimeout(300);
  s = await inside(page);
  L.check('expanding the menu near the edge keeps all of it on screen', s.ok, s);
  await page.setViewportSize({ width: 500, height: 300 }); await page.waitForTimeout(400);
  s = await inside(page);
  L.check('shrinking the window pulls the menu back in', s.ok, s);
  await page.setViewportSize({ width: 1100, height: 700 }); await page.waitForTimeout(400);
  const hb = await page.evaluate(() => JSON.parse(JSON.stringify(window.__hl.menuHandle.getBoundingClientRect())));
  await page.mouse.move(hb.left + hb.width / 2, hb.top + hb.height / 2); await page.mouse.down(); await page.mouse.move(1090, 690, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(300);
  s = await inside(page);
  const saved = await page.evaluate(() => JSON.parse(window.__gm['rnh:settings']).menuPos);
  L.check('dragged to the corner: fully on screen, and the saved place is one that fits', s.ok && saved.left + s.r.width <= 1100 && saved.top + s.r.height <= 700, { s, saved });
  await ctx.close();
  await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
