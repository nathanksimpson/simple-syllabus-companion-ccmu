/**
 * Auto-load curriculum packs listed in packs/manifest.json into localStorage.
 * window.CCPPacksBoot
 */
(function (global) {
    const LOADED_KEY = 'ccp-companion-loaded-packs';
    const MANIFEST_URL = 'packs/manifest.json';

    function simpleHash(text) {
        let h = 0;
        const s = String(text || '');
        for (let i = 0; i < s.length; i += 1) {
            h = ((h << 5) - h) + s.charCodeAt(i);
            h |= 0;
        }
        return String(h);
    }

    function loadRecord() {
        try {
            const raw = global.localStorage.getItem(LOADED_KEY);
            if (!raw) {
                return {};
            }
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    function saveRecord(record) {
        try {
            global.localStorage.setItem(LOADED_KEY, JSON.stringify(record || {}));
        } catch {
            /* ignore quota / private mode */
        }
    }

    function packUrl(relPath) {
        const clean = String(relPath || '').replace(/^\/+/, '').replace(/\\/g, '/');
        return `packs/${clean}`;
    }

    /**
     * @returns {Promise<{ applied: string[], skipped: string[], errors: { path: string, message: string }[] }>}
     */
    async function loadFromManifest() {
        const result = {
            applied: [],
            skipped: [],
            errors: []
        };

        const packApi = global.CCPSyllabusPack;
        const store = global.CCPCompanionStore;
        if (!packApi || !store || typeof store.mergePack !== 'function') {
            result.errors.push({ path: MANIFEST_URL, message: 'Pack store unavailable' });
            return result;
        }

        let manifest;
        try {
            const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            manifest = await res.json();
        } catch (err) {
            result.errors.push({
                path: MANIFEST_URL,
                message: err && err.message ? err.message : 'Failed to load manifest'
            });
            return result;
        }

        const list = Array.isArray(manifest && manifest.packs) ? manifest.packs : [];
        const record = loadRecord();
        const storeData = typeof store.getData === 'function' ? store.getData() : null;
        const overrideKeys = storeData && storeData.curriculumOverrides
            ? Object.keys(storeData.curriculumOverrides)
            : [];
        const catalogEmpty = overrideKeys.length === 0;

        for (let i = 0; i < list.length; i += 1) {
            const rel = list[i];
            if (!rel || typeof rel !== 'string') {
                continue;
            }
            const url = packUrl(rel);
            try {
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const text = await res.text();
                const hash = simpleHash(text);
                if (!catalogEmpty && record[rel] === hash) {
                    result.skipped.push(rel);
                    continue;
                }
                const imported = JSON.parse(text);
                if (!packApi.isValid(imported)) {
                    throw new Error('Invalid pack');
                }
                store.mergePack(imported);
                record[rel] = hash;
                result.applied.push(rel);
            } catch (err) {
                result.errors.push({
                    path: rel,
                    message: err && err.message ? err.message : 'Failed to load pack'
                });
            }
        }

        saveRecord(record);
        return result;
    }

    global.CCPPacksBoot = {
        LOADED_KEY,
        MANIFEST_URL,
        loadFromManifest,
        simpleHash
    };
})(typeof window !== 'undefined' ? window : globalThis);
