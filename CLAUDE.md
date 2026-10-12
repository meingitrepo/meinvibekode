# meinvibecode

- `rough-notation/RoughNotationHighlighter.user.js` is a built file (its @updateURL points at it). Edit `rough-notation/src/*.js` instead, then run `node build.js` in `rough-notation/` and commit both; `node build.js --check` must say "up to date".
- The parts in `src/` are joined as-is, in the order of `PARTS` in `build.js`; together they form one IIFE (`config.js` opens it, `start-and-boot.js` closes it), so every part shares one scope.
- Plans and what has shipped: `rough-notation/ROADMAP.md`. Bump `@version` in `src/header.js` for each release.
- The repo is private, so Violentmonkey updates come from a secret gist: `.github/workflows/gist-mirror.yml` copies the built file there on each push to main and rewrites its @updateURL/@downloadURL to the gist (secrets `GIST_TOKEN`, `GIST_ID`). The header's raw.githubusercontent URLs are only what the repo copy says.
