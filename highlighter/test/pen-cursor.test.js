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
  // Page zoom raises devicePixelRatio but not the cursor's size, so the zoom (outerWidth/innerWidth) is divided out.
  const real = await p.evaluate(() => ({ dpr: devicePixelRatio, outer: outerWidth }));
  await p.evaluate(() => {
    Object.defineProperty(window, 'devicePixelRatio', { value: devicePixelRatio * 1.5, configurable: true });
    Object.defineProperty(window, 'outerWidth', { value: innerWidth * 1.5, configurable: true });
    dispatchEvent(new Event('resize'));
  });
  const zoomed = /\)\s+([\d.]+)(?:dppx|x)\)/.exec(await cursorOf(p, '#p1'));
  check('under 150% page zoom the image stays at the display scale', !!zoomed && Math.abs(+zoomed[1] - real.dpr) < 0.01, zoomed && zoomed[1]);
  await p.evaluate(r => { Object.defineProperty(window, 'devicePixelRatio', { value: r.dpr, configurable: true }); Object.defineProperty(window, 'outerWidth', { value: r.outer, configurable: true }); dispatchEvent(new Event('resize')); }, real);
  check('the arrow sits in a 32x32 canvas like Windows cursors', /width="32" height="32"/.test(yellow), yellow);
  check('over a link too',/image\/svg\+xml/.test(await cursorOf(p, '#a')), await cursorOf(p, '#a'));
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

async function darkPage(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML.replace('<body style="', '<body style="background:#111;color:#eee;'), scheme: 'dark', menu: true }); await L.openMenu(p);
  await L.altKey(p, 'p');
  const c = await cursorOf(p, '#p1');
  check('on a dark page the arrow keeps the light-theme color', /#EFD98A/i.test(c) && !/#6F5614/i.test(c), c);
  check('on a dark page the arrow keeps the black outline', /stroke="#000"/.test(c) && !/stroke="#fff"/.test(c), c);
  await ctx.close();
}

(async () => {
  const browser = await L.launch();
  await Promise.all([follows, darkPage].map(f => f(browser).catch(e => check(`${f.name} crashed`, false, e.stack))));
  await L.done(browser);
})();
