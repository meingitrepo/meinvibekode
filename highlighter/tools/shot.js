const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const lib = require('../test/lib.js');
(async () => {
  const [out, scheme = 'light', js] = process.argv.slice(2);
  const html = fs.readFileSync(path.resolve(__dirname, '../test/playground.html'), 'utf8');
  const browser = await chromium.launch();
  const { page } = await lib.open(browser, { html, scheme });
  if (js) { await page.evaluate(js); await page.waitForTimeout(400); }
  await page.screenshot({ path: out });
  console.log('saved', out);
  await browser.close();
})();
