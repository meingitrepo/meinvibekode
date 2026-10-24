    // =====================================================================
    // The sticky menu: this site's switch, and the tools that expand from it
    // =====================================================================

    // The tools, each switched on or off for this site. On by default once the site is on.
    const SITE_TOOLS = [
        ['toolbar', 'Selection toolbar'],
        ['keys', 'Shortcuts'],
        ['pen', 'Pen mode'],
        ['panels', 'Annotation panels'],
        ['undo', 'Undo and redo']
    ];

    function toolsOff() {
        const all = readSettings().toolsOff;
        const list = all && typeof all === 'object' ? all[siteId()] : null;
        return Array.isArray(list) ? list : [];
    }

    // Read afresh each time, so a switch made in another tab counts here too.
    function toolOn(id) {
        return !toolsOff().includes(id);
    }

    function setToolOn(id, on) {
        const settings = readSettings();
        const all = settings.toolsOff && typeof settings.toolsOff === 'object' ? settings.toolsOff : {};
        const list = new Set(toolsOff());
        if (on) list.delete(id);
        else list.add(id);
        if (list.size) all[siteId()] = Array.from(list);
        else delete all[siteId()];
        settings.toolsOff = all;
        GM_setValue(SETTINGS_KEY, JSON.stringify(settings));
    }

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
    const menuMaster = makeEl('button', { type: 'button', class: 'switch', role: 'switch', 'aria-label': 'Highlighter on this site' });
    const menuTitle = makeEl('span', { class: 'sitemenu-title', text: 'Highlighter' });
    const menuClose = fluentButton({ icon: fluentIcon('dismiss_20_regular'), label: 'Hide the menu on this site' });
    const menuHide = fluentButton({ icon: fluentIcon('eye_off_20_regular'), text: 'Hide annotations' });
    const menuTools = makeEl('div', { class: 'sitemenu-tools' });
    const menuRows = new Map(SITE_TOOLS.map(([id, label]) => {
        const sw = makeEl('button', { type: 'button', class: 'switch', role: 'switch', 'aria-label': label });
        sw.addEventListener('click', () => { setToolOn(id, !toolOn(id)); applyToolChange(id); renderSiteMenu(); });
        return [id, sw];
    }));
    menuTools.append(makeEl('div', { class: 'sitemenu-inner' }, [
        ...SITE_TOOLS.map(([id, label]) => makeEl('div', { class: 'sitemenu-row' }, [makeEl('span', { text: label }), menuRows.get(id)])),
        makeEl('div', { class: 'sitemenu-row' }, [menuHide])
    ]));
    const menuEl = makeEl('div', { class: 'surface sitemenu', role: 'group', 'aria-label': 'Highlighter', hidden: '' }, [
        makeEl('div', { class: 'sitemenu-head' }, [menuMaster, menuTitle, menuClose]),
        menuTools
    ]);
    menuRoot.append(makeEl('style', { text: UI_CSS }), menuEl);
    menuHost.addEventListener('keydown', e => e.stopPropagation());
    menuHost.addEventListener('keyup', e => e.stopPropagation());
    menuHost.addEventListener('keypress', e => e.stopPropagation());
    menuEl.addEventListener('mousedown', e => e.preventDefault());

    // A tool just switched off stops at once.
    function applyToolChange(id) {
        if (id === 'toolbar' && running) { hideToolbar(); updateToolbar(); }
        if (id === 'pen' && !toolOn('pen') && penKey) setPen(null);
        if (id === 'panels' && !toolOn('panels') && running) { closePanel(); closeEverything(); }
        if (id === 'keys' && !toolOn('keys')) releaseAccessKeys();
        refreshMenu();
    }

    function renderSiteMenu() {
        const on = siteEnabled();
        menuMaster.setAttribute('aria-checked', String(on));
        menuEl.toggleAttribute('data-open', on);
        menuTools.setAttribute('aria-hidden', String(!on));
        menuTools.toggleAttribute('inert', !on);
        SITE_TOOLS.forEach(([id]) => menuRows.get(id).setAttribute('aria-checked', String(toolOn(id))));
        menuHide.firstChild.nextSibling.textContent = annotationsHidden ? 'Show annotations' : 'Hide annotations';
        const dark = computeDarkMode();
        menuHost.setAttribute('data-theme', dark ? 'dark' : 'light');
        const hidden = menuHiddenHere();
        menuEl.hidden = hidden;
        if (hidden) { if (menuHost.isConnected) menuHost.remove(); return; }
        if (!menuHost.isConnected) document.documentElement.appendChild(menuHost);
        menuHost.style.setProperty('--dpr', String(window.devicePixelRatio || 1));
        const pos = readSettings().menuPos;
        menuEl.style.left = pos && Number.isFinite(pos.left) ? `${Math.max(0, pos.left)}px` : '12px';
        menuEl.style.top = pos && Number.isFinite(pos.top) ? `${Math.max(0, pos.top)}px` : '12px';
    }

    menuMaster.addEventListener('click', () => toggleSite());
    menuClose.addEventListener('click', () => { setMenuHidden(true); renderSiteMenu(); showSiteMenuToast(); });
    menuHide.addEventListener('click', () => { if (running) { toggleAnnotationsHidden(); renderSiteMenu(); } });

    function showSiteMenuToast() {
        if (running) showToast('Menu hidden. Alt+Shift+M brings it back');
    }

    // Dragging the header moves it; the place is kept for every site.
    menuEl.firstChild.addEventListener('pointerdown', e => {
        if (e.button || e.target.closest('button')) return;
        e.preventDefault();
        const head = menuEl.firstChild;
        const dx = parseFloat(menuEl.style.left) - e.clientX, dy = parseFloat(menuEl.style.top) - e.clientY;
        const move = m => {
            menuEl.style.left = `${Math.max(0, Math.min(window.innerWidth - 40, m.clientX + dx))}px`;
            menuEl.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, m.clientY + dy))}px`;
        };
        head.setPointerCapture(e.pointerId);
        head.addEventListener('pointermove', move);
        head.addEventListener('lostpointercapture', () => {
            head.removeEventListener('pointermove', move);
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
