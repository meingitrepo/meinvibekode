    // =====================================================================
    // Navigation (SPAs change the URL without reloading)
    // =====================================================================

    function onUrlMaybeChanged() {
        if (!running) return;
        if (location.href === lastHref) {
            if (!nav) lastSeenCanonical = canonicalKey();
            return;
        }
        const sameUrl = urlKey(location.href) === urlKey(lastHref);
        lastHref = location.href;
        if (sameUrl) return;
        if (nav) {
            clearTimeout(nav.timer);
        } else {
            stopLateWatcher();
            nav = {
                timer: null,
                wrappers: allWrappers(),
                // Canonical URLs that belong to the page we're leaving. Seeing one of them on the
                // new URL means the site hasn't updated <link rel="canonical"> (yet).
                oldCanonicals: new Set([settledCanonical, lastSeenCanonical].filter(Boolean))
            };
        }
        // Give the site a moment to render the new page and update its canonical link.
        nav.timer = setTimeout(settleNavigation, RESTORE_DELAY_MS);
    }

    // Decides which page we're on after a URL change. Returns true if it restored a new page.
    function settleNavigation() {
        if (!nav) return false;
        const { timer, wrappers, oldCanonicals } = nav;
        clearTimeout(timer);
        nav = null;

        const canon = canonicalKey();
        const canonicalUnchanged = canon !== null && oldCanonicals.has(canon);
        // Same canonical and every annotation still in place: the site only rewrote its URL
        // (some do while scrolling). Otherwise an unchanged canonical can't name the new page.
        const samePage = canonicalUnchanged && wrappers.length > 0 && wrappers.every(w => w.isConnected);
        const key = samePage ? currentKey : ((!canonicalUnchanged && canon) || urlKey(location.href));

        if (key === currentKey) {
            startLateWatcher();
            return false;
        }
        // The previous page was saved after every change; nothing from it may be saved under the new key.
        dropUnwrittenNote();
        resetUi();
        pendingRecords = [];
        undoStack.length = 0;
        redoStack.length = 0;
        unwrapAll();
        resetPageTracking();
        currentKey = key;
        settledCanonical = canon;
        restoreHighlights();
        schedulePanelRefresh();
        scheduleMenuRefresh();
        return true;
    }

    // Brings page identity up to date before acting on user input.
    function syncLocation() {
        onUrlMaybeChanged();
        if (nav) settleNavigation();
    }

    // =====================================================================
    // Cleaner selections: no spaces at the edges, no half words
    // =====================================================================

    // Made on first use: making one takes about 9 ms, a good part of the script's start on every page.
    let segmenter;
    function wordSegmenter() {
        if (segmenter === undefined) {
            segmenter = typeof Intl === 'object' && typeof Intl.Segmenter === 'function'
                ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null;
        }
        return segmenter;
    }
    const WORD_WINDOW = 64;   // characters looked at on each side of a boundary to find its word

    // The selected part of each page text node in the range (not script or style contents), in
    // document order: [{ node, from, to }].
    function selectedParts(range) {
        const parts = [];
        const add = node => {
            const from = node === range.startContainer ? range.startOffset : 0;
            const to = node === range.endContainer ? range.endOffset : node.nodeValue.length;
            if (from < to) parts.push({ node, from, to });
        };
        const root = range.commonAncestorContainer;
        if (root.nodeType === Node.TEXT_NODE) {
            add(root);
            return parts;
        }
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: n => (!range.intersectsNode(n) || (n.parentElement && n.parentElement.closest(IGNORED_TEXT_SELECTOR)))
                ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
        });
        let n;
        while ((n = walker.nextNode())) add(n);
        return parts;
    }

    // Where the word around a boundary of `text` begins (side 'start': the word starting at or
    // before `i`) or ends (side 'end': the word ending at or after `i`), when the boundary cuts
    // it in two; else null. Intl.Segmenter knows where words end in languages written without
    // spaces too (Chinese, Japanese, Thai).
    function wordEdge(text, i, side) {
        const at = side === 'start' ? i : i - 1;   // the selected character next to the boundary
        const words = at < 0 || at >= text.length ? null : wordSegmenter();
        if (!words) return null;
        const word = words.segment(text).containing(at);
        if (!word || !word.isWordLike) return null;
        const start = word.index;
        const end = word.index + word.segment.length;
        if (side === 'start') return start < i ? start : null;
        return end > i ? end : null;
    }

    // Moves a selection boundary { node, offset } that cuts a word in two to that word's edge.
    function snapToWord(point, side) {
        const block = getBlockParent(point.node);
        const offset = computeOffsetWithinBlock(block, point.node, point.offset);
        const text = block.textContent;
        const from = Math.max(0, offset - WORD_WINDOW);
        const edge = wordEdge(text.slice(from, offset + WORD_WINDOW), offset - from, side);
        return (edge !== null && findNodeAtOffset(block, from + edge, side)) || point;
    }

    // The range without the spaces at its edges (null when it holds nothing else), and, unless
    // `snap` is false, with a word it cuts in two taken whole (SNAP_SELECTION_TO_WORDS). What the
    // shortcuts and the toolbar act on, so a triple-click doesn't save a paragraph's indentation
    // and a drag that starts mid-word doesn't mark half a word.
    function cleanRange(range, { snap = SNAP_SELECTION_TO_WORDS } = {}) {
        const parts = selectedParts(range).filter(p => /\S/.test(p.node.nodeValue.slice(p.from, p.to)));
        if (!parts.length) return null;
        const first = parts[0];
        const last = parts[parts.length - 1];
        let start = { node: first.node, offset: first.from + first.node.nodeValue.slice(first.from, first.to).search(/\S/) };
        let end = { node: last.node, offset: last.from + last.node.nodeValue.slice(last.from, last.to).trimEnd().length };
        if (snap) {
            start = snapToWord(start, 'start');
            end = snapToWord(end, 'end');
        }
        try {
            const clean = document.createRange();
            clean.setStart(start.node, start.offset);
            clean.setEnd(end.node, end.offset);
            return clean;
        } catch (e) {
            return null;
        }
    }

    // --- Triple-click ---

    // The box a text's line belongs to: its nearest ancestor that isn't laid out inline (a float,
    // such as a drop cap, counts as inline).
    function paragraphBox(node) {
        for (let el = elementOf(node); el; el = el.parentElement) {
            const style = getComputedStyle(el);
            if (/^(absolute|fixed)$/.test(style.position)) return el;
            if (style.float === 'none' && !/^(inline|contents|ruby)/.test(style.display)) return el;
        }
        return document.documentElement;
    }

    // The paragraph as it is shown around the text node `node` in `box` (see paragraphBox): the
    // run of text between two line breaks (<br>) or blocks, without the spaces at its edges.
    function visualParagraph(box, node) {
        const runs = [[]];
        const walk = parent => {
            for (let n = parent.firstChild; n; n = n.nextSibling) {
                if (n.nodeType === Node.TEXT_NODE) { runs[runs.length - 1].push(n); continue; }
                if (n.nodeType !== Node.ELEMENT_NODE || n.matches(IGNORED_TEXT_SELECTOR)) continue;
                if (n.tagName === 'BR') { runs.push([]); continue; }
                const style = getComputedStyle(n);
                // Hidden, or taken out of the flow (our own drawings are positioned): not part of it.
                if (style.display === 'none' || /^(absolute|fixed)$/.test(style.position)) continue;
                if (style.float === 'none' && !/^(inline|contents|ruby)/.test(style.display)) runs.push([]);   // a block inside
                else walk(n);
            }
        };
        walk(box);
        const run = runs.find(r => r.includes(node));
        if (!run) return null;
        const whole = document.createRange();
        whole.setStart(run[0], 0);
        whole.setEnd(run[run.length - 1], run[run.length - 1].nodeValue.length);
        return cleanRange(whole, { snap: false });
    }

    function caretAt(x, y) {
        try {
            if (typeof document.caretPositionFromPoint === 'function') {
                const p = document.caretPositionFromPoint(x, y);
                return p && p.offsetNode ? { node: p.offsetNode, offset: p.offset } : null;
            }
            if (typeof document.caretRangeFromPoint === 'function') {
                const r = document.caretRangeFromPoint(x, y);
                return r ? { node: r.startContainer, offset: r.startOffset } : null;
            }
        } catch (e) { /* no caret there */ }
        return null;
    }

