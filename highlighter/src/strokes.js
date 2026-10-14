    // =====================================================================
    // Drawing: every annotation is an SVG of straight strokes, one per line of text
    // =====================================================================

    const SVG_NS = 'http://www.w3.org/2000/svg';   // also used by the UI's icons

    function line(sx, sy, ex, ey) {
        return `M${sx} ${sy} L${ex} ${ey}`;
    }

    // --- Font metrics for the strike-through ---
    //
    // An inline element's rect spans the font's whole ascent + descent, so its middle sits below
    // the middle of the letters. A strike-through belongs at the middle of the lowercase letters:
    // half the x-height above the baseline, which is where browsers put text-decoration
    // line-through too.

    let metricsCtx = null;
    const fontMetricsCache = new Map();

    // { ascent, descent, xHeight } in px for an element's font, or null if unmeasurable.
    function fontMetrics(element) {
        const cs = getComputedStyle(element);
        const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        if (fontMetricsCache.has(font)) return fontMetricsCache.get(font);
        let metrics = null;
        try {
            if (!metricsCtx) metricsCtx = document.createElement('canvas').getContext('2d');
            metricsCtx.font = font;
            const m = metricsCtx.measureText('x');
            if (m.fontBoundingBoxAscent > 0 && m.actualBoundingBoxAscent > 0) {
                metrics = { ascent: m.fontBoundingBoxAscent, descent: m.fontBoundingBoxDescent, xHeight: m.actualBoundingBoxAscent };
            }
        } catch (e) { /* older browser: fall back to the rect's middle */ }
        fontMetricsCache.set(font, metrics);
        return metrics;
    }

    // Where a strike-through crosses a line box `r` (svg coordinates) of `element`'s text.
    function strikeY(r, element) {
        const m = element ? fontMetrics(element) : null;
        if (!m) return r.y + r.h / 2;
        const scale = r.h / (m.ascent + m.descent);   // the rect is the font's ascent + descent
        return r.y + (m.ascent - m.xHeight / 2) * scale;
    }

    // Where highlights share text, the wrapper of one nests in the other's, and they stack as
    // layers, the outermost at the bottom. It is drawn whole, as the background; the layers on
    // it split the height, the next one at the bottom and the topmost at the top. One layer
    // alone takes the bottom half, so the background still shows above it. A layer counts the
    // highlights inside it too, so it keeps its band where they leave off. { slot, of } with
    // slot 0 at the top, or null for the background (a highlight with none around it).
    function bandOf(element) {
        const isHighlight = k => hasOwn(STYLES, k) && STYLES[k].type === 'highlight';
        const key = element.getAttribute(STYLE_ATTR);
        const below = [];
        for (let w = outerWrapper(element); w; w = outerWrapper(w)) {   // see wrappers.js
            const k = w.getAttribute(STYLE_ATTR);
            if (isHighlight(k) && k !== key && !below.includes(k)) below.unshift(k);
        }
        if (!below.length) return null;
        const layers = [...below, key];
        const depth = w => { let d = 0; for (let o = outerWrapper(w); o && o !== element; o = outerWrapper(o)) d++; return d; };
        Array.from(element.querySelectorAll(WRAPPER_SELECTOR))
            .map(w => ({ k: w.getAttribute(STYLE_ATTR), d: depth(w) }))
            .sort((a, b) => a.d - b.d)
            .forEach(({ k }) => { if (isHighlight(k) && !layers.includes(k)) layers.push(k); });
        const on = layers.length - 1;                 // layers on the background
        const of = Math.max(on, 2);
        return { slot: of - layers.indexOf(key), of };
    }

    // Line boxes of an annotation's text, relative to its drawing. Read-only: every annotation
    // is measured first and then all are drawn, so the page is laid out once, not once each.
    function measureAnnotation(ann) {
        const svg = ann.svg;
        if (!svg || !svg.isConnected) return null;
        const o = svg.getBoundingClientRect();
        const list = ann.element.getClientRects();
        const rects = [];
        for (let i = 0; i < list.length; i++) {
            const r = list[i];
            rects.push({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height });
        }
        // The strike-through's font metrics read computed styles, so they are measured here too.
        const strike = ann.config.type === 'strike-through' ? rects.map(r => strikeY(r, ann.element)) : null;
        const band = ann.config.type === 'highlight' ? bandOf(ann.element) : null;
        return { rects, strike, band };
    }

    // One straight stroke per line box: [path data, stroke width, length].
    function strokesFor(config, { rects, strike, band }) {
        const width = config.strokeWidth;
        const out = [];
        rects.forEach((r, i) => {
            if (config.type === 'highlight') {
                // As thick as 95% of the line box, through its middle; or its band of that.
                const h = 0.95 * r.h / (band ? band.of : 1);
                const y = band ? r.y + 0.025 * r.h + h * (band.slot + 0.5) : r.y + r.h / 2;
                out.push([line(r.x, y, r.x + r.w, y), h, r.w]);
            } else {
                // An underline sits just inside the bottom of the line box, where a selection
                // still covers it (see markSelected).
                const y = config.type === 'underline' ? r.y + r.h - width / 2 - 1 : strike[i];
                out.push([line(r.x, y, r.x + r.w, y), width, r.w]);
            }
        });
        return out;
    }

    // Replaces the drawing's strokes. With `animate` they draw in from the left after `delay` ms,
    // each line taking its share of the duration by length.
    function drawStrokes(ann, measured, animate, delay, duration) {
        const svg = ann.svg;
        const config = ann.config;
        while (svg.lastChild) svg.removeChild(svg.lastChild);
        const strokes = strokesFor(config, measured);
        const total = strokes.reduce((sum, s) => sum + s[2], 0);
        let at = delay;
        strokes.forEach(([d, width, len]) => {
            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', config.color || 'currentColor');
            path.setAttribute('stroke-width', String(width));
            if (animate && duration && total) {
                const ms = duration * len / total;
                path.style.strokeDasharray = String(len);
                path.style.strokeDashoffset = String(len);
                path.style.animation = `highlighter-dash ${ms}ms ease-out ${at}ms forwards`;
                at += ms;
            }
            svg.appendChild(path);
        });
    }

    // An annotation's drawing: an <svg> next to its wrapper, at the top-left corner of the
    // wrapper's positioned ancestor (overflow visible), holding one stroke per line of text. It
    // goes before a highlight, so the text paints over it, and after an underline or
    // strike-through. A highlight's wrapper is made that positioned ancestor itself.
    // The svg's own box is 1px: the strokes show outside it, but the box counts as page content,
    // and a bigger one adds scrolling where it sticks out (from a highlight near the edge of a
    // scrolling box, say). At 0px the browser wouldn't draw it at all.
    function makeAnnotation(element, config, animate) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'highlighter-annotation');
        svg.setAttribute(SVG_ATTR, '');
        const s = svg.style;
        s.position = 'absolute'; s.top = '0'; s.left = '0'; s.overflow = 'visible';
        s.pointerEvents = 'none'; s.width = '1px'; s.height = '1px';
        const highlight = config.type === 'highlight';
        element.insertAdjacentElement(highlight ? 'beforebegin' : 'afterend', svg);
        if (highlight) {
            const pos = getComputedStyle(element).position;
            if (!pos || pos === 'static') element.style.position = 'relative';
        }
        return {
            element, config, svg,
            drawn: false,              // a redraw never animates
            animate,                   // a first drawing draws in
            remove() {
                if (this.svg && this.svg.parentNode) this.svg.parentNode.removeChild(this.svg);
                this.svg = null;
            }
        };
    }

    // Draws, or redraws in place, annotations: all are measured first, then all drawn. A first
    // drawing animates when its `animate` is set. The pieces of one annotation (its group) draw
    // in one after another, like one stroke: together they take the animation's duration, each
    // its share by length. With `stagger` each annotation starts when the one before it has
    // finished, like a pen going through them in turn; without, they all start at once.
    function drawAnnotations(anns, { stagger = false } = {}) {
        const measured = anns.map(measureAnnotation);
        const groupOf = a => a.element.getAttribute(GROUP_ATTR) || a;
        const lengthOf = m => m.rects.reduce((sum, r) => sum + r.w, 0);
        const lengths = new Map();   // group -> length of its pieces that draw in
        anns.forEach((a, i) => {
            if (!measured[i] || a.drawn || !a.animate) return;
            lengths.set(groupOf(a), (lengths.get(groupOf(a)) || 0) + lengthOf(measured[i]));
        });
        const starts = new Map();    // group -> when its next piece starts
        let delay = 0;
        anns.forEach((a, i) => {
            if (innerToRedraw.has(a.element)) innerToRedraw.delete(a.element);   // drawn now (see redrawInner)
            if (!measured[i]) return;
            const animate = !a.drawn && a.animate;
            const group = groupOf(a);
            const full = DRAW_IN_MS;
            const total = lengths.get(group);
            const duration = animate ? (total ? full * lengthOf(measured[i]) / total : full) : 0;
            if (animate && !starts.has(group)) {
                starts.set(group, stagger ? delay : 0);
                if (stagger) delay += full;
            }
            const at = animate ? starts.get(group) : 0;
            drawStrokes(a, measured[i], animate, at, duration);
            if (animate) starts.set(group, at + duration);
            a.drawn = true;
        });
    }
