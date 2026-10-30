    // --- Toast ---

    let toastTimer = null;
    // A message in the bottom-right corner: an intent icon, a title, an
    // action and Dismiss. `icon` is a PHOSPHOR_ICONS name; `intent`
    // is info, success or warning.
    function showToast(message, { icon = 'info', intent = 'info' } = {}) {
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
        toastEl.hidden = true;
        void toastEl.offsetWidth;   // restart the entrance animation
        toastEl.hidden = false;
        startToastTimer(TOAST_MS);
    }

    // A message for a change just made (Alt+Z undoes it).
    function offerUndo(message) {
        showToast(message, { icon: 'eraser', intent: 'success' });
    }

    // The toast stays while the pointer rests on it or it has focus.
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
    }

    // Pointing at the toast, or focusing it, keeps it up; leaving gives it a moment more.
    toastEl.addEventListener('mouseenter', () => clearTimeout(toastTimer));
    toastEl.addEventListener('focusin', () => clearTimeout(toastTimer));
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
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
        if (wrapped && groups.length > 1) showToast(dir > 0 ? 'Back to the first annotation' : 'Back to the last annotation', { icon: 'arrow-counter-clockwise' });
        return true;
    }


    // --- Font hint ---
    // The UI asks for Poppins (sans) and Lora (serif). Once per version, on a site where the tool is on, say
    // which of them is not installed and link to its download page.

    const FONT_HINTS = [
        { name: 'Poppins', fallback: 'Arial', url: 'https://fonts.google.com/specimen/Poppins' },
        { name: 'Lora', fallback: 'Georgia', url: 'https://fonts.google.com/specimen/Lora' }
    ];
    const FONT_HINT_DELAY_MS = 3000;   // after the page's own restore has settled
    let fontHintTimer = null;

    // A font is missing when text in it measures the same as in the generic family it falls back to, for both
    // monospace and serif. A failure counts as installed: no hint is better than a wrong one.
    function fontMissing(name) {
        try {
            const ctx = document.createElement('canvas').getContext('2d');
            const width = font => { ctx.font = font; return ctx.measureText('mmmmmmmmmmlli').width; };
            return ['monospace', 'serif'].every(generic => width(`72px "${name}", ${generic}`) === width(`72px ${generic}`));
        } catch (e) {
            return false;
        }
    }

    // Recorded as shown (in the settings, as fontHintVersion) only when the toast is shown; a hidden tab, a toast
    // already up or a site with the tool off skip it and it comes back on the next load. While the first look for
    // late content runs (it ends with the "not found" notice) the hint waits, so it can't take that notice's place.
    function maybeHintMissingFonts(tries = 0) {
        if (!running) return;
        const version = typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version;
        if (!version || readSettings().fontHintVersion === version) return;
        if (!siteListed('toolbarOnSites') && !siteListed('keysOnSites')) return;
        if (lateWatcher && !lateWatcher.slow && tries < 10) { fontHintTimer = setTimeout(() => maybeHintMissingFonts(tries + 1), 2000); return; }
        if (document.hidden || !toastEl.hidden) return;
        const missing = FONT_HINTS.filter(f => fontMissing(f.name));
        if (!missing.length) return;
        const settings = readSettings();
        settings.fontHintVersion = version;
        writeSettings(settings);
        showToast(`${missing.map(f => f.name).join(' and ')} not installed; using ${missing.map(f => f.fallback).join(' and ')}.`);
    }
