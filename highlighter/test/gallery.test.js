// tools/gallery.js: every UI state of the built script, light and dark, in one offline HTML page.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const L = require('./lib');
const GALLERY = path.resolve(__dirname, '../tools/gallery.js');
const { render } = require(GALLERY);
const { STATES } = require('../tools/gallery-states.js');
const check = L.check;
const pngSize = b => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-'));
const toastState = STATES.find(s => s.id === 'toast');

(async () => {
  const one = await render({ only: ['toast'], outDir: path.join(tmp, 'one') });
  const [light, dark] = one.tiles;
  check('renders the toast state in light and dark', one.tiles.length === 2 && light.theme === 'light' && dark.theme === 'dark'
    && one.tiles.every(t => t.ok && t.png.length > 0), one.tiles.map(t => [t.theme, t.ok, t.error]));
  check('light and dark tiles share one crop size', JSON.stringify(pngSize(light.png)) === JSON.stringify(pngSize(dark.png)), [pngSize(light.png), pngSize(dark.png)]);
  check('light and dark tiles differ', !light.png.equals(dark.png), null);
  const html = fs.readFileSync(one.file, 'utf8');
  check('index.html has one img per tile and no external urls', (html.match(/<img/g) || []).length === one.tiles.length && !/src="(http|file)/.test(html), html.length);

  const bad = await render({ states: [toastState, { id: 'broken', setup: async () => { throw new Error('boom'); }, clip: ['toastEl'] }], outDir: path.join(tmp, 'bad') });
  const broken = bad.tiles.filter(t => t.state === 'broken');
  const badHtml = fs.readFileSync(bad.file, 'utf8');
  check('a state whose setup throws is a failed, named tile', broken.length === 2 && broken.every(t => !t.ok && /boom/.test(t.error))
    && /broken/.test(badHtml) && /boom/.test(badHtml) && bad.tiles.filter(t => t.state === 'toast').every(t => t.ok) && bad.failed === 2, bad.tiles.map(t => [t.state, t.ok, t.error]));

  const unknown = await render({ only: ['nope'], outDir: path.join(tmp, 'unknown') }).then(() => null, e => e.message);
  check('--only with an unknown id throws and lists valid ids', !!unknown && /nope/.test(unknown) && /toast/.test(unknown), unknown);
  check('an unknown --only id writes nothing', !fs.existsSync(path.join(tmp, 'unknown', 'index.html')), null);
  const cli = spawnSync(process.execPath, [GALLERY, '--only', 'nope'], { env: { ...process.env, HL_SCRIPT: path.resolve(__dirname, '../Highlighter.user.js') }, encoding: 'utf8' });
  check('the CLI exits 1 for an unknown --only id', cli.status === 1, [cli.status, cli.stderr]);

  const deep = await render({ only: ['toast'], outDir: path.join(tmp, 'a', 'b') });
  check('a missing outDir is created', fs.existsSync(deep.file), deep.file);

  const IDS = ['toast', 'toolbar', 'toolbar-tooltip', 'panel', 'panel-ticked', 'note-card', 'editor', 'menu', 'search', 'help'];
  const all = await render({ outDir: path.join(tmp, 'all') });
  const ids = [...new Set(all.tiles.map(t => t.state))];
  check('the default gallery has the ten state ids in order', JSON.stringify(ids) === JSON.stringify(IDS), ids);
  check('every default state renders in both themes', all.failed === 0 && all.tiles.length === 20, all.tiles.filter(t => !t.ok).map(t => [t.state, t.theme, t.error]));
  const okTiles = all.tiles.filter(t => t.ok);
  check('no tile is tiny', okTiles.every(t => pngSize(t.png).w > 40 && pngSize(t.png).h > 20), okTiles.map(t => [t.state, t.theme, pngSize(t.png)]));
  check("each state's light and dark tiles differ", IDS.every(id => { const [a, b] = all.tiles.filter(t => t.state === id); return a && b && a.ok && b.ok && !a.png.equals(b.png); }), null);

  const spec = variants => ({ name: 'v', state: 'toast', variants });
  const vr = await render({ only: ['toast'], outDir: path.join(tmp, 'v'), variants: spec([{ label: 'A', js: '0' }, { label: 'B', js: "__hl.toastEl.style.outline = '4px solid red'" }]) });
  const by = (r, v, theme = 'light') => r.tiles.find(t => t.variant === v && t.theme === theme);
  check('variants add baseline plus one tile per label, per theme', vr.tiles.length === 6 && vr.tiles.filter(t => t.theme === 'light').map(t => t.variant).join() === 'baseline,A,B', vr.tiles.map(t => [t.variant, t.theme]));
  check('a no-op variant equals baseline byte for byte', ['light', 'dark'].every(th => by(vr, 'A', th).ok && by(vr, 'A', th).png.equals(by(vr, 'baseline', th).png)), vr.tiles.map(t => [t.variant, t.theme, t.ok, t.error]));
  check('a visible variant differs from baseline', !by(vr, 'B').png.equals(by(vr, 'baseline').png), null);
  check('a variant tile has the baseline crop size', JSON.stringify(pngSize(by(vr, 'B').png)) === JSON.stringify(pngSize(by(vr, 'baseline').png)), null);
  const vbad = await render({ only: ['toast'], outDir: path.join(tmp, 'vbad'), variants: spec([{ label: 'X', js: 'throw new Error("variant-boom")' }]) });
  check('a throwing variant fails only its own tiles', vbad.tiles.length === 4 && vbad.failed === 2 && vbad.tiles.filter(t => !t.ok).every(t => t.variant === 'X' && /variant-boom/.test(t.error))
    && by(vbad, 'baseline').ok && /variant-boom/.test(fs.readFileSync(vbad.file, 'utf8')), vbad.tiles.map(t => [t.variant, t.theme, t.ok, t.error]));
  for (const [name, bad] of [['an unknown state', { name: 'v', state: 'nope', variants: [{ label: 'A', js: '0' }] }], ['an empty variants list', spec([])], ['a state that --only leaves out', { name: 'v', state: 'panel', variants: [{ label: 'A', js: '0' }] }]]) {
    const dir = path.join(tmp, 'vrej-' + name.replace(/\W/g, ''));
    const err = await render({ only: ['toast'], outDir: dir, variants: bad }).then(() => null, e => e.message);
    check(`a variants file with ${name} is rejected and writes nothing`, !!err && /variants/.test(err) && !fs.existsSync(path.join(dir, 'index.html')), err);
  }

  const { watch } = require(GALLERY);
  const wdir = fs.mkdtempSync(path.join(tmp, 'w-'));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let calls = 0;
  const w1 = watch(wdir, async () => { calls++; }, 100);
  await sleep(200);
  fs.writeFileSync(path.join(wdir, 'a.js'), '1'); await sleep(20); fs.writeFileSync(path.join(wdir, 'b.js'), '2');
  await sleep(800); w1.close();
  check('watch runs once for a burst of changes', calls === 1, calls);
  let active = 0, maxActive = 0, runs = 0;
  const w2 = watch(wdir, async () => { runs++; active++; maxActive = Math.max(maxActive, active); await sleep(400); active--; }, 100);
  await sleep(200);
  fs.writeFileSync(path.join(wdir, 'c.js'), '3'); await sleep(250);   // the run has started
  fs.writeFileSync(path.join(wdir, 'd.js'), '4'); await sleep(1500); w2.close();
  check('watch does not overlap runs, and runs again for a change made during one', runs === 2 && maxActive === 1, { runs, maxActive });

  fs.rmSync(tmp, { recursive: true, force: true });
  await L.done();
})();
