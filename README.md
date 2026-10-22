# meinvibecode

Small tools built for personal use.

## Highlighter

[`highlighter/Highlighter.user.js`](highlighter/Highlighter.user.js)
is a userscript that lets you highlight, underline, strike through and leave notes on the text of any
web page. The marks are drawn by the script itself (it started out on [rough-notation](https://roughnotation.com/)), and they are saved,
so they come back the next time you open the page.

### Install

1. Install a userscript manager such as [Violentmonkey](https://violentmonkey.github.io/) or
   [Tampermonkey](https://www.tampermonkey.net/).
2. Open the [raw script](https://raw.githubusercontent.com/meingitrepo/meinvibekode/main/highlighter/Highlighter.user.js)
   and confirm the install. Installed copies update from the same URL on the manager's next update check.

### Use

Select some text, then press a shortcut or use the small toolbar that appears centered above the selection.
Shortcuts use Alt plus a key. They match the physical key, so they also work on macOS and non-Latin
keyboard layouts.

| Shortcut | Action |
| --- | --- |
| Alt+H or Alt+1 | Yellow highlight |
| Alt+2 / Alt+4 | Green / pink highlight |
| Alt+U | Underline |
| Alt+S | Strike through |
| Alt+N | Add or edit a note |
| Alt+Backspace or Alt+Delete | Remove annotations from the selected text, or the annotation under the mouse |
| Alt+Shift+Backspace or Alt+Shift+Delete | Remove every annotation on the page |
| Alt+V | Hide or show all annotations |
| Alt+T | Selection toolbar off or on, for every site |
| Alt+P | Pen on or off |
| Alt+O | Open or close the annotations panel |
| Alt+Shift+O | Search the annotations saved on every page |
| Alt+J / Alt+K | Jump to the next / previous annotation |
| Alt+Z | Undo |
| Alt+Shift+Z or Alt+Y | Redo |

Applying the style the selected text already has removes that annotation, all of it; the toolbar shows
that style pressed. Applying a style to a selection that overlaps an annotation of that style extends
the annotation. A different style goes on top of what is there: a highlight keeps an underline over
it, and overlapping highlights share the line in bands, one per color. Alt+Backspace (or the toolbar's
eraser) removes annotations from exactly the selected text: what is left of them stays, with its note.
On Linux, browsers use Alt+digit to switch tabs, so use Alt+H there for highlighting.

With nothing selected, the shortcuts act on the annotation under the mouse (or, failing that, the one
you just jumped to with Alt+J or Alt+K). A style shortcut changes its style and keeps its note; its own
style removes it, and so does Alt+Backspace.

Clicking an annotation selects it, with a dashed outline that follows its text, and shows the toolbar
over it. Ctrl+click (Cmd+click) adds another one or takes it out; Shift+click selects every annotation
from the last one selected to the one clicked. While annotations are selected, the style keys restyle
them, N edits the first one's note and Backspace or Delete removes them, with or without Alt. Esc,
clicking elsewhere or selecting text lets them go. A link inside annotated text still just opens.

Annotations saved in blue or orange, which the toolbar and keys no longer offer, still draw.

Alt+V hides every annotation, and a message says so, with a Show button. Alt+V again, or any change
to the annotations, shows them.

Alt+P turns on the pen: every selection you make with the mouse gets the pen's style straight away,
with no shortcut or toolbar. It starts with the style you used last; a style shortcut with nothing
selected (and no annotation under the mouse) switches it. A pill at the top of the page shows the pen's
style. Esc, Alt+P or the pill's button turns it off. Text that already has the pen's style is left as
it is.

Spaces at the edges of a selection are left out, and a word the selection cuts in two is annotated
whole, in languages written without spaces too. Triple-click selects the paragraph under the pointer
as it is shown on the page.

The toolbar is a single Tab stop: once it has focus, the arrow keys (and Home and End) move between its
buttons, and Enter or Space presses one. In the note editor, Tab and Shift+Tab go round its controls
instead of leaving it.

Removing annotations or a note shows a short message in the bottom-right corner with an Undo button.
A note closed without saving (by clicking elsewhere or pressing Esc) can be brought back with the
Restore button in the message that appears.

An annotation with a note has a small red tick in its top-right corner. Rest the pointer on it to read
the note, under the line you are pointing at, with the date it was added and buttons to edit or delete
the note. Web addresses in a note are links there.

### Reviewing annotations

Alt+O opens a panel listing every annotation on the page, in reading order, with its note and the
date it was added. Click one to scroll to it; the buttons beside it edit its note or delete it. The
filter box searches text and notes, so `#tags` written in notes work as tags. Saved annotations whose
text can't be found on the page are listed under "Not found on the page": forget them, or select the
text they belong to and choose "Attach to selection".

Alt+Shift+O (or "Search all saved annotations" in the userscript menu) shows the annotations saved on
every page, pages with the newest annotations first. Click a page to see its quotes and notes; click a
quote to open that page at the passage. The search box finds quotes, notes (and `#tags`) and site names
across every page.

If some of a page's annotations still can't be found 15 seconds after it opens, a message says how
many ("3 of 12 annotations couldn't be found"), once per page. Its Show button opens the panel at
"Not found on the page".

Alt+J and Alt+K jump to the next and previous annotation, flash it and show its note. Alt+N then edits
the note of the annotation you jumped to.

The panel's Copy button (or the menu's "Copy annotations as Markdown") copies the page's title and link,
then each annotation as a quote with its note below it. Each quote links to its passage on the page
(`#:~:text=...`), which browsers that support text fragments open scrolled to that text. With a filter
in the panel, only the annotations it shows are copied.

The userscript manager's menu can also:

- open the annotations panel, or copy the page's annotations as Markdown,
- clear the annotations on the current page ("Clear 12 annotations on this page"),
- forget saved annotations whose text no longer exists on the page ("Forget 3 annotations not
  found", shown only when some are missing),
- turn the script off (or back on) for the current site,
- clear every saved annotation.

### How annotations are saved

Annotations are stored per page in the userscript manager's storage. When a page declares a canonical
URL (`<link rel="canonical">`), that URL is the key, so one article reached through different links
(tracking parameters, mobile or AMP versions) shares its annotations. Pages that share a canonical URL
without being the same page (the pages of a forum thread, often) share the list, but each annotation
remembers the page it was made on: elsewhere it isn't counted as missing, and the panel lists it
under "Saved on other pages".

An annotation is found again when the text around it changed a little: different capitals, spacing,
or a word or two. Text that loads late, such as comments or "load more", gets its annotations whenever
it appears while the page is open. Background tabs wait until you look at them.

When a site redraws part of the page, the annotations there stay saved and come back once their text
is back on the page. Two tabs showing the same page show each other's changes at once: new
annotations, removals, restyles and notes.

### Customize

Edit the **Configuration** section near the top of the script (in the repository, `highlighter/src/config.js`):

- `STYLES` sets each style's color, shortcut and drawing options.
- `DARK_OVERRIDES` replaces those values for annotations on a dark background (a dark page, or a dark
  box on a light one). Its highlights (dark gold for yellow, deep orange, ...) are dark enough for
  light text.
- Where a highlight leaves the page's text hard to read (white text on yellow, say: under
  `MIN_TEXT_CONTRAST`), the text turns dark or light by itself. A style's `textColor` overrides that.
- `ENABLE_SELECTION_TOOLBAR` and `ENABLE_TRIPLE_CLICK_BLOCK_SELECT` turn those features off, and
  `SNAP_SELECTION_TO_WORDS` turns off taking a cut-off word whole.

Saved annotations remember the name of their style (`h`, `h2`, `u`, ...). Renaming or removing a style
hides the annotations made with it. They stay saved and come back when the style does.

### Changing the code

`Highlighter.user.js` is built from the files in `highlighter/src/`, one per part of the
script, joined in the order listed in `highlighter/build.js`. Edit those files, run `node build.js` in
`highlighter/` (Node, no packages needed), and commit both. `node build.js --check` says whether the
built file is up to date.

The tests are in `highlighter/test/`, one `*.test.js` file per feature, each driving the built script
in headless Chromium. `node highlighter/test/run.js` runs all of them (`run.js panel note` runs only the
files whose names contain those words) and also fails when the built file is out of date. They need
Playwright with Chromium: `npm install --no-save playwright@1.56.1 && npx playwright install chromium`
in `highlighter/test/`. The same command runs in the Action on every push and pull request.
