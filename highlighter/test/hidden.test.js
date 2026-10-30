// 7.31: Alt+V says "Annotations hidden · Show", and that message goes whenever they show again
// (and only that message).
const L = require('./lib');
const CTX = 24;
function rec(xpath, block, text, { key = 'h', group, extra = {} } = {}) {
  const at = block.indexOf(text);
  return { xpath, startOffset: at, length: text.length, key, text, prefix: block.slice(Math.max(0, at - CTX), at), suffix: block.slice(at + text.length, at + text.length + CTX), group, ...extra };
}
const KEY = 'https://example.test/a';
const P1 = 'Paragraph alpha one is here with some words.';
const P2 = 'Paragraph beta two is here with other words.';
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:16px/1.5 serif;margin:40px">
<p id="p1">${P1}</p><p id="p2">${P2}</p><p id="p3">Some plain words to annotate later on.</p></body></html>`;
const store = { [KEY]: JSON.stringify([rec('//*[@id="p1"]', P1, 'alpha one', { group: 'gA' }), rec('//*[@id="p2"]', P2, 'beta two', { key: 'u', group: 'gB' })]) };
const hiddenNow = p => p.evaluate(() => window.__hl.annotationsHidden);
const icon = p => p.evaluate(() => { const d = window.__hl.toastEl.querySelector('svg path'); return d && d.getAttribute('d').slice(0, 20); });
const check = L.check;

async function toggle(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store });
  await L.altKey(p, 'v');
  check('Alt+V hides and says so', (await hiddenNow(p)) === true && (await L.toast(p)) === 'Annotations hidden · Show', await L.toast(p));
  check('with the eye on its Show button as the only icon', (await icon(p)) === 'M245.48,125.57c-.34-', await icon(p));
  await L.altKey(p, 'v');
  check('Alt+V again shows them and takes the message down, with no other message', (await hiddenNow(p)) === false && (await L.toast(p)) === null, await L.toast(p));
  await L.altKey(p, 'v');
  await p.evaluate(() => window.__hl.toastAction.click()); await p.waitForTimeout(100);
  check('Show shows them and the message goes', (await hiddenNow(p)) === false && (await L.toast(p)) === null, await L.toast(p));
  check('no page errors', p.__errors.length === 0, p.__errors);
  await ctx.close();
}

async function newAnnotation(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store });
  await L.altKey(p, 'v');
  await L.selStr(p, '#p3', 'plain words');
  await L.altKey(p, 'h');
  check('annotating while hidden shows them and takes the message down', (await hiddenNow(p)) === false && (await L.toast(p)) === null, await L.toast(p));
  await ctx.close();
}

async function removalShowsAgain(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store });
  await L.altKey(p, 'v');
  await L.selStr(p, '#p1', 'alpha one');
  await L.altKey(p, 'd');
  check('erasing while hidden: shown again, the erase offers Undo', (await hiddenNow(p)) === false && (await L.toast(p)) === '1 annotation erased · Undo', await L.toast(p));
  await L.altKey(p, 'v');
  check('hiding shows the hidden message', (await L.toast(p)) === 'Annotations hidden · Show', await L.toast(p));
  await L.altKey(p, 'z');
  check('Alt+Z still undoes, shows them, and says Undone', (await hiddenNow(p)) === false && (await L.toast(p)) === 'Undone · Redo' && (await L.wr(p)).length === 2, { t: await L.toast(p), w: await L.wr(p) });
  await ctx.close();
}

async function otherToastSurvives(browser) {
  // Shown again by Alt+V while another message has replaced the hidden one: that one stays.
  const { ctx, page: p } = await L.open(browser, { html: HTML, store });
  await L.altKey(p, 'v');
  await p.evaluate(() => { document.getSelection().removeAllRanges(); });
  await L.altKey(p, 'n');   // nothing selected, nothing pointed at: a hint
  const hint = await L.toast(p);
  await L.altKey(p, 'v');
  check('a plain hint doesn\'t replace the hidden message', hint === 'Annotations hidden · Show', hint);
  await L.altKey(p, 'v');
  await L.selStr(p, '#p2', 'beta two');
  await L.altKey(p, 'd');   // erased: Undo offered (shows them first)
  await L.altKey(p, 'v');
  await L.altKey(p, 'v');
  check('showing again leaves a message that isn\'t the hidden one', (await L.toast(p)) === null || !/hidden/.test(await L.toast(p)), await L.toast(p));
  await ctx.close();
}

async function jump(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store });
  await L.altKey(p, 'v');
  await L.altKey(p, 'j');
  await p.waitForTimeout(500);
  check('a jump shows them and takes the message down', (await hiddenNow(p)) === false && (await L.toast(p)) === null, await L.toast(p));
  await L.altKey(p, 'v');
  await L.altKey(p, 'j'); await p.waitForTimeout(500);   // to the second
  await L.altKey(p, 'v');
  await L.altKey(p, 'j'); await p.waitForTimeout(500);   // wraps to the first
  check('wrapping around while hidden still says so', (await L.toast(p)) === 'Back to the first annotation', await L.toast(p));
  await ctx.close();
}

async function empty(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store: {} });
  await L.altKey(p, 'v');
  check('Alt+V on a page without annotations: nothing', (await hiddenNow(p)) === false && (await L.toast(p)) === null, await L.toast(p));
  await ctx.close();
}

async function dark(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML.replace('<body style="', '<body style="background:#111;color:#eee;'), store, scheme: 'dark' });
  await L.altKey(p, 'v');
  check('the message follows a dark page', (await p.evaluate(() => window.__hl.toastEl.getAttribute('data-theme'))) === 'dark', null);
  await ctx.close();
}

(async () => {
  const browser = await L.launch();
  await Promise.all([toggle, newAnnotation, removalShowsAgain, otherToastSurvives, jump, empty, dark]
    .map(f => f(browser).catch(e => check(`${f.name} crashed`, false, e.stack))));
  await L.done(browser);
})();
