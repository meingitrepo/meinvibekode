# Highlighter roadmap

What has shipped, and what is planned next, in order. Sizes are estimates: S is under 80 lines, M is 80 to 250, L is over 250. The plan comes from a review of v7.26 (new features, behaviour changes, visual design), with each claim checked against the code; points marked **verified** were reproduced in headless Chromium.

The code lives in `src/` and `build.js` joins it into `Highlighter.user.js` (see the README). Since 7.31 the files are split by part of the script, so a change usually means reading one or two of them.

## Shipped

| Version | Theme | What's in it |
|---|---|---|
| 7.26 | Speed | Faster saving and restoring, a memory leak fixed |
| 7.27 | Nothing gets lost | Annotations survive sites redrawing a paragraph; a colour change keeps the note and extending a highlight merges it; two tabs merge their saves instead of overwriting; dark colours are chosen from the background behind each annotation (no more magenta on white pages in OS dark mode); "Note not saved · Restore" toast and a blue Save while there are unsaved changes; Undo toasts for remove, clear, forget and note delete; annotations of an unknown style are kept |
| 7.28 | Reviewing what you marked | Alt+O annotations panel (scroll, flash, edit, delete, filter by text or `#tag`, "Not found" with Forget and Attach to selection); Alt+J / Alt+K jump to next/previous; Copy as Markdown with `#:~:text=` links; "Added on" dates |
| 7.29 | Polish | The selected text's style shows as pressed in the toolbar ("Remove yellow highlight", "Edit note"); the note tick has an edge in the text's colour and grows with the font; the toolbar sits where the selection ends and stays on screen; selections lose their edge spaces and snap to whole words (`Intl.Segmenter`, switch: `SNAP_SELECTION_TO_WORDS`), and triple-click takes the paragraph as shown; the same style again removes the whole annotation, while the eraser removes exactly the selection and keeps the rest with its note; the 7.27 leftovers (toast theme next to the panel, removal wording, focus after the toast button, gradient backgrounds in dark detection, a bare highlight left on SPA navigation) |
| 7.30 | Annotations that come back | Saved annotations are found again when the text around them changed a little (capitals, spacing, a word), by scoring each place their text appears, with a minimum score and a clear winner; late content (comments, "load more") gets its annotations whenever it arrives, with a light watcher (at most every 2 s, paused in background tabs, whose first 15 s window waits until the tab is shown); once per page, "3 of 12 annotations couldn't be found · Show" opens the panel at "Not found"; each annotation remembers its page where pages share a canonical URL, so another page's annotations aren't missing, cleared or forgotten here (the panel lists them under "Saved on other pages"); menu labels with counts, "Forget N annotations not found" only when some are |
| 7.31 | Pointing instead of selecting | With nothing selected, a style shortcut restyles the annotation under the mouse (or the one just jumped to) and keeps its note; its own style, or Alt+Backspace, removes it; Alt+V says "Annotations hidden · Show"; "Forget N annotations not found" works again while a note is being written |
| 7.32 | Pen and note card | Alt+P pen: every mouse selection gets the pen's style at once, shown by a pill at the top (Esc turns it off; a style key with nothing selected switches it); the note card waits 300 ms, opens under the line being pointed at, and has Delete next to Edit |
| 7.33 | Readable colours and keyboard | Dark mode: dark gold instead of magenta for yellow, a deeper orange (both about 4.5:1 with light text), light green and red for underline and strike-through; text turns dark or light by itself where its highlight leaves it under 3:1; the toolbar is one Tab stop with arrow keys, and Tab stays inside the note editor |
| 7.34 | Everything saved, and links | Alt+Shift+O (and the menu) shows every page's annotations, newest page first, each opening to its quotes and notes; one search box covers quotes, notes and site names; a quote opens its page at the passage (on this page it scrolls there); web addresses in notes are links in the note card |
| 7.35 | Toolbar back over the selection | The selection toolbar is centered above the selection again (below it on touch screens), flipping to the other side when there is no room and staying on screen for selections taller than the window; 7.29's placement at the point where the selection ended felt awkward |
| 7.36 | Red underline | Underline and strikethrough both draw in soft red (#EF5350) in light and dark themes, replacing green underline and pure red strikethrough (Mhmd's edit) |
| 7.37 | Toolbar scrolls with the selection | Once the selection scrolls out of the window, the toolbar goes with it, staying at the selection's top or bottom center instead of waiting at the window's edge |
| 7.38 | Toolbar on/off key | Alt+T (or the menu) switches the selection toolbar off and on for every site, remembered across pages and tabs; the style keys keep working while it is off |
| 7.39 | Click to select an annotation | Clicking an annotation draws a dashed box around all of it; while selected, a style key (with or without Alt) restyles it, Delete or Backspace removes it with Undo, N edits its note, and Esc, clicking elsewhere or selecting text lets it go. Links and controls inside annotated text still work as before |
| 7.40 | Shorter toolbar-off message | Switching the selection toolbar off now just says "Selection toolbar off." |
| 7.41 | Toolbar on a selected annotation | Clicking an annotation also shows the selection toolbar over its dashed box: a style restyles it (its own style, shown pressed, removes it), the note button edits its note, the eraser removes it with Undo. Alt+T's off switch covers it too |
| 7.42 | Several annotations at once | Ctrl+click (Cmd+click) adds an annotation to the selection or takes it out; Shift+click selects every annotation from the last one selected to the one clicked. The toolbar and keys restyle or remove all of them as one Undo step, and N edits the first one's note. The selection box is black now, white on dark pages |
| 7.43 | Live sync between tabs | Another open tab's change to the same page shows at once: new annotations appear, removed ones go, restyles and notes update, and Clear empties every tab. Undo history in the other tabs is dropped then, so Undo can't bring back what another tab changed. An annotation whose note is being written keeps its local version until saved. Turning the script off or on for a site applies to that site's open tabs too |
| 7.44 | Own drawing, no library | Annotations are drawn by the script itself as straight SVG strokes; rough-notation is no longer loaded (no `@require`). It looks the same, with one stroke per line instead of two for highlights. Drawing is batched (every annotation measured, then all drawn), so restoring 300 annotations takes about 120 ms instead of 180 ms and a window resize lays the page out 20 times instead of about 900 |
| 7.45 | New name | The script is called Highlighter now that it no longer uses rough-notation: folder `highlighter/`, file `Highlighter.user.js`, and `data-highlighter-*` attributes on the page. Saved annotations and settings are kept, and installed copies update in place |
| 7.46 | Annotations stay visible under a selection | Selecting annotated text no longer hides the annotation. An underline or strike-through is blended into the selection (darker on a light page, lighter on a dark one), and a highlight shows faintly through a slightly see-through selection, so you can see where it starts and ends while trimming or restyling |
| 7.47 | Selected lines turn white | Instead of blending: the part of an underline or strike-through under a selection takes the selected text's color (white, usually), and an underline moves just inside the selection. A highlight gets the browser's normal selection again, and shows outside it |
| 7.48 | Selected highlights like Edge's PDF viewer | A selected highlight mixes its color with a light tint of the selection color and keeps its text color, as in Edge's PDF viewer. Underlines now sit just inside the bottom of the text, so a selection covers them whole |
| 7.49 | Plain selection over highlights again | 7.48's tint over selected highlights is gone: the selection looks the same everywhere. Underlines stay inside the text box, and selected lines still turn white |
| 7.50 | Annotations follow zoom and resize at once | While the window is resized or zoomed, annotations on screen are redrawn in the same frame instead of 150 ms after it stops, so they no longer trail behind their text |
| 7.51 | Thinner lines, outlined selected highlights | Underline and strike-through are 1px. Under a selection a highlight's color is hidden (it mixed differently with see-through selections for each color) and the selected part gets a thin outline in the selected text's color instead, the same for every color |
| 7.52 | Enter saves notes, fewer colors | In the note editor Enter saves and Shift+Enter starts a new line (was Ctrl+Enter). Blue and orange highlights are no longer offered (toolbar, Alt+3, Alt+5); annotations already saved in them still draw |
| 7.53 | Annotations share text | A new style on annotated text goes on top of what is there instead of replacing it: a highlight keeps an underline or strikethrough over it, and where highlights overlap the line is split into bands, one per colour (yellow on top). Its own style again still removes it, the eraser still clears everything, and changing a clicked annotation's style still recolours it |

## Next, roughly in order

Item numbers stay the same when other items ship.

| # | Idea | What you'd see | Size |
|---|---|---|---|
| 3 | **Site switch and shortcuts** | "Pause shortcuts and toolbar on this site" (annotations still show); `www.x.com` and `x.com` as one site; Alt+Shift+digit as an alias for Linux. | S |
| 6 | **Undo that lasts longer** | History kept per page while the tab is open; Alt+Shift+Backspace gets the Undo toast and a "Restore cleared annotations" menu item that works after a reload. | M |
| 9 | **High contrast and reduced motion** | System colours in forced-colors mode, no animation with reduced motion, one 300 ms highlight stroke. | S |
| 13 | **Toolbar on a phone** | **Verified:** at 360px the touch toolbar runs off the edge. The five colours collapse into one split button on touch screens. Only matters on a phone. | M |
| 14 | **Backup and restore** | Export all annotations to JSON; import with Merge or Replace. Violentmonkey's own backup already covers script data. | M |

Ranked lower: a scrollbar minimap of annotations (M); box and margin-bracket marks (M); a settings panel for colours and shortcuts (L).

## Accepted limitations

Known trade-offs of tab merging (7.27), mostly gone since 7.43 keeps open tabs in sync:

- Two tabs editing the same annotation at the same moment (or one writing its note): the last save wins.
- Overlapping annotations made in two tabs at the same moment get cut.
- Redrawn text whose context changed waits until reload.

And of 7.30's page tags: where pages share a canonical URL, an annotation belongs to the exact address it was made on (minus tracking parameters). Opened through another address of the same article (an extra `?ref=`, say), it is still placed, but if its text is gone it is listed under "Saved on other pages" rather than "Not found", and isn't counted as missing.

## Worth keeping as is

- The compact 24px buttons and the Edge-style toolbar.
- Straight strokes with square ends; round ends on a stroke this thick stick out over neighbouring words.
- Opaque highlights behind the text. Multiply blending fixes some banners but turns yellow green on blue-tinted boxes.
- Under a selection, lines take the selected text's color (7.47) and selected highlights are outlined, their color hidden (7.50). Any change to the selection's own colors over highlights (7.46 tint, 7.48 Edge PDF style mix) was disliked.
- The red tick as the only note marker.
- "Only Save saves" in the note editor, with the Restore toast as a safety net.
- The closed shadow root and the createElement-only UI.
