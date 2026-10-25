// Note actions use Fluent's note icons (add / edit) and a filled pin once pinned; the site menu's
// hide button shows the eye that matches its next action. Pen mode keeps the pencil.
const L = require('./lib');
const html = `<html><body style="font:16px sans-serif;margin:40px">
<p id="p">Alpha bravo charlie delta echo foxtrot golf hotel india juliet.</p></body></html>`;
const d = (el) => el.evaluate(e => { const p = e.querySelector('svg path.ic-r'); return p && p.getAttribute('d').slice(0, 14); });
const START = { add: 'M10 5.5a4.5 4.', edit: 'M3 14.18A3 3 0', pencil: 'M17.18 2.93a2', pinFill: 'M13.33 2.62a2', pin: 'M10.12 3.14a2', eye: 'M3.25909 11.60', eyeOff: 'M2.85 2.15a.5.' };
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, { html });
  await L.selStr(page, '#p', 'bravo', { endStr: 'charlie' });
  await L.altKey(page, 'KeyH');
  await page.mouse.move(800, 600);
  const noteBtn = async (host) => page.evaluateHandle(h => [...window.__hl[h].querySelectorAll('button')].find(x => /note/i.test(x.dataset.label)), host);
  await L.altKey(page, 'KeyP');
  const pt = await page.evaluate(() => { const r = window.__hl.allWrappers()[0].getClientRects()[0]; return { x: r.left + 5, y: r.top + r.height / 2 }; });
  await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(400);
  let n = await noteBtn('penEl');
  L.check('pen bar: Add note uses the note-add icon', (await d(n)) === START.add, await d(n));
  await page.evaluate(() => [...window.__hl.penEl.querySelectorAll('button')].find(x => /note/i.test(x.dataset.label)).click());
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__hl.noteInput.focus()); await page.keyboard.type('hi');
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  n = await noteBtn('penEl');
  L.check('pen bar: Edit note uses the note-edit icon', (await d(n)) === START.edit, await d(n));
  L.check('site menu: pen keeps the pencil', await page.evaluate(s => { const p = window.__hl.menuButtons.get('pen').querySelector('svg path.ic-r'); return p.getAttribute('d').startsWith(s); }, START.pencil), null);
  await L.altKey(page, 'KeyP');
  const hide = () => page.evaluate(() => { const p = window.__hl.menuButtons.get('hide').querySelector('svg path.ic-r'); return p.getAttribute('d').slice(0, 14); });
  L.check('hide button shows eye-off while visible', (await hide()) === START.eyeOff, await hide());
  await L.altKey(page, 'KeyV'); await page.waitForTimeout(300);
  L.check('hide button shows eye while hidden', (await hide()) === START.eye, await hide());
  await L.altKey(page, 'KeyV'); await page.waitForTimeout(300);
  L.check('hide button back to eye-off', (await hide()) === START.eyeOff, await hide());
  await b.close();
})();
