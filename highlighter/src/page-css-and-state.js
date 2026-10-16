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
        /* Note badge: a small speech bubble (round, with one sharp corner at the bottom left)
           holding three dots, sitting on the top-right corner of an annotation that has a note.
           Zero net width (its width is cancelled by an equal negative margin), so it never moves
           text; a transform lifts it half out of the line, so it covers little of the text. Its
           rim and dots are in the background's color (light or dark, per DARK_ATTR), which keeps
           it apart from highlights and lines of any color, stacked or not. Drawn with gradients,
           not an image, so pages that limit images (CSP) still show it. Generated content isn't
           part of textContent or the selection, so saved offsets are unaffected. It grows with
           the font. */
        span[${NOTE_MARK_ATTR}]::after {
            --highlighter-badge: max(${NOTE_BADGE_SIZE}px, ${NOTE_BADGE_EM}em);
            --highlighter-badge-fill: ${NOTE_BADGE_COLOR};
            --highlighter-badge-rim: #ffffff;
            content: "" !important;
            display: inline-block !important;
            box-sizing: border-box !important;
            width: var(--highlighter-badge) !important; height: calc(var(--highlighter-badge) * 0.85) !important;
            margin: 0 0 0 calc(-1 * var(--highlighter-badge)) !important; padding: 0 !important; border: 0 !important;
            border-radius: 50% 50% 50% 8% !important;
            background:
                radial-gradient(circle, var(--highlighter-badge-rim) 0 45%, transparent 55%) 18% 50% / 22% 26% no-repeat,
                radial-gradient(circle, var(--highlighter-badge-rim) 0 45%, transparent 55%) 50% 50% / 22% 26% no-repeat,
                radial-gradient(circle, var(--highlighter-badge-rim) 0 45%, transparent 55%) 82% 50% / 22% 26% no-repeat,
                var(--highlighter-badge-fill) !important;
            box-shadow: 0 0 0 max(1.5px, 0.08em) var(--highlighter-badge-rim) !important;
            vertical-align: text-top !important;
            transform: translate(45%, -55%) !important;
            pointer-events: none !important;
        }
        span[${NOTE_MARK_ATTR}][${DARK_ATTR}]::after {
            --highlighter-badge-fill: ${NOTE_BADGE_DARK_COLOR};
            --highlighter-badge-rim: #1b1b1b;
        }
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

