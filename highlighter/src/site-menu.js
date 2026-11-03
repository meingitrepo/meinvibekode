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
    const menuHandle = makeEl('div', { class: 'sitemenu-handle', 'aria-hidden': 'true' }, [phosphorIcon('dots-six-vertical')]);
    const menuExpand = makeButton({ icon: phosphorIcon('caret-down') });
    let menuOpen = false;   // not kept: every page starts with the menu collapsed
    const menuTip = makeEl('div', { class: 'surface tip', role: 'tooltip', hidden: '' });
    let menuTipTimer = null;

    function showMenuTip(button) {
        clearTimeout(menuTipTimer);
        menuTipTimer = setTimeout(() => {
            if (!button.isConnected || menuEl.hidden) return;
            fillTip(menuTip, button);
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
        nameButton(b, label, shortcut);
        b.addEventListener('click', () => { hideMenuTip(); onClick(); renderSiteMenu(); });
        b.addEventListener('mouseenter', () => showMenuTip(b));
        b.addEventListener('mouseleave', hideMenuTip);
        b.addEventListener('focus', () => { if (b.matches(':focus-visible')) showMenuTip(b); });
        b.addEventListener('blur', hideMenuTip);
        return b;
    }

    // id, label, shortcut, icon, click, in groups: the lists, the switches (modes shown pressed while on, then hide), then history.
    const menuButtons = new Map([
        ['search', menuButton('Search all pages', 'Alt+Shift+O', phosphorIcon('magnifying-glass'), () => toggleEverything())],
        ['panel',menuButton('Annotations', 'Alt+O', phosphorIcon('list-checks'), () => togglePanel())],
        ['pen',menuButton('Pen mode', 'Alt+P', phosphorIcon('pencil-simple-slash'), () => togglePen())],
        ['keys', menuButton('Shortcuts', 'Alt+Shift+K', phosphorIcon(keysSwitchedOff() ? 'keyboard-slash' : 'keyboard'), () => toggleKeysSwitch())],
        ['hide', menuButton('Hide annotations', 'Alt+V', phosphorIcon('eye'), () => toggleAnnotationsHidden())],
        ['undo', menuButton('Undo', 'Alt+Z', phosphorIcon('arrow-u-up-left'), () => undoLastAction())],
        ['redo', menuButton('Redo', 'Alt+Y', phosphorIcon('arrow-u-up-right'), () => redoLastAction())]
    ]);
    addMenuTip(menuExpand, 'Expand');

    function addMenuTip(b, label, shortcut) {
        nameButton(b, label, shortcut);
        b.addEventListener('mouseenter', () => showMenuTip(b));
        b.addEventListener('mouseleave', hideMenuTip);
        b.addEventListener('click', hideMenuTip);
    }

    const menuTools = makeEl('div', { class: 'sitemenu-tools' }, [
        makeEl('div', { class: 'sitemenu-inner' }, [...menuButtons].flatMap(([id, b]) => ['panel', 'hide'].includes(id) ? [b, toolbarDivider()] : [b]))
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
        const pressed = { pen: !!penKey, keys: !keysSwitchedOff(), panel: !panelEl.hidden, search: !everythingEl.hidden };
        menuButtons.forEach((b, id) => {
            if (id in pressed) b.setAttribute('aria-pressed', String(pressed[id]));
        });
        menuButtons.get('undo').disabled = !undoStack.length;
        menuButtons.get('redo').disabled = !redoStack.length;
        menuButtons.get('pen').replaceChildren(phosphorIcon(penKey ? 'pencil-simple' : 'pencil-simple-slash'));
        menuButtons.get('keys').replaceChildren(phosphorIcon(keysSwitchedOff() ? 'keyboard-slash' : 'keyboard'));
        const hideBtn = menuButtons.get('hide');
        hideBtn.dataset.label = annotationsHidden ? 'Show annotations' : 'Hide annotations';
        hideBtn.replaceChildren(phosphorIcon(annotationsHidden ? 'eye-slash' : 'eye'));
        hideBtn.setAttribute('aria-label', `${hideBtn.dataset.label} (Alt+V)`);
        hideBtn.setAttribute('aria-pressed', String(!annotationsHidden));   // lit while annotations are shown (the default)
        const dark = computeDarkMode();
        setThemeAttr(menuHost, dark);
        const hidden = menuHiddenHere();
        menuEl.hidden = hidden;
        if (hidden) { if (menuHost.isConnected) menuHost.remove(); return; }
        if (!menuHost.isConnected) document.documentElement.appendChild(menuHost);
        menuHost.style.setProperty('--dpr', String(window.devicePixelRatio || 1));
        applyMenuPos();
    }

    // The saved place (shared by every site) goes on the menu, also when another tab moved it.
    // Not while it is being dragged here: it stays under the pointer until the drop.
    let menuDragging = false;
    // Keeps the whole menu in the window (at its current size; 40px when it is not shown).
    function clampMenuPos(left, top) {
        const w = menuEl.offsetWidth || 40, h = menuEl.offsetHeight || 40;
        return {
            left: Math.max(0, Math.min(window.innerWidth - w, left)),
            top: Math.max(0, Math.min(window.innerHeight - h, top))
        };
    }
    function applyMenuPos() {
        if (menuDragging) return;
        const pos = readSettings().menuPos;
        const { left, top } = clampMenuPos(pos && Number.isFinite(pos.left) ? pos.left : 12, pos && Number.isFinite(pos.top) ? pos.top : 12);
        if (menuEl.style.left !== `${left}px`) menuEl.style.left = `${left}px`;
        if (menuEl.style.top !== `${top}px`) menuEl.style.top = `${top}px`;
    }

    // The window shrinking, or the menu growing (it expands), pulls it back in.
    const keepMenuInside = () => { if (menuEl.isConnected && !menuEl.hidden) applyMenuPos(); };
    window.addEventListener('resize', keepMenuInside);
    if (typeof ResizeObserver === 'function') new ResizeObserver(keepMenuInside).observe(menuEl);
    menuExpand.addEventListener('click', () => { menuOpen = !menuOpen; hideMenuTip(); renderSiteMenu(); });

    // Dragging the menu by its handle or edge moves it; the place is kept for every site.
    menuEl.addEventListener('pointerdown', e => {
        if (e.button || e.target.closest('button')) return;
        e.preventDefault();
        const dx = parseFloat(menuEl.style.left) - e.clientX, dy = parseFloat(menuEl.style.top) - e.clientY;
        const move = m => {
            const at = clampMenuPos(m.clientX + dx, m.clientY + dy);
            menuEl.style.left = `${at.left}px`;
            menuEl.style.top = `${at.top}px`;
        };
        menuEl.setPointerCapture(e.pointerId);
        menuDragging = true;
        menuEl.addEventListener('pointermove', move);
        menuEl.addEventListener('lostpointercapture', () => {
            menuDragging = false;
            menuEl.removeEventListener('pointermove', move);
            const settings = readSettings();
            settings.menuPos = { left: parseFloat(menuEl.style.left), top: parseFloat(menuEl.style.top) };
            if (!writeSettings(settings)) applyMenuPos();   // not saved: back to the place that is
        }, { once: true });
    });

    // Alt+Shift+M shows or hides the menu on this site, on every page.
    function toggleSiteMenu() {
        setMenuHidden(!menuHiddenHere());
        renderSiteMenu();
        refreshMenu();
    }
