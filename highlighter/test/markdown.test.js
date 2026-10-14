const L = require('./lib');
const HTML = `<!doctype html><html><head><title>T3</title></head><body style="font: 16px/1.5 sans-serif; margin: 40px; max-width: 700px">
<p id="p1"><b>Bold one</b> mid <a href="#x">link</a> end <i>ital two</i> words.</p>
<p id="p2">Second paragraph begins here and goes on for quite a while longer than ten words in total.</p>
<p id="p3">Third paragraph is short.</p>
</body></html>`;
(async () => {
  const browser = await L.launch();
  const { ctx, page } = await L.open(browser, { html: HTML, url: 'https://example.test/a?utm_source=x#section' });
  // Alt+J with no annotations: not prevented
  const prevented = await page.evaluate(() => { let p = null; document.addEventListener('keydown', e => { p = e.defaultPrevented; }, { once: true }); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', altKey: true, bubbles: true })); document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', altKey: true, bubbles: true })); return p; });
  L.check('Alt+J without annotations not prevented', prevented === false, prevented);
  await L.selStr(page, '#p1', 'one mid link end ital');
  await L.altKey(page, 'h');
  const pieces = await page.evaluate(() => window.__hl.allWrappers().map(w => w.textContent));
  console.log(pieces);
  let pa = await page.evaluate(() => window.__hl.pageAnnotations().map(a => a.paragraphs));
  L.check('link-split annotation is one paragraph', JSON.stringify(pa) === JSON.stringify([['one mid link end ital']]), pa);
  // erase the link piece
  await L.selStr(page, '#p1', 'link');
  await L.altKey(page, 'Backspace');
  pa = await page.evaluate(() => window.__hl.pageAnnotations().map(a => a.paragraphs));
  L.check('gap shows ellipsis', JSON.stringify(pa) === JSON.stringify([['one mid … end ital']]), pa);
  // two-paragraph annotation
  await page.evaluate(() => { const a = document.querySelector('#p2').firstChild, b = document.querySelector('#p3').firstChild; const r = document.createRange(); r.setStart(a, 7); r.setEnd(b, 15); getSelection().removeAllRanges(); getSelection().addRange(r); });
  await L.altKey(page, '2');
  await page.evaluate(() => window.__hl.copyAnnotations()); await page.waitForTimeout(100);
  const md = await page.evaluate(() => window.__clip);
  console.log(md);
  L.check('url without tracking/hash', md.includes('](https://example.test/a)'), md.split('\n')[0]);
  L.check('gap md link uses start,end', md.includes('#:~:text=one%20mid,end%20ital)'), md);
  L.check('multi-paragraph quote', md.includes('> paragraph begins here and goes on for quite a while longer than ten words in total.\n>\n> Third paragraph') && md.includes('text=paragraph%20begins%20here%20and%20goes,Third%20paragraph)'), md);
  // dark scheme OS, light page: panel light
  await ctx.close();
  const d = await L.open(browser, { html: HTML, scheme: 'dark' });
  await L.altKey(d.page, 'o');
  const th = await d.page.evaluate(() => window.__hl.panelEl.getAttribute('data-theme'));
  L.check('panel light on white page in OS dark', th === 'light', th);
  // Esc closes panel and returns focus
  await d.page.keyboard.press('Escape');
  L.check('Esc closes', await d.page.evaluate(() => window.__hl.panelEl.hidden));
  // arrow navigation
  await L.selStr(d.page, '#p3', 'Third'); await L.altKey(d.page, 'h');
  await L.selStr(d.page, '#p2', 'Second'); await L.altKey(d.page, 'u');
  await d.page.evaluate(() => getSelection().removeAllRanges());
  await L.altKey(d.page, 'o');
  await d.page.keyboard.press('ArrowDown'); await d.page.keyboard.press('ArrowDown');
  const foc = await d.page.evaluate(() => { const a = window.__hl.uiRoot.activeElement; return a && a.textContent; });
  L.check('arrow navigation', /^Third/.test(foc), foc);
  await d.page.keyboard.press('Enter'); await d.page.waitForTimeout(800);
  L.check('enter jumps', await d.page.evaluate(() => { const g = window.__hl.jumpGroup; return window.__hl.allWrappers().find(w => w.getAttribute('data-highlighter-group') === g).textContent; }) === 'Third');
  console.log(d.page.__errors);
  L.check('no errors', !d.page.__errors.length && true, d.page.__errors);
  await browser.close();
  console.log('FAILS', L.fails);
})();
