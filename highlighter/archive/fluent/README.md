# Fluent 2 version (archived)

The Highlighter UI was styled after Fluent 2 up to version 8.144. It was replaced by the
Anthropic style (see DESIGN.md-based `src/ui-style.js`).

Nothing here is built or run: `build.js` only reads `src/`, `test/run.js` only reads `test/`.

- `ui-style.js`: the Fluent `src/ui-style.js` as of 8.144.
- `test/`: the Fluent-specific suites.
- Git tag `fluent-final` points at the last commit with the Fluent UI in every file.

To restore: `git checkout fluent-final -- highlighter/src highlighter/test`, then `node build.js` in `highlighter/`.
