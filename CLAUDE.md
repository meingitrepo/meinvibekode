# CLAUDE.md (Meinvibecode)

Product: Violentmonkey userscript `highlighter/Highlighter.user.js`. Windows only (Chrome/Edge/Firefox). Repo: meingitrepo/meinvibecode (private).

## Working rules
- Plan first. Ask Mhmd for any missing detail in one short batched question. Never assume anything unnecessary. Do only what is asked, nothing extra.
- Never push, open PRs or make branches on your own. Finish, commit locally, show the result, ask "Reply PUSH to push it to main." Only the word PUSH authorises a push. Never force-push main.
- After PUSH run ONE Bash call: `highlighter/release.sh "Theme" "What's in it" "Commit message"`. Never bump @version, commit the built file by hand. On conflict: keep BOTH sides, rerun related tests, rerun the script, mention the merged-in change. After pushing just say it's pushed.
- One task per thread; new thread per follow-up/revert. Open-ended "find problems" asks: one ranking thread that fixes nothing, then one short thread per item Mhmd picks.
- Economy: batch independent commands in one Bash call, no subagents, at most one review pass, status updates at milestones only.

## Invariants (violating these is expensive)
- Edit only `highlighter/src/*.js`, then `node build.js` in `highlighter/`; `node build.js --check` must say "up to date". Never edit the built .user.js.
- Keep storage key `rnh:settings` and page keys unchanged (renaming loses saved data). Never change @namespace.
- Don't "fix" raw URLs in `src/header.js`: `.github/workflows/gist-mirror.yml` rewrites them for the gist.
- The mirror fails if the built file changes without a higher @version; release.sh handles it.

## Lessons
- Read `highlighter/LESSONS.md` in full at thread start (kept short on purpose).
- At the end of a task, if something non-obvious cost time or tokens, propose ONE line for it to Mhmd. Add it only if he approves, in the same local commit as the task, so it ships with the next PUSH (no separate push). Never add task logs or release notes there.

## Reading
- Grep src/ first, read only the line ranges needed. Never read the built .user.js or all of src.

## Tests
- `node highlighter/test/run.js <word>` (Playwright 1.56.1 + Chromium, `NODE_PATH=/opt/node22/lib/node_modules`).
- Run only suites related to the change; no full run before PUSH.
- Before asking PUSH on a behaviour change, grep `highlighter/test` for the changed feature/keys/colors; update tests expecting old behaviour; remove checks for retired behaviour rather than skipping.
- CI runs only a quick gate on every push (`node build.js --check` + `node --check` on the built file, seconds) and the mirror `needs` it. The full Playwright suite is local-only (CI run was ~2 min per push).
