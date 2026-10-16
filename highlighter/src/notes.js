    // =====================================================================
    // Notes
    // =====================================================================

    function newGroupId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    // When an annotation was made, read from its group id, which starts with Date.now() in base
    // 36 (eight digits until 2059). Null for groups without one: annotations saved before groups
    // existed ("old-..."), which are dated by their first restore instead (ADDED_ATTR).
    function groupTime(group) {
        if (typeof group !== 'string' || !/^[0-9a-z]{8}/.test(group)) return null;
        const t = parseInt(group.slice(0, 8), 36);
        return t > 1262304000000 && t < Date.now() + 864e5 ? t : null;   // 2010 to tomorrow
    }

    function annotationTime(wrapper) {
        return groupTime(wrapper.getAttribute(GROUP_ATTR)) || +wrapper.getAttribute(ADDED_ATTR) || null;
    }

    let dateFormat = null;   // made once: making one per date took most of each search keystroke in Alt+Shift+O
    function formatDate(time) {
        try {
            if (!dateFormat) dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
            return dateFormat.format(new Date(time));
        } catch (e) {
            return new Date(time).toDateString();
        }
    }

    // A note cut to NOTE_MAX_LENGTH, without half an emoji at the cut or spaces at its ends.
    function clipNote(text) {
        return text.slice(0, NOTE_MAX_LENGTH).replace(/[\uD800-\uDBFF]$/, '').trim();
    }

    function groupWrappers(group) {
        return group ? Array.from(document.querySelectorAll(`${WRAPPER_SELECTOR}[${GROUP_ATTR}="${CSS.escape(group)}"]`)) : [];
    }

    // The note badge goes on the last piece of each annotation that has a note, so an annotation
    // split across lines or links shows a single badge, at its end.
    function refreshNoteMarks() {
        const wrappers = allWrappers();
        const lastOfGroup = new Map();
        wrappers.forEach(w => { if (w.hasAttribute(NOTE_ATTR)) lastOfGroup.set(w.getAttribute(GROUP_ATTR), w); });
        wrappers.forEach(w => {
            const marked = lastOfGroup.get(w.getAttribute(GROUP_ATTR)) === w;
            if (marked !== w.hasAttribute(NOTE_MARK_ATTR)) w.toggleAttribute(NOTE_MARK_ATTR, marked);
        });
        schedulePanelRefresh();
    }

    function setGroupNote(group, text) {
        groupWrappers(group).forEach(w => {
            if (text) w.setAttribute(NOTE_ATTR, text);
            else w.removeAttribute(NOTE_ATTR);
        });
        refreshNoteMarks();
    }

