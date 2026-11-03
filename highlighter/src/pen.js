    // --- Pen (Alt+P): while it is on, every mouse selection is annotated straight away ---

    let penKey = null;            // the style the pen draws with while it is on, else null
    const PEN_ERASER = 'eraser';  // the pen's key when it erases instead of drawing
    let lastStyleKey = null;      // the style chosen last for some text; the pen starts with it

    // Own element, not pageStyle: the cursor exists only while the pen is on.
    const penCursorStyle = document.createElement('style');

    // The Phosphor duotone cursor-text icon in the pen's color; the eraser's is gray. A halo in the
    // opposite ink keeps it visible on any page, and !important beats the links' and fields' own cursors.
    function updatePenCursor(dark) {
        if (!penKey) { penCursorStyle.remove(); return; }
        const fill = penKey === PEN_ERASER ? '#87867f' : resolveStyle(penKey, dark).color;
        const [ink, halo] = dark ? ['#faf9f5', '#141413'] : ['#141413', '#ffffff'];
        const body = 'M176,48V208H160a32,32,0,0,1-32-32,32,32,0,0,1-32,32H80V48H96a32,32,0,0,1,32,32,32,32,0,0,1,32-32Z';
        const line = 'M184,208a8,8,0,0,1-8,8H160a40,40,0,0,1-32-16,40,40,0,0,1-32,16H80a8,8,0,0,1,0-16H96a24,24,0,0,0,24-24V136H104a8,8,0,0,1,0-16h16V80A24,24,0,0,0,96,56H80a8,8,0,0,1,0-16H96a40,40,0,0,1,32,16,40,40,0,0,1,32-16h16a8,8,0,0,1,0,16H160a24,24,0,0,0-24,24v40h16a8,8,0,0,1,0,16H136v40a24,24,0,0,0,24,24h16A8,8,0,0,1,184,208Z';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256">`
            + `<path d="${line}" fill="${halo}" stroke="${halo}" stroke-width="28" stroke-linejoin="round"/>`
            + `<path d="${body}" fill="${fill}" fill-opacity=".5"/><path d="${line}" fill="${ink}"/></svg>`;
        penCursorStyle.textContent = `html, html * { cursor: url("data:image/svg+xml,${encodeURIComponent(svg)}") 10 10, text !important; }`;
        (document.head || document.documentElement).appendChild(penCursorStyle);
    }

    // Turns the pen on with style `key`, or off (null). Its bar shows in the sticky menu (see renderSiteMenu).
    function setPen(key) {
        penKey = key === PEN_ERASER || (key && STYLES[key]) ? key : null;
        updatePenCursor(computeDarkMode());
        if (penKey) showAnnotationsFor('pen'); else restoreAnnotationsFor('pen');
        if (!penKey) {
            if (!penEl.hidden) hideLabelTip();
            releaseFocus(penEl);
            renderSiteMenu();   // the pencil turns slashed and the bar goes
            return;
        }
        // The bar has the menu's theme, which is the page's; its tooltips too.
        const dark = computeDarkMode();
        ensureUi(panelOpen() && uiDark !== null ? uiDark : dark);
        // One button per style: the pen's own shows pressed; clicking another changes the pen. With one
        // annotation selected by click, the bar acts on it instead.
        const picked = selectedGroups.length === 1 && !editor ? selectedGroups[0] : null;
        const pickedWrappers = picked ? groupWrappers(picked) : [];
        const pickedKey = pickedWrappers.length ? pickedWrappers[0].getAttribute(STYLE_ATTR) : null;
        const tools = [];
        let lastGroup = null;
        Object.keys(STYLES).forEach(k => {
            if (STYLES[k].retired) return;
            const group = STYLES[k].type === 'highlight' ? 'highlight' : 'line';
            if (lastGroup && group !== lastGroup) tools.push(toolbarDivider());
            lastGroup = group;
            const on = pickedKey ? k === pickedKey : k === penKey;
            const b = toolButton(styleIcon(k, dark), styleLabel(k), shortcutText(k), pickedKey ? () => { restyleGroups([picked], k); setPen(penKey); } : () => setPen(k), on);
            b.tabIndex = on ? 0 : -1;
            tools.push(b);
        });
        // The note button always shows, grayed out until an annotation is selected.
        const noteLabel = pickedWrappers.some(w => w.getAttribute(NOTE_ATTR)) ? 'Edit note' : 'Add note';
        const note = toolButton(phosphorIcon('pencil-simple-line'), noteLabel, 'Alt+N', () => picked && openNoteEditor(picked));
        note.disabled = !pickedKey;
        note.tabIndex = -1;
        if (pickedKey) {
            const erase = toolButton(phosphorIcon('eraser'), 'Erase annotation', 'Alt+D', () => deleteGroups([picked]));
            erase.tabIndex = -1;
            tools.push(toolbarDivider(), note, erase);
        } else {
            const eraser = toolButton(phosphorIcon('eraser'), 'Eraser', 'Alt+D', () => setPen(PEN_ERASER), penKey === PEN_ERASER);
            eraser.tabIndex = penKey === PEN_ERASER ? 0 : -1;
            tools.push(toolbarDivider(), note, eraser);
        }
        if ((pickedKey || penKey !== PEN_ERASER) && !tools.some(b => b.tabIndex === 0)) tools.find(b => b.tagName === 'BUTTON').tabIndex = 0;
        penEl.replaceChildren(...tools);
        renderSiteMenu();   // the pencil and, with the menu open, the bar
    }

    function togglePen() {
        if (penKey) { setPen(null); showToast('Pen mode disabled', { icon: 'cursor' }); return; }
        setPen(STYLES[lastStyleKey] ? lastStyleKey : NOTE_STYLE_KEY);
        showToast('Pen mode enabled', { icon: 'cursor-text' });
    }

    // After a mouse selection with the pen on: the selected text gets the pen's style (or, with the
    // eraser, loses its annotations). The pen only adds, so text that already has its style (all of it) is left as it is.
    function penStroke() {
        if (!penKey || !running || editor) return;
        const selected = toolbarSelection();
        const range = selected && cleanRange(selected);
        if (!range) return;
        const sel = window.getSelection();
        if (penKey === PEN_ERASER) { removeInSelection({ sel, range: selected }); return; }
        if (selectionStyles(range, findOverlaps(range)).includes(penKey)) { sel.removeAllRanges(); return; }
        annotateSelection(penKey, { sel, range: selected });
    }

    // Arrow keys, Home and End move between the pen bar's buttons.
    penEl.addEventListener('keydown', e => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        const buttons = Array.from(penEl.querySelectorAll('button:not(:disabled)'));
        const i = buttons.indexOf(penEl.getRootNode().activeElement);
        const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: buttons.length - 1 }[e.key];
        if (i < 0 || to === undefined) return;
        e.preventDefault();
        e.stopPropagation();
        buttons[i].tabIndex = -1;
        const next = buttons[(to + buttons.length) % buttons.length];
        next.tabIndex = 0;
        next.focus();
    });
