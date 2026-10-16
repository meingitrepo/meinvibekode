    // =====================================================================
    // Input
    // =====================================================================

    function isEditableTarget(e) {
        const t = (typeof e.composedPath === 'function' && e.composedPath()[0]) || e.target;
        if (!(t instanceof Element)) return false;
        return !!t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    }

    function getActiveRange() {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
        try { return { sel, range: sel.getRangeAt(0) }; } catch (e) { return null; }
    }

    // Shared by the shortcuts and the selection toolbar. `active` is { sel, range }. A style the
    // selected text already has (all of it) removes those annotations, whole; any other style
    // annotates it, on top of the styles it has (see applyAnnotation).
    function annotateSelection(key, { sel, range: selected }) {
        if (!sel.toString().trim()) return;
        const range = cleanRange(selected);
        if (!range) return;
        let removed = 0;
        const step = runUndoable(() => {
            const overlaps = findOverlaps(range);
            if (selectionStyles(range, overlaps).includes(key)) {
                const groups = new Set(overlaps.filter(o => o.key === key).map(o => o.group));
                removeGroups(groups);
                removed = groups.size;
            } else {
                applyAnnotation(range, key, overlaps);
                lastStyleKey = key;
            }
        });
        sel.removeAllRanges();
        if (removed) offerUndo(doneText('Erased', removed), step);
    }

    function removeInSelection({ sel, range: selected }) {
        const range = cleanRange(selected);
        const overlaps = range ? findOverlaps(range) : [];
        const step = overlaps.length ? runUndoable(() => eraseOverlaps(overlaps)) : null;
        sel.removeAllRanges();
        // Annotations erased only in part count too.
        offerUndo(doneText('Erased', new Set(overlaps.map(o => o.group)).size), step);
    }

    // What the keys act on when no text is selected: the annotation selected by clicking it, else
    // the one under the mouse (or under the note card the mouse is on), else the one jumped to
    // last while it is in view. Null if none.
    function pointedGroup() {
        if (selectedGroups.length) return selectedInOrder()[0];   // clicked (see setSelectedGroups)
        let w = hoveredWrapper;
        if (w && !w.isConnected && pointer) {
            // Drawn again under a still mouse (by undo, or by the site): whatever is there now.
            const el = document.elementFromPoint(pointer.x, pointer.y);
            w = hoveredWrapper = el && el !== uiHost ? el.closest(WRAPPER_SELECTOR) : null;
        }
        if (w && w.isConnected) return w.getAttribute(GROUP_ATTR);
        return jumpGroup && groupWrappers(jumpGroup).some(isInView) ? jumpGroup : null;
    }

    // A style chosen with nothing selected, for the annotations pointed at or clicked (see
    // setSelectedGroups), as one step for Undo: all of each takes that style (pieces waiting to
    // come back too), keeping its note and date; they all go when all have that style already.
    function restyleGroups(groups, key) {
        if (editor && !groups.includes(editor.group)) cancelEditor();   // one note at a time, as when opening another
        groups = groups.filter(g => groupWrappers(g).length);
        const wrappers = groups.flatMap(groupWrappers);
        if (!wrappers.length) return;
        if (wrappers.every(w => w.getAttribute(STYLE_ATTR) === key)) {
            deleteGroups(groups);
            return;
        }
        lastStyleKey = key;
        runUndoable(() => {
            pendingRecords.forEach(r => {
                const group = recordOwner(r);
                if (!groups.includes(group)) return;
                r.group = group;   // a record saved before groups existed is named by its style
                r.key = key;
            });
            wrappers.forEach(w => w.setAttribute(STYLE_ATTR, key));
            dropNestedSameStyle(wrappers);
            // Each draws in as one stroke, all of it (also what it merged with), all at once.
            const now = allWrappers().filter(w => groups.includes(w.getAttribute(GROUP_ATTR)));
            drawAnnotations(now.map(w => restyle(w, { animate: true, draw: false })).filter(Boolean));
            now.forEach(snapshotRect);
            updateSelectionVisibility();
        });
    }

    // Opens the note of the first annotation the selection touches; plain text first gets a
    // highlight, which is dropped again if the note is cancelled or left empty.
    function noteSelection({ sel, range: selected }) {
        if (!sel.toString().trim()) return;
        const range = cleanRange(selected);
        if (!range) return;
        const overlaps = findOverlaps(range);
        if (overlaps.length) {
            sel.removeAllRanges();
            openNoteEditor(overlaps[0].group);
            return;
        }
        let created = [];
        runUndoable(() => { created = applyAnnotation(range, NOTE_STYLE_KEY, []); });
        sel.removeAllRanges();
        if (!created.length) return;
        openNoteEditor(created[0].getAttribute(GROUP_ATTR), { step: undoStack[undoStack.length - 1] });
    }

    const COMMAND_CODES = new Set(['KeyZ', 'KeyY', 'KeyV', 'KeyP', 'KeyT', 'KeyN', 'KeyO', 'KeyJ', 'KeyK', 'KeyD', 'Delete']);

    // While our keys are on (Alt+Shift+K switches them), every Alt key outside a field is ours
    // alone: the site's own Alt shortcuts never run, whether we use the key or not. Its access
    // keys (accesskey="z": Wikipedia's Alt+Z, Alt+Shift+Z, ...) go off in Chrome before any
    // keydown handler sees the letter, so while Alt is held they are taken off the page.
    // Browser keys (Alt+Left, Alt+D, ...) are left alone: nothing is prevented unless we act.
    let heldAccessKeys = null;   // [[element, its accesskey]] while Alt is down

    function holdAccessKeys() {
        if (heldAccessKeys) return;
        heldAccessKeys = Array.from(document.querySelectorAll('[accesskey]'), el => [el, el.getAttribute('accesskey')]);
        heldAccessKeys.forEach(([el]) => el.removeAttribute('accesskey'));
    }

    function releaseAccessKeys() {
        if (!heldAccessKeys) return;
        heldAccessKeys.forEach(([el, key]) => { if (!el.hasAttribute('accesskey')) el.setAttribute('accesskey', key); });
        heldAccessKeys = null;
    }

    // An Alt key the site's handlers don't get: not AltGr (Ctrl+Alt) typing, not in a field or
    // in our own panels.
    function isSiteAltKey(e) {
        return e.altKey && !e.ctrlKey && !e.metaKey && !isUiEvent(e) && !isEditableTarget(e);
    }

    function toggleKeysSwitch() {
        const off = !keysSwitchedOff();
        setKeysSwitchedOff(off);
        if (off) releaseAccessKeys();
        showToast(off ? 'Shortcut keys off: the sites get their Alt keys back. Alt+Shift+K turns them on.'
            : 'Shortcut keys on: Alt keys are the highlighter\'s, not the sites\'.');
        refreshMenu();
    }

    function onKeyDown(e) {
        if (e.altKey && e.shiftKey && e.code === 'KeyK' && !e.ctrlKey && !e.metaKey && !e.repeat) {
            e.preventDefault();
            e.stopPropagation();
            toggleKeysSwitch();
            return;
        }
        if (e.altKey && keysSwitchedOff()) return;
        if (e.key === 'Alt' && !e.ctrlKey && !e.metaKey) holdAccessKeys();
        ourKey(e);
        if (isSiteAltKey(e)) e.stopImmediatePropagation();
    }

    // The rest of an Alt key press stays away from the site too.
    function onKeyUpOrPress(e) {
        if (e.type === 'keyup' && e.key === 'Alt') releaseAccessKeys();
        if (isSiteAltKey(e) && !keysSwitchedOff()) e.stopImmediatePropagation();
    }

    function ourKey(e) {
        // Esc closes everything saved (Alt+Shift+O) wherever focus is.
        if (e.key === 'Escape' && !everythingEl.hidden) {
            e.preventDefault();
            closeEverything();
            return;
        }
        // Everything saved covers the page: the page's keys wait until it closes.
        if (!everythingEl.hidden && e.code !== 'KeyO') return;
        // Esc closes a note pinned by clicking its badge.
        // Esc with focus out of the note editor (it stays open on clicks outside) still discards it.
        if (e.key === 'Escape' && editor && !isUiEvent(e) && !e.altKey) { cancelEditor(); return; }
        if (e.key === 'Escape' && pinnedCards.size && !e.altKey) { unpinNoteCard(Array.from(pinnedCards.keys()).pop()); return; }
        if (selectedGroupKey(e)) return;
        // Esc turns the pen off, unless it is meant for a panel or a field.
        if (e.key === 'Escape' && penKey && !editor && !isUiEvent(e) && !isEditableTarget(e)) {
            setPen(null);
            return;
        }
        if (!e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
        if (isEditableTarget(e)) return;
        if (editor && isUiEvent(e)) return;   // focus is on the open note editor's buttons
        // Typing in the panel's filter box: only the panel and jump keys act.
        if (isUiEvent(e) && uiRoot.activeElement === panelFilter && !/^Key[OJK]$/.test(e.code)) return;
        const code = e.code;
        if (!COMMAND_CODES.has(code) && (e.shiftKey || !CODE_TO_STYLE.has(code))) return;
        syncLocation();

        if (code === 'KeyZ' || code === 'KeyY') {
            const redo = code === 'KeyY' || e.shiftKey;
            if (!(redo ? redoStack : undoStack).length) return;
            e.preventDefault();
            if (redo) redoLastAction();
            else undoLastAction();
            return;
        }

        if (code === 'KeyV') {
            if (e.shiftKey || (!annotationsHidden && !document.querySelector(WRAPPER_SELECTOR))) return;
            e.preventDefault();
            toggleAnnotationsHidden();
            return;
        }

        if (code === 'KeyP') {
            if (e.shiftKey) return;
            e.preventDefault();
            togglePen();
            return;
        }

        if (code === 'KeyT') {
            if (e.shiftKey || !ENABLE_SELECTION_TOOLBAR) return;
            e.preventDefault();
            toggleToolbarSwitch();
            return;
        }

        const active = getActiveRange();
        const selected = !!active && !!active.sel.toString().trim();
        // With nothing selected, the keys act on the annotation pointed at (see pointedGroup).
        // Annotations hidden by Alt+V can't be seen to be pointed at: only Alt+N, which changes
        // nothing by itself, still reaches them.
        const pointed = () => (annotationsHidden ? null : pointedGroup());

        if (code === 'KeyN') {
            if (e.shiftKey) return;
            e.preventDefault();
            const group = selected ? null : pointedGroup();
            if (selected) noteSelection(active);
            else if (group) openNoteEditor(group);
            else showToast('To add a note, select some text or point at an annotation, then press Alt+N.');
            return;
        }

        if (code === 'KeyO') {
            e.preventDefault();
            if (e.shiftKey) toggleEverything();
            else togglePanel();
            return;
        }

        if (code === 'KeyJ' || code === 'KeyK') {
            if (e.shiftKey) return;
            // Without annotations the keys stay the page's.
            if (jumpRelative(code === 'KeyJ' ? 1 : -1)) e.preventDefault();
            return;
        }

        // D on one annotation with a note deletes the note first; Delete erases it all at once.
        if (code === 'KeyD' || code === 'Delete') {
            if (e.shiftKey) {
                e.preventDefault();
                clearPageAnnotations();
                return;
            }
            const group = selected ? null : pointed();
            if (!selected && !group) return;
            e.preventDefault();
            if (selected) removeInSelection(active);
            else if (code === 'KeyD' && groupHasNote(group)) deleteGroupNote(group);
            else deleteAnnotation(group);
            return;
        }

        const key = CODE_TO_STYLE.get(code);
        const group = selected ? null : pointed();
        if (!selected && !group) {
            // With the pen on, a style with nothing to act on becomes the pen's.
            if (penKey) { e.preventDefault(); setPen(key); }
            return;
        }
        e.preventDefault();
        if (selected) annotateSelection(key, active);
        else restyleGroups([group], key);
    }

    // Triple-click selects the paragraph under the pointer as it is shown (see visualParagraph),
    // rather than the browser's selection, which often runs into the start of the next block.
    function onMouseDown(e) {
        if (!ENABLE_TRIPLE_CLICK_BLOCK_SELECT) return;
        if (e.button !== 0 || e.detail < 3 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        if (!(e.target instanceof Element) || e.target === uiHost) return;
        if (e.target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return;
        const caret = caretAt(e.clientX, e.clientY);
        const text = caret && caret.node.nodeType === Node.TEXT_NODE && e.target.contains(caret.node) ? caret.node : null;
        const block = text ? paragraphBox(text) : getBlockParent(e.target);
        if (!block || block === document.body || block === document.documentElement) return;
        const sel = window.getSelection();
        if (!sel) return;
        let range = text && visualParagraph(block, text);
        if (!range) {
            const whole = document.createRange();
            whole.selectNodeContents(block);
            range = cleanRange(whole, { snap: false });
        }
        if (!range) return;
        e.preventDefault();
        sel.removeAllRanges();
        sel.addRange(range);
    }

