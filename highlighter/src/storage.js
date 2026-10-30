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

    function parseRecords(raw) {
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter(r => r && typeof r === 'object') : null;
        } catch (e) {
            return null;
        }
    }

    function readRecords(key) {
        return parseRecords(GM_getValue(key, null));
    }

    // Saves `records` under `key`; with none left the key is removed.
    function writeRecords(key, records) {
        if (records.length) GM_setValue(key, JSON.stringify(records));
        else GM_deleteValue(key);
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
        const records = loadStoredRecords();
        records.forEach(r => knownOwners.add(recordOwner(r)));
        return records;
    }

    function loadStoredRecords() {
        const records = readRecords(currentKey) || [];
        // Annotations saved under this page's plain URL (by older versions, or before the site
        // declared a canonical URL) move to the current key.
        const legacyKeys = Array.from(new Set([urlKey(location.href), location.href])).filter(k => k !== currentKey);
        const moved = [];
        legacyKeys.forEach(k => {
            const old = readRecords(k);
            if (old) { records.push(...old); moved.push(k); }
        });
        if (!moved.length) return records;
        const seen = new Set();
        const merged = records.filter(r => {
            const sig = `${recordSignature(r)}|${r.text}`;
            if (seen.has(sig)) return false;
            seen.add(sig);
            return true;
        });
        GM_setValue(currentKey, JSON.stringify(merged));
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
        const merged = own.concat(others);
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

