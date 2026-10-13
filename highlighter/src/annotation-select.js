    // --- Selecting annotations by clicking them ---

    // A plain click on an annotation (not a drag, not on a link or a control inside it) selects
    // it and draws a dashed box around all of it; Ctrl+click (Cmd+click on a Mac) adds one to the
    // selection or takes it out, and Shift+click selects the annotations from the one selected
    // last to the one clicked, in reading order, and no others. While annotations are selected
    // the keys act on all of them, with or without Alt: a style key restyles them (the style all
    // of them have removes them), Delete or Backspace removes them, N edits the note of the
    // first, Esc lets them go. The selection toolbar shows over them too, its buttons acting on
    // them. Clicking elsewhere or selecting text lets them go as well. Each change is one step
    // for Undo.
    let selectedGroups = [];      // in the order they were selected; the last is Shift+click's start
    let selectFrame = 0;
    const selectBoxes = new Map();   // group -> { el, at }, `at` its last position

    const SELECT_BOX_PAD = 4;
    const CLICK_THROUGH_SELECTOR = 'a[href], button, input, select, textarea, label, summary, [role="button"], [role="link"], [contenteditable=""], [contenteditable="true"]';

    // The selected annotations in reading order.
    function selectedInOrder() {
        const order = groupsInOrder();
        return selectedGroups.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }

    function groupsInOrder() {
        return Array.from(new Set(allWrappers().map(w => w.getAttribute(GROUP_ATTR))));
    }

    function setSelectedGroups(groups) {
        selectedGroups = Array.from(new Set(groups));
        selectBoxes.forEach(({ el }, g) => { if (!selectedGroups.includes(g)) { el.remove(); selectBoxes.delete(g); } });
        if (!selectedGroups.length) { clearSelectedGroups(); return; }
        selectedGroups.forEach(g => {
            if (selectBoxes.has(g)) return;
            const first = groupWrappers(g)[0];
            const el = makeEl('div', { class: 'select-box', 'data-theme': first && first.hasAttribute(DARK_ATTR) ? 'dark' : 'light', hidden: '' });
            selectBoxesEl.appendChild(el);
            selectBoxes.set(g, { el, at: '' });
        });
        ensureUi();
        if (!selectFrame) followSelectBoxes();
        scheduleToolbar();   // the selection toolbar, for these annotations (see showGroupToolbar)
    }

    function clearSelectedGroups() {
        selectedGroups = [];
        cancelAnimationFrame(selectFrame);
        selectFrame = 0;
        selectBoxes.forEach(({ el }) => el.remove());
        selectBoxes.clear();
        if (toolbarGroups) hideToolbar();
    }

    // The box around all of an annotation's lines (of several: around all of them), in the
    // viewport; null when none of it is shown.
    function groupRect(groups) {
        const rects = annotationsHidden ? [] : [].concat(groups).flatMap(groupWrappers)
            .flatMap(w => Array.from(w.getClientRects())).filter(r => r.width || r.height);
        if (!rects.length) return null;
        const top = Math.min(...rects.map(r => r.top)) - SELECT_BOX_PAD;
        const left = Math.min(...rects.map(r => r.left)) - SELECT_BOX_PAD;
        const bottom = Math.max(...rects.map(r => r.bottom)) + SELECT_BOX_PAD;
        const right = Math.max(...rects.map(r => r.right)) + SELECT_BOX_PAD;
        return { top, left, bottom, right, width: right - left, height: bottom - top };
    }

    // Each frame while any is selected: the boxes follow their annotations through scrolling,
    // reflow and redraws, and go when they do (removed, undone, hidden by Alt+V).
    function followSelectBoxes() {
        selectFrame = 0;
        if (!selectedGroups.length) return;
        const gone = selectedGroups.filter(g => !groupRect(g));
        if (gone.length) {
            setSelectedGroups(selectedGroups.filter(g => !gone.includes(g)));
            if (!selectedGroups.length) return;
        }
        selectedGroups.forEach(g => {
            const box = selectBoxes.get(g);
            const rect = groupRect(g);
            const at = [rect.top, rect.left, rect.width, rect.height].map(Math.round).join(',');
            if (at !== box.at) {
                box.at = at;
                const [t, l, w, h] = at.split(',');
                Object.assign(box.el.style, { top: `${t}px`, left: `${l}px`, width: `${w}px`, height: `${h}px` });
            }
            box.el.hidden = false;
        });
        selectFrame = requestAnimationFrame(followSelectBoxes);
    }

    // Where a click would select: the annotation's group, or null for a click that isn't one.
    function clickedGroup(e) {
        const target = e.target instanceof Element ? e.target : null;
        const w = target && target.closest(WRAPPER_SELECTOR);
        if (!w || e.button !== 0 || e.altKey || annotationsHidden || penKey || target.closest(CLICK_THROUGH_SELECTOR)) return null;
        return w.getAttribute(GROUP_ATTR);
    }

    // Shift+click would extend the page's text selection from the caret: with annotations
    // selected (or no text selected), it selects annotations instead.
    function onSelectMouseDown(e) {
        if (isUiEvent(e) || !(e.shiftKey || e.ctrlKey || e.metaKey) || !clickedGroup(e)) return;
        if (e.shiftKey && !selectedGroups.length && getActiveRange()) return;
        e.preventDefault();
    }

    function onDocumentClick(e) {
        if (isUiEvent(e)) return;   // the note card, the toast's Undo: the selection stays
        const group = clickedGroup(e);
        if (!group || getActiveRange()) { clearSelectedGroups(); return; }
        if (e.ctrlKey || e.metaKey) {
            setSelectedGroups(selectedGroups.includes(group) ? selectedGroups.filter(g => g !== group) : selectedGroups.concat(group));
        } else if (e.shiftKey && selectedGroups.length) {
            const order = groupsInOrder();
            const from = order.indexOf(selectedGroups[selectedGroups.length - 1]);
            const to = order.indexOf(group);
            const span = order.slice(Math.min(from, to), Math.max(from, to) + 1);
            // Just these, as in a file list; the one selected last stays the start, so another
            // Shift+click goes from it again.
            setSelectedGroups(span.filter(g => g !== order[from]).concat(order[from]));
        } else if (selectedGroups.length !== 1 || selectedGroups[0] !== group) {
            setSelectedGroups([group]);
        }
    }

    // Selecting text lets the annotations go.
    function onSelectionForGroup() {
        if (selectedGroups.length && getActiveRange()) clearSelectedGroups();
    }

    // Removes every annotation in `groups`, as one step for Undo.
    function deleteGroups(groups, message = `Removed ${annotationsText(groups.length)}`) {
        if (groups.length === 1) { deleteAnnotation(groups[0], message); return; }
        syncLocation();
        if (editor) cancelEditor({ offer: !groups.includes(editor.group) });
        const live = groups.filter(g => groupWrappers(g).length);
        if (!live.length) return;
        const step = runUndoable(() => {
            live.forEach(g => unwrapMany(groupWrappers(g)));
            pendingRecords = pendingRecords.filter(r => !live.includes(recordOwner(r)));
        });
        offerUndo(message, step);
    }

    // The keys for the selected annotations, with or without Alt (see onKeyDown). True if used.
    function selectedGroupKey(e) {
        if (!selectedGroups.length || e.ctrlKey || e.metaKey || e.isComposing) return false;
        if (isUiEvent(e) || isEditableTarget(e) || getActiveRange()) return false;
        const groups = selectedInOrder();
        if (e.key === 'Escape' && !e.altKey) {
            clearSelectedGroups();
        } else if (e.shiftKey) {
            return false;
        } else if (e.code === 'Delete' || e.code === 'Backspace') {
            deleteGroups(groups);
        } else if (e.code === 'KeyN') {
            openNoteEditor(groups[0]);
        } else if (CODE_TO_STYLE.has(e.code)) {
            syncLocation();
            restyleGroups(groups, CODE_TO_STYLE.get(e.code));
            refreshGroupToolbar();
        } else {
            return false;
        }
        e.preventDefault();
        e.stopPropagation();   // the page's own single-key shortcuts stay out of it
        return true;
    }
