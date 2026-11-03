// Measures the costs of a large page: saving (getCurrentRecords, which finds every wrapper's extent) and the late watcher
// retrying while many records wait. Prints milliseconds; it checks nothing. Run: . tools/test-env.sh && node tools/perf-large-page.js
const L = require('../test/lib');
const N = +process.env.N || 300;
const para = i => `Paragraph ${i} lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor ${'x'.repeat(i % 7)} marker${i} end of text.`;
const rec = (xpath, block, text, i) => { const at = block.indexOf(text); return { xpath, startOffset: at, length: text.length, key: 'h', text, prefix: block.slice(Math.max(0, at - 24), at), suffix: block.slice(at + text.length, at + text.length + 24), group: 'g' + i }; };
(async () => {
  const b = await L.launch();
  for (const shape of ['many paragraphs', 'one huge block']) {
    const paras = Array.from({ length: N * 5 }, (_, i) => para(i));
    const html = shape === 'many paragraphs'
      ? `<!doctype html><meta charset="utf-8"><body>${paras.map((p, i) => `<p id="p${i}">${p}</p>`).join('')}`
      : `<!doctype html><meta charset="utf-8"><body><div id="big">${paras.join(' ')}</div>`;
    const recs = [];
    for (let i = 0; i < N; i++) {
      const k = i * 5, text = `marker${k}`;
      if (shape === 'many paragraphs') recs.push(rec(`//*[@id="p${k}"]`, paras[k], text, i));
      else { const full = paras.join(' '); recs.push(rec('//*[@id="big"]', full, text, i)); }
    }
    // Records of other content that never arrives: what the late watcher keeps retrying.
    const missing = Array.from({ length: +(process.env.M ?? N) }, (_, i) => ({ xpath: '//*[@id="nope"]', startOffset: 0, length: 10, key: 'h', text: `never-there-${i}`, prefix: '', suffix: '', group: 'm' + i }));
    const store = { 'https://example.test/a': JSON.stringify(recs.concat(missing)) };
    const { page } = await L.open(b, { html, store, wait: 3000 });
    const r = await page.evaluate(async () => {
      const t = performance.now(); const records = window.__hl.getCurrentRecords(); const save = performance.now() - t;
      // Late content: 60 mutation bursts 100 ms apart; the longest frame gap shows what the watcher costs the main thread.
      let worst = 0, last = performance.now(), stop = false;
      (function f() { const n = performance.now(); worst = Math.max(worst, n - last); last = n; if (!stop) requestAnimationFrame(f); })();
      const t2 = performance.now();
      for (let i = 0; i < 60; i++) { const d = document.createElement('p'); d.textContent = 'late content ' + i; document.body.appendChild(d); await new Promise(r => setTimeout(r, 100)); }
      stop = true;
      return { placed: records.length, save: +save.toFixed(1), worstFrameGap: +worst.toFixed(1), burstsMs: +(performance.now() - t2).toFixed(0) };
    });
    console.log(shape, `(${N} placed + ${N} waiting records):`, JSON.stringify(r));
  }
  await b.close();
})();
