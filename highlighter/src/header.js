// ==UserScript==
// @name         Highlighter
// @namespace    Violentmonkey Scripts
// @version      9.39
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
// @grant        GM_info
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

