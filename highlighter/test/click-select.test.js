// 7.39: clicking an annotation selects it (solid focus-stroke box); keys act on it.
const L = require('./lib');
const html = `<html><body style="font:16px sans-serif;margin:40px">
<p id="p">Alpha bravo charlie <a id="lnk" href="#jumped">delta link</a> echo foxtrot golf hotel india juliet.</p>
<p id="q">Second paragraph kilo lima mike november.</p></body></html>`;
(async () => {
  const b = await L.launch();
  for (const scheme of ['light', 'dark']) {
    const { page, ctx } = await L.open(b, { html, scheme });
    await L.selStr(page, '#p', 'bravo', { endStr: 'echo' });
    await L.altKey(page, 'KeyH');
    await page.mouse.move(800, 600);
    let w = await L.wr(page);
    L.check(`${scheme} annotated`, w.length >= 1 && w[0].k === 'h', w);
    const box = () => page.evaluate(() => { const r = window.__hl; const e = r.selectBoxesEl.querySelector('.select-box'); if (!e || e.hidden) return null; const b = e.getBoundingClientRect();
      return { g: r.selectedGroups[0], b: [b.left, b.top, b.right, b.bottom], color: getComputedStyle(e).color, width: getComputedStyle(e.querySelector('path')).strokeWidth, style: getComputedStyle(e.querySelector('path')).strokeDasharray !== 'none' ? 'dashed' : 'solid' }; });
    // click on "bravo" text (not the link)
    const pt = await page.evaluate(() => { const w = window.__hl.allWrappers()[0]; const r = w.getClientRects()[0]; return { x: r.left + 5, y: r.top + r.height / 2 }; });
    await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(100);
    let bx = await box();
    const wrect = await page.evaluate(() => { const rs = window.__hl.allWrappers().flatMap(w => Array.from(w.getClientRects())); return [Math.min(...rs.map(r => r.left)), Math.min(...rs.map(r => r.top)), Math.max(...rs.map(r => r.right)), Math.max(...rs.map(r => r.bottom))]; });
    L.check(`${scheme} box drawn solid 1px around it`, bx && bx.style === 'solid' && bx.width === '1px' && bx.b[0] < wrect[0] && bx.b[1] < wrect[1] && bx.b[2] > wrect[2] && bx.b[3] > wrect[3], { bx, wrect });
    console.log('  box color', bx && bx.color);
    // plain digit restyles, mouse away
    await page.mouse.move(800, 600);
    await page.keyboard.press('Digit2'); await page.waitForTimeout(150);
    w = await L.wr(page);
    L.check(`${scheme} plain 4 restyles`, w.every(x => x.k === 'h4'), w);
    L.check(`${scheme} still selected`, !!(await box()), null);
    await L.altKey(page, 'Digit1');
    w = await L.wr(page);
    L.check(`${scheme} Alt+1 restyles`, w.every(x => x.k === 'h2'), w);
    // N opens the note editor
    await page.keyboard.press('KeyN'); await page.waitForTimeout(200);
    L.check(`${scheme} N opens editor`, await page.evaluate(() => !!window.__hl.editor), null);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    L.check(`${scheme} Esc closes editor first`, await page.evaluate(() => !window.__hl.editor), null);
    // Alt+D removes, Undo brings back
    await L.altKey(page, 'd'); await page.waitForTimeout(150);
    w = await L.wr(page);
    L.check(`${scheme} Alt+D removes`, w.length === 0, w);
    L.check(`${scheme} no undo toast`, (await L.toast(page)) === null, await L.toast(page));
    await page.waitForTimeout(50);
    L.check(`${scheme} box gone with it`, !(await box()), await box());
    await L.altKey(page, 'KeyZ');
    w = await L.wr(page);
    L.check(`${scheme} undo restores`, w.length >= 1, w);
    // Esc clears
    await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(100);
    L.check(`${scheme} reselected`, !!(await box()), null);
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    L.check(`${scheme} Esc clears`, !(await box()), null);
    // click elsewhere clears
    await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(100);
    const q = await page.evaluate(() => { const r = document.getElementById('q').getBoundingClientRect(); return { x: r.left + 30, y: r.top + r.height / 2 }; });
    await page.mouse.click(q.x, q.y); await page.waitForTimeout(100);
    L.check(`${scheme} click elsewhere clears`, !(await box()), null);
    // plain key with nothing selected does nothing
    await page.keyboard.press('Delete'); await page.waitForTimeout(100);
    L.check(`${scheme} plain Delete without selection does nothing`, (await L.wr(page)).length >= 1, null);
    // text selection clears
    await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(100);
    await L.selStr(page, '#q', 'kilo'); await page.waitForTimeout(100);
    L.check(`${scheme} text selection clears`, !(await box()), null);
    await page.evaluate(() => getSelection().removeAllRanges());
    await L.until(page, () => window.__hl.toolbarEl.hidden);   // the selection's toolbar may still cover the link
    // link inside wins
    const lp = await page.evaluate(() => { const r = document.getElementById('lnk').getBoundingClientRect(); return { x: r.left + 5, y: r.top + r.height / 2 }; });
    await page.mouse.click(lp.x, lp.y); await L.until(page, () => location.hash === '#jumped', null, 2000);
    L.check(`${scheme} link click follows link, no select`, !(await box()) && (await page.evaluate(() => location.hash)) === '#jumped', await page.evaluate(() => location.hash));
    // drag across annotation selects text, no box
    await page.mouse.move(pt.x, pt.y); await page.mouse.down(); await page.mouse.move(pt.x + 60, pt.y, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(150);
    L.check(`${scheme} drag selects text, no box`, !(await box()), await box());
    await page.evaluate(() => getSelection().removeAllRanges());
    // scroll follows
    await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(100);
    const b1 = await box();
    await page.evaluate(() => { document.body.style.height = '3000px'; window.scrollBy(0, 30); }); await page.waitForTimeout(150);
    const b2 = await box();
    L.check(`${scheme} box follows scroll`, b1 && b2 && Math.abs((b1.b[1] - b2.b[1]) - 30) <= 1, { b1, b2 });
    // Alt+V hides -> box goes
    await L.altKey(page, 'KeyV'); await page.waitForTimeout(100);
    L.check(`${scheme} Alt+V hides box`, !(await box()), null);
    await L.altKey(page, 'KeyV');
    L.check(`${scheme} no page errors`, page.__errors.length === 0, page.__errors);
    await ctx.close();
  }
  await b.close();
  console.log(L.fails ? `${L.fails} FAILED` : 'ALL PASS');
  process.exit(L.fails ? 1 : 0);
})();
