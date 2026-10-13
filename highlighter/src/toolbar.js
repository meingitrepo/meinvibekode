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
                return fluentIcon('highlight_20_regular', { under: [svgEl('path', { d: FLUENT_ICONS.highlight_accent_20_filled, fill: color })] });
            case 'underline':
                // The icon's own underline bar (x 5-15, y 16-17), repainted in the style's color.
                return fluentIcon('text_underline_20_regular', { over: [svgEl('rect', { x: 5, y: 15.75, width: 10, height: 1.5, rx: 0.75, fill: color })] });
            case 'strike-through':
                // The icon's own strike bar (x 3-17, y 10-11), repainted in the style's color.
                return fluentIcon('text_strikethrough_20_regular', { over: [svgEl('rect', { x: 3, y: 9.75, width: 14, height: 1.5, rx: 0.75, fill: color })] });
            default:
                return fluentIcon('highlight_20_regular');
        }
    }

    // --- Fluent tooltips for icon buttons (selection toolbar, note editor) ---

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

    // Gives an icon button an accessible name and a Fluent tooltip showing its label and shortcut.
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
        button.addEventListener('focus', () => showLabelTip(button, preferBelow));
        button.addEventListener('blur', hideLabelTip);
        return button;
    }

    // `pressed`: true or false makes it a toggle button (a style, which shows pressed when the
    // selected text has it).
    function toolButton(icon, label, shortcut, onClick, pressed = null) {
        const b = fluentButton({ icon, appearance: 'subtle' });
        if (pressed !== null) b.setAttribute('aria-pressed', String(pressed));
        // On the side of the toolbar away from the selection, so the text stays visible.
        addLabelTip(b, label, shortcut, () => toolbarSide === 'below');
        b.addEventListener('click', onClick);
        return b;
    }

    // The note editor's header buttons: tips above them, flipping below near the top of the view.
    addLabelTip(noteSave, 'Save note', 'Enter', () => false);
    addLabelTip(noteDelete, 'Delete note', '', () => false);
    // The note preview sits below its text, so its tip goes below too, off the text.
    addLabelTip(cardEdit, 'Edit note', 'Alt+N', () => true);
    addLabelTip(cardDelete, 'Delete note', '', () => true);
    addLabelTip(penOff, 'Turn off the pen', 'Esc', () => true);

    function toolbarDivider() {
        return makeEl('span', { class: 'divider', role: 'separator', 'aria-orientation': 'vertical' });
    }

    // Style icons show the colors the annotation will get where the selection is (`dark`).
    // `overlaps` are the annotations the selection touches (findOverlaps): while text is selected
    // its annotation is hidden, so the toolbar shows what is there instead. The style all of it
    // has (`current`, see selectionStyle) shows pressed, and choosing it removes it; the note
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
            const pressed = k === current;
            const label = pressed ? `Remove ${styleLabel(k).toLowerCase()}` : styleLabel(k);
            items.push(toolButton(styleIcon(k, dark), label, shortcutText(k), act ? () => act.style(k) : () => runToolbarAction(active => annotateSelection(k, active)), pressed));
        });
        items.push(toolbarDivider());
        const noteLabel = overlaps.length && overlaps[0].note ? 'Edit note' : 'Add note';
        items.push(toolButton(fluentIcon('note_edit_20_regular'), noteLabel, 'Alt+N', act ? act.note : () => runToolbarAction(noteSelection)));
        if (overlaps.length) {
            items.push(toolButton(fluentIcon('eraser_20_regular'), act ? act.removeLabel : 'Remove annotation', 'Alt+Backspace', act ? act.remove : () => runToolbarAction(removeInSelection)));
        }
        toolbarEl.replaceChildren(...items);
        // One Tab stop for the whole toolbar, on its first button; the arrow keys move along it.
        toolbarEl.querySelectorAll('button').forEach((b, i) => { b.tabIndex = i ? -1 : 0; });
    }

    // Arrow keys, Home and End move focus between the toolbar's buttons (Fluent's Toolbar).
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
        if (toolbarSwitchedOff()) { hideToolbar(); return; }
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
        buildToolbar({ overlaps, current: selectionStyle(range, overlaps) }, dark);
        toolbarEl.hidden = false;
        placeToolbar();
        startToolbarIdle();
    }

    // The toolbar for annotations selected by clicking them (see setSelectedGroups), placed by
    // their dashed boxes. The style all of them have shows pressed and removes them, as with a
    // selection; the others restyle them, and they stay selected with the toolbar over them.
    function showGroupToolbar(groups) {
        const wrappers = groups.flatMap(groupWrappers);
        if (!wrappers.length || !groupRect(groups)) return false;
        const key = wrappers[0].getAttribute(STYLE_ATTR);
        const current = wrappers.every(w => w.getAttribute(STYLE_ATTR) === key) ? key : null;
        const note = groupWrappers(groups[0]).map(w => w.getAttribute(NOTE_ATTR)).find(Boolean) || '';   // N edits the first's
        const dark = wrappers[0].hasAttribute(DARK_ATTR);
        const after = fn => (...args) => {
            hideToolbar();
            if (!running) return;
            syncLocation();
            fn(...args);
            if (selectedGroups.length && !editor) scheduleToolbar();
        };
        ensureUi(dark);
        hideLabelTip();
        buildToolbar({ overlaps: [{ group: groups[0], note }], current }, dark, {
            style: after(k => restyleGroups(groups, k)),
            note: after(() => openNoteEditor(groups[0])),
            remove: after(() => deleteGroups(groups)),
            removeLabel: groups.length > 1 ? `Remove ${groups.length} annotations` : 'Remove annotation'
        });
        toolbarGroups = groups;
        toolbarRange = null;
        toolbarAnchor = { getBoundingClientRect: () => groupRect(groups) || { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 } };
        toolbarEl.hidden = false;
        placeToolbar();
        startToolbarIdle();
        return true;
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
        const fits = top => top >= 4 && top + h <= vh - 4;
        let side = lastPointerType === 'touch' ? 'below' : 'above';
        const flipped = side === 'below' ? 'above' : 'below';
        if (!fits(side === 'below' ? below : above) && fits(flipped === 'below' ? below : above)) side = flipped;
        // On screen while the selection is; once it scrolls away, the toolbar goes with it,
        // staying at its top or bottom edge.
        const onScreen = Math.max(4, Math.min(side === 'below' ? below : above, vh - h - 4));
        const top = Math.max(above, Math.min(onScreen, below));
        const left = Math.max(4, Math.min(rect.left + rect.width / 2 - w / 2, vw - w - 4));
        toolbarEl.style.top = `${Math.round(top)}px`;
        toolbarEl.style.left = `${Math.round(left)}px`;
        toolbarSide = side;
    }

    function scheduleToolbar() {
        if (!ENABLE_SELECTION_TOOLBAR) return;
        clearTimeout(toolbarTimer);
        // Wait for the selection to settle; while a pointer is down the user is still selecting.
        toolbarTimer = setTimeout(() => { if (!pointerIsDown) updateToolbar(); }, 200);
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
            const fadeMs = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300;   // --durationSlow
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

    // Alt+T, and the menu: the toolbar off or on again on every site. The keys work either way.
    function toggleToolbarSwitch() {
        const off = !toolbarSwitchedOff();
        setToolbarSwitchedOff(off);
        if (off) hideToolbar();
        else scheduleToolbar();   // for text that is selected now
        showToast(off ? 'Selection toolbar off.'
            : 'Selection toolbar on.');
        refreshMenu();
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

