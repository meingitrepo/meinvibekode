# CLAUDE.md (Meinvibecode)

Product: Violentmonkey userscript `highlighter/Highlighter.user.js`. Windows only (Chrome/Edge/Firefox). Repo: meingitrepo/meinvibekode.

## Invariants (violating these is expensive)
- Edit only `highlighter/src/*.js`, then `node build.js` in `highlighter/`; `node build.js --check` must say "up to date". Never edit the built .user.js.
- Keep storage key `rnh:settings` and page keys unchanged (renaming loses saved data). Never change @namespace.
- Reading: grep src/ first, read only the line ranges needed. Never read the built .user.js or all of src.

## Workflow
- Superpowers: invoke the real skills with the Skill tool (`superpowers:<name>`), not just the methodology. New feature or behaviour change: `superpowers:brainstorming`, then `superpowers:writing-plans`, then `superpowers:executing-plans` (or `superpowers:subagent-driven-development` for large plans), with `superpowers:test-driven-development` for every code change. Bugs: `superpowers:systematic-debugging`. Before asking PUSH: `superpowers:verification-before-completion`, and `superpowers:requesting-code-review` for big features. Small fixes may skip brainstorming and writing-plans (2-4 line plan, cause or goal, files/functions, the proving test, risk). Never invoke `superpowers:using-git-worktrees` or `superpowers:finishing-a-development-branch` (they conflict with the no-branches rule below). Build in thin slices (one `verify.sh` per slice).
- Ask Mhmd for any missing detail in one short batched question. Never assume anything unnecessary. Do only what is asked, nothing extra.
- Never push, open PRs or make branches on your own. Finish, commit locally, show the result, ask "Reply PUSH to push it to main." Only the word PUSH authorises a push. Never force-push main. Say nothing about commit or push state.
- After PUSH run ONE Bash call: `highlighter/tools/release.sh "Theme" "What's in it" "Commit message"`. Never bump @version or commit the built file by hand. On conflict: keep BOTH sides, rerun related tests, rerun the script, mention the merged-in change. After pushing just say it's pushed.
- One task per thread; new thread per follow-up/revert. Open-ended "find problems" asks: one ranking thread that fixes nothing, then one short thread per item Mhmd picks.
- Economy: fewer turns is the main saving. Chain build, test and diffstat in one Bash call (`tools/verify.sh <keyword>`), batch independent commands, subagents allowed when Superpowers calls for them, at most one review pass, status updates at milestones only.

## Tests
- `node highlighter/test/run.js <word>` (Playwright 1.56.1 + Chromium, `NODE_PATH=/opt/node22/lib/node_modules`).
- Tests first (Superpowers TDD): for any behaviour change, write the test first and run it to see it fail, then implement, then run it to see it pass. Never edit a test afterwards just to match the code. Report pre-existing failures; never silently rewrite them.
- Run only suites related to the change; no full run before PUSH (exception: tasks about the tests themselves).
- A suite that reports 0 checks crashed. Report it even if untouched.
- Before asking PUSH on a behaviour change, grep `highlighter/test` for the changed feature/keys/colors; update tests expecting old behaviour; remove checks for retired behaviour rather than skipping.
- CI runs only a quick gate per push (`node build.js --check` + `node --check` on the built file). The full Playwright suite is local-only.

## UI / Fluent
- Screenshots: take or send them only when Mhmd asks. Never add before/after or showcase shots by default. When asked, crop to the changed component (`SHOT_CLIP`), never a whole-window shot; the same crop for before/after and light/dark.
- Vanilla Fluent 2, no library. References: https://github.com/microsoft/fluentui and https://storybooks.fluentui.dev/react/. Before building or changing UI, look up the real Fluent v9 component, don't guess.
- Lookup order: saved notes in `/mnt/project-files/fluent/` first; then source in microsoft/fluentui `packages/react-components/react-<name>` (raw.githubusercontent.com or sparse clone); then the Storybook rendered with Playwright (plain fetch gets no content; check it's reachable, the network may block it). Save new findings to `/mnt/project-files/fluent/`.
- Visual bug (spacing, widths, colors): reproduce it first with a test (or `shot.sh` for your own check; don't send the shot unless asked), at the trigger named in the brief (device pixel ratio, zoom, dark mode, high contrast). If the first attempt does not reproduce it, stop and ask in one short question; don't loop.

## Scripts (`highlighter/tools/`; use them instead of redoing these steps by hand)
- `build.sh` build+check; `tests-for.sh <keyword>` find and run suites mentioning it; `stale-checks.sh <old-term>` test lines for retired behaviour
- `sync.sh` rebase onto latest origin/main, rebuild, report conflicts/overlap; `preflight.sh` sync, diffstat, release.sh line; `release.sh` post-PUSH release
- `verify.sh <keyword...>` build, matching suites, diffstat in one call; `shot.sh <out.png> [light|dark|both] [js]` playground screenshot; component presets (panel, all) crop to the element at 2x, other shots: `SHOT_CLIP=<selector|__hl.name>` (+`SHOT_PAD`)

## Automation candidates
- Only when a repeated step would cut significant manual work or tokens across threads, end the reply with one terse line suggesting a script like `release.sh` (with the idea). Skip one-liners and trivial wrappers. If nothing qualifies, say nothing, not even "none". Don't build it unasked; Mhmd picks.
