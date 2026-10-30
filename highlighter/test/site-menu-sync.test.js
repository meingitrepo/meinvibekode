// The menu's dragged place follows to every open tab at once, without a reload.
const L = require('./lib');
const html = '<html><body style="font:16px sans-serif;margin:40px"><p>Alpha bravo charlie.</p></body></html>';
(async () => {
  const b = await L.launch();
  const pages = [];
  const onSend = (from, k, o, v) => Promise.all(pages.filter(p => p !== from).map(p => p.evaluate(([k, o, v]) => window.__deliver(k, o, v === null ? undefined : v, true), [k, o, v]).catch(() => {})));
  const A = (await L.open(b, { html, onSend, menu: true })).page; pages.push(A);
  const B = (await L.open(b, { html, onSend, menu: true })).page; pages.push(B);
  const settle = () => new Promise(r => setTimeout(r, 300));
  const pos = p => p.evaluate(() => { const r = window.__hl.menuEl.getBoundingClientRect(); return { left: Math.round(r.left), top: Math.round(r.top) }; });
  const handle = p => p.evaluate(() => { const r = window.__hl.menuHandle.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const drag = async (p, dx, dy) => { const h = await handle(p); await p.mouse.move(h.x, h.y); await p.mouse.down(); await p.mouse.move(h.x + dx, h.y + dy, { steps: 5 }); return () => p.mouse.up(); };

  const before = await pos(B);
  await (await drag(A, 220, 120))(); await settle();
  const a = await pos(A), bb = await pos(B);
  L.check('A moved', a.left > before.left + 150, { a, before });
  L.check('drag in A moves the open menu in B', bb.left === a.left && bb.top === a.top, { a, bb });

  // B is mid-drag when A saves a new place: B stays under the pointer.
  const up = await drag(B, 40, 40);
  const mid = await pos(B);
  await (await drag(A, -100, 60))(); await settle();
  const still = await pos(B);
  L.check('a save from another tab does not move a menu being dragged', still.left === mid.left && still.top === mid.top, { mid, still });
  await up(); await settle();

  const C = (await L.open(b, { html, menu: true, store: await A.evaluate(() => window.__gm) })).page;
  L.check('a new tab opens at the saved place', JSON.stringify(await pos(C)) === JSON.stringify(await pos(B)), [await pos(C), await pos(B)]);

  for (const p of pages) if (p.__errors.filter(e => !e.startsWith('DIALOG')).length) L.check('no page errors', false, p.__errors);
  await b.close();
  console.log(L.fails ? `${L.fails} FAILED` : 'all passed');
  process.exit(L.fails ? 1 : 0);
})();
