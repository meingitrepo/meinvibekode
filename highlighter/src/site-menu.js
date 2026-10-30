    // =====================================================================
    // The sticky menu: a handle, one expand button, then a row of tool buttons
    // =====================================================================

    function menuHiddenHere() {
        const list = readSettings().menuHiddenSites;
        return Array.isArray(list) && list.includes(siteId());
    }

    function setMenuHidden(hidden) {
        setSiteListed('menuHiddenSites', hidden);
    }

    // It lives in a host of its own: stopping the script removes the other panels, not this.
    const menuHost = makeEl('div', { [UI_ATTR]: '' });
    menuHost.style.cssText = 'all: initial !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 0 !important; z-index: 2147483647 !important;';
    const menuRoot = menuHost.attachShadow({ mode: 'closed' });
    const menuHandle = makeEl('div', { class: 'sitemenu-handle', 'aria-hidden': 'true' });
    const menuExpand = makeButton({ icon: phosphorIcon('caret-down') });
    let menuOpen = false;   // not kept: every page starts with the menu collapsed
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
            const below = r.bottom + 8 + t.height <= window.innerHeight;
            menuTip.style.position = 'fixed';
            menuTip.style.left = `${Math.round(Math.min(Math.max(4, r.left + (r.width - t.width) / 2), window.innerWidth - 4 - t.width))}px`;
            menuTip.style.top = `${Math.round(below ? r.bottom + 8 : Math.max(4, r.top - 8 - t.height))}px`;
        }, 250);
    }

    function hideMenuTip() {
        clearTimeout(menuTipTimer);
        menuTip.hidden = true;
    }

    function menuButton(label, shortcut, icon, onClick) {
        const b = makeButton({ icon });
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

    // id, label, shortcut, icon, click, in groups: the modes (shown pressed while on), history, then the views.
    const menuButtons = new Map([
        ['pen', menuButton('Pen', 'Alt+P', phosphorIcon('pencil-simple'), () => togglePen())],
        ['toolbar', menuButton('Selection toolbar', 'Alt+T', phosphorIcon('highlighter'), () => toggleToolbarSwitch())],
        ['keys', menuButton('Shortcuts', 'Alt+Shift+K', phosphorIcon('keyboard'), () => toggleKeysSwitch())],
        ['undo', menuButton('Undo', 'Alt+Z', phosphorIcon('arrow-u-up-left'), () => undoLastAction())],
        ['redo', menuButton('Redo', 'Alt+Y', phosphorIcon('arrow-u-up-right'), () => redoLastAction())],
        ['panel', menuButton('Annotations', 'Alt+O', phosphorIcon('sort-ascending'), () => togglePanel())],
        ['search', menuButton('Search all pages', 'Alt+Shift+O', phosphorIcon('list-magnifying-glass'), () => toggleEverything())],
        ['hide', menuButton('Hide annotations', 'Alt+V', phosphorIcon('eye-slash'), () => toggleAnnotationsHidden())]
    ]);
    addMenuTip(menuExpand, 'Expand');

    function addMenuTip(b, label, shortcut) {
        b.setAttribute('aria-label', shortcut ? `${label} (${shortcut})` : label);
        b.dataset.label = label;
        if (shortcut) b.dataset.shortcut = shortcut;
        b.addEventListener('mouseenter', () => showMenuTip(b));
        b.addEventListener('mouseleave', hideMenuTip);
        b.addEventListener('click', hideMenuTip);
    }

    const menuTools = makeEl('div', { class: 'sitemenu-tools' }, [
        makeEl('div', { class: 'sitemenu-inner' }, [...menuButtons.values()])
    ]);
    const menuEl = makeEl('div', { class: 'surface sitemenu', role: 'toolbar', 'aria-orientation': 'horizontal', 'aria-label': 'Highlighter', hidden: '' }, [menuHandle, makeEl('div', { class: 'sitemenu-expand' }, [menuExpand]), menuTools]);
    menuRoot.append(makeEl('style', { text: UI_CSS }), menuEl, menuTip);
    ['keydown', 'keyup', 'keypress'].forEach(type => menuHost.addEventListener(type, e => e.stopPropagation()));
    menuEl.addEventListener('mousedown', e => e.preventDefault());
    menuEl.addEventListener('pointerenter', () => renderSiteMenu());

    function renderSiteMenu() {
        const label = menuOpen ? 'Collapse' : 'Expand';
        menuExpand.setAttribute('aria-expanded', String(menuOpen));
        menuExpand.dataset.label = label;
        menuExpand.setAttribute('aria-label', label);
        menuEl.toggleAttribute('data-open', menuOpen);
        menuTools.toggleAttribute('inert', !menuOpen);
        const pressed = { pen: !!penKey, toolbar: !toolbarSwitchedOff(), keys: !keysSwitchedOff() };
        menuButtons.forEach((b, id) => {
            if (id in pressed) b.setAttribute('aria-pressed', String(pressed[id]));
        });
        menuButtons.get('undo').disabled = !undoStack.length;
        menuButtons.get('redo').disabled = !redoStack.length;
        const hideBtn = menuButtons.get('hide');
        hideBtn.dataset.label = annotationsHidden ? 'Show annotations' : 'Hide annotations';
        hideBtn.replaceChildren(phosphorIcon(annotationsHidden ? 'eye' : 'eye-slash'));
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

    menuExpand.addEventListener('click', () => { menuOpen = !menuOpen; hideMenuTip(); renderSiteMenu(); });

    // Dragging the menu by its handle or edge moves it; the place is kept for every site.
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
            writeSettings(settings);
        }, { once: true });
    });

    // Alt+Shift+M shows or hides the menu on this site, on every page.
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
