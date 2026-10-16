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
    const NOTE_FOCUS_ATTR = 'data-highlighter-note-focus'; // on that piece while its annotation alone is selected
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
    const TOOLBAR_IDLE_MS = 4000;               // the selection toolbar fades out after this long untouched (0 = never)
    const TOAST_MS = 4000;                      // how long a message stays up,
    const TOAST_ACTION_MS = 6000;               // or one with a button such as Undo (pointing at it keeps it)
    const NOTE_STYLE_KEY = 'h';                 // style given to plain text that receives a note
    const NOTE_MAX_LENGTH = 2000;
    const NOTE_MIN_LINES = 2;                   // the note box starts this tall,
    const NOTE_MAX_LINES = 6;                   // grows with the text up to this, then scrolls
    const NOTE_BADGE_SIZE = 10;                 // px, at least; the speech-bubble badge on annotations with a note,
    const NOTE_BADGE_EM = 0.6;                  // which grows with the font (0.6em: 10px at 16px, 19px on a 32px heading)
    const NOTE_BADGE_COLOR = '#000000';         // black, like the click-select dashed outline,
    const NOTE_BADGE_DARK_COLOR = '#FFFFFF';    // and white on dark backgrounds
    const NOTE_BADGE_FOCUS_COLOR = '#0F6CBD';      // Fluent's blue while its annotation alone is selected (its note
    const NOTE_BADGE_FOCUS_DARK_COLOR = '#479EF5'; // card open), its lighter tint on dark: no highlight or line is blue
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

