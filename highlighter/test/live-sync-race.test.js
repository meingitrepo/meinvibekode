// Two tabs change the same page before either has received the other's change (Violentmonkey tells a tab about a
// remote change within a few milliseconds, and reports its own cached value as the old one). Whatever the order,
// both tabs and the store must end up the same, with nothing lost that was not deleted or out-edited by a later change.
const L = require('./lib');
const TEXT = 'Alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa.';
const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font:18px/1.6 serif;margin:40px"><p id="p">${TEXT}</p></body></html>`;
const SEED = (() => {
  const at = TEXT.indexOf('echo foxtrot');
  return JSON.stringify([{ xpath: '//*[@id="p"]', startOffset: at, length: 12, key: 'h', text: 'echo foxtrot', prefix: TEXT.slice(at - 24, at), suffix: TEXT.slice(at + 12, at + 36), group: 'gSeed', added: 1700000000000 }]);
})();
const URL_KEY = 'https://example.test/a';

// Opens two tabs on one store. While `held`, a tab's changes queue up instead of reaching the other tab;
// release() delivers them in the order they were made, like the background does.
async function twoTabs(browser) {
  const pages = [];
  const queue = [];
  const central = { value: SEED };
  let held = true;
  const deliver = (from, k, o, v) => Promise.all(pages.filter(p => p !== from).map(p => p.evaluate(([k, o, v]) => window.__deliver(k, o, v === null ? undefined : v, true), [k, o, v]).catch(() => {})));
  const onSend = (from, k, o, v) => {
    if (k === URL_KEY) central.value = v;
    return held ? queue.push({ from, k, o, v }) : deliver(from, k, o, v);
  };
  const open = async () => {
    const { page } = await L.open(browser, { html: HTML, store: { [URL_KEY]: SEED }, onSend, init: () => { window.__oldFromReceiver = true; } });
    pages.push(page);
    return page;
  };
  const A = await open();
  const B = await open();
  // First in, first out: what a tab saves in answer to a delivery joins the back of the queue, as the background
  // broadcasts changes in the order it received them, so a fresh change never overtakes an older one.
  const release = async () => {
    while (queue.length) {
      const m = queue.shift();
      await deliver(m.from, m.k, m.o, m.v);
      await A.waitForTimeout(60);
    }
    held = false;
    await A.waitForTimeout(900);
  };
  return { A, B, central, release, hold: () => { held = true; } };
}

const click = async (page, text) => {
  const pt = await page.evaluate(t => { const w = window.__hl.allWrappers().find(w => w.textContent === t); const r = w.getClientRects()[0]; return { x: r.left + 4, y: r.top + r.height / 2 }; }, text);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(120);
};
const add = async (page, text, key) => { await L.selStr(page, '#p', text); await L.altKey(page, key); };
const del = async (page, text) => { await click(page, text); await L.altKey(page, 'd'); };
const note = async (page, text, value) => {
  await click(page, text); await page.keyboard.press('KeyN'); await page.waitForTimeout(150);
  await page.keyboard.type(value); await page.evaluate(() => window.__hl.saveEditor()); await page.waitForTimeout(150);
};
const view = async page => (await L.wr(page)).map(w => w.t + (w.n ? '=' + w.n : '')).sort().join('|');
const storedView = value => JSON.parse(value || '[]').filter(r => r && r.text).map(r => r.text + (r.note ? '=' + r.note : '')).sort().join('|');

async function scenario(browser, name, order, act, expected) {
  const { A, B, central, release } = await twoTabs(browser);
  const who = { A, B };
  for (const t of order) await act[t](who[t]);
  await release();
  const got = { a: await view(A), b: await view(B), store: storedView(central.value) };
  L.check(`${name} (${order.join(' then ')}): both tabs and the store agree on ${expected || 'nothing'}`,
    got.a === expected && got.b === expected && got.store === expected, got);
  for (const p of [A, B]) if (p.__errors.length) L.check(`${name}: no page errors`, false, p.__errors);
  await A.context().close();
}

(async () => {
  const browser = await L.launch();
  const jobs = [];
  for (const order of [['A', 'B'], ['B', 'A']]) {
    jobs.push(() => scenario(browser, 'add and add', order,
      { A: p => add(p, 'bravo', 'KeyH'), B: p => add(p, 'kilo lima', 'KeyU') },
      'bravo|echo foxtrot|kilo lima'));
    jobs.push(() => scenario(browser, 'one adds, the other adds twice', order,
      { A: p => add(p, 'bravo', 'KeyH'), B: async p => { await add(p, 'kilo', 'KeyU'); await add(p, 'oscar', 'KeyS'); } },
      'bravo|echo foxtrot|kilo|oscar'));
    jobs.push(() => scenario(browser, 'delete and delete', order,
      { A: p => del(p, 'echo foxtrot'), B: p => del(p, 'echo foxtrot') },
      ''));
    // The later change wins, in both tabs: the note after the delete keeps the annotation, the delete after the note removes it.
    jobs.push(() => scenario(browser, 'delete and note', order,
      { A: p => del(p, 'echo foxtrot'), B: p => note(p, 'echo foxtrot', 'kept') },
      order[0] === 'A' ? 'echo foxtrot=kept' : ''));
    jobs.push(() => scenario(browser, 'note and note', order,
      { A: p => note(p, 'echo foxtrot', 'from A'), B: p => note(p, 'echo foxtrot', 'from B') },
      order[1] === 'B' ? 'echo foxtrot=from B' : 'echo foxtrot=from A'));
  }
  await Promise.all(jobs.map(j => j().catch(e => L.check('scenario crashed', false, String(e && e.stack || e)))));

  // Not concurrent: A makes one, B (which has received it) deletes it. It must stay deleted in both.
  {
    const { A, B, central, release } = await twoTabs(browser);
    await add(A, 'bravo', 'KeyH');
    await release();
    await del(B, 'bravo');
    await release();
    const got = { a: await view(A), b: await view(B), store: storedView(central.value) };
    L.check('made in A, deleted in B: stays deleted in both and in the store', got.a === 'echo foxtrot' && got.b === 'echo foxtrot' && got.store === 'echo foxtrot', got);
    await A.context().close();
  }
  // Not concurrent either: a delete that is undone comes back in both tabs and stays; Clear this page empties both, and what is made after survives.
  {
    const { A, B, release } = await twoTabs(browser);
    await release();
    await del(A, 'echo foxtrot');
    await A.waitForTimeout(500);
    L.check('a delete in A shows in B', (await view(B)) === '', await view(B));
    await L.altKey(A, 'z');
    await A.waitForTimeout(900);
    L.check('undoing it brings it back in both tabs', (await view(A)) === 'echo foxtrot' && (await view(B)) === 'echo foxtrot', [await view(A), await view(B)]);
    await add(B, 'kilo lima', 'KeyU');
    await B.waitForTimeout(900);
    L.check('a later save in B keeps it', (await view(A)) === 'echo foxtrot|kilo lima' && (await view(B)) === 'echo foxtrot|kilo lima', [await view(A), await view(B)]);
    await A.evaluate(() => Object.keys(window.__menu).forEach(k => { if (/^Clear .*this page/i.test(k)) window.__menu[k](); }));
    await A.waitForTimeout(900);
    L.check('Clear this page in A empties B too', (await view(A)) === '' && (await view(B)) === '', [await view(A), await view(B)]);
    await add(B, 'oscar papa', 'KeyS');
    await B.waitForTimeout(900);
    L.check('what B makes after the clear shows in A and stays', (await view(A)) === 'oscar papa' && (await view(B)) === 'oscar papa', [await view(A), await view(B)]);
    await A.context().close();
  }
  await L.done(browser);
})();
