    // --- Everything saved (Alt+Shift+O): every page's annotations, searchable ---

    // A full-page overlay: a search box and the pages with annotations, most recently annotated
    // first. Each page opens to its quotes and notes; a quote opens its page at that passage
    // (in a new tab; on this page it scrolls to it). Read from storage each time it opens.
    let everythingPages = [];
    let everythingToggled = new Set();   // pages opened by a click (closed by one, while searching)
    let everythingReturnFocus = null;

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
        const back = everythingReturnFocus;
        everythingReturnFocus = null;
        if (back && back.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
    }

    function toggleEverything() {
        if (everythingEl.hidden) openEverything();
        else closeEverything();
    }

    function renderEverything() {
        const terms = everythingFilter.value.toLowerCase().split(/\s+/).filter(Boolean);
        const matches = s => terms.every(t => s.includes(t));
        const dark = everythingEl.getAttribute('data-theme') === 'dark';
        const rows = [];
        let shownItems = 0;
        everythingPages.forEach(p => {
            const pageHit = terms.length > 0 && matches(`${p.host} ${p.path}`.toLowerCase());
            const items = !terms.length || pageHit ? p.items : p.items.filter(a => matches(`${a.text}\n${a.note}`.toLowerCase()));
            if (!items.length) return;
            shownItems += items.length;
            // Pages start closed, and opened while searching; a click turns that round.
            const open = everythingToggled.has(p.key) !== terms.length > 0;
            const head = makeEl('button', { type: 'button', class: 'page-head', 'aria-expanded': String(open), 'data-key': p.key }, [
                fluentIcon(open ? 'chevron_down_16_regular' : 'chevron_right_16_regular'),
                makeEl('span', { class: 'page-name' }, [makeEl('span', { class: 'page-host', text: p.host }), makeEl('span', { class: 'page-path', text: p.path })]),
                makeEl('span', { class: 'page-meta', text: `${items.length}${p.time ? ` · ${formatDate(p.time)}` : ''}` })
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
                    list.appendChild(makeEl('div', { class: 'item' }, [link]));
                });
                section.appendChild(list);
            }
            rows.push(section);
        });
        const total = everythingPages.reduce((n, p) => n + p.items.length, 0);
        everythingCount.textContent = terms.length
            ? `${shownItems} of ${annotationsText(total)}`
            : `${annotationsText(total)} on ${everythingPages.length} ${everythingPages.length === 1 ? 'page' : 'pages'}`;
        if (!rows.length) rows.push(makeEl('div', { class: 'empty', text: total ? 'Nothing matches.' : 'No annotations saved yet.' }));
        everythingList.replaceChildren(...rows);
    }

    everythingFilter.addEventListener('input', () => { everythingToggled = new Set(); renderEverything(); });
    everythingClose.addEventListener('click', closeEverything);
    addLabelTip(everythingClose, 'Close', 'Esc', () => true);
    // Clicking the dimmed page around it closes it.
    everythingEl.addEventListener('mousedown', e => { if (e.target === everythingEl) closeEverything(); });
    everythingList.addEventListener('click', e => {
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
