    // --- Pen (Alt+P): while it is on, every mouse selection is annotated straight away ---

    let penKey = null;            // the style the pen draws with while it is on, else null
    let lastStyleKey = null;      // the style chosen last for some text; the pen starts with it

    // Turns the pen on with style `key`, or off (null). A toolbar at the top of the view shows it.
    function setPen(key) {
        penKey = key && STYLES[key] ? key : null;
        if (!penKey) {
            if (!penEl.hidden) hideLabelTip();
            releaseFocus(penEl);
            penEl.hidden = true;
            return;
        }
        // The bar has the page's theme, as the toast does.
        const dark = computeDarkMode();
        ensureUi(panelOpen() && uiDark !== null ? uiDark : dark);
        penEl.setAttribute('data-theme', dark ? 'dark' : 'light');
        // One button per style: the pen's own shows pressed; clicking another changes the pen.
        const tools = Object.keys(STYLES).filter(k => !STYLES[k].retired).map(k => {
            const b = toolButton(styleIcon(k, dark), styleLabel(k), shortcutText(k), () => setPen(k), k === penKey);
            b.tabIndex = k === penKey ? 0 : -1;
            return b;
        });
        penEl.replaceChildren(...tools, toolbarDivider(), penText, penOff);
        penText.textContent = `Pen: ${styleLabel(penKey).toLowerCase()}`;
        penEl.hidden = false;
    }

    function togglePen() {
        if (penKey) { setPen(null); return; }
        hideToolbar();
        setPen(STYLES[lastStyleKey] ? lastStyleKey : NOTE_STYLE_KEY);
    }

    // After a mouse selection with the pen on: the selected text gets the pen's style. The pen
    // only adds, so text that already has its style (all of it) is left as it is.
    function penStroke() {
        if (!penKey || !running || editor) return;
        const selected = toolbarSelection();
        const range = selected && cleanRange(selected);
        if (!range) return;
        const sel = window.getSelection();
        if (selectionStyles(range, findOverlaps(range)).includes(penKey)) { sel.removeAllRanges(); return; }
        annotateSelection(penKey, { sel, range: selected });
    }

    penOff.addEventListener('click', () => setPen(null));

    // Arrow keys, Home and End move between the pen toolbar's buttons, as in the selection toolbar.
    penEl.addEventListener('keydown', e => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        const buttons = Array.from(penEl.querySelectorAll('button'));
        const i = buttons.indexOf(uiRoot.activeElement);
        const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: buttons.length - 1 }[e.key];
        if (i < 0 || to === undefined) return;
        e.preventDefault();
        e.stopPropagation();
        buttons[i].tabIndex = -1;
        const next = buttons[(to + buttons.length) % buttons.length];
        next.tabIndex = 0;
        next.focus();
    });
