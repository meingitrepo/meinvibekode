    // =====================================================================
    // Applying and removing annotations
    // =====================================================================

    // Which part of `block`'s text does the range cover? Returns [start, end).
    function selectionSpanInBlock(range, block) {
        const blockRange = document.createRange();
        blockRange.selectNodeContents(block);
        let s = 0;
        let e = block.textContent.length;
        if (range.compareBoundaryPoints(Range.START_TO_START, blockRange) > 0) {
            s = computeOffsetWithinBlock(block, range.startContainer, range.startOffset);
        }
        if (range.compareBoundaryPoints(Range.END_TO_END, blockRange) < 0) {
            e = computeOffsetWithinBlock(block, range.endContainer, range.endOffset);
        }
        dropRange(blockRange);
        return [s, e];
    }

    // Existing annotations that share at least one character with the range.
    function findOverlaps(range) {
        const result = [];
        candidateWrappers(range).forEach(wrapper => {
            const block = getBlockParent(wrapper);
            const { start, end } = wrapperExtent(wrapper, block);
            const [s, e] = selectionSpanInBlock(range, block);
            if (Math.max(start, s) < Math.min(end, e)) {
                result.push({
                    wrapper, block, start, end, s, e,
                    key: wrapper.getAttribute(STYLE_ATTR),
                    group: wrapper.getAttribute(GROUP_ATTR),
                    note: wrapper.getAttribute(NOTE_ATTR),
                    added: +wrapper.getAttribute(ADDED_ATTR) || undefined,
                    page: wrapper.hasAttribute(PAGE_ATTR) ? wrapper.getAttribute(PAGE_ATTR) : undefined
                });
            }
        });
        return result;
    }

    // Returns the wrappers of the new annotation. `own` ({ group, note, added }) gives it an
    // identity of its own (a saved annotation attached to new text) instead of inheriting one.
    function applyAnnotation(range, key, overlaps, own = null) {
        if (!hasOwn(STYLES, key)) return [];

        // Everything is measured before the first DOM change, because unwrapping invalidates the range.
        const startBlock = getBlockParent(range.startContainer);
        const endBlock = getBlockParent(range.endContainer);
        let startOff = computeOffsetWithinBlock(startBlock, range.startContainer, range.startOffset);
        let endOff = computeOffsetWithinBlock(endBlock, range.endContainer, range.endOffset);

        // Annotations of the same style merge with the new one: it grows to cover them. One that
        // starts before the selection contains the selection's start, so it is in startBlock
        // (and likewise at the end). Those of other styles stay as they are, sharing the text.
        const same = overlaps.filter(o => o.key === key);
        same.forEach(o => {
            if (o.start < o.s) startOff = Math.min(startOff, o.start);
            if (o.end > o.e) endOff = Math.max(endOff, o.end);
        });

        const meta = inheritedMeta(same, own);

        const blocks = new Set([startBlock, endBlock]);
        same.forEach(o => { blocks.add(o.block); unwrapWrapper(o.wrapper); });
        blocks.forEach(normalizeBlock);

        const sp = findNodeAtOffset(startBlock, startOff, 'start');
        const ep = findNodeAtOffset(endBlock, endOff, 'end');
        let created = [];
        if (sp && ep) {
            try {
                const clean = document.createRange();
                clean.setStart(sp.node, sp.offset);
                clean.setEnd(ep.node, ep.offset);
                created = wrapRange(clean, key, { group: meta.group, note: meta.note, added: meta.added, page: meta.page });
                dropRange(clean);
            } catch (e) {
                console.warn(`${LOG} could not annotate selection`, e);
            }
        }
        // Pieces of a merged annotation outside the selection (beyond a link, say, or waiting to
        // come back) join the new one.
        if (created.length && meta.absorbed.length) {
            allWrappers().forEach(w => {
                if (!meta.absorbed.includes(w.getAttribute(GROUP_ATTR))) return;
                w.setAttribute(GROUP_ATTR, meta.group);
                if (meta.note) w.setAttribute(NOTE_ATTR, meta.note);
                else w.removeAttribute(NOTE_ATTR);
                if (meta.added) w.setAttribute(ADDED_ATTR, String(meta.added));
                else w.removeAttribute(ADDED_ATTR);
                if (typeof meta.page === 'string') w.setAttribute(PAGE_ATTR, meta.page);
                else w.removeAttribute(PAGE_ATTR);
            });
            pendingRecords.forEach(r => {
                if (!meta.absorbed.includes(r.group)) return;
                r.group = meta.group;
                r.note = meta.note;
                r.added = meta.added;
                r.page = meta.page;
            });
        }

        showWrappers(created, true);
        return created;
    }

    // The parts of overlapping annotations (see findOverlaps) outside the selection, which stay
    // as they are, note included. A part that is only spaces would not be drawn: it doesn't count.
    // With trimCut (the eraser), the pieces also lose the spaces next to the cut, so no
    // marked space is left hanging where the erased text was.
    function outsideParts(overlaps, { trimCut = false } = {}) {
        const parts = [];
        const textOf = new Map();
        overlaps.forEach(o => {
            if (!textOf.has(o.block)) textOf.set(o.block, o.block.textContent);
            const text = textOf.get(o.block);
            let s = o.s, e = o.e;
            if (trimCut) {
                while (s > o.start && /\s/.test(text[s - 1])) s--;
                while (e < o.end && /\s/.test(text[e])) e++;
            }
            const meta = { group: o.group || newGroupId(), note: o.note, added: o.added, page: o.page };
            if (o.start < s && text.slice(o.start, s).trim()) parts.push({ block: o.block, start: o.start, end: s, key: o.key, meta });
            if (e < o.end && text.slice(e, o.end).trim()) parts.push({ block: o.block, start: e, end: o.end, key: o.key, meta });
        });
        return parts;
    }

    // Wraps parts from outsideParts again, once their old wrappers are gone.
    function rewrap(parts) {
        const wrappers = [];
        parts.forEach(p => {
            const range = rangeFromOffsets(p.block, p.start, p.end);
            if (range) wrappers.push(...wrapRange(range, p.key, p.meta));
            dropRange(range);
        });
        return wrappers;
    }

    // The new annotation takes over the identity and note of the same-style annotations it
    // merges with (`same`). Notes of several are joined in text order.
    function inheritedMeta(same, own) {
        const absorbed = [];
        const notes = [];
        same.forEach(o => {   // in document order
            if (!o.group || absorbed.includes(o.group)) return;
            absorbed.push(o.group);
            if (o.note && !notes.includes(o.note)) notes.push(o.note);
        });
        if (own && own.note && !notes.includes(own.note)) notes.unshift(own.note);
        const group = own ? own.group : absorbed[0] || newGroupId();
        const from = same.find(o => o.group === group);
        return {
            group,
            note: clipNote(notes.join('\n\n')) || undefined,
            added: own ? own.added : from && from.added,
            page: pageTag(),   // made here, whatever it absorbed
            absorbed
        };
    }

    // The styles all of the selected text has (it can have several: see collectTextNodes):
    // choosing one of them again removes those annotations, and its toolbar button shows
    // pressed. `range` is a cleaned selection (cleanRange).
    function selectionStyles(range, overlaps) {
        return Array.from(new Set(overlaps.map(o => o.key))).filter(key => !collectTextNodes(range, key).nodes.some(n => {
            const from = n === range.startContainer ? range.startOffset : 0;
            const to = n === range.endContainer ? range.endOffset : n.nodeValue.length;
            return !!n.nodeValue.slice(from, to).trim();
        }));
    }

    // Removes whole annotations: every piece of them, also pieces waiting to come back.
    function removeGroups(groups) {
        unwrapMany(allWrappers().filter(w => groups.has(w.getAttribute(GROUP_ATTR))));
        pendingRecords = pendingRecords.filter(r => !groups.has(recordOwner(r)));
    }

    // The eraser: takes the annotations off exactly the selected text. What is left of them on
    // either side stays, with its note.
    function eraseOverlaps(overlaps) {
        const remainders = outsideParts(overlaps, { trimCut: true });
        const blocks = new Set(overlaps.map(o => o.block));
        overlaps.forEach(o => unwrapWrapper(o.wrapper));
        blocks.forEach(normalizeBlock);
        showWrappers(rewrap(remainders), false);
    }

    // --- Undo / redo ---

    function captureState() {
        return { records: getCurrentRecords(), pending: pendingRecords.map(r => ({ ...r })) };
    }

    function pushLimited(stack, state) {
        stack.push(state);
        if (stack.length > UNDO_STACK_LIMIT) stack.shift();
    }

    // Runs a change, and records an undo step only if the stored state actually changed.
    // Returns that step (null if nothing changed), for an Undo button offered afterwards.
    function runUndoable(action) {
        setAnnotationsHidden(false);   // never change annotations the user can't see
        const before = captureState();
        const beforeJson = JSON.stringify(before);
        action();
        if (cardWrapper && !cardWrapper.isConnected) hideNoteCard();   // its annotation is gone
        refreshNoteMarks();
        const after = captureState();
        let step = null;
        if (JSON.stringify(after) !== beforeJson) {
            pushLimited(undoStack, before);
            redoStack.length = 0;
            step = before;
        }
        saveHighlights(after.records);
        scheduleRedraw();
        return step;
    }

    // How many annotations the records make up (the pieces of one annotation share a group).
    function countAnnotations(records) {
        return new Set(records.map(r => r.group || recordSignature(r))).size;
    }

    function annotationsText(n) {
        return n === 1 ? '1 annotation' : `${n} annotations`;
    }

    // Toasts say what happened, in past tense: "2 annotations erased".
    function doneText(verb, n) {
        return `${annotationsText(n)} ${verb}`;
    }

    function applyState(state) {
        resetUi();
        stopLateWatcher();
        unwrapAll();
        trackedRecords.clear();   // the state is the whole truth; renderRecords tracks what it places
        const { failed } = renderRecords(state.records.concat(state.pending), { animate: false });
        pendingRecords = failed;
        saveHighlights();
        startLateWatcher();
        scheduleRedraw();
    }

    // Undo moves a state from undoStack to the page and the page's state to redoStack; redo the reverse.
    function stepHistory(from, to) {
        const state = from.pop();
        if (!state) return;
        setAnnotationsHidden(false);
        pushLimited(to, captureState());
        applyState(state);
    }

    // Each says what it did and offers the opposite, as a link.
    function undoLastAction() {
        if (!undoStack.length) return;
        stepHistory(undoStack, redoStack);
        showToast('Undone', { icon: 'arrow-u-up-left' });
    }

    function redoLastAction() {
        if (!redoStack.length) return;
        stepHistory(redoStack, undoStack);
        showToast('Redone', { icon: 'arrow-u-up-right' });
    }

    // The menu's commands. A note being written closes first, as Esc would (a highlight made for a
    // new one goes with it, before the command's own undo step), and its text is offered back
    // afterwards, in place of the command's message: Alt+Z still undoes the command.
    function clearPageAnnotations() {
        if (!running) return;
        syncLocation();
        cancelEditor();
        resetUi();
        const erased = countAnnotations(getCurrentRecords());
        const step = runUndoable(() => {
            stopLateWatcher();
            pendingRecords = pendingRecords.filter(isOtherPage);   // they belong to other pages
            unwrapAll();
        });
        startLateWatcher();
        if (step) offerUndo(doneText('erased', erased));
    }

    // Annotations of a style that no longer exists aren't missing, only hidden, and those made on
    // another page sharing this one's key belong there: they stay (see missingRecords).
    function forgetMissingAnnotations() {
        if (!running) return;
        syncLocation();
        if (!countAnnotations(missingRecords())) return;
        cancelEditor();
        // Read after the note closes: dropping a new note's highlight goes back a step (see
        // discardStep), which rebuilds the list of waiting records.
        const missing = missingRecords();
        runUndoable(() => {
            stopLateWatcher();
            pendingRecords = pendingRecords.filter(r => !missing.includes(r));
        });
        startLateWatcher();
    }

