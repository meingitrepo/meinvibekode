    // A Fluent Button. appearance: 'subtle' and size: 'medium' are the only ones the UI uses.
    function fluentButton({ text = '', icon = null, appearance = 'subtle', size = 'medium', label = '' }) {
        const b = makeEl('button', { type: 'button', class: `btn btn-${appearance} btn-${size}${text ? '' : ' btn-icon'}` });
        if (icon) b.appendChild(icon);
        if (text) b.appendChild(makeEl('span', { text }));
        if (label) b.setAttribute('aria-label', label);
        return b;
    }

    // Placed in the page rather than the window (as selectHost below): the toolbar, note card,
    // editor and tooltip are positioned in it, so they scroll with the text in the same frame
    // instead of following it a frame late. The other panels are fixed to the window. Window
    // wide, so panels get the same room to lay out as in the window.
    const uiHost = makeEl('div', { [UI_ATTR]: '' });
    uiHost.style.cssText = 'all: initial !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 0 !important; z-index: 2147483647 !important;';
    const uiRoot = uiHost.attachShadow({ mode: 'closed' });

    const toolbarEl = makeEl('div', { class: 'surface toolbar', role: 'toolbar', 'aria-label': 'Annotate selection', hidden: '' });
    const labelTipEl = makeEl('div', { class: 'surface tip', role: 'tooltip', hidden: '' });

    const cardText = makeEl('div', { class: 'card-text' });
    // Icon only, like the note editor's Save and Delete; its tooltip is added with addLabelTip().
    // The 16px pencil: the 20px one spans its box corner to corner and looks bigger than Save
    // and Delete; Fluent's 16px drawing has the same ink size as Save (14px) at full line weight.
    const cardPin = fluentButton({ icon: fluentIcon('pin_20_regular') });
    const cardEdit = fluentButton({ icon: fluentIcon('edit_20_regular') });
    const cardDelete = fluentButton({ icon: fluentIcon('eraser_20_regular') });
    const cardHint = makeEl('span', { class: 'card-hint' });   // the date it was added (see showNoteCard)
    const noteCardEl = makeEl('div', { class: 'surface card', hidden: '' }, [
        cardText,
        makeEl('div', { class: 'card-footer' }, [cardHint, makeEl('div', { class: 'card-actions' }, [cardPin, cardEdit, cardDelete])])
    ]);

    const editorTitle = makeEl('div', { class: 'editor-title', id: 'highlighter-note-title' });
    const noteInput = makeEl('textarea', { maxlength: String(NOTE_MAX_LENGTH), 'aria-labelledby': 'highlighter-note-title', placeholder: 'Start typing here...' });
    // Labels and tooltips are added with addLabelTip() further down.
    const noteSave = fluentButton({ icon: fluentIcon('checkmark_20_regular') });
    const noteDiscard = fluentButton({ icon: fluentIcon('dismiss_20_regular') });
    const noteDelete = fluentButton({ icon: fluentIcon('eraser_20_regular') });
    // Save (or Enter) saves, Discard (or Esc, or opening another note) discards the changes,
    // and Delete deletes.
    const editorEl = makeEl('div', { class: 'surface editor', role: 'dialog', 'aria-labelledby': 'highlighter-note-title', hidden: '' }, [
        makeEl('div', { class: 'editor-header' }, [editorTitle, makeEl('div', { class: 'editor-actions' }, [noteSave, noteDiscard, noteDelete])]),
        makeEl('div', { class: 'field' }, [noteInput]),
        makeEl('div', { class: 'field-hint', text: 'Enter to save, Esc to cancel' })
    ]);

    let toastIcon = fluentIcon('info_20_regular');   // replaced per message
    const toastText = makeEl('div', { class: 'toast-text' });
    const toastAction = makeEl('button', { type: 'button', class: 'link', hidden: '' });
    const toastEl = makeEl('div', { class: 'surface toast', role: 'status', hidden: '' }, [toastIcon, toastText, toastAction]);

    // The annotations panel (see openPanel). Its list is built by renderPanel.
    const panelCount = makeEl('div', { class: 'panel-count', 'aria-live': 'polite' });
    const panelErase = fluentButton({ icon: fluentIcon('eraser_20_regular') });
    panelErase.disabled = true;
    const panelSelectAll = fluentButton({ icon: fluentIcon('select_all_on_20_regular') });
    const panelCopy = fluentButton({ icon: fluentIcon('copy_20_regular') });
    const panelClose = fluentButton({ icon: fluentIcon('dismiss_20_regular') });
    const panelFilter = makeEl('input', { type: 'search', placeholder: 'Filter by text or note', 'aria-label': 'Filter annotations by text or note', spellcheck: 'false', autocomplete: 'off' });
    const searchIcon = fluentIcon('search_20_regular');
    searchIcon.classList.add('search-icon');
    const panelList = makeEl('div', { class: 'panel-list' });
    const panelEl = makeEl('div', { class: 'surface panel', role: 'complementary', 'aria-label': 'Annotations', hidden: '' }, [
        makeEl('div', { class: 'panel-header' }, [
            makeEl('div', { class: 'panel-title', text: 'Annotations' }), panelSelectAll, panelCount,
            makeEl('div', { class: 'panel-actions' }, [panelErase, panelCopy, panelClose])
        ]),
        makeEl('div', { class: 'field' }, [searchIcon, panelFilter]),
        panelList
    ]);

    // The pen (Alt+P, see setPen): a pill at the top of the view while it is on.
    let penIcon = fluentIcon('highlight_20_regular');   // replaced by the pen's style
    const penText = makeEl('span', { class: 'pen-text' });
    const penOff = fluentButton({ icon: fluentIcon('dismiss_20_regular') });
    const penEl = makeEl('div', { class: 'surface pen', role: 'status', hidden: '' }, [penIcon, penText, penOff]);

    // Everything saved (Alt+Shift+O, see openEverything): a dialog over the dimmed page.
    const everythingCount = makeEl('div', { class: 'panel-count', 'aria-live': 'polite' });
    const everythingClose = fluentButton({ icon: fluentIcon('dismiss_20_regular') });
    const everythingFilter = makeEl('input', { type: 'search', placeholder: 'Search every page\'s annotations and notes', 'aria-label': 'Search saved annotations', spellcheck: 'false', autocomplete: 'off' });
    const everythingIcon = fluentIcon('search_20_regular');
    everythingIcon.classList.add('search-icon');
    const everythingList = makeEl('div', { class: 'everything-list', role: 'list' });
    const everythingEl = makeEl('div', { class: 'everything', hidden: '' }, [
        makeEl('div', { class: 'surface everything-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'All saved annotations' }, [
            makeEl('div', { class: 'panel-header' }, [
                makeEl('div', { class: 'panel-title', text: 'All annotations' }), everythingCount,
                makeEl('div', { class: 'panel-actions' }, [everythingClose])
            ]),
            makeEl('div', { class: 'field' }, [everythingIcon, everythingFilter]),
            everythingList
        ])
    ]);

    // The dashed boxes around the annotations selected by clicking them (see setSelectedGroups).
    // They sit in a layer of their own, placed in the page rather than the window, so they scroll
    // with the page in the same frame as the text instead of following it a frame late. It stays
    // under the other panels.
    const selectHost = makeEl('div', { [UI_ATTR]: '' });
    selectHost.style.cssText = 'all: initial !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 0 !important; height: 0 !important; pointer-events: none !important; z-index: 2147483646 !important;';
    const selectRoot = selectHost.attachShadow({ mode: 'closed' });
    const selectBoxesEl = makeEl('div', { class: 'select-boxes' });
    selectRoot.append(makeEl('style', { text: UI_CSS }), selectBoxesEl);

    // The note card and editor draw over the panel, and the tooltip goes last so it draws on top
    // of whichever panel its button is in.
    uiRoot.append(makeEl('style', { text: UI_CSS }), panelEl, toolbarEl, noteCardEl, editorEl, toastEl, penEl, everythingEl, labelTipEl);

    // Keys typed in the note editor stay out of the page's own shortcut handlers.
    ['keydown', 'keyup', 'keypress'].forEach(type => uiHost.addEventListener(type, e => e.stopPropagation()));
    // Pressing a toolbar button must not take the page's text selection away.
    toolbarEl.addEventListener('mousedown', e => e.preventDefault());
    penEl.addEventListener('mousedown', e => e.preventDefault());

    // The panels take the theme of what they open next to (`dark`), else of the page.
    let uiDark = null;
    function applyUiTheme(dark) {
        uiDark = dark;
        uiHost.setAttribute('data-theme', dark ? 'dark' : 'light');
    }

    function ensureUi(dark = isDarkMode()) {
        applyUiTheme(dark);
        if (!selectHost.isConnected) document.documentElement.appendChild(selectHost);
        if (!uiHost.isConnected) document.documentElement.appendChild(uiHost);
    }

    function panelOpen() {
        return !toolbarEl.hidden || !noteCardEl.hidden || !!editor;
    }

    // Events from inside the shadow root reach page listeners retargeted to the host.
    function isUiEvent(e) {
        return e.target === uiHost;
    }

    // Takes focus out of a panel that is about to hide, so keys stop going to a hidden control.
    function releaseFocus(panel) {
        const active = uiRoot.activeElement;
        if (active && panel.contains(active)) active.blur();
    }

    // Puts a fixed panel next to `rect` (viewport coordinates), flipping sides when it doesn't
    // fit. Returns the side it went to: 'above' or 'below'.
    function placePanel(panel, rect, preferBelow, gap = 8) {
        const w = panel.offsetWidth;
        const h = panel.offsetHeight;
        const vw = document.documentElement.clientWidth || window.innerWidth;
        const vh = window.innerHeight;
        const above = rect.top - h - gap;
        const below = rect.bottom + gap;
        let side = preferBelow ? 'below' : 'above';
        if (preferBelow && below + h > vh - 4 && above >= 4) side = 'above';
        if (!preferBelow && above < 4) side = 'below';
        const left = Math.max(4, Math.min(rect.left + rect.width / 2 - w / 2, vw - w - 4));
        placeInPage(panel, side === 'below' ? below : above, left);
        return side;
    }

    // A point of the window in page terms (see uiHost), and a panel put there.
    function inPage({ left, top }) {
        const page = uiHost.getBoundingClientRect();
        return { left: left - page.left, top: top - page.top };
    }

    // Pressing `handle` (not one of its buttons) and moving drags `panel`; `start()` returns
    // false to refuse.
    function dragByHandle(panel, handle, start) {
        handle.addEventListener('pointerdown', e => {
            if (e.button || e.target.closest('button') || !start()) return;
            e.preventDefault();
            const dx = parseFloat(panel.style.left) - e.clientX, dy = parseFloat(panel.style.top) - e.clientY;
            const move = m => { panel.style.left = `${m.clientX + dx}px`; panel.style.top = `${m.clientY + dy}px`; };
            handle.setPointerCapture(e.pointerId);
            handle.addEventListener('pointermove', move);
            handle.addEventListener('lostpointercapture', () => handle.removeEventListener('pointermove', move), { once: true });
        });
    }

    function placeInPage(panel, top, left) {
        const at = inPage({ left, top });
        panel.style.top = `${Math.round(at.top)}px`;
        panel.style.left = `${Math.round(at.left)}px`;
    }

