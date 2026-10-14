    // A Fluent Button. appearance: 'subtle' and size: 'small' are the only ones the UI uses.
    function fluentButton({ text = '', icon = null, appearance = 'subtle', size = 'small', label = '' }) {
        const b = makeEl('button', { type: 'button', class: `btn btn-${appearance} btn-${size}${text ? '' : ' btn-icon'}` });
        if (icon) b.appendChild(icon);
        if (text) b.appendChild(makeEl('span', { text }));
        if (label) b.setAttribute('aria-label', label);
        return b;
    }

    const uiHost = makeEl('div', { [UI_ATTR]: '' });
    uiHost.style.cssText = 'all: initial !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 0 !important; height: 0 !important; z-index: 2147483647 !important;';
    const uiRoot = uiHost.attachShadow({ mode: 'closed' });

    const toolbarEl = makeEl('div', { class: 'surface toolbar', role: 'toolbar', 'aria-label': 'Annotate selection', hidden: '' });
    const labelTipEl = makeEl('div', { class: 'surface tip', role: 'tooltip', hidden: '' });

    const cardText = makeEl('div', { class: 'card-text' });
    // Icon only, like the note editor's Save and Delete; its tooltip is added with addLabelTip().
    // The 16px pencil: the 20px one spans its box corner to corner and looks bigger than Save
    // and Delete; Fluent's 16px drawing has the same ink size as Save (14px) at full line weight.
    const cardEdit = fluentButton({ icon: fluentIcon('edit_16_regular') });
    const cardDelete = fluentButton({ icon: fluentIcon('delete_16_regular') });
    const cardHint = makeEl('span', { class: 'card-hint' });   // the date it was added (see showNoteCard)
    const noteCardEl = makeEl('div', { class: 'surface card', hidden: '' }, [
        cardText,
        makeEl('div', { class: 'card-footer' }, [cardHint, makeEl('div', { class: 'card-actions' }, [cardEdit, cardDelete])])
    ]);

    const editorTitle = makeEl('div', { class: 'editor-title', id: 'highlighter-note-title' });
    const noteInput = makeEl('textarea', { maxlength: String(NOTE_MAX_LENGTH), 'aria-labelledby': 'highlighter-note-title', placeholder: 'Start typing here...' });
    // Labels and tooltips are added with addLabelTip() further down.
    const noteSave = fluentButton({ icon: fluentIcon('save_20_regular') });
    const noteDelete = fluentButton({ icon: fluentIcon('delete_20_regular') });
    // Save (or Enter) saves, Delete deletes, and anything else (clicking outside, Esc)
    // discards the changes.
    const editorEl = makeEl('div', { class: 'surface editor', role: 'dialog', 'aria-labelledby': 'highlighter-note-title', hidden: '' }, [
        makeEl('div', { class: 'editor-header' }, [editorTitle, makeEl('div', { class: 'editor-actions' }, [noteSave, noteDelete])]),
        makeEl('div', { class: 'field' }, [noteInput]),
        makeEl('div', { class: 'field-hint', text: 'Enter to save, Esc to cancel' })
    ]);

    let toastIcon = fluentIcon('info_20_regular');   // replaced per message
    const toastText = makeEl('div', { class: 'toast-text' });
    const toastAction = makeEl('button', { type: 'button', class: 'link', hidden: '' });
    const toastEl = makeEl('div', { class: 'surface toast', role: 'status', hidden: '' }, [toastIcon, toastText, toastAction]);

    // The annotations panel (see openPanel). Its list is built by renderPanel.
    const panelCount = makeEl('div', { class: 'panel-count', 'aria-live': 'polite' });
    const panelCopy = fluentButton({ icon: fluentIcon('copy_20_regular') });
    const panelClose = fluentButton({ icon: fluentIcon('dismiss_20_regular') });
    const panelFilter = makeEl('input', { type: 'search', placeholder: 'Filter by text or note', 'aria-label': 'Filter annotations by text or note', spellcheck: 'false', autocomplete: 'off' });
    const searchIcon = fluentIcon('search_20_regular');
    searchIcon.classList.add('search-icon');
    const panelList = makeEl('div', { class: 'panel-list' });
    const panelEl = makeEl('div', { class: 'surface panel', role: 'complementary', 'aria-label': 'Annotations', hidden: '' }, [
        makeEl('div', { class: 'panel-header' }, [
            makeEl('div', { class: 'panel-title', text: 'Annotations' }), panelCount,
            makeEl('div', { class: 'panel-actions' }, [panelCopy, panelClose])
        ]),
        makeEl('div', { class: 'field' }, [searchIcon, panelFilter]),
        panelList
    ]);

    // The pen (Alt+P, see setPen): a pill at the top of the view while it is on.
    let penIcon = fluentIcon('highlight_20_regular');   // replaced by the pen's style
    const penText = makeEl('span', { class: 'pen-text' });
    const penOff = fluentButton({ icon: fluentIcon('dismiss_16_regular') });
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
    const selectBoxesEl = makeEl('div', { class: 'select-boxes' });

    // The note card and editor draw over the panel, and the tooltip goes last so it draws on top
    // of whichever panel its button is in.
    uiRoot.append(makeEl('style', { text: UI_CSS }), selectBoxesEl, panelEl, toolbarEl, noteCardEl, editorEl, toastEl, penEl, everythingEl, labelTipEl);

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
        panel.style.top = `${Math.round(side === 'below' ? below : above)}px`;
        panel.style.left = `${Math.round(left)}px`;
        return side;
    }

