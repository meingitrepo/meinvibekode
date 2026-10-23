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
- Scripts in `highlighter/tools/`: `build.sh` (build+check), `tests-for.sh <keyword>` (find and run suites mentioning it; sets NODE_PATH), `stale-checks.sh <old-term>` (test lines for retired behaviour), `preflight.sh` (build, diffstat, release.sh line), `shot.sh <out.png> [light|dark] [js]` (playground screenshot). Use them instead of redoing these steps by hand.

## Map (`highlighter/src/`, concatenated in `build.js` order; all one IIFE, so later files see earlier names)
header (metadata) → config (IIFE open, limits, colors) → page-css-and-state (page CSS, shared state) → theme (dark-page detection) → strokes (line/strike drawing) → text-anchoring (blocks, XPath, offsets, loose matching) → wrappers (wrap/unwrap) → storage (page identity, records, `rnh:settings`) → restore (restore, late content) → navigation-and-selection (SPA nav, selections) → apply-and-undo (apply/remove, undo/redo) → input (shortcuts) → notes (group ids, times) → ui-style (makeEl, icons, tokens, CSS) → ui-elements (shadow root, panel placement) → toolbar (selection toolbar) → pen (Alt+P) → note-card-and-editor (hover card, editor) → toast-and-jump (toast, Alt+J/K) → annotation-select (click-select) → markdown (Copy as Markdown) → panel (Alt+O) → search (all pages, Alt+Shift+O) → live-sync (other tabs) → start-and-boot (page events, start/stop, menu, boot).
