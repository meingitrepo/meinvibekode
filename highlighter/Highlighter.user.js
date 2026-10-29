// ==UserScript==
// @name         Highlighter
// @namespace    Violentmonkey Scripts
// @version      9.18
// @description  Highlight, underline, strike through and add notes to the text of any web page; saved per page
// @author       Mhmd & Claude
// @match        *://*/*
// @match        file:///*
// @noframes
// @downloadURL  https://raw.githubusercontent.com/meingitrepo/meinvibekode/main/highlighter/Highlighter.user.js
// @updateURL    https://raw.githubusercontent.com/meingitrepo/meinvibekode/main/highlighter/Highlighter.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_setClipboard
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// ==/UserScript==

/*
 * Shortcuts (Alt + key, matched by physical key so they work on non-Latin layouts;
 * written for Windows):
 *   1 / 2 / 3 (or H)      highlight in cyan / magenta / yellow
 *   U / S                 underline / strike-through
 *                         (the style the selected text already has does nothing; Alt+D erases)
 *                         With nothing selected, these restyle the annotation under the mouse, or
 *                         the one just jumped to, keeping its note; its own style does nothing (Alt+D erases).
 *   N                     add or edit a note: on the selected annotation, on the annotation
 *                         under the mouse, or on new selected text (it gets a highlight)
 *   D / Delete            erase annotations from the selected text (what is left of them stays);
 *                         with nothing selected, the annotation under the mouse, all of it
 *                         (D on an annotation with a note deletes the note first; D again erases it)
 *   Shift+D / Shift+Del   erase every annotation on the page
 *   V                     hide / show all annotations (nothing is deleted; a message says they're hidden)
 *   P                     pen on / off: every mouse selection gets the pen's style at once (it starts
 *                         with the style used last; a style key with nothing selected or pointed at
 *                         changes it). A pill at the top shows it; Esc turns it off.
 *   T                     selection toolbar off / on, on every site (the keys keep working)
 *   O                     open / close the annotations panel
 *   Shift+O               search every page's annotations and notes; a quote opens its page there
 *   J / K                 jump to the next / previous annotation (shows its note, if any)
 *   Z                     undo
 *   Shift+Z or Y          redo
 *   Shift+K               shortcut keys off / on, on every site. While on, every Alt key outside a
 *                         field is the highlighter's alone: the site's own Alt shortcuts (such as
 *                         Wikipedia's) don't run. Off, the site gets them back and ours do nothing.
 *
 * Clicking an annotation selects it: a solid box goes around all of it. Ctrl+click
 * adds one or takes it out again; Shift+click selects all of them from the last one selected to
 * the one clicked. While annotations are selected, the style keys, N (the first one's note) and
 * D / Delete act on all of them (D on a single one with a note deletes the note first), with or without Alt; Esc, clicking elsewhere
 * or selecting text lets it go. The selection toolbar shows over it too, its buttons acting on
 * it. A click on a link inside annotated text just follows the link.
 *
 * Selecting text also shows a small toolbar with the same actions, for mouse and touch use
 * (Alt+T switches it off and on for every site; ENABLE_SELECTION_TOOLBAR removes it), centered above the selection. The style the
 * selected text already has shows pressed. It is one Tab stop: the arrow keys, Home and End
 * move between its buttons. In the note editor, Tab goes round its controls. Annotations with a note have a small blue speech
 * bubble on their top-right corner; resting the pointer on or near one shows the note under it, with the
 * date it was added and buttons to edit or delete it. Web addresses in a note are links there.
 *
 * Spaces at the edges of a selection are left out, and a word it cuts in two is annotated
 * whole (SNAP_SELECTION_TO_WORDS turns that off). Triple-click selects the paragraph under
 * the pointer as it is shown.
 *
 * The annotations panel lists every annotation on the page with its note and the date it
 * was added. Click one to scroll to it; edit its note or delete it from the list; filter by
 * text or note (so #tags written in notes work as tags). Saved annotations whose text can't
 * be found are listed under "Not found", where they can be deleted or attached to text you
 * select. The panel's Copy button, and the menu, copy the annotations as Markdown: the page's
 * title and link, then each annotation as a quote, linked to its passage, with its note.
 *
 * Saved annotations are found again even when the text around them changed a little (its
 * capitals, spacing or a word). Text that loads late (comments, "load more") gets its
 * annotations whenever it arrives while the page is open. Annotations still missing after the
 * first 15 seconds are counted in a message, once per page, whose Show button opens the panel
 * at "Not found".
 *
 * Removing annotations or a note shows a short message with Undo. A note closed without
 * saving can be brought back from the message that appears.
 *
 * The script is off on every site until switched on: a sticky menu (top left, draggable; Alt+Shift+M
 * hides or shows it) holds the site's switch and, once it is on, a column of buttons: undo, redo, the two panels,
 * hide annotations, pen, selection toolbar and shortcuts.
 *
 * The userscript manager's menu can also open the panel, copy as Markdown, clear this page,
 * forget annotations whose text is gone (when there are some), turn the script off for the
 * current site, and clear everything. Its labels give the counts.
 *
 * Styles, colors and shortcuts are set in the code: see STYLES and DARK_OVERRIDES in the
 * Configuration section.
 *
 * Annotations are stored per page. When the page declares a canonical URL
 * (<link rel="canonical">), that URL is the key, so one article reached through several
 * URLs (tracking links, mobile or AMP versions) shares its annotations. Pages that share a
 * canonical URL without being the same (the pages of a thread, often) share the list, but each
 * annotation remembers its page: on the others it isn't counted as missing, and the panel
 * lists it under "Saved on other pages".
 *
 * Annotations are drawn by the script itself (straight SVG strokes); it loads no library. New
 * ones draw in from the left, or appear at once where Windows is set to show fewer animations.
 *
 * Fonts: the panels use the Anthropic look, set in Georgia (text and notes) and Inter (buttons and
 * labels). Georgia is part of Windows; Inter is not, so install it (https://rsms.me/inter/) for the
 * intended look. Without it the panels fall back to the system font. Nothing is downloaded: the
 * script never loads fonts from the web.
 *
 * This file is built from the files in src/ by build.js: edit those, then run node build.js.
 */

(function () {
    'use strict';

    const LOG = '[Highlighter]';

    // =====================================================================
    // Configuration
    // =====================================================================

    const WRAPPER_ATTR = 'data-highlighter-wrapper';
    const STYLE_ATTR = 'data-style-key';
    const SVG_ATTR = 'data-highlighter-svg';
    const SELECTED_ATTR = 'data-highlighter-selected-part';     // on the selected part of a line (see markSelected)
    const GROUP_ATTR = 'data-highlighter-group';      // shared by the pieces of one annotation
    const NOTE_ATTR = 'data-highlighter-note';
    const NOTE_MARK_ATTR = 'data-highlighter-note-mark';  // the piece that shows the note badge
    const NOTE_PIN_ATTR = 'data-highlighter-note-pin';    // on that piece while its badge was clicked to keep the note open
    const NOTE_EDIT_ATTR = 'data-highlighter-note-edit';  // on an annotation's pieces while its note editor is open
    const NOTE_SELECT_ATTR = 'data-highlighter-note-selected';  // on the badge's piece while its annotation is selected (outlined)
    const INK_ATTR = 'data-highlighter-ink';          // 'dark' / 'light': text recolored to read on its highlight
    const DARK_ATTR = 'data-highlighter-dark';        // on a dark background: drawn with DARK_OVERRIDES
    const ADDED_ATTR = 'data-highlighter-added';      // when it was first seen, for annotations whose group has no date
    const PAGE_ATTR = 'data-highlighter-page';        // the page it was made on, where pages share a canonical URL (see pageTag)
    const FLASH_ATTR = 'data-highlighter-flash';      // on an annotation's drawing while it flashes (see flashGroup)
    const UI_ATTR = 'data-highlighter-ui';
    const WRAPPER_SELECTOR = `span[${WRAPPER_ATTR}]`;
    const IGNORED_TEXT_SELECTOR = 'script, style, noscript, textarea';
    const SETTINGS_KEY = 'rnh:settings';       // per-site on/off, toolbar and keys on/off; every other stored key is a page
                                               // ('rnh' is the old name, RoughNotation Highlighter: kept so saved settings stay)

    const DRAW_IN_MS = 200;                    // a new annotation draws in over this long
    const ANIMATE_ON_RESTORE = false;          // restored annotations appear instantly
    const CONTEXT_LENGTH = 24;                 // prefix/suffix characters stored per record
    const UNDO_STACK_LIMIT = 20;
    const RESTORE_DELAY_MS = 400;
    const LATE_CONTENT_MAX_ATTEMPTS = 20;       // annotations not found at first are looked for as the page changes:
    const LATE_CONTENT_GIVE_UP_MS = 15000;      // closely for this long or this many tries (then they count as missed),
    const LATE_CONTENT_SLOW_RETRY_MS = 2000;    // then at most this often while the page is open and in view
    const LOOSE_MATCH_MIN_SCORE = 0.5;          // restoring: how much of an annotation's surrounding text must still agree (0 to 1)
    const LOOSE_MATCH_MARGIN = 0.15;            // where its text no longer has the same surroundings, and by how much more
                                                // than at any other place with that text
    const LOOSE_MATCH_MAX_PLACES = 200;         // a text found more often than this on the page is too common to tell apart
    const REDRAW_FIGHT_MS = 1500;               // an annotation taken off this soon after being put back,
    const REDRAW_FIGHT_LIMIT = 3;               // this many times in a row, isn't put back again during the visit
    // After this many page loads without a match, a record stops being watched for late content
    // and is only tried once per load. It is never deleted automatically.
    const MAX_RESTORE_MISSES = 5;
    const THEME_CHECK_DELAYS_MS = [250, 1200];  // the second check catches theme switches animated with a CSS transition
    const THEME_CHECK_MAX_DEFER_MS = 1000;      // attribute churn may postpone a theme check this long, no longer
    const ENABLE_TRIPLE_CLICK_BLOCK_SELECT = true;   // triple-click selects the paragraph as shown, without its edge spaces
    const SNAP_SELECTION_TO_WORDS = true;       // a selection that cuts a word in two annotates the whole word
    const ENABLE_SELECTION_TOOLBAR = true;
    const NOTE_CARD_DELAY_MS = 300;             // the pointer rests this long on or near a note badge before its note shows
    const NOTE_BADGE_REACH = 8;                 // px around the badge that count as near it
    const TOOLBAR_IDLE_MS = 4000;               // the selection toolbar fades out after this long untouched (0 = never)
    const TOAST_MS = 4000;                      // how long a message stays up,
    const TOAST_ACTION_MS = 6000;               // or one with a button such as Undo (pointing at it keeps it)
    const NOTE_STYLE_KEY = 'h';                 // style given to plain text that receives a note
    const NOTE_MAX_LENGTH = 2000;
    const NOTE_MIN_LINES = 2;                   // the note box starts this tall,
    const NOTE_MAX_LINES = 12;                  // grows with the text up to this (the note card's 240px), then scrolls
    const NOTE_BADGE_SIZE = 10;                 // px, at least; the speech-bubble badge on annotations with a note,
    const NOTE_BADGE_EM = 0.6;                  // which grows with the font (0.6em: 10px at 16px, 19px on a 32px heading)
    const NOTE_BADGE_COLOR = '#d97757';         // clay, the Anthropic accent: the badge while its note is pinned,
    const NOTE_BADGE_DARK_COLOR = '#d97757';    // and on dark backgrounds (clay reads on both)
    const FLASH_MS = 900;                       // an annotation jumped to blinks twice in this time
    const MARKDOWN_FRAGMENT_WORDS = 5;          // a long quote's link names its passage by this many words at each end
    const TRACKING_PARAM_RE = /^(utm_|fbclid$|gclid$|dclid$|msclkid$|mc_eid$|mc_cid$|igshid$|yclid$|_ga$|ref_src$)/i;
    const SITE_PREFIX_RE = /^(www|m|mobile|amp)\./i;  // host prefixes that still count as the same site

    // ---- EDIT STYLES HERE --------------------------------------------------
    //   label      name shown in the selection toolbar's tooltips
    //   shortcut   key(s) pressed with Alt, as KeyboardEvent.code: 'KeyH', 'Digit2', 'Comma', ...
    //   color      color of the annotation drawing (any CSS color: '#FFEF6E', 'green', ...)
    //   textColor  color of the annotated text ('' = keep the page's own text color)
    //   type       'highlight', 'underline' or 'strike-through'
    //   strokeWidth  underline and strike-through only: line width in px (1 if left out)
    // A highlight is always 95% of the line's height (see "Drawing").
    // The selection toolbar shows the styles in this order.
    // The style's name (h, h2, u, ...) is what gets saved with each annotation, so renaming
    // or removing a style hides the annotations made with it. They stay saved and come back
    // when the style does. `retired: true` keeps a style's saved annotations drawing but takes
    // it out of the toolbar (give it no shortcut either).
    // DARK_OVERRIDES replaces any of these values for annotations on a dark background (a dark
    // page, or a dark box on a light one). Its highlights are dark enough for light text (about
    // 4.5:1 against light gray). Where a highlight leaves the page's own text color hard to read
    // (under MIN_TEXT_CONTRAST), the text turns dark or light by itself; a textColor here
    // overrides that, for example { color: '#444', textColor: '#fff' }.
    const HIGHLIGHT = { type: 'highlight', textColor: '' };
    const STYLES = {
        h2: { ...HIGHLIGHT, label: 'Cyan highlight', shortcut: 'Digit1', color: '#8CE6F2' },     // was green before 8.6
        h4: { ...HIGHLIGHT, label: 'Magenta highlight', shortcut: 'Digit2', color: '#F2A0E8' }, // was pink before 8.6
        h:  { ...HIGHLIGHT, label: 'Yellow highlight', shortcut: ['KeyH', 'Digit3'], color: '#FFEF6E' },
        h3: { ...HIGHLIGHT, label: 'Blue highlight', retired: true, color: '#90CAF9' },
        h5: { ...HIGHLIGHT, label: 'Orange highlight', retired: true, color: '#FFCC80' },
        u:  { label: 'Underline', shortcut: 'KeyU', type: 'underline', color: '#D32F2F', textColor: '', strokeWidth: 1 },   // clear red at 1px, 5:1 on white
        s:  { label: 'Strikethrough', shortcut: 'KeyS', type: 'strike-through', color: '#D32F2F', textColor: '', strokeWidth: 1 }
    };
    const DARK_OVERRIDES = {
        h:  { color: '#7A6200' },   // dark gold
        h2: { color: '#006D7A' },   // deep cyan
        h3: { color: '#1565C0' },
        h4: { color: '#9C1F8C' },   // deep magenta
        h5: { color: '#B23C00' },   // deep orange
        u:  { color: '#FF5F57' },   // warm light red: reads red, not pink, on dark (6:1)
        s:  { color: '#FF5F57' }
    };
    const MIN_TEXT_CONTRAST = 3;                // below this against its highlight, text turns dark or light
    const INK = { dark: '#1b1b1b', light: '#ffffff' };   // the text colors it turns to
    // ------------------------------------------------------------------------

    const CODE_TO_STYLE = new Map();
    Object.keys(STYLES).forEach(k => {
        [].concat(STYLES[k].shortcut || []).forEach(code => CODE_TO_STYLE.set(code, k));
    });

    function hasOwn(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
    }

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
           rim is in the background's color (light or dark, per DARK_ATTR), which keeps
           it apart from highlights and lines of any color, stacked or not. Drawn with gradients,
           not an image, so pages that limit images (CSP) still show it. Generated content isn't
           part of textContent or the selection, so saved offsets are unaffected. It grows with
           the font. */
        span[${NOTE_MARK_ATTR}]::after {
            --highlighter-badge: max(${NOTE_BADGE_SIZE}px, ${NOTE_BADGE_EM}em);
            --highlighter-badge-fill: ${NOTE_BADGE_COLOR};
            --highlighter-badge-rim: #ffffff;
            --highlighter-badge-dots: ${INK.dark};
            content: "" !important;
            display: inline-block !important;
            box-sizing: border-box !important;
            width: var(--highlighter-badge) !important; height: calc(var(--highlighter-badge) * 0.85) !important;
            margin: 0 0 0 calc(-1 * var(--highlighter-badge)) !important; padding: 0 !important; border: 0 !important;
            border-radius: 50% 50% 50% 8% !important;
            background:
                radial-gradient(circle, var(--highlighter-badge-dots) 0 45%, transparent 55%) 18% 50% / 22% 26% no-repeat,
                radial-gradient(circle, var(--highlighter-badge-dots) 0 45%, transparent 55%) 50% 50% / 22% 26% no-repeat,
                radial-gradient(circle, var(--highlighter-badge-dots) 0 45%, transparent 55%) 82% 50% / 22% 26% no-repeat,
                var(--highlighter-badge-fill) !important;
            box-shadow: 0 0 0 max(1.5px, 0.08em) var(--highlighter-badge-rim) !important;
            vertical-align: text-top !important;
            transform: translate(45%, -55%) !important;
            pointer-events: none !important;
        }
        span[${NOTE_MARK_ATTR}][${DARK_ATTR}]::after {
            --highlighter-badge-fill: ${NOTE_BADGE_DARK_COLOR};
            --highlighter-badge-rim: #1b1b1b;
            --highlighter-badge-dots: ${INK.light};
        }
        /* The badge takes its annotation's color. Dots are dark on light pages and light on dark
           ones, so each color comes from the style's light or dark set, whichever is further from
           the dots (a red line's badge is the light red on a light page). Clicked to keep its note
           open, blue; while its annotation is selected or its note edited, the selection outline's
           color (see .select-box), which wins over pinned. These have dots in the rim's color. */
        ${Object.keys(STYLES).map(k => `
        span[${NOTE_MARK_ATTR}][${STYLE_ATTR}="${k}"]::after { --highlighter-badge-color: ${badgeColor(k, INK.dark)}; }
        span[${NOTE_MARK_ATTR}][${STYLE_ATTR}="${k}"][${DARK_ATTR}]::after { --highlighter-badge-color: ${badgeColor(k, INK.light)}; }`).join('')}
        span[${NOTE_MARK_ATTR}][${STYLE_ATTR}]::after { --highlighter-badge-fill: var(--highlighter-badge-color); }
        span[${NOTE_MARK_ATTR}][${NOTE_PIN_ATTR}]::after { --highlighter-badge-fill: ${NOTE_BADGE_COLOR}; --highlighter-badge-dots: var(--highlighter-badge-rim); }
        span[${NOTE_MARK_ATTR}][${NOTE_PIN_ATTR}][${DARK_ATTR}]::after { --highlighter-badge-fill: ${NOTE_BADGE_DARK_COLOR}; }
        span[${NOTE_MARK_ATTR}][${NOTE_SELECT_ATTR}]::after, span[${NOTE_MARK_ATTR}][${NOTE_EDIT_ATTR}]::after { --highlighter-badge-fill: #000000; --highlighter-badge-dots: var(--highlighter-badge-rim); }
        span[${NOTE_MARK_ATTR}][${NOTE_SELECT_ATTR}][${DARK_ATTR}]::after, span[${NOTE_MARK_ATTR}][${NOTE_EDIT_ATTR}][${DARK_ATTR}]::after { --highlighter-badge-fill: #ffffff; }
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
            renderSiteMenu();
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
        if (hidden) { hideNoteCard(); unpinNoteCard(); }
        else if (toastRun === showAnnotations) hideToast();   // "Annotations hidden" is no longer true
        renderSiteMenu();   // the menu's hide button shows the eye for what it does next
    }

    function showAnnotations() {
        setAnnotationsHidden(false);
    }

    // Alt+V. Hiding says so, with a button that shows them again, so annotations that seem to have
    // gone missing can be found.
    function toggleAnnotationsHidden() {
        const hide = !annotationsHidden;
        setAnnotationsHidden(hide);
        if (hide) showToast('Annotations hidden', { icon: 'eye-slash', action: { label: 'Show', tip: 'Show annotations', shortcut: 'Alt+V', run: showAnnotations, keepEditor: true } });
    }

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
    // layers, the outermost at the bottom. It is drawn whole, as the background, and each of n
    // layers gets 1/n of the height: the topmost at the top, the background's own band just
    // under it, then the rest down to the second layer at the bottom. With two, the background
    // is the top half and the other the bottom half. A layer counts the highlights inside it
    // too, so it keeps its band where they leave off. { slot, of } with slot 0 at the top, or
    // null for the background (a highlight with none around it).
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
        const of = layers.length;
        const i = layers.indexOf(key);                // 1 is the layer on the background
        return { slot: of > 2 && i === of - 1 ? 0 : of - i, of };
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
    // With reduced motion asked for (a Windows setting), nothing draws in: it is there at once.
    function drawAnnotations(anns, { stagger = false } = {}) {
        const still = prefersReducedMotion();   // see toast-and-jump.js
        const measured = anns.map(measureAnnotation);
        const groupOf = a => a.element.getAttribute(GROUP_ATTR) || a;
        const lengthOf = m => m.rects.reduce((sum, r) => sum + r.w, 0);
        const lengths = new Map();   // group -> length of its pieces that draw in
        anns.forEach((a, i) => {
            if (!measured[i] || a.drawn || !a.animate || still) return;
            lengths.set(groupOf(a), (lengths.get(groupOf(a)) || 0) + lengthOf(measured[i]));
        });
        const starts = new Map();    // group -> when its next piece starts
        let delay = 0;
        anns.forEach((a, i) => {
            if (innerToRedraw.has(a.element)) innerToRedraw.delete(a.element);   // drawn now (see redrawInner)
            if (!measured[i]) return;
            const animate = !a.drawn && a.animate && !still;
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
    const watchesVisibility = typeof IntersectionObserver === 'function';
    const visibilityObserver = watchesVisibility
        ? new IntersectionObserver(entries => {
            // Also while the script is off: a wrapper the site puts back then is followed once it is on.
            entries.forEach(e => {
                if (!e.isIntersecting) { nearWrappers.delete(e.target); return; }
                if (!annotationMap.has(e.target)) return;   // unwrapped since
                nearWrappers.add(e.target);
                shownWrappers.add(e.target);   // back on the page after the site took it off
            });
            if (running) reposition(entries.filter(e => e.isIntersecting && rectChanged(e.target)).map(e => e.target));
        }, { rootMargin: '200px', threshold: 0 })
        : { observe() {}, unobserve() {} };

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
        if (watchesVisibility) {
            let ws;
            if (scope === 'near') {
                ws = Array.from(nearWrappers);
            } else {
                pruneShown();
                ws = Array.from(shownWrappers);
                if (scope === 'view') ws = ws.filter(inView);
            }
            reposition(ws.filter(w => w.isConnected && textMoved(w)));
            return;
        }
        reposition(allWrappers().filter(w => (scope === 'all' || inView(w)) && textMoved(w)));
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
        if (watchesVisibility && !shownWrappers.size) return;   // nothing on the page: nothing to do, however big the page
        if (e && e.type === 'resize') redrawResized = true;
        if (!redrawFrame) {
            redrawFrame = requestAnimationFrame(() => {
                redrawFrame = 0;
                const scope = redrawResized ? 'view' : 'near';
                redrawResized = false;
                redrawMoved(scope);
            });
        }
        if (nearOnly === true && watchesVisibility) return;
        clearTimeout(redrawTimer);
        const wait = Math.max(150, lastFullRedraw + FULL_REDRAW_GAP_MS - performance.now());
        redrawTimer = setTimeout(() => { lastFullRedraw = performance.now(); redrawMoved('all'); }, wait);
    }

    // The site's own settings (a bigger font, more padding, another theme) restyle the page
    // without resizing it: a style or class set on any element, or a stylesheet added, changed
    // or removed. The annotations near the screen then follow their text in the next frame.
    // Changes on our own drawings (SVG) and wrappers are left out.
    function watchPageStyle() {
        if (typeof MutationObserver !== 'function') return () => {};
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

    // =====================================================================
    // Page identity: which stored list belongs to this page
    // =====================================================================

    // Hash fragments and tracking parameters shouldn't create a "different page".
    // Hash routes (#/path, #!/path) are kept because they are real navigation.
    function urlKey(href) {
        try {
            const u = new URL(href);
            Array.from(u.searchParams.keys()).forEach(k => { if (TRACKING_PARAM_RE.test(k)) u.searchParams.delete(k); });
            if (!/^#[!/]/.test(u.hash)) u.hash = '';
            return u.href;
        } catch (e) {
            return href;
        }
    }

    function sameSite(hostA, hostB) {
        return hostA.replace(SITE_PREFIX_RE, '').toLowerCase() === hostB.replace(SITE_PREFIX_RE, '').toLowerCase();
    }

    // The page's <link rel="canonical"> as a storage key, when it can be trusted to name this page.
    function canonicalKey() {
        if (/^#[!/]/.test(location.hash)) return null;   // hash-routed apps: the canonical ignores the route
        const link = canonicalLink();
        if (!link) return null;
        try {
            const u = new URL(link.href, location.href);
            if (!/^https?:$/.test(u.protocol) || !sameSite(u.hostname, location.hostname)) return null;
            // Pointing every page at the home page is a common site misconfiguration.
            if (u.pathname === '/' && !u.search && location.pathname !== '/') return null;
            return urlKey(u.href);
        } catch (e) {
            return null;
        }
    }

    // The first link[rel~="canonical" i][href], as document.querySelector would find it. It is
    // looked for every second (see onUrlMaybeChanged): the browser keeps this list of the page's
    // links between changes to the page, where querySelector searched a big page all over each
    // time (2 ms on 180,000 elements).
    let linkElements = null;
    function canonicalLink() {
        if (!linkElements) linkElements = document.getElementsByTagName('link');
        for (const link of linkElements) {
            if (link.hasAttribute('href') && /(^|[ \t\n\f\r])canonical([ \t\n\f\r]|$)/i.test(link.getAttribute('rel') || '')) return link;
        }
        return null;
    }

    // Pages can share a storage key: the pages of a thread whose canonical URL names its first
    // page, say. What is made on a page with a canonical URL remembers which one it was: '' for
    // the page the key names, else its own URL. Undefined where the key is the page's own URL
    // (no canonical), so nothing else can share it.
    function pageTag() {
        if (!currentKey || currentKey !== settledCanonical) return undefined;
        const here = urlKey(location.href);
        return here === currentKey ? '' : here;
    }

    // Was the record made on another page that shares this page's key? It is still put back
    // when its text is here, but it isn't missing when it isn't (see missingRecords). Records
    // saved before 7.30 carry no page and count as this page's.
    function isOtherPage(r) {
        if (typeof r.page !== 'string') return false;
        return (r.page || currentKey) !== urlKey(location.href);
    }

    // =====================================================================
    // Records, storage
    // =====================================================================

    function wrapperExtent(wrapper, block) {
        const pre = document.createRange();
        pre.setStart(block, 0);
        pre.setEndBefore(wrapper);
        const start = pre.toString().length;
        dropRange(pre);
        return { start, end: start + wrapper.textContent.length };
    }

    function getCurrentRecords() {
        const lost = takeDetached();
        const fullTextByBlock = new Map();
        const xpathByBlock = new Map();
        const siblingCache = new Map();
        const records = allWrappers().map(wrapper => {
            const block = getBlockParent(wrapper);
            let full = fullTextByBlock.get(block);
            if (full === undefined) { full = block.textContent; fullTextByBlock.set(block, full); }
            let xpath = xpathByBlock.get(block);
            if (xpath === undefined) { xpath = getXPath(block, siblingCache); xpathByBlock.set(block, xpath); }
            const { start, end } = wrapperExtent(wrapper, block);
            const record = {
                xpath,
                startOffset: start,
                length: end - start,
                key: wrapper.getAttribute(STYLE_ATTR),
                text: wrapper.textContent,
                prefix: full.slice(Math.max(0, start - CONTEXT_LENGTH), start),
                suffix: full.slice(end, end + CONTEXT_LENGTH),
                group: wrapper.getAttribute(GROUP_ATTR) || undefined,
                note: wrapper.getAttribute(NOTE_ATTR) || undefined,
                added: +wrapper.getAttribute(ADDED_ATTR) || undefined,
                page: wrapper.hasAttribute(PAGE_ATTR) ? wrapper.getAttribute(PAGE_ATTR) : undefined
            };
            trackedRecords.set(wrapper, record);
            return record;
        });
        reclaimDetached(lost, records);
        return records;
    }

    // A site that re-renders part of its page throws our wrappers away with the old content.
    // Their annotations go back to the queue of records waiting for their text, so they come
    // back when it does, instead of silently dropping out of the next save.
    // Takes the records of wrappers that left the page out of tracking, and counts how many
    // tracked records share each recordId (several pieces of one annotation can). Null when
    // every tracked wrapper is still on the page.
    function takeDetached() {
        if (!anyDetached()) return null;
        const lost = new Set();
        const known = new Map();   // recordId -> tracked records with it
        trackedRecords.forEach((record, wrapper) => {
            const id = recordId(record);
            if (!known.has(id)) known.set(id, new Set());
            known.get(id).add(record);
            if (wrapper.isConnected) return;
            trackedRecords.delete(wrapper);
            lost.add(record);
        });
        return { records: Array.from(lost), known };
    }

    let reclaimTimer = null;

    function reclaimDetached(detached, current) {
        if (!detached) return;
        const { records: lost, known } = detached;
        // A lost record is queued unless it is still on the page: the site may have put our
        // wrapper back, or a copy of it, into its new content.
        const same = r => `${recordSignature(r)}|${r.text}`;
        const sigs = new Set(current.map(same));
        const present = new Map();   // recordId -> how many current records have it
        current.forEach(r => present.set(recordId(r), (present.get(recordId(r)) || 0) + 1));
        let queued = false;
        lost.forEach(record => {
            const id = recordId(record);
            const have = present.get(id) || 0;
            if (sigs.has(same(record)) || have >= known.get(id).size) return;
            present.set(id, have + 1);
            const { misses, ...fresh } = record;   // it was found on this visit: not a miss
            pendingRecords.push(fresh);
            // A page that takes it off again right after each return (a component that undoes
            // outside changes) would fight us forever: after a few rounds it stays saved, unplaced.
            if (Date.now() - (putBackAt.get(id) || -Infinity) < REDRAW_FIGHT_MS) {
                fights.set(id, (fights.get(id) || 0) + 1);
                if (fights.get(id) >= REDRAW_FIGHT_LIMIT) stubbornIds.add(id);
            } else {
                fights.delete(id);
            }
            if (stubbornIds.has(id)) return;
            reclaimedIds.set(id, (reclaimedIds.get(id) || 0) + 1);
            queued = true;
        });
        if (queued) retryReclaimedSoon();
    }

    // Looks for redrawn annotations' text right away (it is usually back already), then as the
    // page changes, closely for a while (a watcher already in its slow phase starts over).
    // Not in the same call: this can run in the middle of a retry.
    function retryReclaimedSoon() {
        clearTimeout(reclaimTimer);
        reclaimTimer = setTimeout(() => {
            if (!running || nav) return;
            if (!lateWatcher || lateWatcher.slow) startLateWatcher({ reclaimedOnly: true });
            if (lateWatcher) retryNow(lateWatcher);
        }, 0);
    }

    function anyDetached() {
        for (const wrapper of trackedRecords.keys()) {
            if (!wrapper.isConnected) return true;
        }
        return false;
    }

    // Called every second: notices annotations a site threw away without any edit of ours.
    function checkDetached() {
        if (running && !nav && anyDetached()) getCurrentRecords();
    }

    function isReclaimed(record) {
        return reclaimedIds.has(recordId(record));
    }

    // A redrawn record is back (placed, or found to be a copy of what is there).
    function releaseReclaimed(record) {
        const id = recordId(record);
        const n = reclaimedIds.get(id) || 0;
        if (!n) return;
        if (n > 1) reclaimedIds.set(id, n - 1);
        else reclaimedIds.delete(id);
        putBackAt.set(id, Date.now());
    }

    // Forgets what was learned about the page being shown, when it changes.
    function resetPageTracking() {
        trackedRecords.clear();
        knownOwners.clear();
        reclaimedIds.clear();
        missedIds.clear();
        putBackAt.clear();
        fights.clear();
        stubbornIds.clear();
        noticeDue = false;
    }

    function recordSignature(r) {
        return `${r.xpath}|${r.startOffset}|${r.length}|${r.key}`;
    }

    // Identifies a record across saves and tabs. Unlike recordSignature, it survives relocation.
    function recordId(r) {
        return `${r.group || ''}|${r.key}|${r.text}`;
    }

    function parseRecords(raw) {
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter(r => r && typeof r === 'object') : null;
        } catch (e) {
            return null;
        }
    }

    function readRecords(key) {
        return parseRecords(GM_getValue(key, null));
    }

    // Which annotation a record belongs to: its group (shared by the annotation's pieces), or
    // for records saved before groups existed, the group it gets when placed.
    function recordOwner(r) {
        return r.group || legacyGroup(r);
    }

    // Annotations saved before groups existed get one derived from what they are, so every tab
    // names them the same.
    function legacyGroup(r) {
        const s = `${r.xpath}|${r.startOffset}|${r.key}|${r.text}`;
        let h = 5381;
        for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
        return `old-${h.toString(36)}`;
    }

    function loadRecords() {
        const records = loadStoredRecords();
        records.forEach(r => knownOwners.add(recordOwner(r)));
        return records;
    }

    function loadStoredRecords() {
        const records = readRecords(currentKey) || [];
        // Annotations saved under this page's plain URL (by older versions, or before the site
        // declared a canonical URL) move to the current key.
        const legacyKeys = Array.from(new Set([urlKey(location.href), location.href])).filter(k => k !== currentKey);
        const moved = [];
        legacyKeys.forEach(k => {
            const old = readRecords(k);
            if (old) { records.push(...old); moved.push(k); }
        });
        if (!moved.length) return records;
        const seen = new Set();
        const merged = records.filter(r => {
            const sig = `${recordSignature(r)}|${r.text}`;
            if (seen.has(sig)) return false;
            seen.add(sig);
            return true;
        });
        GM_setValue(currentKey, JSON.stringify(merged));
        moved.forEach(k => GM_deleteValue(k));
        return merged;
    }

    function saveHighlights(records) {
        if (!running || !currentKey) return;
        schedulePanelRefresh();
        scheduleMenuRefresh();
        const own = (records || getCurrentRecords()).concat(pendingRecords);
        // Another tab showing this page may have saved annotations this tab never loaded: they
        // are kept. An annotation this tab did load or save is this tab's to write: as it is
        // here, or gone if it was removed here.
        const raw = GM_getValue(currentKey, null);
        own.forEach(r => knownOwners.add(recordOwner(r)));
        const others = (parseRecords(raw) || []).filter(r => !knownOwners.has(recordOwner(r)));
        const merged = own.concat(others);
        if (merged.length === 0) {
            if (raw !== null && raw !== undefined) GM_deleteValue(currentKey);
            return;
        }
        const json = JSON.stringify(merged);
        if (json !== raw) GM_setValue(currentKey, json);
    }

    // --- Per-site settings ---

    function siteId() {
        return location.hostname || location.protocol;
    }

    function readSettings() {
        try {
            const s = JSON.parse(GM_getValue(SETTINGS_KEY, '{}'));
            return s && typeof s === 'object' ? s : {};
        } catch (e) {
            return {};
        }
    }

    // The shortcut keys (Alt+Shift+K) and the selection toolbar (Alt+T) are per site and off until
    // switched on. Read afresh each time, so a switch made in another tab counts here too.
    function siteListed(key) {
        const list = readSettings()[key];
        return Array.isArray(list) && list.includes(siteId());
    }

    function setSiteListed(key, on) {
        const settings = readSettings();
        const sites = new Set(Array.isArray(settings[key]) ? settings[key] : []);
        if (on) sites.add(siteId());
        else sites.delete(siteId());
        settings[key] = Array.from(sites);
        GM_setValue(SETTINGS_KEY, JSON.stringify(settings));
    }

    function keysSwitchedOff() {
        return !siteListed('keysOnSites');
    }

    function setKeysSwitchedOff(off) {
        setSiteListed('keysOnSites', !off);
    }

    function toolbarSwitchedOff() {
        return !siteListed('toolbarOnSites');
    }

    function setToolbarSwitchedOff(off) {
        setSiteListed('toolbarOnSites', !off);
    }

    // =====================================================================
    // Restoring
    // =====================================================================

    // XPath + offset -> unique context inside that block -> context anywhere in the document ->
    // context that agrees well enough, in that block, then anywhere (see looseLocate).
    // `strict` is for annotations the site redrew: their text may now be somewhere else
    // entirely (a recycled list row, say), so only their exact, unique context will do.
    function locateRecord(record, getIndex, strict = false) {
        const block = getElementByXPath(record.xpath);
        const located = exactLocate(record, block, getIndex, strict);
        if (located || strict) return located;
        if (block) {
            const at = looseLocate(block.textContent, record);
            const range = at === -1 ? null : rangeFromOffsets(block, at, at + record.text.length);
            if (range) return { range, relocated: true };
        }
        const index = getIndex();
        const at = looseLocate(index.text, record);
        const range = at === -1 ? null : indexRange(index, at, record.text.length);
        return range ? { range, relocated: true } : null;
    }

    function exactLocate(record, block, getIndex, strict) {
        if (block) {
            let start = record.startOffset;
            let length = record.length;
            let relocated = false;
            let usable = true;
            if (strict || !offsetMatchesText(block, start, length, record.text)) {
                const fz = fuzzyLocate(block, record, strict);
                if (fz) { relocated = fz.startOffset !== start || fz.length !== length; start = fz.startOffset; length = fz.length; }
                else usable = false;
            }
            if (usable) {
                const range = rangeFromOffsets(block, start, start + length);
                if (range) return { range, relocated };
            }
        }
        const range = globalLocate(record, getIndex(), strict);
        return range ? { range, relocated: true } : null;
    }

    // Is the record's own text, at its own place, all of it already annotated this way? Then the
    // record repeats an annotation that is on the page (one the site put back, or the user made
    // again), and can go. The same text elsewhere is another annotation. A note the copy on the
    // page lacks moves over to it; a different note keeps the record waiting.
    function absorbDuplicate(range, record) {
        const block = getBlockParent(range.startContainer);
        if (getElementByXPath(record.xpath) !== block ||
            computeOffsetWithinBlock(block, range.startContainer, range.startOffset) !== record.startOffset) return false;
        // Nothing was wrapped, so the text has this style all over, maybe with others (see
        // collectTextNodes).
        const wrappers = candidateWrappers(range).filter(w => w.getAttribute(STYLE_ATTR) === record.key);
        if (!wrappers.length) return false;
        const notes = new Set(wrappers.map(w => w.getAttribute(NOTE_ATTR) || ''));
        if (!record.note || (notes.size === 1 && notes.has(record.note))) { wrappers.forEach(trackShown); return true; }
        const groups = new Set(wrappers.map(w => w.getAttribute(GROUP_ATTR)));
        if (groups.size !== 1 || notes.size !== 1 || !notes.has('')) return false;
        setGroupNote(Array.from(groups)[0], record.note);
        wrappers.forEach(trackShown);
        return true;
    }

    function renderRecords(records, { animate = ANIMATE_ON_RESTORE } = {}) {
        const failed = [];
        const placed = [];
        let relocated = false;
        let stamped = false;   // an annotation got its "added" date now (see groupTime)
        let dropped = 0;
        let textIndex = null;
        const getIndex = () => textIndex || (textIndex = buildTextIndex());

        // Every record is located before anything is wrapped, so one text index serves them
        // all (wrapping splits text nodes, which would make the index stale). The ranges are
        // live: wrapping one record moves the others' boundaries along with their text.
        // A record whose style no longer exists stays saved, unplaced, until the style is back.
        const targets = records.map(record => ({
            record,
            located: hasOwn(STYLES, record.key) ? locateRecord(record, getIndex, isReclaimed(record)) : null
        }));
        // Backgrounds are read now, while nothing has changed, so wrapping doesn't make the
        // browser recompute styles once per wrapper (see darkBehind's cache).
        targets.forEach(({ located }) => {
            if (located) { darkBehind(located.range.startContainer); darkBehind(located.range.endContainer); }
        });
        // Records can share text (in different styles), and wrapping one moves the live ranges
        // of the others that overlap it. Offsets in the block's text don't move.
        targets.forEach(t => {
            if (!t.located) return;
            const r = t.located.range;
            const block = getBlockParent(r.startContainer);
            if (block !== getBlockParent(r.endContainer)) return;
            t.spot = { block, start: computeOffsetWithinBlock(block, r.startContainer, r.startOffset), end: computeOffsetWithinBlock(block, r.endContainer, r.endOffset) };
        });

        const place = (record, located, range) => {
            const group = typeof record.group === 'string' && record.group ? record.group : legacyGroup(record);
            // An annotation whose group carries no date is dated by its first restore.
            const added = record.added || (groupTime(group) ? undefined : Date.now());
            const wrappers = wrapRange(range, record.key, { group, note: record.note, added, page: record.page });
            if (!wrappers.length) {
                // A duplicate of what is already there goes (`dropped` asks the caller to save).
                if (absorbDuplicate(range, record)) { dropped++; releaseReclaimed(record); }
                else failed.push(record);
                return;
            }
            releaseReclaimed(record);   // back: from now on, like any other annotation
            wrappers.forEach(w => trackedRecords.set(w, record));
            placed.push(...wrappers);
            if (located.relocated) relocated = true;
            if (added !== record.added) stamped = true;
        };
        targets.forEach(({ record, located, spot }) => {
            if (!located) { failed.push(record); return; }
            const range = (spot && rangeFromOffsets(spot.block, spot.start, spot.end)) || located.range;
            place(record, located, range);
            dropRange(range);   // the others' stay live until their turn
            dropRange(located.range);
        });

        showWrappers(placed, animate);
        return { failed, placed, relocated, stamped, dropped };
    }

    // Records that missed on MAX_RESTORE_MISSES visits are kept, but no longer watched for,
    // unless the site redrew them during this visit. Records whose style no longer exists
    // aren't watched either.
    function isWatched(record) {
        return hasOwn(STYLES, record.key) && !stubbornIds.has(recordId(record))
            && (isReclaimed(record) || (record.misses || 0) < MAX_RESTORE_MISSES);
    }

    // One watcher, one queue: pendingRecords is the only list of unplaced records.
    let lateWatcher = null;

    function stopLateWatcher() {
        if (!lateWatcher) return;
        clearTimeout(lateWatcher.timer);
        clearTimeout(lateWatcher.deadline);
        lateWatcher.observer.disconnect();
        lateWatcher = null;
    }

    // Retries as the page changes, for content that loads late (comments, "load more"): closely
    // during a first window (LATE_CONTENT_GIVE_UP_MS or LATE_CONTENT_MAX_ATTEMPTS tries, from
    // when the page is first in view), after which what is still missing counts as missed on
    // this visit; then lightly, at most every LATE_CONTENT_SLOW_RETRY_MS and only when added
    // content holds a waiting annotation's text, for as long as the page is open. A tab in the
    // background pauses that until it is shown. `all` marks the first window of a visit, which
    // counts misses; `reclaimedOnly` starts over closely for annotations the site redrew.
    function startLateWatcher({ reclaimedOnly = false } = {}) {
        stopLateWatcher();
        if (!pendingRecords.some(isWatched) || !document.body || typeof MutationObserver !== 'function') return;
        const state = {
            all: !reclaimedOnly, slow: false, attempts: 0, startedAt: document.hidden ? null : Date.now(),
            timer: null, deadline: null, observer: null, retryOnShow: false, texts: null, textsOf: null, textsCount: 0
        };
        state.observer = new MutationObserver(mutations => {
            if (state.timer || state.retryOnShow || (state.slow && !mayBringBack(state, mutations))) return;
            if (state.slow && document.hidden) { state.retryOnShow = true; return; }   // retried when the tab is shown
            state.timer = setTimeout(() => { state.timer = null; retryPending(state); },
                state.slow ? LATE_CONTENT_SLOW_RETRY_MS : 500);
        });
        state.observer.observe(document.body, { childList: true, subtree: true });
        lateWatcher = state;
        armDeadline(state);
    }

    // A static page never mutates, so the end of the first window must not depend on mutations.
    function armDeadline(state) {
        clearTimeout(state.deadline);
        if (state.startedAt !== null) state.deadline = setTimeout(() => retryPending(state, true), LATE_CONTENT_GIVE_UP_MS + 50);
    }

    // The records a retry looks for: after the first window, not those of other pages sharing
    // this page's key (see isOtherPage), whose text is rarely here.
    function isDue(state, record) {
        return isWatched(record) && (!state.slow || !isOtherPage(record));
    }

    // After the first window only additions that contain a waiting record's text are worth a
    // retry: a retry searches the whole page. The texts are listed again only when the queue changes.
    function mayBringBack(state, mutations) {
        if (state.textsOf !== pendingRecords || state.textsCount !== pendingRecords.length) {
            state.textsOf = pendingRecords;
            state.textsCount = pendingRecords.length;
            state.texts = pendingRecords.filter(r => isDue(state, r)).map(r => r.text).filter(Boolean);
        }
        const texts = state.texts;
        return texts.length > 0 && mutations.some(m => Array.from(m.addedNodes).some(n => {
            const t = n.textContent;
            return !!t && texts.some(x => t.includes(x));
        }));
    }

    function retryNow(state) {
        clearTimeout(state.timer);
        state.timer = null;
        retryPending(state);
    }

    function retryPending(state, final = false) {
        if (lateWatcher !== state) return;
        if (state.slow && document.hidden) { state.retryOnShow = true; return; }
        if (state.startedAt !== null) state.attempts++;
        const due = r => isDue(state, r);
        const waiting = pendingRecords.filter(r => !due(r));
        const { failed, placed, relocated, stamped, dropped } = renderRecords(pendingRecords.filter(due));
        pendingRecords = failed.concat(waiting);
        state.observer.takeRecords();   // ignore the mutations we just made ourselves
        let changed = placed.length > 0 || relocated || stamped || dropped > 0;

        const over = final || state.attempts >= LATE_CONTENT_MAX_ATTEMPTS || Date.now() - state.startedAt > LATE_CONTENT_GIVE_UP_MS;
        if (!state.slow && state.startedAt !== null && over && document.hidden) {
            // Hidden before the window was over: it starts again when the page is shown.
            state.startedAt = null;
            state.attempts = 0;
            clearTimeout(state.deadline);
        } else if (!state.slow && state.startedAt !== null && over) {
            // The first window is over. What is still missing (and wasn't redrawn by the site,
            // or made on another page) counts as a miss, once per visit however often the window
            // restarts.
            const first = state.all;
            if (first) {
                const counted = new Set();
                failed.forEach(r => {
                    const id = recordId(r);
                    if (isReclaimed(r) || isOtherPage(r) || (missedIds.has(id) && !counted.has(id))) return;
                    counted.add(id);
                    r.misses = (r.misses || 0) + 1;
                    changed = true;
                });
                counted.forEach(id => missedIds.add(id));
            }
            state.all = false;
            state.slow = true;
            clearTimeout(state.deadline);
            if (first) noticeMissing();
        }
        if (changed) saveHighlights();
        if (lateWatcher === state && !pendingRecords.some(due)) stopLateWatcher();
    }

    // A tab shown again: the first window starts if it hadn't, and content added meanwhile is
    // looked at once. A notice about missing annotations held back is given now.
    function onVisibilityChange() {
        if (document.hidden || !running || nav) return;
        const state = lateWatcher;
        if (state && state.startedAt === null) {
            state.startedAt = Date.now();
            armDeadline(state);
            retryNow(state);
        } else if (state && state.retryOnShow) {
            state.retryOnShow = false;
            retryNow(state);
        }
        if (noticeDue) noticeMissing();
    }

    // --- Annotations that didn't come back ---

    // This page's saved records that aren't on it: their style exists, and they weren't made on
    // another page sharing its key. Forget missing removes these.
    function missingRecords() {
        return pendingRecords.filter(r => hasOwn(STYLES, r.key) && !isOtherPage(r));
    }

    // How many annotations the page has (on it, or saved for it and waiting), how many of those
    // are on it, and how many can't be found (no piece of them is on it).
    function pageCounts() {
        const present = new Set(allWrappers().map(w => w.getAttribute(GROUP_ATTR)));
        const all = new Set(present);
        const missing = new Set();
        pendingRecords.forEach(r => {
            if (isOtherPage(r)) return;
            const owner = recordOwner(r);
            all.add(owner);
            if (hasOwn(STYLES, r.key) && !present.has(owner)) missing.add(owner);
        });
        return { total: all.size, present: present.size, missing: missing.size };
    }

    let noticeDue = false;   // a notice waits for the tab to be shown

    // Once per page and tab, after the first look for late content: how many of the page's
    // annotations couldn't be found, with a button to their list in the panel. Not over a
    // message offering Undo or Restore.
    function noticeMissing() {
        noticeDue = false;
        if (!running || !currentKey || noticedKeys.has(currentKey)) return;
        const { missing } = pageCounts();
        if (!missing) return;
        if (document.hidden) { noticeDue = true; return; }
        noticedKeys.add(currentKey);
        if (!toastEl.hidden && toastRun) return;
        showToast(doneText('not found', missing), { icon: 'warning', intent: 'warning', action: { label: 'Show', tip: 'Show what was not found', run: showMissingInPanel, keepEditor: true } });
    }

    function restoreHighlights() {
        if (!running) return;
        // A URL change not noticed yet would mean restoring the previous page's annotations here.
        onUrlMaybeChanged();
        if (nav && settleNavigation()) return;   // it restored the page it settled on
        watchStoredKey();
        // Restore runs on a delay, so the user may already have annotated (or an earlier
        // restore may have run). Skip anything that is already on the page.
        const present = new Set(getCurrentRecords().map(recordSignature));
        const records = loadRecords().filter(r => !present.has(recordSignature(r)));
        if (!records.length) return;
        const { failed, relocated, stamped, dropped } = renderRecords(records);
        pendingRecords = failed;
        if (relocated || stamped || dropped || failed.length) saveHighlights();
        startLateWatcher();
        if (!lateWatcher) noticeMissing();   // nothing left to wait for: say so now
        scheduleMenuRefresh();
    }

    function scheduleRestore() {
        clearTimeout(restoreTimer);
        restoreTimer = setTimeout(restoreHighlights, RESTORE_DELAY_MS);
    }

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

    // =====================================================================
    // Applying and removing annotations
    // =====================================================================

    // Which part of `block`'s text does the range cover? Returns [start, end).
    function selectionSpanInBlock(range, block) {
        const blockRange = document.createRange();
        blockRange.selectNodeContents(block);
        let s = 0;
        let e = block.textContent.length;
        if (range.compareBoundaryPoints(Range.START_TO_START, blockRange) > 0) {
            s = computeOffsetWithinBlock(block, range.startContainer, range.startOffset);
        }
        if (range.compareBoundaryPoints(Range.END_TO_END, blockRange) < 0) {
            e = computeOffsetWithinBlock(block, range.endContainer, range.endOffset);
        }
        dropRange(blockRange);
        return [s, e];
    }

    // Existing annotations that share at least one character with the range.
    function findOverlaps(range) {
        const result = [];
        candidateWrappers(range).forEach(wrapper => {
            const block = getBlockParent(wrapper);
            const { start, end } = wrapperExtent(wrapper, block);
            const [s, e] = selectionSpanInBlock(range, block);
            if (Math.max(start, s) < Math.min(end, e)) {
                result.push({
                    wrapper, block, start, end, s, e,
                    key: wrapper.getAttribute(STYLE_ATTR),
                    group: wrapper.getAttribute(GROUP_ATTR),
                    note: wrapper.getAttribute(NOTE_ATTR),
                    added: +wrapper.getAttribute(ADDED_ATTR) || undefined,
                    page: wrapper.hasAttribute(PAGE_ATTR) ? wrapper.getAttribute(PAGE_ATTR) : undefined
                });
            }
        });
        return result;
    }

    // Returns the wrappers of the new annotation. `own` ({ group, note, added }) gives it an
    // identity of its own (a saved annotation attached to new text) instead of inheriting one.
    function applyAnnotation(range, key, overlaps, own = null) {
        if (!hasOwn(STYLES, key)) return [];

        // Everything is measured before the first DOM change, because unwrapping invalidates the range.
        const startBlock = getBlockParent(range.startContainer);
        const endBlock = getBlockParent(range.endContainer);
        let startOff = computeOffsetWithinBlock(startBlock, range.startContainer, range.startOffset);
        let endOff = computeOffsetWithinBlock(endBlock, range.endContainer, range.endOffset);

        // Annotations of the same style merge with the new one: it grows to cover them. One that
        // starts before the selection contains the selection's start, so it is in startBlock
        // (and likewise at the end). Those of other styles stay as they are, sharing the text.
        const same = overlaps.filter(o => o.key === key);
        same.forEach(o => {
            if (o.start < o.s) startOff = Math.min(startOff, o.start);
            if (o.end > o.e) endOff = Math.max(endOff, o.end);
        });

        const meta = inheritedMeta(same, own);

        const blocks = new Set([startBlock, endBlock]);
        same.forEach(o => { blocks.add(o.block); unwrapWrapper(o.wrapper); });
        blocks.forEach(normalizeBlock);

        const sp = findNodeAtOffset(startBlock, startOff, 'start');
        const ep = findNodeAtOffset(endBlock, endOff, 'end');
        let created = [];
        if (sp && ep) {
            try {
                const clean = document.createRange();
                clean.setStart(sp.node, sp.offset);
                clean.setEnd(ep.node, ep.offset);
                created = wrapRange(clean, key, { group: meta.group, note: meta.note, added: meta.added, page: meta.page });
                dropRange(clean);
            } catch (e) {
                console.warn(`${LOG} could not annotate selection`, e);
            }
        }
        // Pieces of a merged annotation outside the selection (beyond a link, say, or waiting to
        // come back) join the new one.
        if (created.length && meta.absorbed.length) {
            allWrappers().forEach(w => {
                if (!meta.absorbed.includes(w.getAttribute(GROUP_ATTR))) return;
                w.setAttribute(GROUP_ATTR, meta.group);
                if (meta.note) w.setAttribute(NOTE_ATTR, meta.note);
                else w.removeAttribute(NOTE_ATTR);
                if (meta.added) w.setAttribute(ADDED_ATTR, String(meta.added));
                else w.removeAttribute(ADDED_ATTR);
                if (typeof meta.page === 'string') w.setAttribute(PAGE_ATTR, meta.page);
                else w.removeAttribute(PAGE_ATTR);
            });
            pendingRecords.forEach(r => {
                if (!meta.absorbed.includes(r.group)) return;
                r.group = meta.group;
                r.note = meta.note;
                r.added = meta.added;
                r.page = meta.page;
            });
        }

        showWrappers(created, true);
        return created;
    }

    // The parts of overlapping annotations (see findOverlaps) outside the selection, which stay
    // as they are, note included. A part that is only spaces would not be drawn: it doesn't count.
    // With trimCut (the eraser), the pieces also lose the spaces next to the cut, so no
    // marked space is left hanging where the erased text was.
    function outsideParts(overlaps, { trimCut = false } = {}) {
        const parts = [];
        const textOf = new Map();
        overlaps.forEach(o => {
            if (!textOf.has(o.block)) textOf.set(o.block, o.block.textContent);
            const text = textOf.get(o.block);
            let s = o.s, e = o.e;
            if (trimCut) {
                while (s > o.start && /\s/.test(text[s - 1])) s--;
                while (e < o.end && /\s/.test(text[e])) e++;
            }
            const meta = { group: o.group || newGroupId(), note: o.note, added: o.added, page: o.page };
            if (o.start < s && text.slice(o.start, s).trim()) parts.push({ block: o.block, start: o.start, end: s, key: o.key, meta });
            if (e < o.end && text.slice(e, o.end).trim()) parts.push({ block: o.block, start: e, end: o.end, key: o.key, meta });
        });
        return parts;
    }

    // Wraps parts from outsideParts again, once their old wrappers are gone.
    function rewrap(parts) {
        const wrappers = [];
        parts.forEach(p => {
            const range = rangeFromOffsets(p.block, p.start, p.end);
            if (range) wrappers.push(...wrapRange(range, p.key, p.meta));
            dropRange(range);
        });
        return wrappers;
    }

    // The new annotation takes over the identity and note of the same-style annotations it
    // merges with (`same`). Notes of several are joined in text order.
    function inheritedMeta(same, own) {
        const absorbed = [];
        const notes = [];
        same.forEach(o => {   // in document order
            if (!o.group || absorbed.includes(o.group)) return;
            absorbed.push(o.group);
            if (o.note && !notes.includes(o.note)) notes.push(o.note);
        });
        if (own && own.note && !notes.includes(own.note)) notes.unshift(own.note);
        const group = own ? own.group : absorbed[0] || newGroupId();
        const from = same.find(o => o.group === group);
        return {
            group,
            note: clipNote(notes.join('\n\n')) || undefined,
            added: own ? own.added : from && from.added,
            page: pageTag(),   // made here, whatever it absorbed
            absorbed
        };
    }

    // The styles all of the selected text has (it can have several: see collectTextNodes):
    // choosing one of them again removes those annotations, and its toolbar button shows
    // pressed. `range` is a cleaned selection (cleanRange).
    function selectionStyles(range, overlaps) {
        return Array.from(new Set(overlaps.map(o => o.key))).filter(key => !collectTextNodes(range, key).nodes.some(n => {
            const from = n === range.startContainer ? range.startOffset : 0;
            const to = n === range.endContainer ? range.endOffset : n.nodeValue.length;
            return !!n.nodeValue.slice(from, to).trim();
        }));
    }

    // Removes whole annotations: every piece of them, also pieces waiting to come back.
    function removeGroups(groups) {
        unwrapMany(allWrappers().filter(w => groups.has(w.getAttribute(GROUP_ATTR))));
        pendingRecords = pendingRecords.filter(r => !groups.has(recordOwner(r)));
    }

    // The eraser: takes the annotations off exactly the selected text. What is left of them on
    // either side stays, with its note.
    function eraseOverlaps(overlaps) {
        const remainders = outsideParts(overlaps, { trimCut: true });
        const blocks = new Set(overlaps.map(o => o.block));
        overlaps.forEach(o => unwrapWrapper(o.wrapper));
        blocks.forEach(normalizeBlock);
        showWrappers(rewrap(remainders), false);
    }

    // --- Undo / redo ---

    function captureState() {
        return { records: getCurrentRecords(), pending: pendingRecords.map(r => ({ ...r })) };
    }

    function pushLimited(stack, state) {
        stack.push(state);
        if (stack.length > UNDO_STACK_LIMIT) stack.shift();
    }

    // Runs a change, and records an undo step only if the stored state actually changed.
    // Returns that step (null if nothing changed), for an Undo button offered afterwards.
    function runUndoable(action) {
        setAnnotationsHidden(false);   // never change annotations the user can't see
        const before = captureState();
        const beforeJson = JSON.stringify(before);
        action();
        if (cardWrapper && !cardWrapper.isConnected) hideNoteCard();   // its annotation is gone
        refreshNoteMarks();
        const after = captureState();
        let step = null;
        if (JSON.stringify(after) !== beforeJson) {
            pushLimited(undoStack, before);
            redoStack.length = 0;
            step = before;
        }
        saveHighlights(after.records);
        scheduleRedraw();
        return step;
    }

    // How many annotations the records make up (the pieces of one annotation share a group).
    function countAnnotations(records) {
        return new Set(records.map(r => r.group || recordSignature(r))).size;
    }

    function annotationsText(n) {
        return n === 1 ? '1 annotation' : `${n} annotations`;
    }

    // Toasts say what happened, in past tense: "2 annotations erased".
    function doneText(verb, n) {
        return `${annotationsText(n)} ${verb}`;
    }

    function applyState(state) {
        resetUi({ keepRestore: true });
        stopLateWatcher();
        unwrapAll();
        trackedRecords.clear();   // the state is the whole truth; renderRecords tracks what it places
        const { failed } = renderRecords(state.records.concat(state.pending), { animate: false });
        pendingRecords = failed;
        saveHighlights();
        startLateWatcher();
        scheduleRedraw();
    }

    // Undo moves a state from undoStack to the page and the page's state to redoStack; redo the reverse.
    function stepHistory(from, to) {
        const state = from.pop();
        if (!state) return;
        setAnnotationsHidden(false);
        pushLimited(to, captureState());
        applyState(state);
    }

    function undoLastAction() {
        stepHistory(undoStack, redoStack);
    }

    function redoLastAction() {
        stepHistory(redoStack, undoStack);
    }

    // The menu's commands. A note being written closes first, as Esc would (a highlight made for a
    // new one goes with it, before the command's own undo step), and its text is offered back
    // afterwards, in place of the command's message: Alt+Z still undoes the command.
    function clearPageAnnotations() {
        if (!running) return;
        syncLocation();
        cancelEditor();
        resetUi();
        runUndoable(() => {
            stopLateWatcher();
            pendingRecords = pendingRecords.filter(isOtherPage);   // they belong to other pages
            unwrapAll();
        });
        startLateWatcher();
    }

    // Annotations of a style that no longer exists aren't missing, only hidden, and those made on
    // another page sharing this one's key belong there: they stay (see missingRecords).
    function forgetMissingAnnotations() {
        if (!running) return;
        syncLocation();
        if (!countAnnotations(missingRecords())) return;
        cancelEditor();
        // Read after the note closes: dropping a new note's highlight goes back a step (see
        // discardStep), which rebuilds the list of waiting records.
        const missing = missingRecords();
        runUndoable(() => {
            stopLateWatcher();
            pendingRecords = pendingRecords.filter(r => !missing.includes(r));
        });
        startLateWatcher();
    }

    // =====================================================================
    // Input
    // =====================================================================

    function isEditableTarget(e) {
        const t = (typeof e.composedPath === 'function' && e.composedPath()[0]) || e.target;
        if (!(t instanceof Element)) return false;
        return !!t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    }

    function getActiveRange() {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
        try { return { sel, range: sel.getRangeAt(0) }; } catch (e) { return null; }
    }

    // Shared by the shortcuts and the selection toolbar. `active` is { sel, range }. A style the
    // selected text already has (all of it) does nothing (only Alt+D erases); any other style
    // annotates it, on top of the styles it has (see applyAnnotation).
    function annotateSelection(key, { sel, range: selected }) {
        if (!sel.toString().trim()) return;
        const range = cleanRange(selected);
        if (!range) return;
        const overlaps = findOverlaps(range);
        if (selectionStyles(range, overlaps).includes(key)) return;
        runUndoable(() => {
            applyAnnotation(range, key, overlaps);
            lastStyleKey = key;
        });
        sel.removeAllRanges();
    }

    function removeInSelection({ sel, range: selected }) {
        const range = cleanRange(selected);
        const overlaps = range ? findOverlaps(range) : [];
        if (overlaps.length) runUndoable(() => eraseOverlaps(overlaps));
        sel.removeAllRanges();
    }

    // What the keys act on when no text is selected: the annotation selected by clicking it, else
    // the one under the mouse (or under the note card the mouse is on), else the one jumped to
    // last while it is in view (not with the pen on). Null if none.
    function pointedGroup() {
        if (selectedGroups.length) return selectedInOrder()[0];   // clicked (see setSelectedGroups)
        let w = hoveredWrapper;
        if (w && !w.isConnected && pointer) {
            // Drawn again under a still mouse (by undo, or by the site): whatever is there now.
            const el = document.elementFromPoint(pointer.x, pointer.y);
            w = hoveredWrapper = el && el !== uiHost ? el.closest(WRAPPER_SELECTOR) : null;
        }
        if (w && w.isConnected) return w.getAttribute(GROUP_ATTR);
        if (penKey) return null;   // the pen's style keys never reach one that is only jumped to
        return jumpGroup && groupWrappers(jumpGroup).some(isInView) ? jumpGroup : null;
    }

    // A style chosen with nothing selected, for the annotations pointed at or clicked (see
    // setSelectedGroups), as one step for Undo: all of each takes that style (pieces waiting to
    // come back too), keeping its note and date; nothing happens when all have that style already.
    function restyleGroups(groups, key) {
        if (editor && !groups.includes(editor.group)) cancelEditor();   // one note at a time, as when opening another
        groups = groups.filter(g => groupWrappers(g).length);
        const wrappers = groups.flatMap(groupWrappers);
        if (!wrappers.length) return;
        if (wrappers.every(w => w.getAttribute(STYLE_ATTR) === key)) return;
        lastStyleKey = key;
        runUndoable(() => {
            pendingRecords.forEach(r => {
                const group = recordOwner(r);
                if (!groups.includes(group)) return;
                r.group = group;   // a record saved before groups existed is named by its style
                r.key = key;
            });
            wrappers.forEach(w => w.setAttribute(STYLE_ATTR, key));
            dropNestedSameStyle(wrappers);
            // Each draws in as one stroke, all of it (also what it merged with), all at once.
            const now = allWrappers().filter(w => groups.includes(w.getAttribute(GROUP_ATTR)));
            drawAnnotations(now.map(w => restyle(w, { animate: true, draw: false })).filter(Boolean));
            now.forEach(snapshotRect);
            updateSelectionVisibility();
        });
    }

    // Opens the note of the first annotation the selection touches; plain text first gets a
    // highlight, which is dropped again if the note is cancelled or left empty.
    function noteSelection({ sel, range: selected }) {
        if (!sel.toString().trim()) return;
        const range = cleanRange(selected);
        if (!range) return;
        const overlaps = findOverlaps(range);
        if (overlaps.length) {
            sel.removeAllRanges();
            openNoteEditor(overlaps[0].group);
            return;
        }
        let created = [];
        runUndoable(() => { created = applyAnnotation(range, NOTE_STYLE_KEY, []); });
        sel.removeAllRanges();
        if (!created.length) return;
        openNoteEditor(created[0].getAttribute(GROUP_ATTR), { step: undoStack[undoStack.length - 1] });
    }

    const COMMAND_CODES = new Set(['KeyZ', 'KeyY', 'KeyV', 'KeyP', 'KeyT', 'KeyN', 'KeyO', 'KeyJ', 'KeyK', 'KeyD', 'KeyL']);

    // While our keys are on (Alt+Shift+K switches them), every Alt key outside a field is ours
    // alone: the site's own Alt shortcuts never run, whether we use the key or not. Its access
    // keys (accesskey="z": Wikipedia's Alt+Z, Alt+Shift+Z, ...) go off in Chrome before any
    // keydown handler sees the letter, so while Alt is held they are taken off the page.
    // Browser keys (Alt+Left, Alt+D, ...) are left alone: nothing is prevented unless we act.
    let heldAccessKeys = null;   // [[element, its accesskey]] while Alt is down

    function holdAccessKeys() {
        if (heldAccessKeys) return;
        heldAccessKeys = Array.from(document.querySelectorAll('[accesskey]'), el => [el, el.getAttribute('accesskey')]);
        heldAccessKeys.forEach(([el]) => el.removeAttribute('accesskey'));
    }

    function releaseAccessKeys() {
        if (!heldAccessKeys) return;
        heldAccessKeys.forEach(([el, key]) => { if (!el.hasAttribute('accesskey')) el.setAttribute('accesskey', key); });
        heldAccessKeys = null;
    }

    // An Alt key the site's handlers don't get: not AltGr (Ctrl+Alt) typing, not in a field or
    // in our own panels.
    function isSiteAltKey(e) {
        return e.altKey && !e.ctrlKey && !e.metaKey && !isUiEvent(e) && !isEditableTarget(e);
    }

    function toggleKeysSwitch() {
        const off = !keysSwitchedOff();
        setKeysSwitchedOff(off);
        if (off) releaseAccessKeys();
        refreshMenu();
    }

    function onKeyDown(e) {
        if (e.altKey && e.shiftKey && e.code === 'KeyK' && !e.ctrlKey && !e.metaKey && !e.repeat) {
            e.preventDefault();
            e.stopPropagation();
            toggleKeysSwitch();
            return;
        }
        if (e.altKey && keysSwitchedOff()) return;
        if (e.key === 'Alt' && !e.ctrlKey && !e.metaKey) holdAccessKeys();
        ourKey(e);
        if (isSiteAltKey(e)) e.stopImmediatePropagation();
    }

    // The rest of an Alt key press stays away from the site too.
    function onKeyUpOrPress(e) {
        if (e.type === 'keyup' && e.key === 'Alt') releaseAccessKeys();
        if (isSiteAltKey(e) && !keysSwitchedOff()) e.stopImmediatePropagation();
    }

    function ourKey(e) {
        // Esc closes everything saved (Alt+Shift+O) wherever focus is.
        if (e.key === 'Escape' && !everythingEl.hidden) {
            e.preventDefault();
            closeEverything();
            return;
        }
        // Tab stays inside everything saved, as in a modal dialog.
        if (e.key === 'Tab' && !everythingEl.hidden) {
            const stops = Array.from(everythingEl.querySelectorAll('button, input, [tabindex]')).filter(el => !el.disabled && !el.hidden && el.tabIndex >= 0 && el.getClientRects().length);
            if (!stops.length) { e.preventDefault(); return; }
            const at = stops.indexOf(uiRoot.activeElement);
            const next = e.shiftKey ? (at <= 0 ? stops[stops.length - 1] : stops[at - 1]) : (at < 0 || at === stops.length - 1 ? stops[0] : stops[at + 1]);
            e.preventDefault();
            next.focus({ preventScroll: true });
            return;
        }
        // Everything saved covers the page: the page's keys wait until it closes.
        if (!everythingEl.hidden && e.code !== 'KeyO') return;
        // Esc closes a note pinned by clicking its badge.
        // Esc with focus out of the note editor (it stays open on clicks outside) still discards it.
        if (e.key === 'Escape' && editor && !isUiEvent(e) && !e.altKey) { cancelEditor(); return; }
        if (e.key === 'Escape' && pinnedCards.size && !e.altKey) { unpinNoteCard(Array.from(pinnedCards.keys()).pop()); return; }
        if (selectedGroupKey(e)) return;
        // Esc turns the pen off, unless it is meant for a panel or a field.
        if (e.key === 'Escape' && penKey && !editor && !isUiEvent(e) && !isEditableTarget(e)) {
            setPen(null);
            return;
        }
        if (!e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
        if (isEditableTarget(e)) return;
        if (editor && isUiEvent(e)) return;   // focus is on the open note editor's buttons
        // Typing in the panel's filter box: only the panel and jump keys act.
        if (isUiEvent(e) && uiRoot.activeElement === panelFilter && !/^Key[OJK]$/.test(e.code)) return;
        const code = e.code;
        if (!COMMAND_CODES.has(code) && (e.shiftKey || !CODE_TO_STYLE.has(code))) return;
        syncLocation();

        if (code === 'KeyZ' || code === 'KeyY') {
            const redo = code === 'KeyY' || e.shiftKey;
            if (!(redo ? redoStack : undoStack).length) return;
            e.preventDefault();
            if (redo) redoLastAction();
            else undoLastAction();
            return;
        }

        if (code === 'KeyV') {
            if (e.shiftKey || (!annotationsHidden && !document.querySelector(WRAPPER_SELECTOR))) return;
            e.preventDefault();
            toggleAnnotationsHidden();
            return;
        }

        if (code === 'KeyP') {
            if (e.shiftKey) return;
            e.preventDefault();
            togglePen();
            return;
        }

        if (code === 'KeyT') {
            if (e.shiftKey || !ENABLE_SELECTION_TOOLBAR) return;
            e.preventDefault();
            toggleToolbarSwitch();
            return;
        }

        const active = getActiveRange();
        const selected = !!active && !!active.sel.toString().trim();
        // With nothing selected, the keys act on the annotation pointed at (see pointedGroup).
        // Annotations hidden by Alt+V can't be seen to be pointed at: only Alt+N, which changes
        // nothing by itself, still reaches them.
        const pointed = () => (annotationsHidden ? null : pointedGroup());

        if (code === 'KeyN') {
            if (e.shiftKey) return;
            e.preventDefault();
            const group = selected ? null : pointedGroup();
            if (selected) noteSelection(active);
            else if (group) openNoteEditor(group);
            else showToast('Nothing to add a note to', { intent: 'warning', icon: 'warning' });
            return;
        }

        if (code === 'KeyL') {
            if (e.shiftKey) return;
            e.preventDefault();
            togglePinKey(selected ? null : pointedGroup());
            return;
        }

        if (code === 'KeyO') {
            e.preventDefault();
            if (e.shiftKey) toggleEverything();
            else togglePanel();
            return;
        }

        if (code === 'KeyJ' || code === 'KeyK') {
            if (e.shiftKey) return;
            // Without annotations the keys stay the page's.
            if (jumpRelative(code === 'KeyJ' ? 1 : -1)) e.preventDefault();
            return;
        }

        // D on one annotation with a note deletes the note first.
        if (code === 'KeyD') {
            if (e.shiftKey) {
                e.preventDefault();
                clearPageAnnotations();
                return;
            }
            const group = selected ? null : pointed();
            if (!selected && !group) {
                // With the pen on, nothing to act on makes the eraser the pen's tool.
                if (penKey) { e.preventDefault(); setPen(PEN_ERASER); }
                return;
            }
            e.preventDefault();
            if (selected) removeInSelection(active);
            else if (groupHasNote(group)) deleteGroupNote(group);
            else deleteAnnotation(group);
            return;
        }

        const key = CODE_TO_STYLE.get(code);
        const group = selected ? null : pointed();
        if (!selected && !group) {
            // With the pen on, a style with nothing to act on becomes the pen's.
            if (penKey) { e.preventDefault(); setPen(key); }
            return;
        }
        e.preventDefault();
        if (selected) annotateSelection(key, active);
        else restyleGroups([group], key);
    }

    // Triple-click selects the paragraph under the pointer as it is shown (see visualParagraph),
    // rather than the browser's selection, which often runs into the start of the next block.
    function onMouseDown(e) {
        if (!ENABLE_TRIPLE_CLICK_BLOCK_SELECT) return;
        if (e.button !== 0 || e.detail < 3 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        if (!(e.target instanceof Element) || e.target === uiHost) return;
        if (e.target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return;
        const caret = caretAt(e.clientX, e.clientY);
        const text = caret && caret.node.nodeType === Node.TEXT_NODE && e.target.contains(caret.node) ? caret.node : null;
        const block = text ? paragraphBox(text) : getBlockParent(e.target);
        if (!block || block === document.body || block === document.documentElement) return;
        const sel = window.getSelection();
        if (!sel) return;
        let range = text && visualParagraph(block, text);
        if (!range) {
            const whole = document.createRange();
            whole.selectNodeContents(block);
            range = cleanRange(whole, { snap: false });
        }
        if (!range) return;
        e.preventDefault();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    // =====================================================================
    // Notes
    // =====================================================================

    function newGroupId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    // When an annotation was made, read from its group id, which starts with Date.now() in base
    // 36 (eight digits until 2059). Null for groups without one: annotations saved before groups
    // existed ("old-..."), which are dated by their first restore instead (ADDED_ATTR).
    function groupTime(group) {
        if (typeof group !== 'string' || !/^[0-9a-z]{8}/.test(group)) return null;
        const t = parseInt(group.slice(0, 8), 36);
        return t > 1262304000000 && t < Date.now() + 864e5 ? t : null;   // 2010 to tomorrow
    }

    function annotationTime(wrapper) {
        return groupTime(wrapper.getAttribute(GROUP_ATTR)) || +wrapper.getAttribute(ADDED_ATTR) || null;
    }

    let dateFormat = null;   // made once: making one per date took most of each search keystroke in Alt+Shift+O
    function formatDate(time) {
        try {
            if (!dateFormat) dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
            return dateFormat.format(new Date(time));
        } catch (e) {
            return new Date(time).toDateString();
        }
    }

    // A note cut to NOTE_MAX_LENGTH, without half an emoji at the cut or spaces at its ends.
    function clipNote(text) {
        return text.slice(0, NOTE_MAX_LENGTH).replace(/[\uD800-\uDBFF]$/, '').trim();
    }

    function groupWrappers(group) {
        return group ? Array.from(document.querySelectorAll(`${WRAPPER_SELECTOR}[${GROUP_ATTR}="${CSS.escape(group)}"]`)) : [];
    }

    // The note badge goes on the last piece of each annotation that has a note, so an annotation
    // split across lines or links shows a single badge, at its end.
    function refreshNoteMarks() {
        const wrappers = allWrappers();
        const lastOfGroup = new Map();
        wrappers.forEach(w => { if (w.hasAttribute(NOTE_ATTR)) lastOfGroup.set(w.getAttribute(GROUP_ATTR), w); });
        wrappers.forEach(w => {
            const marked = lastOfGroup.get(w.getAttribute(GROUP_ATTR)) === w;
            if (marked !== w.hasAttribute(NOTE_MARK_ATTR)) w.toggleAttribute(NOTE_MARK_ATTR, marked);
        });
        noteMarks = null;   // looked up again by markNear
        prunePinnedCards();
        schedulePanelRefresh();
    }

    function setGroupNote(group, text) {
        groupWrappers(group).forEach(w => {
            if (text) w.setAttribute(NOTE_ATTR, text);
            else w.removeAttribute(NOTE_ATTR);
        });
        refreshNoteMarks();
    }

    // =====================================================================
    // On-page UI: selection toolbar, note card, note editor and toast.
    //
    // Styled after Anthropic's own interfaces: warm parchment surfaces, a serif for text and a sans
    // for chrome, hairline borders instead of shadows, and one clay accent that only the primary
    // action (Save) uses. Icons are Phosphor Icons (Light), drawn in slate
    // here. Fonts are never loaded: the stacks name Anthropic's fonts first, then Georgia and
    // Inter, so the script looks right where those are installed (see the notes at the top).
    //
    // Everything lives in a closed shadow root, so page CSS can't restyle it and its CSS can't
    // leak into the page. Built with createElement (never innerHTML) so pages that enforce
    // Trusted Types don't block it.
    // =====================================================================

    function makeEl(tag, props = {}, children = []) {
        const node = document.createElement(tag);
        Object.keys(props).forEach(k => {
            if (k === 'class') node.className = props[k];
            else if (k === 'text') node.textContent = props[k];
            else node.setAttribute(k, props[k]);
        });
        children.forEach(c => node.appendChild(c));
        return node;
    }


    function svgEl(tag, attrs) {
        const node = document.createElementNS(SVG_NS, tag);
        Object.keys(attrs).forEach(k => node.setAttribute(k, String(attrs[k])));
        return node;
    }

    // Phosphor Icons, Light weight (@phosphor-icons/core), path data as published (viewBox 0 0 256 256);
    // push-pin-fill is the Fill weight, used for a pinned note. Copyright (c) 2020-present Phosphor Icons.
    // MIT License: https://github.com/phosphor-icons/core
    const PHOSPHOR_ICONS = {
        'highlighter': 'M252.24,107.76a6,6,0,0,0-8.48,0L193.41,158.1a2,2,0,0,1-2.82,0L105.9,73.41a2,2,0,0,1,0-2.82l50.34-50.35a6,6,0,0,0-8.48-8.48L97.41,62.1A14,14,0,0,0,95.7,79.81L73.41,102.1a14,14,0,0,0,0,19.8l6.1,6.1L19.76,187.76a6,6,0,0,0,2.34,9.93l72,24a6,6,0,0,0,6.14-1.45L136,184.49l6.1,6.1a14,14,0,0,0,19.8,0l22.28-22.29a14,14,0,0,0,17.72-1.71l50.34-50.35A6,6,0,0,0,252.24,107.76ZM94.38,209.14,35.11,189.38,88,136.49,127.51,176Zm59-27a2,2,0,0,1-2.82,0l-10.35-10.34h0l-48-48h0L81.9,113.41a2,2,0,0,1,0-2.82L104,88.49,175.51,160Z',
        'text-underline': 'M198,224a6,6,0,0,1-6,6H64a6,6,0,0,1,0-12H192A6,6,0,0,1,198,224Zm-70-26a62.07,62.07,0,0,0,62-62V56a6,6,0,0,0-12,0v80a50,50,0,0,1-100,0V56a6,6,0,0,0-12,0v80A62.07,62.07,0,0,0,128,198Z',
        'text-strikethrough': 'M222,128a6,6,0,0,1-6,6H169.45c11.28,6.92,20.55,17.38,20.55,34,0,25.36-27.81,46-62,46s-62-20.64-62-46a6,6,0,0,1,12,0c0,18.75,22.43,34,50,34s50-15.25,50-34c0-18.23-15.46-26.59-40.47-34H40a6,6,0,0,1,0-12H216A6,6,0,0,1,222,128ZM76.33,102a6.2,6.2,0,0,0,1.88-.3A6,6,0,0,0,82,94.13,19.74,19.74,0,0,1,81.11,88c0-19.38,20.16-34,46.89-34,19.58,0,35.56,7.81,42.74,20.89a6,6,0,0,0,10.52-5.78C171.94,52.13,152,42,128,42,94.43,42,69.11,61.77,69.11,88a31.62,31.62,0,0,0,1.52,9.87A6,6,0,0,0,76.33,102Z',
        'check': 'M228.24,76.24l-128,128a6,6,0,0,1-8.48,0l-56-56a6,6,0,0,1,8.48-8.48L96,191.51,219.76,67.76a6,6,0,0,1,8.48,8.48Z',
        'push-pin': 'M233.91,82.79,173.22,22.1a14,14,0,0,0-19.81,0L98.93,76.77c-9.52-3.25-34-8.34-59.71,12.41A14,14,0,0,0,38.1,110l49.71,49.71-44.05,44a6,6,0,1,0,8.48,8.48l44.05-44.05L146,217.89a14,14,0,0,0,9.9,4.11q.49,0,1,0a14,14,0,0,0,10.19-5.54c19.72-26.21,17.15-47.23,12.46-59.3l54.37-54.55A14,14,0,0,0,233.91,82.79ZM225.42,94.1h0l-57.27,57.46a6,6,0,0,0-1.11,6.92c9.94,19.88-1.71,40.32-9.54,50.72a2,2,0,0,1-3,.2L46.58,101.51a2,2,0,0,1,.18-3c12.5-10.09,24.5-12.76,33.7-12.76a42.13,42.13,0,0,1,17.25,3.41A6,6,0,0,0,104.64,88L161.9,30.59a2,2,0,0,1,2.83,0l60.69,60.68A2,2,0,0,1,225.42,94.1Z',
        'push-pin-fill': 'M235.33,104l-53.47,53.65c4.56,12.67,6.45,33.89-13.19,60A15.93,15.93,0,0,1,157,224c-.38,0-.75,0-1.13,0a16,16,0,0,1-11.32-4.69L96.29,171,53.66,213.66a8,8,0,0,1-11.32-11.32L85,159.71l-48.3-48.3A16,16,0,0,1,38,87.63c25.42-20.51,49.75-16.48,60.4-13.14L152,20.7a16,16,0,0,1,22.63,0l60.69,60.68A16,16,0,0,1,235.33,104Z',
        'note': 'M90,96a6,6,0,0,1,6-6h64a6,6,0,0,1,0,12H96A6,6,0,0,1,90,96Zm6,38h64a6,6,0,0,0,0-12H96a6,6,0,0,0,0,12Zm32,20H96a6,6,0,0,0,0,12h32a6,6,0,0,0,0-12ZM222,48V156.69a13.94,13.94,0,0,1-4.1,9.9L166.59,217.9a13.94,13.94,0,0,1-9.9,4.1H48a14,14,0,0,1-14-14V48A14,14,0,0,1,48,34H208A14,14,0,0,1,222,48ZM48,210H154V160a6,6,0,0,1,6-6h50V48a2,2,0,0,0-2-2H48a2,2,0,0,0-2,2V208A2,2,0,0,0,48,210Zm153.52-44H166v35.52Z',
        'note-pencil': 'M228.24,59.76l-32-32a6,6,0,0,0-8.48,0l-96,96A6,6,0,0,0,90,128v32a6,6,0,0,0,6,6h32a6,6,0,0,0,4.24-1.76l96-96A6,6,0,0,0,228.24,59.76ZM125.51,154H102V130.49l66-66L191.51,88ZM200,79.51,176.49,56,192,40.49,215.51,64ZM222,128v80a14,14,0,0,1-14,14H48a14,14,0,0,1-14-14V48A14,14,0,0,1,48,34h80a6,6,0,0,1,0,12H48a2,2,0,0,0-2,2V208a2,2,0,0,0,2,2H208a2,2,0,0,0,2-2V128a6,6,0,0,1,12,0Z',
        'pencil-simple': 'M225.9,74.78,181.21,30.09a14,14,0,0,0-19.8,0L38.1,153.41a13.94,13.94,0,0,0-4.1,9.9V208a14,14,0,0,0,14,14H92.69a13.94,13.94,0,0,0,9.9-4.1L225.9,94.58a14,14,0,0,0,0-19.8ZM94.1,209.41a2,2,0,0,1-1.41.59H48a2,2,0,0,1-2-2V163.31a2,2,0,0,1,.59-1.41L136,72.48,183.51,120ZM217.41,86.1,192,111.51,144.49,64,169.9,38.58a2,2,0,0,1,2.83,0l44.68,44.69a2,2,0,0,1,0,2.83Z',
        'eraser': 'M223.57,81.81,182.19,40.43a22,22,0,0,0-31.12,0L32.43,159.07a22,22,0,0,0,0,31.11L62.5,220.24A6,6,0,0,0,66.74,222H216a6,6,0,0,0,0-12H126.49l97.08-97.08A22,22,0,0,0,223.57,81.81ZM109.51,210H69.22l-28.3-28.3a10,10,0,0,1,0-14.15L96,112.48,151.52,168ZM215.08,104.44,160,159.51,104.48,104l55.08-55.07a10,10,0,0,1,14.14,0l41.38,41.37A10,10,0,0,1,215.08,104.44Z',
        'trash': 'M216,50H174V40a22,22,0,0,0-22-22H104A22,22,0,0,0,82,40V50H40a6,6,0,0,0,0,12H50V208a14,14,0,0,0,14,14H192a14,14,0,0,0,14-14V62h10a6,6,0,0,0,0-12ZM94,40a10,10,0,0,1,10-10h48a10,10,0,0,1,10,10V50H94ZM194,208a2,2,0,0,1-2,2H64a2,2,0,0,1-2-2V62H194ZM110,104v64a6,6,0,0,1-12,0V104a6,6,0,0,1,12,0Zm48,0v64a6,6,0,0,1-12,0V104a6,6,0,0,1,12,0Z',
        'check-square': 'M172.24,99.76a6,6,0,0,1,0,8.48l-56,56a6,6,0,0,1-8.48,0l-24-24a6,6,0,0,1,8.48-8.48L112,151.51l51.76-51.75A6,6,0,0,1,172.24,99.76ZM222,48V208a14,14,0,0,1-14,14H48a14,14,0,0,1-14-14V48A14,14,0,0,1,48,34H208A14,14,0,0,1,222,48Zm-12,0a2,2,0,0,0-2-2H48a2,2,0,0,0-2,2V208a2,2,0,0,0,2,2H208a2,2,0,0,0,2-2Z',
        'square': 'M208,34H48A14,14,0,0,0,34,48V208a14,14,0,0,0,14,14H208a14,14,0,0,0,14-14V48A14,14,0,0,0,208,34Zm2,174a2,2,0,0,1-2,2H48a2,2,0,0,1-2-2V48a2,2,0,0,1,2-2H208a2,2,0,0,1,2,2Z',
        'copy': 'M216,34H88a6,6,0,0,0-6,6V82H40a6,6,0,0,0-6,6V216a6,6,0,0,0,6,6H168a6,6,0,0,0,6-6V174h42a6,6,0,0,0,6-6V40A6,6,0,0,0,216,34ZM162,210H46V94H162Zm48-48H174V88a6,6,0,0,0-6-6H94V46H210Z',
        'x': 'M204.24,195.76a6,6,0,1,1-8.48,8.48L128,136.49,60.24,204.24a6,6,0,0,1-8.48-8.48L119.51,128,51.76,60.24a6,6,0,0,1,8.48-8.48L128,119.51l67.76-67.75a6,6,0,0,1,8.48,8.48L136.49,128Z',
        'caret-down': 'M212.24,100.24l-80,80a6,6,0,0,1-8.48,0l-80-80a6,6,0,0,1,8.48-8.48L128,167.51l75.76-75.75a6,6,0,0,1,8.48,8.48Z',
        'caret-right': 'M180.24,132.24l-80,80a6,6,0,0,1-8.48-8.48L167.51,128,91.76,52.24a6,6,0,0,1,8.48-8.48l80,80A6,6,0,0,1,180.24,132.24Z',
        'magnifying-glass': 'M228.24,219.76l-51.38-51.38a86.15,86.15,0,1,0-8.48,8.48l51.38,51.38a6,6,0,0,0,8.48-8.48ZM38,112a74,74,0,1,1,74,74A74.09,74.09,0,0,1,38,112Z',
        'eye': 'M245.48,125.57c-.34-.78-8.66-19.23-27.24-37.81C201,70.54,171.38,50,128,50S55,70.54,37.76,87.76c-18.58,18.58-26.9,37-27.24,37.81a6,6,0,0,0,0,4.88c.34.77,8.66,19.22,27.24,37.8C55,185.47,84.62,206,128,206s73-20.53,90.24-37.75c18.58-18.58,26.9-37,27.24-37.8A6,6,0,0,0,245.48,125.57ZM128,194c-31.38,0-58.78-11.42-81.45-33.93A134.77,134.77,0,0,1,22.69,128,134.56,134.56,0,0,1,46.55,95.94C69.22,73.42,96.62,62,128,62s58.78,11.42,81.45,33.94A134.56,134.56,0,0,1,233.31,128C226.94,140.21,195,194,128,194Zm0-112a46,46,0,1,0,46,46A46.06,46.06,0,0,0,128,82Zm0,80a34,34,0,1,1,34-34A34,34,0,0,1,128,162Z',
        'eye-slash': 'M52.44,36A6,6,0,0,0,43.56,44L64.44,67c-37.28,21.9-53.23,57-53.92,58.57a6,6,0,0,0,0,4.88c.34.77,8.66,19.22,27.24,37.8C55,185.47,84.62,206,128,206a124.91,124.91,0,0,0,52.57-11.25l23,25.29a6,6,0,0,0,8.88-8.08Zm48.62,71.32,45,49.52a34,34,0,0,1-45-49.52ZM128,194c-31.38,0-58.78-11.42-81.45-33.93A134.57,134.57,0,0,1,22.69,128c4.29-8.2,20.1-35.18,50-51.91L92.89,98.3a46,46,0,0,0,61.35,67.48l17.81,19.6A113.47,113.47,0,0,1,128,194Zm6.4-99.4a6,6,0,0,1,2.25-11.79,46.17,46.17,0,0,1,37.15,40.87,6,6,0,0,1-5.42,6.53l-.56,0a6,6,0,0,1-6-5.45A34.1,34.1,0,0,0,134.4,94.6Zm111.08,35.85c-.41.92-10.37,23-32.86,43.12a6,6,0,1,1-8-8.94A134.07,134.07,0,0,0,233.31,128a134.67,134.67,0,0,0-23.86-32.07C186.78,73.42,159.38,62,128,62a120.19,120.19,0,0,0-19.69,1.6,6,6,0,1,1-2-11.83A131.12,131.12,0,0,1,128,50c43.38,0,73,20.54,90.24,37.76,18.58,18.58,26.9,37,27.24,37.81A6,6,0,0,1,245.48,130.45Z',
        'warning': 'M235.07,189.09,147.61,37.22h0a22.75,22.75,0,0,0-39.22,0L20.93,189.09a21.53,21.53,0,0,0,0,21.72A22.35,22.35,0,0,0,40.55,222h174.9a22.35,22.35,0,0,0,19.6-11.19A21.53,21.53,0,0,0,235.07,189.09ZM224.66,204.8a10.46,10.46,0,0,1-9.21,5.2H40.55a10.46,10.46,0,0,1-9.21-5.2,9.51,9.51,0,0,1,0-9.72L118.79,43.21a10.75,10.75,0,0,1,18.42,0l87.46,151.87A9.51,9.51,0,0,1,224.66,204.8ZM122,144V104a6,6,0,0,1,12,0v40a6,6,0,0,1-12,0Zm16,36a10,10,0,1,1-10-10A10,10,0,0,1,138,180Z',
        'warning-circle': 'M128,26A102,102,0,1,0,230,128,102.12,102.12,0,0,0,128,26Zm0,192a90,90,0,1,1,90-90A90.1,90.1,0,0,1,128,218Zm-6-82V80a6,6,0,0,1,12,0v56a6,6,0,0,1-12,0Zm16,36a10,10,0,1,1-10-10A10,10,0,0,1,138,172Z',
        'info': 'M142,176a6,6,0,0,1-6,6,14,14,0,0,1-14-14V128a2,2,0,0,0-2-2,6,6,0,0,1,0-12,14,14,0,0,1,14,14v40a2,2,0,0,0,2,2A6,6,0,0,1,142,176ZM124,94a10,10,0,1,0-10-10A10,10,0,0,0,124,94Zm106,34A102,102,0,1,1,128,26,102.12,102.12,0,0,1,230,128Zm-12,0a90,90,0,1,0-90,90A90.1,90.1,0,0,0,218,128Z',
        'arrow-u-up-left': 'M230,144a62.07,62.07,0,0,1-62,62H80a6,6,0,0,1,0-12h88a50,50,0,0,0,0-100H46.49l37.75,37.76a6,6,0,1,1-8.48,8.48l-48-48a6,6,0,0,1,0-8.48l48-48a6,6,0,0,1,8.48,8.48L46.49,82H168A62.07,62.07,0,0,1,230,144Z',
        'arrow-u-up-right': 'M171.76,131.76,209.51,94H88a50,50,0,0,0,0,100h88a6,6,0,0,1,0,12H88A62,62,0,0,1,88,82H209.51L171.76,44.24a6,6,0,0,1,8.48-8.48l48,48a6,6,0,0,1,0,8.48l-48,48a6,6,0,0,1-8.48-8.48Z',
        'arrow-counter-clockwise': 'M222,128a94,94,0,0,1-92.74,94H128a93.43,93.43,0,0,1-64.5-25.65,6,6,0,1,1,8.24-8.72A82,82,0,1,0,70,70l-.19.19L39.44,98H72a6,6,0,0,1,0,12H24a6,6,0,0,1-6-6V56a6,6,0,0,1,12,0V90.34L61.63,61.4A94,94,0,0,1,222,128Z',
        'list-bullets': 'M82,64a6,6,0,0,1,6-6H216a6,6,0,0,1,0,12H88A6,6,0,0,1,82,64Zm134,58H88a6,6,0,0,0,0,12H216a6,6,0,0,0,0-12Zm0,64H88a6,6,0,0,0,0,12H216a6,6,0,0,0,0-12ZM44,54A10,10,0,1,0,54,64,10,10,0,0,0,44,54Zm0,128a10,10,0,1,0,10,10A10,10,0,0,0,44,182Zm0-64a10,10,0,1,0,10,10A10,10,0,0,0,44,118Z',
        'keyboard': 'M224,50H32A14,14,0,0,0,18,64V192a14,14,0,0,0,14,14H224a14,14,0,0,0,14-14V64A14,14,0,0,0,224,50Zm2,142a2,2,0,0,1-2,2H32a2,2,0,0,1-2-2V64a2,2,0,0,1,2-2H224a2,2,0,0,1,2,2Zm-20-64a6,6,0,0,1-6,6H56a6,6,0,0,1,0-12H200A6,6,0,0,1,206,128Zm0-32a6,6,0,0,1-6,6H56a6,6,0,0,1,0-12H200A6,6,0,0,1,206,96ZM70,160a6,6,0,0,1-6,6H56a6,6,0,0,1,0-12h8A6,6,0,0,1,70,160Zm96,0a6,6,0,0,1-6,6H96a6,6,0,0,1,0-12h64A6,6,0,0,1,166,160Zm40,0a6,6,0,0,1-6,6h-8a6,6,0,0,1,0-12h8A6,6,0,0,1,206,160Z',
        'power': 'M122,128V48a6,6,0,0,1,12,0v80a6,6,0,0,1-12,0Zm57.28-77A6,6,0,0,0,172.72,61C196.41,76.47,210,100.88,210,128a82,82,0,0,1-164,0c0-27.12,13.59-51.53,37.28-67A6,6,0,0,0,76.72,51C49.57,68.68,34,96.75,34,128a94,94,0,0,0,188,0C222,96.75,206.43,68.68,179.28,51Z'
    };

    // A Phosphor icon: one outline path on a 256 grid, scaled to the 20px of a button (the 16px of
    // an icon next to text, the panel's carets). `under` and `over` are extra shapes (on the same
    // 256 grid) drawn beneath or on top of it, used to paint parts of an icon in an annotation's
    // color. Weight comes from the icon's name (push-pin-fill); the icon takes the text color.
    function phosphorIcon(name, { under = [], over = [] } = {}) {
        const size = /^caret-/.test(name) ? 16 : 20;
        const svg = svgEl('svg', { class: `icon icon-${size}`, viewBox: '0 0 256 256', 'aria-hidden': 'true', focusable: 'false' });
        under.forEach(s => svg.appendChild(s));
        svg.appendChild(svgEl('path', { d: PHOSPHOR_ICONS[name], class: 'ic' }));
        over.forEach(s => svg.appendChild(s));
        return svg;
    }

    const SANS_FONT = '"Anthropic Sans", Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const SERIF_FONT = '"Anthropic Serif", Georgia, Cambria, "Times New Roman", ui-serif, serif';

    // Colors from the Anthropic style reference: slate #141413, ivory #faf9f5 / #f0eee6, oat #e3dacc,
    // manilla #f5e3c7, stone #cccbc8, cloud #b0aea5 / #87867f, clay #d97757 / #c6613f. Tokens are named by role:
    // --ink* for text and filled controls (slate in light, ivory in dark), --surface* for backgrounds,
    // --line* for hairlines, and --accent* (clay) for the one primary action only. The annotations panel and the toast follow the page's
    // theme, which can differ from that of the other panels (see openPanel and showToast).
    const LIGHT_TOKENS = `
        --ink: #141413;
        --ink-2: #3d3d3a;
        --ink-disabled: #b0aea5;
        --ink-3: #66655f;
        --ink-4: #73726c;   /* placeholders: 4.6:1 on ivory (cloud #87867f is 3.5:1) */
        --surface: #faf9f5;
        --surface-hover: #f0eee6;
        --surface-pressed: #e3dacc;
        --surface-selected: #f5e3c7;
        --line: #cccbc8;
        --line-hover: #b0aea5;
        --line-pressed: #87867f;
        --line-strong: #87867f;
        --line-disabled: #e3dacc;
        --ink-pressed: #141413;
        --on-ink: #faf9f5;
        --danger: #a8321a;
        --success: #55683c;
        --warning: #b4532f;
        --accent: #d97757;
        --accent-hover: #c6613f;
        --accent-pressed: #b0553a;
        --on-accent: #141413;
        --focus-inner: #faf9f5;
        --focus: #141413;
        --transparent-stroke: transparent;
        --overlay: rgba(20, 20, 19, 0.4);
        --radius-sm: 2px;
        --radius-md: 4px;
        --radius-button: 8px;
        --radius-lg: 12px;
        --radius-card: 16px;
        --text-sm: 12px;   /* type scale: captions, hints, meta */
        --leading-sm: 16px;
        --text-md: 14px;   /* body and controls */
        --leading-md: 20px;
        --divider: #cccbc8;
        --duration-fast: 100ms;
        --duration-normal: 150ms;
        --duration-slow: 300ms;
        --ease-out: ease-out;   /* Anthropic motion: short, calm fades */
        --color-scheme: light;
    `;
    // The reference only has a dark footer, so dark is its inversion: slate surfaces, ivory text,
    // darker hairlines.
    const DARK_TOKENS = `
        --ink: #faf9f5;
        --ink-2: #cccbc8;
        --ink-disabled: #5c5b56;
        --ink-3: #b0aea5;
        --ink-4: #87867f;
        --surface: #141413;
        --surface-hover: #1f1f1d;
        --surface-pressed: #2a2a28;
        --surface-selected: #262624;
        --line: #3d3d3a;
        --line-hover: #4d4d49;
        --line-pressed: #5c5b56;
        --line-strong: #87867f;
        --line-disabled: #3d3d3a;
        --ink-pressed: #b0aea5;
        --on-ink: #141413;
        --danger: #e5867a;
        --success: #a3b88a;
        --warning: #e58f6f;
        --focus-inner: #141413;
        --focus: #faf9f5;
        --overlay: rgba(0, 0, 0, 0.5);
        --divider: #3d3d3a;
        --color-scheme: dark;
    `;
    const UI_CSS = `
        :host { all: initial; ${LIGHT_TOKENS} }
        :host([data-theme="dark"]) { ${DARK_TOKENS} }
        .panel[data-theme="light"], .toast[data-theme="light"], .pen[data-theme="light"], .everything[data-theme="light"], .sitemenu[data-theme="light"] { ${LIGHT_TOKENS} }
        .panel[data-theme="dark"], .toast[data-theme="dark"], .pen[data-theme="dark"], .everything[data-theme="dark"], .sitemenu[data-theme="dark"] { ${DARK_TOKENS} }
        [hidden]:not(.surface):not(.everything), .tip[hidden] { display: none !important; }
        /* Surfaces fade out rather than vanish: display flips last (allow-discrete), so the hidden attribute
           still takes effect at once for scripts. */
        .surface:not(.tip) { transition: opacity var(--duration-normal) var(--ease-out), display var(--duration-normal) allow-discrete; }
        .everything { transition: opacity var(--duration-normal) var(--ease-out), display var(--duration-normal) allow-discrete; }
        .everything[hidden] { display: none; opacity: 0; pointer-events: none; }
        .everything:not([hidden]) { animation: highlighter-fade var(--duration-normal) var(--ease-out); }
        @keyframes highlighter-fade { from { opacity: 0; } }
        .surface:not(.tip)[hidden] { display: none; opacity: 0; pointer-events: none; }
        /* Scrollbars (note box, card text, lists) follow our theme, not the page's. Set here, not on
           :host: the host's inline all: initial !important would reset it. */
        .surface, .everything { color-scheme: var(--color-scheme); }

        /* Every floating panel (toolbar, note preview, note editor, toast, tooltip) shares this
           surface: flat parchment with a 1px hairline instead of a shadow, 12px corners. The cards
           (note preview, note editor, panel, dialog, toast) take 16px, the tooltip 4px. */
        .surface {
            position: fixed; top: 0; left: 0; box-sizing: border-box;
            font-family: ${SANS_FONT}; font-size: var(--text-md); line-height: var(--leading-md); font-weight: 400;
            color: var(--ink); background: var(--surface);
            border: 1px solid var(--line); border-radius: var(--radius-lg);
            box-shadow: none;
            animation: highlighter-enter var(--duration-normal) var(--ease-out);
        }
        /* In the page, not the window: they scroll with their text (see uiHost). */
        .surface.toolbar, .surface.tip, .surface.card, .surface.editor { position: absolute; }
        .surface.card, .surface.editor, .surface.panel, .surface.everything-box, .surface.toast { border-radius: var(--radius-card); }
        @keyframes highlighter-pin { from { border-color: var(--line-pressed); } }
        @keyframes highlighter-enter { from { opacity: 0; } }

        .icon { display: block; flex: none; fill: currentColor; }
        .icon-20 { width: 20px; height: 20px; }
        .icon-16 { width: 16px; height: 16px; }

        /* Button: subtle appearance, size medium (32px), the same in the toolbar and the
           panels, so every icon has the same padding (6px), hover square and spacing. */
        .btn {
            box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
            gap: 6px; min-width: 64px; height: 32px; margin: 0; padding: 0 12px;
            border: 1px solid transparent; border-radius: var(--radius-button);
            font-family: inherit; font-size: var(--text-md); line-height: var(--leading-md); font-weight: 400;
            cursor: pointer; outline: none; user-select: none; -webkit-tap-highlight-color: transparent;
            transition: background-color var(--duration-fast) var(--ease-out),
                        border-color var(--duration-fast) var(--ease-out),
                        color var(--duration-fast) var(--ease-out);
        }
        .btn:not(.btn-icon) { font-weight: 600; }
        .btn-icon { min-width: 0; width: 32px; padding: 0; }
        .btn-subtle { background: transparent; color: var(--ink-2); }
        /* A style the selected text already has: a subtle toggle button, checked. */
        .btn-subtle[aria-pressed="true"] { background: var(--surface-selected); color: var(--ink); }
        .btn-subtle[aria-pressed="true"] .icon { color: var(--ink); }
        .btn-subtle:hover { background: var(--surface-hover); color: var(--ink); }
        /* Pressed: also while a key holds a focused button down. */
        .btn-subtle:hover:active, .btn-subtle:active:focus-visible { background: var(--surface-pressed); color: var(--ink); }
        .btn-subtle:hover .icon { color: var(--ink); }
        .btn-subtle:hover:active .icon, .btn-subtle:active:focus-visible .icon { color: var(--ink); }
        /* Focus: border plus a 1px inset ring; the transparent outline shows in forced colors. */
        .btn:focus-visible { border-color: var(--focus); outline: 2px solid var(--transparent-stroke); box-shadow: inset 0 0 0 1px var(--focus); z-index: 1; }
        /* The one primary action, the note editor's Save: clay, with only its bottom corners rounded (the
           reference's filled button). Disabled while there is nothing to save, then as quiet as a subtle one. */
        .btn-primary { background: var(--accent); color: var(--on-accent); border-radius: 0 0 var(--radius-button) var(--radius-button); }
        .btn-primary:hover { background: var(--accent-hover); }
        .btn-primary:hover:active, .btn-primary:active:focus-visible { background: var(--accent-pressed); }
        .btn-primary:disabled, .btn-primary:disabled:hover, .btn-primary:disabled:active { background: transparent; color: var(--ink-disabled); cursor: not-allowed; }
        /* The disabled subtle button: */
        .btn-subtle:disabled, .btn-subtle:disabled:hover, .btn-subtle:disabled:active { background: transparent; color: var(--ink-disabled); cursor: not-allowed; }
        .btn-subtle:disabled .icon, .btn-subtle:disabled:hover .icon, .btn-subtle:disabled:active .icon { color: var(--ink-disabled); }

        /* Annotations selected by clicking them: a solid 1px outline around their lines' shape,
           black, or white on a dark page. */
        .select-box { position: absolute; top: 0; left: 0; pointer-events: none; color: #000000; }
        .select-box[data-theme="dark"] { color: #ffffff; }
        .select-box svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
        .select-box path { fill: none; stroke: currentColor; stroke-width: 1; stroke-linejoin: round; }

        /* Toolbar */
        /* Flat like the other surfaces, with longer,
           hairline separators. */
        /* 4px padding: with 32px buttons the toolbar is 40px high, close to Edge's (about 42px). */
        .toolbar { display: flex; align-items: center; gap: round(2px, calc(1px / var(--dpr, 1))); padding: 4px 8px; }
        /* Idle fade-out (see TOOLBAR_IDLE_MS). Pointing at the toolbar brings it back at once. */
        .toolbar.fading { opacity: 0; transition: opacity var(--duration-slow) var(--ease-out); }
        .divider { flex: none; width: calc(1px / var(--dpr, 1)); height: 24px; margin: 0 round(10px, calc(1px / var(--dpr, 1))); background: var(--divider); }
        @media (pointer: coarse) { .toolbar .btn-icon { width: 40px; height: 40px; } }

        /* Tooltip */
        /* One line, kept inside the view: nowrap measures the tip at its full width wherever it last
           stood, so placePanel() can move it in from the edge instead of the edge squeezing it. */
        .tip { white-space: nowrap; max-width: calc(100vw - 8px); overflow: hidden; text-overflow: ellipsis; padding: 4px 11px 6px; font-size: var(--text-sm); line-height: var(--leading-sm); border-radius: var(--radius-md); pointer-events: none; }
        .tip .kbd { margin-left: 8px; color: var(--ink-3); }

        /* Panels (note preview, note editor, toast) all have 12px padding. Their 32px icon buttons
           are pulled out by 4px with negative margins, so every button sits 8px from the panel's
           edges, every icon 14px, and neighbouring buttons are 2px apart. */

        /* Note preview */
        .card { width: max-content; min-width: 160px; max-width: min(320px, calc(100vw - 16px)); padding: 12px; }
        .card-text { font-family: ${SERIF_FONT}; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 240px; overflow: auto; overscroll-behavior: contain; }
        .card-text a { color: var(--ink); text-decoration: underline; text-underline-offset: 2px; border-radius: var(--radius-md); outline: none; }
        .card-text a:hover { color: var(--ink-2); }
        .card-text a:focus-visible { outline: 2px solid var(--focus); }
        .card[data-pinned] .card-footer { cursor: move; user-select: none; }
        .card[data-pinned] { z-index: -1; }   /* pinned previews sit under the Alt+O and Alt+Shift+O panels */
        .card-footer { display: flex; align-items: center; gap: 12px; margin: 4px -4px -8px 0; }
        .card-hint { flex: 1; font-size: var(--text-sm); line-height: var(--leading-sm); color: var(--ink-3); }
        .card-actions { display: flex; gap: 2px; }

        /* Note editor, with an outline Textarea */
        /* As wide as its note box, which starts 292px wide (a 320px panel, the note preview at its
           widest) and can be dragged wider, never narrower. */
        .editor { max-width: calc(100vw - 16px); padding: 12px; }
        .editor-header { display: flex; align-items: center; justify-content: space-between; min-height: 32px; margin: -8px -4px 4px 0; }
        /* Save and Delete, icon only, at the top right. */
        .editor-actions { display: flex; align-items: center; gap: 2px; }
        .editor-title { font-weight: 600; }
        .field {
            position: relative; box-sizing: border-box; background: var(--surface);
            /* Anthropic input: one plain hairline on all four sides that darkens to the text color on focus. */
            border: 1px solid var(--line); border-radius: var(--radius-md);
            /* Clips the textarea (and its scrollbar) to the rounded corners. */
            overflow: hidden;
            transition: border-color 100ms ease-out;
        }
        .field:hover { border-color: var(--line-hover); }
        .field:focus-within { border-color: var(--ink); }
        textarea {
            /* Height is set by sizeNoteInput(): NOTE_MIN_LINES to NOTE_MAX_LINES, then it scrolls.
               The corner handle resizes it (and the panel) for the current edit only. */
            display: block; box-sizing: border-box; width: 292px; min-width: 292px; margin: 0; padding: 5px 11px;
            min-height: 30px; max-width: min(640px, calc(100vw - 50px)); max-height: 60vh;   /* 30px: one line */
            border: 0; outline: 0; resize: both; overflow-y: auto; overscroll-behavior: contain; background: transparent;
            color: var(--ink); font: inherit; font-family: ${SERIF_FONT};
        }
        textarea::placeholder { color: var(--ink-4); opacity: 1; }
        /* width 0 + min-width 100%: the hint wraps to the note box's width instead of widening the
           panel, which would leave the box's border wider than the textarea and its scrollbar. */
        .field-hint { width: 0; min-width: 100%; margin-top: 4px; font-size: var(--text-sm); line-height: var(--leading-sm); color: var(--ink-3); }
        /* Toast */
        .toast { top: auto; left: auto; right: 16px; bottom: 16px; display: flex; align-items: flex-start; gap: 8px; width: min(292px, calc(100vw - 32px)); padding: 12px; }
        .toast .icon { color: var(--ink-2); }
        .toast[data-intent="success"] > .icon { color: var(--success); }
        .toast[data-intent="warning"] > .icon { color: var(--warning); }
        .toast[data-intent="error"] > .icon { color: var(--danger); }
        .toast > .icon { width: 16px; height: 16px; margin-top: 2px; }
        .toast-content { flex: 1; min-width: 0; }
        .toast-text { font-weight: 600; }
        .toast .btn-icon { margin: -6px 0; }
        .toast .btn-icon:last-child { margin-right: -6px; }
        /* The toast's action (Undo, Restore, Show): a small subtle button. */
        .btn-small { min-width: 0; height: 24px; padding: 0 8px; font-size: var(--text-sm); line-height: var(--leading-sm); border-radius: var(--radius-md); }
        .toast .btn-small { flex: none; margin: -2px 0; }
        .toast .btn-small[hidden] { display: none; }
        .toast:focus-visible { outline: 2px solid var(--focus); }
        /* The pen's bar, centred at the top of the view. */
        .pen { top: 12px; right: 0; margin: 0 auto; width: max-content; max-width: calc(100vw - 32px); display: flex; align-items: center; gap: round(2px, calc(1px / var(--dpr, 1))); padding: 4px 8px; }
        /* The sticky menu: the site switch, with a row of icon buttons expanding to its right. */
        .sitemenu { display: flex; align-items: center; padding: 4px; width: max-content; cursor: grab; }
        .sitemenu .btn { cursor: pointer; }
        .sitemenu-handle { position: relative; align-self: stretch; width: 12px; cursor: grab; }
        /* A hairline bar, darker under the pointer. */
        .sitemenu-handle::before { content: ''; position: absolute; top: 50%; left: 5px; width: 2px; height: 16px; margin-top: -8px; border-radius: 1px; background: var(--line-strong); transition: background-color var(--duration-fast) var(--ease-out); }
        .sitemenu-handle:hover::before, .sitemenu-handle:active::before { background: var(--ink-3); }
        @media (prefers-reduced-motion: reduce) { .sitemenu-handle::before { transition: none; } }
        .sitemenu-expand { display: flex; justify-content: center; }
        .sitemenu-expand .icon { transform: rotate(-90deg); transition: transform var(--duration-normal) var(--ease-out); }
        .sitemenu-expand [aria-expanded="true"] .icon { transform: rotate(90deg); }
        @media (prefers-reduced-motion: reduce) { .sitemenu-expand .icon { transition: none; } }
        .sitemenu-tools { display: grid; grid-template-columns: 0fr; opacity: 0; transition: grid-template-columns var(--duration-normal) var(--ease-out), opacity var(--duration-normal) var(--ease-out); }
        .sitemenu[data-open] .sitemenu-tools { grid-template-columns: 1fr; opacity: 1; }
        .sitemenu-inner { overflow: hidden; min-width: 0; display: flex; align-items: center; gap: 2px; }
        .sitemenu-inner > :first-child { margin-left: 2px; }
        @media (prefers-reduced-motion: reduce) { .sitemenu-tools { transition: none; } }
        /* Everything saved (Alt+Shift+O): a dialog over the dimmed page. */
        .everything { position: fixed; inset: 0; display: flex; align-items: flex-start; justify-content: center; padding: 32px 16px; box-sizing: border-box; background: var(--overlay); font-family: ${SANS_FONT}; font-size: var(--text-md); line-height: var(--leading-md); color: var(--ink); }
        .everything-box { position: relative; display: flex; flex-direction: column; width: min(600px, 100%); max-height: 100%; padding: 12px 0 0; }
        .everything-box .panel-header { margin: -8px 8px 4px 12px; }
        .everything-box .field { flex: none; margin: 0 12px 8px; }
        .everything-list { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 0 8px 8px; overscroll-behavior: contain; }
        .page-head {
            display: flex; align-items: center; gap: 8px; width: 100%; margin: 0; padding: 6px 4px; border: 0;
            border-radius: var(--radius-md); background: none; font: inherit; color: inherit; text-align: left;
            cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent;
        }
        .page-head:hover { background: var(--surface-hover); }
        .page-head:hover:active { background: var(--surface-pressed); }
        .page-head:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
        .page-name { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .page-host { font-weight: 600; }
        .page-path { margin-left: 6px; color: var(--ink-3); }
        .page-meta { flex: none; font-size: var(--text-sm); color: var(--ink-3); }
        .page-items { padding-left: 20px; }
        a.item-main { text-decoration: none; }

        /* Annotations panel: a panel along the right edge, above the page. */
        .panel {
            top: 8px; left: auto; right: 8px; display: flex; flex-direction: column;
            width: min(360px, calc(100vw - 16px)); max-height: calc(100vh - 16px); padding: 12px 0 0;
        }
        .panel-header { display: flex; align-items: center; gap: 8px; min-height: 32px; margin: -8px 8px 4px 12px; }
        .panel-title { font-weight: 600; color: var(--ink); }
        .panel-count { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink-3); }
        .panel-actions { display: flex; align-items: center; gap: 2px; }
        .panel .field { flex: none; margin: 0 12px 8px; padding-bottom: 0; }
        .search-icon { position: absolute; left: 9px; top: 6px; color: var(--ink-3); pointer-events: none; }
        .field input {
            display: block; box-sizing: border-box; width: 100%; height: 31px; margin: 0; padding: 0 10px 0 33px;
            border: 0; outline: 0; background: transparent; color: var(--ink); font: inherit;
        }
        .field input::placeholder { color: var(--ink-4); opacity: 1; }
        .field input::-webkit-search-cancel-button { display: none; }
        .panel-list { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 0 8px 8px; overscroll-behavior: contain; }
        .section-title { margin: 8px 4px 4px; font-size: var(--text-sm); line-height: var(--leading-sm); font-weight: 600; color: var(--ink-3); }
        .empty { margin: 4px 4px 8px; color: var(--ink-3); }
        /* Checkbox: a 16px square with 2px corners, slate and a check mark when
           on, a slate outline with a smaller rounded square when mixed. */
        .check {
            appearance: none; flex: none; position: relative; width: 16px; height: 16px; margin: 0; cursor: pointer;
            border: 1px solid var(--line-strong); border-radius: var(--radius-sm); background: transparent;
            transition: background-color 100ms, border-color 100ms; box-sizing: border-box; outline: none; -webkit-tap-highlight-color: transparent;
        }
        .check:hover { border-color: var(--ink-3); }
        .check:active { border-color: var(--ink-2); }
        .check:checked { border-color: var(--ink); background: var(--ink); }
        .check:checked:hover { border-color: var(--ink-2); background: var(--ink-2); }
        .check:checked:active { border-color: var(--ink-pressed); background: var(--ink-pressed); }
        .check:checked::after, .check:indeterminate::after {
            content: ""; position: absolute; inset: 0; background: var(--on-ink);
            -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M9.76 3.2c.3.29.32.76.04 1.06l-4.25 4.5a.75.75 0 0 1-1.08.02L2.22 6.53a.75.75 0 0 1 1.06-1.06l1.7 1.7L8.7 3.24a.75.75 0 0 1 1.06-.04'/%3E%3C/svg%3E") center / 12px 12px no-repeat;
            mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M9.76 3.2c.3.29.32.76.04 1.06l-4.25 4.5a.75.75 0 0 1-1.08.02L2.22 6.53a.75.75 0 0 1 1.06-1.06l1.7 1.7L8.7 3.24a.75.75 0 0 1 1.06-.04'/%3E%3C/svg%3E") center / 12px 12px no-repeat;
        }
        .check:indeterminate { border-color: var(--ink); }
        .check:indeterminate::after {
            background: var(--ink);
            -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Z'/%3E%3C/svg%3E") center / 12px 12px no-repeat;
            mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Z'/%3E%3C/svg%3E") center / 12px 12px no-repeat;
        }
        .check:indeterminate:hover { border-color: var(--ink-2); }
        .check:indeterminate:hover::after { background: var(--ink-2); }
        .check:indeterminate:active { border-color: var(--ink-pressed); }
        .check:indeterminate:active::after { background: var(--ink-pressed); }
        .check:disabled, .check:disabled:hover, .check:disabled:active { cursor: default; border-color: var(--line-disabled); background: transparent; }
        .check:disabled::after { background: var(--ink-disabled); }
        .check:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
        .item .check { margin: 10px 8px 0 4px; opacity: 0; }
        .item:hover .check, .item .check:checked, .item .check:focus-visible { opacity: 1; }
        @media (hover: none) { .item .check { opacity: 1; } }
        .item { display: flex; align-items: flex-start; border-radius: var(--radius-md); }
        .item + .item { margin-top: 2px; }
        .item:has(.check:checked) { background: var(--surface-selected); }
        .item:hover { background: var(--surface-hover); }
        .item:hover:active { background: var(--surface-pressed); }
        /* The annotation itself: a button that scrolls to it. The bar at its left is its color. */
        .item-main {
            position: relative; flex: 1; min-width: 0; display: block; margin: 0; padding: 6px 4px 6px 14px;
            border: 0; border-radius: var(--radius-md); background: none; text-align: left;
            font: inherit; color: inherit; cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent;
        }
        .item-main:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
        .item-main::before { content: ""; position: absolute; left: 4px; top: 8px; bottom: 8px; width: 4px; border-radius: 2px; background: var(--swatch); }
        .item-text, .item-note { font-family: ${SERIF_FONT}; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
        .item-text { -webkit-line-clamp: 3; }
        .item-note { -webkit-line-clamp: 4; white-space: pre-wrap; margin-top: 2px; font-size: var(--text-sm); line-height: var(--leading-sm); color: var(--ink-2); }
        .item-meta { margin-top: 2px; font-size: var(--text-sm); line-height: var(--leading-sm); color: var(--ink-3); }
        .item-actions { display: flex; align-items: center; gap: 2px; padding: 4px 4px 0 0; opacity: 0; }
        .item:hover .item-actions, .item:focus-within .item-actions { opacity: 1; }
        @media (hover: none) { .item-actions { opacity: 1; } }
        .item-actions .btn:not(.btn-icon) { min-width: 0; }
        /* Not found: its actions sit below its text, always shown. */
        .missing { flex-direction: column; align-items: stretch; }
        .missing .item-main { cursor: default; padding-bottom: 2px; }
        .missing .item-main::before { opacity: 0.5; }
        .missing .item-actions { opacity: 1; padding: 0 4px 6px 6px; }

        @media (prefers-reduced-motion: reduce) {
            .surface, .everything { animation: none !important; transition: none; }
            .btn, .field::after, .toolbar.fading { transition: none; }
        }
        @media (forced-colors: active) {
            .surface { border-color: CanvasText; }
            .btn { border-color: ButtonText; }
            .btn[aria-pressed="true"] { background: Highlight; }
            .btn[aria-pressed="true"] .icon { color: HighlightText; }
            .field::after { background: Highlight; }
            .check { border-color: ButtonText; }
            .check:checked, .check:checked:hover, .check:checked:active { border-color: Highlight; background: Highlight; }
            .check:checked::after { background: HighlightText; }
            .check:indeterminate, .check:indeterminate:hover, .check:indeterminate:active { border-color: Highlight; }
            .check:indeterminate::after, .check:indeterminate:hover::after, .check:indeterminate:active::after { background: Highlight; }
            .check:disabled, .check:disabled:hover, .check:disabled:active { border-color: GrayText; }
            .check:disabled::after { background: GrayText; }
            .item:hover, .item:has(.check:checked), .page-head:hover { background: Highlight; color: HighlightText; }
            .item:hover *, .item:has(.check:checked) *, .page-head:hover * { color: HighlightText; }
            .item-main:focus-visible, .page-head:focus-visible, .check:focus-visible { outline-color: CanvasText; }
            .item-main::before { forced-color-adjust: none; }
            .select-box path { stroke: Highlight; }
            .sitemenu-handle::before, .sitemenu-handle:hover::before, .sitemenu-handle:active::before { forced-color-adjust: none; background: CanvasText; }
        }
    `;

    // A button in the Anthropic style. appearance: 'subtle' and size: 'medium' are the only ones the UI uses.
    function makeButton({ text = '', icon = null, appearance = 'subtle', size = 'medium', label = '' }) {
        const b = makeEl('button', { type: 'button', class: `btn btn-${appearance} btn-${size}${text ? '' : ' btn-icon'}` });
        if (icon) b.appendChild(icon);
        if (text) b.appendChild(makeEl('span', { text }));
        if (label) b.setAttribute('aria-label', label);
        return b;
    }

    // Placed in the page rather than the window (as selectHost below): the toolbar, note card,
    // editor and tooltip are positioned in it, so they scroll with the text in the same frame
    // instead of following it a frame late. The other panels are fixed to the window. Window
    // wide, so panels get the same room to lay out as in the window.
    const uiHost = makeEl('div', { [UI_ATTR]: '' });
    uiHost.style.cssText = 'all: initial !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 0 !important; z-index: 2147483647 !important;';
    const uiRoot = uiHost.attachShadow({ mode: 'closed' });
    // The device pixel ratio for the CSS (see .toolbar): spacing is rounded to whole device pixels.
    const setDpr = () => uiHost.style.setProperty('--dpr', String(window.devicePixelRatio || 1));
    setDpr();
    window.addEventListener('resize', setDpr);

    const toolbarEl = makeEl('div', { class: 'surface toolbar', role: 'toolbar', 'aria-label': 'Annotate selection', hidden: '' });
    const labelTipEl = makeEl('div', { class: 'surface tip', role: 'tooltip', hidden: '' });

    const cardText = makeEl('div', { class: 'card-text' });
    // Icon only, like the note editor's Save and Delete; its tooltip is added with addLabelTip().
    // The 16px pencil: the 20px one spans its box corner to corner and looks bigger than Save
    // and Delete; the 16px drawing has the same ink size as Save (14px) at full line weight.
    const cardPin = makeButton({ icon: phosphorIcon('push-pin') });
    const cardHint = makeEl('span', { class: 'card-hint' });   // the date it was added (see showNoteCard)
    const noteCardEl = makeEl('div', { class: 'surface card', hidden: '' }, [
        cardText,
        makeEl('div', { class: 'card-footer' }, [cardHint, makeEl('div', { class: 'card-actions' }, [cardPin])])
    ]);

    const editorTitle = makeEl('div', { class: 'editor-title', id: 'highlighter-note-title' });
    const noteInput = makeEl('textarea', { maxlength: String(NOTE_MAX_LENGTH), 'aria-labelledby': 'highlighter-note-title', placeholder: 'Add a note' });
    // Labels and tooltips are added with addLabelTip() further down.
    const noteSave = makeButton({ icon: phosphorIcon('check'), appearance: 'primary' });
    const noteDiscard = makeButton({ icon: phosphorIcon('x') });
    const noteDelete = makeButton({ icon: phosphorIcon('eraser') });
    // Save (or Enter) saves, Discard (or Esc, or opening another note) discards the changes,
    // and Delete deletes.
    const editorEl = makeEl('div', { class: 'surface editor', role: 'dialog', 'aria-labelledby': 'highlighter-note-title', hidden: '' }, [
        makeEl('div', { class: 'editor-header' }, [editorTitle, makeEl('div', { class: 'editor-actions' }, [noteSave, noteDiscard, noteDelete])]),
        makeEl('div', { class: 'field' }, [noteInput]),
        makeEl('div', { class: 'field-hint', text: 'Enter to save, Esc to cancel' })
    ]);

    let toastIcon = phosphorIcon('info');   // replaced per message
    const toastText = makeEl('div', { class: 'toast-text' });
    const toastContent = makeEl('div', { class: 'toast-content' }, [toastText]);
    const toastAction = makeButton({ icon: phosphorIcon('arrow-u-up-left') });   // an icon button (Undo, Restore, Show); icon, label and tooltip set per toast
    toastAction.hidden = true;
    const toastDismiss = makeButton({ icon: phosphorIcon('x'), label: 'Dismiss' });
    const toastEl = makeEl('div', { class: 'surface toast', role: 'status', tabindex: '-1', hidden: '' }, [toastIcon, toastContent, toastAction, toastDismiss]);

    // A panel's title: the counts in the quiet colour around the bold word "Annotations".
    function setPanelTitle(el, lead, tail, word = lead === '1' ? 'Annotation' : 'Annotations') {
        el.replaceChildren(lead + ' ', makeEl('span', { class: 'panel-title', text: word }), tail);
    }

    // The annotations panel (see openPanel). Its list is built by renderPanel.
    const panelCount = makeEl('div', { class: 'panel-count', 'aria-live': 'polite' });   // the whole title, see setPanelTitle
    const panelErase = makeButton({ icon: phosphorIcon('eraser') });
    panelErase.disabled = true;
    const panelSelectAll = makeButton({ icon: phosphorIcon('check-square') });
    const panelCopy = makeButton({ icon: phosphorIcon('copy') });
    panelCopy.disabled = true;
    const panelClose = makeButton({ icon: phosphorIcon('x') });
    const panelFilter = makeEl('input', { type: 'search', placeholder: 'Filter by text or note', 'aria-label': 'Filter annotations by text or note', spellcheck: 'false', autocomplete: 'off' });
    const searchIcon = phosphorIcon('magnifying-glass');
    searchIcon.classList.add('search-icon');
    const panelList = makeEl('div', { class: 'panel-list' });
    const panelEl = makeEl('div', { class: 'surface panel', role: 'complementary', 'aria-label': 'Annotations', hidden: '' }, [
        makeEl('div', { class: 'panel-header' }, [
            panelCount,
            makeEl('div', { class: 'panel-actions' }, [panelSelectAll, panelCopy, panelErase, panelClose])
        ]),
        makeEl('div', { class: 'field' }, [searchIcon, panelFilter]),
        panelList
    ]);

    // The pen (Alt+P, see setPen): a pill at the top of the view while it is on.
    const penEl = makeEl('div', { class: 'surface pen', role: 'toolbar', 'aria-label': 'Pen', hidden: '' });

    // Everything saved (Alt+Shift+O, see openEverything): a dialog over the dimmed page.
    const everythingCount = makeEl('div', { class: 'panel-count', 'aria-live': 'polite' });   // the whole title, see setPanelTitle
    const everythingSelectAll = makeButton({ icon: phosphorIcon('check-square') });
    const everythingCopy = makeButton({ icon: phosphorIcon('copy') });
    everythingCopy.disabled = true;
    const everythingForget = makeButton({ icon: phosphorIcon('eraser') });
    everythingForget.disabled = true;
    const everythingClose = makeButton({ icon: phosphorIcon('x') });
    const everythingFilter = makeEl('input', { type: 'search', placeholder: 'Search every page\'s annotations and notes', 'aria-label': 'Search saved annotations', spellcheck: 'false', autocomplete: 'off' });
    const everythingIcon = phosphorIcon('magnifying-glass');
    everythingIcon.classList.add('search-icon');
    const everythingList = makeEl('div', { class: 'everything-list', role: 'tree', 'aria-multiselectable': 'true', 'aria-label': 'Saved annotations' });
    const everythingEl = makeEl('div', { class: 'everything', hidden: '' }, [
        makeEl('div', { class: 'surface everything-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'All saved annotations' }, [
            makeEl('div', { class: 'panel-header' }, [
                everythingCount,
                makeEl('div', { class: 'panel-actions' }, [everythingSelectAll, everythingCopy, everythingForget, everythingClose])
            ]),
            makeEl('div', { class: 'field' }, [everythingIcon, everythingFilter]),
            everythingList
        ])
    ]);

    // The boxes around the annotations selected by clicking them (see setSelectedGroups).
    // They sit in a layer of their own, placed in the page rather than the window, so they scroll
    // with the page in the same frame as the text instead of following it a frame late. It stays
    // under the other panels.
    const selectHost = makeEl('div', { [UI_ATTR]: '' });
    selectHost.style.cssText = 'all: initial !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 0 !important; height: 0 !important; pointer-events: none !important; z-index: 2147483646 !important;';
    const selectRoot = selectHost.attachShadow({ mode: 'closed' });
    const selectBoxesEl = makeEl('div', { class: 'select-boxes' });
    selectRoot.append(makeEl('style', { text: UI_CSS }), selectBoxesEl);

    // The note card and editor draw over the panel, and the tooltip goes last so it draws on top
    // of whichever panel its button is in.
    uiRoot.append(makeEl('style', { text: UI_CSS }), panelEl, toolbarEl, noteCardEl, editorEl, toastEl, penEl, everythingEl, labelTipEl);

    // Keys typed in the note editor stay out of the page's own shortcut handlers.
    ['keydown', 'keyup', 'keypress'].forEach(type => uiHost.addEventListener(type, e => e.stopPropagation()));
    // Pressing a toolbar button must not take the page's text selection away.
    toolbarEl.addEventListener('mousedown', e => e.preventDefault());
    penEl.addEventListener('mousedown', e => e.preventDefault());

    // The panels take the theme of what they open next to (`dark`), else of the page.
    let uiDark = null;
    function applyUiTheme(dark) {
        uiDark = dark;
        uiHost.setAttribute('data-theme', dark ? 'dark' : 'light');
    }

    function ensureUi(dark = isDarkMode()) {
        applyUiTheme(dark);
        if (!selectHost.isConnected) document.documentElement.appendChild(selectHost);
        if (!uiHost.isConnected) document.documentElement.appendChild(uiHost);
    }

    function panelOpen() {
        return !toolbarEl.hidden || !noteCardEl.hidden || !!editor;
    }

    // Events from inside the shadow root reach page listeners retargeted to the host.
    function isUiEvent(e) {
        return e.target === uiHost;
    }

    // Takes focus out of a panel that is about to hide, so keys stop going to a hidden control.
    function releaseFocus(panel) {
        const active = uiRoot.activeElement;
        if (active && panel.contains(active)) active.blur();
    }

    // Puts a fixed panel next to `rect` (viewport coordinates), flipping sides when it doesn't
    // fit. Returns the side it went to: 'above' or 'below'.
    function placePanel(panel, rect, preferBelow, gap = 8) {
        const w = panel.offsetWidth;
        const h = panel.offsetHeight;
        const vw = document.documentElement.clientWidth || window.innerWidth;
        const vh = window.innerHeight;
        const above = rect.top - h - gap;
        const below = rect.bottom + gap;
        const left = Math.max(4, Math.min(rect.left + rect.width / 2 - w / 2, vw - w - 4));
        const covered = top => touchesCover(left, top, w, h);   // over the page's header or the like
        let side = preferBelow ? 'below' : 'above';
        if (preferBelow && (below + h > vh - 4 || covered(below)) && above >= 4 && !covered(above)) side = 'above';
        if (!preferBelow && (above < 4 || covered(above)) && !covered(below)) side = 'below';
        placeInPage(panel, side === 'below' ? below : above, left);
        return side;
    }

    // A point of the window in page terms (see uiHost), and a panel put there.
    function inPage({ left, top }) {
        const page = uiHost.getBoundingClientRect();
        return { left: left - page.left, top: top - page.top };
    }

    // The page's own fixed and sticky parts (headers, sidebars, banners) in the window: what the
    // page draws over its text. Our layers sit above everything, so whatever is anchored to text
    // checks these to stay out from over them. Found by sampling the window's edges and a grid
    // with elementFromPoint; kept for the frame.
    let coverCache = null;
    function pageCovers() {
        if (coverCache) return coverCache;
        const vw = document.documentElement.clientWidth || window.innerWidth;
        const vh = window.innerHeight;
        const found = new Set();
        for (const fx of [2, 0.25, 0.5, 0.75, vw - 2]) {
            for (const fy of [2, 0.25, 0.5, 0.75, vh - 2]) {
                let el = document.elementFromPoint(fx < 1 ? fx * vw : fx, fy < 1 ? fy * vh : fy);
                while (el && el !== document.body && el !== document.documentElement) {
                    if (el.hasAttribute(UI_ATTR)) break;
                    const position = getComputedStyle(el).position;
                    if (position === 'fixed' || position === 'sticky') { found.add(el); break; }
                    el = el.parentElement;
                }
            }
        }
        const rects = Array.from(found, el => el.getBoundingClientRect()).filter(r => r.width && r.height);
        coverCache = rects.filter(r => !rects.some(o => o !== r && o.left <= r.left && o.top <= r.top && o.right >= r.right && o.bottom >= r.bottom));
        requestAnimationFrame(() => { coverCache = null; });
        return coverCache;
    }

    // True if `r` (window coordinates) lies wholly under one of the page's fixed or sticky parts.
    function isCovered(r) {
        return pageCovers().some(c => c.left <= r.left + 1 && c.top <= r.top + 1 && c.right >= r.right - 1 && c.bottom >= r.bottom - 1);
    }

    function touchesCover(left, top, width, height) {
        return pageCovers().some(c => c.left < left + width && c.right > left && c.top < top + height && c.bottom > top);
    }

    // Pressing `handle` (not one of its buttons) and moving drags `panel`; `start()` returns
    // false to refuse.
    function dragByHandle(panel, handle, start) {
        handle.addEventListener('pointerdown', e => {
            if (e.button || e.target.closest('button') || !start()) return;
            e.preventDefault();
            const dx = parseFloat(panel.style.left) - e.clientX, dy = parseFloat(panel.style.top) - e.clientY;
            const move = m => { panel.style.left = `${m.clientX + dx}px`; panel.style.top = `${m.clientY + dy}px`; };
            handle.setPointerCapture(e.pointerId);
            handle.addEventListener('pointermove', move);
            handle.addEventListener('lostpointercapture', () => handle.removeEventListener('pointermove', move), { once: true });
        });
    }

    function placeInPage(panel, top, left) {
        const at = inPage({ left, top });
        panel.style.top = `${Math.round(at.top)}px`;
        panel.style.left = `${Math.round(at.left)}px`;
    }

    // --- Selection toolbar ---

    const STYLE_LABELS = { highlight: 'Highlight', underline: 'Underline', 'strike-through': 'Strikethrough' };
    let toolbarRange = null;      // the selection the toolbar was opened for
    let toolbarAnchor = null;     // that selection cleaned up, which the toolbar is placed by
    let toolbarGroups = null;     // the annotations the toolbar acts on, when shown for clicked ones
    let toolbarSide = 'above';    // which side of the selection the toolbar sits on
    let toolbarTimer = null;
    let pointerIsDown = false;
    let lastPointerType = 'mouse';

    function styleLabel(key) {
        return STYLES[key].label || STYLE_LABELS[STYLES[key].type] || key;
    }

    function shortcutText(key) {
        const code = [].concat(STYLES[key].shortcut || [])[0];
        return code ? `Alt+${code.replace(/^(Key|Digit)/, '')}` : '';
    }

    function styleIcon(key, dark) {
        const { type, color } = resolveStyle(key, dark);
        switch (type) {
            case 'highlight':
                // The highlighter's cap and tip (its accent layer) in the highlight color.
                return phosphorIcon('highlighter', { under: [svgEl('path', { d: 'M88,136.5L127.5,176L94.4,209.1L35.1,189.4Z', fill: color })] });
            case 'underline':
                // The icon's own underline bar (x 58-198, y 218-230 on the 256 grid), repainted in the style's color.
                return phosphorIcon('text-underline', { over: [svgEl('rect', { x: 58, y: 218, width: 140, height: 12, rx: 6, fill: color })] });
            case 'strike-through':
                // The icon's own strike bar (x 34-222, y 122-134 on the 256 grid), repainted in the style's color.
                return phosphorIcon('text-strikethrough', { over: [svgEl('rect', { x: 34, y: 122, width: 188, height: 12, rx: 6, fill: color })] });
            default:
                // The highlighter's cap and tip (its accent layer) in the highlight color.
                return phosphorIcon('highlighter', { under: [svgEl('path', { d: 'M88,136.5L127.5,176L94.4,209.1L35.1,189.4Z', fill: color })] });
        }
    }

    // --- Tooltips for icon buttons (selection toolbar, note editor) ---

    let labelTipTimer = null;

    // preferBelow: a function, so it is read when the tip shows (the toolbar can change sides).
    function showLabelTip(button, preferBelow) {
        clearTimeout(labelTipTimer);
        labelTipTimer = setTimeout(() => {
            const panel = button.closest('.surface');
            if (!button.isConnected || !panel || panel.hidden) return;
            labelTipEl.replaceChildren(document.createTextNode(button.dataset.label));
            if (button.dataset.shortcut) labelTipEl.appendChild(makeEl('span', { class: 'kbd', text: button.dataset.shortcut }));
            labelTipEl.hidden = false;
            placePanel(labelTipEl, button.getBoundingClientRect(), preferBelow(), 4);
        }, 250);
    }

    function hideLabelTip() {
        clearTimeout(labelTipTimer);
        labelTipEl.hidden = true;
    }

    // Gives an icon button an accessible name and a tooltip showing its label and shortcut.
    function addLabelTip(button, label, shortcut, preferBelow) {
        button.setAttribute('aria-label', shortcut ? `${label} (${shortcut})` : label);
        button.dataset.label = label;
        if (shortcut) {
            button.dataset.shortcut = shortcut;
            button.setAttribute('aria-keyshortcuts', shortcut);
        }
        button.addEventListener('click', hideLabelTip);
        button.addEventListener('mouseenter', () => showLabelTip(button, preferBelow));
        button.addEventListener('mouseleave', hideLabelTip);
        button.addEventListener('focus', () => { if (button.matches(':focus-visible')) showLabelTip(button, preferBelow); });
        button.addEventListener('blur', hideLabelTip);
        return button;
    }

    // `pressed`: true or false makes it a toggle button (a style, which shows pressed when the
    // selected text has it).
    function toolButton(icon, label, shortcut, onClick, pressed = null) {
        const b = makeButton({ icon, appearance: 'subtle' });
        if (pressed !== null) b.setAttribute('aria-pressed', String(pressed));
        // On the side of the toolbar away from the selection, so the text stays visible.
        addLabelTip(b, label, shortcut, () => toolbarSide === 'below');
        b.addEventListener('click', onClick);
        return b;
    }

    // The note editor's header buttons: tips above them, flipping below near the top of the view.
    addLabelTip(noteSave, 'Save note', 'Enter', () => false);
    addLabelTip(noteDiscard, 'Discard changes', 'Esc', () => false);
    addLabelTip(noteDelete, 'Delete note', 'Delete', () => false);
    // The note preview sits below its text, so its tip goes below too, off the text.
    addLabelTip(cardPin, 'Pin note', 'Alt+L', () => true);

    function toolbarDivider() {
        return makeEl('span', { class: 'divider', role: 'separator', 'aria-orientation': 'vertical' });
    }

    // Style icons show the colors the annotation will get where the selection is (`dark`).
    // `overlaps` are the annotations the selection touches (findOverlaps). The styles all of the
    // selected text has (`current`, see selectionStyles) show pressed, and choosing one does nothing; the note
    // button says whether the note it opens exists; the eraser shows when there is anything to erase.
    // For an annotation selected by clicking it, `act` holds what the buttons do instead (see
    // showGroupToolbar).
    function buildToolbar({ overlaps, current }, dark, act = null) {
        const items = [];
        let lastGroup = null;
        Object.keys(STYLES).forEach(k => {
            if (STYLES[k].retired) return;
            const group = STYLES[k].type === 'highlight' ? 'highlight' : 'line';
            if (lastGroup && group !== lastGroup) items.push(toolbarDivider());
            lastGroup = group;
            const pressed = current.includes(k);
            const label = styleLabel(k);
            items.push(toolButton(styleIcon(k, dark), label, shortcutText(k), act ? () => act.style(k) : () => runToolbarAction(active => annotateSelection(k, active)), pressed));
        });
        items.push(toolbarDivider());
        const noteLabel = overlaps.length && overlaps[0].note ? 'Edit note' : 'Add note';
        items.push(toolButton(phosphorIcon(noteLabel === 'Edit note' ? 'note-pencil' : 'note'), noteLabel, 'Alt+N', act ? act.note : () => runToolbarAction(noteSelection)));
        if (overlaps.length) {
            items.push(toolButton(phosphorIcon('eraser'), act ? act.removeLabel : 'Erase', act ? act.removeKey : 'Alt+D', act ? act.remove : () => runToolbarAction(removeInSelection)));
        }
        toolbarEl.replaceChildren(...items);
        // One Tab stop for the whole toolbar, on its first button; the arrow keys move along it.
        toolbarEl.querySelectorAll('button').forEach((b, i) => { b.tabIndex = i ? -1 : 0; });
    }

    // Arrow keys, Home and End move focus between the toolbar's buttons.
    toolbarEl.addEventListener('keydown', e => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        const buttons = Array.from(toolbarEl.querySelectorAll('button'));
        const i = buttons.indexOf(uiRoot.activeElement);
        const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: buttons.length - 1 }[e.key];
        if (i < 0 || to === undefined) return;
        e.preventDefault();
        const next = buttons[(to + buttons.length) % buttons.length];
        buttons[i].tabIndex = -1;
        next.tabIndex = 0;
        next.focus();
    });

    // The selection the toolbar may act on: real page text, not a form field or editable area.
    function toolbarSelection() {
        const active = getActiveRange();
        if (!active || !active.sel.toString().trim()) return null;
        const focused = document.activeElement;
        if (focused && (focused.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName))) return null;
        const anchor = elementOf(active.range.commonAncestorContainer);
        if (!anchor || anchor.isContentEditable || anchor.closest('input, textarea, select')) return null;
        return active.range;
    }

    function updateToolbar() {
        toolbarTimer = null;
        if (!running || editor) return;
        if (toolbarSwitchedOff() || penKey) { hideToolbar(); return; }   // with the pen on, its bar is the toolbar (see setPen)
        const selected = toolbarSelection();
        const range = selected && cleanRange(selected);   // what an action would annotate
        const rect = range && range.getBoundingClientRect();
        if (!rect || (!rect.width && !rect.height)) {
            if (!(selectedGroups.length && showGroupToolbar(selectedInOrder()))) hideToolbar();
            return;
        }
        toolbarGroups = null;
        toolbarRange = selected.cloneRange();
        toolbarAnchor = range;
        const dark = darkBehind(range.commonAncestorContainer);
        ensureUi(dark);
        hideLabelTip();
        const overlaps = findOverlaps(range);
        buildToolbar({ overlaps, current: selectionStyles(range, overlaps) }, dark);
        toolbarEl.hidden = false;
        placeToolbar();
        startToolbarIdle();
    }

    // The toolbar for annotations selected by clicking them (see setSelectedGroups), placed by
    // their boxes (a single one; none for several). The style all of them have shows pressed and keeps them, as with a
    // selection; the others restyle them, and they stay selected with the toolbar over them.
    function showGroupToolbar(groups) {
        if (groups.length > 1) return false;   // several selected: outlines only, no toolbar
        const byGroup = wrappersOfGroups(groups);
        const wrappers = groups.flatMap(g => byGroup.get(g) || []);
        if (!wrappers.length || !groupRect(groups)) return false;
        const key = wrappers[0].getAttribute(STYLE_ATTR);
        const current = wrappers.every(w => w.getAttribute(STYLE_ATTR) === key) ? [key] : [];
        const note = (byGroup.get(groups[0]) || []).map(w => w.getAttribute(NOTE_ATTR)).find(Boolean) || '';   // N edits the first's
        const dark = wrappers[0].hasAttribute(DARK_ATTR);
        // A restyle keeps the toolbar where it is and updates it at once; the others hide it.
        const after = (fn, keep = false) => (...args) => {
            if (!keep) hideToolbar();
            if (!running) return;
            syncLocation();
            fn(...args);
            if (keep) refreshGroupToolbar();
            else if (selectedGroups.length && !editor) scheduleToolbar();
        };
        ensureUi(dark);
        hideLabelTip();
        buildToolbar({ overlaps: [{ group: groups[0], note }], current }, dark, {
            style: after(k => restyleGroups(groups, k), true),
            note: after(() => openNoteEditor(groups[0])),
            remove: after(() => deleteGroups(groups)),
            removeLabel: groups.length > 1 ? `Erase ${groups.length}x annotations` : 'Erase annotation',
            removeKey: 'Alt+D'
        });
        toolbarGroups = groups;
        toolbarRange = null;
        toolbarAnchor = { getBoundingClientRect: () => groupRect(groups) || { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 } };
        toolbarEl.hidden = false;
        placeToolbar();
        startToolbarIdle();
        return true;
    }

    // After the selected annotations change (restyled by the toolbar or a key), their toolbar is
    // rebuilt in the same moment, so it never blinks away while they redraw; it goes only when
    // they do (the style all of them had removes them).
    function refreshGroupToolbar() {
        if (!toolbarGroups) return;   // not shown for them (text selected, faded, switched off)
        if (!running || editor || toolbarSwitchedOff() || !selectedGroups.length || !showGroupToolbar(selectedInOrder())) hideToolbar();
    }

    // The toolbar goes centered over the selection, above its first line (below its last on a
    // touch screen, whose own menu goes above). It flips to the other side when it doesn't fit,
    // and stays on screen when the selection is taller than the window.
    function placeToolbar() {
        if (!toolbarAnchor) return;
        const rect = toolbarAnchor.getBoundingClientRect();
        const w = toolbarEl.offsetWidth;
        const h = toolbarEl.offsetHeight;
        const vw = document.documentElement.clientWidth || window.innerWidth;
        const vh = window.innerHeight;
        const gap = 8;
        const above = rect.top - h - gap;
        const below = rect.bottom + gap;
        const left = Math.max(4, Math.min(rect.left + rect.width / 2 - w / 2, vw - w - 4));
        const fits = top => top >= 4 && top + h <= vh - 4 && !touchesCover(left, top, w, h);
        let side = lastPointerType === 'touch' ? 'below' : 'above';
        const flipped = side === 'below' ? 'above' : 'below';
        if (!fits(side === 'below' ? below : above) && fits(flipped === 'below' ? below : above)) side = flipped;
        // On screen while the selection is; once it scrolls away, the toolbar goes with it,
        // staying at its top or bottom edge.
        const onScreen = Math.max(4, Math.min(side === 'below' ? below : above, vh - h - 4));
        const top = Math.max(above, Math.min(onScreen, below));
        placeInPage(toolbarEl, top, left);
        // Hidden while its text is under the page's header or the like, or it has nowhere else to go.
        toolbarEl.style.visibility = isCovered(rect) || touchesCover(left, top, w, h) ? 'hidden' : '';
        toolbarSide = side;
    }

    function scheduleToolbar() {
        clearTimeout(toolbarTimer);
        // Wait for the selection to settle; while a pointer is down the user is still selecting.
        // The note preview of a just-selected annotation (previewDue) opens in the same moment.
        toolbarTimer = setTimeout(() => {
            if (pointerIsDown) return;
            if (ENABLE_SELECTION_TOOLBAR) updateToolbar();
            else toolbarTimer = null;
            showDuePreview();
        }, 200);
    }

    // --- Idle fade-out: the toolbar fades away after TOOLBAR_IDLE_MS with no pointer or keyboard
    // focus on it. A new selection shows it again. ---

    let toolbarIdleTimer = null;
    let toolbarFadeTimer = null;

    function stopToolbarIdle() {
        clearTimeout(toolbarIdleTimer);
        clearTimeout(toolbarFadeTimer);
        toolbarEl.classList.remove('fading');
    }

    function startToolbarIdle() {
        stopToolbarIdle();
        if (!TOOLBAR_IDLE_MS || toolbarEl.hidden) return;
        toolbarIdleTimer = setTimeout(() => {
            // A toolbar that appeared under a still pointer never got a mouseenter.
            if (toolbarEl.matches(':hover')) return;
            hideLabelTip();
            toolbarEl.classList.add('fading');
            const fadeMs = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300;   // --duration-slow
            toolbarFadeTimer = setTimeout(hideToolbar, fadeMs);
        }, TOOLBAR_IDLE_MS);
    }

    // Interacting with the toolbar keeps it, even mid-fade; leaving it restarts the countdown.
    toolbarEl.addEventListener('mouseenter', stopToolbarIdle);
    toolbarEl.addEventListener('mouseleave', startToolbarIdle);
    toolbarEl.addEventListener('focusin', stopToolbarIdle);
    toolbarEl.addEventListener('focusout', e => { if (!toolbarEl.contains(e.relatedTarget)) startToolbarIdle(); });

    function hideToolbar() {
        clearTimeout(toolbarTimer);
        stopToolbarIdle();
        hideLabelTip();
        releaseFocus(toolbarEl);
        toolbarEl.hidden = true;
        toolbarRange = null;
        toolbarAnchor = null;
        toolbarGroups = null;
    }

    // Alt+T, and the menu: the toolbar off or on again on this site. The keys work either way.
    function toggleToolbarSwitch() {
        const off = !toolbarSwitchedOff();
        setToolbarSwitchedOff(off);
        if (off) hideToolbar();
        else scheduleToolbar();   // for text that is selected now
        refreshMenu();
    }

    // A tap on a touch screen can clear the page selection even though the toolbar cancels
    // mousedown, so the range saved when the toolbar opened is put back first.
    function runToolbarAction(fn) {
        const range = toolbarRange;
        hideToolbar();
        if (!running) return;
        syncLocation();
        const sel = window.getSelection();
        if (sel && sel.isCollapsed && range && !range.collapsed) {
            sel.removeAllRanges();
            sel.addRange(range);
        }
        const active = getActiveRange();
        if (active) fn(active);
    }

    // --- Pen (Alt+P): while it is on, every mouse selection is annotated straight away ---

    let penKey = null;            // the style the pen draws with while it is on, else null
    const PEN_ERASER = 'eraser';  // the pen's key when it erases instead of drawing
    let lastStyleKey = null;      // the style chosen last for some text; the pen starts with it

    // Turns the pen on with style `key`, or off (null). A toolbar at the top of the view shows it.
    function setPen(key) {
        penKey = key === PEN_ERASER || (key && STYLES[key]) ? key : null;
        if (!penKey) {
            if (!penEl.hidden) hideLabelTip();
            releaseFocus(penEl);
            penEl.hidden = true;
            return;
        }
        // The bar has the page's theme, as the toast does.
        const dark = computeDarkMode();
        ensureUi(panelOpen() && uiDark !== null ? uiDark : dark);
        penEl.setAttribute('data-theme', dark ? 'dark' : 'light');
        // One button per style: the pen's own shows pressed; clicking another changes the pen. With one
        // annotation selected by click, the bar acts on it instead, as the selection toolbar would.
        const picked = selectedGroups.length === 1 && !editor ? selectedGroups[0] : null;
        const pickedWrappers = picked ? groupWrappers(picked) : [];
        const pickedKey = pickedWrappers.length ? pickedWrappers[0].getAttribute(STYLE_ATTR) : null;
        const tools = [];
        let lastGroup = null;
        Object.keys(STYLES).forEach(k => {
            if (STYLES[k].retired) return;
            const group = STYLES[k].type === 'highlight' ? 'highlight' : 'line';
            if (lastGroup && group !== lastGroup) tools.push(toolbarDivider());
            lastGroup = group;
            const on = pickedKey ? k === pickedKey : k === penKey;
            const b = toolButton(styleIcon(k, dark), styleLabel(k), shortcutText(k), pickedKey ? () => { restyleGroups([picked], k); setPen(penKey); } : () => setPen(k), on);
            b.tabIndex = on ? 0 : -1;
            tools.push(b);
        });
        // The note button always shows, grayed out until an annotation is selected, as in the selection toolbar.
        const noteLabel = pickedWrappers.some(w => w.getAttribute(NOTE_ATTR)) ? 'Edit note' : 'Add note';
        const note = toolButton(phosphorIcon(noteLabel === 'Edit note' ? 'note-pencil' : 'note'), noteLabel, 'Alt+N', () => picked && openNoteEditor(picked));
        note.disabled = !pickedKey;
        note.tabIndex = -1;
        if (pickedKey) {
            const erase = toolButton(phosphorIcon('eraser'), 'Erase annotation', 'Alt+D', () => deleteGroups([picked]));
            erase.tabIndex = -1;
            tools.push(toolbarDivider(), note, erase);
        } else {
            const eraser = toolButton(phosphorIcon('eraser'), 'Eraser', 'Alt+D', () => setPen(PEN_ERASER), penKey === PEN_ERASER);
            eraser.tabIndex = penKey === PEN_ERASER ? 0 : -1;
            tools.push(toolbarDivider(), note, eraser);
        }
        if ((pickedKey || penKey !== PEN_ERASER) && !tools.some(b => b.tabIndex === 0)) tools.find(b => b.tagName === 'BUTTON').tabIndex = 0;
        penEl.replaceChildren(...tools);
        penEl.hidden = false;
    }

    function togglePen() {
        if (penKey) { setPen(null); scheduleToolbar(); return; }
        hideToolbar();
        setPen(STYLES[lastStyleKey] ? lastStyleKey : NOTE_STYLE_KEY);
    }

    // After a mouse selection with the pen on: the selected text gets the pen's style (or, with the
    // eraser, loses its annotations). The pen only adds, so text that already has its style (all of it) is left as it is.
    function penStroke() {
        if (!penKey || !running || editor) return;
        const selected = toolbarSelection();
        const range = selected && cleanRange(selected);
        if (!range) return;
        const sel = window.getSelection();
        if (penKey === PEN_ERASER) { removeInSelection({ sel, range: selected }); return; }
        if (selectionStyles(range, findOverlaps(range)).includes(penKey)) { sel.removeAllRanges(); return; }
        annotateSelection(penKey, { sel, range: selected });
    }

    // Arrow keys, Home and End move between the pen toolbar's buttons, as in the selection toolbar.
    penEl.addEventListener('keydown', e => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        const buttons = Array.from(penEl.querySelectorAll('button:not(:disabled)'));
        const i = buttons.indexOf(uiRoot.activeElement);
        const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: buttons.length - 1 }[e.key];
        if (i < 0 || to === undefined) return;
        e.preventDefault();
        e.stopPropagation();
        buttons[i].tabIndex = -1;
        const next = buttons[(to + buttons.length) % buttons.length];
        next.tabIndex = 0;
        next.focus();
    });
    // --- Note card (shown when hovering an annotation that has a note) ---

    let hoveredWrapper = null;    // for the keys used without a selection (see pointedGroup)
    let pointer = null;           // where the mouse last went over page content, in the viewport
    let cardWrapper = null;
    let cardHideTimer = null;
    let cardShowTimer = null;
    const pinnedCards = new Map();   // badge (its wrapper) -> the copy of its note card kept open (see pinNoteCard)

    // A note's text with its web addresses as links, opened in a new tab. Punctuation right after
    // an address (a full stop, a closing bracket the address didn't open) stays outside the link.
    const NOTE_URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
    function noteNodes(text) {
        const nodes = [];
        let at = 0;
        for (const m of text.matchAll(NOTE_URL_RE)) {
            let url = m[0];
            for (;;) {
                const last = url.slice(-1);
                const open = { ')': '(', ']': '[', '}': '{' }[last];
                if (/[.,;:!?'"*_]/.test(last) ||
                    (open && url.split(open).length <= url.split(last).length - 1)) url = url.slice(0, -1);
                else break;
            }
            let href;
            try { href = new URL(/^www\./i.test(url) ? `https://${url}` : url); } catch (e) { continue; }
            if (!/^https?:$/.test(href.protocol)) continue;
            if (m.index > at) nodes.push(document.createTextNode(text.slice(at, m.index)));
            nodes.push(makeEl('a', { href: href.href, target: '_blank', rel: 'noopener noreferrer', text: url }));
            at = m.index + url.length;
        }
        if (at < text.length) nodes.push(document.createTextNode(text.slice(at)));
        return nodes;
    }

    // The line of `wrapper` under the pointer (the one nearest to it). Only used when the note
    // badge is out of view.
    function lineUnderPointer(wrapper) {
        const rects = Array.from(wrapper.getClientRects()).filter(r => r.width || r.height);
        if (!rects.length || !pointer) return wrapper.getBoundingClientRect();
        const dist = r => (pointer.y < r.top ? r.top - pointer.y : pointer.y > r.bottom ? pointer.y - r.bottom : 0) +
            (pointer.x < r.left ? r.left - pointer.x : pointer.x > r.right ? pointer.x - r.right : 0) / 1000;
        return rects.reduce((best, r) => (dist(r) < dist(best) ? r : best));
    }

    // Where the card opens: at the note badge (the end of the annotation's last line), so it stays
    // put while the pointer moves between the annotation's lines. When the badge is scrolled out
    // of view, next to the line under the pointer instead.
    function noteCardAnchor(wrapper) {
        const r = badgeAnchor(wrapper);
        return !r || r.bottom < 0 || r.top > window.innerHeight ? lineUnderPointer(wrapper) : r;
    }

    // The end of the annotation's last line, where its note badge is (or would be). The note
    // editor opens here too, like the card.
    function badgeAnchor(wrapper) {
        const mark = groupWrappers(wrapper.getAttribute(GROUP_ATTR)).find(w => w.hasAttribute(NOTE_MARK_ATTR)) || wrapper;
        const rects = Array.from(mark.getClientRects()).filter(r => r.width || r.height);
        const r = rects[rects.length - 1];
        return r && { left: r.right, right: r.right, width: 0, top: r.top, bottom: r.bottom };
    }

    // Shows the note of an annotation once the pointer has rested on its badge for
    // NOTE_CARD_DELAY_MS, so passing over notes on the way somewhere else opens nothing. While a
    // card is open, moving to another note switches at once.
    function scheduleNoteCard(wrapper) {
        clearTimeout(cardHideTimer);
        clearTimeout(cardShowTimer);
        if (sameCard(wrapper)) return;
        if (!noteCardEl.hidden) { showNoteCard(wrapper); return; }
        cardShowTimer = setTimeout(() => {
            if (nearMark === wrapper && wrapper.isConnected && !annotationsHidden && !editor) showNoteCard(wrapper);
        }, NOTE_CARD_DELAY_MS);
    }

    // Another piece of the annotation whose card is open (one split across links) keeps that card.
    function sameCard(wrapper) {
        return !noteCardEl.hidden && cardWrapper && (cardWrapper === wrapper ||
            (cardWrapper.isConnected && wrapper.hasAttribute(GROUP_ATTR) &&
             cardWrapper.getAttribute(GROUP_ATTR) === wrapper.getAttribute(GROUP_ATTR)));
    }

    function showNoteCard(wrapper) {
        clearTimeout(cardHideTimer);
        clearTimeout(cardShowTimer);
        if (sameCard(wrapper)) return;
        ensureUi(wrapper.hasAttribute(DARK_ATTR));
        cardWrapper = wrapper;
        cardText.replaceChildren(...noteNodes(wrapper.getAttribute(NOTE_ATTR) || ''));
        const time = annotationTime(wrapper);
        cardHint.textContent = time ? `Added ${formatDate(time)}` : 'Alt+N to edit';
        noteCardEl.hidden = false;
        nearMark = undefined;   // a card opened by a jump also hides once the mouse moves off any badge
        placePanel(noteCardEl, noteCardAnchor(wrapper), true);
    }

    // Selecting one annotation that has a note shows its note, read-only, for as long as the
    // selection toolbar stays (TOOLBAR_IDLE_MS; pointing at the card keeps it). Clearing the
    // selection, or selecting something else, closes it.
    let selectPreview = false;
    let selectPreviewTimer = null;
    let selectShowTimer = null;
    const SELECT_PREVIEW_DELAY_MS = 150;   // the note follows the selection toolbar a little later
    function previewSelectedNote(groups) {
        if (selectPreview) hideNoteCard();
        const note = groups.length === 1 && !editor && !annotationsHidden &&
            groupWrappers(groups[0]).filter(w => w.hasAttribute(NOTE_ATTR) && w.getClientRects().length).pop();
        if (!note || !note.getAttribute(NOTE_ATTR)) return;
        selectPreview = true;
        selectShowTimer = setTimeout(() => {
            if (selectPreview && note.isConnected && !editor && !annotationsHidden) showNoteCard(note);
        }, SELECT_PREVIEW_DELAY_MS);
        if (!TOOLBAR_IDLE_MS) return;
        selectPreviewTimer = setTimeout(function idle() {
            if (noteCardEl.matches(':hover')) { selectPreviewTimer = setTimeout(idle, 500); return; }
            if (selectPreview) hideNoteCard();
        }, TOOLBAR_IDLE_MS);
    }

    function hideNoteCard() {
        clearTimeout(cardHideTimer);
        clearTimeout(cardShowTimer);
        clearTimeout(selectPreviewTimer);
        clearTimeout(selectShowTimer);
        selectPreview = false;
        if (!noteCardEl.hidden) hideLabelTip();   // its Pin button's tip goes with it
        releaseFocus(noteCardEl);
        noteCardEl.hidden = true;
        cardWrapper = null;
    }

    // The pin button of a note card keeps its note open in a copy of the card, placed where the
    // card was, the badge in the selection outline's color, until the copy's pin button is
    // pressed again or Esc closes the last one pinned; clicks elsewhere leave it open, and any
    // number can be pinned. The copy is in the page layer, so it scrolls with the text; dragged
    // by its footer, it stays where dropped.
    function pinNoteCard() {
        const w = cardWrapper;
        const mark = w && w.isConnected && (w.hasAttribute(NOTE_MARK_ATTR) ? w
            : groupWrappers(w.getAttribute(GROUP_ATTR)).find(m => m.hasAttribute(NOTE_MARK_ATTR)));
        if (!mark || pinnedCards.has(mark)) return;
        const card = noteCardEl.cloneNode(true);
        card.setAttribute('data-pinned', '');
        card.style.animation = 'highlighter-pin var(--duration-normal) var(--ease-out)';
        // The hover card is replaced on the spot: fading out under the copy doubled their borders
        // into a dark flash. The copy only darkens its border at first (see highlighter-pin).
        noteCardEl.style.transition = 'none';
        hideNoteCard();
        noteCardEl.offsetWidth;
        noteCardEl.style.transition = '';
        noteCardEl.after(card);
        pinnedCards.set(mark, card);
        mark.setAttribute(NOTE_PIN_ATTR, '');
        const pin = card.querySelector('.card-actions button');
        pin.replaceChildren(phosphorIcon('push-pin-fill'));
        pin.dataset.label = 'Unpin note';
        pin.setAttribute('aria-label', 'Unpin note');
        pin.setAttribute('aria-pressed', 'true');
        addLabelTip(pin, pin.dataset.label, pin.dataset.shortcut, () => true);   // a copy has no listeners
        pin.addEventListener('click', () => unpinNoteCard(mark));
        card.addEventListener('wheel', keepWheel, { passive: false });
        dragByHandle(card, card.querySelector('.card-footer'), () => true);
    }

    // Alt+L: pins the note card on show, or unpins the note of `group` (the annotation pointed at,
    // else the one selected) when it is pinned already.
    function togglePinKey(group) {
        if (!noteCardEl.hidden) { pinNoteCard(); return; }
        group = group || (selectedGroups.length === 1 ? selectedGroups[0] : null);
        const wrappers = group ? groupWrappers(group) : [];
        const mark = wrappers.find(w => w.hasAttribute(NOTE_MARK_ATTR));
        if (mark && pinnedCards.has(mark)) { unpinNoteCard(mark); return; }
        const note = !editor && !annotationsHidden && wrappers.filter(w => w.hasAttribute(NOTE_ATTR) && w.getClientRects().length).pop();
        if (!note || !note.getAttribute(NOTE_ATTR)) { showToast('No note to pin', { intent: 'warning', icon: 'warning' }); return; }
        showNoteCard(note);
        pinNoteCard();
    }

    // `mark` omitted: every pinned note.
    function unpinNoteCard(mark) {
        (mark ? [mark] : Array.from(pinnedCards.keys())).forEach(m => {
            const card = pinnedCards.get(m);
            if (!card) return;
            releaseFocus(card);
            hideLabelTip();
            card.remove();
            m.removeAttribute(NOTE_PIN_ATTR);
            pinnedCards.delete(m);
        });
    }

    // A pinned note whose badge is gone (note deleted, annotation erased or redrawn) closes.
    function prunePinnedCards() {
        pinnedCards.forEach((card, m) => { if (!m.isConnected || !m.hasAttribute(NOTE_MARK_ATTR)) unpinNoteCard(m); });
    }

    function onMouseOver(e) {
        // Moving into the card keeps it open; nearMark forgotten, the next move off it starts the hide.
        if (isUiEvent(e)) { clearTimeout(cardHideTimer); nearMark = undefined; return; }
        hoveredWrapper = e.target instanceof Element ? e.target.closest(WRAPPER_SELECTOR) : null;
        onMouseMove(e);
    }

    function onMouseMove(e) {
        if (isUiEvent(e)) return;
        pointer = { x: e.clientX, y: e.clientY };
        if (selectPreview && markNear(e.clientX, e.clientY)) selectPreview = false;   // the pointer takes over
        let mark = annotationsHidden || editor ? null : markNear(e.clientX, e.clientY);
        if (pinnedCards.has(mark)) mark = null;   // its note is open already
        if (mark === nearMark) return;
        nearMark = mark;
        if (mark) {
            scheduleNoteCard(mark);
        } else {
            clearTimeout(cardShowTimer);
            if (cardWrapper && !selectPreview) {
                clearTimeout(cardHideTimer);
                cardHideTimer = setTimeout(hideNoteCard, 250);
            }
        }
    }

    // The note card opens for the pointer on or near a note badge (NOTE_BADGE_REACH px around
    // it), not anywhere on the annotation. The badges are looked up again once wrappers change.
    let nearMark = null;
    let noteMarks = null;
    let noteMarksEpoch = -1;
    function markNear(x, y) {
        if (!noteMarks || noteMarksEpoch !== wrapperEpoch) {
            noteMarks = Array.from(document.querySelectorAll(`span[${NOTE_MARK_ATTR}]`));
            noteMarksEpoch = wrapperEpoch;
        }
        return noteMarks.find(m => {
            const b = m.isConnected && noteBadgeHole(m);
            return b && x >= b.left - NOTE_BADGE_REACH && x <= b.left + b.width + NOTE_BADGE_REACH &&
                y >= b.top - NOTE_BADGE_REACH && y <= b.top + b.height + NOTE_BADGE_REACH;
        }) || null;
    }

    // Leaving the window, the mouse points at nothing on the page.
    function onMouseOut(e) {
        if (!e.relatedTarget) { hoveredWrapper = nearMark = null; clearTimeout(cardShowTimer); }
    }

    // Over our own panels the mouse points at no annotation, except on a note card, which is its
    // annotation's.
    uiRoot.addEventListener('mouseover', e => { hoveredWrapper = noteCardEl.contains(e.target) ? cardWrapper : null; });

    // The wheel over the note card or the editor never scrolls the page: their text boxes stop at
    // their ends (overscroll-behavior: contain), and anywhere else on them, or over a note too short
    // to scroll, the wheel is dropped. Ctrl+wheel still zooms.
    function keepWheel(e) {
        if (e.ctrlKey) return;
        const box = e.target.closest('.card-text, textarea');
        if (box && box.scrollHeight > box.clientHeight) return;
        if (e.cancelable) e.preventDefault();
    }
    noteCardEl.addEventListener('wheel', keepWheel, { passive: false });
    editorEl.addEventListener('wheel', keepWheel, { passive: false });

    cardPin.addEventListener('click', pinNoteCard);

    function groupHasNote(group) {
        return groupWrappers(group).some(w => w.getAttribute(NOTE_ATTR));
    }

    // Removes the note; the annotation stays, and Alt+Z brings the note back.
    function deleteGroupNote(group) {
        syncLocation();
        if (editor) cancelEditor();
        runUndoable(() => setGroupNote(group, ''));
    }

    // --- Note editor ---

    // { group, original, step, returnFocus, side, anchor, bottom } (the last three are its
    // placement, see placeEditor): step is the undo step that created the annotation
    // for this note; returnFocus is what had focus before the editor opened.
    let editor = null;

    function editorAnchorRect() {
        const wrappers = editor ? groupWrappers(editor.group) : [];
        return wrappers.length ? badgeAnchor(wrappers[wrappers.length - 1]) || null : null;
    }

    // Fits the note box to its text: NOTE_MIN_LINES to NOTE_MAX_LINES lines (20px each, plus
    // 10px of padding), scrolling beyond that.
    // Once the corner handle has been dragged, the user's size wins until the editor reopens.
    let noteInputManuallySized = false;

    function sizeNoteInput() {
        if (noteInputManuallySized) return;
        const min = NOTE_MIN_LINES * 20 + 10;
        const max = NOTE_MAX_LINES * 20 + 10;
        noteInput.style.height = `${min}px`;
        noteInput.style.height = `${Math.min(max, Math.max(min, noteInput.scrollHeight))}px`;
    }

    function resetNoteInputSize() {
        noteInputManuallySized = false;
        noteInput.style.width = '';
        sizeNoteInput();
    }

    // The editor is placed once when it opens and then stays put: resizing or typing never
    // re-centers it. Scrolling moves it by exactly as much as the text it belongs to.
    function placeEditor() {
        const rect = editorAnchorRect();
        if (!rect) return;
        editor.side = placePanel(editorEl, rect, true);
        editor.anchor = inPage(rect);
        editor.bottom = parseFloat(editorEl.style.top) + editorEl.offsetHeight;   // not the rect: the fade-in shifts it
    }

    function followEditorAnchor() {
        const rect = editorAnchorRect();
        if (!rect) {
            // Text the site is redrawing: the note stays open, and Save puts it on the waiting
            // annotation. Gone for good: the note closes, and can be restored.
            if (!waitingRecords(editor.group).length) cancelEditor();
            return;
        }
        const at = inPage(rect);
        const dx = at.left - editor.anchor.left;
        const dy = at.top - editor.anchor.top;
        if (!dx && !dy) return;   // page scrolling alone moves nothing: the editor is in the page
        editorEl.style.left = `${parseFloat(editorEl.style.left) + dx}px`;
        editorEl.style.top = `${parseFloat(editorEl.style.top) + dy}px`;
        editor.anchor = at;
        editor.bottom += dy;
    }

    noteInput.addEventListener('input', () => {
        sizeNoteInput();
        updateSaveState();
        // Opened above the text: grow upward, so the box never covers what it annotates.
        if (editor && editor.side === 'above' && !noteInputManuallySized) {
            editorEl.style.top = `${Math.round(editor.bottom - editorEl.offsetHeight)}px`;
        }
    });

    function noteDraft() {
        return clipNote(noteInput.value.trim());
    }

    // Save is disabled while the note is the same as what is saved.
    function updateSaveState() {
        noteSave.disabled = !editor || noteDraft() === editor.original;
    }

    // A drag of the resize handle starts on the textarea and changes its inline size.
    noteInput.addEventListener('pointerdown', () => {
        const before = `${noteInput.style.width}|${noteInput.style.height}`;
        window.addEventListener('pointerup', () => {
            if (`${noteInput.style.width}|${noteInput.style.height}` !== before) noteInputManuallySized = true;
        }, { once: true, capture: true });
    });

    function focusNoteInput() {
        noteInput.focus({ preventScroll: true });
        // A page that moves focus around in its own key or focus handlers can undo that;
        // try once more after the current event has finished.
        if (document.activeElement !== uiHost) {
            requestAnimationFrame(() => { if (editor) noteInput.focus({ preventScroll: true }); });
        }
    }

    // `returnFocus`: where focus goes when the editor closes (by default, what had it before).
    function openNoteEditor(group, { step = null, returnFocus = null } = {}) {
        if (editor) {
            if (editor.group === group) {
                focusNoteInput();
                return;
            }
            cancelEditor();   // one note at a time; moving on discards
        }
        const wrappers = groupWrappers(group);
        if (!wrappers.length) return;
        hideToolbar();
        hideNoteCard();
        pinnedCards.forEach((card, m) => { if (m.getAttribute(GROUP_ATTR) === group) unpinNoteCard(m); });   // the editor takes its place
        ensureUi(wrappers[0].hasAttribute(DARK_ATTR));
        const original = wrappers[0].getAttribute(NOTE_ATTR) || '';
        const focused = document.activeElement;
        if (!returnFocus) returnFocus = focused && focused !== document.body && focused !== uiHost ? focused : null;
        editor = { group, original, step, returnFocus, wasSelected: selectedGroups.includes(group) };
        wrappers.forEach(w => w.setAttribute(NOTE_EDIT_ATTR, ''));
        setSelectedGroups(selectedGroups.concat(group));   // its outline; no toolbar while the editor is open
        editorTitle.textContent = original ? 'Edit note' : 'Add note';
        noteInput.value = original;
        updateSaveState();
        editorEl.hidden = false;
        resetNoteInputSize();
        noteInput.scrollTop = 0;
        placeEditor();
        focusNoteInput();
    }

    function closeEditor() {
        const returnFocus = editor && editor.returnFocus;
        const hadFocus = document.activeElement === uiHost;
        const ed = editor;
        if (ed) groupWrappers(ed.group).forEach(w => w.removeAttribute(NOTE_EDIT_ATTR));
        editor = null;
        if (ed && !ed.wasSelected && selectedGroups.includes(ed.group)) setSelectedGroups(selectedGroups.filter(g => g !== ed.group));
        hideLabelTip();
        releaseFocus(editorEl);
        editorEl.hidden = true;
        if (hadFocus && returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') {
            returnFocus.focus({ preventScroll: true });
        }
        if (penKey) setPen(penKey);   // the pen bar's note button works again
    }

    // Drops the annotation made for a note that never got written.
    // Returns the state it dropped (with the annotation), or null if it couldn't.
    function discardStep(step) {
        if (undoStack[undoStack.length - 1] !== step) return null;
        undoLastAction();
        return redoStack.pop() || null;
    }

    // The records of `group` waiting to come back after the site redrew them (noticed now
    // rather than at the next check).
    function waitingRecords(group) {
        if (anyDetached()) getCurrentRecords();
        return pendingRecords.filter(r => r.group === group);
    }

    function saveEditor() {
        saveEditorNow();
        if (penKey) setPen(penKey);   // the pen bar's note button: Add note becomes Edit note
    }

    function saveEditorNow() {
        if (!editor) return;
        const { group, original, step } = editor;
        const text = noteDraft();
        closeEditor();
        if (!groupWrappers(group).length) { saveWaitingNote(group, original, step, text); return; }
        if (step) {
            if (!text) { discardStep(step); return; }
            if (undoStack[undoStack.length - 1] === step) {
                // Folded into the step that created the annotation: one Alt+Z removes both.
                setGroupNote(group, text);
                saveHighlights();
                scheduleRedraw();
                return;
            }
        }
        if (text !== original) runUndoable(() => setGroupNote(group, text));
    }

    // The site redrew the annotation's text while its note was open: the note goes on the
    // records waiting for that text, and is dropped if there are none.
    function saveWaitingNote(group, original, step, text) {
        if (step && !text) { discardStep(step); return; }
        if (text === original) return;
        const waiting = waitingRecords(group);
        if (!waiting.length) return;
        runUndoable(() => waiting.forEach(r => { r.note = text || undefined; }));
    }

    // Closes the editor without saving; the highlight made for a new note goes with it.
    function cancelEditor() {
        if (!editor) return;
        const { step } = editor;
        closeEditor();
        if (step) discardStep(step);
    }

    // A note being written when its page goes away (the site shows another page, or the script
    // is turned off) closes, and the highlight made for a new note is dropped from what is saved,
    // as Esc would. Its text can't be offered back on a page that no longer shows it.
    function dropUnwrittenNote() {
        if (!editor) return;
        const { group, step } = editor;
        closeEditor();
        if (!step || !currentKey) return;
        const stored = readRecords(currentKey);
        if (!stored || !stored.some(r => r.group === group)) return;
        const rest = stored.filter(r => r.group !== group);
        if (rest.length) GM_setValue(currentKey, JSON.stringify(rest));
        else GM_deleteValue(currentKey);
    }

    noteSave.addEventListener('click', () => saveEditor());
    noteDiscard.addEventListener('click', () => cancelEditor());
    // An existing note is removed (its annotation stays, Alt+Z brings the note back); a new one
    // is dropped along with the highlight that was made for it.
    noteDelete.addEventListener('click', () => {
        if (editor && editor.step && noteDraft()) { cancelEditor(); return; }
        noteInput.value = '';
        saveEditor();
    });
    editorEl.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelEditor();
        } else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target === noteInput) {
            // Enter saves; Shift+Enter starts a new line. On a button, Enter presses that button.
            e.preventDefault();
            saveEditor();
        } else if (e.key === 'Delete' && !e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && !e.isComposing
            && !(e.target === noteInput && noteInput.selectionEnd < noteInput.value.length)
            && noteInput.selectionStart === noteInput.selectionEnd) {
            // Delete deletes the note, as its Delete button does, unless it has text after the
            // caret (or selected) to delete.
            e.preventDefault();
            noteDelete.click();
        } else if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey) {
            // Tab and Shift+Tab go round the editor's controls instead of leaving it.
            const stops = [noteSave, noteDiscard, noteDelete, noteInput].filter(el => !el.hidden && !el.disabled);
            const i = stops.indexOf(uiRoot.activeElement);
            e.preventDefault();
            stops[i < 0 ? 0 : (i + (e.shiftKey ? -1 : 1) + stops.length) % stops.length].focus();
        }
    });

    // --- Toast ---

    let toastTimer = null;
    let toastRun = null;          // what the toast's action button does
    let toastKey = null;          // the page it is about
    let toastKeep = false;        // it survives undo and redo (see resetUi)
    let toastKeepsEditor = false; // its action leaves a note being written open

    // A message in the bottom-right corner: an intent icon, a title, an
    // action and Dismiss. `icon` is a PHOSPHOR_ICONS name; `intent`
    // is info, success or warning; `action` adds a button, { label, run, keep, keepEditor, tip, shortcut },
    // such as Show; `tip` and `shortcut` are for its tooltip.
    function showToast(message, { icon = 'info', intent = 'info', action = null } = {}) {
        // A plain message doesn't take the place of one still offering an action.
        if (!action && !toastEl.hidden && toastRun) return;
        // The toast has the page's theme, set on it alone: a panel open next to a box of the
        // other theme keeps its own, and opening one later doesn't switch the toast's.
        const dark = computeDarkMode();
        ensureUi(panelOpen() && uiDark !== null ? uiDark : dark);
        toastEl.setAttribute('data-theme', dark ? 'dark' : 'light');
        const nextIcon = phosphorIcon(icon);
        toastIcon.replaceWith(nextIcon);
        toastIcon = nextIcon;
        toastEl.setAttribute('data-intent', intent);
        toastText.textContent = message;
        toastRun = action ? action.run : null;
        toastKey = currentKey;
        toastKeep = !!(action && action.keep);
        toastKeepsEditor = !!(action && action.keepEditor);
        if (action) {
            toastAction.dataset.action = action.label;
            toastAction.replaceChildren(phosphorIcon(TOAST_ACTION_ICONS[action.label] || 'eye'));
        }
        toastAction.hidden = !action;
        if (action) {
            // The tooltip: what it does, and its shortcut where it has one.
            const tip = action.tip || action.label;
            toastAction.dataset.label = tip;
            toastAction.setAttribute('aria-label', action.shortcut ? `${tip} (${action.shortcut})` : tip);
            if (action.shortcut) { toastAction.dataset.shortcut = action.shortcut; toastAction.setAttribute('aria-keyshortcuts', action.shortcut); }
            else { delete toastAction.dataset.shortcut; toastAction.removeAttribute('aria-keyshortcuts'); }
        }
        toastEl.hidden = true;
        void toastEl.offsetWidth;   // restart the entrance animation
        toastEl.hidden = false;
        startToastTimer(action ? TOAST_ACTION_MS : TOAST_MS);
    }

    // The toast stays while the pointer rests on it or its button has focus.
    function startToastTimer(ms) {
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            if (toastEl.matches(':hover') || toastEl.contains(uiRoot.activeElement)) startToastTimer(2000);
            else hideToast();
        }, ms);
    }

    function hideToast() {
        clearTimeout(toastTimer);
        releaseFocus(toastEl);
        toastEl.hidden = true;
        toastRun = null;
        toastKeep = false;
    }

    let toastReturnFocus = null;  // what had focus before the toast's button took it

    toastDismiss.addEventListener('click', hideToast);
    addLabelTip(toastDismiss, 'Dismiss', '', () => false);
    const TOAST_ACTION_ICONS = { Show: 'eye' };
    addLabelTip(toastAction, 'Show', '', () => false);   // its label and shortcut are set per toast, see showToast

    toastAction.addEventListener('click', () => {
        const run = toastRun;
        const key = toastKey;
        const keepsEditor = toastKeepsEditor;
        const back = toastEl.contains(uiRoot.activeElement) ? toastReturnFocus : null;
        hideToast();
        syncLocation();
        // Not for a page the tab has since left.
        if (run && running && currentKey === key) {
            if (!keepsEditor) cancelEditor();
            run();
        }
        // Keyboard focus goes back to where it was, unless the action gave it a place (a note it reopened).
        const now = document.activeElement;
        if (back && back.isConnected && typeof back.focus === 'function' && (!now || now === document.body)) back.focus({ preventScroll: true });
    });
    // Pointing at the toast, or focusing its button, keeps it up; leaving gives it a moment more.
    toastEl.addEventListener('mouseenter', () => clearTimeout(toastTimer));
    toastEl.addEventListener('focusin', e => {
        clearTimeout(toastTimer);
        if (!toastEl.contains(e.relatedTarget)) toastReturnFocus = e.relatedTarget instanceof Element ? e.relatedTarget : null;
    });
    toastEl.addEventListener('mouseleave', () => {
        if (!toastEl.hidden && !toastEl.contains(uiRoot.activeElement)) startToastTimer(2000);
    });
    toastEl.addEventListener('focusout', e => {
        if (!toastEl.hidden && !toastEl.contains(e.relatedTarget) && !toastEl.matches(':hover')) startToastTimer(2000);
    });

    // --- Jumping to annotations (Alt+J / Alt+K, and from the panel) ---

    let jumpGroup = null;         // the annotation jumped to last (Alt+N edits it while it is in view)
    const flashTimers = new WeakMap();

    function isInView(el) {
        const r = el.getBoundingClientRect();
        return (r.width || r.height) > 0 && r.bottom > 0 && r.top < window.innerHeight;
    }

    function prefersReducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    // Blinks the annotation's drawing (see FLASH_ATTR).
    function flashGroup(group) {
        groupWrappers(group).forEach(w => {
            const svg = getSvg(w);
            if (!svg) return;
            clearTimeout(flashTimers.get(svg));
            svg.removeAttribute(FLASH_ATTR);
            void svg.getBoundingClientRect();   // restarts the animation
            svg.setAttribute(FLASH_ATTR, '');
            flashTimers.set(svg, setTimeout(() => svg.removeAttribute(FLASH_ATTR), FLASH_MS + 50));
        });
    }

    // Calls `fn` once `el` has stopped moving (a smooth scroll has ended), or after a second.
    function whenSettled(el, fn) {
        let last = null;
        let still = 0;
        let frames = 0;
        const check = () => {
            const top = el.getBoundingClientRect().top;
            still = top === last ? still + 1 : 0;
            last = top;
            if (still >= 3 || ++frames > 60) fn();
            else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
    }

    // Scrolls the annotation into view and flashes it; `showNote` also opens its note card.
    function jumpToGroup(group, { showNote = false } = {}) {
        const wrappers = groupWrappers(group).filter(w => w.getClientRects().length);
        if (!wrappers.length) return false;
        setAnnotationsHidden(false);
        hideNoteCard();
        jumpGroup = group;
        const first = wrappers[0];
        const tall = first.getBoundingClientRect().height > window.innerHeight / 2;
        first.scrollIntoView({ block: tall ? 'start' : 'center', inline: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        whenSettled(first, () => {
            if (jumpGroup !== group || !running) return;
            flashGroup(group);
            const last = groupWrappers(group).pop();
            if (showNote && last && last.hasAttribute(NOTE_ATTR) && !editor && isInView(last)) showNoteCard(last);
        });
        return true;
    }

    // Alt+J (dir 1) / Alt+K (dir -1): the next or previous annotation in reading order, counted
    // from the one jumped to last while it is still in view, else from the top of the view.
    // Returns false when the page has no annotation to jump to.
    function jumpRelative(dir) {
        const firstOf = new Map();
        allWrappers().forEach(w => {
            const g = w.getAttribute(GROUP_ATTR);
            if (!firstOf.has(g) && w.getClientRects().length) firstOf.set(g, w);
        });
        const groups = Array.from(firstOf.keys());
        if (!groups.length) return false;
        let i = groups.indexOf(jumpGroup);
        let target;
        if (i >= 0 && groupWrappers(jumpGroup).some(isInView)) {
            target = i + dir;
        } else {
            const tops = groups.map(g => firstOf.get(g).getBoundingClientRect().top);
            if (dir > 0) {
                target = tops.findIndex(t => t > 1);
                if (target < 0) target = groups.length;
            } else {
                target = -1;
                tops.forEach((t, j) => { if (t < -1) target = j; });
            }
        }
        const wrapped = target >= groups.length || target < 0;
        if (wrapped) target = dir > 0 ? 0 : groups.length - 1;
        jumpToGroup(groups[target], { showNote: true });
        // After the jump, which takes down an "Annotations hidden" message that would hold this one back.
        if (wrapped && groups.length > 1) showToast(dir > 0 ? 'Back to the first annotation' : 'Back to the last annotation');
        return true;
    }

    // --- Selecting annotations by clicking them ---

    // A plain click on an annotation (not a drag, not on a link or a control inside it; the pen
    // being on makes no difference, as a click selects no text for it to draw on) selects
    // it and draws a dashed outline around its lines; Ctrl+click adds one to the
    // selection or takes it out, and Shift+click selects the annotations from the one selected
    // last to the one clicked, in reading order, and no others. While annotations are selected
    // the keys act on all of them, with or without Alt: a style key restyles them (the style all
    // of them have removes them), Delete or D removes them (D on a single one with a note removes
    // the note first), N edits the note of the first, Esc lets them go. The selection toolbar shows over them too, its buttons acting on
    // them. Clicking elsewhere or selecting text lets them go as well. Each change is one step
    // for Undo.
    let selectedGroups = [];      // in the order they were selected; the last is Shift+click's start
    let selectFrame = 0;
    const selectBoxes = new Map();   // group -> { el, path, hole, mask, shape }, `shape` its lines when last drawn (see followSelectBoxes)
    let selectBoxCount = 0;          // for the ids of their masks
    let selectWrappers = null;       // { groups, epoch, at, map }: the selected annotations' wrappers (see wrappersOfGroups)

    const SELECT_BOX_PAD = 4;
    const SELECT_BOX_RADIUS = 4;
    const SELECT_BADGE_GAP = 2;      // px between the note badge's rim and the outline around it
    const CLICK_THROUGH_SELECTOR = 'a[href], button, input, select, textarea, label, summary, [role="button"], [role="link"], [contenteditable=""], [contenteditable="true"]';

    // The selected annotations in reading order.
    function selectedInOrder() {
        const order = groupsInOrder();
        return selectedGroups.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }

    function groupsInOrder() {
        return Array.from(new Set(allWrappers().map(w => w.getAttribute(GROUP_ATTR))));
    }

    function setSelectedGroups(groups) {
        // The note editor's annotation keeps its outline until the editor closes.
        if (editor && !groups.includes(editor.group)) { groups = [editor.group].concat(groups); editor.wasSelected = false; }
        selectedGroups = Array.from(new Set(groups));
        selectBoxes.forEach(({ el }, g) => { if (!selectedGroups.includes(g)) { el.remove(); selectBoxes.delete(g); unmarkNoteSelect(g); } });
        if (!selectedGroups.length) { clearSelectedGroups(); return; }
        selectedGroups.forEach(g => {
            if (selectBoxes.has(g)) return;
            const first = groupWrappers(g)[0];
            // The mask leaves a gap in the outline around the note badge (see noteBadgeHole). It
            // is costly to draw, so the outline has it only while there is a badge.
            const id = `highlighter-select-mask-${++selectBoxCount}`;
            const outline = svgEl('svg', { 'aria-hidden': 'true' });
            const mask = svgEl('mask', { id, maskUnits: 'userSpaceOnUse', x: -1e4, y: -1e4, width: 2e4, height: 2e4 });
            const hole = svgEl('rect', { fill: 'black', width: 0, height: 0 });
            const path = svgEl('path', {});
            mask.append(svgEl('rect', { x: -1e4, y: -1e4, width: 2e4, height: 2e4, fill: 'white' }), hole);
            outline.append(mask, path);
            const el = makeEl('div', { class: 'select-box', 'data-theme': first && first.hasAttribute(DARK_ATTR) ? 'dark' : 'light', hidden: '' },
                [outline]);
            selectBoxesEl.appendChild(el);
            selectBoxes.set(g, { el, path, hole, mask: `url(#${id})`, shape: '' });
        });
        ensureUi();
        if (!selectFrame) followSelectBoxes();
        scheduleToolbar();   // the selection toolbar, for these annotations (see showGroupToolbar)
        if (penKey) setPen(penKey);   // with the pen on, its bar takes the toolbar's place
        if (selectedGroups.join() !== previewedGroups) previewDue = selectedGroups.join();   // shown with the toolbar (see scheduleToolbar)
        previewedGroups = selectedGroups.join();
    }
    let previewedGroups = '';
    let previewDue = '';

    function showDuePreview() {
        if (previewDue && previewDue === selectedGroups.join()) previewSelectedNote(selectedGroups);
        previewDue = '';
    }

    function clearSelectedGroups() {
        if (editor) { if (selectedGroups.join() !== editor.group) setSelectedGroups([]); return; }   // all but the editor's (see setSelectedGroups)
        selectedGroups = [];
        previewedGroups = previewDue = '';
        if (selectPreview) hideNoteCard();
        cancelAnimationFrame(selectFrame);
        selectFrame = 0;
        selectBoxes.forEach(({ el }, g) => { el.remove(); unmarkNoteSelect(g); });
        selectBoxes.clear();
        selectWrappers = null;
        if (toolbarGroups) hideToolbar();
        if (penKey) setPen(penKey);
    }

    function unmarkNoteSelect(group) {
        groupWrappers(group).forEach(w => w.removeAttribute(NOTE_SELECT_ATTR));
    }

    // `wrappers`: the groups' wrappers, when the caller has them already.
    function groupClientRects(groups, wrappers = null) {
        return annotationsHidden ? [] : (wrappers || [].concat(groups).flatMap(groupWrappers))
            .flatMap(w => Array.from(w.getClientRects())).filter(r => r.width || r.height);
    }

    // The wrappers of each of `groups`, found in one pass over the page rather than one per group.
    function wrappersByGroup(groups) {
        const map = new Map(groups.map(g => [g, []]));
        allWrappers().forEach(w => {
            const list = map.get(w.getAttribute(GROUP_ATTR));
            if (list) list.push(w);
        });
        return map;
    }

    // The wrappers of each of `groups`. The selected annotations' are kept from frame to frame,
    // searched for again only when the script added or removed some, one left the page or its
    // annotation, or a second has passed: the outlines and their toolbar follow them each frame.
    function wrappersOfGroups(groups) {
        if (!groups.every(g => selectBoxes.has(g))) return wrappersByGroup(groups);
        const now = performance.now();
        const cached = selectWrappers;
        const valid = cached && cached.groups === selectedGroups && cached.epoch === wrapperEpoch && now - cached.at < 1000 &&
            Array.from(cached.map).every(([g, ws]) => ws.every(w => w.isConnected && w.getAttribute(GROUP_ATTR) === g));
        if (!valid) selectWrappers = { groups: selectedGroups, epoch: wrapperEpoch, at: now, map: wrappersByGroup(selectedGroups) };
        return selectWrappers.map;
    }

    // The box around all of an annotation's lines (of several: around all of them), in the
    // viewport; null when none of it is shown.
    function groupRect(groups) {
        const list = [].concat(groups);
        const byGroup = wrappersOfGroups(list);
        const rects = groupClientRects(list, list.flatMap(g => byGroup.get(g) || []));
        if (!rects.length) return null;
        const top = Math.min(...rects.map(r => r.top)) - SELECT_BOX_PAD;
        const left = Math.min(...rects.map(r => r.left)) - SELECT_BOX_PAD;
        const bottom = Math.max(...rects.map(r => r.bottom)) + SELECT_BOX_PAD;
        const right = Math.max(...rects.map(r => r.right)) + SELECT_BOX_PAD;
        return { top, left, bottom, right, width: right - left, height: bottom - top };
    }

    // The outline around an annotation's lines, following the text's shape: one row per
    // line, from where the text starts on the first line to where it ends on the last, the rows
    // joined halfway between lines into one outline with rounded corners. Rows that don't touch
    // (a line ending left of where the line above it starts) get outlines of their own. Returns
    // the box holding them all, in the viewport, and the outlines as path data within it.
    // `rects`: the annotation's line boxes (groupClientRects).
    function groupOutline(rects) {
        const rows = [];
        rects.slice().sort((a, b) => a.top - b.top).forEach(r => {
            const row = rows.find(o => Math.min(o.bottom, r.bottom) - Math.max(o.top, r.top) > Math.min(o.bottom - o.top, r.height) / 2);
            if (row) Object.assign(row, { top: Math.min(row.top, r.top), bottom: Math.max(row.bottom, r.bottom), left: Math.min(row.left, r.left), right: Math.max(row.right, r.right) });
            else rows.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
        });
        rows.sort((a, b) => a.top - b.top).forEach(o => {
            o.top = Math.round(o.top - SELECT_BOX_PAD); o.bottom = Math.round(o.bottom + SELECT_BOX_PAD);
            o.left = Math.round(o.left - SELECT_BOX_PAD); o.right = Math.round(o.right + SELECT_BOX_PAD);
        });
        const rect = {
            top: Math.min(...rows.map(o => o.top)), left: Math.min(...rows.map(o => o.left)),
            bottom: Math.max(...rows.map(o => o.bottom)), right: Math.max(...rows.map(o => o.right)),
        };
        rect.width = rect.right - rect.left; rect.height = rect.bottom - rect.top;
        // Split into runs of rows that touch, each meeting the next halfway between them.
        const runs = [];
        rows.forEach((o, i) => {
            const prev = rows[i - 1];
            if (prev && o.left < prev.right && o.right > prev.left) {
                const mid = Math.round((prev.bottom + o.top) / 2);
                prev.bottom = mid; o.top = mid;
                runs[runs.length - 1].push(o);
            } else runs.push([o]);
        });
        const d = runs.map(run => {
            // Down the right side, each row's top to its bottom, then up the left side.
            const pts = run.flatMap(o => [[o.right, o.top], [o.right, o.bottom]]);
            for (let i = run.length - 1; i >= 0; i--) pts.push([run[i].left, run[i].bottom], [run[i].left, run[i].top]);
            return roundedPath(cleanPolygon(pts), SELECT_BOX_RADIUS, rect);
        }).join(' ');
        return { rect, d };
    }

    // The note badge's box, widened by its rim and a gap, in the viewport; null without a note.
    // The badge is generated content (::after, see page-css-and-state.js), which has no rects of
    // its own: its size comes from its computed style, and its place from the end of the
    // annotation's last line, moved as the CSS moves it (translate(45%, -55%) from text-top).
    // `mark`: the annotation's wrapper that shows the badge, if any.
    function noteBadgeHole(mark) {
        const r = mark && Array.from(mark.getClientRects()).filter(o => o.width || o.height).pop();
        if (!r) return null;
        const cs = getComputedStyle(mark, '::after');
        const w = parseFloat(cs.width), h = parseFloat(cs.height);
        if (!(w > 0 && h > 0)) return null;
        const left = r.right - 0.55 * w, top = r.top - 0.55 * h;
        const pad = Math.max(1.5, 0.08 * parseFloat(cs.fontSize)) + SELECT_BADGE_GAP;
        return { left: left - pad, top: top - pad, width: w + 2 * pad, height: h + 2 * pad, radius: h / 2 + pad };
    }

    // Drops repeated points and points in the middle of a straight edge.
    function cleanPolygon(pts) {
        let out = pts.filter((p, i) => { const q = pts[(i + 1) % pts.length]; return p[0] !== q[0] || p[1] !== q[1]; });
        out = out.filter((p, i) => {
            const a = out[(i + out.length - 1) % out.length], b = out[(i + 1) % out.length];
            return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
        });
        return out;
    }

    // A closed path through the points, each corner rounded (by less where an edge is short),
    // relative to the box's top left.
    function roundedPath(pts, radius, box) {
        const n = pts.length;
        const at = ([x, y]) => `${x - box.left} ${y - box.top}`;
        const toward = (p, q, len) => {
            const dist = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
            return [p[0] + (q[0] - p[0]) * len / dist, p[1] + (q[1] - p[1]) * len / dist];
        };
        const half = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]) / 2;
        let d = '';
        pts.forEach((p, i) => {
            const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
            const r = Math.min(radius, half(a, p), half(p, b));
            const from = toward(p, a, r), to = toward(p, b, r);
            d += `${i ? 'L' : 'M'}${at(from)} Q${at(p)} ${at(to)} `;
        });
        return `${d}Z`;
    }

    // Each frame while any is selected: the boxes follow their annotations through scrolling,
    // reflow and redraws, and go when they do (removed, undone, hidden by Alt+V). An outline is
    // worked out again only when its lines moved in the layer (not when only the page scrolled),
    // so a still selection costs little, however many annotations or lines it has.
    function followSelectBoxes() {
        selectFrame = 0;
        if (!selectedGroups.length) return;
        const wrappersOf = wrappersOfGroups(selectedGroups);
        const rects = new Map(selectedGroups.map(g => [g, groupClientRects(g, wrappersOf.get(g))]));
        const gone = selectedGroups.filter(g => !rects.get(g).length && !(editor && editor.group === g));
        if (gone.length) {
            setSelectedGroups(selectedGroups.filter(g => !gone.includes(g)));
            if (!selectedGroups.length) return;
        }
        // Where the boxes' layer is in the window: it moves as the page scrolls.
        const layer = selectHost.getBoundingClientRect();
        selectedGroups.forEach(g => {
            const box = selectBoxes.get(g);
            if (!rects.get(g).length) { box.el.hidden = true; return; }   // the editor's, while its text is hidden or redrawn
            const wrappers = wrappersOf.get(g);
            const mark = wrappers.find(w => w.hasAttribute(NOTE_MARK_ATTR));
            // Its badge in the outline's color; set here so it follows a redraw that replaced the piece.
            if (mark && !mark.hasAttribute(NOTE_SELECT_ATTR)) mark.setAttribute(NOTE_SELECT_ATTR, '');
            const shape = rects.get(g).map(r => `${r.left - layer.left},${r.top - layer.top},${r.width},${r.height}`).join(' ') +
                (mark ? `|${wrappers.indexOf(mark)}` : '');
            if (shape !== box.shape) {
                box.shape = shape;
                const { rect, d } = groupOutline(rects.get(g));
                const hole = noteBadgeHole(mark);
                const cut = hole ? [hole.left - rect.left, hole.top - rect.top, hole.width, hole.height, hole.radius].map(n => Math.round(n * 10) / 10) : [0, 0, 0, 0, 0];
                // In the layer: the same while only the page scrolls.
                const top = Math.round((rect.top - layer.top) * 10) / 10, left = Math.round((rect.left - layer.left) * 10) / 10;
                Object.assign(box.el.style, { top: `${top}px`, left: `${left}px`, width: `${rect.width}px`, height: `${rect.height}px` });
                box.path.setAttribute('d', d);   // not innerHTML: see makeEl
                ['x', 'y', 'width', 'height', 'rx'].forEach((k, i) => box.hole.setAttribute(k, cut[i]));
                if (hole) box.path.setAttribute('mask', box.mask);
                else box.path.removeAttribute('mask');
            }
            box.el.hidden = false;
            clipOutCovers(box.el);
        });
        selectFrame = requestAnimationFrame(followSelectBoxes);
    }

    // The part of a box that lies under the page's header or the like is cut away, as the
    // text is not seen there.
    // Worked out again only when the box moves on the screen (the page's header changes with scrolling), so a box that sits still costs no hit tests.
    const clipKeys = new WeakMap();
    function clipOutCovers(el) {
        const r = el.getBoundingClientRect();
        const key = `${r.left},${r.top},${r.width},${r.height},${innerWidth},${innerHeight}`;
        if (clipKeys.get(el) === key) return;
        clipKeys.set(el, key);
        const hit = pageCovers().filter(c => c.left < r.right && c.right > r.left && c.top < r.bottom && c.bottom > r.top);
        const clip = hit.length ? `path(evenodd, 'M-10 -10H${r.width + 10}V${r.height + 10}H-10Z${hit.map(c =>
            `M${c.left - r.left} ${c.top - r.top}h${c.width}v${c.height}h${-c.width}Z`).join('')}')` : '';
        if (el.style.clipPath !== clip) el.style.clipPath = clip;
    }

    // Where a click would select: the annotation's group, or null for a click that isn't one.
    function clickedGroup(e) {
        const target = e.target instanceof Element ? e.target : null;
        const w = target && target.closest(WRAPPER_SELECTOR);
        if (!w || e.button !== 0 || e.altKey || annotationsHidden || target.closest(CLICK_THROUGH_SELECTOR)) return null;
        return w.getAttribute(GROUP_ATTR);
    }

    // Shift+click would extend the page's text selection from the caret: with annotations
    // selected (or no text selected), it selects annotations instead.
    function onSelectMouseDown(e) {
        if (isUiEvent(e) || !(e.shiftKey || e.ctrlKey) || !clickedGroup(e)) return;
        if (e.shiftKey && !selectedGroups.length && getActiveRange()) return;
        e.preventDefault();
    }

    function onDocumentClick(e) {
        if (isUiEvent(e)) return;   // the note card, the toast's Undo: the selection stays
        const group = clickedGroup(e);
        if (group && editor) return;   // while a note is edited, clicking annotations selects nothing
        if (!group || getActiveRange()) { clearSelectedGroups(); return; }
        if (e.ctrlKey) {
            setSelectedGroups(selectedGroups.includes(group) ? selectedGroups.filter(g => g !== group) : selectedGroups.concat(group));
        } else if (e.shiftKey && selectedGroups.length) {
            const order = groupsInOrder();
            const from = order.indexOf(selectedGroups[selectedGroups.length - 1]);
            const to = order.indexOf(group);
            const span = order.slice(Math.min(from, to), Math.max(from, to) + 1);
            // Just these, as in a file list; the one selected last stays the start, so another
            // Shift+click goes from it again.
            setSelectedGroups(span.filter(g => g !== order[from]).concat(order[from]));
        } else if (selectedGroups.length !== 1 || selectedGroups[0] !== group) {
            setSelectedGroups([group]);
        }
    }

    // Selecting text lets the annotations go.
    function onSelectionForGroup() {
        if (selectedGroups.length && getActiveRange()) clearSelectedGroups();
    }

    // Removes every annotation in `groups`, as one step for Undo.
    function deleteGroups(groups) {
        if (groups.length === 1) { deleteAnnotation(groups[0]); return; }
        syncLocation();
        cancelEditor();
        const live = groups.filter(g => groupWrappers(g).length);
        if (!live.length) return;
        runUndoable(() => {
            live.forEach(g => unwrapMany(groupWrappers(g)));
            pendingRecords = pendingRecords.filter(r => !live.includes(recordOwner(r)));
        });
    }

    // The keys for the selected annotations, with or without Alt (see onKeyDown). True if used.
    function selectedGroupKey(e) {
        if (!selectedGroups.length || e.ctrlKey || e.metaKey || e.isComposing) return false;
        if (isUiEvent(e) || isEditableTarget(e) || getActiveRange()) return false;
        const groups = selectedInOrder();
        if (e.key === 'Escape' && !e.altKey) {
            clearSelectedGroups();
        } else if (e.shiftKey) {
            return false;
        } else if (e.code === 'KeyD' && groups.length === 1 && groupHasNote(groups[0])) {
            deleteGroupNote(groups[0]);   // the note first, then (D again) the annotation
            refreshGroupToolbar();
        } else if (e.code === 'KeyD') {
            deleteGroups(groups);
        } else if (e.code === 'KeyN') {
            openNoteEditor(groups[0]);
        } else if (CODE_TO_STYLE.has(e.code)) {
            syncLocation();
            restyleGroups(groups, CODE_TO_STYLE.get(e.code));
            refreshGroupToolbar();
        } else {
            return false;
        }
        e.preventDefault();
        e.stopPropagation();   // the page's own single-key shortcuts stay out of it
        return true;
    }
    // --- The page's annotations, for the panel and for Markdown ---

    // The annotations on the page in reading order: { group, key, wrappers, note, time, paragraphs }.
    function pageAnnotations() {
        const byGroup = new Map();
        allWrappers().forEach(w => {
            const group = w.getAttribute(GROUP_ATTR) || '';
            let a = byGroup.get(group);
            if (!a) {
                a = { group, key: w.getAttribute(STYLE_ATTR), wrappers: [], note: w.getAttribute(NOTE_ATTR) || '', time: annotationTime(w) };
                byGroup.set(group, a);
            }
            a.wrappers.push(w);
        });
        const blockText = new Map();
        return Array.from(byGroup.values()).map(a => ({ ...a, paragraphs: annotationParagraphs(a.wrappers, blockText) }));
    }

    // An annotation's text, one paragraph per block it spans, with spacing collapsed. Pieces in
    // one block join up, with " … " where a removed piece left a gap.
    function annotationParagraphs(wrappers, blockText) {
        const paras = [];
        let lastBlock = null;
        let lastEnd = 0;
        wrappers.forEach(w => {
            const block = getBlockParent(w);
            const extent = wrappers.length > 1 ? wrapperExtent(w, block) : null;
            if (block === lastBlock && extent) {
                if (!blockText.has(block)) blockText.set(block, block.textContent);
                const gap = blockText.get(block).slice(lastEnd, extent.start);
                paras[paras.length - 1] += (gap.trim() ? ' … ' : gap) + w.textContent;
            } else {
                paras.push(w.textContent);
            }
            lastBlock = block;
            if (extent) lastEnd = extent.end;
        });
        return paras.map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    }

    // Saved annotations not on the page (their style still exists): { group, key, records, note,
    // time, paragraphs, page }. This page's (see missingRecords), or with `otherPages`, those made
    // on other pages that share its key, which belong there.
    function missingAnnotations(presentGroups, { otherPages = false } = {}) {
        const byGroup = new Map();
        pendingRecords.forEach(r => {
            if (!hasOwn(STYLES, r.key) || isOtherPage(r) !== otherPages) return;
            const group = recordOwner(r);
            if (presentGroups.has(group)) return;   // a piece of an annotation that is on the page
            let a = byGroup.get(group);
            if (!a) {
                a = { group, key: r.key, records: [], note: '', time: groupTime(group) || r.added || null, page: r.page || currentKey };
                byGroup.set(group, a);
            }
            a.records.push(r);
            if (!a.note && r.note) a.note = r.note;
        });
        return Array.from(byGroup.values()).map(a => ({
            ...a, paragraphs: [a.records.map(r => r.text || '').join(' ').replace(/\s+/g, ' ').trim()]
        }));
    }

    // --- Copy as Markdown ---

    // Escapes what Markdown would read as formatting in quoted page text.
    function markdownText(s) {
        return s.replace(/[\\`*_[\]<>]/g, '\\$&')
            .replace(/^([#+-])/, '\\$1')
            .replace(/^(\d+)([.)])/, '$1\\$2');
    }

    // Parentheses and spaces would end a Markdown link early.
    function markdownUrl(u) {
        return u.replace(/[()\s]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
    }

    // Text directives (#:~:text=) need - , & encoded as well.
    function fragmentPart(s) {
        return encodeURIComponent(s).replace(/[-!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    }

    // The rest of a word the annotation cuts through at its start ('before') or end, else ''.
    function partialWord(wrapper, side, blockText) {
        const block = getBlockParent(wrapper);
        if (!blockText.has(block)) blockText.set(block, block.textContent);
        const full = blockText.get(block);
        const { start, end } = wrapperExtent(wrapper, block);
        const text = wrapper.textContent;
        if (side === 'before') return /^\S/.test(text) ? /\S*$/.exec(full.slice(0, start))[0] : '';
        return /\S$/.test(text) ? /^\S*/.exec(full.slice(end))[0] : '';
    }

    // Up to `n` whole words of the text right before (side 'before') or after a wrapper, or '' when
    // the annotation starts or ends inside a word, where a text fragment can't anchor to them.
    function contextWords(wrapper, side, blockText, n = 3) {
        const block = getBlockParent(wrapper);
        if (!blockText.has(block)) blockText.set(block, block.textContent);
        const full = blockText.get(block);
        const { start, end } = wrapperExtent(wrapper, block);
        if (side === 'before') {
            const text = full.slice(Math.max(0, start - CONTEXT_LENGTH * 2), start);
            if (!text || /\S$/.test(text) && /^\S/.test(wrapper.textContent)) return '';
            const words = text.trim().split(/\s+/).filter(Boolean);
            if (start > CONTEXT_LENGTH * 2) words.shift();   // may be cut
            return words.slice(-n).join(' ');
        }
        const text = full.slice(end, end + CONTEXT_LENGTH * 2);
        if (!text || /^\S/.test(text) && /\S$/.test(wrapper.textContent)) return '';
        const words = text.trim().split(/\s+/).filter(Boolean);
        if (end + CONTEXT_LENGTH * 2 < full.length) words.pop();
        return words.slice(0, n).join(' ');
    }

    // The text directive that opens the page at this annotation: its whole text, or for a long
    // one its first and last words, with the words around it when that text occurs more than once.
    function textDirective(a, pageText, blockText) {
        const runs = a.paragraphs.flatMap(p => p.split(' … '));   // text the page shows unbroken
        if (a.wrappers) {
            // Text fragments match whole words only: an annotation starting or ending inside a
            // word is named by the whole word.
            runs[0] = partialWord(a.wrappers[0], 'before', blockText) + runs[0];
            runs[runs.length - 1] += partialWord(a.wrappers[a.wrappers.length - 1], 'after', blockText);
        }
        const head = runs[0].split(' ');
        const tail = runs[runs.length - 1].split(' ');
        const n = MARKDOWN_FRAGMENT_WORDS;
        const whole = runs.length === 1 && head.length <= n * 2;
        const start = whole ? runs[0] : head.slice(0, n).join(' ');
        const end = whole ? '' : tail.slice(-n).join(' ');
        const parts = [fragmentPart(start)];
        if (end) parts.push(fragmentPart(end));
        if (occurrences(pageText, start).length > 1 && a.wrappers) {
            const prefix = contextWords(a.wrappers[0], 'before', blockText);
            const suffix = contextWords(a.wrappers[a.wrappers.length - 1], 'after', blockText);
            if (prefix) parts.unshift(`${fragmentPart(prefix)}-`);
            if (suffix) parts.push(`-${fragmentPart(suffix)}`);
        }
        return `text=${parts.join(',')}`;
    }

    // The page's title and link, then each annotation as a quote linked to its passage, with
    // its note below it.
    function annotationsMarkdown(items) {
        const url = urlKey(location.href);
        const directiveBase = `${url}${url.includes('#') ? '' : '#'}:~:`;   // a hash route keeps its #
        const title = (document.title || '').replace(/\s+/g, ' ').trim() || location.hostname || url;
        const pageText = (document.body ? document.body.textContent : '').replace(/\s+/g, ' ');
        const blockText = new Map();
        const out = [`## [${title.replace(/[\\[\]]/g, '\\$&')}](${markdownUrl(url)})`];
        items.forEach(a => {
            if (!a.paragraphs.length) return;
            const quote = a.paragraphs.map(p => `> ${markdownText(p)}`).join('\n>\n');
            const link = markdownUrl(directiveBase + textDirective(a, pageText, blockText));
            out.push('', `${quote} [↗](${link})`);
            if (a.note) out.push('', a.note);
        });
        return out.join('\n') + '\n';
    }

    function writeClipboard(text) {
        if (typeof GM_setClipboard === 'function') {
            try { GM_setClipboard(text); return Promise.resolve(); } catch (e) { /* try the page's clipboard */ }
        }
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') return navigator.clipboard.writeText(text);
        return Promise.reject(new Error('no clipboard access'));
    }

    const copyFlashes = new WeakMap();   // button -> { icon: its own icon, timer }

    // Copying shows no toast: the button's icon turns into a check for a moment.
    function flashCopied(button) {
        if (!button) return;
        const flash = copyFlashes.get(button) || { icon: button.firstElementChild, timer: 0 };
        clearTimeout(flash.timer);
        const check = phosphorIcon('check');
        button.firstElementChild.replaceWith(check);
        flash.timer = setTimeout(() => { check.replaceWith(flash.icon); }, 1500);
        copyFlashes.set(button, flash);
    }

    // `items`: the annotations to copy (the panel passes what its filter shows); all by default.
    // `button`: the button that asked, which shows the check once it is copied.
    function copyAnnotations(items = null, button = null) {
        if (!running) return;
        syncLocation();
        const list = (items || pageAnnotations()).filter(a => a.wrappers.some(w => w.isConnected));
        if (!list.length) {
            showToast('Nothing to copy');
            return;
        }
        let markdown;
        try {
            markdown = annotationsMarkdown(list);
        } catch (e) {
            console.warn(`${LOG} could not build Markdown`, e);
            showToast('Couldn\'t copy', { intent: 'error', icon: 'warning-circle' });
            return;
        }
        writeClipboard(markdown).then(
            () => flashCopied(button),
            e => { console.warn(`${LOG} could not copy`, e); showToast('Couldn\'t copy', { intent: 'error', icon: 'warning-circle' }); });
    }

    // --- Changes made from the panel ---

    // A note being written closes first, so the highlight made for a new one is still the
    // latest undo step and goes with it.
    function closeNoteForPanel() {
        cancelEditor();
    }

    // Removes the whole annotation, also from the keyboard (Alt+D, or its own style, with
    // the mouse on it).
    function deleteAnnotation(group) {
        syncLocation();
        closeNoteForPanel();
        if (!groupWrappers(group).length) return;
        runUndoable(() => {
            unwrapMany(groupWrappers(group));
            pendingRecords = pendingRecords.filter(r => recordOwner(r) !== group);
        });
    }

    function forgetAnnotation(group) {
        syncLocation();
        closeNoteForPanel();
        if (!pendingRecords.some(r => recordOwner(r) === group)) return;
        runUndoable(() => { pendingRecords = pendingRecords.filter(r => recordOwner(r) !== group); });
    }

    // Re-anchors a saved annotation that can't be found to the text selected now. It keeps its
    // style, note and date, and from then on is saved with the new text.
    function attachToSelection(group) {
        syncLocation();
        const records = pendingRecords.filter(r => recordOwner(r) === group && hasOwn(STYLES, r.key));
        if (!records.length) return;
        const selected = toolbarSelection();
        let range = selected && cleanRange(selected);
        if (!range) {
            showToast('Select the text first');
            return;
        }
        if (editor) {
            // Closing the note may take its new highlight off the page, which moves text nodes:
            // the selection is kept as offsets in its blocks and rebuilt afterwards.
            const startBlock = getBlockParent(range.startContainer);
            const endBlock = getBlockParent(range.endContainer);
            const startOff = computeOffsetWithinBlock(startBlock, range.startContainer, range.startOffset);
            const endOff = computeOffsetWithinBlock(endBlock, range.endContainer, range.endOffset);
            closeNoteForPanel();
            const sp = findNodeAtOffset(startBlock, startOff, 'start');
            const ep = findNodeAtOffset(endBlock, endOff, 'end');
            if (!sp || !ep) return;
            range = document.createRange();
            range.setStart(sp.node, sp.offset);
            range.setEnd(ep.node, ep.offset);
        }
        const withNote = records.find(r => r.note);
        const dated = records.find(r => r.added);
        const own = {
            group,
            note: withNote ? withNote.note : undefined,
            added: groupTime(group) ? undefined : (dated ? dated.added : Date.now())
        };
        let created = [];
        runUndoable(() => {
            const before = pendingRecords;
            pendingRecords = pendingRecords.filter(r => recordOwner(r) !== group);
            created = applyAnnotation(range, records[0].key, findOverlaps(range), own);
            if (!created.length) pendingRecords = before;   // nothing could be wrapped: it stays saved
        });
        const sel = window.getSelection();
        if (sel) sel.removeAllRanges();
        if (!created.length) showToast('Couldn\'t annotate that text', { intent: 'error', icon: 'warning-circle' });
    }

    // --- Annotations panel (Alt+O) ---

    let panelTimer = null;
    let panelSignature = '';      // what the list shows now; it is rebuilt only when that changes
    let panelItems = [];          // the annotations on the page the list shows, for Copy
    let panelCounts = '';         // see notePanelChanges
    let panelReturnFocus = null;
    let panelAnchor = null;           // the row ticked last: Shift+click ticks the rows from it
    const panelChecked = new Set();   // the groups ticked in the list; the eraser in the header erases them

    function setPanelTheme(dark) {
        panelEl.setAttribute('data-theme', dark ? 'dark' : 'light');
        schedulePanelRefresh();   // the color bars follow the theme
    }

    function openPanel({ focus = true } = {}) {
        if (!running) return;
        syncLocation();
        const dark = computeDarkMode();
        ensureUi(panelOpen() && uiDark !== null ? uiDark : dark);
        setPanelTheme(dark);
        if (panelEl.hidden) {
            const focused = document.activeElement;
            panelReturnFocus = focused && focused !== document.body && focused !== uiHost ? focused : null;
            panelEl.hidden = false;
            panelSignature = '';
        }
        renderPanel();
        // Typing filters the list, unless the user has page text selected (to attach, say).
        if (focus && !getActiveRange()) panelFilter.focus({ preventScroll: true });
    }

    function closePanel() {
        if (panelEl.hidden) return;
        const hadFocus = document.activeElement === uiHost && panelEl.contains(uiRoot.activeElement);
        clearTimeout(panelTimer);
        panelTimer = null;
        hideLabelTip();
        releaseFocus(panelEl);
        panelEl.hidden = true;
        panelList.replaceChildren();
        panelSignature = '';
        panelItems = [];
        panelChecked.clear();
        const back = panelReturnFocus;
        panelReturnFocus = null;
        if (hadFocus && back && back.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
    }

    function togglePanel() {
        if (panelEl.hidden) openPanel();
        else closePanel();
    }

    // The toast's Show: the panel, scrolled to what wasn't found.
    function showMissingInPanel() {
        panelFilter.value = '';
        openPanel();
        const title = panelList.querySelector('[data-section="missing"]');
        if (title) panelList.scrollTop += title.getBoundingClientRect().top - panelList.getBoundingClientRect().top;
    }

    function schedulePanelRefresh() {
        if (panelEl.hidden || panelTimer) return;
        panelTimer = setTimeout(renderPanel, 50);
    }

    // Called every second: annotations a site redrew, or late content that brought some back,
    // change the list without any edit of ours.
    function notePanelChanges() {
        if (panelEl.hidden) return;
        const counts = `${document.querySelectorAll(WRAPPER_SELECTOR).length}|${pendingRecords.length}`;
        if (counts === panelCounts) return;
        panelCounts = counts;
        schedulePanelRefresh();
    }

    function filterTerms() {
        return panelFilter.value.toLowerCase().split(/\s+/).filter(Boolean);
    }

    function matchesFilter(a, terms) {
        if (!terms.length) return true;
        const hay = `${a.paragraphs.join(' ')}\n${a.note}`.toLowerCase();
        return terms.every(t => hay.includes(t));
    }

    function renderPanel() {
        clearTimeout(panelTimer);
        panelTimer = null;
        if (panelEl.hidden || !running) return;
        const present = pageAnnotations();
        const presentGroups = new Set(present.map(a => a.group));
        const missing = missingAnnotations(presentGroups);
        const elsewhere = missingAnnotations(presentGroups, { otherPages: true });
        const terms = filterTerms();
        const shown = present.filter(a => matchesFilter(a, terms));
        const shownMissing = missing.filter(a => matchesFilter(a, terms));
        const shownElsewhere = elsewhere.filter(a => matchesFilter(a, terms));
        const dark = panelEl.getAttribute('data-theme') === 'dark';
        const describe = a => [a.group, a.key, a.paragraphs, a.note, a.time, a.page];
        // Only what the list shows can stay ticked, so the eraser never takes what is out of sight.
        const shownGroups = new Set(shown.map(a => a.group));
        panelChecked.forEach(g => { if (!shownGroups.has(g)) panelChecked.delete(g); });
        if (!panelChecked.size) panelAnchor = null;
        const signature = JSON.stringify([dark, terms, Array.from(panelChecked), present.length, missing.length, elsewhere.length,
            shown.map(describe), shownMissing.map(describe), shownElsewhere.map(describe)]);
        panelItems = shown;
        if (signature === panelSignature) return;
        panelSignature = signature;

        // Keeps keyboard focus on the same control of the same annotation across the rebuild.
        const active = uiRoot.activeElement;
        const keep = active && panelList.contains(active)
            ? { group: active.closest('[data-group]').dataset.group, act: active.dataset.act } : null;

        const ticked = shown.filter(a => panelChecked.has(a.group)).length;
        syncSelectionButtons(panelSelectAll, panelCopy, panelErase, ticked, shown.length);
        const word = present.length === 1 ? 'annotation' : 'annotations';
        if (ticked) setPanelTitle(panelCount, `${ticked} of ${shown.length}`, ' selected', word);
        else if (terms.length) setPanelTitle(panelCount, `${shown.length} of ${present.length}`, ` matched`, word);
        else setPanelTitle(panelCount, String(present.length), ' found', word);
        const children = [];
        if (!present.length && !missing.length) {
            children.push(makeEl('div', { class: 'empty', text: 'No annotations on this page yet. Select some text and press Alt+H to highlight it.' }));
        } else if (!shown.length && !shownMissing.length && !shownElsewhere.length) {
            children.push(makeEl('div', { class: 'empty', text: 'No annotations match the filter.' }));
        }
        shown.forEach(a => children.push(panelItem(a, dark, false)));
        if (shownMissing.length) {
            children.push(makeEl('div', { class: 'section-title', 'data-section': 'missing', text: `Not found on the page (${shownMissing.length})` }));
            shownMissing.forEach(a => children.push(panelItem(a, dark, true)));
        }
        if (shownElsewhere.length) {
            children.push(makeEl('div', { class: 'section-title', 'data-section': 'elsewhere', text: `Saved on other pages (${shownElsewhere.length})` }));
            shownElsewhere.forEach(a => children.push(panelItem(a, dark, true, true)));
        }
        panelList.replaceChildren(...children);

        if (keep) {
            const item = Array.from(panelList.querySelectorAll('[data-group]')).find(el => el.dataset.group === keep.group);
            const target = item && item.querySelector(`[data-act="${keep.act}"]`);
            (target || panelFilter).focus({ preventScroll: true });
            hideLabelTip();   // focusing it again is no reason to show its tooltip
        }
    }

    // The header's select all/none, copy and erase (or forget) buttons of either panel: copy and
    // erase wait for something ticked, and select all turns into select none once all are.
    // The search can pass the label of a middle step ("Select all on these pages") for select all.
    function syncSelectionButtons(selectAll, copy, erase, ticked, total, midLabel) {
        selectAll.disabled = !total;
        const allTicked = !!total && ticked === total;
        const label = allTicked ? 'Select none' : midLabel || 'Select all';
        selectAll.dataset.all = String(allTicked);
        selectAll.replaceChildren(phosphorIcon(allTicked ? 'square' : 'check-square'));
        selectAll.setAttribute('aria-label', label);
        selectAll.dataset.label = label;
        copy.disabled = !ticked;
        erase.disabled = !ticked;
        hideLabelTip();
    }

    function panelButton(icon, label, act) {
        const b = makeButton({ icon: phosphorIcon(icon) });
        b.dataset.act = act;
        return addLabelTip(b, label, '', () => false);
    }

    // A page's address without its site, to tell the pages that share a key apart.
    function pagePath(url) {
        try {
            const u = new URL(url);
            return decodeURI(u.pathname + u.search + u.hash);
        } catch (e) {
            return url;
        }
    }

    let panelItemSeq = 0;
    function panelItem(a, dark, missing, elsewhere = false) {
        const meta = [styleLabel(a.key), a.time ? `added ${formatDate(a.time)}` : '', elsewhere ? `on ${pagePath(a.page)}` : '']
            .filter(Boolean).join(' · ');
        const main = makeEl(missing ? 'div' : 'button', missing ? { class: 'item-main' } : { type: 'button', class: 'item-main', 'data-act': 'jump' }, [
            makeEl('div', { class: 'item-text', id: `rnh-pi-${++panelItemSeq}`, text: a.paragraphs.join(' ') })
        ]);
        if (a.note) main.appendChild(makeEl('div', { class: 'item-note', text: a.note }));
        main.appendChild(makeEl('div', { class: 'item-meta', text: meta }));
        main.style.setProperty('--swatch', resolveStyle(a.key, dark).color);
        const actions = makeEl('div', { class: 'item-actions' });
        let check = null;
        if (missing) {
            const attach = makeButton({ text: 'Attach to selection' });
            attach.dataset.act = 'attach';
            attach.title = 'Select the text this annotation belongs to on the page, then click here';
            actions.append(attach, panelButton('trash', 'Forget annotation', 'forget'));
        } else {
            check = makeEl('input', { type: 'checkbox', class: 'check', 'data-act': 'check', 'aria-labelledby': main.firstChild.id });
            check.checked = panelChecked.has(a.group);
        }
        const item = makeEl('div', { class: missing ? 'item missing' : 'item', role: 'listitem' }, check ? [main, check] : [main, actions]);
        item.dataset.group = a.group;
        return item;
    }

    panelList.setAttribute('role', 'list');
    addLabelTip(panelClose, 'Close', 'Alt+O', () => true);
    addLabelTip(panelCopy, 'Copy selected as Markdown', '', () => true);
    panelCopy.addEventListener('click', () => {
        renderPanel();
        const ticked = panelItems.filter(a => panelChecked.has(a.group));
        if (ticked.length) copyAnnotations(ticked, panelCopy);
    });
    panelClose.addEventListener('click', closePanel);
    addLabelTip(panelErase, 'Erase selected annotations', '', () => true);
    addLabelTip(panelSelectAll, 'Select all', '', () => true);
    panelErase.addEventListener('click', () => {
        if (!running) return;
        const groups = panelItems.map(a => a.group).filter(g => panelChecked.has(g));
        panelChecked.clear();
        deleteGroups(groups);
        renderPanel();
    });
    // All, or none when all are ticked.
    panelSelectAll.addEventListener('click', () => {
        const none = panelSelectAll.dataset.all === 'true';
        panelItems.forEach(a => { if (none) panelChecked.delete(a.group); else panelChecked.add(a.group); });
        selectPanelTicked();
        renderPanel();
    });
    panelEl.addEventListener('mouseenter', () => { if (cardWrapper) hideNoteCard(); });
    panelFilter.addEventListener('input', () => renderPanel());
    // Pressing a button keeps the page's text selection (for Attach to selection).
    panelEl.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });

    // The ticked annotations get the same outline on the page as clicking them does.
    function selectPanelTicked() {
        setSelectedGroups(panelItems.map(a => a.group).filter(g => panelChecked.has(g) && groupWrappers(g).length));
    }

    // Windows-style selection in a list of rows (here and in the search): Ctrl+click toggles a row,
    // Shift+click ticks every row between the one ticked last (the anchor) and this one. Returns the
    // anchor to keep. `ids` are the rows in list order.
    function tickRows(checked, ids, anchor, id, shift) {
        if (shift && ids.includes(anchor) && ids.includes(id)) {
            const a = ids.indexOf(anchor), b = ids.indexOf(id);
            ids.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => checked.add(x));
            return anchor;
        }
        if (checked.has(id)) checked.delete(id); else checked.add(id);
        return id;
    }

    function tickPanelRows(group, shift) {
        const ids = Array.from(panelList.querySelectorAll('.item:not(.missing)')).map(el => el.dataset.group);
        panelAnchor = tickRows(panelChecked, ids, panelAnchor, group, shift);
        selectPanelTicked();
        renderPanel();
    }

    panelList.addEventListener('click', e => {
        const button = e.target.closest('[data-act]');
        const item = button && button.closest('[data-group]');
        if (!item || !running) return;
        const group = item.dataset.group;
        switch (button.dataset.act) {
            case 'jump':
                // Once something is ticked, Ctrl or Shift on a row selects instead of jumping.
                if (panelChecked.size && (e.shiftKey || e.ctrlKey || e.metaKey)) { tickPanelRows(group, e.shiftKey); break; }
                syncLocation();
                jumpToGroup(group);
                setSelectedGroups([group]);
                break;
            case 'check':
                if (e.shiftKey && panelAnchor) { tickPanelRows(group, true); break; }
                if (button.checked) panelChecked.add(group); else panelChecked.delete(group);
                panelAnchor = group;
                selectPanelTicked();
                renderPanel();
                break;
            case 'forget': forgetAnnotation(group); break;
            case 'attach': attachToSelection(group); break;
        }
    });

    panelEl.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            e.preventDefault();
            if (panelFilter.value) { panelFilter.value = ''; renderPanel(); }
            else closePanel();
            return;
        }
        const focused = uiRoot.activeElement;
        // Shift+Space ticks the rows from the last ticked one to the focused row.
        const focusedRow = focused && focused !== panelFilter && focused.closest ? focused.closest('.item:not(.missing)') : null;
        if (e.key === ' ' && e.shiftKey && focusedRow) {
            e.preventDefault();
            tickPanelRows(focusedRow.dataset.group, !!panelAnchor);
            return;
        }
        if (e.key === 'Enter' && focused === panelFilter) {
            e.preventDefault();
            const first = panelList.querySelector('button.item-main');
            if (first) first.click();
            return;
        }
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        // Up and down move between the annotations, starting from the filter box.
        const rows = Array.from(panelList.querySelectorAll('button.item-main'));
        if (!rows.length) return;
        e.preventDefault();
        const row = focused && focused !== panelFilter && focused.closest ? focused.closest('.item') : null;
        const i = rows.indexOf(row && row.querySelector('button.item-main'));
        const down = e.key === 'ArrowDown';
        if (i < 0) { (down ? rows[0] : rows[rows.length - 1]).focus(); return; }
        if (!down && i === 0) { panelFilter.focus(); return; }
        let next = rows[Math.min(rows.length - 1, i + (down ? 1 : -1))];
        // Shift+arrow ticks the row it moves to, with the ones between (the list is rebuilt, so the row is found again).
        if (e.shiftKey && next !== rows[i]) {
            const group = next.closest('.item').dataset.group;
            if (!panelAnchor) tickPanelRows(rows[i].closest('.item').dataset.group, false);
            tickPanelRows(group, true);
            next = panelList.querySelector(`[data-group="${group}"] button.item-main`) || next;
        }
        next.focus();
        next.scrollIntoView({ block: 'nearest' });
    });

    // --- Everything saved (Alt+Shift+O): every page's annotations, searchable ---

    // A full-page overlay: a search box and the pages with annotations, most recently annotated
    // first. Each page opens to its quotes and notes; a quote opens its page at that passage
    // (in a new tab; on this page it scrolls to it). Read from storage each time it opens.
    let everythingPages = [];
    let everythingToggled = new Set();   // pages opened by a click (closed by one, while searching)
    let everythingReturnFocus = null;
    let everythingAnchor = null;         // the row ticked last, for Shift+click
    let everythingChecked = new Set();   // ticked annotations, as `${page key}\n${group}`
    let everythingShown = [];            // [{ id, page, item }]: what the search shows, in every page, open or not

    // [{ key, url, host, path, time, items: [{ group, key, note, time, text, url }] }], newest first.
    function savedPages() {
        if (typeof GM_listValues !== 'function') return [];
        const pages = [];
        GM_listValues().forEach(k => {
            if (k === SETTINGS_KEY) return;
            const records = readRecords(k);
            if (!records || !records.length) return;
            const byGroup = new Map();
            records.forEach(r => {
                if (!hasOwn(STYLES, r.key)) return;
                const group = recordOwner(r);
                let a = byGroup.get(group);
                if (!a) {
                    a = { group, key: r.key, records: [], note: '', time: groupTime(group) || r.added || null, page: r.page ? r.page : k };
                    byGroup.set(group, a);
                }
                a.records.push(r);
                if (!a.note && r.note) a.note = r.note;
            });
            const items = Array.from(byGroup.values()).map(a => {
                const text = a.records.map(r => r.text || '').join(' ').replace(/\s+/g, ' ').trim();
                const directive = textDirective({ paragraphs: [text] }, '', new Map());
                return { group: a.group, key: a.key, note: a.note, time: a.time, text, url: `${a.page}${a.page.includes('#') ? '' : '#'}:~:${directive}` };
            }).filter(a => a.text);
            if (!items.length) return;
            let host = k, path = '';
            try { const u = new URL(k); host = u.hostname.replace(SITE_PREFIX_RE, ''); path = pagePath(k); } catch (e) { /* not a URL: shown as is */ }
            pages.push({ key: k, host, path, items, time: Math.max(0, ...items.map(a => a.time || 0)) });
        });
        return pages.sort((a, b) => b.time - a.time || a.key.localeCompare(b.key));
    }

    function openEverything() {
        if (!running) return;
        const dark = computeDarkMode();
        ensureUi(dark);
        everythingEl.setAttribute('data-theme', dark ? 'dark' : 'light');
        if (everythingEl.hidden) {
            const focused = document.activeElement;
            everythingReturnFocus = focused && focused !== document.body && focused !== uiHost ? focused : null;
            hideToolbar();
            hideNoteCard();
            everythingFilter.value = '';
            everythingToggled = new Set();
            everythingChecked = new Set();
        }
        everythingPages = savedPages();
        everythingEl.hidden = false;
        renderEverything();
        everythingFilter.focus({ preventScroll: true });
    }

    function closeEverything() {
        if (everythingEl.hidden) return;
        hideLabelTip();
        releaseFocus(everythingEl);
        everythingEl.hidden = true;
        everythingList.replaceChildren();
        everythingPages = [];
        everythingChecked = new Set();
        everythingShown = [];
        const back = everythingReturnFocus;
        everythingReturnFocus = null;
        if (back && back.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
    }

    function toggleEverything() {
        if (everythingEl.hidden) openEverything();
        else closeEverything();
    }

    const everythingId = (p, a) => `${p.key}\n${a.group}`;

    // The ticked annotations as Markdown: each page's address as a heading, then its quotes
    // linked to their passages, with their notes.
    function savedMarkdown(selected) {
        const byPage = new Map();
        selected.forEach(s => { if (!byPage.has(s.page)) byPage.set(s.page, []); byPage.get(s.page).push(s.item); });
        const out = [];
        byPage.forEach((items, p) => {
            out.push(`${out.length ? '\n' : ''}## [${markdownText(p.host + p.path)}](${markdownUrl(p.key)})`);
            items.forEach(a => {
                out.push('', `> ${markdownText(a.text)} [↗](${markdownUrl(a.url)})`);
                if (a.note) out.push('', a.note);
            });
        });
        return out.join('\n') + '\n';
    }

    // Takes the ticked annotations out of storage. Those of this page go the way the annotations
    // panel's Erase and Forget do (Undo included); the others are simply deleted.
    function forgetSaved(selected) {
        const here = selected.filter(s => s.page.key === currentKey).map(s => s.item.group);
        const elsewhere = new Map();
        selected.forEach(s => {
            if (s.page.key === currentKey) return;
            if (!elsewhere.has(s.page.key)) elsewhere.set(s.page.key, new Set());
            elsewhere.get(s.page.key).add(s.item.group);
        });
        elsewhere.forEach((groups, key) => {
            const rest = (readRecords(key) || []).filter(r => !groups.has(recordOwner(r)));
            if (rest.length) GM_setValue(key, JSON.stringify(rest)); else GM_deleteValue(key);
        });
        if (here.length) {
            syncLocation();
            const live = here.filter(g => groupWrappers(g).length);
            runUndoable(() => {
                live.forEach(g => unwrapMany(groupWrappers(g)));
                pendingRecords = pendingRecords.filter(r => !here.includes(recordOwner(r)));
            });
        }
    }

    let everythingItemSeq = 0;
    // Fades a page's list in or out (Anthropic motion: a short ease-out fade, no slide).
    function fadeList(list, grow) {
        const frames = [{ opacity: 1 }, { opacity: 0 }];
        if (grow) frames.reverse();
        return list.animate(frames, { duration: 150, easing: 'ease-out' });   // --duration-normal, --ease-out
    }

    function renderEverything() {
        const terms = everythingFilter.value.toLowerCase().split(/\s+/).filter(Boolean);
        const matches = s => terms.every(t => s.includes(t));
        const dark = everythingEl.getAttribute('data-theme') === 'dark';
        const rows = [];
        const visible = everythingPages.map(p => {
            const pageHit = terms.length > 0 && matches(`${p.host} ${p.path}`.toLowerCase());
            return { p, items: !terms.length || pageHit ? p.items : p.items.filter(a => matches(`${a.text}\n${a.note}`.toLowerCase())) };
        }).filter(v => v.items.length);
        const shownItems = visible.reduce((n, v) => n + v.items.length, 0);
        // Only what the search shows can stay ticked, so forgetting never takes what is out of sight.
        everythingShown = visible.flatMap(v => v.items.map(a => ({ id: everythingId(v.p, a), page: v.p, item: a })));
        const shownIds = new Set(everythingShown.map(s => s.id));
        everythingChecked.forEach(id => { if (!shownIds.has(id)) everythingChecked.delete(id); });
        if (!everythingChecked.size) everythingAnchor = null;
        visible.forEach(({ p, items }) => {
            // Pages start closed, and opened while searching; a click turns that round.
            const open = everythingToggled.has(p.key) !== terms.length > 0;
            const head = makeEl('button', { type: 'button', class: 'page-head', role: 'treeitem', 'aria-level': '1', 'aria-expanded': String(open), 'data-key': p.key }, [
                phosphorIcon(open ? 'caret-down' : 'caret-right'),
                makeEl('span', { class: 'page-name' }, [makeEl('span', { class: 'page-host', text: p.host }), makeEl('span', { class: 'page-path', text: p.path })]),
                makeEl('span', { class: 'page-meta', text: `${(() => { const n = items.filter(a => everythingChecked.has(everythingId(p, a))).length; return n ? `${n}/${items.length}` : items.length; })()}${p.time ? ` · ${formatDate(p.time)}` : ''}` })
            ]);
            const section = makeEl('div', { class: 'page', role: 'none' }, [head]);
            if (open) {
                const list = makeEl('div', { class: 'page-items', role: 'group' });
                items.forEach(a => {
                    const ticked = everythingChecked.has(everythingId(p, a));
                    // The focusable link is the treeitem, so its level and selection are announced on focus.
                    const link = makeEl('a', { class: 'item-main', role: 'treeitem', 'aria-level': '2', 'aria-selected': String(ticked), href: a.url, target: '_blank', rel: 'noopener', 'data-key': p.key, 'data-group': a.group },
                        [makeEl('div', { class: 'item-text', id: `rnh-ei-${++everythingItemSeq}`, text: a.text })]);
                    if (a.note) link.appendChild(makeEl('div', { class: 'item-note', text: a.note }));
                    link.appendChild(makeEl('div', { class: 'item-meta', text: [styleLabel(a.key), a.time ? `added ${formatDate(a.time)}` : ''].filter(Boolean).join(' · ') }));
                    link.style.setProperty('--swatch', resolveStyle(a.key, dark).color);
                    // A mouse aid only: keyboard and screen-reader users tick with Space on the treeitem.
                    const check = makeEl('input', { type: 'checkbox', class: 'check', 'data-act': 'check', 'aria-hidden': 'true', tabindex: '-1' });
                    check.checked = ticked;
                    list.appendChild(makeEl('div', { class: 'item', role: 'none' }, [link, check]));
                });
                section.appendChild(list);
            }
            rows.push(section);
        });
        const total = everythingPages.reduce((n, p) => n + p.items.length, 0);
        const ticked = everythingChecked.size;
        syncSelectionButtons(everythingSelectAll, everythingCopy, everythingForget, ticked, shownItems, everythingPagesStep() ? 'Select all on these pages' : '');
        const pagesText = n => `${n} ${n === 1 ? 'page' : 'pages'}`;
        const noun = n => (n === 1 ? 'annotation' : 'annotations');
        if (ticked) {
            const tickedPages = new Set(everythingShown.filter(s => everythingChecked.has(s.id)).map(s => s.page.key)).size;
            setPanelTitle(everythingCount, `${ticked} of ${shownItems}`, ` selected on ${pagesText(tickedPages)}`, noun(shownItems));
        } else if (terms.length) {
            setPanelTitle(everythingCount, `${shownItems} of ${total}`, ` matched on ${pagesText(visible.length)}`, noun(total));
        } else {
            setPanelTitle(everythingCount, String(total), ` found on ${pagesText(everythingPages.length)}`, noun(total));
        }
        if (!rows.length) rows.push(makeEl('div', { class: 'empty', text: total ? 'Nothing matches.' : 'No annotations saved yet.' }));
        everythingList.replaceChildren(...rows);
    }

    everythingFilter.addEventListener('input', () => { everythingToggled = new Set(); renderEverything(); });
    everythingClose.addEventListener('click', closeEverything);
    addLabelTip(everythingSelectAll, 'Select all', '', () => true);
    addLabelTip(everythingCopy, 'Copy selected as Markdown', '', () => true);
    addLabelTip(everythingForget, 'Forget selected annotations', '', () => true);
    // Select all goes in three steps: the pages that already have a tick, then every page shown, then none.
    function everythingPagesStep() {
        const ticked = everythingShown.filter(s => everythingChecked.has(s.id));
        if (!ticked.length || ticked.length === everythingShown.length) return false;
        const pages = new Set(ticked.map(s => s.page.key));
        return everythingShown.some(s => pages.has(s.page.key) && !everythingChecked.has(s.id));
    }
    everythingSelectAll.addEventListener('click', () => {
        const none = everythingSelectAll.dataset.all === 'true';
        const pagesOnly = !none && everythingPagesStep();
        const pages = new Set(everythingShown.filter(s => everythingChecked.has(s.id)).map(s => s.page.key));
        everythingShown.forEach(s => {
            if (none) everythingChecked.delete(s.id);
            else if (!pagesOnly || pages.has(s.page.key)) everythingChecked.add(s.id);
        });
        renderEverything();
    });
    everythingCopy.addEventListener('click', () => {
        const selected = everythingShown.filter(s => everythingChecked.has(s.id));
        if (!selected.length) return;
        writeClipboard(savedMarkdown(selected)).then(
            () => flashCopied(everythingCopy),
            e => { console.warn(`${LOG} could not copy`, e); showToast('Couldn\'t copy', { intent: 'error', icon: 'warning-circle' }); });
    });
    everythingForget.addEventListener('click', () => {
        if (!running) return;
        const selected = everythingShown.filter(s => everythingChecked.has(s.id));
        if (!selected.length) return;
        everythingChecked = new Set();
        forgetSaved(selected);
        everythingPages = savedPages();
        renderEverything();
    });
    // Pressing a button leaves the page's text selection alone, as in the annotations panel.
    everythingEl.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    addLabelTip(everythingClose, 'Close', 'Esc', () => true);
    // Clicking the dimmed page around it closes it.
    everythingEl.addEventListener('mousedown', e => { if (e.target === everythingEl) closeEverything(); });
    // Ticks by the rows on screen, in list order (the rows of a closed page are not on screen).
    function tickEverythingRows(id, shift) {
        const ids = Array.from(everythingList.querySelectorAll('a.item-main')).map(a => `${a.dataset.key}\n${a.dataset.group}`);
        everythingAnchor = tickRows(everythingChecked, ids, everythingAnchor, id, shift);
    }

    // Up and down move between the page rows and the quotes of the open pages; right opens a page and
    // left closes it (or goes from a quote to its page). Shift+arrow ticks the quote it moves to, with the ones between.
    function everythingStops() {
        return Array.from(everythingList.querySelectorAll('button.page-head, a.item-main'));
    }
    function focusEverythingStop(el) {
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'nearest' });
    }
    const stopId = el => `${el.dataset.key}\n${el.dataset.group}`;
    function everythingArrow(e) {
        const stops = everythingStops();
        const at = stops.indexOf(e.target.closest('button.page-head, a.item-main'));
        if (at < 0) return false;
        const el = stops[at], isHead = el.classList.contains('page-head');
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            const next = stops[at + (e.key === 'ArrowDown' ? 1 : -1)];
            if (!next) { if (e.key === 'ArrowUp') everythingFilter.focus(); return true; }
            if (e.shiftKey && !isHead && !next.classList.contains('page-head')) {
                if (!everythingAnchor) tickEverythingRows(stopId(el), false);
                tickEverythingRows(stopId(next), true);
                renderEverything();
                const again = everythingStops().find(s => !s.classList.contains('page-head') && stopId(s) === stopId(next));
                if (again) focusEverythingStop(again);
                return true;
            }
            focusEverythingStop(next);
            return true;
        }
        const open = isHead && el.getAttribute('aria-expanded') === 'true';
        if (e.key === 'ArrowRight' && isHead && !open) { el.click(); return true; }
        if (e.key === 'ArrowRight' && open) { const first = stops[at + 1]; if (first && !first.classList.contains('page-head')) focusEverythingStop(first); return true; }
        if (e.key === 'ArrowLeft' && isHead && open) { el.click(); return true; }
        if (e.key === 'ArrowLeft' && !isHead) {
            const head = stops.slice(0, at).reverse().find(s => s.classList.contains('page-head'));
            if (head) focusEverythingStop(head);
            return true;
        }
        return false;
    }
    everythingFilter.addEventListener('keydown', e => {
        if (e.key !== 'ArrowDown') return;
        const first = everythingStops()[0];
        if (!first) return;
        e.preventDefault();
        focusEverythingStop(first);
    });

    // Space ticks the focused quote; Shift+Space ticks the rows from the last ticked one to it.
    everythingList.addEventListener('keydown', e => {
        if (/^Arrow(Up|Down|Left|Right)$/.test(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey && everythingArrow(e)) { e.preventDefault(); return; }
        const row = e.key === ' ' && !e.altKey && !e.ctrlKey && !e.metaKey ? e.target.closest('a.item-main') : null;
        if (!row) return;
        e.preventDefault();
        const id = stopId(row);
        tickEverythingRows(id, e.shiftKey && !!everythingAnchor);
        renderEverything();
        const again = everythingStops().find(s => !s.classList.contains('page-head') && stopId(s) === id);
        if (again) focusEverythingStop(again);
    });
    everythingList.addEventListener('click', e => {
        const box = e.target.closest('input.check');
        if (box) {
            const link = box.closest('.item').querySelector('a.item-main');
            const id = `${link.dataset.key}\n${link.dataset.group}`;
            if (e.shiftKey && everythingAnchor) tickEverythingRows(id, true);
            else {
                if (box.checked) everythingChecked.add(id); else everythingChecked.delete(id);
                everythingAnchor = id;
            }
            renderEverything();
            return;
        }
        // Once something is ticked, Ctrl or Shift on a quote selects instead of opening it.
        const row = e.target.closest('a.item-main');
        if (row && everythingChecked.size && (e.shiftKey || e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            tickEverythingRows(`${row.dataset.key}\n${row.dataset.group}`, e.shiftKey);
            renderEverything();
            return;
        }
        const head = e.target.closest('.page-head');
        if (head) {
            const key = head.dataset.key;
            const toggle = () => {
                if (everythingToggled.has(key)) everythingToggled.delete(key); else everythingToggled.add(key);
                renderEverything();
                const again = Array.from(everythingList.querySelectorAll('.page-head')).find(h => h.dataset.key === key);
                if (again) again.focus({ preventScroll: true });
                return again;
            };
            // A page's list fades in or out, then the tree re-renders.
            const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
            const list = head.parentElement.querySelector('.page-items');
            if (list && !calm) {
                if (!list.getAnimations().length) fadeList(list, false).finished.then(toggle, toggle);
            } else {
                const again = toggle();
                const grown = again && !calm && again.parentElement.querySelector('.page-items');
                if (grown) fadeList(grown, true);
            }
            return;
        }
        const link = e.target.closest('a.item-main');
        // On this page: scroll to it here, rather than open the page again.
        if (link && link.dataset.key === currentKey && groupWrappers(link.dataset.group).length && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
            e.preventDefault();
            closeEverything();
            jumpToGroup(link.dataset.group, { showNote: true });
        }
    });
    // =====================================================================
    // The sticky menu: a handle, one expand button, then a row of tool buttons
    // =====================================================================

    function menuHiddenHere() {
        const list = readSettings().menuHiddenSites;
        return Array.isArray(list) && list.includes(siteId());
    }

    function setMenuHidden(hidden) {
        const settings = readSettings();
        const sites = new Set(Array.isArray(settings.menuHiddenSites) ? settings.menuHiddenSites : []);
        if (hidden) sites.add(siteId());
        else sites.delete(siteId());
        settings.menuHiddenSites = Array.from(sites);
        GM_setValue(SETTINGS_KEY, JSON.stringify(settings));
    }

    // It lives in a host of its own: stopping the script removes the other panels, not this.
    const menuHost = makeEl('div', { [UI_ATTR]: '' });
    menuHost.style.cssText = 'all: initial !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 0 !important; z-index: 2147483647 !important;';
    const menuRoot = menuHost.attachShadow({ mode: 'closed' });
    const menuHandle = makeEl('div', { class: 'sitemenu-handle', 'aria-hidden': 'true' });
    const menuExpand = makeButton({ icon: phosphorIcon('caret-down') });
    let menuOpen = false;   // not kept: every page starts with the menu collapsed
    const menuClose = makeButton({ icon: phosphorIcon('x') });
    const menuTip = makeEl('div', { class: 'surface tip', role: 'tooltip', hidden: '' });
    let menuTipTimer = null;

    function showMenuTip(button) {
        clearTimeout(menuTipTimer);
        menuTipTimer = setTimeout(() => {
            if (!button.isConnected || menuEl.hidden) return;
            menuTip.replaceChildren(document.createTextNode(button.dataset.label));
            if (button.dataset.shortcut) menuTip.appendChild(makeEl('span', { class: 'kbd', text: button.dataset.shortcut }));
            menuTip.hidden = false;
            const r = button.getBoundingClientRect(), t = menuTip.getBoundingClientRect();
            const below = r.bottom + 8 + t.height <= window.innerHeight;
            menuTip.style.position = 'fixed';
            menuTip.style.left = `${Math.round(Math.min(Math.max(4, r.left + (r.width - t.width) / 2), window.innerWidth - 4 - t.width))}px`;
            menuTip.style.top = `${Math.round(below ? r.bottom + 8 : Math.max(4, r.top - 8 - t.height))}px`;
        }, 250);
    }

    function hideMenuTip() {
        clearTimeout(menuTipTimer);
        menuTip.hidden = true;
    }

    function menuButton(label, shortcut, icon, onClick) {
        const b = makeButton({ icon });
        b.setAttribute('aria-label', shortcut ? `${label} (${shortcut})` : label);
        b.dataset.label = label;
        if (shortcut) { b.dataset.shortcut = shortcut; b.setAttribute('aria-keyshortcuts', shortcut); }
        b.addEventListener('click', () => { hideMenuTip(); onClick(); renderSiteMenu(); });
        b.addEventListener('mouseenter', () => showMenuTip(b));
        b.addEventListener('mouseleave', hideMenuTip);
        b.addEventListener('focus', () => { if (b.matches(':focus-visible')) showMenuTip(b); });
        b.addEventListener('blur', hideMenuTip);
        return b;
    }

    // id, label, shortcut, icon, click, in groups: the modes (shown pressed while on), history, then the views.
    const menuButtons = new Map([
        ['pen', menuButton('Pen', 'Alt+P', phosphorIcon('pencil-simple'), () => togglePen())],
        ['toolbar', menuButton('Selection toolbar', 'Alt+T', phosphorIcon('highlighter'), () => toggleToolbarSwitch())],
        ['keys', menuButton('Shortcuts', 'Alt+Shift+K', phosphorIcon('keyboard'), () => toggleKeysSwitch())],
        ['undo', menuButton('Undo', 'Alt+Z', phosphorIcon('arrow-u-up-left'), () => undoLastAction())],
        ['redo', menuButton('Redo', 'Alt+Y', phosphorIcon('arrow-u-up-right'), () => redoLastAction())],
        ['panel', menuButton('Annotations', 'Alt+O', phosphorIcon('list-bullets'), () => togglePanel())],
        ['search', menuButton('Search all pages', 'Alt+Shift+O', phosphorIcon('magnifying-glass'), () => toggleEverything())],
        ['hide', menuButton('Hide annotations', 'Alt+V', phosphorIcon('eye-slash'), () => toggleAnnotationsHidden())]
    ]);
    addMenuTip(menuExpand, 'Expand');
    addMenuTip(menuClose, 'Hide the menu', 'Alt+Shift+M');

    function addMenuTip(b, label, shortcut) {
        b.setAttribute('aria-label', shortcut ? `${label} (${shortcut})` : label);
        b.dataset.label = label;
        if (shortcut) b.dataset.shortcut = shortcut;
        b.addEventListener('mouseenter', () => showMenuTip(b));
        b.addEventListener('mouseleave', hideMenuTip);
        b.addEventListener('click', hideMenuTip);
    }

    const menuTools = makeEl('div', { class: 'sitemenu-tools' }, [
        makeEl('div', { class: 'sitemenu-inner' }, [...menuButtons.values(), menuClose])
    ]);
    const menuEl = makeEl('div', { class: 'surface sitemenu', role: 'toolbar', 'aria-orientation': 'horizontal', 'aria-label': 'Highlighter', hidden: '' }, [menuHandle, makeEl('div', { class: 'sitemenu-expand' }, [menuExpand]), menuTools]);
    menuRoot.append(makeEl('style', { text: UI_CSS }), menuEl, menuTip);
    ['keydown', 'keyup', 'keypress'].forEach(type => menuHost.addEventListener(type, e => e.stopPropagation()));
    menuEl.addEventListener('mousedown', e => e.preventDefault());
    menuEl.addEventListener('pointerenter', () => renderSiteMenu());

    function renderSiteMenu() {
        const label = menuOpen ? 'Collapse' : 'Expand';
        menuExpand.setAttribute('aria-expanded', String(menuOpen));
        menuExpand.dataset.label = label;
        menuExpand.setAttribute('aria-label', label);
        menuEl.toggleAttribute('data-open', menuOpen);
        menuTools.toggleAttribute('inert', !menuOpen);
        const pressed = { pen: !!penKey, toolbar: !toolbarSwitchedOff(), keys: !keysSwitchedOff() };
        menuButtons.forEach((b, id) => {
            if (id in pressed) b.setAttribute('aria-pressed', String(pressed[id]));
        });
        menuButtons.get('undo').disabled = !undoStack.length;
        menuButtons.get('redo').disabled = !redoStack.length;
        const hideBtn = menuButtons.get('hide');
        hideBtn.dataset.label = annotationsHidden ? 'Show annotations' : 'Hide annotations';
        hideBtn.replaceChildren(phosphorIcon(annotationsHidden ? 'eye' : 'eye-slash'));
        hideBtn.setAttribute('aria-label', `${hideBtn.dataset.label} (Alt+V)`);
        hideBtn.setAttribute('aria-pressed', String(!!annotationsHidden));
        const dark = computeDarkMode();
        menuHost.setAttribute('data-theme', dark ? 'dark' : 'light');
        const hidden = menuHiddenHere();
        menuEl.hidden = hidden;
        if (hidden) { if (menuHost.isConnected) menuHost.remove(); return; }
        if (!menuHost.isConnected) document.documentElement.appendChild(menuHost);
        menuHost.style.setProperty('--dpr', String(window.devicePixelRatio || 1));
        if (!menuEl.style.left) {
            const pos = readSettings().menuPos;
            menuEl.style.left = pos && Number.isFinite(pos.left) ? `${Math.max(0, pos.left)}px` : '12px';
            menuEl.style.top = pos && Number.isFinite(pos.top) ? `${Math.max(0, pos.top)}px` : '12px';
        }
    }

    menuExpand.addEventListener('click', () => { menuOpen = !menuOpen; hideMenuTip(); renderSiteMenu(); });
    menuClose.addEventListener('click', () => { setMenuHidden(true); renderSiteMenu(); refreshMenu(); });

    // Dragging the menu by its handle or edge moves it; the place is kept for every site.
    menuEl.addEventListener('pointerdown', e => {
        if (e.button || e.target.closest('button')) return;
        e.preventDefault();
        const dx = parseFloat(menuEl.style.left) - e.clientX, dy = parseFloat(menuEl.style.top) - e.clientY;
        const move = m => {
            menuEl.style.left = `${Math.max(0, Math.min(window.innerWidth - 40, m.clientX + dx))}px`;
            menuEl.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, m.clientY + dy))}px`;
        };
        menuEl.setPointerCapture(e.pointerId);
        menuEl.addEventListener('pointermove', move);
        menuEl.addEventListener('lostpointercapture', () => {
            menuEl.removeEventListener('pointermove', move);
            const settings = readSettings();
            settings.menuPos = { left: parseFloat(menuEl.style.left), top: parseFloat(menuEl.style.top) };
            GM_setValue(SETTINGS_KEY, JSON.stringify(settings));
        }, { once: true });
    });

    // Alt+Shift+M shows or hides the menu on this site, on every page.
    function toggleSiteMenu() {
        setMenuHidden(!menuHiddenHere());
        renderSiteMenu();
        refreshMenu();
    }
    window.addEventListener('keydown', e => {
        if (e.altKey && e.shiftKey && e.code === 'KeyM' && !e.ctrlKey && !e.metaKey && !e.repeat) {
            e.preventDefault();
            e.stopPropagation();
            toggleSiteMenu();
        }
    }, true);

    // =====================================================================
    // Live sync between tabs: another tab's change to this page shows here at once
    // =====================================================================

    let watchedKey = null;
    let keyListener = null;

    // Follows the storage key of the page being shown (it changes with in-page navigation).
    function watchStoredKey() {
        if (typeof GM_addValueChangeListener !== 'function' || watchedKey === currentKey) return;
        unwatchStoredKey();
        watchedKey = currentKey;
        keyListener = GM_addValueChangeListener(currentKey, onStoredKeyChanged);
    }

    function unwatchStoredKey() {
        if (keyListener !== null && typeof GM_removeValueChangeListener === 'function') {
            try { GM_removeValueChangeListener(keyListener); } catch (e) { /* gone */ }
        }
        keyListener = null;
        watchedKey = null;
    }

    // What an annotation is, wherever it was placed: its pieces' style, text and note.
    function ownerContent(records) {
        return records.map(r => `${r.key}|${r.text}|${r.note || ''}`).sort().join('\n');
    }

    function byOwner(records) {
        const map = new Map();
        records.forEach(r => {
            const owner = recordOwner(r);
            if (!map.has(owner)) map.set(owner, []);
            map.get(owner).push(r);
        });
        return map;
    }

    // Another tab saved this page. Annotations it removed go, the ones it added or changed are
    // placed (or wait for their text, like any saved annotation). The one whose note is being
    // written here stays as it is. An annotation of this tab that the other tab never saw (both
    // saved at once) stays too, and is saved again.
    function onStoredKeyChanged(name, oldRaw, newRaw, remote) {
        if (!remote || !running || nav || name !== currentKey) return;
        const before = new Set((parseRecords(oldRaw) || []).map(recordOwner));
        const incoming = byOwner(parseRecords(newRaw) || []);
        const here = byOwner(getCurrentRecords().concat(pendingRecords));
        const editing = editor ? editor.group : null;
        const drop = new Set();
        const add = [];
        let resave = false;
        here.forEach((records, owner) => {
            if (owner === editing) return;
            const theirs = incoming.get(owner);
            if (!theirs) {
                if (before.has(owner)) drop.add(owner);
                else resave = true;
            } else if (ownerContent(theirs) !== ownerContent(records)) {
                drop.add(owner);
                add.push(...theirs);
            }
        });
        incoming.forEach((records, owner) => {
            knownOwners.add(owner);
            if (!here.has(owner) && owner !== editing) add.push(...records);
        });
        if (drop.size || add.length) {
            // Undo here would bring back what the other tab changed.
            undoStack.length = 0;
            redoStack.length = 0;
            hideToolbar();
            removeGroups(drop);
            const { failed } = renderRecords(add.map(r => ({ ...r })));
            pendingRecords = pendingRecords.concat(failed);
            if (cardWrapper && !cardWrapper.isConnected) hideNoteCard();
            refreshNoteMarks();
            if (failed.length) startLateWatcher();
            scheduleRedraw();
            schedulePanelRefresh();
            scheduleMenuRefresh();
        }
        if (resave) saveHighlights();
    }

    // The toolbar and shortcut switches flipped in another tab apply here too.
    function onSettingsChanged(name, oldRaw, newRaw, remote) {
        if (!remote) return;
        if (toolbarSwitchedOff()) hideToolbar();
        renderSiteMenu();
        refreshMenu();
    }
    // --- Page-wide UI events ---

    function onPointerDown(e) {
        lastPointerType = e.pointerType || 'mouse';
        if (isUiEvent(e)) return;
        pointerIsDown = true;
        hideToolbar();
    }

    function onPointerUp(e) {
        pointerIsDown = false;
        if (isUiEvent(e)) return;
        // The pen draws on mouse selections; on a touch screen the selection is made with handles
        // after the finger lifts, so there the toolbar works as usual.
        if (penKey && e.type === 'pointerup' && e.pointerType !== 'touch') setTimeout(penStroke, 0);
        else scheduleToolbar();
    }

    const SCROLL_LISTENER_OPTIONS = { capture: true, passive: true };   // capture: scrolling containers too
    let uiFrame = 0;
    function onScrollOrResize() {
        if (uiFrame) return;
        uiFrame = requestAnimationFrame(() => {
            uiFrame = 0;
            if (!noteCardEl.hidden) hideNoteCard();
            hideLabelTip();
            if (!toolbarEl.hidden) placeToolbar();
            pinnedCards.forEach((card, m) => { card.style.visibility = isCovered(m.getBoundingClientRect()) ? 'hidden' : ''; });
            if (editor) followEditorAnchor();
        });
    }

    // Closes every panel without saving (used when the page under them changes).
    // `keepRestore`: a "Note not saved · Restore" message stays (undo and redo don't affect it).
    function resetUi({ keepRestore = false } = {}) {
        hideToolbar();
        hideNoteCard();
        unpinNoteCard();
        clearSelectedGroups();
        closeEditor();
        if (!(keepRestore && toastKeep)) hideToast();
        hoveredWrapper = null;
    }

    // =====================================================================
    // Start / stop (the per-site switch turns the whole script on and off)
    // =====================================================================

    function start() {
        if (running) return;
        running = true;

        const head = document.head || document.documentElement;
        [pageStyle, hideStyle, textColorStyle].forEach(s => head.appendChild(s));
        darkMode = null;
        updateTextColorCss();

        lastHref = location.href;
        settledCanonical = lastSeenCanonical = canonicalKey();
        currentKey = settledCanonical || urlKey(location.href);
        resetPageTracking();

        listen(document, 'selectionchange', updateSelectionVisibility);
        listen(document, 'mousedown', onSelectionPress, true);
        listen(document, 'mouseup', updateSelectionVisibility, true);
        listen(document, 'dragend', updateSelectionVisibility, true);   // a drag of the selected text ends without a mouseup
        // On window, in the capture phase: the earliest point a page script can listen, so a
        // site's own key handlers can't swallow the shortcuts first.
        listen(window, 'keydown', onKeyDown, true);
        listen(window, 'keyup', onKeyUpOrPress, true);
        listen(window, 'keypress', onKeyUpOrPress, true);
        listen(window, 'blur', releaseAccessKeys);
        teardown.push(releaseAccessKeys);
        listen(document, 'mousedown', onMouseDown);
        listen(document, 'mouseover', onMouseOver, true);
        listen(document, 'mouseout', onMouseOut, true);
        listen(document, 'mousemove', onMouseMove, { capture: true, passive: true });
        listen(document, 'selectionchange', scheduleToolbar);
        listen(document, 'selectionchange', onSelectionForGroup);
        listen(document, 'mousedown', onSelectMouseDown, true);
        listen(document, 'click', onDocumentClick, true);
        listen(document, 'pointerdown', onPointerDown, true);
        listen(document, 'pointerup', onPointerUp, true);
        listen(document, 'pointercancel', onPointerUp, true);
        listen(window, 'scroll', onScrollOrResize, SCROLL_LISTENER_OPTIONS);
        listen(window, 'resize', onScrollOrResize);
        listen(window, 'resize', scheduleRedraw);
        listen(window, 'load', scheduleRedraw);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => { if (running) scheduleRedraw(); }).catch(() => {});
        }
        if (typeof ResizeObserver === 'function') {
            const ro = new ResizeObserver(scheduleRedraw);
            ro.observe(document.documentElement);
            teardown.push(() => ro.disconnect());
        }
        teardown.push(watchPageStyle());

        listen(window, 'popstate', onUrlMaybeChanged);
        listen(window, 'hashchange', onUrlMaybeChanged);
        if (window.navigation && typeof window.navigation.addEventListener === 'function') {
            listen(window.navigation, 'navigatesuccess', () => setTimeout(onUrlMaybeChanged, 0));
        }
        listen(document, 'visibilitychange', onVisibilityChange);
        const poll = setInterval(() => { onUrlMaybeChanged(); checkDetached(); pruneShown(); notePanelChanges(); }, 1000);
        teardown.push(() => clearInterval(poll));

        watchTheme();
        teardown.push(unwatchStoredKey);

        if (document.readyState === 'loading') listen(document, 'DOMContentLoaded', scheduleRestore);
        else scheduleRestore();
    }

    // Takes every annotation off the page and stops all activity. Storage is untouched, but for
    // the highlight of a new note still being written (see dropUnwrittenNote).
    function stop() {
        if (!running) return;
        dropUnwrittenNote();
        running = false;
        teardown.splice(0).forEach(fn => { try { fn(); } catch (e) { /* already gone */ } });
        stopLateWatcher();
        clearTimeout(reclaimTimer);
        if (nav) { clearTimeout(nav.timer); nav = null; }
        clearTimeout(restoreTimer);
        clearTimeout(redrawTimer);
        cancelAnimationFrame(redrawFrame); redrawFrame = 0;
        resetUi();
        closePanel();
        closeEverything();
        jumpGroup = null;
        setPen(null);
        uiHost.remove();
        selectHost.remove();
        unwrapAll();
        resetPageTracking();
        unmarkSelected();
        pendingRecords = [];
        undoStack.length = 0;
        redoStack.length = 0;
        setAnnotationsHidden(false);
        [pageStyle, hideStyle, textColorStyle].forEach(s => s.remove());
    }

    function clearAllSaved() {
        if (typeof GM_listValues !== 'function' || typeof GM_deleteValue !== 'function') {
            console.warn(`${LOG} GM_listValues/GM_deleteValue not granted; cannot bulk-clear storage.`);
            return;
        }
        if (!confirm('This deletes every Highlighter annotation saved for every site. Your per-site on/off choices are kept. Continue?')) return;
        GM_listValues().forEach(k => { if (k !== SETTINGS_KEY) GM_deleteValue(k); });
        if (running) {
            resetUi();
            closeEverything();
            stopLateWatcher();
            pendingRecords = [];
            undoStack.length = 0;
            redoStack.length = 0;
            unwrapAll();
            resetPageTracking();
            schedulePanelRefresh();
            refreshMenu();
        }
        alert('Deleted all saved annotations.');
    }

    // =====================================================================
    // Menu
    // =====================================================================

    let menuIds = [];
    let menuLabels = '';          // the labels registered now, one per line
    let menuTimer = null;

    // After every save (see saveHighlights), and when a page is restored: the counts may have changed.
    function scheduleMenuRefresh() {
        if (menuTimer) return;
        menuTimer = setTimeout(() => { menuTimer = null; refreshMenu(); }, 300);
    }

    // Grouped as: look and copy, switches, then what deletes (the page's, then every page's).
    // Labels are verb first, counts as in the toasts ("Clear 2 annotations"). The command to
    // forget missing annotations is there only when some are missing. The commands are
    // registered again only when a label changes. A manager that can't take a command back
    // keeps the first set, with fixed labels; its commands check the current state.
    function refreshMenu() {
        if (typeof GM_registerMenuCommand !== 'function') return;
        const canRelabel = typeof GM_unregisterMenuCommand === 'function';
        if (menuIds.length && !canRelabel) return;
        const items = [];
        const shown = running || !canRelabel;
        if (shown) {
            items.push(['Show annotations', () => { if (running) openPanel(); }]);
            items.push(['Search all pages', () => { if (running) openEverything(); }]);
            items.push(['Copy as Markdown', () => copyAnnotations()]);
        }
        if (ENABLE_SELECTION_TOOLBAR && shown) {
            items.push([!canRelabel ? 'Turn toolbar on/off'
                : toolbarSwitchedOff() ? 'Turn toolbar on' : 'Turn toolbar off',
                () => { if (running) toggleToolbarSwitch(); }]);
        }
        if (shown) {
            items.push([!canRelabel ? 'Turn shortcut keys on/off'
                : keysSwitchedOff() ? 'Turn shortcut keys on' : 'Turn shortcut keys off',
                () => { if (running) toggleKeysSwitch(); }]);
        }
        if (shown) {
            if (!canRelabel) {
                items.push(['Forget missing annotations', forgetMissingAnnotations]);
                items.push(['Clear this page', clearPageAnnotations]);
            } else {
                const { total } = pageCounts();
                const missing = countAnnotations(missingRecords());
                if (missing) items.push([`Forget ${annotationsText(missing)} not found`, forgetMissingAnnotations]);
                if (total) items.push([`Clear ${annotationsText(total)} on this page`, clearPageAnnotations]);
            }
        }
        items.push([menuHiddenHere() ? 'Show the menu' : 'Hide the menu', toggleSiteMenu]);
        items.push(['Delete all saved annotations…', clearAllSaved]);

        const labels = items.map(([label]) => label).join('\n');
        if (menuIds.length && labels === menuLabels) return;
        menuIds.forEach(id => { try { GM_unregisterMenuCommand(id); } catch (e) { /* gone */ } });
        menuIds = items.map(([label, fn]) => GM_registerMenuCommand(label, fn));
        menuLabels = labels;
    }

    // =====================================================================
    // Boot
    // =====================================================================

    if (typeof GM_addValueChangeListener === 'function') GM_addValueChangeListener(SETTINGS_KEY, onSettingsChanged);
    start();
    renderSiteMenu();
    refreshMenu();
})();
