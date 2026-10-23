const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const lib = require('../test/lib.js');
(async () => {
  const [out, scheme, js, frames = '6', gap = '40'] = process.argv.slice(2);
  const html = fs.readFileSync(path.resolve(__dirname, '../test/playground.html'), 'utf8');
  const browser = await chromium.launch();
  const { page } = await lib.open(browser, { html, scheme });
  await page.evaluate(js);
  for (let i = 0; i < Number(frames); i++) {
    await page.screenshot({ path: `${out}-${i}.png` });
    await page.waitForTimeout(Number(gap));
  }
  console.log('saved', `${out}-0..${frames - 1}.png`);
  await browser.close();
})();
