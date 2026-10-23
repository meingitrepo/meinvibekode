// 7.43: live sync between tabs.
const L = require('./lib');
const html = `<html><body style="font:16px sans-serif;margin:40px">
<p id="p">Alpha bravo charlie delta echo foxtrot golf hotel india juliet.</p>
<p id="q">Second paragraph kilo lima mike november oscar papa.</p></body></html>`;
(async () => {
  const b = await L.launch();
  const pages = [];
  const onSend = (from, k, o, v) => Promise.all(pages.filter(p => p !== from).map(p => p.evaluate(([k, o, v]) => window.__deliver(k, o, v === null ? undefined : v, true), [k, o, v]).catch(() => {})));
  const A = (await L.open(b, { html, onSend })).page; pages.push(A);
  const B = (await L.open(b, { html, onSend })).page; pages.push(B);
  const settle = () => new Promise(r => setTimeout(r, 300));
  const click = async (page, i = 0) => { const pt = await page.evaluate(i => { const r = window.__hl.allWrappers()[i].getClientRects()[0]; return { x: r.left + 4, y: r.top + r.height / 2 }; }, i); await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(100); };

  await L.selStr(A, '#p', 'bravo', { endStr: 'delta' }); await L.altKey(A, 'KeyH'); await settle();
  let wb = await L.wr(B);
  L.check('A highlight shows in B', wb.length === 1 && wb[0].k === 'h' && wb[0].t === 'bravo charlie delta', wb);

  await click(B); await B.keyboard.press('Digit2'); await settle();
  let wa = await L.wr(A);
  L.check('B restyle shows in A', wa.length === 1 && wa[0].k === 'h4', wa);

  await L.selStr(A, '#q', 'kilo', { endStr: 'mike' }); await L.altKey(A, 'KeyU'); await settle();
  await click(A, 0); await L.altKey(A, 'd'); await settle();
  wb = await L.wr(B);
  L.check('A delete removes it in B, keeps the other', wb.length === 1 && wb[0].k === 'u', wb);

  await L.selStr(B, '#q', 'oscar'); await L.altKey(B, 'KeyS'); await settle();
  wa = await L.wr(A); wb = await L.wr(B);
  const st = await L.stored(A);
  L.check('deleted one stays gone after B saves', !wa.some(w => w.k === 'h4') && !wb.some(w => w.k === 'h4') && !st.some(r => r.key === 'h4'), { wa, wb, st });
  L.check('both tabs agree', JSON.stringify(wa.map(w => w.k + w.t)) === JSON.stringify(wb.map(w => w.k + w.t)), { wa, wb });

  // note editor open in B on the underline; A restyles it: B keeps its version
  const g = wb.find(w => w.k === 'u').g;
  await click(B, wb.findIndex(w => w.k === 'u')); await B.keyboard.press('KeyN'); await B.waitForTimeout(150);
  L.check('B editor open', await B.evaluate(() => !!window.__hl.editor), null);
  wa = await L.wr(A);
  await click(A, wa.findIndex(w => w.k === 'u')); await A.keyboard.press('Digit1'); await settle();
  wb = await L.wr(B);
  L.check('annotation being noted in B untouched', wb.some(w => w.g === g && w.k === 'u'), wb);
  await B.keyboard.type('hello'); await B.evaluate(() => window.__hl.saveEditor()); await settle();
  wa = await L.wr(A);
  L.check('B note save reaches A', wa.some(w => w.n === 'hello'), wa);

  console.log('  menu', await A.evaluate(() => Object.keys(window.__menu)));
  // clear in A
  await A.evaluate(() => window.__menu && Object.keys(window.__menu).forEach(k => { if (/^Clear .*this page/i.test(k)) window.__menu[k](); })); await settle();
  wb = await L.wr(B);
  L.check('clear in A empties B', wb.length === 0, wb);

  const menu = (p, re) => p.evaluate(src => { const re = new RegExp(src); Object.keys(window.__menu).forEach(k => { if (re.test(k)) window.__menu[k](); }); }, re);
  await L.selStr(A, '#p', 'golf'); await L.altKey(A, 'KeyH'); await settle();
  await menu(A, '^Turn off for'); await settle();
  L.check('site off in A turns B off', await B.evaluate(() => window.__hl.running === false && window.__hl.allWrappers().length === 0), null);
  await menu(B, '^Turn on for'); await settle();
  L.check('site on in B turns A on, annotation back', await A.evaluate(() => window.__hl.running) && (await L.wr(A).catch(() => [])).length >= 0, null);
  await A.waitForTimeout(1200);
  L.check('A shows its annotation again', (await L.wr(A)).length === 1, await L.wr(A));
  for (const p of pages) if (p.__errors.filter(e => !e.startsWith('DIALOG')).length) L.check('no page errors', false, p.__errors);
  await b.close();
  console.log(L.fails ? `${L.fails} FAILED` : 'all passed');
  process.exit(L.fails ? 1 : 0);
})();
