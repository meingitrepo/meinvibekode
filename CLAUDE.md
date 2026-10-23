# CLAUDE.md (Meinvibecode)

Product: Violentmonkey userscript `highlighter/Highlighter.user.js`. Windows only (Chrome/Edge/Firefox). Repo: meingitrepo/meinvibekode.

## Working rules
- Plan first. Ask Mhmd for any missing detail in one short batched question. Never assume anything unnecessary. Do only what is asked, nothing extra.
- Never push, open PRs or make branches on your own. Finish, commit locally, show the result, ask "Reply PUSH to push it to main." Only the word PUSH authorises a push. Never force-push main.
- After PUSH run ONE Bash call: `highlighter/release.sh "Theme" "What's in it" "Commit message"`. Never bump @version, commit the built file by hand. On conflict: keep BOTH sides, rerun related tests, rerun the script, mention the merged-in change. After pushing just say it's pushed.
- One task per thread; new thread per follow-up/revert. Open-ended "find problems" asks: one ranking thread that fixes nothing, then one short thread per item Mhmd picks.
- Economy: batch independent commands in one Bash call, no subagents, at most one review pass, status updates at milestones only.
- UI/Fluent design: vanilla Fluent 2, no library; references https://github.com/microsoft/fluentui and https://storybooks.fluentui.dev/react/

## Invariants (violating these is expensive)
- Edit only `highlighter/src/*.js`, then `node build.js` in `highlighter/`; `node build.js --check` must say "up to date". Never edit the built .user.js.
- Keep storage key `rnh:settings` and page keys unchanged (renaming loses saved data). Never change @namespace.

## Reading
- Grep src/ first, read only the line ranges needed. Never read the built .user.js or all of src.

## Tests
- `node highlighter/test/run.js <word>` (Playwright 1.56.1 + Chromium, `NODE_PATH=/opt/node22/lib/node_modules`).
- Run only suites related to the change; no full run before PUSH.
- Before asking PUSH on a behaviour change, grep `highlighter/test` for the changed feature/keys/colors; update tests expecting old behaviour; remove checks for retired behaviour rather than skipping.
- CI runs only a quick gate on every push (`node build.js --check` + `node --check` on the built file, seconds). The full Playwright suite is local-only (CI run was ~2 min per push).

## Automation candidates
- At the end of every reply, flag any step you repeated in the task or that recurs across tasks and costs tokens (rebases, builds, test runs, screenshots, version bumps, greps for the same thing, etc.) as a candidate for a script like `release.sh`, with a one-line script idea. Don't build it unasked; Mhmd picks.
- Scripts in `highlighter/tools/`: `build.sh` (build+check), `map-check.sh` (Map vs build.js), `tests-for.sh <keyword>` (find and run suites mentioning it; sets NODE_PATH), `stale-checks.sh <old-term>` (test lines for retired behaviour), `preflight.sh` (build, diffstat, release.sh line), `shot.sh <out.png> [light|dark] [js]` (playground screenshot). Use them instead of redoing these steps by hand.

## Map (`highlighter/src/`, joined in `build.js` order; one IIFE, so later files see earlier names)
Core
- `header` metadata block, user notes
- `config` opens the IIFE; attrs, colors, timings, limits
- `page-css-and-state` page CSS, shared state, `listen`
- `theme` dark-page detection, annotation colors
- `strokes` line/strike drawing and metrics

Anchoring and storage
- `text-anchoring` blocks, XPath, text offsets, loose matching
- `wrappers` wrap/unwrap, wrapper bookkeeping, text selection marks
- `storage` page identity, records, `rnh:settings`, per-site switch
- `restore` restore, late content, missing annotations

Behaviour
- `navigation-and-selection` SPA navigation, word-snapped selections
- `apply-and-undo` apply/remove annotations, undo/redo
- `input` keyboard shortcuts
- `notes` group ids, times, note text

UI
- `ui-style` `makeEl`, Fluent icons, tokens, `UI_CSS`
- `ui-elements` shadow root, buttons, panel placement
- `toolbar` selection toolbar and tooltips
- `pen` Alt+P
- `note-card-and-editor` hover card, note editor
- `toast-and-jump` toast, Alt+J/K
- `annotation-select` click-select (dashed box)
- `markdown` Copy as Markdown
- `panel` Alt+O
- `search` all pages, Alt+Shift+O

Runtime
- `live-sync` changes from other tabs
- `start-and-boot` page events, start/stop, menu, boot
