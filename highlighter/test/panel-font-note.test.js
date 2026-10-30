// 9.31: with no links on toasts, a missing UI font (Poppins, Lora) is suggested from the Annotations panel: one quiet
// line that names it and the fallback in use, with a "Get <font>" link per missing font. Nothing shows when both are installed.
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font:16px sans-serif;margin:200px 40px">
<p id="p1">Light paragraph one with words to select and more words after them.</p></body></html>`;
// The canvas is stubbed: a font named in window.__installed measures wider than the fallback.
const init = installed => `window.__installed = ${JSON.stringify(installed)};
  CanvasRenderingContext2D.prototype.measureText = function () { return { width: window.__installed.some(n => this.font.includes(n)) ? 20 : 10 }; };`;
const note = page => page.evaluate(() => {
  const n = window.__hl.panelEl.querySelector('.panel-fonts');
  if (!n || n.hidden) return null;
  return { text: n.textContent, links: [...n.querySelectorAll('a')].map(a => ({ t: a.textContent, href: a.getAttribute('href'), target: a.target, rel: a.rel })), inPanel: window.__hl.panelEl.contains(n) };
});
(async () => {
  const browser = await L.launch();
  const open = async installed => {
    const { page } = await L.open(browser, { html: HTML, init: init(installed) });
    await page.evaluate(() => window.__hl.openPanel()); await page.waitForTimeout(300);
    return page;
  };
  let page = await open([]);
  let n = await note(page);
  L.check('both missing: names both and their fallbacks', !!n && /Poppins and Lora/.test(n.text) && /Arial and Georgia/.test(n.text), n);
  L.check('both missing: a link per font to its download page, new tab, noopener', !!n && n.links.length === 2 && n.links[0].t === 'Get Poppins' && n.links[0].href === 'https://fonts.google.com/specimen/Poppins' && n.links[1].t === 'Get Lora' && n.links[1].href === 'https://fonts.google.com/specimen/Lora' && n.links.every(l => l.target === '_blank' && /noopener/.test(l.rel)), n);
  L.check('the note is inside the panel', !!n && n.inPanel, n);
  L.check('no page errors', !page.__errors.length, page.__errors);
  page = await open(['Poppins']);
  n = await note(page);
  L.check('only Lora missing: one link, names Lora and Georgia', !!n && n.links.length === 1 && n.links[0].t === 'Get Lora' && /Lora/.test(n.text) && !/Poppins/.test(n.text) && /Georgia/.test(n.text), n);
  page = await open(['Poppins', 'Lora']);
  L.check('both installed: no note', (await note(page)) === null, await note(page));
  await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
