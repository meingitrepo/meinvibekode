// Measures each PHOSPHOR_ICONS glyph as drawn (ink bounding box, centre, area) and suggests the scale
// and shift that make them match a reference optically. Prints suggestions only; src/ is not touched.
// Usage: . tools/test-env.sh; node tools/icon-optics.js [--ref <icon-name>] [--json]
// Extent is sqrt(w*h) of the ink box, not the viewBox: icons share a 256 grid but fill it differently.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui-style.js'), 'utf8');
const table = src.slice(src.indexOf('const PHOSPHOR_ICONS = {'), src.indexOf('};', src.indexOf('const PHOSPHOR_ICONS = {')));
const icons = {};
for (const m of table.matchAll(/'([a-z-]+)':\s*'([^']+)'/g)) icons[m[1]] = m[2];

const refArg = process.argv.indexOf('--ref');
const refName = refArg > 0 ? process.argv[refArg + 1] : null;

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    // 2x canvas so thin 12-unit strokes still land on whole pixels; alpha > 127 counts as ink
    const stats = await page.evaluate((icons) => {
        const S = 2, N = 256 * S, out = {};
        const cv = document.createElement('canvas');
        cv.width = cv.height = N;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        for (const [name, d] of Object.entries(icons)) {
            ctx.clearRect(0, 0, N, N);
            ctx.save();
            ctx.scale(S, S);
            ctx.fill(new Path2D(d));   // nonzero rule, same as an SVG path's default
            ctx.restore();
            const px = ctx.getImageData(0, 0, N, N).data;
            let x0 = N, y0 = N, x1 = -1, y1 = -1, area = 0, sx = 0, sy = 0;
            for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
                if (px[(y * N + x) * 4 + 3] < 128) continue;
                area++; sx += x; sy += y;
                if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
            }
            const w = (x1 - x0 + 1) / S, h = (y1 - y0 + 1) / S;
            out[name] = { w, h, bx: (x0 + x1 + 1) / 2 / S, by: (y0 + y1 + 1) / 2 / S, cx: sx / area / S, cy: sy / area / S, area: area / (S * S) };
        }
        return out;
    }, icons);
    await browser.close();

    const names = Object.keys(stats);
    for (const n of names) stats[n].ext = Math.sqrt(stats[n].w * stats[n].h);
    const sorted = names.map(n => stats[n].ext).sort((a, b) => a - b);
    const ref = refName ? stats[refName] : { ext: sorted[Math.floor(sorted.length / 2)] };
    if (!ref) { console.error(`unknown icon: ${refName}`); process.exit(1); }

    const rows = names.map(n => {
        const s = stats[n];
        return {
            name: n, w: +s.w.toFixed(1), h: +s.h.toFixed(1), extent: +s.ext.toFixed(1),
            scale: +(ref.ext / s.ext).toFixed(3),
            // shift to put the ink box centre on 128,128 after scaling (in 256-grid units, about the centre)
            dx: +(128 - s.bx).toFixed(1), dy: +(128 - s.by).toFixed(1),
            ink: +(s.area / (s.w * s.h)).toFixed(2)
        };
    });
    if (process.argv.includes('--json')) { console.log(JSON.stringify(rows, null, 1)); return; }
    console.log(`reference extent ${ref.ext.toFixed(1)}${refName ? ` (${refName})` : ' (median)'}; scale <1 = icon reads large, >1 = reads small`);
    console.log('name'.padEnd(24) + 'w'.padStart(7) + 'h'.padStart(7) + 'extent'.padStart(8) + 'scale'.padStart(8) + 'dx'.padStart(7) + 'dy'.padStart(7) + 'ink'.padStart(6));
    for (const r of rows) console.log(r.name.padEnd(24) + String(r.w).padStart(7) + String(r.h).padStart(7) + String(r.extent).padStart(8) + String(r.scale).padStart(8) + String(r.dx).padStart(7) + String(r.dy).padStart(7) + String(r.ink).padStart(6));
})();
