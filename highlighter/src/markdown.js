    // --- The page's annotations, for the panel and for Markdown ---

    // The annotations on the page in reading order: { group, key, wrappers, note, time, paragraphs }.
    function pageAnnotations() {
        const byGroup = new Map();
        allWrappers().forEach(w => {
            const group = w.getAttribute(GROUP_ATTR) || '';
            let a = byGroup.get(group);
            if (!a) {
                a = { group, key: w.getAttribute(STYLE_ATTR), wrappers: [], note: w.getAttribute(NOTE_ATTR) || '', time: annotationTime(w) };
                byGroup.set(group, a);
            }
            a.wrappers.push(w);
        });
        const blockText = new Map();
        return Array.from(byGroup.values()).map(a => ({ ...a, paragraphs: annotationParagraphs(a.wrappers, blockText) }));
    }

    // An annotation's text, one paragraph per block it spans, with spacing collapsed. Pieces in
    // one block join up, with " … " where a removed piece left a gap.
    function annotationParagraphs(wrappers, blockText) {
        const paras = [];
        let lastBlock = null;
        let lastEnd = 0;
        wrappers.forEach(w => {
            const block = getBlockParent(w);
            const extent = wrappers.length > 1 ? wrapperExtent(w, block) : null;
            if (block === lastBlock && extent) {
                if (!blockText.has(block)) blockText.set(block, block.textContent);
                const gap = blockText.get(block).slice(lastEnd, extent.start);
                paras[paras.length - 1] += (gap.trim() ? ' … ' : gap) + w.textContent;
            } else {
                paras.push(w.textContent);
            }
            lastBlock = block;
            if (extent) lastEnd = extent.end;
        });
        return paras.map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    }

    // Saved annotations not on the page (their style still exists): { group, key, records, note,
    // time, paragraphs, page }. This page's (see missingRecords), or with `otherPages`, those made
    // on other pages that share its key, which belong there.
    function missingAnnotations(presentGroups, { otherPages = false } = {}) {
        const byGroup = new Map();
        pendingRecords.forEach(r => {
            if (!hasOwn(STYLES, r.key) || isOtherPage(r) !== otherPages) return;
            const group = recordOwner(r);
            if (presentGroups.has(group)) return;   // a piece of an annotation that is on the page
            let a = byGroup.get(group);
            if (!a) {
                a = { group, key: r.key, records: [], note: '', time: groupTime(group) || r.added || null, page: r.page || currentKey };
                byGroup.set(group, a);
            }
            a.records.push(r);
            if (!a.note && r.note) a.note = r.note;
        });
        return Array.from(byGroup.values()).map(a => ({
            ...a, paragraphs: [a.records.map(r => r.text || '').join(' ').replace(/\s+/g, ' ').trim()]
        }));
    }

    // --- Copy as Markdown ---

    // Escapes what Markdown would read as formatting in quoted page text.
    function markdownText(s) {
        return s.replace(/[\\`*_[\]<>]/g, '\\$&')
            .replace(/^([#+-])/, '\\$1')
            .replace(/^(\d+)([.)])/, '$1\\$2');
    }

    // Parentheses and spaces would end a Markdown link early.
    function markdownUrl(u) {
        return u.replace(/[()\s]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
    }

    // Text directives (#:~:text=) need - , & encoded as well.
    function fragmentPart(s) {
        return encodeURIComponent(s).replace(/[-!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    }

    // The rest of a word the annotation cuts through at its start ('before') or end, else ''.
    function partialWord(wrapper, side, blockText) {
        const block = getBlockParent(wrapper);
        if (!blockText.has(block)) blockText.set(block, block.textContent);
        const full = blockText.get(block);
        const { start, end } = wrapperExtent(wrapper, block);
        const text = wrapper.textContent;
        if (side === 'before') return /^\S/.test(text) ? /\S*$/.exec(full.slice(0, start))[0] : '';
        return /\S$/.test(text) ? /^\S*/.exec(full.slice(end))[0] : '';
    }

    // Up to `n` whole words of the text right before (side 'before') or after a wrapper, or '' when
    // the annotation starts or ends inside a word, where a text fragment can't anchor to them.
    function contextWords(wrapper, side, blockText, n = 3) {
        const block = getBlockParent(wrapper);
        if (!blockText.has(block)) blockText.set(block, block.textContent);
        const full = blockText.get(block);
        const { start, end } = wrapperExtent(wrapper, block);
        if (side === 'before') {
            const text = full.slice(Math.max(0, start - CONTEXT_LENGTH * 2), start);
            if (!text || /\S$/.test(text) && /^\S/.test(wrapper.textContent)) return '';
            const words = text.trim().split(/\s+/).filter(Boolean);
            if (start > CONTEXT_LENGTH * 2) words.shift();   // may be cut
            return words.slice(-n).join(' ');
        }
        const text = full.slice(end, end + CONTEXT_LENGTH * 2);
        if (!text || /^\S/.test(text) && /\S$/.test(wrapper.textContent)) return '';
        const words = text.trim().split(/\s+/).filter(Boolean);
        if (end + CONTEXT_LENGTH * 2 < full.length) words.pop();
        return words.slice(0, n).join(' ');
    }

    // The text directive that opens the page at this annotation: its whole text, or for a long
    // one its first and last words, with the words around it when that text occurs more than once.
    function textDirective(a, pageText, blockText) {
        const runs = a.paragraphs.flatMap(p => p.split(' … '));   // text the page shows unbroken
        if (a.wrappers) {
            // Text fragments match whole words only: an annotation starting or ending inside a
            // word is named by the whole word.
            runs[0] = partialWord(a.wrappers[0], 'before', blockText) + runs[0];
            runs[runs.length - 1] += partialWord(a.wrappers[a.wrappers.length - 1], 'after', blockText);
        }
        const head = runs[0].split(' ');
        const tail = runs[runs.length - 1].split(' ');
        const n = MARKDOWN_FRAGMENT_WORDS;
        const whole = runs.length === 1 && head.length <= n * 2;
        const start = whole ? runs[0] : head.slice(0, n).join(' ');
        const end = whole ? '' : tail.slice(-n).join(' ');
        const parts = [fragmentPart(start)];
        if (end) parts.push(fragmentPart(end));
        if (occurrences(pageText, start).length > 1 && a.wrappers) {
            const prefix = contextWords(a.wrappers[0], 'before', blockText);
            const suffix = contextWords(a.wrappers[a.wrappers.length - 1], 'after', blockText);
            if (prefix) parts.unshift(`${fragmentPart(prefix)}-`);
            if (suffix) parts.push(`-${fragmentPart(suffix)}`);
        }
        return `text=${parts.join(',')}`;
    }

    // The page's title and link, then each annotation as a quote linked to its passage, with
    // its note below it.
    function annotationsMarkdown(items) {
        const url = urlKey(location.href);
        const directiveBase = `${url}${url.includes('#') ? '' : '#'}:~:`;   // a hash route keeps its #
        const title = (document.title || '').replace(/\s+/g, ' ').trim() || location.hostname || url;
        const pageText = (document.body ? document.body.textContent : '').replace(/\s+/g, ' ');
        const blockText = new Map();
        const out = [`## [${title.replace(/[\\[\]]/g, '\\$&')}](${markdownUrl(url)})`];
        items.forEach(a => {
            if (!a.paragraphs.length) return;
            const quote = a.paragraphs.map(p => `> ${markdownText(p)}`).join('\n>\n');
            const link = markdownUrl(directiveBase + textDirective(a, pageText, blockText));
            out.push('', `${quote} [↗](${link})`);
            if (a.note) out.push('', a.note);
        });
        return out.join('\n') + '\n';
    }

    function writeClipboard(text) {
        if (typeof GM_setClipboard === 'function') {
            try { GM_setClipboard(text); return Promise.resolve(); } catch (e) { /* try the page's clipboard */ }
        }
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') return navigator.clipboard.writeText(text);
        return Promise.reject(new Error('no clipboard access'));
    }

    // `items`: the annotations to copy (the panel passes what its filter shows); all by default.
    function copyAnnotations(items = null) {
        if (!running) return;
        syncLocation();
        const list = (items || pageAnnotations()).filter(a => a.wrappers.some(w => w.isConnected));
        if (!list.length) {
            showToast('Nothing to copy', { body: 'This page has no annotations.' });
            return;
        }
        let markdown;
        try {
            markdown = annotationsMarkdown(list);
        } catch (e) {
            console.warn(`${LOG} could not build Markdown`, e);
            showToast('Couldn\'t copy', { intent: 'error', icon: 'error_circle_20_regular', body: 'Try again.' });
            return;
        }
        writeClipboard(markdown).then(
            () => showToast(doneText('copied', list.length), { icon: 'checkmark_20_regular', intent: 'success', body: 'Pasted as Markdown, with its notes.' }),
            e => { console.warn(`${LOG} could not copy`, e); showToast('Couldn\'t copy', { intent: 'error', icon: 'error_circle_20_regular', body: 'The browser blocked clipboard access.' }); });
    }

