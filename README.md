# meinvibekode

Small tools built for personal use.

## Highlighter

[`highlighter/Highlighter.user.js`](highlighter/Highlighter.user.js) is a userscript that lets you
highlight, underline, strike through and add notes to the text of any web page. Annotations are saved
and come back the next time you open the page.

### Install

1. Install a userscript manager such as [Violentmonkey](https://violentmonkey.github.io/) or
   [Tampermonkey](https://www.tampermonkey.net/).
2. Open the [script](https://raw.githubusercontent.com/meingitrepo/meinvibekode/main/highlighter/Highlighter.user.js)
   and confirm the install. It updates from the same URL.

### Use

Select text, then press a shortcut or use the toolbar that appears above the selection. Shortcuts are
Alt plus the physical key, so they work on any keyboard layout.

| Shortcut | Action |
| --- | --- |
| Alt+1 / Alt+2 | Cyan / magenta highlight |
| Alt+3 or Alt+H | Yellow highlight |
| Alt+U / Alt+S | Underline / strike through |
| Alt+N | Add or edit a note |
| Alt+D | Delete the note of the annotation under the mouse (then the annotation), or remove annotations from the selected text |
| Alt+Shift+D | Remove every annotation on the page |
| Alt+V | Hide or show all annotations |
| Alt+P | Pen on or off: every selection gets the pen's style |
| Alt+T | Selection toolbar off or on |
| Alt+J / Alt+K | Jump to the next / previous annotation |
| Alt+O | Annotations panel for this page |
| Alt+Shift+O | Search the annotations saved on every page |
| Alt+Z | Undo |
| Alt+Shift+Z or Alt+Y | Redo |
| Alt+Shift+K | Shortcut keys off or on (the sites get their Alt keys back) |

With nothing selected, the style keys act on the annotation under the mouse (or the one you just
jumped to). Clicking an annotation selects it; Ctrl+click adds or removes one and Shift+click selects a
range. While annotations are selected, the style keys restyle them, N edits a note and D removes them.
Esc lets them go.

An annotation with a note has a small mark in its corner; rest the pointer on it to read the note.
Removing annotations shows a message with an Undo button. A note closed without saving can be brought
back with Restore.

### Panels

Alt+O lists the annotations on the page in reading order, with notes. Click one to scroll to it. Tick
several to copy them as Markdown or erase them together. The filter box searches text and notes, so
`#tags` in notes work. Annotations whose text can't be found on the page are listed separately: forget
them, or select the text they belong to and choose "Attach to selection".

Alt+Shift+O searches the annotations saved on every page; click a quote to open that page at the passage.

The userscript manager's menu can also copy the page's annotations as Markdown, clear or forget them,
turn the toolbar or shortcut keys off, turn the script off for a site, and delete everything saved.

### How annotations are saved

Annotations are stored per page in the userscript manager's storage, keyed by the page's canonical URL
when it has one. They are found again after small changes to the text, and come back when a site
redraws the page. Tabs showing the same page stay in sync.

### Customize

Edit the **Configuration** section at the top of the script (in the repository,
`highlighter/src/config.js`): `STYLES` (colors, shortcuts, drawing), `DARK_OVERRIDES` (colors on dark
backgrounds), and the switches `ENABLE_SELECTION_TOOLBAR`, `ENABLE_TRIPLE_CLICK_BLOCK_SELECT` and
`SNAP_SELECTION_TO_WORDS`. Annotations are saved under their style's name (`h`, `h2`, `u`, ...), so
renaming or removing a style hides its annotations until it comes back.

### Changing the code

Edit the files in `highlighter/src/`, then run `node build.js` in `highlighter/` to rebuild
`Highlighter.user.js` (`node build.js --check` says whether it is up to date). Tests are in
`highlighter/test/`; `node highlighter/test/run.js <word>` runs the suites whose names contain the word
(they need Playwright with Chromium).
