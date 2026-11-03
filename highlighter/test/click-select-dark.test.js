const L = require('./lib');
const html = `<html><body style="font:16px sans-serif;margin:40px;background:#111;color:#eee"><p id="p">Alpha bravo charlie delta echo.</p></body></html>`;
(async () => { const b = await L.launch(); const { page } = await L.open(b, { html, scheme: 'dark' });
  await L.selStr(page, '#p', 'bravo'); await L.altKey(page, 'KeyH');
  const pt = await page.evaluate(() => { const r = window.__hl.allWrappers()[0].getBoundingClientRect(); return { x: r.left + 5, y: r.top + 5 }; });
  await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(100);
  const c = await page.evaluate(() => getComputedStyle(window.__hl.selectBoxesEl.querySelector('.select-box')).color);
  L.check('dark page box is ivory', c === 'rgb(250, 249, 245)', c); 
  // the same click on a light page gives the slate box, so the colour follows the page and is not fixed
  const lightHtml = html.replace('background:#111;color:#eee', 'background:#fff;color:#111');
  const lp = (await L.open(b, { html: lightHtml, scheme: 'light' })).page;
  await L.selStr(lp, '#p', 'bravo'); await L.altKey(lp, 'KeyH');
  const lpt = await lp.evaluate(() => { const r = window.__hl.allWrappers()[0].getBoundingClientRect(); return { x: r.left + 5, y: r.top + 5 }; });
  await lp.mouse.click(lpt.x, lpt.y); await lp.waitForTimeout(100);
  const lc = await lp.evaluate(() => getComputedStyle(window.__hl.selectBoxesEl.querySelector('.select-box')).color);
  L.check('light page box is slate', lc === 'rgb(20, 20, 19)', lc);
  L.check('the dark page box was drawn (one box per click)', await page.evaluate(() => window.__hl.selectBoxesEl.querySelectorAll('.select-box').length) === 1, null);
  await b.close(); process.exit(L.fails ? 1 : 0); })();
