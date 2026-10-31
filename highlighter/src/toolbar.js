    // --- Selection toolbar ---

    const STYLE_LABELS = { highlight: 'Highlight', underline: 'Underline', 'strike-through': 'Strikethrough' };
    let toolbarRange = null;      // the selection the toolbar was opened for
    let toolbarAnchor = null;     // that selection cleaned up, which the toolbar is placed by
    let toolbarGroups = null;     // the annotations the toolbar acts on, when shown for clicked ones
    let toolbarSide = 'above';    // which side of the selection the toolbar sits on
    let toolbarTimer = null;
    let pointerIsDown = false;
    let lastPointerType = 'mouse';

    function styleLabel(key) {
        return STYLES[key].label || STYLE_LABELS[STYLES[key].type] || key;
    }

    function shortcutText(key) {
        const code = [].concat(STYLES[key].shortcut || [])[0];
        return code ? `Alt+${code.replace(/^(Key|Digit)/, '')}` : '';
    }

    function styleIcon(key, dark) {
        const { type, color } = resolveStyle(key, dark);
        switch (type) {
            case 'highlight':
                // The highlighter's cap and tip (its accent layer) in the highlight color.
                return phosphorIcon('highlighter', { under: [svgEl('path', { d: 'M88,136.5L127.5,176L94.4,209.1L35.1,189.4Z', fill: color })] });
            case 'underline':
                // The icon's own underline bar (x 58-198, y 218-230 on the 256 grid), repainted in the style's color.
                return phosphorIcon('text-underline', { over: [svgEl('rect', { x: 58, y: 218, width: 140, height: 12, rx: 6, fill: color })] });
            case 'strike-through':
                // The icon's own strike bar (x 34-222, y 122-134 on the 256 grid), repainted in the style's color.
                return phosphorIcon('text-strikethrough', { over: [svgEl('rect', { x: 34, y: 122, width: 188, height: 12, rx: 6, fill: color })] });
            default:
                // The highlighter's cap and tip (its accent layer) in the highlight color.
                return phosphorIcon('highlighter', { under: [svgEl('path', { d: 'M88,136.5L127.5,176L94.4,209.1L35.1,189.4Z', fill: color })] });
        }
    }

    // --- Tooltips for icon buttons (selection toolbar, note editor) ---

    let labelTipTimer = null;

    // preferBelow: a function, so it is read when the tip shows (the toolbar can change sides).
    function showLabelTip(button, preferBelow) {
        clearTimeout(labelTipTimer);
        labelTipTimer = setTimeout(() => {
            const panel = button.closest('.surface');
            if (!button.isConnected || !panel || panel.hidden) return;
            labelTipEl.replaceChildren(document.createTextNode(button.dataset.label));
            if (button.dataset.shortcut) labelTipEl.appendChild(makeEl('span', { class: 'kbd', text: button.dataset.shortcut }));
            labelTipEl.hidden = false;
            placePanel(labelTipEl, button.getBoundingClientRect(), preferBelow(), 4);
        }, 250);
    }

    function hideLabelTip() {
        clearTimeout(labelTipTimer);
        labelTipEl.hidden = true;
    }

    // Gives an icon button an accessible name and a tooltip showing its label and shortcut.
    function addLabelTip(button, label, shortcut, preferBelow) {
        button.setAttribute('aria-label', shortcut ? `${label} (${shortcut})` : label);
        button.dataset.label = label;
        if (shortcut) {
            button.dataset.shortcut = shortcut;
            button.setAttribute('aria-keyshortcuts', shortcut);
        }
        button.addEventListener('click', hideLabelTip);
        button.addEventListener('mouseenter', () => showLabelTip(button, preferBelow));
        button.addEventListener('mouseleave', hideLabelTip);
        button.addEventListener('focus', () => { if (button.matches(':focus-visible')) showLabelTip(button, preferBelow); });
        button.addEventListener('blur', hideLabelTip);
        return button;
    }

    // `pressed`: true or false makes it a toggle button (a style, which shows pressed when the
    // selected text has it).
    function toolButton(icon, label, shortcut, onClick, pressed = null) {
        const b = makeButton({ icon, appearance: 'subtle' });
        if (pressed !== null) b.setAttribute('aria-pressed', String(pressed));
        // On the side of the toolbar away from the selection, so the text stays visible.
        addLabelTip(b, label, shortcut, () => toolbarSide === 'below');
        b.addEventListener('click', onClick);
        return b;
    }

    // The note editor's header buttons: tips above them, flipping below near the top of the view.
    addLabelTip(noteSave, 'Save note', 'Enter', () => false);
    addLabelTip(noteDiscard, 'Discard changes', 'Esc', () => false);
    addLabelTip(noteDelete, 'Erase note', 'Delete', () => false);
    // The note preview sits below its text, so its tip goes below too, off the text.
    addLabelTip(cardPin, 'Pin note', 'Alt+L', () => true);

    function toolbarDivider() {
        return makeEl('span', { class: 'divider', role: 'separator', 'aria-orientation': 'vertical' });
    }

    // Style icons show the colors the annotation will get where the selection is (`dark`).
    // `overlaps` are the annotations the selection touches (findOverlaps). The styles all of the
    // selected text has (`current`, see selectionStyles) show pressed, and choosing one does nothing; the note
    // button says whether the note it opens exists; the eraser shows when there is anything to erase.
    // For an annotation selected by clicking it, `act` holds what the buttons do instead (see
    // showGroupToolbar).
    function buildToolbar({ overlaps, current }, dark, act = null) {
        const items = [];
        let lastGroup = null;
        Object.keys(STYLES).forEach(k => {
            if (STYLES[k].retired) return;
            const group = STYLES[k].type === 'highlight' ? 'highlight' : 'line';
            if (lastGroup && group !== lastGroup) items.push(toolbarDivider());
            lastGroup = group;
            const pressed = current.includes(k);
            const label = styleLabel(k);
            items.push(toolButton(styleIcon(k, dark), label, shortcutText(k), act ? () => act.style(k) : () => runToolbarAction(active => annotateSelection(k, active)), pressed));
        });
        items.push(toolbarDivider());
        const noteLabel = overlaps.length && overlaps[0].note ? 'Edit note' : 'Add note';
        items.push(toolButton(phosphorIcon(noteLabel === 'Edit note' ? 'note' : 'note-blank'), noteLabel, 'Alt+N', act ? act.note : () => runToolbarAction(noteSelection)));
        if (overlaps.length) {
            items.push(toolButton(phosphorIcon('eraser'), act ? act.removeLabel : 'Erase', act ? act.removeKey : 'Alt+D', act ? act.remove : () => runToolbarAction(removeInSelection)));
        }
        toolbarEl.replaceChildren(...items);
        // One Tab stop for the whole toolbar, on its first button; the arrow keys move along it.
        toolbarEl.querySelectorAll('button').forEach((b, i) => { b.tabIndex = i ? -1 : 0; });
    }

    // Arrow keys, Home and End move focus between the toolbar's buttons.
    toolbarEl.addEventListener('keydown', e => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        const buttons = Array.from(toolbarEl.querySelectorAll('button'));
        const i = buttons.indexOf(uiRoot.activeElement);
        const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: buttons.length - 1 }[e.key];
        if (i < 0 || to === undefined) return;
        e.preventDefault();
        const next = buttons[(to + buttons.length) % buttons.length];
        buttons[i].tabIndex = -1;
        next.tabIndex = 0;
        next.focus();
    });

    // The selection the toolbar may act on: real page text, not a form field or editable area.
    function toolbarSelection() {
        const active = getActiveRange();
        if (!active || !active.sel.toString().trim()) return null;
        const focused = document.activeElement;
        if (focused && (focused.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName))) return null;
        const anchor = elementOf(active.range.commonAncestorContainer);
        if (!anchor || anchor.isContentEditable || anchor.closest('input, textarea, select')) return null;
        return active.range;
    }

    function updateToolbar() {
        toolbarTimer = null;
        if (!running || editor) return;
        if (toolbarSwitchedOff() || penKey) { hideToolbar(); return; }   // with the pen on, its bar is the toolbar (see setPen)
        const selected = toolbarSelection();
        const range = selected && cleanRange(selected);   // what an action would annotate
        const rect = range && range.getBoundingClientRect();
        if (!rect || (!rect.width && !rect.height)) {
            if (!(selectedGroups.length && showGroupToolbar(selectedInOrder()))) hideToolbar();
            return;
        }
        toolbarGroups = null;
        toolbarRange = selected.cloneRange();
        toolbarAnchor = range;
        const dark = darkBehind(range.commonAncestorContainer);
        ensureUi(dark);
        hideLabelTip();
        const overlaps = findOverlaps(range);
        buildToolbar({ overlaps, current: selectionStyles(range, overlaps) }, dark);
        toolbarEl.hidden = false;
        placeToolbar();
        startToolbarIdle();
    }

    // The toolbar for annotations selected by clicking them (see setSelectedGroups), placed by
    // their boxes (a single one; none for several). The style all of them have shows pressed and keeps them, as with a
    // selection; the others restyle them, and they stay selected with the toolbar over them.
    function showGroupToolbar(groups) {
        if (groups.length > 1) return false;   // several selected: outlines only, no toolbar
        const byGroup = wrappersOfGroups(groups);
        const wrappers = groups.flatMap(g => byGroup.get(g) || []);
        if (!wrappers.length || !groupRect(groups)) return false;
        const key = wrappers[0].getAttribute(STYLE_ATTR);
        const current = wrappers.every(w => w.getAttribute(STYLE_ATTR) === key) ? [key] : [];
        const note = (byGroup.get(groups[0]) || []).map(w => w.getAttribute(NOTE_ATTR)).find(Boolean) || '';   // N edits the first's
        const dark = wrappers[0].hasAttribute(DARK_ATTR);
        // A restyle keeps the toolbar where it is and updates it at once; the others hide it.
        const after = (fn, keep = false) => (...args) => {
            if (!keep) hideToolbar();
            if (!running) return;
            syncLocation();
            fn(...args);
            if (keep) refreshGroupToolbar();
            else if (selectedGroups.length && !editor) scheduleToolbar();
        };
        ensureUi(dark);
        hideLabelTip();
        buildToolbar({ overlaps: [{ group: groups[0], note }], current }, dark, {
            style: after(k => restyleGroups(groups, k), true),
            note: after(() => openNoteEditor(groups[0])),
            remove: after(() => deleteGroups(groups)),
            removeLabel: groups.length > 1 ? `Erase ${groups.length}x annotations` : 'Erase annotation',
            removeKey: 'Alt+D'
        });
        toolbarGroups = groups;
        toolbarRange = null;
        toolbarAnchor = { getBoundingClientRect: () => groupRect(groups) || { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 } };
        toolbarEl.hidden = false;
        placeToolbar();
        startToolbarIdle();
        return true;
    }

    // After the selected annotations change (restyled by the toolbar or a key), their toolbar is
    // rebuilt in the same moment, so it never blinks away while they redraw; it goes only when
    // they do (the style all of them had removes them).
    function refreshGroupToolbar() {
        if (!toolbarGroups) return;   // not shown for them (text selected, faded, switched off)
        if (!running || editor || toolbarSwitchedOff() || !selectedGroups.length || !showGroupToolbar(selectedInOrder())) hideToolbar();
    }

    // The toolbar goes centered over the selection, above its first line (below its last on a
    // touch screen, whose own menu goes above). It flips to the other side when it doesn't fit,
    // and stays on screen when the selection is taller than the window.
    function placeToolbar() {
        if (!toolbarAnchor) return;
        const rect = toolbarAnchor.getBoundingClientRect();
        const w = toolbarEl.offsetWidth;
        const h = toolbarEl.offsetHeight;
        const vw = document.documentElement.clientWidth || window.innerWidth;
        const vh = window.innerHeight;
        const gap = 8;
        const above = rect.top - h - gap;
        const below = rect.bottom + gap;
        const left = Math.max(4, Math.min(rect.left + rect.width / 2 - w / 2, vw - w - 4));
        const fits = top => top >= 4 && top + h <= vh - 4 && !touchesCover(left, top, w, h);
        let side = lastPointerType === 'touch' ? 'below' : 'above';
        const flipped = side === 'below' ? 'above' : 'below';
        if (!fits(side === 'below' ? below : above) && fits(flipped === 'below' ? below : above)) side = flipped;
        // On screen while the selection is; once it scrolls away, the toolbar goes with it,
        // staying at its top or bottom edge.
        const onScreen = Math.max(4, Math.min(side === 'below' ? below : above, vh - h - 4));
        const top = Math.max(above, Math.min(onScreen, below));
        placeInPage(toolbarEl, top, left);
        // Hidden while its text is under the page's header or the like, or it has nowhere else to go.
        toolbarEl.style.visibility = isCovered(rect) || touchesCover(left, top, w, h) ? 'hidden' : '';
        toolbarSide = side;
    }

    function scheduleToolbar() {
        clearTimeout(toolbarTimer);
        // Wait for the selection to settle; while a pointer is down the user is still selecting.
        // The note preview of a just-selected annotation (previewDue) opens in the same moment.
        toolbarTimer = setTimeout(() => {
            if (pointerIsDown) return;
            if (ENABLE_SELECTION_TOOLBAR) updateToolbar();
            else toolbarTimer = null;
            showDuePreview();
        }, 200);
    }

    // --- Idle fade-out: the toolbar fades away after TOOLBAR_IDLE_MS with no pointer or keyboard
    // focus on it. A new selection shows it again. ---

    let toolbarIdleTimer = null;
    let toolbarFadeTimer = null;

    function stopToolbarIdle() {
        clearTimeout(toolbarIdleTimer);
        clearTimeout(toolbarFadeTimer);
        toolbarEl.classList.remove('fading');
    }

    function startToolbarIdle() {
        stopToolbarIdle();
        if (!TOOLBAR_IDLE_MS || toolbarEl.hidden) return;
        toolbarIdleTimer = setTimeout(() => {
            // A toolbar that appeared under a still pointer never got a mouseenter.
            if (toolbarEl.matches(':hover')) return;
            hideLabelTip();
            toolbarEl.classList.add('fading');
            const fadeMs = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300;   // --duration-slow
            toolbarFadeTimer = setTimeout(hideToolbar, fadeMs);
        }, TOOLBAR_IDLE_MS);
    }

    // Interacting with the toolbar keeps it, even mid-fade; leaving it restarts the countdown.
    toolbarEl.addEventListener('mouseenter', stopToolbarIdle);
    toolbarEl.addEventListener('mouseleave', startToolbarIdle);
    toolbarEl.addEventListener('focusin', stopToolbarIdle);
    toolbarEl.addEventListener('focusout', e => { if (!toolbarEl.contains(e.relatedTarget)) startToolbarIdle(); });

    function hideToolbar() {
        clearTimeout(toolbarTimer);
        stopToolbarIdle();
        hideLabelTip();
        releaseFocus(toolbarEl);
        toolbarEl.hidden = true;
        toolbarRange = null;
        toolbarAnchor = null;
        toolbarGroups = null;
    }

    // Alt+T, and the menu: the toolbar off or on again on this site. The keys work either way.
    // While the pen is on the toolbar counts as off, so this turns it on and the pen off.
    function toggleToolbarSwitch() {
        const off = !penKey && !toolbarSwitchedOff();
        setToolbarSwitchedOff(off);
        if (penKey) setPen(null);
        if (off) hideToolbar();
        else {
            setAnnotationsHidden(false);
            scheduleToolbar();   // for text that is selected now
        }
        refreshMenu();
        renderSiteMenu();
        showToast(off ? 'Selection toolbar disabled' : 'Selection toolbar enabled', { icon: off ? 'cursor-text-slash' : 'cursor-text' });
    }

    // A tap on a touch screen can clear the page selection even though the toolbar cancels
    // mousedown, so the range saved when the toolbar opened is put back first.
    function runToolbarAction(fn) {
        const range = toolbarRange;
        hideToolbar();
        if (!running) return;
        syncLocation();
        const sel = window.getSelection();
        if (sel && sel.isCollapsed && range && !range.collapsed) {
            sel.removeAllRanges();
            sel.addRange(range);
        }
        const active = getActiveRange();
        if (active) fn(active);
    }

