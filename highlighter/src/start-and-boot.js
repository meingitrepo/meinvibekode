    // --- Page-wide UI events ---

    function onPointerDown(e) {
        lastPointerType = e.pointerType || 'mouse';
        if (isUiEvent(e)) return;
        pointerIsDown = true;
        hideToolbar();
        if (editor) cancelEditor();   // clicking away discards the changes; only Save saves
    }

    function onPointerUp(e) {
        pointerIsDown = false;
        if (isUiEvent(e)) return;
        // The pen draws on mouse selections; on a touch screen the selection is made with handles
        // after the finger lifts, so there the toolbar works as usual.
        if (penKey && e.type === 'pointerup' && e.pointerType !== 'touch') setTimeout(penStroke, 0);
        else scheduleToolbar();
    }

    const SCROLL_LISTENER_OPTIONS = { capture: true, passive: true };   // capture: scrolling containers too
    let uiFrame = 0;
    function onScrollOrResize() {
        if (uiFrame) return;
        uiFrame = requestAnimationFrame(() => {
            uiFrame = 0;
            if (!noteCardEl.hidden) followNoteCard();
            hideLabelTip();
            if (!toolbarEl.hidden) placeToolbar();
            if (editor) followEditorAnchor();
        });
    }

    // Closes every panel without saving (used when the page under them changes).
    // `keepRestore`: a "Note not saved · Restore" message stays (undo and redo don't affect it).
    function resetUi({ keepRestore = false } = {}) {
        hideToolbar();
        hideNoteCard();
        clearSelectedGroups();
        closeEditor();
        if (!(keepRestore && toastKeep)) hideToast();
        hoveredWrapper = null;
    }

    // =====================================================================
    // Start / stop (the per-site switch turns the whole script on and off)
    // =====================================================================

    function start() {
        if (running) return;
        running = true;

        const head = document.head || document.documentElement;
        [pageStyle, hideStyle, textColorStyle].forEach(s => head.appendChild(s));
        darkMode = null;
        updateTextColorCss();

        lastHref = location.href;
        settledCanonical = lastSeenCanonical = canonicalKey();
        currentKey = settledCanonical || urlKey(location.href);
        resetPageTracking();

        listen(document, 'selectionchange', updateSelectionVisibility);
        listen(document, 'mousedown', onSelectionPress, true);
        listen(document, 'mouseup', updateSelectionVisibility, true);
        listen(document, 'dragend', updateSelectionVisibility, true);   // a drag of the selected text ends without a mouseup
        // On window, in the capture phase: the earliest point a page script can listen, so a
        // site's own key handlers can't swallow the shortcuts first.
        listen(window, 'keydown', onKeyDown, true);
        listen(window, 'keyup', onKeyUpOrPress, true);
        listen(window, 'keypress', onKeyUpOrPress, true);
        listen(window, 'blur', releaseAccessKeys);
        teardown.push(releaseAccessKeys);
        listen(document, 'mousedown', onMouseDown);
        listen(document, 'mouseover', onMouseOver, true);
        listen(document, 'mouseout', onMouseOut, true);
        listen(document, 'mousemove', onMouseMove, { capture: true, passive: true });
        listen(document, 'selectionchange', scheduleToolbar);
        listen(document, 'selectionchange', onSelectionForGroup);
        listen(document, 'mousedown', onSelectMouseDown, true);
        listen(document, 'click', onDocumentClick, true);
        listen(document, 'pointerdown', onPointerDown, true);
        listen(document, 'pointerup', onPointerUp, true);
        listen(document, 'pointercancel', onPointerUp, true);
        listen(window, 'scroll', onScrollOrResize, SCROLL_LISTENER_OPTIONS);
        listen(window, 'resize', onScrollOrResize);
        listen(window, 'resize', scheduleRedraw);
        listen(window, 'load', scheduleRedraw);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => { if (running) scheduleRedraw(); }).catch(() => {});
        }
        if (typeof ResizeObserver === 'function') {
            const ro = new ResizeObserver(scheduleRedraw);
            ro.observe(document.documentElement);
            teardown.push(() => ro.disconnect());
        }
        teardown.push(watchPageStyle());

        listen(window, 'popstate', onUrlMaybeChanged);
        listen(window, 'hashchange', onUrlMaybeChanged);
        if (window.navigation && typeof window.navigation.addEventListener === 'function') {
            listen(window.navigation, 'navigatesuccess', () => setTimeout(onUrlMaybeChanged, 0));
        }
        listen(document, 'visibilitychange', onVisibilityChange);
        const poll = setInterval(() => { onUrlMaybeChanged(); checkDetached(); pruneShown(); notePanelChanges(); }, 1000);
        teardown.push(() => clearInterval(poll));

        watchTheme();
        teardown.push(unwatchStoredKey);

        if (document.readyState === 'loading') listen(document, 'DOMContentLoaded', scheduleRestore);
        else scheduleRestore();
    }

    // Takes every annotation off the page and stops all activity. Storage is untouched, but for
    // the highlight of a new note still being written (see dropUnwrittenNote).
    function stop() {
        if (!running) return;
        dropUnwrittenNote();
        running = false;
        teardown.splice(0).forEach(fn => { try { fn(); } catch (e) { /* already gone */ } });
        stopLateWatcher();
        clearTimeout(reclaimTimer);
        if (nav) { clearTimeout(nav.timer); nav = null; }
        clearTimeout(restoreTimer);
        clearTimeout(redrawTimer);
        cancelAnimationFrame(redrawFrame); redrawFrame = 0;
        resetUi();
        closePanel();
        closeEverything();
        jumpGroup = null;
        setPen(null);
        uiHost.remove();
        selectHost.remove();
        unwrapAll();
        resetPageTracking();
        unmarkSelected();
        pendingRecords = [];
        undoStack.length = 0;
        redoStack.length = 0;
        setAnnotationsHidden(false);
        [pageStyle, hideStyle, textColorStyle].forEach(s => s.remove());
    }

    function toggleSite() {
        const disable = running;
        setSiteDisabled(disable);
        if (disable) stop();
        else start();
        refreshMenu();
    }

    function clearAllSaved() {
        if (typeof GM_listValues !== 'function' || typeof GM_deleteValue !== 'function') {
            console.warn(`${LOG} GM_listValues/GM_deleteValue not granted; cannot bulk-clear storage.`);
            return;
        }
        if (!confirm('This deletes every Highlighter annotation saved for every site. Your per-site on/off choices are kept. Continue?')) return;
        GM_listValues().forEach(k => { if (k !== SETTINGS_KEY) GM_deleteValue(k); });
        if (running) {
            resetUi();
            closeEverything();
            stopLateWatcher();
            pendingRecords = [];
            undoStack.length = 0;
            redoStack.length = 0;
            unwrapAll();
            resetPageTracking();
            schedulePanelRefresh();
            refreshMenu();
        }
        alert('Deleted all saved annotations.');
    }

    // =====================================================================
    // Menu
    // =====================================================================

    let menuIds = [];
    let menuLabels = '';          // the labels registered now, one per line
    let menuTimer = null;

    // After every save (see saveHighlights), and when a page is restored: the counts may have changed.
    function scheduleMenuRefresh() {
        if (menuTimer) return;
        menuTimer = setTimeout(() => { menuTimer = null; refreshMenu(); }, 300);
    }

    // Grouped as: look and copy, switches, then what deletes (the page's, then every page's).
    // Labels are verb first, counts as in the toasts ("Clear 2x annotations"). The command to
    // forget missing annotations is there only when some are missing. The commands are
    // registered again only when a label changes. A manager that can't take a command back
    // keeps the first set, with fixed labels; its commands check the current state.
    function refreshMenu() {
        if (typeof GM_registerMenuCommand !== 'function') return;
        const canRelabel = typeof GM_unregisterMenuCommand === 'function';
        if (menuIds.length && !canRelabel) return;
        const items = [];
        const shown = running || !canRelabel;
        if (shown) {
            items.push(['Show annotations', () => { if (running) openPanel(); }]);
            items.push(['Search all pages', () => { if (running) openEverything(); }]);
            items.push(['Copy as Markdown', () => copyAnnotations()]);
        }
        if (ENABLE_SELECTION_TOOLBAR && shown) {
            items.push([!canRelabel ? 'Turn toolbar on/off'
                : toolbarSwitchedOff() ? 'Turn toolbar on' : 'Turn toolbar off',
                () => { if (running) toggleToolbarSwitch(); }]);
        }
        if (shown) {
            items.push([!canRelabel ? 'Turn shortcut keys on/off'
                : keysSwitchedOff() ? 'Turn shortcut keys on' : 'Turn shortcut keys off',
                () => { if (running) toggleKeysSwitch(); }]);
        }
        const site = location.hostname || (location.protocol === 'file:' ? 'local files' : siteId());
        if (!canRelabel) items.push([`Turn on/off for ${site}`, toggleSite]);
        else items.push([running ? `Turn off for ${site}` : `Turn on for ${site}`, toggleSite]);
        if (shown) {
            if (!canRelabel) {
                items.push(['Forget missing annotations', forgetMissingAnnotations]);
                items.push(['Clear this page', clearPageAnnotations]);
            } else {
                const { total } = pageCounts();
                const missing = countAnnotations(missingRecords());
                if (missing) items.push([`${doneText('Forget', missing)} not found`, forgetMissingAnnotations]);
                if (total) items.push([`${doneText('Clear', total)} on this page`, clearPageAnnotations]);
            }
        }
        items.push(['Delete all saved annotations…', clearAllSaved]);

        const labels = items.map(([label]) => label).join('\n');
        if (menuIds.length && labels === menuLabels) return;
        menuIds.forEach(id => { try { GM_unregisterMenuCommand(id); } catch (e) { /* gone */ } });
        menuIds = items.map(([label, fn]) => GM_registerMenuCommand(label, fn));
        menuLabels = labels;
    }

    // =====================================================================
    // Boot
    // =====================================================================

    if (typeof GM_addValueChangeListener === 'function') GM_addValueChangeListener(SETTINGS_KEY, onSettingsChanged);
    if (!disabledSites().includes(siteId())) start();
    refreshMenu();
})();
