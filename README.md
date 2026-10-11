# meinvibecode

Small tools built for personal use.

## RoughNotation Highlighter

[`rough-notation/RoughNotationHighlighter.user.js`](rough-notation/RoughNotationHighlighter.user.js)
is a userscript that lets you highlight, underline, strike through and leave notes on the text of any
web page. The marks are hand-drawn by [rough-notation](https://roughnotation.com/), and they are saved,
so they come back the next time you open the page.

What shipped in each version and what is planned next is in [`rough-notation/ROADMAP.md`](rough-notation/ROADMAP.md).

### Install

1. Install a userscript manager such as [Violentmonkey](https://violentmonkey.github.io/) or
   [Tampermonkey](https://www.tampermonkey.net/).
2. Open the
   [raw script](https://raw.githubusercontent.com/meingitrepo/meinvibecode/main/rough-notation/RoughNotationHighlighter.user.js)
   and confirm the install.

The script updates itself from this repository's `main` branch, so anything merged there reaches
installed copies on the manager's next update check.

### Use

Select some text, then press a shortcut or use the small toolbar that appears beside the selection.
Shortcuts use Alt plus a key. They match the physical key, so they also work on macOS and non-Latin
keyboard layouts.

| Shortcut | Action |
| --- | --- |
| Alt+H or Alt+1 | Yellow highlight |
| Alt+2 / 3 / 4 / 5 | Green / blue / pink / orange highlight |
| Alt+U | Underline |
| Alt+S | Strike through |
| Alt+N | Add or edit a note |
| Alt+Backspace or Alt+Delete | Remove annotations in the selection |
| Alt+Shift+Backspace or Alt+Shift+Delete | Remove every annotation on the page |
| Alt+V | Hide or show all annotations |
| Alt+O | Open or close the annotations panel |
| Alt+J / Alt+K | Jump to the next / previous annotation |
| Alt+Z | Undo |
| Alt+Shift+Z or Alt+Y | Redo |

Applying the same style to a selection inside an existing annotation removes that style. Applying it
to a selection that overlaps an annotation of that style extends the annotation, and changing an
annotation's style keeps its note. On Linux, browsers use Alt+digit to switch tabs, so use Alt+H there
for highlighting.

Removing annotations or a note shows a short message in the bottom-right corner with an Undo button.
A note closed without saving (by clicking elsewhere or pressing Esc) can be brought back with the
Restore button in the message that appears.

An annotation with a note has a small red tick in its top-right corner. Hover over it to read the note
and the date it was added.

### Reviewing annotations

Alt+O opens a panel listing every annotation on the page, in reading order, with its note and the
date it was added. Click one to scroll to it; the buttons beside it edit its note or delete it. The
filter box searches text and notes, so `#tags` written in notes work as tags. Saved annotations whose
text can't be found on the page are listed under "Not found on the page": forget them, or select the
text they belong to and choose "Attach to selection".

Alt+J and Alt+K jump to the next and previous annotation, flash it and show its note. Alt+N then edits
the note of the annotation you jumped to.

The panel's Copy button (or the menu's "Copy annotations as Markdown") copies the page's title and link,
then each annotation as a quote with its note below it. Each quote links to its passage on the page
(`#:~:text=...`), which browsers that support text fragments open scrolled to that text. With a filter
in the panel, only the annotations it shows are copied.

The userscript manager's menu can also:

- open the annotations panel, or copy the page's annotations as Markdown,
- clear the annotations on the current page,
- forget saved annotations whose text no longer exists on the page,
- turn the script off (or back on) for the current site,
- clear every saved annotation.

### How annotations are saved

Annotations are stored per page in the userscript manager's storage. When a page declares a canonical
URL (`<link rel="canonical">`), that URL is the key, so one article reached through different links
(tracking parameters, mobile or AMP versions) shares its annotations. Pages that load their content
late are retried for a while after the page opens.

When a site redraws part of the page, the annotations there stay saved and come back once their text
is back on the page. Two tabs showing the same page keep each other's new annotations.

### Customize

Edit the **Configuration** section near the top of the script:

- `STYLES` sets each style's color, shortcut and drawing options.
- `DARK_OVERRIDES` replaces those values for annotations on a dark background (a dark page, or a dark
  box on a light one).
- `ENABLE_SELECTION_TOOLBAR` and `ENABLE_TRIPLE_CLICK_BLOCK_SELECT` turn those features off.

Saved annotations remember the name of their style (`h`, `h2`, `u`, ...). Renaming or removing a style
hides the annotations made with it. They stay saved and come back when the style does.

### Optional hardening

The script loads rough-notation 0.5.1 from unpkg. If your userscript manager supports integrity hashes
(Tampermonkey does), you can append this hash to the `@require` URL:

```
#sha256-+QqgCQ42H/SGlLdOAxnhCYVt7LPnV8KA3+JeNgfzX6w=
```
