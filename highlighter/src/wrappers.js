    // =====================================================================
    // Wrapper bookkeeping: SVG access, selection-aware blending, layout tracking
    // =====================================================================

    function allWrappers() {
        return Array.from(document.querySelectorAll(WRAPPER_SELECTOR));
    }

    function getSvg(wrapper) {
        const ann = annotationMap.get(wrapper);
        return ann && ann.svg && ann.svg.isConnected ? ann.svg : null;
    }

    // An underline or strike-through under a selection is blended into the page (multiply on a
    // light background, screen on a dark one, see pageStyle) rather than hidden: where it crosses
    // the selection it takes on the selection's color, and elsewhere it looks as it always does.
    // A highlight is drawn beneath its text, so the selection already paints over it.
    function blendSVG(svg, dark) {
        if (selectedSVGs.has(svg)) return;
        svg.setAttribute(SELECTED_ATTR, dark ? 'dark' : 'light');
        selectedSVGs.add(svg);
    }

    function unblendSelectedSVGs() {
        selectedSVGs.forEach(svg => svg.removeAttribute(SELECTED_ATTR));
        selectedSVGs.clear();
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
            unblendSelectedSVGs();
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
            let range;
            try { range = sel.getRangeAt(0); } catch (e) { return; }
            candidateWrappers(range).forEach(w => {
                const ann = annotationMap.get(w);
                const svg = getSvg(w);
                if (svg && ann.config.type !== 'highlight') blendSVG(svg, w.hasAttribute(DARK_ATTR));
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

    // Redraws in place: keeps the SVG elements (so blending under a selection survives) and never animates.
    // All are measured before any is drawn (see drawAnnotations).
    function reposition(wrappers) {
        const ws = wrappers.filter(w => annotationMap.has(w));
        if (!ws.length) return;
        drawAnnotations(ws.map(w => annotationMap.get(w)));
        ws.forEach(snapshotRect);
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

