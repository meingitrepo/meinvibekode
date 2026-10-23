const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const lib = require('../test/lib.js');
(async () => {
  const [out, scheme = 'light', js] = process.argv.slice(2);
  const html = fs.readFileSync(path.resolve(__dirname, '../test/playground.html'), 'utf8');
  // SHOT_FIXTURE=<json>: saved annotations ({ pageUrl: [records] }) to start with, as GM storage values.
  const store = {};
  if (process.env.SHOT_FIXTURE) for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(process.env.SHOT_FIXTURE, 'utf8')))) store[k] = JSON.stringify(v);
  const browser = await chromium.launch();
  const { page } = await lib.open(browser, { html, scheme, store });
  if (js) { await page.evaluate(js); await page.waitForTimeout(400); }
  await page.screenshot({ path: out });
  console.log('saved', out);
  await browser.close();
})();
