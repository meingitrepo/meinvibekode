    // --- Tool buttons (the pen bar, the note editor) and the selection they act on ---

    const STYLE_LABELS = { highlight: 'Highlight', underline: 'Underline', 'strike-through': 'Strikethrough' };
    let selectPreviewCheckTimer = null;
    let pointerIsDown = false;
    let lastPointerType = 'mouse';

    function styleLabel(key) {
        return STYLES[key].label || STYLE_LABELS[STYLES[key].type] || key;
    }

    function shortcutText(key) {
        const code = [].concat(STYLES[key].shortcut || [])[0];
        return code ? `Alt+${code.replace(/^(Key|Digit)/, '')}` : '';
    }

    function styleIcon(key, dark) {
        const { type, color } = resolveStyle(key, dark);
        switch (type) {
            case 'underline':
                // The icon's own underline bar (x 58-198, y 218-230 on the 256 grid), repainted in the style's color.
                return phosphorIcon('text-underline', { over: [svgEl('rect', { x: 58, y: 218, width: 140, height: 12, rx: 6, fill: color })] });
            case 'strike-through':
                // The icon's own strike bar (x 34-222, y 122-134 on the 256 grid), repainted in the style's color.
                return phosphorIcon('text-strikethrough', { over: [svgEl('rect', { x: 34, y: 122, width: 188, height: 12, rx: 6, fill: color })] });
            default:   // 'highlight'
                // The highlighter's cap and tip (its accent layer) in the highlight color.
                return phosphorIcon('highlighter', { under: [svgEl('path', { d: 'M88,136.5L127.5,176L94.4,209.1L35.1,189.4Z', fill: color })] });
        }
    }

    // --- Tooltips for icon buttons (note editor, note preview) ---

    let labelTipTimer = null;

    // An icon button's accessible name, and the label and shortcut its tooltip shows.
    function nameButton(button, label, shortcut) {
        button.setAttribute('aria-label', shortcut ? `${label} (${shortcut})` : label);
        button.dataset.label = label;
        if (shortcut) {
            button.dataset.shortcut = shortcut;
            button.setAttribute('aria-keyshortcuts', shortcut);
        }
    }

    // A tooltip's content: the button's label, then its shortcut.
    function fillTip(tip, button) {
        tip.replaceChildren(document.createTextNode(button.dataset.label));
        if (button.dataset.shortcut) tip.appendChild(makeEl('span', { class: 'kbd', text: button.dataset.shortcut }));
    }

    // preferBelow: a function, so it is read when the tip shows.
    function showLabelTip(button, preferBelow) {
        clearTimeout(labelTipTimer);
        labelTipTimer = setTimeout(() => {
            const panel = button.closest('.surface');
            if (!button.isConnected || !panel || panel.hidden) return;
            fillTip(labelTipEl, button);
            labelTipEl.hidden = false;
            placePanel(labelTipEl, button.getBoundingClientRect(), preferBelow(), 4);
        }, 250);
    }

    function hideLabelTip() {
        clearTimeout(labelTipTimer);
        labelTipEl.hidden = true;
    }

    // Gives an icon button an accessible name and a tooltip showing its label and shortcut.
    function addLabelTip(button, label, shortcut, preferBelow) {
        nameButton(button, label, shortcut);
        button.addEventListener('click', hideLabelTip);
        button.addEventListener('mouseenter', () => showLabelTip(button, preferBelow));
        button.addEventListener('mouseleave', hideLabelTip);
        button.addEventListener('focus', () => { if (button.matches(':focus-visible')) showLabelTip(button, preferBelow); });
        button.addEventListener('blur', hideLabelTip);
        return button;
    }

    // `pressed`: true or false makes it a toggle button (a style, which shows pressed when the
    // selected text has it).
    function toolButton(icon, label, shortcut, onClick, pressed = null) {
        const b = makeButton({ icon, appearance: 'subtle' });
        if (pressed !== null) b.setAttribute('aria-pressed', String(pressed));
        addLabelTip(b, label, shortcut, () => false);
        b.addEventListener('click', onClick);
        return b;
    }

    // The note editor's header buttons: tips above them, flipping below near the top of the view.
    addLabelTip(noteSave, 'Save note', 'Enter', () => false);
    addLabelTip(noteDiscard, 'Discard changes', 'Esc', () => false);
    addLabelTip(noteDelete, 'Erase note', 'Delete', () => false);
    // The note preview sits below its text, so its tip goes below too, off the text.
    addLabelTip(cardPin, 'Pin note', 'Alt+L', () => true);

    function toolbarDivider() {
        return makeEl('span', { class: 'divider', role: 'separator', 'aria-orientation': 'vertical' });
    }

    // The selection the pen may act on: real page text, not a form field or editable area.
    function toolbarSelection() {
        const active = getActiveRange();
        if (!active || !active.sel.toString().trim()) return null;
        const focused = document.activeElement;
        if (focused && (focused.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName))) return null;
        const anchor = elementOf(active.range.commonAncestorContainer);
        if (!anchor || anchor.isContentEditable || anchor.closest('input, textarea, select')) return null;
        return active.range;
    }

    // After the selection settles, the note of a just-selected annotation shows (previewDue).
    // While a pointer is down the user is still selecting.
    function scheduleSelectPreview() {
        clearTimeout(selectPreviewCheckTimer);
        selectPreviewCheckTimer = setTimeout(() => {
            if (!pointerIsDown) showDuePreview();
        }, 200);
    }

    function cancelSelectPreview() {
        clearTimeout(selectPreviewCheckTimer);
    }
