    // =====================================================================
    // Wrapper bookkeeping: SVG access, selection-aware coloring, layout tracking
    // =====================================================================

    function allWrappers() {
        return Array.from(document.querySelectorAll(WRAPPER_SELECTOR));
    }

    function getSvg(wrapper) {
        const ann = annotationMap.get(wrapper);
        return ann && ann.svg && ann.svg.isConnected ? ann.svg : null;
    }

    // Where a selection crosses an annotation, it shows through the selection, like in Edge's
    // PDF viewer, while the selection itself keeps its color everywhere else.
    // - An underline or strike-through turns the selected text's color (white, usually) there.
    //   The line is masked out over the selected text (and the width of the line around it),
    //   and a copy in that color is drawn clipped to the selection.
    // - A highlight is drawn beneath its text, so the selection paints over it. A copy of it,
    //   clipped to the selection, goes over the text in a second SVG and is multiplied with the
    //   selection (screened, on a dark background), so the selected part mixes the two colors.
    let selectionMarkCount = 0;
    const selectionOverlays = new Set();
    function markSelected(svg, wrapper, range) {
        const part = document.createRange();
        part.selectNodeContents(wrapper);
        if (range.compareBoundaryPoints(Range.START_TO_START, part) > 0) part.setStart(range.startContainer, range.startOffset);
        if (range.compareBoundaryPoints(Range.END_TO_END, part) < 0) part.setEnd(range.endContainer, range.endOffset);
        const rects = Array.from(part.getClientRects()).filter(r => r.width && r.height);
        const paths = Array.from(svg.children).filter(el => el.tagName.toLowerCase() === 'path');
        if (!rects.length || !paths.length) return;
        const config = annotationMap.get(wrapper).config;
        const highlight = config.type === 'highlight';
        const width = config.strokeWidth || 2;
        const o = svg.getBoundingClientRect();
        const n = ++selectionMarkCount;
        const svgEl = (tag, attrs) => {
            const el = document.createElementNS(SVG_NS, tag);
            Object.keys(attrs).forEach(k => el.setAttribute(k, String(attrs[k])));
            return el;
        };
        const box = (r, grow) => ({ x: r.left - o.left, y: r.top - o.top - grow, width: r.width, height: r.height + 2 * grow });
        const g = svgEl('g', { [SELECTED_ATTR]: '' });
        const clip = svgEl('clipPath', { id: `highlighter-selected-${n}`, clipPathUnits: 'userSpaceOnUse' });
        rects.forEach(r => clip.appendChild(svgEl('rect', box(r, 0))));
        const copies = svgEl('g', { 'clip-path': `url(#highlighter-selected-${n})` });
        paths.forEach(p => {
            const copy = p.cloneNode(false);
            copy.removeAttribute('style');   // no draw-in animation
            copies.appendChild(copy);
        });
        g.append(clip, copies);
        if (highlight) {
            // Same place and containing block as the drawing: the wrapper is positioned itself.
            const overlay = svgEl('svg', { class: 'highlighter-annotation', [SELECTED_ATTR]: wrapper.hasAttribute(DARK_ATTR) ? 'dark' : 'light' });
            overlay.style.cssText = svg.style.cssText;
            overlay.appendChild(g);
            wrapper.insertAdjacentElement('afterend', overlay);
            selectionOverlays.add(overlay);
            return;
        }
        const mask = svgEl('mask', { id: `highlighter-unselected-${n}`, maskUnits: 'userSpaceOnUse', x: -1e5, y: -1e5, width: 2e5, height: 2e5 });
        mask.appendChild(svgEl('rect', { x: -1e5, y: -1e5, width: 2e5, height: 2e5, fill: '#fff' }));
        rects.forEach(r => mask.appendChild(svgEl('rect', { ...box(r, width + 1), fill: '#000' })));
        g.insertBefore(mask, g.firstChild);
        paths.forEach(p => p.setAttribute('mask', `url(#highlighter-unselected-${n})`));
        svg.appendChild(g);
        selectedSVGs.add(svg);
    }

    function unmarkSelected() {
        selectedSVGs.forEach(svg => {
            svg.querySelectorAll(`g[${SELECTED_ATTR}]`).forEach(g => g.remove());
            svg.querySelectorAll('path[mask]').forEach(p => p.removeAttribute('mask'));
        });
        selectedSVGs.clear();
        selectionOverlays.forEach(overlay => overlay.remove());
        selectionOverlays.clear();
    }

    // Wrappers that touch the range, including a wrapper that fully contains it.
    function candidateWrappers(range) {
        const set = new Set();
        const root = elementOf(range.commonAncestorContainer);
        if (!root) return [];
        const outer = root.closest(WRAPPER_SELECTOR);
        if (outer) set.add(outer);
        root.querySelectorAll(WRAPPER_SELECTOR).forEach(w => set.add(w));
        return Array.from(set).filter(w => {
            try { return range.intersectsNode(w); } catch (e) { return false; }
        });
    }

    let selectionFramePending = false;
    function updateSelectionVisibility() {
        if (selectionFramePending) return;
        selectionFramePending = true;
        requestAnimationFrame(() => {
            selectionFramePending = false;
            unmarkSelected();
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
            let range;
            try { range = sel.getRangeAt(0); } catch (e) { return; }
            candidateWrappers(range).forEach(w => {
                const ann = annotationMap.get(w);
                const svg = getSvg(w);
                if (svg) markSelected(svg, w, range);
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
        const now = measureRects(wrapper);
        const before = rectCache.get(wrapper);
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

    // Rebuild with the colors for the background behind it (and for its style, after a change of
    // style, which `animate` draws in like a new annotation).
    function restyle(wrapper, { animate = false } = {}) {
        const dark = darkBehind(wrapper);
        const config = getStyleConfig(wrapper.getAttribute(STYLE_ATTR), { animate, dark });
        if (!config) return;
        wrapper.toggleAttribute(DARK_ATTR, dark);
        updateInk(wrapper);
        const old = annotationMap.get(wrapper);
        const oldSvg = getSvg(wrapper);
        if (oldSvg) selectedSVGs.delete(oldSvg);
        if (old) old.remove();
        const ann = makeAnnotation(wrapper, config);
        annotationMap.set(wrapper, ann);
        drawAnnotations([ann]);
        snapshotRect(wrapper);
        updateSelectionVisibility();
    }

    const visibilityObserver = (typeof IntersectionObserver === 'function')
        ? new IntersectionObserver(entries => {
            reposition(entries.filter(e => e.isIntersecting && rectChanged(e.target)).map(e => e.target));
        }, { rootMargin: '200px', threshold: 0 })
        : { observe() {}, unobserve() {} };

    let redrawTimer = null;
    function scheduleRedraw() {
        clearTimeout(redrawTimer);
        redrawTimer = setTimeout(() => {
            reposition(allWrappers().filter(w => w.getClientRects().length > 0 && rectChanged(w)));
        }, 150);
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
        annotationMap.delete(wrapper);
        rectCache.delete(wrapper);
        trackedRecords.delete(wrapper);
        visibilityObserver.unobserve(wrapper);
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
        if (typeof meta.note === 'string' && meta.note) wrapper.setAttribute(NOTE_ATTR, meta.note.slice(0, NOTE_MAX_LENGTH));
        if (meta.added) wrapper.setAttribute(ADDED_ATTR, String(meta.added));
        if (typeof meta.page === 'string') wrapper.setAttribute(PAGE_ATTR, meta.page);
        try {
            wrapper.appendChild(range.extractContents());
            range.insertNode(wrapper);
            const dark = darkBehind(wrapper);
            if (dark) wrapper.setAttribute(DARK_ATTR, '');
            updateInk(wrapper);
            annotationMap.set(wrapper, makeAnnotation(wrapper, getStyleConfig(key, { dark })));
            return wrapper;
        } catch (err) {
            console.warn(`${LOG} failed to wrap text`, err);
            annotationMap.delete(wrapper);
            unwrapDom(wrapper);
            return null;
        }
    }

    const SKIPPED_TEXT_SELECTOR = `${IGNORED_TEXT_SELECTOR}, ${WRAPPER_SELECTOR}`;

    // The range's text nodes that can be wrapped, and `breaks`: those that come right after an
    // existing annotation, which a new wrapper must not swallow (see wrapSegment).
    function collectTextNodes(range) {
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
                // Text already inside an annotation is never wrapped again (see renderRecords).
                if (node.parentElement && node.parentElement.closest(SKIPPED_TEXT_SELECTOR)) {
                    if (node.parentElement.closest(WRAPPER_SELECTOR)) skippedAnnotation = true;
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
    function planSegments(range) {
        const groups = [];
        let currentBlock = null;
        const { nodes: textNodes, breaks } = collectTextNodes(range);
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
            return w ? [w] : [];
        }

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
            if (w) out.push(w);
        });
        return out;
    }

    function wrapRange(range, key, meta = { group: newGroupId() }) {
        const wrappers = [];
        planSegments(range).forEach(seg => wrappers.push(...wrapSegment(seg, key, meta)));
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
        });
        updateSelectionVisibility();
    }

