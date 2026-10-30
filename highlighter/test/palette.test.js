// 7.33 item 8: dark palette and automatic dark / light text on highlights.
const L = require('./lib');
const check = L.check;
const HTML = (bodyStyle) => `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:18px/1.6 serif;margin:40px;${bodyStyle}">
<p id="p1">Plain words to mark in the first paragraph here.</p>
<div id="banner" style="background:#ffcc80;color:#fff;padding:8px"><p id="p2">White words on an amber banner to mark here.</p></div>
<p id="p3">More plain words for an underline here.</p></body></html>`;
const info = (p, text) => p.evaluate(t => {
  const w = window.__hl.allWrappers().find(x => x.textContent === t); if (!w) return null;
  const svg = window.__hl.getSvg(w); const path = svg && svg.querySelector('path');
  return { ink: w.getAttribute('data-highlighter-ink'), dark: w.hasAttribute('data-highlighter-dark'), color: getComputedStyle(w).color, stroke: path && path.getAttribute('stroke') };
}, text);

async function light(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML('') });
  await L.selStr(p, '#p1', 'Plain words'); await L.altKey(p, 'h');
  await L.selStr(p, '#p2', 'White words'); await L.altKey(p, 'h');
  await p.waitForTimeout(100);
  let a = await info(p, 'Plain words'), b = await info(p, 'White words');
  check('dark text on yellow is left alone', a && !a.ink && a.color === 'rgb(0, 0, 0)', a);
  check('white text on yellow turns dark', b && b.ink === 'dark' && b.color === 'rgb(27, 27, 27)', b);
  await L.altKey(p, 'v');
  b = await info(p, 'White words');
  check('hidden annotations give the text its own color back', b && b.color === 'rgb(255, 255, 255)', b);
  await L.altKey(p, 'v');
  // the banner one as an underline instead (erased with Alt+D first): no ink on a line
  await L.selStr(p, '#p2', 'White words'); await L.altKey(p, 'h');
  await L.selStr(p, '#p2', 'White words'); await L.altKey(p, 'd');
  await L.selStr(p, '#p2', 'White words'); await L.altKey(p, 'u'); await p.waitForTimeout(100);
  b = await info(p, 'White words');
  check('an underline never recolors text', b && !b.ink && b.color === 'rgb(255, 255, 255)', b);
  await L.altKey(p, 'z'); await L.altKey(p, 'z'); await p.waitForTimeout(100);
  b = await info(p, 'White words');
  check('undo brings the dark text back with the highlight', b && b.ink === 'dark', b);
  // light theme: yellow is still #EFD98A (Anthropic-toned since 9.24)
  await L.selStr(p, '#p3', 'underline'); await L.altKey(p, 'u'); await p.waitForTimeout(100);
  check('underline is red on light pages', (await info(p, 'underline')).stroke === '#D32F2F', await info(p, 'underline'));
  check('yellow stays yellow on light pages', (await info(p, 'Plain words')).stroke === '#EFD98A', await info(p, 'Plain words'));
  check('no page errors', p.__errors.length === 0, p.__errors);
  await ctx.close();
}

async function dark(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML('background:#121212;color:#e8e8e8'), scheme: 'dark' });
  await L.selStr(p, '#p1', 'Plain words'); await L.altKey(p, 'h');
  await L.selStr(p, '#p3', 'plain words'); await L.altKey(p, 'u');
  await L.selStr(p, '#p3', 'underline'); await L.altKey(p, 's');
  await p.waitForTimeout(100);
  const a = await info(p, 'Plain words');
  check('dark yellow is dark gold, and light text stays', a && a.dark && a.stroke === '#6F5614' && !a.ink, a);
  check('dark underline is soft red', (await info(p, 'plain words')).stroke === '#FF5F57', await info(p, 'plain words'));
  check('dark strike-through is a light red', (await info(p, 'underline')).stroke === '#FF5F57', await info(p, 'underline'));
  check('no page errors', p.__errors.length === 0, p.__errors);
  await ctx.close();
}

(async () => {
  const browser = await L.launch();
  await Promise.all([light, dark].map(f => f(browser).catch(e => check(`${f.name} crashed`, false, e.stack))));
  await L.done(browser);
})();
