    // =====================================================================
    // Drawing: every annotation is an SVG of straight strokes, one per line of text
    // =====================================================================

    const SVG_NS = 'http://www.w3.org/2000/svg';   // also used by the UI's icons

    function normalizePadding(p) {
        if (p || p === 0) {
            if (typeof p === 'number') return [p, p, p, p];
            if (Array.isArray(p) && p.length) {
                switch (p.length) {
                    case 4: return [...p];
                    case 1: return [p[0], p[0], p[0], p[0]];
                    case 2: return [...p, ...p];
                    case 3: return [...p, p[1]];
                    default: return [p[0], p[1], p[2], p[3]];
                }
            }
        }
        return [5, 5, 5, 5];
    }

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

    // Where highlights share text, the wrapper of one nests in the other's. The outer one is
    // drawn whole and each inner one as a band across part of it: of the n highlights on the
    // text, each gets 1/n of the height, in the order of STYLES (yellow at the top). { slot, of }
    // for an inner highlight, null for one with no highlight around it.
    function bandOf(element) {
        const key = element.getAttribute(STYLE_ATTR);
        const keys = [key];
        for (let w = outerWrapper(element); w; w = outerWrapper(w)) {   // see wrappers.js
            const k = w.getAttribute(STYLE_ATTR);
            if (hasOwn(STYLES, k) && STYLES[k].type === 'highlight' && !keys.includes(k)) keys.push(k);
        }
        if (keys.length < 2) return null;
        const order = Object.keys(STYLES);
        keys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
        return { slot: keys.indexOf(key), of: keys.length };
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
        const pad = normalizePadding(config.padding);
        const width = config.strokeWidth || 2;
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
                const y = config.type === 'underline' ? r.y + r.h - width / 2 - 1 + pad[2] : strike[i];
                out.push([line(r.x, y, r.x + r.w, y), width, r.w]);
            }
        });
        return out;
    }

    // Replaces the drawing's strokes. With `animate` they draw in from the left after `delay` ms,
    // each line taking its share of the duration by length.
    function drawStrokes(ann, measured, animate, delay) {
        const svg = ann.svg;
        const config = ann.config;
        while (svg.lastChild) svg.removeChild(svg.lastChild);
        const strokes = strokesFor(config, measured);
        const total = strokes.reduce((sum, s) => sum + s[2], 0);
        const duration = config.animationDuration || 0;
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
    function makeAnnotation(element, config) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'highlighter-annotation');
        svg.setAttribute(SVG_ATTR, '');
        const s = svg.style;
        s.position = 'absolute'; s.top = '0'; s.left = '0'; s.overflow = 'visible';
        s.pointerEvents = 'none'; s.width = '100px'; s.height = '100px';
        const highlight = config.type === 'highlight';
        element.insertAdjacentElement(highlight ? 'beforebegin' : 'afterend', svg);
        if (highlight) {
            const pos = getComputedStyle(element).position;
            if (!pos || pos === 'static') element.style.position = 'relative';
        }
        return {
            element, config, svg,
            drawn: false,              // a redraw never animates
            animate: !!config.animate,
            remove() {
                if (this.svg && this.svg.parentNode) this.svg.parentNode.removeChild(this.svg);
                this.svg = null;
            }
        };
    }

    // Draws, or redraws in place, annotations: all are measured first, then all drawn. A first
    // drawing animates when its `animate` is set; with `stagger` each starts when the one
    // before it has finished, like a pen going through them in turn.
    function drawAnnotations(anns, { stagger = false } = {}) {
        const measured = anns.map(measureAnnotation);
        let delay = 0;
        anns.forEach((a, i) => {
            if (!measured[i]) return;
            const animate = !a.drawn && a.animate;
            drawStrokes(a, measured[i], animate, stagger ? delay : 0);
            if (animate && stagger) delay += a.config.animationDuration || 0;
            a.drawn = true;
        });
    }
