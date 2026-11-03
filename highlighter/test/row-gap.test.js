const L = require('./lib');
const HTML = `<!doctype html><html><body style="font: 16px/1.5 sans-serif; margin: 40px">
<p id="p1">Alpha beta gamma delta epsilon zeta eta theta iota kappa.</p></body></html>`;
(async () => {
  const browser = await L.launch();
  const store = { 'https://example.test/a': JSON.stringify([
    { xpath: '//*[@id="p1"]', startOffset: 6, length: 4, key: 'h', text: 'beta', prefix: 'Alpha ', suffix: ' gamma', group: 'mg0abcde00001' },
    { xpath: '//*[@id="p1"]', startOffset: 11, length: 5, key: 'h', text: 'gamma', prefix: 'Alpha beta ', suffix: ' delta', group: 'mg0abcde00002' },
    { xpath: '//*[@id="p1"]', startOffset: 17, length: 5, key: 'h', text: 'delta', prefix: 'beta gamma ', suffix: ' epsilon', group: 'mg0abcde00003' }
  ]) };
  const { page } = await L.open(browser, { html: HTML, store });
  await page.evaluate(() => window.__hl.openPanel());
  await page.waitForTimeout(300);
  const gap = await page.evaluate(() => {
    const r = Array.from(window.__hl.panelList.querySelectorAll('.item')).map(e => e.getBoundingClientRect());
    return r.length < 2 ? null : r[1].top - r[0].bottom;
  });
  L.check('panel rows have a 2px gap', gap === 2, String(gap));
  const gaps = await page.evaluate(() => {
    const r = Array.from(window.__hl.panelList.querySelectorAll('.item')).map(e => e.getBoundingClientRect());
    return r.slice(1).map((x, i) => x.top - r[i].bottom);
  });
  L.check('three rows are listed', gaps.length === 2, gaps);
  L.check('every pair of panel rows has a 2px gap', gaps.length === 2 && gaps.every(g => g === 2), gaps);
  const first = await page.evaluate(() => getComputedStyle(window.__hl.panelList.querySelector('.item')).marginTop);
  L.check('the first row has no gap above it', first === '0px', first);
  await browser.close();
  console.log("FAILS", L.fails);
})();
