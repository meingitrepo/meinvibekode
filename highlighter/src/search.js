    // --- Everything saved (Alt+Shift+O): every page's annotations, searchable ---

    // A full-page overlay: a search box and the pages with annotations, most recently annotated
    // first. Each page opens to its quotes and notes; a quote opens its page at that passage
    // (in a new tab; on this page it scrolls to it). Read from storage each time it opens.
    let everythingPages = [];
    let everythingToggled = new Set();   // pages opened by a click (closed by one, while searching)
    let everythingReturnFocus = null;
    let everythingAnchor = null;         // the row ticked last, for Shift+click
    let everythingChecked = new Set();   // ticked annotations, as `${page key}\n${group}`
    let everythingShown = [];            // [{ id, page, item }]: what the search shows, in every page, open or not

    // [{ key, url, host, path, time, items: [{ group, key, note, time, text, url }] }], newest first.
    function savedPages() {
        if (typeof GM_listValues !== 'function') return [];
        const pages = [];
        GM_listValues().forEach(k => {
            if (k === SETTINGS_KEY) return;
            const records = readRecords(k);
            if (!records || !records.length) return;
            const byGroup = new Map();
            records.forEach(r => {
                if (!hasOwn(STYLES, r.key)) return;
                const group = recordOwner(r);
                let a = byGroup.get(group);
                if (!a) {
                    a = { group, key: r.key, records: [], note: '', time: groupTime(group) || r.added || null, page: r.page ? r.page : k };
                    byGroup.set(group, a);
                }
                a.records.push(r);
                if (!a.note && r.note) a.note = r.note;
            });
            const items = Array.from(byGroup.values()).map(a => {
                const text = a.records.map(r => r.text || '').join(' ').replace(/\s+/g, ' ').trim();
                const directive = textDirective({ paragraphs: [text] }, '', new Map());
                return { group: a.group, key: a.key, note: a.note, time: a.time, text, url: `${a.page}${a.page.includes('#') ? '' : '#'}:~:${directive}` };
            }).filter(a => a.text);
            if (!items.length) return;
            let host = k, path = '';
            try { const u = new URL(k); host = u.hostname.replace(SITE_PREFIX_RE, ''); path = pagePath(k); } catch (e) { /* not a URL: shown as is */ }
            pages.push({ key: k, host, path, items, time: Math.max(0, ...items.map(a => a.time || 0)) });
        });
        return pages.sort((a, b) => b.time - a.time || a.key.localeCompare(b.key));
    }

    function openEverything() {
        if (!running) return;
        const dark = computeDarkMode();
        ensureUi(dark);
        everythingEl.setAttribute('data-theme', dark ? 'dark' : 'light');
        if (everythingEl.hidden) {
            const focused = document.activeElement;
            everythingReturnFocus = focused && focused !== document.body && focused !== uiHost ? focused : null;
            hideToolbar();
            hideNoteCard();
            everythingFilter.value = '';
            everythingToggled = new Set();
            everythingChecked = new Set();
        }
        everythingPages = savedPages();
        everythingEl.hidden = false;
        renderEverything();
        everythingFilter.focus({ preventScroll: true });
    }

    function closeEverything() {
        if (everythingEl.hidden) return;
        hideLabelTip();
        releaseFocus(everythingEl);
        everythingEl.hidden = true;
        everythingList.replaceChildren();
        everythingPages = [];
        everythingChecked = new Set();
        everythingShown = [];
        const back = everythingReturnFocus;
        everythingReturnFocus = null;
        if (back && back.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
    }

    function toggleEverything() {
        if (everythingEl.hidden) openEverything();
        else closeEverything();
    }

    const everythingId = (p, a) => `${p.key}\n${a.group}`;

    // The ticked annotations as Markdown: each page's address as a heading, then its quotes
    // linked to their passages, with their notes.
    function savedMarkdown(selected) {
        const byPage = new Map();
        selected.forEach(s => { if (!byPage.has(s.page)) byPage.set(s.page, []); byPage.get(s.page).push(s.item); });
        const out = [];
        byPage.forEach((items, p) => {
            out.push(`${out.length ? '\n' : ''}## [${markdownText(p.host + p.path)}](${markdownUrl(p.key)})`);
            items.forEach(a => {
                out.push('', `> ${markdownText(a.text)} [↗](${markdownUrl(a.url)})`);
                if (a.note) out.push('', a.note);
            });
        });
        return out.join('\n') + '\n';
    }

    // Takes the ticked annotations out of storage. Those of this page go the way the annotations
    // panel's Erase and Forget do (Undo included); the others are simply deleted.
    function forgetSaved(selected) {
        const here = selected.filter(s => s.page.key === currentKey).map(s => s.item.group);
        const elsewhere = new Map();
        selected.forEach(s => {
            if (s.page.key === currentKey) return;
            if (!elsewhere.has(s.page.key)) elsewhere.set(s.page.key, new Set());
            elsewhere.get(s.page.key).add(s.item.group);
        });
        elsewhere.forEach((groups, key) => {
            const rest = (readRecords(key) || []).filter(r => !groups.has(recordOwner(r)));
            if (rest.length) GM_setValue(key, JSON.stringify(rest)); else GM_deleteValue(key);
        });
        if (here.length) {
            syncLocation();
            const live = here.filter(g => groupWrappers(g).length);
            const step = runUndoable(() => {
                live.forEach(g => unwrapMany(groupWrappers(g)));
                pendingRecords = pendingRecords.filter(r => !here.includes(recordOwner(r)));
            });
            // Undo covers only this page, so it is offered only when nothing else was forgotten.
            if (!elsewhere.size) { offerUndo(doneText('forgotten', selected.length), step, 'eraser'); return; }
        }
        showToast(doneText('forgotten', selected.length), { icon: 'eraser' });
    }

    let everythingItemSeq = 0;
    // Slides a page's list open or shut: its height and opacity, from or to nothing.
    function slideList(list, grow) {
        const h = `${list.getBoundingClientRect().height}px`;
        const frames = [{ height: h, opacity: 1 }, { height: '0px', opacity: 0 }];
        if (grow) frames.reverse();
        list.style.overflow = 'hidden';
        const a = list.animate(frames, { duration: 200, easing: grow ? 'cubic-bezier(0, 0, 0, 1)' : 'cubic-bezier(1, 0, 1, 1)' });
        a.finished.then(() => { list.style.overflow = ''; }, () => {});
        return a;
    }

    function renderEverything() {
        const terms = everythingFilter.value.toLowerCase().split(/\s+/).filter(Boolean);
        const matches = s => terms.every(t => s.includes(t));
        const dark = everythingEl.getAttribute('data-theme') === 'dark';
        const rows = [];
        const visible = everythingPages.map(p => {
            const pageHit = terms.length > 0 && matches(`${p.host} ${p.path}`.toLowerCase());
            return { p, items: !terms.length || pageHit ? p.items : p.items.filter(a => matches(`${a.text}\n${a.note}`.toLowerCase())) };
        }).filter(v => v.items.length);
        const shownItems = visible.reduce((n, v) => n + v.items.length, 0);
        // Only what the search shows can stay ticked, so forgetting never takes what is out of sight.
        everythingShown = visible.flatMap(v => v.items.map(a => ({ id: everythingId(v.p, a), page: v.p, item: a })));
        const shownIds = new Set(everythingShown.map(s => s.id));
        everythingChecked.forEach(id => { if (!shownIds.has(id)) everythingChecked.delete(id); });
        if (!everythingChecked.size) everythingAnchor = null;
        visible.forEach(({ p, items }) => {
            // Pages start closed, and opened while searching; a click turns that round.
            const open = everythingToggled.has(p.key) !== terms.length > 0;
            const head = makeEl('button', { type: 'button', class: 'page-head', role: 'treeitem', 'aria-level': '1', 'aria-expanded': String(open), 'data-key': p.key }, [
                phosphorIcon(open ? 'caret-down' : 'caret-right'),
                makeEl('span', { class: 'page-name' }, [makeEl('span', { class: 'page-host', text: p.host }), makeEl('span', { class: 'page-path', text: p.path })]),
                makeEl('span', { class: 'page-meta', text: `${(() => { const n = items.filter(a => everythingChecked.has(everythingId(p, a))).length; return n ? `${n}/${items.length}` : items.length; })()}${p.time ? ` · ${formatDate(p.time)}` : ''}` })
            ]);
            const section = makeEl('div', { class: 'page', role: 'none' }, [head]);
            if (open) {
                const list = makeEl('div', { class: 'page-items', role: 'group' });
                items.forEach(a => {
                    const link = makeEl('a', { class: 'item-main', href: a.url, target: '_blank', rel: 'noopener', 'data-key': p.key, 'data-group': a.group },
                        [makeEl('div', { class: 'item-text', id: `rnh-ei-${++everythingItemSeq}`, text: a.text })]);
                    if (a.note) link.appendChild(makeEl('div', { class: 'item-note', text: a.note }));
                    link.appendChild(makeEl('div', { class: 'item-meta', text: [styleLabel(a.key), a.time ? `added ${formatDate(a.time)}` : ''].filter(Boolean).join(' · ') }));
                    link.style.setProperty('--swatch', resolveStyle(a.key, dark).color);
                    const check = makeEl('input', { type: 'checkbox', class: 'check', 'data-act': 'check', 'aria-labelledby': link.firstChild.id });
                    check.checked = everythingChecked.has(everythingId(p, a));
                    list.appendChild(makeEl('div', { class: 'item', role: 'treeitem', 'aria-level': '2' }, [link, check]));
                });
                section.appendChild(list);
            }
            rows.push(section);
        });
        const total = everythingPages.reduce((n, p) => n + p.items.length, 0);
        const ticked = everythingChecked.size;
        syncSelectionButtons(everythingSelectAll, everythingCopy, everythingForget, ticked, shownItems, everythingPagesStep() ? 'Select all on these pages' : '');
        const pagesText = n => `${n} ${n === 1 ? 'page' : 'pages'}`;
        const noun = n => (n === 1 ? 'annotation' : 'annotations');
        if (ticked) {
            const tickedPages = new Set(everythingShown.filter(s => everythingChecked.has(s.id)).map(s => s.page.key)).size;
            setPanelTitle(everythingCount, `${ticked} of ${shownItems}`, ` selected on ${pagesText(tickedPages)}`, noun(shownItems));
        } else if (terms.length) {
            setPanelTitle(everythingCount, `${shownItems} of ${total}`, ` matched on ${pagesText(visible.length)}`, noun(total));
        } else {
            setPanelTitle(everythingCount, String(total), ` found on ${pagesText(everythingPages.length)}`, noun(total));
        }
        if (!rows.length) rows.push(makeEl('div', { class: 'empty', text: total ? 'Nothing matches.' : 'No annotations saved yet.' }));
        everythingList.replaceChildren(...rows);
    }

    everythingFilter.addEventListener('input', () => { everythingToggled = new Set(); renderEverything(); });
    everythingClose.addEventListener('click', closeEverything);
    addLabelTip(everythingSelectAll, 'Select all', '', () => true);
    addLabelTip(everythingCopy, 'Copy selected as Markdown', '', () => true);
    addLabelTip(everythingForget, 'Forget selected annotations', '', () => true);
    // Select all goes in three steps: the pages that already have a tick, then every page shown, then none.
    function everythingPagesStep() {
        const ticked = everythingShown.filter(s => everythingChecked.has(s.id));
        if (!ticked.length || ticked.length === everythingShown.length) return false;
        const pages = new Set(ticked.map(s => s.page.key));
        return everythingShown.some(s => pages.has(s.page.key) && !everythingChecked.has(s.id));
    }
    everythingSelectAll.addEventListener('click', () => {
        const none = everythingSelectAll.dataset.all === 'true';
        const pagesOnly = !none && everythingPagesStep();
        const pages = new Set(everythingShown.filter(s => everythingChecked.has(s.id)).map(s => s.page.key));
        everythingShown.forEach(s => {
            if (none) everythingChecked.delete(s.id);
            else if (!pagesOnly || pages.has(s.page.key)) everythingChecked.add(s.id);
        });
        renderEverything();
    });
    everythingCopy.addEventListener('click', () => {
        const selected = everythingShown.filter(s => everythingChecked.has(s.id));
        if (!selected.length) return;
        writeClipboard(savedMarkdown(selected)).then(
            () => showToast(doneText('copied', selected.length), { icon: 'check', intent: 'success' }),
            e => { console.warn(`${LOG} could not copy`, e); showToast('Couldn\'t copy', { intent: 'error', icon: 'warning-circle' }); });
    });
    everythingForget.addEventListener('click', () => {
        if (!running) return;
        const selected = everythingShown.filter(s => everythingChecked.has(s.id));
        if (!selected.length) return;
        everythingChecked = new Set();
        forgetSaved(selected);
        everythingPages = savedPages();
        renderEverything();
    });
    // Pressing a button leaves the page's text selection alone, as in the annotations panel.
    everythingEl.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    addLabelTip(everythingClose, 'Close', 'Esc', () => true);
    // Clicking the dimmed page around it closes it.
    everythingEl.addEventListener('mousedown', e => { if (e.target === everythingEl) closeEverything(); });
    // Ticks by the rows on screen, in list order (the rows of a closed page are not on screen).
    function tickEverythingRows(id, shift) {
        const ids = Array.from(everythingList.querySelectorAll('a.item-main')).map(a => `${a.dataset.key}\n${a.dataset.group}`);
        everythingAnchor = tickRows(everythingChecked, ids, everythingAnchor, id, shift);
    }

    // Up and down move between the page rows and the quotes of the open pages; right opens a page and
    // left closes it (or goes from a quote to its page). Shift+arrow ticks the quote it moves to, with the ones between.
    function everythingStops() {
        return Array.from(everythingList.querySelectorAll('button.page-head, a.item-main'));
    }
    function focusEverythingStop(el) {
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'nearest' });
    }
    const stopId = el => `${el.dataset.key}\n${el.dataset.group}`;
    function everythingArrow(e) {
        const stops = everythingStops();
        const at = stops.indexOf(e.target.closest('button.page-head, a.item-main'));
        if (at < 0) return false;
        const el = stops[at], isHead = el.classList.contains('page-head');
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            const next = stops[at + (e.key === 'ArrowDown' ? 1 : -1)];
            if (!next) { if (e.key === 'ArrowUp') everythingFilter.focus(); return true; }
            if (e.shiftKey && !isHead && !next.classList.contains('page-head')) {
                if (!everythingAnchor) tickEverythingRows(stopId(el), false);
                tickEverythingRows(stopId(next), true);
                renderEverything();
                const again = everythingStops().find(s => !s.classList.contains('page-head') && stopId(s) === stopId(next));
                if (again) focusEverythingStop(again);
                return true;
            }
            focusEverythingStop(next);
            return true;
        }
        const open = isHead && el.getAttribute('aria-expanded') === 'true';
        if (e.key === 'ArrowRight' && isHead && !open) { el.click(); return true; }
        if (e.key === 'ArrowRight' && open) { const first = stops[at + 1]; if (first && !first.classList.contains('page-head')) focusEverythingStop(first); return true; }
        if (e.key === 'ArrowLeft' && isHead && open) { el.click(); return true; }
        if (e.key === 'ArrowLeft' && !isHead) {
            const head = stops.slice(0, at).reverse().find(s => s.classList.contains('page-head'));
            if (head) focusEverythingStop(head);
            return true;
        }
        return false;
    }
    everythingFilter.addEventListener('keydown', e => {
        if (e.key !== 'ArrowDown') return;
        const first = everythingStops()[0];
        if (!first) return;
        e.preventDefault();
        focusEverythingStop(first);
    });

    // Shift+Space ticks the rows from the last ticked one to the focused quote.
    everythingList.addEventListener('keydown', e => {
        if (/^Arrow(Up|Down|Left|Right)$/.test(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey && everythingArrow(e)) { e.preventDefault(); return; }
        const row = e.key === ' ' && e.shiftKey ? e.target.closest('a.item-main') : null;
        if (!row) return;
        e.preventDefault();
        tickEverythingRows(`${row.dataset.key}\n${row.dataset.group}`, !!everythingAnchor);
        renderEverything();
    });
    everythingList.addEventListener('click', e => {
        const box = e.target.closest('input.check');
        if (box) {
            const link = box.closest('.item').querySelector('a.item-main');
            const id = `${link.dataset.key}\n${link.dataset.group}`;
            if (e.shiftKey && everythingAnchor) tickEverythingRows(id, true);
            else {
                if (box.checked) everythingChecked.add(id); else everythingChecked.delete(id);
                everythingAnchor = id;
            }
            renderEverything();
            return;
        }
        // Once something is ticked, Ctrl or Shift on a quote selects instead of opening it.
        const row = e.target.closest('a.item-main');
        if (row && everythingChecked.size && (e.shiftKey || e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            tickEverythingRows(`${row.dataset.key}\n${row.dataset.group}`, e.shiftKey);
            renderEverything();
            return;
        }
        const head = e.target.closest('.page-head');
        if (head) {
            const key = head.dataset.key;
            const toggle = () => {
                if (everythingToggled.has(key)) everythingToggled.delete(key); else everythingToggled.add(key);
                renderEverything();
                const again = Array.from(everythingList.querySelectorAll('.page-head')).find(h => h.dataset.key === key);
                if (again) again.focus({ preventScroll: true });
                return again;
            };
            // Fluent motion: a page's list grows in (decelerate) and shrinks out (accelerate), over durationNormal.
            const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
            const list = head.parentElement.querySelector('.page-items');
            if (list && !calm) {
                if (!list.getAnimations().length) slideList(list, false).finished.then(toggle, toggle);
            } else {
                const again = toggle();
                const grown = again && !calm && again.parentElement.querySelector('.page-items');
                if (grown) slideList(grown, true);
            }
            return;
        }
        const link = e.target.closest('a.item-main');
        // On this page: scroll to it here, rather than open the page again.
        if (link && link.dataset.key === currentKey && groupWrappers(link.dataset.group).length && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
            e.preventDefault();
            closeEverything();
            jumpToGroup(link.dataset.group, { showNote: true });
        }
    });
