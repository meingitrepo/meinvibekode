    // --- Shortcut guide (Alt+Shift+H) and release changelog (Alt+Shift+W): one dialog, two contents ---
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
        ['Alt+Shift+H', 'This guide'],
        ['Alt+Shift+W', 'What\'s new: the release changelog']
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
    let changelogTimer = null;
    let helpKind = null;
    let helpReturnFocus = null;

    function openHelp(kind, auto = false) {
        if (!running) return;
        const dark = computeDarkMode();
        ensureUi(dark);
        helpEl.setAttribute('data-theme', dark ? 'dark' : 'light');
        if (helpEl.hidden) {
            const focused = document.activeElement;
            helpReturnFocus = auto ? null : focused && focused !== document.body && focused !== uiHost ? focused : null;
            hideToolbar();
            hideNoteCard();
        }
        helpKind = kind;
        const rows = kind === 'keys' ? SHORTCUT_GUIDE : CHANGELOG;
        helpTitle.textContent = kind === 'keys' ? 'Shortcuts' : 'What\'s new';
        helpBody.classList.toggle('help-log', kind !== 'keys');
        helpBody.replaceChildren(...rows.map(([a, b]) => makeEl('div', { class: 'help-row' }, [
            makeEl('span', { class: 'help-key', text: a }),
            makeEl('span', { class: 'help-text', text: b })
        ])));
        helpEl.hidden = false;
        if (!auto) helpClose.focus({ preventScroll: true });   // opened by itself it leaves the page's typing alone
    }

    function closeHelp() {
        if (helpEl.hidden) return;
        releaseFocus(helpEl);
        helpEl.hidden = true;
        helpKind = null;
        const back = helpReturnFocus;
        helpReturnFocus = null;
        if (back && back.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
    }

    function toggleHelp(kind) {
        if (!helpEl.hidden && helpKind === kind) closeHelp();
        else openHelp(kind);
    }

    helpClose.addEventListener('click', closeHelp);
    helpEl.addEventListener('mousedown', e => { if (e.target === helpEl) closeHelp(); });

    // After an update the changelog opens once, a little after the font hint's moment. The version is recorded
    // (as changelogVersion in the settings) only when it is shown: a hidden tab, a site with the tool off or
    // another dialog up skip it and it comes back on the next load.
    function maybeShowChangelog() {
        if (!running) return;
        const version = typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version;
        if (!version || readSettings().changelogVersion === version) return;
        if (!siteListed('toolbarOnSites') && !siteListed('keysOnSites')) return;
        if (document.hidden || !helpEl.hidden || !everythingEl.hidden || editor) return;
        const settings = readSettings();
        settings.changelogVersion = version;
        writeSettings(settings);
        openHelp('changelog', true);
    }
