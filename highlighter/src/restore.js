    // =====================================================================
    // Restoring
    // =====================================================================

    // XPath + offset -> unique context inside that block -> context anywhere in the document ->
    // context that agrees well enough, in that block, then anywhere (see looseLocate).
    // `strict` is for annotations the site redrew: their text may now be somewhere else
    // entirely (a recycled list row, say), so only their exact, unique context will do.
    function locateRecord(record, getIndex, strict = false) {
        const block = getElementByXPath(record.xpath);
        const located = exactLocate(record, block, getIndex, strict);
        if (located || strict) return located;
        if (block) {
            const at = looseLocate(block.textContent, record);
            const range = at === -1 ? null : rangeFromOffsets(block, at, at + record.text.length);
            if (range) return { range, relocated: true };
        }
        const index = getIndex();
        const at = looseLocate(index.text, record);
        const range = at === -1 ? null : indexRange(index, at, record.text.length);
        return range ? { range, relocated: true } : null;
    }

    function exactLocate(record, block, getIndex, strict) {
        if (block) {
            let start = record.startOffset;
            let length = record.length;
            let relocated = false;
            let usable = true;
            if (strict || !offsetMatchesText(block, start, length, record.text)) {
                const fz = fuzzyLocate(block, record, strict);
                if (fz) { relocated = fz.startOffset !== start || fz.length !== length; start = fz.startOffset; length = fz.length; }
                else usable = false;
            }
            if (usable) {
                const range = rangeFromOffsets(block, start, start + length);
                if (range) return { range, relocated };
            }
        }
        const range = globalLocate(record, getIndex(), strict);
        return range ? { range, relocated: true } : null;
    }

    // Is the record's own text, at its own place, all of it already annotated this way? Then the
    // record repeats an annotation that is on the page (one the site put back, or the user made
    // again), and can go. The same text elsewhere is another annotation. A note the copy on the
    // page lacks moves over to it; a different note keeps the record waiting.
    function absorbDuplicate(range, record) {
        const block = getBlockParent(range.startContainer);
        if (getElementByXPath(record.xpath) !== block ||
            computeOffsetWithinBlock(block, range.startContainer, range.startOffset) !== record.startOffset) return false;
        // Nothing was wrapped, so the text has this style all over, maybe with others (see
        // collectTextNodes).
        const wrappers = candidateWrappers(range).filter(w => w.getAttribute(STYLE_ATTR) === record.key);
        if (!wrappers.length) return false;
        const notes = new Set(wrappers.map(w => w.getAttribute(NOTE_ATTR) || ''));
        if (!record.note || (notes.size === 1 && notes.has(record.note))) { wrappers.forEach(trackShown); return true; }
        const groups = new Set(wrappers.map(w => w.getAttribute(GROUP_ATTR)));
        if (groups.size !== 1 || notes.size !== 1 || !notes.has('')) return false;
        setGroupNote(Array.from(groups)[0], record.note);
        wrappers.forEach(trackShown);
        return true;
    }

    function renderRecords(records, { animate = ANIMATE_ON_RESTORE } = {}) {
        const failed = [];
        const placed = [];
        let relocated = false;
        let stamped = false;   // an annotation got its "added" date now (see groupTime)
        let dropped = 0;
        let textIndex = null;
        const getIndex = () => textIndex || (textIndex = buildTextIndex());

        // Every record is located before anything is wrapped, so one text index serves them
        // all (wrapping splits text nodes, which would make the index stale). The ranges are
        // live: wrapping one record moves the others' boundaries along with their text.
        // A record whose style no longer exists stays saved, unplaced, until the style is back.
        const targets = records.map(record => ({
            record,
            located: hasOwn(STYLES, record.key) ? locateRecord(record, getIndex, isReclaimed(record)) : null
        }));
        // Backgrounds are read now, while nothing has changed, so wrapping doesn't make the
        // browser recompute styles once per wrapper (see darkBehind's cache).
        targets.forEach(({ located }) => {
            if (located) { darkBehind(located.range.startContainer); darkBehind(located.range.endContainer); }
        });
        // Records can share text (in different styles), and wrapping one moves the live ranges
        // of the others that overlap it. Offsets in the block's text don't move.
        targets.forEach(t => {
            if (!t.located) return;
            const r = t.located.range;
            const block = getBlockParent(r.startContainer);
            if (block !== getBlockParent(r.endContainer)) return;
            t.spot = { block, start: computeOffsetWithinBlock(block, r.startContainer, r.startOffset), end: computeOffsetWithinBlock(block, r.endContainer, r.endOffset) };
        });

        const place = (record, located, range) => {
            const group = typeof record.group === 'string' && record.group ? record.group : legacyGroup(record);
            // An annotation whose group carries no date is dated by its first restore.
            const added = record.added || (groupTime(group) ? undefined : Date.now());
            const wrappers = wrapRange(range, record.key, { group, note: record.note, added, page: record.page });
            if (!wrappers.length) {
                // A duplicate of what is already there goes (`dropped` asks the caller to save).
                if (absorbDuplicate(range, record)) { dropped++; releaseReclaimed(record); }
                else failed.push(record);
                return;
            }
            releaseReclaimed(record);   // back: from now on, like any other annotation
            wrappers.forEach(w => trackedRecords.set(w, record));
            placed.push(...wrappers);
            if (located.relocated) relocated = true;
            if (added !== record.added) stamped = true;
        };
        targets.forEach(({ record, located, spot }) => {
            if (!located) { failed.push(record); return; }
            const range = (spot && rangeFromOffsets(spot.block, spot.start, spot.end)) || located.range;
            place(record, located, range);
            dropRange(range);   // the others' stay live until their turn
            dropRange(located.range);
        });

        showWrappers(placed, animate);
        return { failed, placed, relocated, stamped, dropped };
    }

    // Records that missed on MAX_RESTORE_MISSES visits are kept, but no longer watched for,
    // unless the site redrew them during this visit. Records whose style no longer exists
    // aren't watched either.
    function isWatched(record) {
        return hasOwn(STYLES, record.key) && !stubbornIds.has(recordId(record))
            && (isReclaimed(record) || (record.misses || 0) < MAX_RESTORE_MISSES);
    }

    // One watcher, one queue: pendingRecords is the only list of unplaced records.
    let lateWatcher = null;

    function stopLateWatcher() {
        if (!lateWatcher) return;
        clearTimeout(lateWatcher.timer);
        clearTimeout(lateWatcher.deadline);
        lateWatcher.observer.disconnect();
        lateWatcher = null;
    }

    // Retries as the page changes, for content that loads late (comments, "load more"): closely
    // during a first window (LATE_CONTENT_GIVE_UP_MS or LATE_CONTENT_MAX_ATTEMPTS tries, from
    // when the page is first in view), after which what is still missing counts as missed on
    // this visit; then lightly, at most every LATE_CONTENT_SLOW_RETRY_MS and only when added
    // content holds a waiting annotation's text, for as long as the page is open. A tab in the
    // background pauses that until it is shown. `all` marks the first window of a visit, which
    // counts misses; `reclaimedOnly` starts over closely for annotations the site redrew.
    function startLateWatcher({ reclaimedOnly = false } = {}) {
        stopLateWatcher();
        if (!pendingRecords.some(isWatched) || !document.body) return;
        const state = {
            all: !reclaimedOnly, slow: false, attempts: 0, startedAt: document.hidden ? null : Date.now(),
            timer: null, deadline: null, observer: null, retryOnShow: false, texts: null, textsOf: null, textsCount: 0
        };
        state.observer = new MutationObserver(mutations => {
            if (state.timer || state.retryOnShow || (state.slow && !mayBringBack(state, mutations))) return;
            if (state.slow && document.hidden) { state.retryOnShow = true; return; }   // retried when the tab is shown
            state.timer = setTimeout(() => { state.timer = null; retryPending(state); },
                state.slow ? LATE_CONTENT_SLOW_RETRY_MS : 500);
        });
        state.observer.observe(document.body, { childList: true, subtree: true });
        lateWatcher = state;
        armDeadline(state);
    }

    // A static page never mutates, so the end of the first window must not depend on mutations.
    function armDeadline(state) {
        clearTimeout(state.deadline);
        if (state.startedAt !== null) state.deadline = setTimeout(() => retryPending(state, true), LATE_CONTENT_GIVE_UP_MS + 50);
    }

    // The records a retry looks for: after the first window, not those of other pages sharing
    // this page's key (see isOtherPage), whose text is rarely here.
    function isDue(state, record) {
        return isWatched(record) && (!state.slow || !isOtherPage(record));
    }

    // After the first window only additions that contain a waiting record's text are worth a
    // retry: a retry searches the whole page. The texts are listed again only when the queue changes.
    function mayBringBack(state, mutations) {
        if (state.textsOf !== pendingRecords || state.textsCount !== pendingRecords.length) {
            state.textsOf = pendingRecords;
            state.textsCount = pendingRecords.length;
            state.texts = pendingRecords.filter(r => isDue(state, r)).map(r => r.text).filter(Boolean);
        }
        const texts = state.texts;
        return texts.length > 0 && mutations.some(m => Array.from(m.addedNodes).some(n => {
            const t = n.textContent;
            return !!t && texts.some(x => t.includes(x));
        }));
    }

    function retryNow(state) {
        clearTimeout(state.timer);
        state.timer = null;
        retryPending(state);
    }

    function retryPending(state, final = false) {
        if (lateWatcher !== state) return;
        if (state.slow && document.hidden) { state.retryOnShow = true; return; }
        if (state.startedAt !== null) state.attempts++;
        const due = r => isDue(state, r);
        const waiting = pendingRecords.filter(r => !due(r));
        const { failed, placed, relocated, stamped, dropped } = renderRecords(pendingRecords.filter(due));
        pendingRecords = failed.concat(waiting);
        state.observer.takeRecords();   // ignore the mutations we just made ourselves
        let changed = placed.length > 0 || relocated || stamped || dropped > 0;

        const over = final || state.attempts >= LATE_CONTENT_MAX_ATTEMPTS || Date.now() - state.startedAt > LATE_CONTENT_GIVE_UP_MS;
        if (!state.slow && state.startedAt !== null && over && document.hidden) {
            // Hidden before the window was over: it starts again when the page is shown.
            state.startedAt = null;
            state.attempts = 0;
            clearTimeout(state.deadline);
        } else if (!state.slow && state.startedAt !== null && over) {
            // The first window is over. What is still missing (and wasn't redrawn by the site,
            // or made on another page) counts as a miss, once per visit however often the window
            // restarts.
            const first = state.all;
            if (first) {
                const counted = new Set();
                failed.forEach(r => {
                    const id = recordId(r);
                    if (isReclaimed(r) || isOtherPage(r) || (missedIds.has(id) && !counted.has(id))) return;
                    counted.add(id);
                    r.misses = (r.misses || 0) + 1;
                    changed = true;
                });
                counted.forEach(id => missedIds.add(id));
            }
            state.all = false;
            state.slow = true;
            clearTimeout(state.deadline);
            if (first) noticeMissing();
        }
        if (changed) saveHighlights();
        if (lateWatcher === state && !pendingRecords.some(due)) stopLateWatcher();
    }

    // A tab shown again: the first window starts if it hadn't, and content added meanwhile is
    // looked at once. A notice about missing annotations held back is given now.
    function onVisibilityChange() {
        if (document.hidden || !running || nav) return;
        const state = lateWatcher;
        if (state && state.startedAt === null) {
            state.startedAt = Date.now();
            armDeadline(state);
            retryNow(state);
        } else if (state && state.retryOnShow) {
            state.retryOnShow = false;
            retryNow(state);
        }
        if (noticeDue) noticeMissing();
    }

    // --- Annotations that didn't come back ---

    // This page's saved records that aren't on it: their style exists, and they weren't made on
    // another page sharing its key. Forget missing removes these.
    function missingRecords() {
        return pendingRecords.filter(r => hasOwn(STYLES, r.key) && !isOtherPage(r));
    }

    // How many annotations the page has (on it, or saved for it and waiting), how many of those
    // are on it, and how many can't be found (no piece of them is on it).
    function pageCounts() {
        const present = new Set(allWrappers().map(w => w.getAttribute(GROUP_ATTR)));
        const all = new Set(present);
        const missing = new Set();
        pendingRecords.forEach(r => {
            if (isOtherPage(r)) return;
            const owner = recordOwner(r);
            all.add(owner);
            if (hasOwn(STYLES, r.key) && !present.has(owner)) missing.add(owner);
        });
        return { total: all.size, present: present.size, missing: missing.size };
    }

    let noticeDue = false;   // a notice waits for the tab to be shown

    // Once per page and tab, after the first look for late content: how many of the page's
    // annotations couldn't be found, with a button to their list in the panel. Not over a
    // message offering Undo or Restore.
    function noticeMissing() {
        noticeDue = false;
        if (!running || !currentKey || noticedKeys.has(currentKey)) return;
        const { missing } = pageCounts();
        if (!missing) return;
        if (document.hidden) { noticeDue = true; return; }
        noticedKeys.add(currentKey);
        if (!toastEl.hidden && toastRun) return;
        showToast(doneText('not found', missing), { icon: 'warning', intent: 'warning' });
    }

    function restoreHighlights() {
        if (!running) return;
        // A URL change not noticed yet would mean restoring the previous page's annotations here.
        onUrlMaybeChanged();
        if (nav && settleNavigation()) return;   // it restored the page it settled on
        watchStoredKey();
        // Restore runs on a delay, so the user may already have annotated (or an earlier
        // restore may have run). Skip anything that is already on the page.
        const present = new Set(getCurrentRecords().map(recordSignature));
        const records = loadRecords().filter(r => !present.has(recordSignature(r)));
        if (!records.length) return;
        const { failed, relocated, stamped, dropped } = renderRecords(records);
        pendingRecords = failed;
        if (relocated || stamped || dropped || failed.length) saveHighlights();
        startLateWatcher();
        if (!lateWatcher) noticeMissing();   // nothing left to wait for: say so now
        scheduleMenuRefresh();
    }

    function scheduleRestore() {
        clearTimeout(restoreTimer);
        restoreTimer = setTimeout(restoreHighlights, RESTORE_DELAY_MS);
    }

