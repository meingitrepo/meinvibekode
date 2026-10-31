    // =====================================================================
    // Page identity: which stored list belongs to this page
    // =====================================================================

    // Hash fragments and tracking parameters shouldn't create a "different page".
    // Hash routes (#/path, #!/path) are kept because they are real navigation.
    function urlKey(href) {
        try {
            const u = new URL(href);
            Array.from(u.searchParams.keys()).forEach(k => { if (TRACKING_PARAM_RE.test(k)) u.searchParams.delete(k); });
            if (!/^#[!/]/.test(u.hash)) u.hash = '';
            return u.href;
        } catch (e) {
            return href;
        }
    }

    function sameSite(hostA, hostB) {
        return hostA.replace(SITE_PREFIX_RE, '').toLowerCase() === hostB.replace(SITE_PREFIX_RE, '').toLowerCase();
    }

    // The page's <link rel="canonical"> as a storage key, when it can be trusted to name this page.
    function canonicalKey() {
        if (/^#[!/]/.test(location.hash)) return null;   // hash-routed apps: the canonical ignores the route
        const link = canonicalLink();
        if (!link) return null;
        try {
            const u = new URL(link.href, location.href);
            if (!/^https?:$/.test(u.protocol) || !sameSite(u.hostname, location.hostname)) return null;
            // Pointing every page at the home page is a common site misconfiguration.
            if (u.pathname === '/' && !u.search && location.pathname !== '/') return null;
            return urlKey(u.href);
        } catch (e) {
            return null;
        }
    }

    // The first link[rel~="canonical" i][href], as document.querySelector would find it. It is
    // looked for every second (see onUrlMaybeChanged): the browser keeps this list of the page's
    // links between changes to the page, where querySelector searched a big page all over each
    // time (2 ms on 180,000 elements).
    let linkElements = null;
    function canonicalLink() {
        if (!linkElements) linkElements = document.getElementsByTagName('link');
        for (const link of linkElements) {
            if (link.hasAttribute('href') && /(^|[ \t\n\f\r])canonical([ \t\n\f\r]|$)/i.test(link.getAttribute('rel') || '')) return link;
        }
        return null;
    }

    // Pages can share a storage key: the pages of a thread whose canonical URL names its first
    // page, say. What is made on a page with a canonical URL remembers which one it was: '' for
    // the page the key names, else its own URL. Undefined where the key is the page's own URL
    // (no canonical), so nothing else can share it.
    function pageTag() {
        if (!currentKey || currentKey !== settledCanonical) return undefined;
        const here = urlKey(location.href);
        return here === currentKey ? '' : here;
    }

    // Was the record made on another page that shares this page's key? It is still put back
    // when its text is here, but it isn't missing when it isn't (see missingRecords). Records
    // saved before 7.30 carry no page and count as this page's.
    function isOtherPage(r) {
        if (typeof r.page !== 'string') return false;
        return (r.page || currentKey) !== urlKey(location.href);
    }

    // =====================================================================
    // Records, storage
    // =====================================================================

    function wrapperExtent(wrapper, block) {
        const pre = document.createRange();
        pre.setStart(block, 0);
        pre.setEndBefore(wrapper);
        const start = pre.toString().length;
        dropRange(pre);
        return { start, end: start + wrapper.textContent.length };
    }

    function getCurrentRecords() {
        const lost = takeDetached();
        const fullTextByBlock = new Map();
        const xpathByBlock = new Map();
        const siblingCache = new Map();
        const records = allWrappers().map(wrapper => {
            const block = getBlockParent(wrapper);
            let full = fullTextByBlock.get(block);
            if (full === undefined) { full = block.textContent; fullTextByBlock.set(block, full); }
            let xpath = xpathByBlock.get(block);
            if (xpath === undefined) { xpath = getXPath(block, siblingCache); xpathByBlock.set(block, xpath); }
            const { start, end } = wrapperExtent(wrapper, block);
            const record = {
                xpath,
                startOffset: start,
                length: end - start,
                key: wrapper.getAttribute(STYLE_ATTR),
                text: wrapper.textContent,
                prefix: full.slice(Math.max(0, start - CONTEXT_LENGTH), start),
                suffix: full.slice(end, end + CONTEXT_LENGTH),
                group: wrapper.getAttribute(GROUP_ATTR) || undefined,
                note: wrapper.getAttribute(NOTE_ATTR) || undefined,
                added: +wrapper.getAttribute(ADDED_ATTR) || undefined,
                page: wrapper.hasAttribute(PAGE_ATTR) ? wrapper.getAttribute(PAGE_ATTR) : undefined
            };
            trackedRecords.set(wrapper, record);
            return record;
        });
        reclaimDetached(lost, records);
        return records;
    }

    // A site that re-renders part of its page throws our wrappers away with the old content.
    // Their annotations go back to the queue of records waiting for their text, so they come
    // back when it does, instead of silently dropping out of the next save.
    // Takes the records of wrappers that left the page out of tracking, and counts how many
    // tracked records share each recordId (several pieces of one annotation can). Null when
    // every tracked wrapper is still on the page.
    function takeDetached() {
        if (!anyDetached()) return null;
        const lost = new Set();
        const known = new Map();   // recordId -> tracked records with it
        trackedRecords.forEach((record, wrapper) => {
            const id = recordId(record);
            if (!known.has(id)) known.set(id, new Set());
            known.get(id).add(record);
            if (wrapper.isConnected) return;
            trackedRecords.delete(wrapper);
            lost.add(record);
        });
        return { records: Array.from(lost), known };
    }

    let reclaimTimer = null;

    function reclaimDetached(detached, current) {
        if (!detached) return;
        const { records: lost, known } = detached;
        // A lost record is queued unless it is still on the page: the site may have put our
        // wrapper back, or a copy of it, into its new content.
        const same = r => `${recordSignature(r)}|${r.text}`;
        const sigs = new Set(current.map(same));
        const present = new Map();   // recordId -> how many current records have it
        current.forEach(r => present.set(recordId(r), (present.get(recordId(r)) || 0) + 1));
        let queued = false;
        lost.forEach(record => {
            const id = recordId(record);
            const have = present.get(id) || 0;
            if (sigs.has(same(record)) || have >= known.get(id).size) return;
            present.set(id, have + 1);
            const { misses, ...fresh } = record;   // it was found on this visit: not a miss
            pendingRecords.push(fresh);
            // A page that takes it off again right after each return (a component that undoes
            // outside changes) would fight us forever: after a few rounds it stays saved, unplaced.
            if (Date.now() - (putBackAt.get(id) || -Infinity) < REDRAW_FIGHT_MS) {
                fights.set(id, (fights.get(id) || 0) + 1);
                if (fights.get(id) >= REDRAW_FIGHT_LIMIT) stubbornIds.add(id);
            } else {
                fights.delete(id);
            }
            if (stubbornIds.has(id)) return;
            reclaimedIds.set(id, (reclaimedIds.get(id) || 0) + 1);
            queued = true;
        });
        if (queued) retryReclaimedSoon();
    }

    // Looks for redrawn annotations' text right away (it is usually back already), then as the
    // page changes, closely for a while (a watcher already in its slow phase starts over).
    // Not in the same call: this can run in the middle of a retry.
    function retryReclaimedSoon() {
        clearTimeout(reclaimTimer);
        reclaimTimer = setTimeout(() => {
            if (!running || nav) return;
            if (!lateWatcher || lateWatcher.slow) startLateWatcher({ reclaimedOnly: true });
            if (lateWatcher) retryNow(lateWatcher);
        }, 0);
    }

    function anyDetached() {
        for (const wrapper of trackedRecords.keys()) {
            if (!wrapper.isConnected) return true;
        }
        return false;
    }

    // Called every second: notices annotations a site threw away without any edit of ours.
    function checkDetached() {
        if (running && !nav && anyDetached()) getCurrentRecords();
    }

    function isReclaimed(record) {
        return reclaimedIds.has(recordId(record));
    }

    // A redrawn record is back (placed, or found to be a copy of what is there).
    function releaseReclaimed(record) {
        const id = recordId(record);
        const n = reclaimedIds.get(id) || 0;
        if (!n) return;
        if (n > 1) reclaimedIds.set(id, n - 1);
        else reclaimedIds.delete(id);
        putBackAt.set(id, Date.now());
    }

    // Forgets what was learned about the page being shown, when it changes.
    function resetPageTracking() {
        trackedRecords.clear();
        knownOwners.clear();
        ownerState.clear();
        goneState.clear();
        reclaimedIds.clear();
        missedIds.clear();
        putBackAt.clear();
        fights.clear();
        stubbornIds.clear();
        noticeDue = false;
    }

    function recordSignature(r) {
        return `${r.xpath}|${r.startOffset}|${r.length}|${r.key}`;
    }

    // Identifies a record across saves and tabs. Unlike recordSignature, it survives relocation.
    function recordId(r) {
        return `${r.group || ''}|${r.key}|${r.text}`;
    }

    // What a page's stored list holds: records, and tombstones ({ gone: group, at: time }) that
    // say an annotation was deleted. A list is the same JSON array it always was, so versions that
    // know nothing of tombstones carry them along unharmed.
    function parseList(raw) {
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter(r => r && typeof r === 'object') : null;
        } catch (e) {
            return null;
        }
    }

    function parseRecords(raw) {
        const list = parseList(raw);
        return list && list.filter(r => !('gone' in r));
    }

    // Annotation -> when it was deleted, for the tombstones in `raw` that are well formed and not too old.
    function tombstonesIn(raw) {
        const gone = new Map();
        const oldest = Date.now() - TOMBSTONE_TTL_MS;
        (parseList(raw) || []).forEach(r => {
            if (typeof r.gone === 'string' && r.gone && Number.isFinite(r.at) && r.at > oldest) gone.set(r.gone, Math.max(gone.get(r.gone) || 0, r.at));
        });
        return gone;
    }

    function readRecords(key) {
        return parseRecords(GM_getValue(key, null));
    }

    // Saves `records` under `key`, keeping the tombstones already there and adding one for each of
    // `removed` (the annotations this deletes); with nothing left the key is removed.
    function writeRecords(key, records, removed = []) {
        const gone = tombstonesIn(GM_getValue(key, null));
        removed.forEach(owner => gone.set(owner, Date.now()));
        const list = records.concat(Array.from(gone, ([owner, at]) => ({ gone: owner, at })));
        if (list.length) GM_setValue(key, JSON.stringify(list));
        else GM_deleteValue(key);
    }

    // The records of each annotation, by owner.
    function byOwner(records) {
        const map = new Map();
        records.forEach(r => {
            const owner = recordOwner(r);
            if (!map.has(owner)) map.set(owner, []);
            map.get(owner).push(r);
        });
        return map;
    }

    // What an annotation is, wherever it was placed: its pieces' style, text and note.
    function ownerContent(records) {
        return records.map(r => `${r.key}|${r.text}|${r.note || ''}`).sort().join('\n');
    }

    // When an annotation last changed, as stamped by the tab that saved it (`rev`). Null when any
    // piece carries no stamp: it was saved by a version that stamps nothing.
    function stampedRev(records) {
        let rev = 0;
        for (const r of records) {
            if (!Number.isFinite(r.rev)) return null;
            rev = Math.max(rev, r.rev);
        }
        return rev;
    }

    // The records whose annotation was not deleted after it last changed. A delete that is as new
    // as the annotation wins; so does any delete over a record that carries no stamp.
    function aliveRecords(records, gone) {
        if (!gone.size) return records;
        const revs = new Map();
        byOwner(records).forEach((recs, owner) => revs.set(owner, stampedRev(recs)));
        return records.filter(r => {
            const owner = recordOwner(r);
            const at = gone.get(owner);
            return at === undefined || at < (revs.get(owner) || 0);
        });
    }

    // Notes what this tab now knows the store to hold. `confirmed` marks annotations the store
    // is known to have had: loaded from it, or seen in another tab's change. Ones this tab made
    // itself are not, until another tab's change lists them.
    function trackOwners(records, confirmed) {
        byOwner(records).forEach((recs, owner) => {
            const prev = ownerState.get(owner);
            ownerState.set(owner, { content: ownerContent(recs), rev: stampedRev(recs) || 0, confirmed: confirmed || !!(prev && prev.confirmed) });
        });
    }

    // Before a save: stamps each annotation whose content changed since this tab last knew it with
    // the time (`rev`), and turns each annotation this tab knew and no longer has into a tombstone,
    // so another tab can tell "deleted" from "not seen yet". Returns the tombstones to write: the
    // ones remembered here and those in the stored list `raw`, minus the old and the undone.
    function stampOwners(own, raw) {
        const now = Date.now();
        const owners = byOwner(own);
        owners.forEach((recs, owner) => {
            const content = ownerContent(recs);
            const prev = ownerState.get(owner);
            const rev = prev && prev.content === content ? prev.rev : Math.max(now, prev ? prev.rev + 1 : 0);
            if (rev > 0) recs.forEach(r => { r.rev = rev; });
            ownerState.set(owner, { content, rev, confirmed: !!(prev && prev.confirmed) });
            if (rev > (goneState.get(owner) || 0)) goneState.delete(owner);   // back after a delete (undone)
        });
        ownerState.forEach((state, owner) => {
            if (owners.has(owner)) return;
            goneState.set(owner, now);
            ownerState.delete(owner);
        });
        tombstonesIn(raw).forEach((at, owner) => {
            if (!owners.has(owner) && !(goneState.get(owner) >= at)) goneState.set(owner, at);
        });
        goneState.forEach((at, owner) => { if (at <= now - TOMBSTONE_TTL_MS) goneState.delete(owner); });
        return Array.from(goneState, ([owner, at]) => ({ gone: owner, at }));
    }

    // Which annotation a record belongs to: its group (shared by the annotation's pieces), or
    // for records saved before groups existed, the group it gets when placed.
    function recordOwner(r) {
        return r.group || legacyGroup(r);
    }

    // Annotations saved before groups existed get one derived from what they are, so every tab
    // names them the same.
    function legacyGroup(r) {
        const s = `${r.xpath}|${r.startOffset}|${r.key}|${r.text}`;
        let h = 5381;
        for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
        return `old-${h.toString(36)}`;
    }

    function loadRecords() {
        const stored = loadStoredRecords();
        stored.forEach(r => knownOwners.add(recordOwner(r)));
        const gone = tombstonesIn(GM_getValue(currentKey, null));
        gone.forEach((at, owner) => goneState.set(owner, at));
        const records = aliveRecords(stored, gone);   // one deleted since it last changed is not put back, and the next save drops it
        trackOwners(records, true);
        return records;
    }

    function loadStoredRecords() {
        const records = readRecords(currentKey) || [];
        // Annotations saved under this page's plain URL move to the current key. That still happens
        // with current versions, not only old ones: the plain URL is the key whenever no trusted
        // canonical link is known (see canonicalKey: a hash route, a stale link after an in-page
        // navigation, a link the site adds late), and a later visit may know it.
        const legacyKeys = Array.from(new Set([urlKey(location.href), location.href])).filter(k => k !== currentKey);
        const moved = [];
        legacyKeys.forEach(k => {
            const old = readRecords(k);
            if (old) { records.push(...old); moved.push(k); }
        });
        if (!moved.length) return records;
        const seen = new Map();
        const merged = records.filter(r => {
            const sig = `${recordSignature(r)}|${r.text}`;
            const first = seen.get(sig);
            if (!first) { seen.set(sig, r); return true; }
            if (!first.note && r.note) first.note = r.note;   // the copy kept may be the one without the note
            return false;
        });
        writeRecords(currentKey, merged);
        moved.forEach(k => GM_deleteValue(k));
        return merged;
    }

    function saveHighlights(records) {
        if (!running || !currentKey) return;
        schedulePanelRefresh();
        scheduleMenuRefresh();
        const own = (records || getCurrentRecords()).concat(pendingRecords);
        // Another tab showing this page may have saved annotations this tab never loaded: they
        // are kept. An annotation this tab did load or save is this tab's to write: as it is
        // here, or gone if it was removed here.
        const raw = GM_getValue(currentKey, null);
        own.forEach(r => knownOwners.add(recordOwner(r)));
        const others = (parseRecords(raw) || []).filter(r => !knownOwners.has(recordOwner(r)));
        const merged = own.concat(others, stampOwners(own, raw));   // records, then the tombstones of what was deleted
        if (merged.length === 0) {
            if (raw !== null && raw !== undefined) GM_deleteValue(currentKey);
            return;
        }
        const json = JSON.stringify(merged);
        if (json !== raw) GM_setValue(currentKey, json);
    }

    // --- Per-site settings ---

    function siteId() {
        return location.hostname || location.protocol;
    }

    function readSettings() {
        try {
            const s = JSON.parse(GM_getValue(SETTINGS_KEY, '{}'));
            return s && typeof s === 'object' ? s : {};
        } catch (e) {
            return {};
        }
    }

    function writeSettings(settings) {
        GM_setValue(SETTINGS_KEY, JSON.stringify(settings));
    }

    // The shortcut keys (Alt+Shift+K) and the selection toolbar (Alt+T) are per site and off until
    // switched on. Read afresh each time, so a switch made in another tab counts here too.
    function siteListed(key) {
        const list = readSettings()[key];
        return Array.isArray(list) && list.includes(siteId());
    }

    function setSiteListed(key, on) {
        const settings = readSettings();
        const sites = new Set(Array.isArray(settings[key]) ? settings[key] : []);
        if (on) sites.add(siteId());
        else sites.delete(siteId());
        settings[key] = Array.from(sites);
        writeSettings(settings);
    }

    function keysSwitchedOff() {
        return !siteListed('keysOnSites');
    }

    function setKeysSwitchedOff(off) {
        setSiteListed('keysOnSites', !off);
    }

    function toolbarSwitchedOff() {
        return !siteListed('toolbarOnSites');
    }

    function setToolbarSwitchedOff(off) {
        setSiteListed('toolbarOnSites', !off);
    }

    // Annotations open hidden, except on the sites where they were last shown on purpose (Alt+V and the like).
    function annotationsShownHere() {
        return siteListed('annotationsShownSites');
    }

