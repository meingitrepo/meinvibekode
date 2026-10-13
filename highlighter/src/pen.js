    // --- Pen (Alt+P): while it is on, every mouse selection is annotated straight away ---

    let penKey = null;            // the style the pen draws with while it is on, else null
    let lastStyleKey = null;      // the style chosen last for some text; the pen starts with it

    // Turns the pen on with style `key`, or off (null). A pill at the top of the view shows it.
    function setPen(key) {
        penKey = key && STYLES[key] ? key : null;
        if (!penKey) {
            if (!penEl.hidden) hideLabelTip();
            releaseFocus(penEl);
            penEl.hidden = true;
            return;
        }
        // The pill has the page's theme, as the toast does.
        const dark = computeDarkMode();
        ensureUi(panelOpen() && uiDark !== null ? uiDark : dark);
        penEl.setAttribute('data-theme', dark ? 'dark' : 'light');
        const icon = styleIcon(penKey, dark);
        penIcon.replaceWith(icon);
        penIcon = icon;
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
