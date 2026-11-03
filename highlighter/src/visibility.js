    // =====================================================================
    // Showing and hiding the annotations (Alt+V)
    // =====================================================================

    let annotationsHidden = false;

    // Which feature showed the annotations on its own (so it hides them again when it ends).
    const autoShown = { panel: false, pen: false };

    // Any explicit change is the user's decision: it cancels the pending automatic re-hide.
    // It is also what this site remembers, unless `remember` is false (not the user's decision).
    function setAnnotationsHidden(hidden, { remember = true } = {}) {
        autoShown.panel = autoShown.pen = false;
        if (remember && annotationsShownHere() === hidden) setSiteListed('annotationsShownSites', !hidden);
        if (annotationsHidden === hidden) return;
        annotationsHidden = hidden;
        hideStyle.media = hidden ? 'all' : 'not all';
        textColorStyle.media = hidden ? 'not all' : 'all';
        if (hidden) { hideNoteCard(); unpinNoteCard(); }
        else if (!toastEl.hidden && toastText.textContent === 'Annotations hidden') hideToast();   // no longer true
        renderSiteMenu();   // the menu's hide button shows the eye for what it does next
    }

    // The panel and the pen need annotations visible: they show them quietly while they are open, and
    // hide them again when they close, unless the user changed visibility (or annotated) meanwhile.
    function showAnnotationsFor(owner) {
        const was = annotationsHidden;
        const keep = { ...autoShown };
        setAnnotationsHidden(false, { remember: false });
        Object.assign(autoShown, keep);
        if (was) autoShown[owner] = true;
    }

    function restoreAnnotationsFor(owner) {
        if (!autoShown[owner]) return;
        autoShown[owner] = false;
        if (autoShown.panel || autoShown.pen) return;   // the other still needs them
        setAnnotationsHidden(true, { remember: false });
    }

    // The Show button and Alt+V say so; annotating, jumping or erasing while hidden show them quietly.
    function showAnnotations() {
        setAnnotationsHidden(false);
        showToast('Annotations shown', { icon: 'eye' });
    }

    // Alt+V. Hiding says so, with a button that shows them again, so annotations that seem to have
    // gone missing can be found.
    function toggleAnnotationsHidden() {
        const hide = !annotationsHidden;
        if (!hide) { showAnnotations(); return; }
        setAnnotationsHidden(hide);
        if (penKey) setPen(null);   // the pen can't draw on what is hidden
        closePanel();               // nor can the panel list what is hidden
        showToast('Annotations hidden', { icon: 'eye-slash' });
    }
