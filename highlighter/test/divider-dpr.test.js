// Dividers must paint the same width in device pixels wherever they land (fractional zoom / DPR).
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:18px/1.6 serif;margin:40px"><p id="p1">Some plain words to select here.</p></body></html>`;
const check = L.check;
// Device-pixel columns that are painted (not the surface colour) across each divider, read back from a screenshot.
async function widths(browser, dsf, bar) {
  const { ctx, page: p } = await L.open(browser, { html: HTML });
  if (bar === 'penEl') await L.altKey(p, 'p'); else await L.drag(p, '#p1', 'plain words');
  await p.waitForTimeout(700);
  const rs = await p.evaluate(b => [...window.__hl[b].querySelectorAll('.divider')].map(d => { const r = d.getBoundingClientRect(); return { x: Math.floor(r.left) - 3, y: r.top + r.height / 2, w: 8 }; }), bar);
  const pg = await ctx.newPage();
  const out = [];
  for (const r of rs) {
    const buf = await p.screenshot({ clip: { x: r.x, y: Math.round(r.y), width: r.w, height: 1 } });
    out.push(await pg.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, img.width, 1).data, bg = d[0] + d[1] + d[2];
      let n = 0; for (let i = 0; i < img.width; i++) if (Math.abs(d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] - bg) > 30) n++;
      return n + ':' + Array.from({length: img.width}, (_, i) => d[i*4]).join('/');
    }, buf.toString('base64')));
  }
  await ctx.close();
  return out;
}
(async () => {
  for (const bar of ['penEl', 'toolbarEl']) for (const dsf of [1, 1.25, 1.5, 1.75]) {
    const browser = await L.launch(dsf);   // a real device scale factor, not an emulated one
    const w = await widths(browser, dsf, bar);
    await browser.close();
    check(`${bar} dividers paint one width at DPR ${dsf}`, w.length >= 1 && new Set(w.map(s => String(s).split(':')[0])).size === 1, w);
  }
  await L.done();
})();
