    // --- Note card (shown when hovering an annotation that has a note) ---

    let hoveredWrapper = null;    // for the keys used without a selection (see pointedGroup)
    let pointer = null;           // where the mouse last went over page content, in the viewport
    let cardWrapper = null;
    let cardHideTimer = null;
    let cardShowTimer = null;
    const pinnedCards = new Map();   // badge (its wrapper) -> the copy of its note card kept open (see pinNoteCard)

    // A note's text with its web addresses as links, opened in a new tab. Punctuation right after
    // an address (a full stop, a closing bracket the address didn't open) stays outside the link.
    const NOTE_URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
    function noteNodes(text) {
        const nodes = [];
        let at = 0;
        for (const m of text.matchAll(NOTE_URL_RE)) {
            let url = m[0];
            for (;;) {
                const last = url.slice(-1);
                const open = { ')': '(', ']': '[', '}': '{' }[last];
                if (/[.,;:!?'"*_]/.test(last) ||
                    (open && url.split(open).length <= url.split(last).length - 1)) url = url.slice(0, -1);
                else break;
            }
            let href;
            try { href = new URL(/^www\./i.test(url) ? `https://${url}` : url); } catch (e) { continue; }
            if (!/^https?:$/.test(href.protocol)) continue;
            if (m.index > at) nodes.push(document.createTextNode(text.slice(at, m.index)));
            nodes.push(makeEl('a', { href: href.href, target: '_blank', rel: 'noopener noreferrer', text: url }));
            at = m.index + url.length;
        }
        if (at < text.length) nodes.push(document.createTextNode(text.slice(at)));
        return nodes;
    }

    // The line of `wrapper` under the pointer (the one nearest to it). Only used when the note
    // badge is out of view.
    function lineUnderPointer(wrapper) {
        const rects = Array.from(wrapper.getClientRects()).filter(r => r.width || r.height);
        if (!rects.length || !pointer) return wrapper.getBoundingClientRect();
        const dist = r => (pointer.y < r.top ? r.top - pointer.y : pointer.y > r.bottom ? pointer.y - r.bottom : 0) +
            (pointer.x < r.left ? r.left - pointer.x : pointer.x > r.right ? pointer.x - r.right : 0) / 1000;
        return rects.reduce((best, r) => (dist(r) < dist(best) ? r : best));
    }

    // Where the card opens: at the note badge (the end of the annotation's last line), so it stays
    // put while the pointer moves between the annotation's lines. When the badge is scrolled out
    // of view, next to the line under the pointer instead.
    function noteCardAnchor(wrapper) {
        const r = badgeAnchor(wrapper);
        return !r || r.bottom < 0 || r.top > window.innerHeight ? lineUnderPointer(wrapper) : r;
    }

    // The end of the annotation's last line, where its note badge is (or would be). The note
    // editor opens here too, like the card.
    function badgeAnchor(wrapper) {
        const mark = groupWrappers(wrapper.getAttribute(GROUP_ATTR)).find(w => w.hasAttribute(NOTE_MARK_ATTR)) || wrapper;
        const rects = Array.from(mark.getClientRects()).filter(r => r.width || r.height);
        const r = rects[rects.length - 1];
        return r && { left: r.right, right: r.right, width: 0, top: r.top, bottom: r.bottom };
    }

    // Shows the note of an annotation once the pointer has rested on its badge for
    // NOTE_CARD_DELAY_MS, so passing over notes on the way somewhere else opens nothing. While a
    // card is open, moving to another note switches at once.
    function scheduleNoteCard(wrapper) {
        clearTimeout(cardHideTimer);
        clearTimeout(cardShowTimer);
        if (sameCard(wrapper)) return;
        if (!noteCardEl.hidden) { showNoteCard(wrapper); return; }
        cardShowTimer = setTimeout(() => {
            if (nearMark === wrapper && wrapper.isConnected && !annotationsHidden && !editor) showNoteCard(wrapper);
        }, NOTE_CARD_DELAY_MS);
    }

    // Another piece of the annotation whose card is open (one split across links) keeps that card.
    function sameCard(wrapper) {
        return !noteCardEl.hidden && cardWrapper && (cardWrapper === wrapper ||
            (cardWrapper.isConnected && wrapper.hasAttribute(GROUP_ATTR) &&
             cardWrapper.getAttribute(GROUP_ATTR) === wrapper.getAttribute(GROUP_ATTR)));
    }

    function showNoteCard(wrapper) {
        clearTimeout(cardHideTimer);
        clearTimeout(cardShowTimer);
        if (sameCard(wrapper)) return;
        ensureUi(wrapper.hasAttribute(DARK_ATTR));
        cardWrapper = wrapper;
        cardText.replaceChildren(...noteNodes(wrapper.getAttribute(NOTE_ATTR) || ''));
        const time = annotationTime(wrapper);
        cardHint.textContent = time ? `Added ${formatDate(time)}` : 'Alt+N to edit';
        noteCardEl.hidden = false;
        nearMark = undefined;   // a card opened by a jump also hides once the mouse moves off any badge
        placePanel(noteCardEl, noteCardAnchor(wrapper), true);
    }

    // Selecting one annotation that has a note shows its note, read-only, for as long as the
    // selection toolbar stays (TOOLBAR_IDLE_MS; pointing at the card keeps it). Clearing the
    // selection, or selecting something else, closes it.
    let selectPreview = false;
    let selectPreviewTimer = null;
    let selectShowTimer = null;
    const SELECT_PREVIEW_DELAY_MS = 150;   // the note follows the selection toolbar a little later
    function previewSelectedNote(groups) {
        if (selectPreview) hideNoteCard();
        const note = groups.length === 1 && !editor && !annotationsHidden &&
            groupWrappers(groups[0]).filter(w => w.hasAttribute(NOTE_ATTR) && w.getClientRects().length).pop();
        if (!note || !note.getAttribute(NOTE_ATTR)) return;
        selectPreview = true;
        selectShowTimer = setTimeout(() => {
            if (selectPreview && note.isConnected && !editor && !annotationsHidden) showNoteCard(note);
        }, SELECT_PREVIEW_DELAY_MS);
        if (!TOOLBAR_IDLE_MS) return;
        selectPreviewTimer = setTimeout(function idle() {
            if (noteCardEl.matches(':hover')) { selectPreviewTimer = setTimeout(idle, 500); return; }
            if (selectPreview) hideNoteCard();
        }, TOOLBAR_IDLE_MS);
    }

    function hideNoteCard() {
        clearTimeout(cardHideTimer);
        clearTimeout(cardShowTimer);
        clearTimeout(selectPreviewTimer);
        clearTimeout(selectShowTimer);
        selectPreview = false;
        if (!noteCardEl.hidden) hideLabelTip();   // its Pin button's tip goes with it
        releaseFocus(noteCardEl);
        noteCardEl.hidden = true;
        cardWrapper = null;
    }

    // The pin button of a note card keeps its note open in a copy of the card, placed where the
    // card was, the badge in the selection outline's color, until the copy's pin button is
    // pressed again or Esc closes the last one pinned; clicks elsewhere leave it open, and any
    // number can be pinned. The copy is in the page layer, so it scrolls with the text; dragged
    // by its footer, it stays where dropped.
    function pinNoteCard() {
        const w = cardWrapper;
        const mark = w && w.isConnected && (w.hasAttribute(NOTE_MARK_ATTR) ? w
            : groupWrappers(w.getAttribute(GROUP_ATTR)).find(m => m.hasAttribute(NOTE_MARK_ATTR)));
        if (!mark || pinnedCards.has(mark)) return;
        const card = noteCardEl.cloneNode(true);
        card.setAttribute('data-pinned', '');
        card.style.animation = 'highlighter-pin var(--durationNormal) var(--easeOut)';
        // The hover card is replaced on the spot: fading out under the copy doubled their borders
        // into a dark flash. The copy only darkens its border at first (see highlighter-pin).
        noteCardEl.style.transition = 'none';
        hideNoteCard();
        noteCardEl.offsetWidth;
        noteCardEl.style.transition = '';
        noteCardEl.after(card);
        pinnedCards.set(mark, card);
        mark.setAttribute(NOTE_PIN_ATTR, '');
        const pin = card.querySelector('.card-actions button');
        pin.replaceChildren(phosphorIcon('push-pin-fill'));
        pin.dataset.label = 'Unpin note';
        pin.setAttribute('aria-label', 'Unpin note');
        pin.setAttribute('aria-pressed', 'true');
        addLabelTip(pin, pin.dataset.label, pin.dataset.shortcut, () => true);   // a copy has no listeners
        pin.addEventListener('click', () => unpinNoteCard(mark));
        card.addEventListener('wheel', keepWheel, { passive: false });
        dragByHandle(card, card.querySelector('.card-footer'), () => true);
    }

    // Alt+L: pins the note card on show, or unpins the note of `group` (the annotation pointed at,
    // else the one selected) when it is pinned already.
    function togglePinKey(group) {
        if (!noteCardEl.hidden) { pinNoteCard(); return; }
        group = group || (selectedGroups.length === 1 ? selectedGroups[0] : null);
        const wrappers = group ? groupWrappers(group) : [];
        const mark = wrappers.find(w => w.hasAttribute(NOTE_MARK_ATTR));
        if (mark && pinnedCards.has(mark)) { unpinNoteCard(mark); return; }
        const note = !editor && !annotationsHidden && wrappers.filter(w => w.hasAttribute(NOTE_ATTR) && w.getClientRects().length).pop();
        if (!note || !note.getAttribute(NOTE_ATTR)) { showToast('No note to pin', { intent: 'warning', icon: 'warning' }); return; }
        showNoteCard(note);
        pinNoteCard();
    }

    // `mark` omitted: every pinned note.
    function unpinNoteCard(mark) {
        (mark ? [mark] : Array.from(pinnedCards.keys())).forEach(m => {
            const card = pinnedCards.get(m);
            if (!card) return;
            releaseFocus(card);
            hideLabelTip();
            card.remove();
            m.removeAttribute(NOTE_PIN_ATTR);
            pinnedCards.delete(m);
        });
    }

    // A pinned note whose badge is gone (note deleted, annotation erased or redrawn) closes.
    function prunePinnedCards() {
        pinnedCards.forEach((card, m) => { if (!m.isConnected || !m.hasAttribute(NOTE_MARK_ATTR)) unpinNoteCard(m); });
    }

    function onMouseOver(e) {
        // Moving into the card keeps it open; nearMark forgotten, the next move off it starts the hide.
        if (isUiEvent(e)) { clearTimeout(cardHideTimer); nearMark = undefined; return; }
        hoveredWrapper = e.target instanceof Element ? e.target.closest(WRAPPER_SELECTOR) : null;
        onMouseMove(e);
    }

    function onMouseMove(e) {
        if (isUiEvent(e)) return;
        pointer = { x: e.clientX, y: e.clientY };
        if (selectPreview && markNear(e.clientX, e.clientY)) selectPreview = false;   // the pointer takes over
        let mark = annotationsHidden || editor ? null : markNear(e.clientX, e.clientY);
        if (pinnedCards.has(mark)) mark = null;   // its note is open already
        if (mark === nearMark) return;
        nearMark = mark;
        if (mark) {
            scheduleNoteCard(mark);
        } else {
            clearTimeout(cardShowTimer);
            if (cardWrapper && !selectPreview) {
                clearTimeout(cardHideTimer);
                cardHideTimer = setTimeout(hideNoteCard, 250);
            }
        }
    }

    // The note card opens for the pointer on or near a note badge (NOTE_BADGE_REACH px around
    // it), not anywhere on the annotation. The badges are looked up again once wrappers change.
    let nearMark = null;
    let noteMarks = null;
    let noteMarksEpoch = -1;
    function markNear(x, y) {
        if (!noteMarks || noteMarksEpoch !== wrapperEpoch) {
            noteMarks = Array.from(document.querySelectorAll(`span[${NOTE_MARK_ATTR}]`));
            noteMarksEpoch = wrapperEpoch;
        }
        return noteMarks.find(m => {
            const b = m.isConnected && noteBadgeHole(m);
            return b && x >= b.left - NOTE_BADGE_REACH && x <= b.left + b.width + NOTE_BADGE_REACH &&
                y >= b.top - NOTE_BADGE_REACH && y <= b.top + b.height + NOTE_BADGE_REACH;
        }) || null;
    }

    // Leaving the window, the mouse points at nothing on the page.
    function onMouseOut(e) {
        if (!e.relatedTarget) { hoveredWrapper = nearMark = null; clearTimeout(cardShowTimer); }
    }

    // Over our own panels the mouse points at no annotation, except on a note card, which is its
    // annotation's.
    uiRoot.addEventListener('mouseover', e => { hoveredWrapper = noteCardEl.contains(e.target) ? cardWrapper : null; });

    // The wheel over the note card or the editor never scrolls the page: their text boxes stop at
    // their ends (overscroll-behavior: contain), and anywhere else on them, or over a note too short
    // to scroll, the wheel is dropped. Ctrl+wheel still zooms.
    function keepWheel(e) {
        if (e.ctrlKey) return;
        const box = e.target.closest('.card-text, textarea');
        if (box && box.scrollHeight > box.clientHeight) return;
        if (e.cancelable) e.preventDefault();
    }
    noteCardEl.addEventListener('wheel', keepWheel, { passive: false });
    editorEl.addEventListener('wheel', keepWheel, { passive: false });

    cardPin.addEventListener('click', pinNoteCard);

    function groupHasNote(group) {
        return groupWrappers(group).some(w => w.getAttribute(NOTE_ATTR));
    }

    // Removes the note; the annotation stays, and Undo brings the note back.
    function deleteGroupNote(group) {
        syncLocation();
        if (editor) cancelEditor();
        const changed = runUndoable(() => setGroupNote(group, ''));
        offerUndo('Note erased', changed);
    }

    // --- Note editor ---

    // { group, original, step, returnFocus, side, anchor, bottom } (the last three are its
    // placement, see placeEditor): step is the undo step that created the annotation
    // for this note; returnFocus is what had focus before the editor opened.
    let editor = null;

    function editorAnchorRect() {
        const wrappers = editor ? groupWrappers(editor.group) : [];
        return wrappers.length ? badgeAnchor(wrappers[wrappers.length - 1]) || null : null;
    }

    // Fits the note box to its text: NOTE_MIN_LINES to NOTE_MAX_LINES lines (20px each, plus
    // 10px of padding), scrolling beyond that.
    // Once the corner handle has been dragged, the user's size wins until the editor reopens.
    let noteInputManuallySized = false;

    function sizeNoteInput() {
        if (noteInputManuallySized) return;
        const min = NOTE_MIN_LINES * 20 + 10;
        const max = NOTE_MAX_LINES * 20 + 10;
        noteInput.style.height = `${min}px`;
        noteInput.style.height = `${Math.min(max, Math.max(min, noteInput.scrollHeight))}px`;
    }

    function resetNoteInputSize() {
        noteInputManuallySized = false;
        noteInput.style.width = '';
        sizeNoteInput();
    }

    // The editor is placed once when it opens and then stays put: resizing or typing never
    // re-centers it. Scrolling moves it by exactly as much as the text it belongs to.
    function placeEditor() {
        const rect = editorAnchorRect();
        if (!rect) return;
        editor.side = placePanel(editorEl, rect, true);
        editor.anchor = inPage(rect);
        editor.bottom = parseFloat(editorEl.style.top) + editorEl.offsetHeight;   // not the rect: the fade-in shifts it
    }

    function followEditorAnchor() {
        const rect = editorAnchorRect();
        if (!rect) {
            // Text the site is redrawing: the note stays open, and Save puts it on the waiting
            // annotation. Gone for good: the note closes, and can be restored.
            if (!waitingRecords(editor.group).length) cancelEditor();
            return;
        }
        const at = inPage(rect);
        const dx = at.left - editor.anchor.left;
        const dy = at.top - editor.anchor.top;
        if (!dx && !dy) return;   // page scrolling alone moves nothing: the editor is in the page
        editorEl.style.left = `${parseFloat(editorEl.style.left) + dx}px`;
        editorEl.style.top = `${parseFloat(editorEl.style.top) + dy}px`;
        editor.anchor = at;
        editor.bottom += dy;
    }

    noteInput.addEventListener('input', () => {
        sizeNoteInput();
        updateSaveState();
        // Opened above the text: grow upward, so the box never covers what it annotates.
        if (editor && editor.side === 'above' && !noteInputManuallySized) {
            editorEl.style.top = `${Math.round(editor.bottom - editorEl.offsetHeight)}px`;
        }
    });

    function noteDraft() {
        return clipNote(noteInput.value.trim());
    }

    // Save is disabled while the note is the same as what is saved.
    function updateSaveState() {
        noteSave.disabled = !editor || noteDraft() === editor.original;
    }

    // A drag of the resize handle starts on the textarea and changes its inline size.
    noteInput.addEventListener('pointerdown', () => {
        const before = `${noteInput.style.width}|${noteInput.style.height}`;
        window.addEventListener('pointerup', () => {
            if (`${noteInput.style.width}|${noteInput.style.height}` !== before) noteInputManuallySized = true;
        }, { once: true, capture: true });
    });

    function focusNoteInput() {
        noteInput.focus({ preventScroll: true });
        // A page that moves focus around in its own key or focus handlers can undo that;
        // try once more after the current event has finished.
        if (document.activeElement !== uiHost) {
            requestAnimationFrame(() => { if (editor) noteInput.focus({ preventScroll: true }); });
        }
    }

    // `draft` reopens a note with text that wasn't saved (see offerDraft).
    // `returnFocus`: where focus goes when the editor closes (by default, what had it before).
    function openNoteEditor(group, { step = null, draft = null, returnFocus = null } = {}) {
        if (editor) {
            if (editor.group === group) {
                if (draft !== null) { noteInput.value = draft; updateSaveState(); sizeNoteInput(); }
                focusNoteInput();
                return;
            }
            cancelEditor();   // one note at a time; moving on discards
        }
        const wrappers = groupWrappers(group);
        if (!wrappers.length) return;
        hideToolbar();
        hideNoteCard();
        pinnedCards.forEach((card, m) => { if (m.getAttribute(GROUP_ATTR) === group) unpinNoteCard(m); });   // the editor takes its place
        ensureUi(wrappers[0].hasAttribute(DARK_ATTR));
        const original = wrappers[0].getAttribute(NOTE_ATTR) || '';
        const focused = document.activeElement;
        if (!returnFocus) returnFocus = focused && focused !== document.body && focused !== uiHost ? focused : null;
        editor = { group, original, step, returnFocus, wasSelected: selectedGroups.includes(group) };
        wrappers.forEach(w => w.setAttribute(NOTE_EDIT_ATTR, ''));
        setSelectedGroups(selectedGroups.concat(group));   // its outline; no toolbar while the editor is open
        editorTitle.textContent = original ? 'Edit note' : 'Add note';
        noteInput.value = draft === null ? original : draft;
        updateSaveState();
        editorEl.hidden = false;
        resetNoteInputSize();
        noteInput.scrollTop = 0;
        placeEditor();
        focusNoteInput();
    }

    function closeEditor() {
        const returnFocus = editor && editor.returnFocus;
        const hadFocus = document.activeElement === uiHost;
        const ed = editor;
        if (ed) groupWrappers(ed.group).forEach(w => w.removeAttribute(NOTE_EDIT_ATTR));
        editor = null;
        if (ed && !ed.wasSelected && selectedGroups.includes(ed.group)) setSelectedGroups(selectedGroups.filter(g => g !== ed.group));
        hideLabelTip();
        releaseFocus(editorEl);
        editorEl.hidden = true;
        if (hadFocus && returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') {
            returnFocus.focus({ preventScroll: true });
        }
        if (penKey) setPen(penKey);   // the pen bar's note button works again
    }

    // Drops the annotation made for a note that never got written.
    // Returns the state it dropped (with the annotation), or null if it couldn't.
    function discardStep(step) {
        if (undoStack[undoStack.length - 1] !== step) return null;
        undoLastAction();
        return redoStack.pop() || null;
    }

    // The records of `group` waiting to come back after the site redrew them (noticed now
    // rather than at the next check).
    function waitingRecords(group) {
        if (anyDetached()) getCurrentRecords();
        return pendingRecords.filter(r => r.group === group);
    }

    function saveEditor() {
        saveEditorNow();
        if (penKey) setPen(penKey);   // the pen bar's note button: Add note becomes Edit note
    }

    function saveEditorNow() {
        if (!editor) return;
        const { group, original, step } = editor;
        const text = noteDraft();
        closeEditor();
        if (!groupWrappers(group).length) { saveWaitingNote(group, original, step, text); return; }
        if (step) {
            if (!text) { discardStep(step); return; }
            if (undoStack[undoStack.length - 1] === step) {
                // Folded into the step that created the annotation: one Alt+Z removes both.
                setGroupNote(group, text);
                saveHighlights();
                scheduleRedraw();
                return;
            }
        }
        if (text !== original) {
            const changed = runUndoable(() => setGroupNote(group, text));
            if (!text) offerUndo('Note erased', changed);
        }
    }

    // The site redrew the annotation's text while its note was open: the note goes on the
    // records waiting for that text, or, if there are none, is offered back.
    function saveWaitingNote(group, original, step, text) {
        if (step && !text) { discardStep(step); return; }
        if (text === original) return;
        const waiting = waitingRecords(group);
        if (!waiting.length) {
            if (text) offerDraft({ group, draft: text, records: null });
            return;
        }
        const changed = runUndoable(() => waiting.forEach(r => { r.note = text || undefined; }));
        if (!text) offerUndo('Note erased', changed);
    }

    // Returns the unsaved text, if any, as { group, draft, records } (see offerDraft), which
    // `offer: false` leaves to the caller to offer.
    function cancelEditor({ offer = true } = {}) {
        if (!editor) return null;
        const { group, original, step } = editor;
        const draft = noteDraft();
        closeEditor();
        const dropped = step ? discardStep(step) : null;
        if (!draft || draft === original) return null;
        const unsaved = { group, draft, records: dropped ? dropped.records.filter(r => r.group === group) : null };
        if (offer) offerDraft(unsaved);
        return unsaved;
    }

    // A note being written when its page goes away (the site shows another page, or the script
    // is turned off) closes, and the highlight made for a new note is dropped from what is saved,
    // as Esc would. Its text can't be offered back on a page that no longer shows it.
    function dropUnwrittenNote() {
        if (!editor) return;
        const { group, step } = editor;
        closeEditor();
        if (!step || !currentKey) return;
        const stored = readRecords(currentKey);
        if (!stored || !stored.some(r => r.group === group)) return;
        const rest = stored.filter(r => r.group !== group);
        if (rest.length) GM_setValue(currentKey, JSON.stringify(rest));
        else GM_deleteValue(currentKey);
    }

    // Only Save saves, but text closed without saving can be brought back from the toast. For a
    // new note, `records` is the highlight that was made for it, which comes back too.
    function offerDraft({ group, draft, records }, message = 'Note not saved', icon = 'pencil-simple') {
        showToast(message, {
            icon,
            action: { label: 'Restore', tip: 'Restore the note', keep: true, run: () => restoreDraft(group, draft, records) }
        });
    }

    function restoreDraft(group, draft, records) {
        syncLocation();
        // Another note being written closes first, while its own highlight can still go with it.
        if (editor && editor.group !== group) cancelEditor();
        let step = null;
        if (records && records.length && !groupWrappers(group).length) {
            step = runUndoable(() => { renderRecords(records, { animate: false }); });
        }
        if (groupWrappers(group).length) { openNoteEditor(group, { step, draft }); return; }
        // Its text has been annotated since: the draft goes to that annotation instead.
        const located = records && records.length ? locateRecord(records[0], buildTextIndex) : null;
        const cover = located && candidateWrappers(located.range)[0];
        if (!cover) return;
        const existing = cover.getAttribute(NOTE_ATTR);
        openNoteEditor(cover.getAttribute(GROUP_ATTR), { draft: existing ? clipNote(`${existing}\n\n${draft}`) : draft });
    }

    noteSave.addEventListener('click', () => saveEditor());
    noteDiscard.addEventListener('click', () => cancelEditor());
    // An existing note is removed (its annotation stays), with Undo; a new one is dropped along
    // with the highlight that was made for it, and what was typed in it can be restored, both.
    noteDelete.addEventListener('click', () => {
        const unsaved = editor && editor.step && noteDraft() ? cancelEditor({ offer: false }) : null;
        if (unsaved) { offerDraft(unsaved, 'Note erased', 'eraser'); return; }
        noteInput.value = '';
        saveEditor();
    });
    editorEl.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelEditor();
        } else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target === noteInput) {
            // Enter saves; Shift+Enter starts a new line. On a button, Enter presses that button.
            e.preventDefault();
            saveEditor();
        } else if (e.key === 'Delete' && !e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && !e.isComposing
            && !(e.target === noteInput && noteInput.selectionEnd < noteInput.value.length)
            && noteInput.selectionStart === noteInput.selectionEnd) {
            // Delete deletes the note, as its Delete button does, unless it has text after the
            // caret (or selected) to delete.
            e.preventDefault();
            noteDelete.click();
        } else if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey) {
            // Tab and Shift+Tab go round the editor's controls instead of leaving it.
            const stops = [noteSave, noteDiscard, noteDelete, noteInput].filter(el => !el.hidden && !el.disabled);
            const i = stops.indexOf(uiRoot.activeElement);
            e.preventDefault();
            stops[i < 0 ? 0 : (i + (e.shiftKey ? -1 : 1) + stops.length) % stops.length].focus();
        }
    });

