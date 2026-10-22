# Highlighter roadmap

What has shipped, and what is planned next, in order. Sizes are estimates: S is under 80 lines, M is 80 to 250, L is over 250. The plan comes from a review of v7.26 (new features, behaviour changes, visual design), with each claim checked against the code; points marked **verified** were reproduced in headless Chromium.

The code lives in `src/` and `build.js` joins it into `Highlighter.user.js` (see the README). Since 7.31 the files are split by part of the script, so a change usually means reading one or two of them. The tests are in `test/` (see the README).

## Shipped

See ROADMAP-SHIPPED.md.

## Next, roughly in order

Only Windows (Chrome, Edge, Firefox) is in scope since 8.4: no Mac, Linux or phone-only work.

Item numbers stay the same when other items ship.

| # | Idea | What you'd see | Size |
|---|---|---|---|
| 3 | **Site switch and shortcuts** | "Pause shortcuts and toolbar on this site" (annotations still show); `www.x.com` and `x.com` as one site. | S |
| 6 | **Undo that lasts longer** | History kept per page while the tab is open; Alt+Shift+Backspace gets the Undo toast and a "Restore cleared annotations" menu item that works after a reload. | M |
| 9 | **High contrast** | Annotations in system colours when a Windows contrast theme is on (forced-colors mode); the panels already follow it. | S |
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
- The note badge (8.13) as the only note marker.
- "Only Save saves" in the note editor, with the Restore toast as a safety net.
- The closed shadow root and the createElement-only UI.
