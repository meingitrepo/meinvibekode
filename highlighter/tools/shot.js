const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const lib = require('../test/lib.js');
const ALL = "document.dispatchEvent(new KeyboardEvent('keydown',{key:'O',code:'KeyO',altKey:true,shiftKey:true,bubbles:true}));";
const TICK = "[...__hl.everythingList.querySelectorAll('input.check')].forEach(x=>{if(!x.checked)x.click()});";
// Presets for the js argument: the js argument may be one of these names; they seed tools/shot-fixture.json unless SHOT_FIXTURE is set.
const PRESETS = {
  panel: '__hl.openPanel()',
  'panel-ticked': "__hl.openPanel(); [...__hl.panelList.querySelectorAll('input.check')].forEach(x=>x.click())",
  all: ALL,
  'all-ticked': `${ALL} const hs=()=>__hl.everythingList.querySelectorAll('.page-head'); hs()[0].click(); setTimeout(()=>{${TICK} hs()[1].click(); setTimeout(()=>{${TICK}},100)},100)`
};
(async () => {
  const [out, scheme = 'light', arg] = process.argv.slice(2);
  const js = PRESETS[arg] || arg;
  if (PRESETS[arg] && !process.env.SHOT_FIXTURE) process.env.SHOT_FIXTURE = path.resolve(__dirname, 'shot-fixture.json');
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
