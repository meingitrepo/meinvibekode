// Our layers (dashed outline, selection toolbar, pinned note cards) stay out from over a page's sticky header.
const L = require('./lib');
const HTML = `<!doctype html><html><body style="font: 16px/1.5 sans-serif; margin: 0">
<div id="hdr" style="position: sticky; top: 0; z-index: 5; height: 60px; background: #eee">Header</div>
<div style="padding: 0 40px; max-width: 700px">
<p id="p1">Alpha beta gamma delta epsilon zeta eta theta iota kappa.</p>
${Array.from({ length: 40 }, (_, i) => `<p>Filler paragraph number ${i} with some ordinary words in it.</p>`).join('')}
</div></body></html>`;
(async () => {
  const browser = await L.launch();
  const { page } = await L.open(browser, { html: HTML });
  const scrollTo = y => page.evaluate(y => window.scrollTo(0, y), y).then(() => page.waitForTimeout(250));
  await L.selStr(page, '#p1', 'beta gamma'); await L.altKey(page, 'n'); await page.keyboard.type('a note'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('p1').getBoundingClientRect(); return [r.left + 50, r.top + 8]; });
  await page.mouse.click(x, y); await page.waitForTimeout(300);
  const clip = () => page.evaluate(() => window.__hl.selectBoxesEl.querySelector('.select-box').style.clipPath);
  L.check('box fully visible below the header: no clip', !(await clip()), await clip());
  const top = await page.evaluate(() => document.getElementById('p1').getBoundingClientRect().top + scrollY);
  await scrollTo(top - 50);   // the line half under the 60px header
  L.check('box cut away under the header', /^path\(/.test(await clip()), await clip());
  await scrollTo(top - 120);
  L.check('box back to whole', !(await clip()), await clip());
  // pinned note card
  await page.mouse.move(...await L.badge(page, 'beta gamma')); await page.waitForTimeout(450);
  await page.evaluate(() => window.__hl.noteCardEl.querySelector('.card-actions button').click()); await page.waitForTimeout(100);
  const pinned = () => page.evaluate(() => getComputedStyle(window.__hl.uiRoot.querySelector('[data-pinned]')).visibility);
  L.check('pinned card shown', await pinned() === 'visible', await pinned());
  await scrollTo(top - 5);   // the text wholly under the header
  L.check('pinned card hidden while its text is under the header', await pinned() === 'hidden', await pinned());
  await scrollTo(top - 150);
  L.check('pinned card back', await pinned() === 'visible', await pinned());
  // toolbar for a text selection
  await page.mouse.click(5, 300); await page.keyboard.press('Escape');
  await L.selStr(page, '#p1', 'alpha'.replace('a', 'A')); await page.waitForTimeout(400);
  await scrollTo(top - 5);
  const tb = () => page.evaluate(() => getComputedStyle(window.__hl.toolbarEl).visibility);
  L.check('toolbar hidden while its text is under the header', await tb() === 'hidden', await tb());
  await scrollTo(top - 150);
  L.check('toolbar back', await tb() === 'visible', await tb());
  await browser.close();
  process.exit(L.fails ? 1 : 0);
})();
