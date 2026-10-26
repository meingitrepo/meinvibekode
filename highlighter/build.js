#!/usr/bin/env node
// Builds Highlighter.user.js, the file userscript managers install, by joining the
// files in src/ in the order below. Edit src/, then run `node build.js`; commit both.
// `node build.js --check` only checks that the built file matches src/ (exit code 1 if not).
'use strict';
const fs = require('fs');
const path = require('path');

const PARTS = [
    'header.js',                    // metadata block and the notes for users
    'config.js',                    // opens the IIFE; styles, colors, timings, limits
    'page-css-and-state.js',
    'theme.js',                     // dark page detection, colors of annotated text
    'strokes.js',                   // straight-line drawing, strike-through metrics
    'text-anchoring.js',            // blocks, XPath, text offsets, text index, loose matching
    'wrappers.js',                  // wrapper bookkeeping, wrapping and unwrapping
    'storage.js',                   // page identity, records, storage, per-site switch
    'restore.js',                   // restoring, late content, missing annotations
    'navigation-and-selection.js',  // SPA navigation, cleaner selections, triple-click
    'apply-and-undo.js',            // applying and removing annotations, undo and redo
    'input.js',                     // keyboard shortcuts
    'notes.js',
    'ui-style.js',                  // makeEl, Phosphor icons, theme tokens, UI_CSS
    'ui-elements.js',               // the shadow root and its elements, panel placement
    'toolbar.js',                   // selection toolbar and its tooltips
    'pen.js',                       // Alt+P: every mouse selection annotated at once
    'note-card-and-editor.js',
    'toast-and-jump.js',            // toast, Alt+J / Alt+K
    'annotation-select.js',         // clicking an annotation selects it (dashed box)
    'markdown.js',                  // the page's annotations, Copy as Markdown
    'panel.js',                     // annotations panel (Alt+O)
    'search.js',                    // every page's annotations (Alt+Shift+O)
    'site-menu.js',                 // the sticky menu: this site's switch and its tools
    'live-sync.js',                 // other tabs' changes to this page, as they happen
    'start-and-boot.js',            // page-wide UI events, start / stop, menu, boot
];

const dir = __dirname;
const built = PARTS.map(name => {
    const text = fs.readFileSync(path.join(dir, 'src', name), 'utf8');
    if (!text.endsWith('\n')) throw new Error(`src/${name} must end with a newline`);
    return text;
}).join('');
const listed = new Set(PARTS);
const unlisted = fs.readdirSync(path.join(dir, 'src')).filter(f => f.endsWith('.js') && !listed.has(f));
if (unlisted.length) throw new Error(`not in PARTS: ${unlisted.join(', ')}`);

const out = path.join(dir, 'Highlighter.user.js');
if (process.argv.includes('--check')) {
    const same = fs.existsSync(out) && fs.readFileSync(out, 'utf8') === built;
    console.log(same ? 'up to date' : 'Highlighter.user.js differs from src/: run node build.js');
    process.exit(same ? 0 : 1);
}
fs.writeFileSync(out, built);
console.log(`wrote ${path.relative(process.cwd(), out) || out} (${built.split('\n').length - 1} lines)`);
