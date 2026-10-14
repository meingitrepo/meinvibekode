# meinvibecode

- `highlighter/Highlighter.user.js` is a built file (its @updateURL points at it). Edit `highlighter/src/*.js` instead, then run `node build.js` in `highlighter/` and commit both; `node build.js --check` must say "up to date".
- The parts in `src/` are joined as-is, in the order of `PARTS` in `build.js`; together they form one IIFE (`config.js` opens it, `start-and-boot.js` closes it), so every part shares one scope.
- Plans and what has shipped: `highlighter/ROADMAP.md`. Bump `@version` in `src/header.js` for each release.
- The repo is private, so Violentmonkey updates come from a secret gist: `.github/workflows/gist-mirror.yml` copies the built file there on each push to main that changes it, once the tests pass, and rewrites its @updateURL/@downloadURL to the gist (secrets `GIST_TOKEN`, `GIST_ID`). It also writes the same file as `RoughNotationHighlighter.user.js`, the gist name before 7.45, so copies installed from that URL still update. The header's raw.githubusercontent URLs are only what the repo copy says.
- Tests: `node highlighter/test/run.js` (Playwright 1.56.1 + Chromium; `run.js word` runs only matching files). Run the files related to a change; the gist-mirror Action runs all of them on every push and PR touching `highlighter/`, and on main publishes to the gist only when they pass. Remove checks for retired behaviour rather than skipping them.
