    // =====================================================================
    // Theme detection
    // =====================================================================

    const RGB_RE = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/i;
    const THEME_ATTR_RE = /^(class|style)$|theme|dark|light|mode|scheme|color/i;
    let colorCtx = null;
    const canvasColors = new Map();   // css -> what the canvas made of it (see toRGBA)

    function toRGBA(css) {
        const m = RGB_RE.exec((css || '').trim());
        if (m) {
            let a = m[4] === undefined ? 1 : parseFloat(m[4]);
            if (m[5] === '%') a /= 100;
            return { r: +m[1], g: +m[2], b: +m[3], a };
        }
        // Read by the canvas once each: the script's own hex colours come by on every theme check,
        // once per annotation.
        if (canvasColors.has(css)) { const c = canvasColors.get(css); return c && { ...c }; }
        if (canvasColors.size > 200) canvasColors.clear();
        const c = canvasRGBA(css);
        canvasColors.set(css, c);
        return c && { ...c };
    }

    // Newer syntaxes (color(), lab(), oklch(), ...) and hex: let a canvas normalise them.
    function canvasRGBA(css) {
        try {
            if (!colorCtx) colorCtx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
            if (!colorCtx) return null;
            colorCtx.fillStyle = '#000'; colorCtx.fillStyle = css;
            const first = colorCtx.fillStyle;
            colorCtx.fillStyle = '#fff'; colorCtx.fillStyle = css;
            if (colorCtx.fillStyle !== first) return null;   // unparseable: both sentinels survived
            colorCtx.clearRect(0, 0, 1, 1);
            colorCtx.fillRect(0, 0, 1, 1);
            const d = colorCtx.getImageData(0, 0, 1, 1).data;
            return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
        } catch (e) {
            return null;
        }
    }

    function systemPrefersDark() {
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    function luma(c) {
        return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    }

    // The color schemes the page declares: the root's color-scheme, else <meta name="color-scheme">.
    function declaredColorSchemes() {
        let schemes = getComputedStyle(document.documentElement).colorScheme || '';
        if (!schemes || schemes === 'normal') {
            const meta = document.querySelector('meta[name="color-scheme" i]');
            schemes = (meta && meta.content) || '';
        }
        return schemes.toLowerCase();
    }

    // Nothing up to the root paints a background, so the browser's canvas shows through. The page's
    // text color tells what it is designed for (light text means a dark page; light gray text in
    // one spot means nothing); failing that, the canvas is dark only on a page that opts into a
    // dark color scheme. (The system preference alone would turn a plain white page dark.)
    function canvasIsDark() {
        const text = toRGBA(getComputedStyle(document.body || document.documentElement).color);
        if (text && text.a >= 0.5) {
            if (luma(text) > 160) return true;
            if (luma(text) < 96) return false;
        }
        const schemes = declaredColorSchemes();
        return /\bdark\b/.test(schemes) && (!/\blight\b/.test(schemes) || systemPrefersDark());
    }

    const CSS_COLOR_FN_RE = /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*\)/gi;

    // A background gradient is as dark as the average of its colors. Null without one, or for a
    // mostly transparent one.
    function gradientIsDark(image) {
        if (!/gradient\(/i.test(image)) return null;
        const stops = (image.match(CSS_COLOR_FN_RE) || []).map(toRGBA).filter(Boolean);
        const alpha = stops.reduce((sum, c) => sum + c.a, 0);
        if (!stops.length || alpha / stops.length < 0.5) return null;
        return stops.reduce((sum, c) => sum + luma(c) * c.a, 0) / alpha < 128;
    }

    // A background picture can't be read, but light text on it says it is dark (dark text, light).
    // Null for text of a middling color.
    function textSaysDark(text) {
        if (!text || text.a < 0.5) return null;
        return luma(text) > 160 ? true : luma(text) < 96 ? false : null;
    }

    // Is the background behind `node` dark? The first mostly-opaque background at or above it
    // decides (pure black included, and a gradient or picture), else the canvas. Measured from
    // outside our own wrappers, whose text color may be ours. Answers are cached per element for
    // the rest of the current task, so restoring many annotations walks each ancestor once
    // (except answers read from the text's color, which differ from text to text).
    let darkCache = null;
    function darkBehind(node) {
        let from = node && elementOf(node);
        for (let w = from && from.closest(WRAPPER_SELECTOR); w; w = from && from.closest(WRAPPER_SELECTOR)) from = w.parentElement;
        if (!from) return false;
        if (!darkCache) {
            darkCache = new WeakMap();
            setTimeout(() => { darkCache = null; }, 0);
        }
        try {
            const walked = [];
            for (let el = from; el; el = el.parentElement) {
                if (darkCache.has(el)) { walked.forEach(w => darkCache.set(w, darkCache.get(el))); return darkCache.get(el); }
                walked.push(el);
                const style = getComputedStyle(el);
                const c = toRGBA(style.backgroundColor);
                let dark = c && c.a >= 0.5 ? luma(c) < 128 : null;
                const image = dark === null ? style.backgroundImage : null;
                if (image && image !== 'none') {
                    dark = gradientIsDark(image);
                    if (dark === null && /url\(/i.test(image)) {
                        const byText = textSaysDark(toRGBA(getComputedStyle(from).color));
                        if (byText !== null) return byText;
                    }
                }
                if (dark !== null) {
                    walked.forEach(w => darkCache.set(w, dark));
                    return dark;
                }
            }
            return canvasIsDark();
        } catch (e) {
            console.warn(`${LOG} theme detection failed, using system preference.`, e);
            return systemPrefersDark();
        }
    }

    // Each annotation takes the dark colors (DARK_OVERRIDES) when the background right behind it
    // is dark, so a dark code block on a light page gets them, and the page around it doesn't.
    // Panels match what they open next to (ensureUi); the page as a whole, for the toast, is
    // whatever is behind the middle of the view, not counting our own panels.
    function computeDarkMode() {
        const x = window.innerWidth / 2;
        const y = window.innerHeight / 2;
        const stack = typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(x, y) : [];
        const probe = stack.find(el => el !== uiHost) || document.body || document.documentElement;
        return darkBehind(probe);
    }

    function isDarkMode() {
        if (darkMode === null) darkMode = computeDarkMode();
        return darkMode;
    }

    // Re-checks the page theme and every annotation's background after a theme change.
    function refreshTheme() {
        if (!running) return;
        darkCache = null;
        const next = computeDarkMode();
        if (next !== darkMode) {
            darkMode = next;
            if (!panelOpen()) applyUiTheme(next);   // an open panel keeps the theme of what it is next to
            if (!toastEl.hidden) toastEl.setAttribute('data-theme', next ? 'dark' : 'light');
            if (penKey) setPen(penKey);
        }
        if (!panelEl.hidden) setPanelTheme(next);
        // Those whose background changed are all rebuilt first, then drawn together: one layout
        // of the page, not one per annotation.
        const flipped = allWrappers().filter(w => {
            if (darkBehind(w) !== w.hasAttribute(DARK_ATTR)) return true;
            updateInk(w);   // its text color may have changed
            return false;
        });
        const rebuilt = flipped.map(w => restyle(w, { draw: false })).filter(Boolean);
        if (!rebuilt.length) return;
        drawAnnotations(rebuilt);
        rebuilt.forEach(a => snapshotRect(a.element));
        updateSelectionVisibility();
    }

    let themeTimers = [];
    let themeCheckRequestedAt = 0;

    function clearThemeTimers() {
        themeTimers.forEach(clearTimeout);
        themeTimers = [];
    }

    function scheduleThemeCheck() {
        const now = Date.now();
        if (themeTimers.length) {
            // Debounced, but only for so long: a site that changes these attributes nonstop
            // (scroll-state classes, for example) must not postpone the check forever.
            if (now - themeCheckRequestedAt > THEME_CHECK_MAX_DEFER_MS) return;
            clearThemeTimers();
        } else {
            themeCheckRequestedAt = now;
        }
        themeTimers = THEME_CHECK_DELAYS_MS.map((ms, i) => setTimeout(() => {
            if (i === THEME_CHECK_DELAYS_MS.length - 1) themeTimers = [];
            refreshTheme();
        }, ms));
    }

    function watchTheme() {
        if (window.matchMedia) {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            if (mq.addEventListener) {
                listen(mq, 'change', scheduleThemeCheck);
            } else if (mq.addListener) {
                mq.addListener(scheduleThemeCheck);
                teardown.push(() => mq.removeListener(scheduleThemeCheck));
            }
        }
        if (typeof MutationObserver === 'function') {
            const mo = new MutationObserver(mutations => {
                if (mutations.some(m => THEME_ATTR_RE.test(m.attributeName || ''))) scheduleThemeCheck();
            });
            [document.documentElement, document.body].forEach(el => {
                if (el) mo.observe(el, { attributes: true });
            });
            teardown.push(() => mo.disconnect());
        }
        teardown.push(clearThemeTimers);
    }

    // STYLES[key] merged with its dark overrides when `dark` (by default, when the page is dark).
    function resolveStyle(key, dark = isDarkMode()) {
        return { ...STYLES[key], ...(dark && hasOwn(DARK_OVERRIDES, key) ? DARK_OVERRIDES[key] : null) };
    }

    // What drawing style `key` takes (on a dark background when `dark`): its type, color and
    // line width. Null for a style that doesn't exist.
    function getStyleConfig(key, dark) {
        if (!hasOwn(STYLES, key)) return null;
        const { type, color, strokeWidth } = resolveStyle(key, dark);
        return { type, color, strokeWidth: strokeWidth || 1 };
    }

    function getTextColor(key, dark) {
        const c = hasOwn(STYLES, key) ? resolveStyle(key, dark).textColor : '';
        if (typeof c !== 'string' || !c.trim()) return '';
        // A typo in the config is ignored instead of breaking the stylesheet.
        const ok = !(window.CSS && CSS.supports) || CSS.supports('color', c.trim());
        return ok ? c.trim() : '';
    }

    // WCAG contrast ratio of two { r, g, b } colors.
    function contrastRatio(a, b) {
        const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        const lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
    }

    // Automatic text color: where a highlight leaves the page's own text color hard to read
    // (white text on a colored banner over yellow, say), INK_ATTR turns it dark or light,
    // whichever reads better. A style's own textColor wins. Wrappers are queued and done
    // together, so a restore of many annotations reads styles once rather than once each.
    const inkQueue = new Set();
    function updateInk(wrapper) {
        if (!inkQueue.size) queueMicrotask(flushInk);
        inkQueue.add(wrapper);
    }

    function flushInk() {
        const todo = Array.from(inkQueue).filter(w => w.isConnected);
        inkQueue.clear();
        todo.forEach(w => w.removeAttribute(INK_ATTR));   // reads the page's own color, not ours
        const inks = todo.map(w => {
            const key = w.getAttribute(STYLE_ATTR);
            const dark = w.hasAttribute(DARK_ATTR);
            if (!hasOwn(STYLES, key) || getTextColor(key, dark)) return null;
            const style = resolveStyle(key, dark);
            if (style.type !== 'highlight') return null;
            const bg = toRGBA(style.color);
            const fg = toRGBA(getComputedStyle(w).color);
            if (!bg || !fg || !fg.a || contrastRatio(fg, bg) >= MIN_TEXT_CONTRAST) return null;
            return contrastRatio(toRGBA(INK.dark), bg) >= contrastRatio(toRGBA(INK.light), bg) ? 'dark' : 'light';
        });
        todo.forEach((w, i) => { if (inks[i]) w.setAttribute(INK_ATTR, inks[i]); });
    }

    // =====================================================================
    // Text color of annotated text
    // =====================================================================

    // One stylesheet drives the text color of annotated runs, so it applies to existing
    // annotations at once, follows each one's background (DARK_ATTR), and also wins over colors
    // set on inner elements such as links. It is switched off while annotations are hidden.
    const textColorStyle = document.createElement('style');
    function updateTextColorCss() {
        const rules = [];
        Object.keys(STYLES).forEach(k => {
            [false, true].forEach(dark => {
                const c = getTextColor(k, dark);
                if (!c) return;
                const sel = `${WRAPPER_SELECTOR}[${STYLE_ATTR}="${k}"]${dark ? `[${DARK_ATTR}]` : `:not([${DARK_ATTR}])`}`;
                rules.push(`${sel}, ${sel} * { color: ${c} !important; -webkit-text-fill-color: ${c} !important; }`);
            });
        });
        Object.keys(INK).forEach(ink => {
            const sel = `${WRAPPER_SELECTOR}[${INK_ATTR}="${ink}"]`;
            rules.push(`${sel}, ${sel} * { color: ${INK[ink]} !important; -webkit-text-fill-color: ${INK[ink]} !important; }`);
        });
        textColorStyle.textContent = rules.join('\n');
    }

    function setAnnotationsHidden(hidden) {
        if (annotationsHidden === hidden) return;
        annotationsHidden = hidden;
        hideStyle.media = hidden ? 'all' : 'not all';
        textColorStyle.media = hidden ? 'not all' : 'all';
        if (hidden) hideNoteCard();
        else if (toastRun === showAnnotations) hideToast();   // "Annotations hidden" is no longer true
    }

    function showAnnotations() {
        setAnnotationsHidden(false);
    }

    // Alt+V. Hiding says so, with a button that shows them again, so annotations that seem to have
    // gone missing can be found.
    function toggleAnnotationsHidden() {
        const hide = !annotationsHidden;
        setAnnotationsHidden(hide);
        if (hide) showToast('Annotations hidden', { icon: 'eye_off_20_regular', action: { label: 'Show', run: showAnnotations, keepEditor: true } });
    }

