    // --- Shortcut guide (Alt+Shift+H) ---
    const SHORTCUT_GUIDE = [
        ['Alt+1 / Alt+2 / Alt+H', 'Highlight in cyan / magenta / yellow'],
        ['Alt+U / Alt+S', 'Underline / strike through'],
        ['Alt+N', 'Add or edit a note'],
        ['Alt+L', 'Pin the note preview'],
        ['Alt+D', 'Delete the annotation (note first)'],
        ['Alt+Shift+D', 'Clear every annotation on the page'],
        ['Alt+Z / Alt+Y', 'Undo / redo'],
        ['Alt+V', 'Hide or show annotations'],
        ['Alt+P', 'Pen mode'],
        ['Alt+T', 'Selection toolbar on or off'],
        ['Alt+J / Alt+K', 'Jump to the next / previous annotation'],
        ['Alt+O', 'Annotations of this page'],
        ['Alt+Shift+O', 'Search every page'],
        ['Alt+Shift+M', 'Show or hide the menu'],
        ['Alt+Shift+K', 'Shortcuts on or off'],
        ['Alt+Shift+H', 'This guide']
    ];

    const helpTitle = makeEl('div', { class: 'panel-count' });
    const helpClose = makeButton({ icon: phosphorIcon('x') });
    const helpBody = makeEl('div', { class: 'help-body' });
    const helpEl = makeEl('div', { class: 'everything help', hidden: '' }, [
        makeEl('div', { class: 'surface everything-box', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'help-title' }, [
            makeEl('div', { class: 'panel-header' }, [helpTitle, makeEl('div', { class: 'panel-actions' }, [helpClose])]),
            helpBody
        ])
    ]);
    helpTitle.id = 'help-title';
    uiRoot.append(helpEl);
    let helpReturnFocus = null;

    function openHelp() {
        if (!running) return;
        const dark = computeDarkMode();
        ensureUi(dark);
        helpEl.setAttribute('data-theme', dark ? 'dark' : 'light');
        if (helpEl.hidden) {
            const focused = document.activeElement;
            helpReturnFocus = focused && focused !== document.body && focused !== uiHost ? focused : null;
            hideToolbar();
            hideNoteCard();
        }
        helpTitle.textContent = 'Shortcuts';
        helpBody.replaceChildren(...SHORTCUT_GUIDE.map(([a, b]) => makeEl('div', { class: 'help-row' }, [
            makeEl('span', { class: 'help-key', text: a }),
            makeEl('span', { class: 'help-text', text: b })
        ])));
        helpEl.hidden = false;
        helpClose.focus({ preventScroll: true });
    }

    function closeHelp() {
        if (helpEl.hidden) return;
        releaseFocus(helpEl);
        helpEl.hidden = true;
        const back = helpReturnFocus;
        helpReturnFocus = null;
        if (back && back.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
    }

    function toggleHelp() {
        if (!helpEl.hidden) closeHelp();
        else openHelp();
    }

    helpClose.addEventListener('click', closeHelp);
    helpEl.addEventListener('mousedown', e => { if (e.target === helpEl) closeHelp(); });

