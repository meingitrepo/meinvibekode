const L = require('./lib');
const HTML = `<!doctype html><html><body style="font: 16px/1.5 sans-serif; margin: 40px">
<p id="p1">Alpha beta gamma delta epsilon zeta eta theta iota kappa.</p></body></html>`;
(async () => {
  const browser = await L.launch();
  const store = { 'https://example.test/a': JSON.stringify([
    { xpath: '//*[@id="p1"]', startOffset: 6, length: 4, key: 'h', text: 'beta', prefix: 'Alpha ', suffix: ' gamma', group: 'mg0abcde00001' },
    { xpath: '//*[@id="p1"]', startOffset: 11, length: 5, key: 'h', text: 'gamma', prefix: 'Alpha beta ', suffix: ' delta', group: 'mg0abcde00002' }
  ]) };
  const { page } = await L.open(browser, { html: HTML, store });
  await page.evaluate(() => window.__hl.openPanel());
  await page.waitForTimeout(300);
  const gap = await page.evaluate(() => {
    const r = Array.from(window.__hl.panelList.querySelectorAll('.item')).map(e => e.getBoundingClientRect());
    return r.length < 2 ? null : r[1].top - r[0].bottom;
  });
  L.check('panel rows have a 2px gap', gap === 2, String(gap));
  await browser.close();
  console.log("FAILS", L.fails);
})();
