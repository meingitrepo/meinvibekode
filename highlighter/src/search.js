    // --- Everything saved (Alt+Shift+O): every page's annotations, searchable ---

    // A full-page overlay: a search box and the pages with annotations, most recently annotated
    // first. Each page opens to its quotes and notes; a quote opens its page at that passage
    // (in a new tab; on this page it scrolls to it). Read from storage each time it opens.
    let everythingPages = [];
    let everythingToggled = new Set();   // pages opened by a click (closed by one, while searching)
    let everythingReturnFocus = null;
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
            if (!elsewhere.size) { offerUndo(doneText('Forgot', selected.length), step, 'eraser_20_regular'); return; }
        }
        showToast(doneText('Forgot', selected.length), { icon: 'eraser_20_regular' });
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
        visible.forEach(({ p, items }) => {
            // Pages start closed, and opened while searching; a click turns that round.
            const open = everythingToggled.has(p.key) !== terms.length > 0;
            const head = makeEl('button', { type: 'button', class: 'page-head', 'aria-expanded': String(open), 'data-key': p.key }, [
                fluentIcon(open ? 'chevron_down_16_regular' : 'chevron_right_16_regular'),
                makeEl('span', { class: 'page-name' }, [makeEl('span', { class: 'page-host', text: p.host }), makeEl('span', { class: 'page-path', text: p.path })]),
                makeEl('span', { class: 'page-meta', text: `${(() => { const n = items.filter(a => everythingChecked.has(everythingId(p, a))).length; return n ? `${n}/${items.length}` : items.length; })()}${p.time ? ` · ${formatDate(p.time)}` : ''}` })
            ]);
            const section = makeEl('div', { class: 'page', role: 'listitem' }, [head]);
            if (open) {
                const list = makeEl('div', { class: 'page-items' });
                items.forEach(a => {
                    const link = makeEl('a', { class: 'item-main', href: a.url, target: '_blank', rel: 'noopener', 'data-key': p.key, 'data-group': a.group },
                        [makeEl('div', { class: 'item-text', text: a.text })]);
                    if (a.note) link.appendChild(makeEl('div', { class: 'item-note', text: a.note }));
                    link.appendChild(makeEl('div', { class: 'item-meta', text: [styleLabel(a.key), a.time ? `added ${formatDate(a.time)}` : ''].filter(Boolean).join(' · ') }));
                    link.style.setProperty('--swatch', resolveStyle(a.key, dark).color);
                    const check = makeEl('input', { type: 'checkbox', class: 'check', 'data-act': 'check', 'aria-label': 'Select annotation' });
                    check.checked = everythingChecked.has(everythingId(p, a));
                    list.appendChild(makeEl('div', { class: 'item' }, [check, link]));
                });
                section.appendChild(list);
            }
            rows.push(section);
        });
        const total = everythingPages.reduce((n, p) => n + p.items.length, 0);
        const ticked = everythingChecked.size;
        syncSelectionButtons(everythingSelectAll, everythingCopy, everythingForget, ticked, shownItems, everythingPagesStep() ? 'Select all on these pages' : '');
        const pagesText = n => `${n} ${n === 1 ? 'page' : 'pages'}`;
        if (ticked) {
            const tickedPages = new Set(everythingShown.filter(s => everythingChecked.has(s.id)).map(s => s.page.key)).size;
            setPanelTitle(everythingCount, ticked === 1 ? '1' : String(ticked), ` selected on ${pagesText(tickedPages)}`);
        } else {
            setPanelTitle(everythingCount, terms.length ? `${shownItems} of ${total}` : String(total), ` on ${pagesText(terms.length ? visible.length : everythingPages.length)}`);
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
            () => showToast(doneText('Copied', selected.length), { icon: 'copy_20_regular' }),
            e => { console.warn(`${LOG} could not copy`, e); showToast('Couldn\'t copy to the clipboard.'); });
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
    everythingList.addEventListener('click', e => {
        const box = e.target.closest('input.check');
        if (box) {
            const link = box.closest('.item').querySelector('a.item-main');
            const id = `${link.dataset.key}\n${link.dataset.group}`;
            if (box.checked) everythingChecked.add(id); else everythingChecked.delete(id);
            renderEverything();
            return;
        }
        const head = e.target.closest('.page-head');
        if (head) {
            const key = head.dataset.key;
            if (everythingToggled.has(key)) everythingToggled.delete(key); else everythingToggled.add(key);
            renderEverything();
            const again = Array.from(everythingList.querySelectorAll('.page-head')).find(h => h.dataset.key === key);
            if (again) again.focus({ preventScroll: true });
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
