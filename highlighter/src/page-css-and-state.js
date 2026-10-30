    // =====================================================================
    // Page CSS (added by start(), removed by stop())
    // =====================================================================

    const pageStyle = document.createElement('style');
    pageStyle.textContent = `
        ${WRAPPER_SELECTOR} {
            user-select: text !important;
            -webkit-user-select: text !important;
        }
        svg.highlighter-annotation {
            user-select: none !important;
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            pointer-events: none !important;
        }
        /* The selected part of an annotation: a line in the selected text's color, a highlight
           outlined in it (see markSelected). */
        svg[${SVG_ATTR}] g[${SELECTED_ATTR}] path { stroke: HighlightText !important; }
        svg[${SELECTED_ATTR}] rect { stroke: HighlightText !important; stroke-width: 1px !important; }
        /* Note badge: the Phosphor chat-teardrop-dots icon (a round bubble with one sharp corner
           at the bottom left, three dots), sitting on the top-right corner of an annotation that has a note.
           Zero net width (its width is cancelled by an equal negative margin), so it never moves
           text; a transform lifts it half out of the line, so it covers little of the text. Its
           rim is in the background's color (light or dark, per DARK_ATTR), which keeps
           it apart from highlights and lines of any color, stacked or not. Drawn as an inline SVG
           data image (badgeState), so a page whose CSP bars data images shows no badge. Generated content isn't
           part of textContent or the selection, so saved offsets are unaffected. It grows with
           the font. */
        span[${NOTE_MARK_ATTR}]::after {
            --highlighter-badge: max(${NOTE_BADGE_SIZE}px, ${NOTE_BADGE_EM}em);
            ${badgeState(NOTE_BADGE_COLOR, INK.dark, '#ffffff')}
            content: "" !important;
            display: inline-block !important;
            box-sizing: border-box !important;
            width: var(--highlighter-badge) !important; height: var(--highlighter-badge) !important;
            margin: 0 0 0 calc(-1 * var(--highlighter-badge)) !important; padding: 0 !important; border: 0 !important;
            background: var(--highlighter-badge-img) center / contain no-repeat !important;
            vertical-align: text-top !important;
            transform: translate(30%, -50%) !important;
            pointer-events: none !important;
        }
        span[${NOTE_MARK_ATTR}][${DARK_ATTR}]::after {
            ${badgeState(NOTE_BADGE_DARK_COLOR, INK.light, '#1b1b1b')}
        }
        /* The badge takes its annotation's color. Dots are dark on light pages and light on dark
           ones, so each color comes from the style's light or dark set, whichever is further from
           the dots (a red line's badge is the light red on a light page). Clicked to keep its note
           open, blue; while its annotation is selected or its note edited, the selection outline's
           color (see .select-box), which wins over pinned. These have dots in the rim's color. */
        ${Object.keys(STYLES).map(k => `
        span[${NOTE_MARK_ATTR}][${STYLE_ATTR}="${k}"]::after { ${badgeState(badgeColor(k, INK.dark), INK.dark, '#ffffff')} }
        span[${NOTE_MARK_ATTR}][${STYLE_ATTR}="${k}"][${DARK_ATTR}]::after { ${badgeState(badgeColor(k, INK.light), INK.light, '#1b1b1b')} }`).join('')}
        span[${NOTE_MARK_ATTR}][${NOTE_PIN_ATTR}]::after { ${badgeState(NOTE_BADGE_COLOR, '#ffffff', '#ffffff')} }
        span[${NOTE_MARK_ATTR}][${NOTE_PIN_ATTR}][${DARK_ATTR}]::after { ${badgeState(NOTE_BADGE_DARK_COLOR, '#1b1b1b', '#1b1b1b')} }
        span[${NOTE_MARK_ATTR}][${NOTE_SELECT_ATTR}]::after, span[${NOTE_MARK_ATTR}][${NOTE_EDIT_ATTR}]::after { ${badgeState('#000000', '#ffffff', '#ffffff')} }
        span[${NOTE_MARK_ATTR}][${NOTE_SELECT_ATTR}][${DARK_ATTR}]::after, span[${NOTE_MARK_ATTR}][${NOTE_EDIT_ATTR}][${DARK_ATTR}]::after { ${badgeState('#ffffff', '#1b1b1b', '#1b1b1b')} }
        /* An annotation jumped to (Alt+J / Alt+K, or from the panel) blinks twice. */
        svg[${FLASH_ATTR}] {
            animation: highlighter-flash ${FLASH_MS / 2}ms ease-in-out 2 !important;
        }
        @keyframes highlighter-flash { 50% { opacity: 0.15; } }
        /* A new annotation's strokes draw in from the left (see drawStrokes). */
        @keyframes highlighter-dash { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) {
            svg[${FLASH_ATTR}] { animation: highlighter-flash ${FLASH_MS}ms ease-in-out 1 !important; }
        }
    `;

    // The custom properties of one badge state: its colors (also read by the tests) and the Phosphor
    // icon as an SVG image in them: a rim (the icon's outline, widened), the icon, and its dots.
    function badgeState(fill, dots, rim) {
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-24 -24 304 304'>` +
            `<path d='${NOTE_BADGE_PATH}' fill='${rim}' stroke='${rim}' stroke-width='40' stroke-linejoin='round'/>` +
            `<path d='${NOTE_BADGE_PATH}' fill='${fill}'/>` +
            [88, 132, 176].map(cx => `<circle cx='${cx}' cy='128' r='12' fill='${dots}'/>`).join('') + `</svg>`;
        return `--highlighter-badge-fill: ${fill}; --highlighter-badge-dots: ${dots}; --highlighter-badge-rim: ${rim}; --highlighter-badge-img: url("data:image/svg+xml,${encodeURIComponent(svg)}");`;
    }

    // Of style `key`'s light and dark colors, the one with more contrast against the badge's `dots`.
    // shortcut: compares 6-digit hex only (STYLES' colors); otherwise the light page takes the light set.
    function badgeColor(key, dots) {
        const colors = [resolveStyle(key, false).color, resolveStyle(key, true).color];
        if (dots === INK.light) colors.reverse();
        const rgb = h => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
        if (!colors.every(c => /^#[0-9a-f]{6}$/i.test(c))) return colors[0];
        return contrastRatio(rgb(colors[1]), rgb(dots)) > contrastRatio(rgb(colors[0]), rgb(dots)) ? colors[1] : colors[0];
    }

    // Alt+V: hides every annotation drawing. Switched on and off through its media attribute.
    const hideStyle = document.createElement('style');
    hideStyle.textContent = `
        svg[${SVG_ATTR}], svg[${SELECTED_ATTR}], span[${NOTE_MARK_ATTR}]::after { visibility: hidden !important; }
    `;
    hideStyle.media = 'not all';

    // =====================================================================
    // State
    // =====================================================================

    const annotationMap = new WeakMap();   // wrapper -> its drawing (makeAnnotation)
    const rectCache = new WeakMap();       // wrapper -> last measured rects
    const selectedSVGs = new Set();          // SVGs with a selected part marked
    // About the page being shown (reset with currentKey, see resetPageTracking):
    const trackedRecords = new Map();      // wrapper -> its record when last placed or saved (see reclaimDetached)
    const knownOwners = new Set();         // annotations this tab has loaded or saved (see saveHighlights)
    const ownerState = new Map();          // annotation -> { content, rev, confirmed } as this tab last knew it (see stampOwners)
    const goneState = new Map();           // annotation -> when it was deleted, while that is remembered (see stampOwners)
    const reclaimedIds = new Map();        // recordId -> how many of its records wait since the site took them off the page
    const missedIds = new Set();           // records already counted as missing on this visit
    const putBackAt = new Map();           // recordId -> when a redrawn annotation was last put back
    const fights = new Map();              // recordId -> how often it was taken off again right after that
    const stubbornIds = new Set();         // records the page keeps taking off: not put back again this visit
    const noticedKeys = new Set();         // pages this tab has said it couldn't find annotations on (see noticeMissing)
    const undoStack = [];
    const redoStack = [];
    const teardown = [];                   // undoes what start() set up
    let running = false;                   // false while the script is turned off for this site
    let pendingRecords = [];               // saved records not yet placed in the DOM
    let annotationsHidden = false;
    let darkMode = null;
    let lastHref = location.href;
    let currentKey = null;                 // storage key of the page being shown
    let settledCanonical = null;           // the canonical URL seen when currentKey was decided
    let lastSeenCanonical = null;          // the canonical URL at the last check before any URL change
    let nav = null;                        // an in-page URL change not settled yet
    let restoreTimer = null;

    function listen(target, type, fn, options) {
        target.addEventListener(type, fn, options);
        teardown.push(() => target.removeEventListener(type, fn, options));
    }

