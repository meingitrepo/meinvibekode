    // =====================================================================
    // DOM helpers: blocks, XPath, text offsets
    // =====================================================================

    const BLOCK_TAGS = new Set([
        'HTML', 'BODY', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DD', 'DT', 'TD', 'TH', 'TR',
        'BLOCKQUOTE', 'FIGCAPTION', 'FIGURE', 'PRE', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER',
        'MAIN', 'ASIDE', 'NAV', 'SUMMARY', 'UL', 'OL', 'DL', 'TABLE'
    ]);

    function isBlockElement(el) {
        if (el.hasAttribute(WRAPPER_ATTR)) return false;
        if (BLOCK_TAGS.has(el.tagName)) return true;
        const display = getComputedStyle(el).display;
        return display !== 'inline' && display !== 'contents';
    }

    function getBlockParent(node) {
        let el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        while (el && !isBlockElement(el)) el = el.parentElement;
        return el || document.body;
    }

    function elementOf(node) {
        return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    }

    function isStableId(id) {
        // Skip auto-generated ids (React's ":r1:", long digit runs) and anything needing quoting.
        return /^[A-Za-z][\w.-]*$/.test(id) && !/\d{5,}/.test(id);
    }

    // An element's position among its same-tag siblings, as an XPath index. Our own wrappers
    // are transient, so they aren't counted: that would shift indices between save and load.
    // `cache` keeps one parent's positions for the rest of a save, so an article with
    // hundreds of annotated paragraphs walks its children once, not once per annotation.
    function siblingIndex(el, cache) {
        const parent = el.parentNode;
        if (!parent) return 1;
        let positions = cache && cache.get(parent);
        if (!positions) {
            positions = new Map();
            const counts = new Map();
            for (let c = parent.firstElementChild; c; c = c.nextElementSibling) {
                const n = counts.get(c.tagName) || 0;
                positions.set(c, n + 1);
                if (!c.hasAttribute(WRAPPER_ATTR)) counts.set(c.tagName, n + 1);
            }
            if (cache) cache.set(parent, positions);
        }
        return positions.get(el);
    }

    function getXPath(node, cache) {
        let el = node && node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
        const steps = [];
        let prefix = '';
        while (el && el.nodeType === Node.ELEMENT_NODE) {
            if (el.id && isStableId(el.id) && document.getElementById(el.id) === el) {
                prefix = `//*[@id="${el.id}"]`;
                break;
            }
            if (el === document.documentElement) {
                prefix = '/html';
                break;
            }
            steps.unshift(`${el.tagName.toLowerCase()}[${siblingIndex(el, cache)}]`);
            el = el.parentElement;
        }
        return prefix + (steps.length ? '/' + steps.join('/') : '');
    }

    // The paths getXPath writes are resolved directly: the id through getElementById, then one
    // child per step. document.evaluate would scan the whole page for //*[@id], once per
    // saved annotation, and would count our wrappers among the siblings, which getXPath doesn't.
    const OWN_XPATH_RE = /^(?:\/\/\*\[@id="([^"]+)"\]|\/html)((?:\/[\w-]+\[\d+\])*)$/;
    const XPATH_STEP_RE = /([\w-]+)\[(\d+)\]/g;

    function getElementByXPath(xpath) {
        if (!xpath) return null;
        const own = OWN_XPATH_RE.exec(xpath);
        if (!own) return evaluateXPath(xpath);   // not a path this version writes
        let el = own[1] !== undefined ? document.getElementById(own[1]) : document.documentElement;
        for (const [, tag, n] of own[2].matchAll(XPATH_STEP_RE)) {
            if (!el) return null;
            el = nthChildByTag(el, tag, +n);
        }
        return el;
    }

    function nthChildByTag(parent, tag, n) {
        let seen = 0;
        for (let c = parent.firstElementChild; c; c = c.nextElementSibling) {
            if (c.tagName.toLowerCase() === tag && !c.hasAttribute(WRAPPER_ATTR) && ++seen === n) return c;
        }
        return null;
    }

    function evaluateXPath(xpath) {
        try {
            return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        } catch (e) {
            return null;
        }
    }

    // Maps a character offset inside `root`'s text to a (text node, offset) pair.
    // 'start' prefers the next node at a seam, 'end' prefers the previous one.
    function findNodeAtOffset(root, targetOffset, boundary) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        let current = 0;
        let node;
        while ((node = walker.nextNode())) {
            const len = node.nodeValue.length;
            const reached = boundary === 'end' ? (current + len >= targetOffset) : (current + len > targetOffset);
            if (reached) return { node, offset: targetOffset - current };
            current += len;
        }
        return null;
    }

    // A Range stays tied to the page until it is garbage collected, and the browser updates every
    // tied Range on each change to the page, the site's own changes too. Spent ones (six per
    // restored annotation, two per annotation on the page for every edit) piled up by the
    // thousand and slowed every change down until a collection, often long after. Moved into a
    // spare document, a Range is no longer tied to the page.
    let spareDoc = null;
    function dropRange(range) {
        if (!range) return;
        if (!spareDoc) spareDoc = document.implementation.createHTMLDocument('');
        range.setStart(spareDoc, 0);
    }

    function computeOffsetWithinBlock(block, node, offset) {
        const r = document.createRange();
        r.setStart(block, 0);
        r.setEnd(node, offset);
        const length = r.toString().length;
        dropRange(r);
        return length;
    }

    function rangeFromOffsets(block, start, end) {
        const sp = findNodeAtOffset(block, start, 'start');
        const ep = findNodeAtOffset(block, end, 'end');
        if (!sp || !ep) return null;
        try {
            const r = document.createRange();
            r.setStart(sp.node, sp.offset);
            r.setEnd(ep.node, ep.offset);
            return r;
        } catch (e) {
            return null;
        }
    }

    function offsetMatchesText(block, start, length, expected) {
        if (typeof expected !== 'string') return true;
        const r = rangeFromOffsets(block, start, start + length);
        const matches = !!r && r.toString() === expected;
        dropRange(r);
        return matches;
    }

    function occurrences(text, part) {
        const out = [];
        for (let i = text.indexOf(part); i !== -1; i = text.indexOf(part, i + 1)) out.push(i);
        return out;
    }

    // `strict` matching (see locateRecord) takes the exact context, where it occurs once. A context
    // shorter than CONTEXT_LENGTH means the text sat at the start or end of its block, and it must
    // again: "Paris" alone in a table cell is not the "Paris" in "Parisian".
    function contextEdges(record) {
        return {
            atStart: (record.prefix || '').length < CONTEXT_LENGTH,
            atEnd: (record.suffix || '').length < CONTEXT_LENGTH
        };
    }

    // Looks for the record inside one block: exact context first, then a unique text match.
    function fuzzyLocate(block, record, strict = false) {
        if (!record.text) return null;
        const full = block.textContent;
        const prefix = record.prefix || '';
        const suffix = record.suffix || '';
        const context = prefix + record.text + suffix;
        if (strict) {
            const { atStart, atEnd } = contextEdges(record);
            const hits = occurrences(full, context)
                .filter(i => (!atStart || i === 0) && (!atEnd || i + context.length === full.length));
            return hits.length === 1 ? { startOffset: hits[0] + prefix.length, length: record.text.length } : null;
        }
        const idx = full.indexOf(context);
        if (idx !== -1) return { startOffset: idx + prefix.length, length: record.text.length };
        if (record.text.length >= 3) {
            const first = full.indexOf(record.text);
            if (first !== -1 && full.indexOf(record.text, first + 1) === -1) {
                return { startOffset: first, length: record.text.length };
            }
        }
        return null;
    }

    // --- Whole-document text index: last-resort anchoring when the XPath is dead ---

    function buildTextIndex() {
        const nodes = [];
        const starts = [];
        let text = '';
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: n => (n.parentElement && n.parentElement.closest(IGNORED_TEXT_SELECTOR))
                ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
        });
        let n;
        while ((n = walker.nextNode())) {
            nodes.push(n);
            starts.push(text.length);
            text += n.nodeValue;
        }
        return { text, nodes, starts };
    }

    function pointAt(index, pos, boundary) {
        const { nodes, starts } = index;
        let lo = 0, hi = nodes.length - 1, found = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const ok = boundary === 'end' ? starts[mid] < pos : starts[mid] <= pos;
            if (ok) { found = mid; lo = mid + 1; } else { hi = mid - 1; }
        }
        if (found < 0) return null;
        const offset = pos - starts[found];
        return offset > nodes[found].nodeValue.length ? null : { node: nodes[found], offset };
    }

    function globalLocate(record, index, strict = false) {
        if (!record.text) return null;
        const prefix = record.prefix || '';
        const suffix = record.suffix || '';
        const context = prefix + record.text + suffix;
        let start = -1;
        const at = index.text.indexOf(context);
        if (strict) {
            const { atStart, atEnd } = contextEdges(record);
            // A whole block with less text than a record's usual context ("Paris" in a table
            // cell) could be any such block: only its own place will do, which fuzzyLocate has tried.
            if (atStart && atEnd && context.length < CONTEXT_LENGTH) return null;
            const hits = occurrences(index.text, context).filter(i => {
                const p = pointAt(index, i, 'start');
                if (!p) return false;
                const block = getBlockParent(p.node);
                const off = computeOffsetWithinBlock(block, p.node, p.offset);
                return (!atStart || off === 0) && (!atEnd || off + context.length === block.textContent.length);
            });
            if (hits.length === 1) start = hits[0] + prefix.length;
        } else if (at !== -1) {
            start = at + prefix.length;
        } else if (record.text.length >= 3) {
            const first = index.text.indexOf(record.text);
            if (first !== -1 && index.text.indexOf(record.text, first + 1) === -1) start = first;
        }
        return start < 0 ? null : indexRange(index, start, record.text.length);
    }

    function indexRange(index, start, length) {
        const sp = pointAt(index, start, 'start');
        const ep = pointAt(index, start + length, 'end');
        if (!sp || !ep) return null;
        try {
            const r = document.createRange();
            r.setStart(sp.node, sp.offset);
            r.setEnd(ep.node, ep.offset);
            return r;
        } catch (e) {
            return null;
        }
    }

    // --- Loose matching: the text is there, but what surrounds it changed a little ---

    function looseText(s) {
        return s.toLowerCase().replace(/\s+/g, '');
    }

    function trigrams(s) {
        const set = new Set();
        for (let i = 0; i + 3 <= s.length; i++) set.add(s.slice(i, i + 3));
        return set;
    }

    // How alike two short texts are, from 0 to 1: the share of their three-letter pieces they
    // have in common (Dice's coefficient).
    function likeness(a, b) {
        const ta = trigrams(a);
        const tb = trigrams(b);
        if (!ta.size || !tb.size) return a === b ? 1 : 0;
        let common = 0;
        ta.forEach(t => { if (tb.has(t)) common++; });
        return (2 * common) / (ta.size + tb.size);
    }

    // How well the text around `full[at...]` agrees with the record's saved prefix and suffix,
    // ignoring case and spacing, from 0 to 1. Each side counts by its length.
    function contextScore(full, at, length, want) {
        let score = 0;
        let weight = 0;
        if (want.prefix) {
            const before = looseText(full.slice(Math.max(0, at - 2 * CONTEXT_LENGTH), at)).slice(-want.prefix.length);
            score += likeness(want.prefix, before) * want.prefix.length;
            weight += want.prefix.length;
        }
        if (want.suffix) {
            const after = looseText(full.slice(at + length, at + length + 2 * CONTEXT_LENGTH)).slice(0, want.suffix.length);
            score += likeness(want.suffix, after) * want.suffix.length;
            weight += want.suffix.length;
        }
        return weight ? score / weight : 0;
    }

    // Where in `full` the record's text stands among surroundings most like the saved ones: a
    // score of at least LOOSE_MATCH_MIN_SCORE, clearly ahead of any other place with that text.
    // -1 when there is no such place. For a site that changed a word next to the annotation,
    // its capitals or its spacing.
    function looseLocate(full, record) {
        const want = { prefix: looseText(record.prefix || ''), suffix: looseText(record.suffix || '') };
        if (!record.text || (!want.prefix && !want.suffix)) return -1;
        let best = -1;
        let bestScore = 0;
        let second = 0;
        let places = 0;
        for (let i = full.indexOf(record.text); i !== -1; i = full.indexOf(record.text, i + 1)) {
            if (++places > LOOSE_MATCH_MAX_PLACES) return -1;
            const score = contextScore(full, i, record.text.length, want);
            if (score > bestScore) { second = bestScore; bestScore = score; best = i; }
            else if (score > second) second = score;
        }
        return bestScore >= LOOSE_MATCH_MIN_SCORE && bestScore - second >= LOOSE_MATCH_MARGIN ? best : -1;
    }

