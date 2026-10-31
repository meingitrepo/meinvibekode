// Note actions use the note icons (add / edit) and a filled pin once pinned; the site menu's
// hide button shows the eye that matches its next action. Pen mode keeps the pencil.
const L = require('./lib');
const html = `<html><body style="font:16px sans-serif;margin:40px">
<p id="p">Alpha bravo charlie delta echo foxtrot golf hotel india juliet.</p></body></html>`;
const d = (el) => el.evaluate(e => window.__hl.iconName(e));
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
  L.check('pen bar: Add note uses the note-add icon', (await d(n)) === 'note-blank', await d(n));
  await page.evaluate(() => [...window.__hl.penEl.querySelectorAll('button')].find(x => /note/i.test(x.dataset.label)).click());
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__hl.noteInput.focus()); await page.keyboard.type('hi');
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  n = await noteBtn('penEl');
  L.check('pen bar: Edit note uses the note icon', (await d(n)) === 'note', await d(n));
  const menuIcon = id => page.evaluate(i => window.__hl.iconName(window.__hl.menuButtons.get(i)), id);
  L.check('site menu: pen mode uses the pencil (slashed while off)', (await menuIcon('pen')) === 'pencil-simple', await menuIcon('pen'));
  await L.altKey(page, 'KeyP');
  L.check('site menu: pen mode off shows the slashed pencil', (await menuIcon('pen')) === 'pencil-simple-slash', await menuIcon('pen'));
  const hide = () => menuIcon('hide');
  const lit = () => page.evaluate(() => window.__hl.menuButtons.get('hide').getAttribute('aria-pressed'));
  L.check('hide button shows the eye while annotations are visible', (await hide()) === 'eye', await hide());
  L.check('hide button is lit (pressed) while annotations are visible', (await lit()) === 'true', await lit());
  await L.altKey(page, 'KeyV'); await page.waitForTimeout(300);
  L.check('hide button shows eye-off while they are hidden', (await hide()) === 'eye-slash', await hide());
  L.check('hide button is not lit while they are hidden', (await lit()) === 'false', await lit());
  await L.altKey(page, 'KeyV'); await page.waitForTimeout(300);
  L.check('hide button back to the eye', (await hide()) === 'eye', await hide());
  await b.close();
})();
