
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

    // What an annotation is, wherever it was placed: its pieces' style, text and note.
    function ownerContent(records) {
        return records.map(r => `${r.key}|${r.text}|${r.note || ''}`).sort().join('\n');
    }

    function byOwner(records) {
        const map = new Map();
        records.forEach(r => {
            const owner = recordOwner(r);
            if (!map.has(owner)) map.set(owner, []);
            map.get(owner).push(r);
        });
        return map;
    }

    // Another tab saved this page. Annotations it removed go, the ones it added or changed are
    // placed (or wait for their text, like any saved annotation). The one whose note is being
    // written here stays as it is. An annotation of this tab that the other tab never saw (both
    // saved at once) stays too, and is saved again.
    function onStoredKeyChanged(name, oldRaw, newRaw, remote) {
        if (!remote || !running || nav || name !== currentKey) return;
        const before = new Set((parseRecords(oldRaw) || []).map(recordOwner));
        const incoming = byOwner(parseRecords(newRaw) || []);
        const here = byOwner(getCurrentRecords().concat(pendingRecords));
        const editing = editor ? editor.group : null;
        const drop = new Set();
        const add = [];
        let resave = false;
        here.forEach((records, owner) => {
            if (owner === editing) return;
            const theirs = incoming.get(owner);
            if (!theirs) {
                if (before.has(owner)) drop.add(owner);
                else resave = true;
            } else if (ownerContent(theirs) !== ownerContent(records)) {
                drop.add(owner);
                add.push(...theirs);
            }
        });
        incoming.forEach((records, owner) => {
            knownOwners.add(owner);
            if (!here.has(owner) && owner !== editing) add.push(...records);
        });
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

    // The per-site switch, flipped in another tab, applies here too.
    function onSettingsChanged(name, oldRaw, newRaw, remote) {
        if (!remote) return;
        let sites = [];
        try {
            const s = JSON.parse(newRaw || '{}');
            if (s && Array.isArray(s.disabledSites)) sites = s.disabledSites;
        } catch (e) { return; }
        const off = sites.includes(siteId());
        if (off && running) stop();
        else if (!off && !running) start();
        refreshMenu();
    }
