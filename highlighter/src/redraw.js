    // =====================================================================
    // Following the text: measuring, redrawing what moved
    // =====================================================================

    function measureRects(wrapper) {
        const list = wrapper.getClientRects();
        if (!list.length) return null;
        return Array.from(list).map(r => ({
            left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height
        }));
    }

    function snapshotRect(wrapper) {
        const rects = measureRects(wrapper);
        if (rects) rectCache.set(wrapper, rects);
    }

    function rectChanged(wrapper) {
        return rectsDiffer(measureRects(wrapper), rectCache.get(wrapper));
    }

    // Did the text of a wrapper that is shown (has boxes) move since it was last drawn?
    function textMoved(wrapper) {
        const now = measureRects(wrapper);
        return !!now && rectsDiffer(now, rectCache.get(wrapper));
    }

    function rectsDiffer(now, before) {
        if (!now || !before || now.length !== before.length) return true;
        const TOL = 1;
        return now.some((r, i) =>
            Math.abs(r.left - before[i].left) > TOL || Math.abs(r.top - before[i].top) > TOL ||
            Math.abs(r.width - before[i].width) > TOL || Math.abs(r.height - before[i].height) > TOL);
    }

    // Redraws in place: keeps the SVG elements (the selected part is marked again after) and never animates.
    // All are measured before any is drawn (see drawAnnotations).
    function reposition(wrappers) {
        const ws = wrappers.filter(w => annotationMap.has(w));
        if (!ws.length) return;
        drawAnnotations(ws.map(w => annotationMap.get(w)));
        ws.forEach(snapshotRect);
        if (selectedSVGs.size) updateSelectionVisibility();
    }

    // The wrappers shown on the page (see showWrappers), and those of them on or near the screen
    // as the observer last saw them: when the page moves, only those near the screen are looked
    // at in the same frame, and the page isn't searched for wrappers.
    const shownWrappers = new Set();
    const nearWrappers = new Set();
    const visibilityObserver = new IntersectionObserver(entries => {
        // Also while the script is off: a wrapper the site puts back then is followed once it is on.
        entries.forEach(e => {
            if (!e.isIntersecting) { nearWrappers.delete(e.target); return; }
            if (!annotationMap.has(e.target)) return;   // unwrapped since
            nearWrappers.add(e.target);
            shownWrappers.add(e.target);   // back on the page after the site took it off
        });
        if (running) reposition(entries.filter(e => e.isIntersecting && rectChanged(e.target)).map(e => e.target));
    }, { rootMargin: '200px', threshold: 0 });

    // A wrapper already on the page kept as a restored annotation (see absorbDuplicate), for
    // instance a kept tab panel put back out of view: followed again, and seen afresh by the observer.
    function trackShown(w) {
        if (shownWrappers.has(w) || !annotationMap.has(w)) return;
        shownWrappers.add(w);
        snapshotRect(w);
        visibilityObserver.unobserve(w);
        visibilityObserver.observe(w);
    }

    // Lets go of the wrappers the site took off the page (also every second, so a page that keeps
    // re-rendering doesn't keep the old ones alive); one it puts back is added again when the
    // observer sees it.
    function pruneShown() {
        shownWrappers.forEach(w => { if (!w.isConnected) { shownWrappers.delete(w); nearWrappers.delete(w); } });
    }

    // Redraws the annotations whose text moved: of those near the screen as the observer last saw
    // them ('near'), of those on or near it now ('view': after a resize, whose reflow can bring
    // others into view before the observer has seen them), or of all ('all').
    function redrawMoved(scope) {
        const margin = 200;
        const inView = w => { const r = w.getBoundingClientRect(); return r.bottom >= -margin && r.top <= window.innerHeight + margin; };
        let ws;
        if (scope === 'near') {
            ws = Array.from(nearWrappers);
        } else {
            pruneShown();
            ws = Array.from(shownWrappers);
            if (scope === 'view') ws = ws.filter(inView);
        }
        reposition(ws.filter(w => w.isConnected && textMoved(w)));
    }

    // While the window is resized or zoomed, or the page grows or shifts, the annotations on or
    // near the screen follow their text in the same frame; the rest are looked at once it has
    // been still for 150 ms, and at most once a second while it keeps changing (a live feed, a
    // chat). The ones that come into view are redrawn by visibilityObserver if they moved.
    let redrawTimer = null;
    let redrawFrame = 0;
    let lastFullRedraw = -Infinity;
    let redrawResized = false;
    const FULL_REDRAW_GAP_MS = 1000;
    // `e` is the window's resize event when that is what calls it. With `nearOnly` (the site
    // changed a style or class, see watchPageStyle) only those near the screen are looked at:
    // the others are redrawn by visibilityObserver if they moved, once they come near.
    function scheduleRedraw(e, nearOnly) {
        if (!shownWrappers.size) return;   // nothing on the page: nothing to do, however big the page
        if (e && e.type === 'resize') redrawResized = true;
        if (!redrawFrame) {
            redrawFrame = requestAnimationFrame(() => {
                redrawFrame = 0;
                const scope = redrawResized ? 'view' : 'near';
                redrawResized = false;
                redrawMoved(scope);
            });
        }
        if (nearOnly === true) return;
        clearTimeout(redrawTimer);
        const wait = Math.max(150, lastFullRedraw + FULL_REDRAW_GAP_MS - performance.now());
        redrawTimer = setTimeout(() => { lastFullRedraw = performance.now(); redrawMoved('all'); }, wait);
    }

    // The site's own settings (a bigger font, more padding, another theme) restyle the page
    // without resizing it: a style or class set on any element, or a stylesheet added, changed
    // or removed. The annotations near the screen then follow their text in the next frame.
    // Changes on our own drawings (SVG) and wrappers are left out.
    function watchPageStyle() {
        const ours = n => n instanceof SVGElement || (n.matches && n.matches(WRAPPER_SELECTOR));
        const sheet = n => n.nodeName === 'STYLE' || n.nodeName === 'LINK';
        const mo = new MutationObserver(list => {
            let hit = false;
            for (const m of list) {
                if (m.type === 'attributes') { if (!ours(m.target)) hit = true; continue; }
                m.addedNodes.forEach(n => { if (n.nodeName === 'LINK') n.addEventListener('load', () => scheduleRedraw(null, true), { once: true }); });
                if (m.type === 'characterData' || sheet(m.target) || Array.from(m.addedNodes).some(sheet) || Array.from(m.removedNodes).some(sheet)) hit = true;
            }
            if (hit) scheduleRedraw(null, true);
        });
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'], subtree: true });
        if (document.head) mo.observe(document.head, { childList: true, characterData: true, subtree: true });
        return () => mo.disconnect();
    }
