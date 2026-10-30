
    // =====================================================================
    // Live sync between tabs: another tab's change to this page shows here at once
    // =====================================================================

    let watchedKey = null;
    let keyListener = null;

    // Follows the storage key of the page being shown (it changes with in-page navigation).
    function watchStoredKey() {
        if (typeof GM_addValueChangeListener !== 'function' || watchedKey === currentKey) return;
        unwatchStoredKey();
        watchedKey = currentKey;
        keyListener = GM_addValueChangeListener(currentKey, onStoredKeyChanged);
    }

    function unwatchStoredKey() {
        if (keyListener !== null && typeof GM_removeValueChangeListener === 'function') {
            try { GM_removeValueChangeListener(keyListener); } catch (e) { /* gone */ }
        }
        keyListener = null;
        watchedKey = null;
    }

    // Another tab saved this page. Annotations it deleted go (it says so with a tombstone), the
    // ones it added or changed are placed (or wait for their text, like any saved annotation), and
    // for an annotation both tabs changed the later change wins in both. The one whose note is
    // being written here stays as it is. What the other tab has not seen yet stays too and is
    // saved again: an annotation made here, a change of ours that is newer, a delete of ours that
    // its list lacks. (`oldRaw` is no help: Violentmonkey gives this tab's own cached value, which
    // already holds a write of its own the other tab has not seen.)
    function onStoredKeyChanged(name, oldRaw, newRaw, remote) {
        if (!remote || !running || nav || name !== currentKey) return;
        const wiped = !newRaw;   // the whole list was deleted
        const gone = tombstonesIn(newRaw);
        const incoming = byOwner(aliveRecords(parseRecords(newRaw) || [], gone));
        const here = byOwner(getCurrentRecords().concat(pendingRecords));
        const editing = editor ? editor.group : null;
        const drop = new Set();
        const add = [];
        let resave = false;
        here.forEach((records, owner) => {
            if (owner === editing) return;
            const state = ownerState.get(owner) || { rev: 0, confirmed: false };
            const theirs = incoming.get(owner);
            if (!theirs) {
                const at = gone.get(owner);
                // Deleted elsewhere: it says so, or the list was wiped, or a version that writes no
                // tombstones dropped what the store is known to have held. Else that tab has not seen it yet.
                if (wiped || (at !== undefined ? at >= state.rev : state.confirmed)) drop.add(owner);
                else resave = true;
            } else if (ownerContent(theirs) !== ownerContent(records)) {
                const rev = stampedRev(theirs);
                const theirsWins = rev === null || rev > state.rev || (rev === state.rev && ownerContent(theirs) > ownerContent(records));
                if (theirsWins) {
                    drop.add(owner);
                    add.push(...theirs);
                } else {
                    resave = true;
                }
            } else {
                state.confirmed = true;
            }
        });
        incoming.forEach((records, owner) => {
            knownOwners.add(owner);
            if (here.has(owner) || owner === editing) return;
            if (goneState.get(owner) >= (stampedRev(records) || 0)) {
                resave = true;   // deleted here since, so their copy is the older
            } else {
                goneState.delete(owner);   // or back after a delete (undone there)
                add.push(...records);
            }
        });
        drop.forEach(owner => ownerState.delete(owner));
        trackOwners(add, true);
        if (wiped) goneState.clear();
        gone.forEach((at, owner) => { if (!(goneState.get(owner) >= at) && !(here.has(owner) && !drop.has(owner))) goneState.set(owner, at); });
        goneState.forEach((at, owner) => { if (!gone.has(owner) && !wiped) resave = true; });   // the other tab's list lost a delete of ours
        if (drop.size || add.length) {
            // Undo here would bring back what the other tab changed.
            undoStack.length = 0;
            redoStack.length = 0;
            hideToolbar();
            removeGroups(drop);
            const { failed } = renderRecords(add.map(r => ({ ...r })));
            pendingRecords = pendingRecords.concat(failed);
            if (cardWrapper && !cardWrapper.isConnected) hideNoteCard();
            refreshNoteMarks();
            if (failed.length) startLateWatcher();
            scheduleRedraw();
            schedulePanelRefresh();
            scheduleMenuRefresh();
        }
        if (resave) saveHighlights();
    }

    // The toolbar and shortcut switches flipped in another tab apply here too.
    function onSettingsChanged(name, oldRaw, newRaw, remote) {
        if (!remote) return;
        if (toolbarSwitchedOff()) hideToolbar();
        renderSiteMenu();
        refreshMenu();
    }
