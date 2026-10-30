    // =====================================================================
    // Wrapper bookkeeping: SVG access, selection-aware coloring, layout tracking
    // =====================================================================

    function allWrappers() {
        return Array.from(document.querySelectorAll(WRAPPER_SELECTOR));
    }

    // Goes up whenever the script adds or removes a wrapper, so what was found by searching the
    // page for them can be kept until it does (see followSelectBoxes).
    let wrapperEpoch = 0;

    function getSvg(wrapper) {
        const ann = annotationMap.get(wrapper);
        return ann && ann.svg && ann.svg.isConnected ? ann.svg : null;
    }

    // Where a selection crosses an underline or strike-through, that part of the line turns the
    // selected text's color (white, usually), like the text it belongs to. The line is masked
    // out over the selected text (and the width of the line around it), and a copy in that
    // color is drawn clipped to the selection.
    // A highlight's color would show through a see-through selection, mixed differently for each
    // color. So it is masked out there too, and instead the selected part gets the same mark in
    // every color: a thin outline in the selected text's color, in a second SVG over the text.
    // The boxes of the text in a range. Not the range's own getClientRects: that also gives the
    // box of every element wholly inside it, such as the drawing of a highlight that shares the
    // text (see bandOf, makeAnnotation), which would leave a hole in the mark.
    function textRects(range) {
        const root = range.commonAncestorContainer;
        const out = [];
        const add = node => {
            const r = document.createRange();
            r.selectNodeContents(node);
            if (node === range.startContainer) r.setStart(node, range.startOffset);
            if (node === range.endContainer) r.setEnd(node, range.endOffset);
            Array.from(r.getClientRects()).forEach(b => { if (b.width && b.height) out.push(b); });
            dropRange(r);
        };
        if (root.nodeType === Node.TEXT_NODE) { add(root); return out; }
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
            if (range.intersectsNode(n) && n.nodeValue) add(n);
        }
        return out;
    }

    let selectionMarkCount = 0;
    // wrapper -> what marks its selected part: { svg, nodes (added to the svg), paths (given a
    // mask), overlay, shape (where the part was, in the drawing), whole (all of it selected) }.
    // While a selection is dragged, only the annotations whose selected part changed are marked
    // again, not every one in the selection each frame.
    const selectionMarks = new Map();

    // What markSelected needs to know about the selected part of one annotation. Every
    // annotation in the selection is measured before any is marked, so the page is laid out
    // once, not once per annotation (marking changes the page).
    function measureSelected(wrapper, range) {
        const svg = getSvg(wrapper);
        if (!svg) return null;
        const part = document.createRange();
        part.selectNodeContents(wrapper);
        if (range.compareBoundaryPoints(Range.START_TO_START, part) > 0) part.setStart(range.startContainer, range.startOffset);
        if (range.compareBoundaryPoints(Range.END_TO_END, part) < 0) part.setEnd(range.endContainer, range.endOffset);
        let area = null;   // the drawing's own extent, in its user space
        try { area = svg.getBBox(); } catch (e) { /* not rendered */ }
        const rects = textRects(part);
        dropRange(part);
        const o = svg.getBoundingClientRect();
        const round = n => Math.round(n * 10) / 10;
        const shape = rects.map(r => [r.left - o.left, r.top - o.top, r.width, r.height].map(round).join(',')).join(' ') +
            (area ? `|${[area.x, area.y, area.width, area.height].map(round).join(',')}` : '');
        return { svg, wrapper, rects, o, area, shape };
    }

    // Is all of the wrapper's text in the range?
    function rangeHoldsWrapper(range, wrapper) {
        try {
            return range.comparePoint(wrapper, 0) === 0 && range.comparePoint(wrapper, wrapper.childNodes.length) === 0;
        } catch (e) {
            return false;
        }
    }

    // Returns what it added (see selectionMarks), or null.
    function markSelected({ svg, wrapper, rects, o, area }) {
        const paths = Array.from(svg.children).filter(el => el.tagName.toLowerCase() === 'path');
        if (!rects.length || !paths.length) return null;
        const config = annotationMap.get(wrapper).config;
        const width = config.strokeWidth;
        const n = ++selectionMarkCount;
        const box = (r, grow) => ({ x: r.left - o.left, y: r.top - o.top - grow, width: r.width, height: r.height + 2 * grow });
        const g = svgEl('g', { [SELECTED_ATTR]: '' });
        const clip = svgEl('clipPath', { id: `highlighter-selected-${n}`, clipPathUnits: 'userSpaceOnUse' });
        rects.forEach(r => clip.appendChild(svgEl('rect', box(r, 0))));
        const copies = svgEl('g', { 'clip-path': `url(#highlighter-selected-${n})` });   // lines only
        paths.forEach(p => {
            const copy = p.cloneNode(false);
            copy.removeAttribute('style');   // no draw-in animation
            copies.appendChild(copy);
        });
        g.append(clip, copies);
        const highlight = config.type === 'highlight';
        // The mask covers only the drawing (with its strokes, which getBBox leaves out: a
        // highlight's is as thick as its line): the browser paints a mask over its whole region,
        // and a page-sized one made every move of a selection over a big annotation slow.
        const pad = Math.max(width, ...paths.map(p => +p.getAttribute('stroke-width') || 0)) + 2;
        const region = area && area.width + area.height > 0
            ? { x: area.x - pad, y: area.y - pad, width: area.width + 2 * pad, height: area.height + 2 * pad }
            : { x: -1e5, y: -1e5, width: 2e5, height: 2e5 };
        const mask = svgEl('mask', { id: `highlighter-unselected-${n}`, maskUnits: 'userSpaceOnUse', ...region });
        mask.appendChild(svgEl('rect', { ...region, fill: '#fff' }));
        rects.forEach(r => mask.appendChild(svgEl('rect', { ...box(r, highlight ? 0 : width + 1), fill: '#000' })));
        paths.forEach(p => p.setAttribute('mask', `url(#highlighter-unselected-${n})`));
        selectedSVGs.add(svg);
        if (!highlight) {
            g.insertBefore(mask, g.firstChild);
            svg.appendChild(g);
            return { svg, nodes: [g], paths, overlay: null };
        }
        const holder = svg.appendChild(svgEl('g', { [SELECTED_ATTR]: '' }));
        holder.appendChild(mask);
        // Same place and containing block as the drawing: the wrapper is positioned itself.
        const overlay = svgEl('svg', { class: 'highlighter-annotation', [SELECTED_ATTR]: '' });
        overlay.style.cssText = svg.style.cssText;
        rects.forEach(r => {
            const b = box(r, -0.5);
            overlay.appendChild(svgEl('rect', { x: b.x + 0.5, y: b.y, width: Math.max(0, b.width - 1), height: Math.max(0, b.height), fill: 'none' }));
        });
        wrapper.insertAdjacentElement('afterend', overlay);
        return { svg, nodes: [holder], paths, overlay };
    }

    function unmarkOne(mark) {
        mark.nodes.forEach(n => n.remove());
        mark.paths.forEach(p => p.removeAttribute('mask'));
        if (mark.overlay) mark.overlay.remove();
        selectedSVGs.delete(mark.svg);
    }

    // A click on the page usually clears the selection, but the browser may paint that before
    // selectionchange arrives: unmarked on the press, marked again on release if it stayed.
    function onSelectionPress(e) {
        if (e.button !== 0 || !selectedSVGs.size || e.target === uiHost) return;
        unmarkSelected();
    }

    function unmarkSelected() {
        selectionMarks.forEach(unmarkOne);
        selectionMarks.clear();
        selectedSVGs.forEach(svg => {
            svg.querySelectorAll(`g[${SELECTED_ATTR}]`).forEach(g => g.remove());
            svg.querySelectorAll('path[mask]').forEach(p => p.removeAttribute('mask'));
        });
        selectedSVGs.clear();
    }

    // The annotation wrapping this one, if any: annotations of different styles can share text
    // (a highlight and an underline, or two highlights), one wrapper inside the other.
    function outerWrapper(wrapper) {
        return wrapper.parentElement ? wrapper.parentElement.closest(WRAPPER_SELECTOR) : null;
    }

    // Wrappers that touch the range, including those that fully contain it.
    function candidateWrappers(range) {
        const set = new Set();
        const root = elementOf(range.commonAncestorContainer);
        if (!root) return [];
        for (let w = root.closest(WRAPPER_SELECTOR); w; w = outerWrapper(w)) set.add(w);
        root.querySelectorAll(WRAPPER_SELECTOR).forEach(w => set.add(w));
        return Array.from(set).filter(w => {
            try { return range.intersectsNode(w); } catch (e) { return false; }
        });
    }

    // A cleared selection is unmarked at once, so the colors come back in the frame the
    // selection disappears from; marking a growing selection waits for the next frame.
    let selectionFramePending = false;
    function updateSelectionVisibility() {
        const now = window.getSelection();
        if (!now || now.isCollapsed || now.rangeCount === 0) { if (selectedSVGs.size) unmarkSelected(); }
        if (selectionFramePending) return;
        selectionFramePending = true;
        requestAnimationFrame(() => {
            selectionFramePending = false;
            const sel = window.getSelection();
            let range = null;
            if (sel && !sel.isCollapsed && sel.rangeCount) {
                try { range = sel.getRangeAt(0); } catch (e) { /* none */ }
            }
            if (!range) { unmarkSelected(); return; }
            // Everything is measured before anything is marked or unmarked, so the page is laid
            // out once. Marks still in their drawing (a redraw takes them away) stay where the
            // selected part is as it was: all of the annotation both times, or the same boxes.
            const keep = new Set();
            const fresh = [];
            candidateWrappers(range).forEach(w => {
                const svg = getSvg(w);
                if (!svg) return;
                const mark = selectionMarks.get(w);
                const valid = mark && mark.svg === svg && mark.nodes.every(n => n.parentNode === svg);
                const whole = rangeHoldsWrapper(range, w);
                if (valid && whole && mark.whole) { keep.add(w); return; }
                const m = measureSelected(w, range);
                if (!m) return;
                m.whole = whole;
                if (valid && mark.shape === m.shape) { mark.whole = whole; keep.add(w); return; }
                fresh.push(m);
            });
            selectionMarks.forEach((mark, w) => {
                if (keep.has(w)) return;
                unmarkOne(mark);
                selectionMarks.delete(w);
            });
            fresh.forEach(m => {
                const mark = markSelected(m);
                if (mark) selectionMarks.set(m.wrapper, Object.assign(mark, { shape: m.shape, whole: m.whole }));
            });
        });
    }

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

    // Annotations inside or around one that was just wrapped, unwrapped or restyled: the inner
    // ones are placed by its box and share its lines, and highlights inside and around it pick
    // their bands by it (see bandOf), so they are drawn again once the change is done.
    const innerToRedraw = new Set();
    function redrawInner(wrapper) {
        const near = Array.from(wrapper.querySelectorAll(WRAPPER_SELECTOR));
        for (let o = outerWrapper(wrapper); o; o = outerWrapper(o)) near.push(o);
        if (!near.length) return;
        if (!innerToRedraw.size) {
            queueMicrotask(() => {
                const ws = Array.from(innerToRedraw).filter(w => w.isConnected);
                innerToRedraw.clear();
                reposition(ws);
            });
        }
        near.forEach(w => innerToRedraw.add(w));
    }

    // A wrapper inside another of the same style (after a change of style) adds nothing: it goes.
    // Its annotation and the one around it then make one annotation, as when a selection merges
    // with an annotation of its style: the restyled one keeps its identity and the other joins
    // it, all of it, notes joined, so neither loses the text they share.
    function dropNestedSameStyle(wrappers) {
        const blocks = new Set();
        const joins = new Map();   // group that joins -> restyled group it joins
        wrappers.forEach(w => {
            if (!w.isConnected) return;
            const key = w.getAttribute(STYLE_ATTR);
            const group = w.getAttribute(GROUP_ATTR);
            const doomed = [];
            const join = other => {
                const g = other.getAttribute(GROUP_ATTR);
                if (g && g !== group && !joins.has(group)) joins.set(g, group);
            };
            w.querySelectorAll(WRAPPER_SELECTOR).forEach(i => {
                if (i.getAttribute(STYLE_ATTR) === key) { doomed.push(i); join(i); }
            });
            for (let o = outerWrapper(w); o; o = outerWrapper(o)) {
                if (o.getAttribute(STYLE_ATTR) === key) { doomed.push(w); join(o); break; }
            }
            doomed.forEach(d => { blocks.add(getBlockParent(d)); unwrapWrapper(d); });
        });
        blocks.forEach(normalizeBlock);
        joins.forEach((into, from) => {
            const own = groupWrappers(into)[0];
            if (!own) return;
            const noteOf = g => (groupWrappers(g).find(w => w.hasAttribute(NOTE_ATTR)) || own).getAttribute(NOTE_ATTR) || '';
            const notes = Array.from(new Set([noteOf(into), noteOf(from)].filter(Boolean)));
            groupWrappers(from).forEach(w => {
                w.setAttribute(GROUP_ATTR, into);
                [ADDED_ATTR, PAGE_ATTR].forEach(attr => {
                    if (own.hasAttribute(attr)) w.setAttribute(attr, own.getAttribute(attr));
                    else w.removeAttribute(attr);
                });
            });
            pendingRecords.forEach(r => { if (recordOwner(r) === from) r.group = into; });
            setGroupNote(into, clipNote(notes.join('\n\n')));
        });
    }

    // Rebuild with the colors for the background behind it (and for its style, after a change of
    // style, which `animate` draws in like a new annotation).
    // With `draw` false it is only rebuilt: the caller draws it (see restyleGroups).
    function restyle(wrapper, { animate = false, draw = true } = {}) {
        const dark = darkBehind(wrapper);
        const config = getStyleConfig(wrapper.getAttribute(STYLE_ATTR), dark);
        if (!config) return;
        wrapper.toggleAttribute(DARK_ATTR, dark);
        updateInk(wrapper);
        const old = annotationMap.get(wrapper);
        const oldSvg = getSvg(wrapper);
        if (oldSvg) selectedSVGs.delete(oldSvg);
        if (old) old.remove();
        const ann = makeAnnotation(wrapper, config, animate);
        annotationMap.set(wrapper, ann);
        redrawInner(wrapper);
        if (!draw) return ann;
        drawAnnotations([ann]);
        snapshotRect(wrapper);
        updateSelectionVisibility();
        return ann;
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

    // =====================================================================
    // Wrapping and unwrapping
    // =====================================================================

    function unwrapDom(wrapper) {
        const parent = wrapper.parentNode;
        if (!parent) return null;
        while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
        parent.removeChild(wrapper);
        return parent;
    }

    function unwrapWrapper(wrapper) {
        const svg = getSvg(wrapper);
        const ann = annotationMap.get(wrapper);
        if (ann) ann.remove();
        if (svg) { selectedSVGs.delete(svg); if (svg.isConnected) svg.remove(); }
        const mark = selectionMarks.get(wrapper);
        if (mark) { unmarkOne(mark); selectionMarks.delete(wrapper); }
        annotationMap.delete(wrapper);
        rectCache.delete(wrapper);
        trackedRecords.delete(wrapper);
        visibilityObserver.unobserve(wrapper);
        shownWrappers.delete(wrapper);
        nearWrappers.delete(wrapper);
        redrawInner(wrapper);
        wrapperEpoch++;
        return unwrapDom(wrapper);
    }

    function normalizeBlock(block) {
        try { block.normalize(); } catch (e) { /* detached */ }
    }

    function unwrapMany(wrappers) {
        const blocks = new Set();
        wrappers.forEach(w => {
            const block = getBlockParent(w);
            unwrapWrapper(w);
            blocks.add(block);
        });
        blocks.forEach(normalizeBlock);
    }

    function unwrapAll() {
        unwrapMany(allWrappers());
        // Those the site took off the page stay observed: one it puts back (and an undo takes as
        // the same annotation) is added again when the observer sees it.
        shownWrappers.clear();
        nearWrappers.clear();
    }

    // True when extracting the range would not have to clone any partially selected element.
    function isCleanRange(range) {
        const root = range.commonAncestorContainer;
        if (root.nodeType === Node.TEXT_NODE) return true;
        // A boundary inside a child element, even at its very edge, makes extractContents copy
        // that element (a link, say) and leave the original behind empty.
        const edgeClean = node => node === root || (node.nodeType === Node.TEXT_NODE && node.parentNode === root);
        return edgeClean(range.startContainer) && edgeClean(range.endContainer);
    }

    // meta: { group, note, added } shared by every piece of one annotation (added: see groupTime).
    function createWrapper(range, key, meta) {
        if (!hasOwn(STYLES, key) || !range.toString().trim()) return null;
        const wrapper = document.createElement('span');
        wrapper.style.display = 'inline';
        wrapper.setAttribute(WRAPPER_ATTR, 'true');
        wrapper.setAttribute(STYLE_ATTR, key);
        wrapper.setAttribute(GROUP_ATTR, meta.group);
        if (typeof meta.note === 'string' && meta.note) wrapper.setAttribute(NOTE_ATTR, clipNote(meta.note));
        if (meta.added) wrapper.setAttribute(ADDED_ATTR, String(meta.added));
        if (typeof meta.page === 'string') wrapper.setAttribute(PAGE_ATTR, meta.page);
        try {
            wrapper.appendChild(range.extractContents());
            range.insertNode(wrapper);
            wrapperEpoch++;
            const dark = darkBehind(wrapper);
            if (dark) wrapper.setAttribute(DARK_ATTR, '');
            updateInk(wrapper);
            annotationMap.set(wrapper, makeAnnotation(wrapper, getStyleConfig(key, dark), true));
            redrawInner(wrapper);
            return wrapper;
        } catch (err) {
            console.warn(`${LOG} failed to wrap text`, err);
            annotationMap.delete(wrapper);
            unwrapDom(wrapper);
            return null;
        }
    }

    // The range's text nodes that can be wrapped in style `key`, and `breaks`: those that come
    // right after an annotation of that style, which a new wrapper must not swallow (see
    // wrapSegment). Text annotated in other styles can be: the two wrappers nest.
    function collectTextNodes(range, key) {
        const sameStyle = `${WRAPPER_SELECTOR}[${STYLE_ATTR}="${key}"]`;
        const rootNode = range.commonAncestorContainer;
        const root = rootNode.nodeType === Node.TEXT_NODE ? rootNode.parentNode : rootNode;
        const nodes = [];
        const breaks = new Set();
        let skippedAnnotation = false;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                if (node === range.startContainer && range.startOffset >= node.nodeValue.length) return NodeFilter.FILTER_REJECT;
                if (node === range.endContainer && range.endOffset <= 0) return NodeFilter.FILTER_REJECT;
                if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
                // Text that has this style already is never wrapped in it again (see renderRecords).
                const parent = node.parentElement;
                if (parent && parent.closest(IGNORED_TEXT_SELECTOR)) return NodeFilter.FILTER_REJECT;
                if (parent && parent.closest(sameStyle)) {
                    skippedAnnotation = true;
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        let n;
        while ((n = walker.nextNode())) {
            if (skippedAnnotation && nodes.length) breaks.add(n);
            skippedAnnotation = false;
            nodes.push(n);
        }
        return { nodes, breaks };
    }

    // Splits a range into per-block segments, computed up front as plain numbers so
    // wrapping one segment cannot disturb the offsets of the next.
    function planSegments(range, key) {
        const groups = [];
        let currentBlock = null;
        const { nodes: textNodes, breaks } = collectTextNodes(range, key);
        textNodes.forEach(node => {
            const block = getBlockParent(node);
            if (!groups.length || block !== currentBlock) groups.push([]);
            currentBlock = block;
            groups[groups.length - 1].push(node);
        });
        return groups.map(nodes => {
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            return {
                nodes,
                breaks,
                startOffset: first === range.startContainer ? range.startOffset : 0,
                endOffset: last === range.endContainer ? range.endOffset : last.nodeValue.length
            };
        });
    }

    function wrapSegment({ nodes, breaks, startOffset, endOffset }, key, meta) {
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const whole = document.createRange();
        whole.setStart(first, startOffset);
        whole.setEnd(last, endOffset);

        // An annotation inside the range would end up nested in the new wrapper: split around it.
        if (!nodes.some(n => breaks.has(n)) && isCleanRange(whole)) {
            const w = createWrapper(whole, key, meta);
            dropRange(whole);
            return w ? [w] : [];
        }
        dropRange(whole);

        // The selection cuts through inline elements (e.g. <a>, <b>). Wrapping it in one piece
        // would clone those elements, so wrap each run of same-parent text separately instead.
        const runs = [];
        nodes.forEach(n => {
            const cur = runs[runs.length - 1];
            if (cur && cur[0].parentNode === n.parentNode && !breaks.has(n)) cur.push(n);
            else runs.push([n]);
        });
        const out = [];
        runs.forEach(run => {
            const rf = run[0];
            const rl = run[run.length - 1];
            const r = document.createRange();
            r.setStart(rf, rf === first ? startOffset : 0);
            r.setEnd(rl, rl === last ? endOffset : rl.nodeValue.length);
            const w = createWrapper(r, key, meta);
            dropRange(r);
            if (w) out.push(w);
        });
        return out;
    }

    function wrapRange(range, key, meta = { group: newGroupId() }) {
        const wrappers = [];
        planSegments(range, key).forEach(seg => wrappers.push(...wrapSegment(seg, key, meta)));
        return wrappers;
    }

    function showWrappers(wrappers, animate) {
        refreshNoteMarks();
        const anns = wrappers.map(w => annotationMap.get(w)).filter(Boolean);
        if (!anns.length) return;
        if (!animate) anns.forEach(a => { a.animate = false; });
        drawAnnotations(anns, { stagger: animate });
        wrappers.forEach(w => {
            snapshotRect(w);
            visibilityObserver.observe(w);
            shownWrappers.add(w);
        });
        updateSelectionVisibility();
    }

