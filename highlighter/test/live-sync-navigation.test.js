// Another tab's change that arrives while this tab settles an in-page navigation (the ~400 ms before it knows
// which page it is on) is applied once it has settled, not dropped until the next change.
const L = require('./lib');
const TEXT = 'Alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa.';
const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font:18px/1.6 serif;margin:40px"><p id="p">${TEXT}</p></body></html>`;
const URL_KEY = 'https://example.test/a';
const rec = (text, group) => { const at = TEXT.indexOf(text); return { xpath: '//*[@id="p"]', startOffset: at, length: text.length, key: 'h', text, prefix: TEXT.slice(Math.max(0, at - 24), at), suffix: TEXT.slice(at + text.length, at + text.length + 24), group, added: 1700000000000 }; };
const one = JSON.stringify([rec('echo foxtrot', 'gSeed')]);
const two = JSON.stringify([rec('echo foxtrot', 'gSeed'), rec('kilo lima', 'gOther')]);

(async () => {
  const browser = await L.launch();
  const { page } = await L.open(browser, { html: HTML, store: { [URL_KEY]: one } });
  // The URL moves away and straight back: the page is the same one once settled.
  await page.evaluate(() => { history.pushState({}, '', '/b'); window.dispatchEvent(new PopStateEvent('popstate')); history.pushState({}, '', '/a'); window.dispatchEvent(new PopStateEvent('popstate')); });
  await page.evaluate(([k, v]) => window.__deliver(k, window.__gm[k], v, true), [URL_KEY, two]);   // from another tab, mid-navigation
  await page.waitForTimeout(1200);
  const got = (await L.wr(page)).map(w => w.t).sort().join('|');
  L.check('a change from another tab during a navigation shows once it has settled', got === 'echo foxtrot|kilo lima', got);
  if (page.__errors.length) L.check('no page errors', false, page.__errors);
  await L.done(browser);
})();
