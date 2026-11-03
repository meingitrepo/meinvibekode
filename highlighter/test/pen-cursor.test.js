// The mouse cursor over the page follows the pen: the Windows arrow in the pen style's color.
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:18px/1.6 serif;margin:40px;max-width:700px">
<p id="p1">Some plain words a reader might mark.</p><a id="a" href="#x">a link</a></body></html>`;
const check = L.check;
const cursorOf = (p, sel) => p.evaluate(s => decodeURIComponent(getComputedStyle(document.querySelector(s)).cursor), sel);

async function follows(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, menu: true }); await L.openMenu(p);
  check('with the pen off the page keeps its own cursor', !/svg/.test(await cursorOf(p, '#p1')), await cursorOf(p, '#p1'));
  await L.altKey(p, 'p');
  const yellow = await cursorOf(p, '#p1');
  check('the pen on shows an SVG cursor in the style color', /image\/svg\+xml/.test(yellow) && /#EFD98A/i.test(yellow), yellow);
  // The system arrow is not scaled by Windows display scaling, so the image must map one image pixel to one device pixel.
  const res = /\)\s+([\d.]+)(?:dppx|x)\)/.exec(yellow);
  const dpr = await p.evaluate(() => devicePixelRatio);
  check('the cursor image is declared at the device pixel ratio', !!res && Math.abs(+res[1] - dpr) < 0.01, { res: res && res[1], dpr, yellow });
  check('over a link too', /image\/svg\+xml/.test(await cursorOf(p, '#a')), await cursorOf(p, '#a'));
  await L.altKey(p, 'u');
  const under = await cursorOf(p, '#p1');
  check('another style changes the cursor color', /#D32F2F/i.test(under) && !/#EFD98A/i.test(under), under);
  await L.altKey(p, 'd');
  const erase = await cursorOf(p, '#p1');
  check('the eraser has its own cursor', /image\/svg\+xml/.test(erase) && erase !== under && erase !== yellow, erase);
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  check('turning the pen off restores the page cursor', !/svg/.test(await cursorOf(p, '#p1')), await cursorOf(p, '#p1'));
  check('no page errors', p.__errors.length === 0, p.__errors);
  await ctx.close();
}

(async () => {
  const browser = await L.launch();
  await follows(browser).catch(e => check('follows crashed', false, e.stack));
  await L.done(browser);
})();
