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
  // scheme "both": light and dark in one image, light on the left.
  const shots = [];
  for (const sc of scheme === 'both' ? ['light', 'dark'] : [scheme]) {
    const { page } = await lib.open(browser, { html, scheme: sc, store });
    // The playground themes itself with html.dark, not prefers-color-scheme, so a dark shot must set the class too.
    if (sc === 'dark') { await page.evaluate(() => document.documentElement.classList.add('dark')); await page.waitForTimeout(300); }
    const luma = await page.evaluate(() => { const m = getComputedStyle(document.documentElement).backgroundColor.match(/\d+/g).map(Number); return (m[0] + m[1] + m[2]) / 3; });
    if ((sc === 'dark') !== (luma < 128)) { console.error(`shot is not ${sc}: page background luma ${luma}`); process.exit(1); }
    if (js) { await page.evaluate(js); await page.waitForTimeout(400); }
    shots.push(await page.screenshot());
  }
  if (shots.length === 1) fs.writeFileSync(out, shots[0]);
  else {
    const side = await browser.newPage();
    await side.setContent(`<body style="margin:0;display:flex">${shots.map(b => `<img src="data:image/png;base64,${b.toString('base64')}">`).join('')}</body>`);
    await side.waitForFunction(() => [...document.images].every(i => i.complete));
    await side.screenshot({ path: out, fullPage: true });
  }
  console.log('saved', out);
  await browser.close();
})();
