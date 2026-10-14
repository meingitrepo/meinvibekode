    // --- Selecting annotations by clicking them ---

    // A plain click on an annotation (not a drag, not on a link or a control inside it) selects
    // it and draws a dashed outline around its lines; Ctrl+click (Cmd+click on a Mac) adds one to the
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
    const SELECT_BOX_RADIUS = 4;
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
            const outline = svgEl('svg', { 'aria-hidden': 'true' });
            outline.appendChild(svgEl('path', {}));
            const el = makeEl('div', { class: 'select-box', 'data-theme': first && first.hasAttribute(DARK_ATTR) ? 'dark' : 'light', hidden: '' },
                [outline]);
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

    function groupClientRects(groups) {
        return annotationsHidden ? [] : [].concat(groups).flatMap(groupWrappers)
            .flatMap(w => Array.from(w.getClientRects())).filter(r => r.width || r.height);
    }

    // The box around all of an annotation's lines (of several: around all of them), in the
    // viewport; null when none of it is shown.
    function groupRect(groups) {
        const rects = groupClientRects(groups);
        if (!rects.length) return null;
        const top = Math.min(...rects.map(r => r.top)) - SELECT_BOX_PAD;
        const left = Math.min(...rects.map(r => r.left)) - SELECT_BOX_PAD;
        const bottom = Math.max(...rects.map(r => r.bottom)) + SELECT_BOX_PAD;
        const right = Math.max(...rects.map(r => r.right)) + SELECT_BOX_PAD;
        return { top, left, bottom, right, width: right - left, height: bottom - top };
    }

    // The dashed outline around an annotation's lines, following the text's shape: one row per
    // line, from where the text starts on the first line to where it ends on the last, the rows
    // joined halfway between lines into one outline with rounded corners. Rows that don't touch
    // (a line ending left of where the line above it starts) get outlines of their own. Returns
    // the box holding them all, in the viewport, and the outlines as path data within it.
    // `rects`: the annotation's line boxes (groupClientRects).
    function groupOutline(rects) {
        const rows = [];
        rects.slice().sort((a, b) => a.top - b.top).forEach(r => {
            const row = rows.find(o => Math.min(o.bottom, r.bottom) - Math.max(o.top, r.top) > Math.min(o.bottom - o.top, r.height) / 2);
            if (row) Object.assign(row, { top: Math.min(row.top, r.top), bottom: Math.max(row.bottom, r.bottom), left: Math.min(row.left, r.left), right: Math.max(row.right, r.right) });
            else rows.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
        });
        rows.sort((a, b) => a.top - b.top).forEach(o => {
            o.top = Math.round(o.top - SELECT_BOX_PAD); o.bottom = Math.round(o.bottom + SELECT_BOX_PAD);
            o.left = Math.round(o.left - SELECT_BOX_PAD); o.right = Math.round(o.right + SELECT_BOX_PAD);
        });
        const rect = {
            top: Math.min(...rows.map(o => o.top)), left: Math.min(...rows.map(o => o.left)),
            bottom: Math.max(...rows.map(o => o.bottom)), right: Math.max(...rows.map(o => o.right)),
        };
        rect.width = rect.right - rect.left; rect.height = rect.bottom - rect.top;
        // Split into runs of rows that touch, each meeting the next halfway between them.
        const runs = [];
        rows.forEach((o, i) => {
            const prev = rows[i - 1];
            if (prev && o.left < prev.right && o.right > prev.left) {
                const mid = Math.round((prev.bottom + o.top) / 2);
                prev.bottom = mid; o.top = mid;
                runs[runs.length - 1].push(o);
            } else runs.push([o]);
        });
        const d = runs.map(run => {
            // Down the right side, each row's top to its bottom, then up the left side.
            const pts = run.flatMap(o => [[o.right, o.top], [o.right, o.bottom]]);
            for (let i = run.length - 1; i >= 0; i--) pts.push([run[i].left, run[i].bottom], [run[i].left, run[i].top]);
            return roundedPath(cleanPolygon(pts), SELECT_BOX_RADIUS, rect);
        }).join(' ');
        return { rect, d };
    }

    // Drops repeated points and points in the middle of a straight edge.
    function cleanPolygon(pts) {
        let out = pts.filter((p, i) => { const q = pts[(i + 1) % pts.length]; return p[0] !== q[0] || p[1] !== q[1]; });
        out = out.filter((p, i) => {
            const a = out[(i + out.length - 1) % out.length], b = out[(i + 1) % out.length];
            return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
        });
        return out;
    }

    // A closed path through the points, each corner rounded (by less where an edge is short),
    // relative to the box's top left.
    function roundedPath(pts, radius, box) {
        const n = pts.length;
        const at = ([x, y]) => `${x - box.left} ${y - box.top}`;
        const toward = (p, q, len) => {
            const dist = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
            return [p[0] + (q[0] - p[0]) * len / dist, p[1] + (q[1] - p[1]) * len / dist];
        };
        const half = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]) / 2;
        let d = '';
        pts.forEach((p, i) => {
            const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
            const r = Math.min(radius, half(a, p), half(p, b));
            const from = toward(p, a, r), to = toward(p, b, r);
            d += `${i ? 'L' : 'M'}${at(from)} Q${at(p)} ${at(to)} `;
        });
        return `${d}Z`;
    }

    // Each frame while any is selected: the boxes follow their annotations through scrolling,
    // reflow and redraws, and go when they do (removed, undone, hidden by Alt+V).
    function followSelectBoxes() {
        selectFrame = 0;
        if (!selectedGroups.length) return;
        const rects = new Map(selectedGroups.map(g => [g, groupClientRects(g)]));
        const gone = selectedGroups.filter(g => !rects.get(g).length);
        if (gone.length) {
            setSelectedGroups(selectedGroups.filter(g => !gone.includes(g)));
            if (!selectedGroups.length) return;
        }
        selectedGroups.forEach(g => {
            const box = selectBoxes.get(g);
            const { rect, d } = groupOutline(rects.get(g));
            const at = `${rect.left},${rect.top},${rect.width},${rect.height} ${d}`;
            if (at !== box.at) {
                box.at = at;
                Object.assign(box.el.style, { top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px` });
                box.el.firstChild.firstChild.setAttribute('d', d);   // not innerHTML: see makeEl
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
