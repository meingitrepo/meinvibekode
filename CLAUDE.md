# CLAUDE.md (Meinvibecode)

Product: Violentmonkey userscript `highlighter/Highlighter.user.js`. Windows only (Chrome/Edge/Firefox). Repo: meingitrepo/meinvibekode.

## Invariants (violating these is expensive)
- Edit only `highlighter/src/*.js`, then `node build.js` in `highlighter/`; `node build.js --check` must say "up to date". Never edit the built .user.js.
- Adding, renaming or removing a file in `src/`: update the src map below in the same commit.
- Keep storage key `rnh:settings` and page keys unchanged (renaming loses saved data). Never change @namespace.
- Reading: pick the file from the src map below, grep it, read only the line ranges needed. Never read the built .user.js or all of src.

## src map (`highlighter/src/`, concatenated by build.js in its own order)
- Boot/state: `header.js` (userscript header), `config.js`, `page-css-and-state.js`, `start-and-boot.js` (page-wide events), `navigation-and-selection.js` (SPA URL changes)
- Storage: `storage.js` (page identity, `rnh:settings`), `live-sync.js` (cross-tab), `restore.js`
- Annotations: `apply-and-undo.js`, `strokes.js` (SVG drawing), `wrappers.js` (wrapper bookkeeping), `text-anchoring.js` (XPath/offsets), `annotation-select.js`, `pen.js`
- Notes/export: `notes.js`, `note-card-and-editor.js`, `markdown.js`
- UI: `ui-style.js` (tokens/CSS), `ui-elements.js`, `theme.js`, `toolbar.js`, `site-menu.js`, `panel.js`, `search.js` (Alt+Shift+O), `toast-and-jump.js`, `input.js`

## Tiers (pick one before starting, state it in one line; method background in `docs/METHOD.md`, read only when asked)
- T0 no behaviour change (copy, comment, constant): do it, one verify call, no test, no review.
- T1 bug or tweak in one area: 2-4 line plan (cause or goal, files/functions, the proving test, risk), test first, then fix. No review.
- T2 feature across files: written spec (`superpowers:brainstorming` + `agent-skills:spec-driven-development`, saved to `docs/specs/<topic>.md`, committed with the change: goal, done criteria, constraints, boundaries), `superpowers:writing-plans`, thin slices. One review only if big.
- T3 risky (stored-data shape, injected HTML, page-wide listeners, restore-on-load): T2 plus the matching agent-skills gate below. The one review is a fresh-context doubt pass (`agent-skills:doubt-driven-development`) on the plan before building, plus five-axis review of the diff (`agent-skills:code-review-and-quality`).

## Guardrails (before every commit)
- Scan the diff for a lowered bar: new suppressions, skipped/deleted/loosened assertions, stubs, edited thresholds. Report it; never hide it.
- A red test means the code is wrong until proven otherwise; a test never seen failing proves nothing.
- Stop signs: "too simple to test", "tests after", "just this once", "the test is wrong".

## Workflow
- Superpowers: follow `superpowers:using-superpowers`, with these overrides. Brainstorming and writing-plans scale by tier (see Tiers). `superpowers:subagent-driven-development` only for large plans, `superpowers:requesting-code-review` only for big features. Never invoke `superpowers:using-git-worktrees` or `superpowers:finishing-a-development-branch` (they conflict with the no-branches rule below). Build in thin slices (one `verify.sh` per slice).
- `agent-skills` fills gaps only (Superpowers stays primary; never use its `using-agent-skills`, workflow, git or CI skills): `security-and-hardening` for page content, storage or injected HTML; `performance-optimization` for page-wide listeners or restore-on-load; `deprecation-and-migration` for any stored-data shape change; `code-simplification` on big changes before PUSH; `constraint-driven-development` when Mhmd asks to set or enforce a quality bar (it writes CONSTRAINTS.md).
- Ask Mhmd for any missing detail in one short batched question. Do only what is asked, nothing extra.
- Never push, open PRs or make branches on your own. Finish, commit locally, show the result, ask "Reply PUSH to push it to main." Only the word PUSH authorises a push. Never force-push main.
- After PUSH run ONE Bash call: `TIER=T0|T1|T2|T3 highlighter/tools/release.sh "Theme" "What's in it" "Commit message"`. Never bump @version or commit the built file by hand. On conflict: keep BOTH sides, rerun related tests, rerun the script, mention the merged-in change. After pushing, reply only with the script's PUSHED and METRICS lines (METRICS is also appended to the git-ignored `.cache/metrics.tsv`: date, version, tier, push attempts, cycle time, diffstat). Mhmd reviews that log to judge whether a tier is too heavy or too light.
- One task per thread; new thread per follow-up/revert. Open-ended "find problems" asks: one ranking thread that fixes nothing, then one short thread per item Mhmd picks.
- Economy: fewer turns is the main saving. Chain build, test and diffstat in one Bash call (`tools/verify.sh <keyword>`), batch independent commands, subagents allowed when Superpowers calls for them, review only per tier, status updates at milestones only.

## Tests
- `highlighter/tools/test-env.sh <word>` runs the suites (same arguments as `node highlighter/test/run.js`). Playwright 1.56.1 + Chromium come from the main checkout's git-ignored `.cache/playwright/` (shared by worktrees, installed on first use); on Linux/cloud it uses `/opt/node22`.
- Tests first for T1+ (`superpowers:test-driven-development`). Never edit a test afterwards just to match the code. Report pre-existing failures; never silently rewrite them.
- Run only suites related to the change; no full run before PUSH (exception: tasks about the tests themselves).
- A suite that reports 0 checks crashed. Report it even if untouched.
- Before asking PUSH on a behaviour change, grep `highlighter/test` for the changed feature/keys/colors; update tests expecting old behaviour; remove checks for retired behaviour rather than skipping.
- CI runs only a quick gate per push (`node build.js --check` + `node --check` on the built file). The full Playwright suite is local-only.

## UI / Anthropic style
- Screenshots: send them only when Mhmd asks. Never add before/after or showcase shots by default. When asked, crop to the changed component (`SHOT_CLIP`), never a whole-window shot; the same crop for before/after and light/dark.
- Look (since 9.0): Anthropic style, no library. Tokens in `src/ui-style.js` are named by role (`--ink*`, `--surface*`, `--line*`, `--accent*` = clay, only for the one primary action); serif for reading text, sans for chrome; flat with hairlines, no shadows; short ease-out fades. Icons: Phosphor Light. `test/anthropic-style.test.js` guards this.
- Visual bug (spacing, widths, colors): reproduce it first with a test (or `shot.sh` for your own check), at the trigger named in the brief (device pixel ratio, zoom, dark mode, high contrast). If the first attempt does not reproduce it, stop and ask in one short question; don't loop.

## Scripts (`highlighter/tools/`; use them instead of redoing these steps by hand)
- `build.sh` build+check; `tests-for.sh <keyword>` find and run suites mentioning it; `stale-checks.sh <old-term>` test lines for retired behaviour
- `sync.sh` rebase onto latest origin/main, rebuild, report conflicts/overlap; `preflight.sh` sync, diffstat, release.sh line; `release.sh` post-PUSH release
- `film.sh <out-prefix> [light|dark] <js> [frames] [gap-ms]` captures animation frames of the playground; source `test-env.sh` to only set the Playwright env
- `verify.sh <keyword...>` build, matching suites, diffstat in one call; `shot.sh <out.png> [light|dark|both] [js]` playground screenshot; component presets (panel, all) crop to the element at 2x, other shots: `SHOT_CLIP=<selector|__hl.name>` (+`SHOT_PAD`)

## Automation candidates
- Only when a repeated step would cut significant manual work or tokens across threads, end the reply with one terse line suggesting a script like `release.sh` (with the idea). Skip one-liners and trivial wrappers. If nothing qualifies, say nothing, not even "none".