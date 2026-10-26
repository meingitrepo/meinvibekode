    // --- Toast ---

    let toastTimer = null;
    let toastRun = null;          // what the toast's action button does
    let toastKey = null;          // the page it is about
    let toastKeep = false;        // it survives undo and redo (see resetUi)
    let toastKeepsEditor = false; // its action leaves a note being written open

    // A message in the bottom-right corner: an intent icon, a title, an
    // action and Dismiss. `icon` is a PHOSPHOR_ICONS name; `intent`
    // is info, success or warning; `action` adds a button, { label, run, keep, keepEditor, tip, shortcut },
    // such as Undo; `tip` and `shortcut` are for its tooltip.
    function showToast(message, { icon = 'info', intent = 'info', action = null } = {}) {
        // A plain message doesn't take the place of one still offering Undo or Restore.
        if (!action && !toastEl.hidden && toastRun) return;
        // The toast has the page's theme, set on it alone: a panel open next to a box of the
        // other theme keeps its own, and opening one later doesn't switch the toast's.
        const dark = computeDarkMode();
        ensureUi(panelOpen() && uiDark !== null ? uiDark : dark);
        toastEl.setAttribute('data-theme', dark ? 'dark' : 'light');
        const nextIcon = phosphorIcon(icon);
        toastIcon.replaceWith(nextIcon);
        toastIcon = nextIcon;
        toastEl.setAttribute('data-intent', intent);
        toastText.textContent = message;
        toastRun = action ? action.run : null;
        toastKey = currentKey;
        toastKeep = !!(action && action.keep);
        toastKeepsEditor = !!(action && action.keepEditor);
        if (action) {
            toastAction.dataset.action = action.label;
            toastAction.replaceChildren(phosphorIcon(TOAST_ACTION_ICONS[action.label] || 'arrow-u-up-left'));
        }
        toastAction.hidden = !action;
        if (action) {
            // The tooltip: what it does, and its shortcut where it has one.
            const tip = action.tip || action.label;
            toastAction.dataset.label = tip;
            toastAction.setAttribute('aria-label', action.shortcut ? `${tip} (${action.shortcut})` : tip);
            if (action.shortcut) { toastAction.dataset.shortcut = action.shortcut; toastAction.setAttribute('aria-keyshortcuts', action.shortcut); }
            else { delete toastAction.dataset.shortcut; toastAction.removeAttribute('aria-keyshortcuts'); }
        }
        toastEl.hidden = true;
        void toastEl.offsetWidth;   // restart the entrance animation
        toastEl.hidden = false;
        startToastTimer(action ? TOAST_ACTION_MS : TOAST_MS);
    }

    // The toast stays while the pointer rests on it or its button has focus.
    function startToastTimer(ms) {
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            if (toastEl.matches(':hover') || toastEl.contains(uiRoot.activeElement)) startToastTimer(2000);
            else hideToast();
        }, ms);
    }

    function hideToast() {
        clearTimeout(toastTimer);
        releaseFocus(toastEl);
        toastEl.hidden = true;
        toastRun = null;
        toastKeep = false;
    }

    let toastReturnFocus = null;  // what had focus before the toast's button took it

    toastDismiss.addEventListener('click', hideToast);
    addLabelTip(toastDismiss, 'Dismiss', '', () => false);
    const TOAST_ACTION_ICONS = { Undo: 'arrow-u-up-left', Restore: 'arrow-counter-clockwise', Show: 'eye' };
    addLabelTip(toastAction, 'Undo', '', () => false);   // its label and shortcut are set per toast, see showToast

    toastAction.addEventListener('click', () => {
        const run = toastRun;
        const key = toastKey;
        const keepsEditor = toastKeepsEditor;
        const back = toastEl.contains(uiRoot.activeElement) ? toastReturnFocus : null;
        hideToast();
        syncLocation();
        // Not for a page the tab has since left.
        if (run && running && currentKey === key) {
            // Undo would close a note being written without a word: it is offered back instead.
            const unsaved = keepsEditor ? null : cancelEditor({ offer: false });
            run();
            if (unsaved) offerDraft(unsaved);
        }
        // Keyboard focus goes back to where it was, unless the action gave it a place (a note it reopened).
        const now = document.activeElement;
        if (back && back.isConnected && typeof back.focus === 'function' && (!now || now === document.body)) back.focus({ preventScroll: true });
    });
    // Pointing at the toast, or focusing its button, keeps it up; leaving gives it a moment more.
    toastEl.addEventListener('mouseenter', () => clearTimeout(toastTimer));
    toastEl.addEventListener('focusin', e => {
        clearTimeout(toastTimer);
        if (!toastEl.contains(e.relatedTarget)) toastReturnFocus = e.relatedTarget instanceof Element ? e.relatedTarget : null;
    });
    toastEl.addEventListener('mouseleave', () => {
        if (!toastEl.hidden && !toastEl.contains(uiRoot.activeElement)) startToastTimer(2000);
    });
    toastEl.addEventListener('focusout', e => {
        if (!toastEl.hidden && !toastEl.contains(e.relatedTarget) && !toastEl.matches(':hover')) startToastTimer(2000);
    });

    // --- Jumping to annotations (Alt+J / Alt+K, and from the panel) ---

    let jumpGroup = null;         // the annotation jumped to last (Alt+N edits it while it is in view)
    const flashTimers = new WeakMap();

    function isInView(el) {
        const r = el.getBoundingClientRect();
        return (r.width || r.height) > 0 && r.bottom > 0 && r.top < window.innerHeight;
    }

    function prefersReducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    // Blinks the annotation's drawing (see FLASH_ATTR).
    function flashGroup(group) {
        groupWrappers(group).forEach(w => {
            const svg = getSvg(w);
            if (!svg) return;
            clearTimeout(flashTimers.get(svg));
            svg.removeAttribute(FLASH_ATTR);
            void svg.getBoundingClientRect();   // restarts the animation
            svg.setAttribute(FLASH_ATTR, '');
            flashTimers.set(svg, setTimeout(() => svg.removeAttribute(FLASH_ATTR), FLASH_MS + 50));
        });
    }

    // Calls `fn` once `el` has stopped moving (a smooth scroll has ended), or after a second.
    function whenSettled(el, fn) {
        let last = null;
        let still = 0;
        let frames = 0;
        const check = () => {
            const top = el.getBoundingClientRect().top;
            still = top === last ? still + 1 : 0;
            last = top;
            if (still >= 3 || ++frames > 60) fn();
            else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
    }

    // Scrolls the annotation into view and flashes it; `showNote` also opens its note card.
    function jumpToGroup(group, { showNote = false } = {}) {
        const wrappers = groupWrappers(group).filter(w => w.getClientRects().length);
        if (!wrappers.length) return false;
        setAnnotationsHidden(false);
        hideNoteCard();
        jumpGroup = group;
        const first = wrappers[0];
        const tall = first.getBoundingClientRect().height > window.innerHeight / 2;
        first.scrollIntoView({ block: tall ? 'start' : 'center', inline: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        whenSettled(first, () => {
            if (jumpGroup !== group || !running) return;
            flashGroup(group);
            const last = groupWrappers(group).pop();
            if (showNote && last && last.hasAttribute(NOTE_ATTR) && !editor && isInView(last)) showNoteCard(last);
        });
        return true;
    }

    // Alt+J (dir 1) / Alt+K (dir -1): the next or previous annotation in reading order, counted
    // from the one jumped to last while it is still in view, else from the top of the view.
    // Returns false when the page has no annotation to jump to.
    function jumpRelative(dir) {
        const firstOf = new Map();
        allWrappers().forEach(w => {
            const g = w.getAttribute(GROUP_ATTR);
            if (!firstOf.has(g) && w.getClientRects().length) firstOf.set(g, w);
        });
        const groups = Array.from(firstOf.keys());
        if (!groups.length) return false;
        let i = groups.indexOf(jumpGroup);
        let target;
        if (i >= 0 && groupWrappers(jumpGroup).some(isInView)) {
            target = i + dir;
        } else {
            const tops = groups.map(g => firstOf.get(g).getBoundingClientRect().top);
            if (dir > 0) {
                target = tops.findIndex(t => t > 1);
                if (target < 0) target = groups.length;
            } else {
                target = -1;
                tops.forEach((t, j) => { if (t < -1) target = j; });
            }
        }
        const wrapped = target >= groups.length || target < 0;
        if (wrapped) target = dir > 0 ? 0 : groups.length - 1;
        jumpToGroup(groups[target], { showNote: true });
        // After the jump, which takes down an "Annotations hidden" message that would hold this one back.
        if (wrapped && groups.length > 1) showToast(dir > 0 ? 'Back to the first annotation' : 'Back to the last annotation');
        return true;
    }

