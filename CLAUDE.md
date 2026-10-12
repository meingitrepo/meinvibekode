# meinvibecode

- `rough-notation/RoughNotationHighlighter.user.js` is a built file (its @updateURL points at it). Edit `rough-notation/src/*.js` instead, then run `node build.js` in `rough-notation/` and commit both; `node build.js --check` must say "up to date".
- The parts in `src/` are joined as-is, in the order of `PARTS` in `build.js`; together they form one IIFE (`config.js` opens it, `start-and-boot.js` closes it), so every part shares one scope.
- Plans and what has shipped: `rough-notation/ROADMAP.md`. Bump `@version` in `src/header.js` for each release.
