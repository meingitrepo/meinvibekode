// The UI states the gallery renders: a fixed page with saved annotations, and for each state how to bring
// the page to it (setup) and which highlighter elements to crop to (clip: names on window.__hl).
// opts is merged into test/lib.js open (e.g. { menu: true }).
'use strict';
const KEY = 'https://example.test/a';
const CTX = 24;
const P1 = 'Short first paragraph with alpha note words in it.';
const P2 = 'Second paragraph with some plain words and a little more text after them.';
const P3 = 'Third paragraph with beta note words in it.';
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Gallery page</title></head><body style="font:18px/1.6 serif;margin:40px;max-width:560px">
<p id="p1">${P1}</p><p id="p2">${P2}</p><p id="p3">${P3}</p></body></html>`;
function rec(xpath, block, text, group, note) {
    const at = block.indexOf(text);
    return { xpath, startOffset: at, length: text.length, key: 'h', text, prefix: block.slice(Math.max(0, at - CTX), at), suffix: block.slice(at + text.length, at + text.length + CTX), group, note };
}
const STORE = { [KEY]: JSON.stringify([rec('//*[@id="p1"]', P1, 'alpha note', 'gA', 'Note A'), rec('//*[@id="p3"]', P3, 'beta note', 'gB', 'Note B')]) };
// The search panel lists every page, so two more pages hold a saved quote each.
['https://other.test/blog/post-one', 'https://third.test/old'].forEach((url, i) => {
    STORE[url] = JSON.stringify([rec('//*[@id="p1"]', P1, 'alpha note', 'gO' + i, 'Another page')]);
});
// A mouse selection shows the toolbar, as it does for a person.
const selectText = (page, L) => L.drag(page, '#p2', 'plain words');
// Rests the pointer on an annotation and presses Alt+N: the note editor opens.
const openEditor = async (page, L) => {
    const r = (await L.rects(page, '#p1', 'alpha note'))[0];
    await page.mouse.move(r.left + 3, (r.top + r.bottom) / 2);
    await page.waitForTimeout(200);
    await L.altKey(page, 'n');
};
const STATES = [
    { id: 'toast', setup: page => page.evaluate(() => window.__hl.showToast('Annotations hidden')), clip: ['toastEl'] },
    { id: 'toolbar', setup: selectText, clip: ['toolbarEl'] },
    { id: 'toolbar-tooltip', clip: ['toolbarEl', 'labelTipEl'], setup: async (page, L) => {
        await selectText(page, L);
        // The toolbar appears a moment after the selection; the tooltip a moment after the pointer rests (gallery.js waits for it).
        if (!await L.until(page, () => !window.__hl.toolbarEl.hidden && !!window.__hl.toolbarEl.querySelector('button'), null, 5000)) throw new Error('toolbarEl not visible');
        const at = await page.evaluate(() => { const r = window.__hl.toolbarEl.querySelector('button').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
        await page.mouse.move(at[0], at[1]);
    } },
    { id: 'panel', setup: page => page.evaluate(() => window.__hl.openPanel()), clip: ['panelEl'] },
    { id: 'panel-ticked', clip: ['panelEl'], setup: page => page.evaluate(() => {
        window.__hl.openPanel();
        [...window.__hl.panelList.querySelectorAll('input.check')].forEach(x => x.click());
    }) },
    { id: 'note-card', clip: ['noteCardEl'], setup: async (page, L) => {
        const [x, y] = await L.badge(page, 'gA');
        await page.mouse.move(x + 12, y);   // the card shows after the pointer rests (gallery.js waits for it)
    } },
    { id: 'editor', setup: openEditor, clip: ['editorEl'] },
    { id: 'menu', opts: { menu: true }, setup: async () => {}, clip: ['menuEl'] },
    { id: 'search', setup: (page, L) => L.altKey(page, 'o', true), clip: ['everythingEl'] },
    { id: 'help', setup: (page, L) => L.altKey(page, 'h', true), clip: ['helpEl'] },
    { id: 'changelog', setup: (page, L) => L.altKey(page, 'w', true), clip: ['helpEl'] },
];
module.exports = { HTML, STORE, STATES };
