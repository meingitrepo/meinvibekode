    // --- Changes made from the panel ---

    // A note being written closes first (and is offered back), so the highlight made for a new
    // one is still the latest undo step and goes with it.
    function closeNoteForPanel(group) {
        if (editor) cancelEditor({ offer: editor.group !== group });
    }

    // Removes the whole annotation, also from the keyboard (Alt+Backspace, or its own style, with
    // the mouse on it).
    function deleteAnnotation(group) {
        syncLocation();
        closeNoteForPanel(group);
        if (!groupWrappers(group).length) return;
        const step = runUndoable(() => {
            unwrapMany(groupWrappers(group));
            pendingRecords = pendingRecords.filter(r => recordOwner(r) !== group);
        });
        offerUndo(doneText('Erased', 1), step);
    }

    function forgetAnnotation(group) {
        syncLocation();
        closeNoteForPanel(group);
        if (!pendingRecords.some(r => recordOwner(r) === group)) return;
        const step = runUndoable(() => { pendingRecords = pendingRecords.filter(r => recordOwner(r) !== group); });
        offerUndo(doneText('Forgot', 1), step, 'delete_20_regular');
    }

    // Re-anchors a saved annotation that can't be found to the text selected now. It keeps its
    // style, note and date, and from then on is saved with the new text.
    function attachToSelection(group) {
        syncLocation();
        const records = pendingRecords.filter(r => recordOwner(r) === group && hasOwn(STYLES, r.key));
        if (!records.length) return;
        const selected = toolbarSelection();
        let range = selected && cleanRange(selected);
        if (!range) {
            showToast('Select the text this annotation belongs to, then choose Attach to selection.');
            return;
        }
        if (editor) {
            // Closing the note may take its new highlight off the page, which moves text nodes:
            // the selection is kept as offsets in its blocks and rebuilt afterwards.
            const startBlock = getBlockParent(range.startContainer);
            const endBlock = getBlockParent(range.endContainer);
            const startOff = computeOffsetWithinBlock(startBlock, range.startContainer, range.startOffset);
            const endOff = computeOffsetWithinBlock(endBlock, range.endContainer, range.endOffset);
            closeNoteForPanel(group);
            const sp = findNodeAtOffset(startBlock, startOff, 'start');
            const ep = findNodeAtOffset(endBlock, endOff, 'end');
            if (!sp || !ep) return;
            range = document.createRange();
            range.setStart(sp.node, sp.offset);
            range.setEnd(ep.node, ep.offset);
        }
        const withNote = records.find(r => r.note);
        const dated = records.find(r => r.added);
        const own = {
            group,
            note: withNote ? withNote.note : undefined,
            added: groupTime(group) ? undefined : (dated ? dated.added : Date.now())
        };
        let created = [];
        runUndoable(() => {
            const before = pendingRecords;
            pendingRecords = pendingRecords.filter(r => recordOwner(r) !== group);
            created = applyAnnotation(range, records[0].key, findOverlaps(range), own);
            if (!created.length) pendingRecords = before;   // nothing could be wrapped: it stays saved
        });
        const sel = window.getSelection();
        if (sel) sel.removeAllRanges();
        if (!created.length) showToast('That text can\'t be annotated. Try selecting it again.');
    }

    // --- Annotations panel (Alt+O) ---

    let panelTimer = null;
    let panelSignature = '';      // what the list shows now; it is rebuilt only when that changes
    let panelItems = [];          // the annotations on the page the list shows, for Copy
    let panelCounts = '';         // see notePanelChanges
    let panelReturnFocus = null;

    function setPanelTheme(dark) {
        panelEl.setAttribute('data-theme', dark ? 'dark' : 'light');
        schedulePanelRefresh();   // the color bars follow the theme
    }

    function openPanel({ focus = true } = {}) {
        if (!running) return;
        syncLocation();
        const dark = computeDarkMode();
        ensureUi(panelOpen() && uiDark !== null ? uiDark : dark);
        setPanelTheme(dark);
        if (panelEl.hidden) {
            const focused = document.activeElement;
            panelReturnFocus = focused && focused !== document.body && focused !== uiHost ? focused : null;
            panelEl.hidden = false;
            toastEl.classList.add('beside-panel');
            panelSignature = '';
        }
        renderPanel();
        // Typing filters the list, unless the user has page text selected (to attach, say).
        if (focus && !getActiveRange()) panelFilter.focus({ preventScroll: true });
    }

    function closePanel() {
        if (panelEl.hidden) return;
        const hadFocus = document.activeElement === uiHost && panelEl.contains(uiRoot.activeElement);
        clearTimeout(panelTimer);
        panelTimer = null;
        hideLabelTip();
        releaseFocus(panelEl);
        panelEl.hidden = true;
        toastEl.classList.remove('beside-panel');
        panelList.replaceChildren();
        panelSignature = '';
        panelItems = [];
        const back = panelReturnFocus;
        panelReturnFocus = null;
        if (hadFocus && back && back.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
    }

    function togglePanel() {
        if (panelEl.hidden) openPanel();
        else closePanel();
    }

    // The toast's Show: the panel, scrolled to what wasn't found.
    function showMissingInPanel() {
        panelFilter.value = '';
        openPanel();
        const title = panelList.querySelector('[data-section="missing"]');
        if (title) panelList.scrollTop += title.getBoundingClientRect().top - panelList.getBoundingClientRect().top;
    }

    function schedulePanelRefresh() {
        if (panelEl.hidden || panelTimer) return;
        panelTimer = setTimeout(renderPanel, 50);
    }

    // Called every second: annotations a site redrew, or late content that brought some back,
    // change the list without any edit of ours.
    function notePanelChanges() {
        if (panelEl.hidden) return;
        const counts = `${document.querySelectorAll(WRAPPER_SELECTOR).length}|${pendingRecords.length}`;
        if (counts === panelCounts) return;
        panelCounts = counts;
        schedulePanelRefresh();
    }

    function filterTerms() {
        return panelFilter.value.toLowerCase().split(/\s+/).filter(Boolean);
    }

    function matchesFilter(a, terms) {
        if (!terms.length) return true;
        const hay = `${a.paragraphs.join(' ')}\n${a.note}`.toLowerCase();
        return terms.every(t => hay.includes(t));
    }

    function renderPanel() {
        clearTimeout(panelTimer);
        panelTimer = null;
        if (panelEl.hidden || !running) return;
        const present = pageAnnotations();
        const presentGroups = new Set(present.map(a => a.group));
        const missing = missingAnnotations(presentGroups);
        const elsewhere = missingAnnotations(presentGroups, { otherPages: true });
        const terms = filterTerms();
        const shown = present.filter(a => matchesFilter(a, terms));
        const shownMissing = missing.filter(a => matchesFilter(a, terms));
        const shownElsewhere = elsewhere.filter(a => matchesFilter(a, terms));
        const dark = panelEl.getAttribute('data-theme') === 'dark';
        const describe = a => [a.group, a.key, a.paragraphs, a.note, a.time, a.page];
        const signature = JSON.stringify([dark, terms, present.length, missing.length, elsewhere.length,
            shown.map(describe), shownMissing.map(describe), shownElsewhere.map(describe)]);
        panelItems = shown;
        if (signature === panelSignature) return;
        panelSignature = signature;

        // Keeps keyboard focus on the same control of the same annotation across the rebuild.
        const active = uiRoot.activeElement;
        const keep = active && panelList.contains(active)
            ? { group: active.closest('[data-group]').dataset.group, act: active.dataset.act } : null;

        hideLabelTip();
        panelCount.textContent = terms.length ? `${shown.length} of ${present.length}` : String(present.length);
        const children = [];
        if (!present.length && !missing.length) {
            children.push(makeEl('div', { class: 'empty', text: 'No annotations on this page yet. Select some text and press Alt+H to highlight it.' }));
        } else if (!shown.length && !shownMissing.length && !shownElsewhere.length) {
            children.push(makeEl('div', { class: 'empty', text: 'No annotations match the filter.' }));
        }
        shown.forEach(a => children.push(panelItem(a, dark, false)));
        if (shownMissing.length) {
            children.push(makeEl('div', { class: 'section-title', 'data-section': 'missing', text: `Not found on the page (${shownMissing.length})` }));
            shownMissing.forEach(a => children.push(panelItem(a, dark, true)));
        }
        if (shownElsewhere.length) {
            children.push(makeEl('div', { class: 'section-title', 'data-section': 'elsewhere', text: `Saved on other pages (${shownElsewhere.length})` }));
            shownElsewhere.forEach(a => children.push(panelItem(a, dark, true, true)));
        }
        panelList.replaceChildren(...children);

        if (keep) {
            const item = Array.from(panelList.querySelectorAll('[data-group]')).find(el => el.dataset.group === keep.group);
            const target = item && item.querySelector(`[data-act="${keep.act}"]`);
            (target || panelFilter).focus({ preventScroll: true });
            hideLabelTip();   // focusing it again is no reason to show its tooltip
        }
    }

    function panelButton(icon, label, act) {
        const b = fluentButton({ icon: fluentIcon(icon) });
        b.dataset.act = act;
        return addLabelTip(b, label, '', () => false);
    }

    // A page's address without its site, to tell the pages that share a key apart.
    function pagePath(url) {
        try {
            const u = new URL(url);
            return decodeURI(u.pathname + u.search + u.hash);
        } catch (e) {
            return url;
        }
    }

    function panelItem(a, dark, missing, elsewhere = false) {
        const meta = [styleLabel(a.key), a.time ? `added ${formatDate(a.time)}` : '', elsewhere ? `on ${pagePath(a.page)}` : '']
            .filter(Boolean).join(' · ');
        const main = makeEl(missing ? 'div' : 'button', missing ? { class: 'item-main' } : { type: 'button', class: 'item-main', 'data-act': 'jump' }, [
            makeEl('div', { class: 'item-text', text: a.paragraphs.join(' ') })
        ]);
        if (a.note) main.appendChild(makeEl('div', { class: 'item-note', text: a.note }));
        main.appendChild(makeEl('div', { class: 'item-meta', text: meta }));
        main.style.setProperty('--swatch', resolveStyle(a.key, dark).color);
        const actions = makeEl('div', { class: 'item-actions' });
        if (missing) {
            const attach = fluentButton({ text: 'Attach to selection' });
            attach.dataset.act = 'attach';
            attach.title = 'Select the text this annotation belongs to on the page, then click here';
            actions.append(attach, panelButton('delete_20_regular', 'Forget annotation', 'forget'));
        } else {
            actions.append(
                panelButton('note_edit_20_regular', a.note ? 'Edit note' : 'Add note', 'note'),
                panelButton('eraser_20_regular', 'Erase annotation', 'delete'));
        }
        const item = makeEl('div', { class: missing ? 'item missing' : 'item', role: 'listitem' }, [main, actions]);
        item.dataset.group = a.group;
        return item;
    }

    panelList.setAttribute('role', 'list');
    addLabelTip(panelCopy, 'Copy as Markdown', '', () => true);
    addLabelTip(panelClose, 'Close', 'Alt+O', () => true);
    panelCopy.addEventListener('click', () => { renderPanel(); copyAnnotations(panelItems); });
    panelClose.addEventListener('click', closePanel);
    panelEl.addEventListener('mouseenter', () => { if (cardWrapper) hideNoteCard(); });
    panelFilter.addEventListener('input', () => renderPanel());
    // Pressing a button keeps the page's text selection (for Attach to selection).
    panelEl.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });

    panelList.addEventListener('click', e => {
        const button = e.target.closest('[data-act]');
        const item = button && button.closest('[data-group]');
        if (!item || !running) return;
        const group = item.dataset.group;
        switch (button.dataset.act) {
            case 'jump':
                syncLocation();
                jumpToGroup(group);
                break;
            case 'note': {
                syncLocation();
                const first = groupWrappers(group)[0];
                if (!first) return;
                if (!isInView(first)) first.scrollIntoView({ block: 'center', inline: 'nearest' });
                openNoteEditor(group, { returnFocus: button });
                break;
            }
            case 'delete': deleteAnnotation(group); break;
            case 'forget': forgetAnnotation(group); break;
            case 'attach': attachToSelection(group); break;
        }
    });

    panelEl.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            e.preventDefault();
            if (panelFilter.value) { panelFilter.value = ''; renderPanel(); }
            else closePanel();
            return;
        }
        const focused = uiRoot.activeElement;
        if (e.key === 'Enter' && focused === panelFilter) {
            e.preventDefault();
            const first = panelList.querySelector('button.item-main');
            if (first) first.click();
            return;
        }
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        // Up and down move between the annotations, starting from the filter box.
        const rows = Array.from(panelList.querySelectorAll('button.item-main'));
        if (!rows.length) return;
        e.preventDefault();
        const row = focused && focused !== panelFilter && focused.closest ? focused.closest('.item') : null;
        const i = rows.indexOf(row && row.querySelector('button.item-main'));
        const down = e.key === 'ArrowDown';
        if (i < 0) { (down ? rows[0] : rows[rows.length - 1]).focus(); return; }
        if (!down && i === 0) { panelFilter.focus(); return; }
        const next = rows[Math.min(rows.length - 1, i + (down ? 1 : -1))];
        next.focus();
        next.scrollIntoView({ block: 'nearest' });
    });

