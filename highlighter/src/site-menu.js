    // =====================================================================
    // The sticky menu: this site's switch on top, a column of tool buttons below it
    // =====================================================================

    function menuHiddenHere() {
        const list = readSettings().menuHiddenSites;
        return Array.isArray(list) && list.includes(siteId());
    }

    function setMenuHidden(hidden) {
        const settings = readSettings();
        const sites = new Set(Array.isArray(settings.menuHiddenSites) ? settings.menuHiddenSites : []);
        if (hidden) sites.add(siteId());
        else sites.delete(siteId());
        settings.menuHiddenSites = Array.from(sites);
        GM_setValue(SETTINGS_KEY, JSON.stringify(settings));
    }

    // It lives in a host of its own: stopping the script removes the other panels, not this.
    const menuHost = makeEl('div', { [UI_ATTR]: '' });
    menuHost.style.cssText = 'all: initial !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 0 !important; z-index: 2147483647 !important;';
    const menuRoot = menuHost.attachShadow({ mode: 'closed' });
    const menuMaster = fluentButton({ icon: fluentIcon('power_20_regular') });   // pressed while the site is on
    const menuClose = fluentButton({ icon: fluentIcon('dismiss_20_regular') });
    const menuTip = makeEl('div', { class: 'surface tip', role: 'tooltip', hidden: '' });
    let menuTipTimer = null;

    function showMenuTip(button) {
        clearTimeout(menuTipTimer);
        menuTipTimer = setTimeout(() => {
            if (!button.isConnected || menuEl.hidden) return;
            menuTip.replaceChildren(document.createTextNode(button.dataset.label));
            if (button.dataset.shortcut) menuTip.appendChild(makeEl('span', { class: 'kbd', text: button.dataset.shortcut }));
            menuTip.hidden = false;
            const r = button.getBoundingClientRect(), t = menuTip.getBoundingClientRect();
            const right = r.right + 8 + t.width <= window.innerWidth;
            menuTip.style.position = 'fixed';
            menuTip.style.left = `${Math.round(right ? r.right + 8 : Math.max(4, r.left - 8 - t.width))}px`;
            menuTip.style.top = `${Math.round(r.top + (r.height - t.height) / 2)}px`;
        }, 250);
    }

    function hideMenuTip() {
        clearTimeout(menuTipTimer);
        menuTip.hidden = true;
    }

    function menuButton(label, shortcut, icon, onClick) {
        const b = fluentButton({ icon });
        b.setAttribute('aria-label', shortcut ? `${label} (${shortcut})` : label);
        b.dataset.label = label;
        if (shortcut) { b.dataset.shortcut = shortcut; b.setAttribute('aria-keyshortcuts', shortcut); }
        b.addEventListener('click', () => { hideMenuTip(); onClick(); renderSiteMenu(); });
        b.addEventListener('mouseenter', () => showMenuTip(b));
        b.addEventListener('mouseleave', hideMenuTip);
        b.addEventListener('focus', () => { if (b.matches(':focus-visible')) showMenuTip(b); });
        b.addEventListener('blur', hideMenuTip);
        return b;
    }

    // id, label, shortcut, icon, click. Undo, redo and the two panels are actions; the pen, the
    // selection toolbar and the shortcuts are modes, shown pressed while on.
    const menuButtons = new Map([
        ['undo', menuButton('Undo', 'Alt+Z', fluentIcon('arrow_undo_20_regular'), () => undoLastAction())],
        ['redo', menuButton('Redo', 'Alt+Y', fluentIcon('arrow_redo_20_regular'), () => redoLastAction())],
        ['panel', menuButton('Annotations', 'Alt+O', fluentIcon('text_bullet_list_20_regular'), () => togglePanel())],
        ['search', menuButton('Search all pages', 'Alt+Shift+O', fluentIcon('search_20_regular'), () => toggleEverything())],
        ['hide', menuButton('Hide annotations', 'Alt+V', fluentIcon('eye_off_20_regular'), () => toggleAnnotationsHidden())],
        ['pen', menuButton('Pen', 'Alt+P', fluentIcon('edit_20_regular'), () => togglePen())],
        ['toolbar', menuButton('Selection toolbar', 'Alt+T', fluentIcon('highlight_20_regular'), () => toggleToolbarSwitch())],
        ['keys', menuButton('Shortcuts', 'Alt+Shift+K', fluentIcon('keyboard_20_regular'), () => toggleKeysSwitch())]
    ]);
    addMenuTip(menuMaster, 'Turn highlighter on for this site');
    addMenuTip(menuClose, 'Hide the menu', 'Alt+Shift+M');

    function addMenuTip(b, label, shortcut) {
        b.setAttribute('aria-label', shortcut ? `${label} (${shortcut})` : label);
        b.dataset.label = label;
        if (shortcut) b.dataset.shortcut = shortcut;
        b.addEventListener('mouseenter', () => showMenuTip(b));
        b.addEventListener('mouseleave', hideMenuTip);
        b.addEventListener('click', hideMenuTip);
    }

    const menuTools = makeEl('div', { class: 'sitemenu-tools' }, [
        makeEl('div', { class: 'sitemenu-inner' }, [...menuButtons.values(), menuClose])
    ]);
    const menuEl = makeEl('div', { class: 'surface sitemenu', role: 'toolbar', 'aria-orientation': 'vertical', 'aria-label': 'Highlighter', hidden: '' }, [makeEl('div', { class: 'sitemenu-master' }, [menuMaster]), menuTools]);
    menuRoot.append(makeEl('style', { text: UI_CSS }), menuEl, menuTip);
    ['keydown', 'keyup', 'keypress'].forEach(type => menuHost.addEventListener(type, e => e.stopPropagation()));
    menuEl.addEventListener('mousedown', e => e.preventDefault());
    menuEl.addEventListener('pointerenter', () => renderSiteMenu());

    function renderSiteMenu() {
        const on = siteEnabled();
        menuMaster.setAttribute('aria-pressed', String(on));
        menuMaster.dataset.label = on ? 'Turn highlighter off for this site' : 'Turn highlighter on for this site';
        menuMaster.setAttribute('aria-label', menuMaster.dataset.label);
        menuEl.toggleAttribute('data-open', on);
        menuTools.toggleAttribute('inert', !on);
        const pressed = { pen: !!penKey, toolbar: !toolbarSwitchedOff(), keys: !keysSwitchedOff() };
        menuButtons.forEach((b, id) => {
            if (id in pressed) b.setAttribute('aria-pressed', String(pressed[id]));
        });
        menuButtons.get('undo').disabled = !undoStack.length;
        menuButtons.get('redo').disabled = !redoStack.length;
        const hideBtn = menuButtons.get('hide');
        hideBtn.dataset.label = annotationsHidden ? 'Show annotations' : 'Hide annotations';
        hideBtn.setAttribute('aria-label', `${hideBtn.dataset.label} (Alt+V)`);
        hideBtn.setAttribute('aria-pressed', String(!!annotationsHidden));
        const dark = computeDarkMode();
        menuHost.setAttribute('data-theme', dark ? 'dark' : 'light');
        const hidden = menuHiddenHere();
        menuEl.hidden = hidden;
        if (hidden) { if (menuHost.isConnected) menuHost.remove(); return; }
        if (!menuHost.isConnected) document.documentElement.appendChild(menuHost);
        menuHost.style.setProperty('--dpr', String(window.devicePixelRatio || 1));
        if (!menuEl.style.left) {
            const pos = readSettings().menuPos;
            menuEl.style.left = pos && Number.isFinite(pos.left) ? `${Math.max(0, pos.left)}px` : '12px';
            menuEl.style.top = pos && Number.isFinite(pos.top) ? `${Math.max(0, pos.top)}px` : '12px';
        }
    }

    menuMaster.addEventListener('click', () => toggleSite());
    menuClose.addEventListener('click', () => { setMenuHidden(true); renderSiteMenu(); refreshMenu(); if (running) showToast('Menu hidden. Alt+Shift+M brings it back'); });

    // Dragging the menu by its edge moves it; the place is kept for every site.
    menuEl.addEventListener('pointerdown', e => {
        if (e.button || e.target.closest('button')) return;
        e.preventDefault();
        const dx = parseFloat(menuEl.style.left) - e.clientX, dy = parseFloat(menuEl.style.top) - e.clientY;
        const move = m => {
            menuEl.style.left = `${Math.max(0, Math.min(window.innerWidth - 40, m.clientX + dx))}px`;
            menuEl.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, m.clientY + dy))}px`;
        };
        menuEl.setPointerCapture(e.pointerId);
        menuEl.addEventListener('pointermove', move);
        menuEl.addEventListener('lostpointercapture', () => {
            menuEl.removeEventListener('pointermove', move);
            const settings = readSettings();
            settings.menuPos = { left: parseFloat(menuEl.style.left), top: parseFloat(menuEl.style.top) };
            GM_setValue(SETTINGS_KEY, JSON.stringify(settings));
        }, { once: true });
    });

    // Alt+Shift+M shows or hides the menu on this site, whether the site is on or off.
    function toggleSiteMenu() {
        setMenuHidden(!menuHiddenHere());
        renderSiteMenu();
        refreshMenu();
    }
    window.addEventListener('keydown', e => {
        if (e.altKey && e.shiftKey && e.code === 'KeyM' && !e.ctrlKey && !e.metaKey && !e.repeat) {
            e.preventDefault();
            e.stopPropagation();
            toggleSiteMenu();
        }
    }, true);
