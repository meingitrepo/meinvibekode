// Per-site settings live in one stored value for every site. A value this version cannot parse is never
// overwritten (it may hold other sites' switches); a value that parses to something that is not an object holds
// none of ours and is replaced; a switch is saved on top of what the store holds at that moment.
const L = require('./lib');
const HTML = '<!doctype html><html><head><meta charset="utf-8"></head><body style="font:18px/1.6 serif;margin:40px"><p id="p">Alpha bravo charlie delta echo foxtrot.</p></body></html>';
const KEY = 'rnh:settings';

const toggleKeys = async p => { await L.altKey(p, 'KeyK', true); await p.waitForTimeout(200); };
const raw = p => p.evaluate(k => window.__gm[k], KEY);

(async () => {
  const browser = await L.launch();
  const tab = async seed => (await L.open(browser, { html: HTML, defaults: true, menu: true, store: { [KEY]: seed } })).page;

  {
    const p = await tab('{"keysOnSites":["example.test"],"other');   // cut off mid-write
    await toggleKeys(p);
    L.check('an unparseable settings value is kept as it is, not replaced', (await raw(p)) === '{"keysOnSites":["example.test"],"other', await raw(p));
    await p.context().close();
  }
  {
    const p = await tab('["example.test"]');
    await toggleKeys(p);
    const s = JSON.parse(await raw(p));
    L.check('a settings value that is an array is replaced by an object and the switch is saved', s && !Array.isArray(s) && Array.isArray(s.keysOnSites) && s.keysOnSites.includes('example.test'), s);
    await p.context().close();
  }
  {
    const p = await tab(JSON.stringify({ keysOnSites: [], toolbarOnSites: ['a.test'], menuHiddenSites: ['example.test'] }));
    // another tab saved a setting after this one last read; the switch here is saved on top of it
    await p.evaluate(k => window.__deliver(k, window.__gm[k], JSON.stringify({ keysOnSites: [], toolbarOnSites: ['a.test'], menuHiddenSites: ['example.test'], menuPos: { x: 1, y: 2 } }), true), KEY);
    await toggleKeys(p);
    const s = JSON.parse(await raw(p));
    L.check('a switch keeps what another tab saved just before', s.keysOnSites.includes('example.test') && s.menuPos && s.menuPos.x === 1 && s.toolbarOnSites[0] === 'a.test', s);
    await p.context().close();
  }
  await L.done(browser);
})();
