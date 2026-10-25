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
// Component presets crop to their element by default; SHOT_CLIP=<css selector | __hl.name> overrides, SHOT_CLIP=none takes the whole window.
const CLIPS = { panel: '__hl.panelEl', 'panel-ticked': '__hl.panelEl', all: '__hl.everythingEl', 'all-ticked': '__hl.everythingEl' };
(async () => {
  const [out, scheme = 'light', arg] = process.argv.slice(2);
  const js = PRESETS[arg] || arg;
  if (PRESETS[arg] && !process.env.SHOT_FIXTURE) process.env.SHOT_FIXTURE = path.resolve(__dirname, 'shot-fixture.json');
  const clipSel = process.env.SHOT_CLIP || CLIPS[arg];
  const clipOn = clipSel && clipSel !== 'none';
  if (clipOn && !process.env.DSF) process.env.DSF = '2';   // cropped shots are viewed small, so render at 2x
  const pad = +(process.env.SHOT_PAD || 16);
  let clip = null;   // measured once (light) and reused so every panel of a both shot has the same crop
  const html = fs.readFileSync(path.resolve(__dirname, '../test/playground.html'), 'utf8');
  // SHOT_FIXTURE=<json>: saved annotations ({ pageUrl: [records] }) to start with, as GM storage values.
  const store = {};
  if (process.env.SHOT_FIXTURE) for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(process.env.SHOT_FIXTURE, 'utf8')))) store[k] = JSON.stringify(v);
  const browser = await chromium.launch();
  // scheme "both": light and dark in one image, light on the left.
  const shots = [];
  for (const sc of scheme === 'both' ? ['light', 'dark'] : [scheme]) {
    const { page } = await lib.open(browser, { html, scheme: sc, store });
    // The playground themes itself with html.dark, not prefers-color-scheme; ensureTheme sets it and checks the page really is that theme.
    try { await lib.ensureTheme(page, sc); } catch (e) { console.error('shot: ' + e.message); process.exit(1); }
    if (js) { await page.evaluate(js); await page.waitForTimeout(400); }
    if (clipOn && !clip) {
      const r = await page.evaluate(sel => {
        const el = sel.startsWith('__hl.') ? window.__hl[sel.slice(5)] : document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      }, clipSel);
      if (!r || !r.width || !r.height) { console.error(`SHOT_CLIP target not found or empty: ${clipSel}`); process.exit(1); }
      const x = Math.max(0, r.x - pad), y = Math.max(0, r.y - pad), vp = page.viewportSize();
      clip = { x, y, width: Math.min(vp.width - x, r.width + 2 * pad), height: Math.min(vp.height - y, r.height + 2 * pad) };
    }
    shots.push(await page.screenshot(clip ? { clip } : {}));
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
