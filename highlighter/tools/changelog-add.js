#!/usr/bin/env node
// Adds one release line under the CHANGELOG-ENTRIES marker in src/changelog.js (Alt+Shift+W shows them).
// Usage: node changelog-add.js <version> "<what's in it>"   (release.sh calls it)
'use strict';
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'changelog.js');
const [ver, what] = process.argv.slice(2);
const src = fs.readFileSync(file, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
const marker = /^.*CHANGELOG-ENTRIES.*$/m;
if (!ver || !what || !marker.test(src)) { console.error('usage: changelog-add.js <version> "<what>" (marker missing?)'); process.exit(1); }
fs.writeFileSync(file, src.replace(marker, m => m.replace(/\r$/, '') + eol + `        [${JSON.stringify(ver)}, ${JSON.stringify(what)}],`));
