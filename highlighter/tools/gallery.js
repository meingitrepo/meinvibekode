// Renders every UI state of the built userscript, light and dark, into one offline HTML page.
// Usage: highlighter/tools/gallery.sh [--only id,id] [--variants file.json] [--watch]   (--watch re-renders when src/ changes; output: .cache/gallery/index.html)
// HL_GALLERY_JOBS=n renders n states at once (default 4; 1 on a slow machine). HL_CPU=6 works too, as for the suites.
// variants.json: { "name": "icons", "state": "menu", "variants": [{ "label": "A", "js": "..." }] }; js runs in the page before the shot.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('../test/lib.js');
const { HTML, STORE, STATES } = require('./gallery-states.js');
const ROOT = path.resolve(__dirname, '../..');
const THEMES = ['light', 'dark'];
const PAD = 16;
const CONCURRENCY = +process.env.HL_GALLERY_JOBS || 4;   // states rendered at once

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Waits until every clipped element is shown.
async function shown(page, names) {
    const ok = await L.until(page, ns => ns.every(n => { const e = window.__hl[n]; return e && !e.hidden; }), names, 5000);
    if (!ok) throw new Error(`${names.join(' + ')} not visible`);
}

// The union box of the clipped elements plus padding, kept inside the viewport.
async function measure(page, names) {
    const r = await page.evaluate(ns => {
        const bs = ns.map(n => window.__hl[n]).filter(Boolean).map(e => e.getBoundingClientRect()).filter(b => b.width && b.height);
        if (!bs.length) return null;
        const x0 = Math.min(...bs.map(b => b.left)), y0 = Math.min(...bs.map(b => b.top));
        return { x: x0, y: y0, width: Math.max(...bs.map(b => b.right)) - x0, height: Math.max(...bs.map(b => b.bottom)) - y0 };
    }, names);
    if (!r) throw new Error(`${names.join(' + ')} has no size`);
    const x = Math.max(0, r.x - PAD), y = Math.max(0, r.y - PAD), vp = page.viewportSize();
    return { x, y, width: Math.min(vp.width - x, r.width + 2 * PAD), height: Math.min(vp.height - y, r.height + 2 * PAD) };
}

// Lets slide-ins and fades finish, so two renders of one state are the same picture.
async function settle(page, names) {
    await page.evaluate(ns => Promise.race([
        Promise.all(ns.flatMap(n => window.__hl[n] ? window.__hl[n].getAnimations({ subtree: true }) : []).map(a => a.finished.catch(() => {}))),
        new Promise(r => setTimeout(r, 2000))]), names);
    await page.waitForTimeout(100);
}

function pageHtml(tiles) {
    const ids = [...new Set(tiles.map(t => t.state))];
    const name = t => t.variant === 'baseline' ? t.theme : `${t.variant} · ${t.theme}`;
    const tile = t => t.ok
        ? `<figure><img alt="${esc(t.state)} ${esc(name(t))}" src="data:image/png;base64,${t.png.toString('base64')}"><figcaption>${esc(name(t))}</figcaption></figure>`
        : `<figure class="fail"><b>${esc(t.state)} / ${esc(name(t))}</b><br>${esc(t.error)}</figure>`;
    return `<!doctype html><html><head><meta charset="utf-8"><title>Highlighter gallery</title><style>
body{font:15px/1.4 system-ui,sans-serif;margin:24px;color:#222}h2{margin:28px 0 8px;font-size:16px}
.row{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}figure{margin:0}figcaption{color:#777;font-size:12px}
.fail{border:2px solid #b00020;padding:8px 12px;color:#b00020;max-width:360px}img{display:block;border:1px solid #ddd}
</style></head><body><h1>Highlighter gallery</h1>
${ids.map(id => `<h2>${esc(id)}</h2><div class="row">${tiles.filter(t => t.state === id).map(tile).join('')}</div>`).join('\n')}
</body></html>`;
}

// The tiles of one state: its baseline and each variant, light then dark.
async function renderState(browser, state, variants) {
    const tiles = [];
    let crop = null;   // measured on the first tile and reused, so light and dark have the same crop
    const runs = [{ label: 'baseline', js: null }].concat(variants && variants.state === state.id ? variants.variants : []);
    for (const run of runs) for (const theme of THEMES) {
        const tile = { state: state.id, theme, variant: run.label, ok: false };
        let ctx = null;
        try {
            const opened = await L.open(browser, { html: HTML, store: STORE, scheme: theme, ...state.opts });
            ctx = opened.ctx;
            await L.ensureTheme(opened.page, theme);
            await state.setup(opened.page, L);
            await shown(opened.page, state.clip);
            if (!crop) crop = await measure(opened.page, state.clip);
            // Indirect eval: the snippet may be statements (and `throw`), and runs in the page's global scope.
            if (run.js) await opened.page.evaluate(js => (0, eval)(js), run.js);
            await settle(opened.page, state.clip);
            tile.png = await opened.page.screenshot({ clip: crop });
            tile.ok = true;
        } catch (e) { tile.error = e.message; }
        finally { if (ctx) await ctx.close(); }
        tiles.push(tile);
    }
    return tiles;
}

// variants: { name, state, variants: [{ label, js }] }: that state also renders once per variant, after `js` ran in the page.
async function render({ only = null, variants = null, states = STATES, outDir = path.join(ROOT, '.cache', 'gallery') } = {}) {
    const valid = states.map(s => s.id);
    if (only) {
        const bad = only.filter(id => !valid.includes(id));
        if (bad.length) throw new Error(`unknown state: ${bad.join(', ')} (valid: ${valid.join(', ')})`);
        states = states.filter(s => only.includes(s.id));
    }
    if (variants) {
        if (!states.some(s => s.id === variants.state)) throw new Error(`variants: "${variants.state}" is not a state being rendered (${states.map(s => s.id).join(', ')})`);
        const labels = Array.isArray(variants.variants) ? variants.variants.map(v => v && v.label) : [];
        if (!labels.length) throw new Error('variants: the file lists no variants');
        if (labels.some(l => !l || l === 'baseline') || new Set(labels).size !== labels.length) throw new Error('variants: each variant needs its own label, and "baseline" is taken');
    }
    const browser = await L.launch();
    let tiles;
    try {
        // States are independent, so a few render at once; the tiles keep the states' order.
        const perState = new Array(states.length);
        let next = 0;
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, states.length) }, async () => {
            while (next < states.length) { const i = next++; perState[i] = await renderState(browser, states[i], variants); }
        }));
        tiles = perState.flat();
    } finally { await browser.close(); }
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, 'index.html');
    fs.writeFileSync(file, pageHtml(tiles));
    return { file, tiles, failed: tiles.filter(t => !t.ok).length };
}

async function main(argv) {
    try {
        const at = argv.indexOf('--only');
        const only = at < 0 ? null : (argv[at + 1] || '').split(',').filter(Boolean);
        const vat = argv.indexOf('--variants');
        if ((only && !only.length) || (vat >= 0 && !argv[vat + 1])) throw new Error('usage: gallery.sh [--only id,id] [--variants file.json] [--watch]');
        const variants = vat < 0 ? null : JSON.parse(fs.readFileSync(argv[vat + 1], 'utf8'));
        const once = async () => {
            // Like test/run.js: HL_SCRIPT means "render that build", so do not rebuild.
            if (!process.env.HL_SCRIPT) execFileSync(process.execPath, [path.join(__dirname, '..', 'build.js')], { stdio: 'inherit' });
            const r = await render({ only, variants });
            console.log(`wrote ${r.file} (${r.tiles.length} tiles, ${r.failed} failed)`);
            r.tiles.filter(t => !t.ok).forEach(t => console.log(`FAIL ${t.state} / ${t.variant} / ${t.theme}: ${t.error}`));
            return r;
        };
        if (argv.includes('--watch')) {
            await once();
            watch(path.join(__dirname, '..', 'src'), () => once(), 300);
            console.log('watching highlighter/src; Ctrl+C to stop');
            return;
        }
        process.exit((await once()).failed ? 1 : 0);
    } catch (e) { console.error(e.message); process.exit(1); }
}

// Calls run() once after a burst of changes in dir (debounced by ms). Runs never overlap: a change made during
// a run schedules exactly one more. A failing run is reported and the watcher keeps going.
function watch(dir, run, ms = 300) {
    let timer = null, running = false, again = false;
    const go = async () => {
        if (running) { again = true; return; }
        running = true;
        try { await run(); } catch (e) { console.error(e.message); }
        running = false;
        if (again) { again = false; go(); }
    };
    const w = fs.watch(dir, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(go, ms); });
    return { close() { clearTimeout(timer); w.close(); } };
}

module.exports = { render, watch, main };
if (require.main === module) main(process.argv.slice(2));
