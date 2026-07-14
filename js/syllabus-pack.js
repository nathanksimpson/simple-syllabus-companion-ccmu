/**
 * ccp-syllabus-pack import/export (compatible with Class Calendar Multi User).
 * Companion is pack-first: Class Calendar factory-keyed packs are normalized on import
 * so every book with a title and/or sessions appears in the curriculum catalog.
 * window.CCPSyllabusPack
 */
(function (global) {
    const KIND = 'ccp-syllabus-pack';
    const VERSION = 1;

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj || null));
    }

    function asSessionList(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        return value
            .filter((row) => row && typeof row === 'object')
            .map((row, i) => ({
                sessionNumber: row.sessionNumber != null ? row.sessionNumber : (i + 1),
                planTitle: row.planTitle != null ? String(row.planTitle) : '',
                planDetail: row.planDetail != null ? String(row.planDetail) : '',
                note: row.note != null ? String(row.note) : ''
            }));
    }

    function factoryCatalogEmpty() {
        const api = global.CCPCurriculaData;
        return !api || typeof api.getAll !== 'function' || api.getAll().length === 0;
    }

    function build(data) {
        const d = data || {};
        return {
            kind: KIND,
            schemaVersion: VERSION,
            exportedAt: new Date().toISOString(),
            customSyllabusTemplates: deepClone(d.customSyllabusTemplates || []),
            defaultClassTypeOverrides: deepClone(d.defaultClassTypeOverrides || {}),
            bookOverrides: deepClone(d.bookOverrides || {}),
            curriculumOverrides: deepClone(d.curriculumOverrides || {}),
            curriculumRemovedIds: Array.isArray(d.curriculumRemovedIds)
                ? [...d.curriculumRemovedIds]
                : []
        };
    }

    function isValid(imported) {
        if (!imported || typeof imported !== 'object') {
            return false;
        }
        if (imported.kind === KIND) {
            return Array.isArray(imported.customSyllabusTemplates)
                || (imported.defaultClassTypeOverrides && typeof imported.defaultClassTypeOverrides === 'object')
                || (imported.curriculumOverrides && typeof imported.curriculumOverrides === 'object')
                || (imported.bookOverrides && typeof imported.bookOverrides === 'object');
        }
        return Array.isArray(imported.customSyllabusTemplates);
    }

    /**
     * Build a catalog-ready curriculumOverrides map from a Class Calendar pack.
     * - Marks entries as isCustom (required when factory catalog is empty)
     * - Hydrates sessions from sessions → teamDefault.sessions → bookOverrides templates
     * - Creates curricula for bookOverrides-only keys
     */
    function normalizePackCurricula(imported, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const forceCustom = opts.forceCustom !== false;
        const pack = imported && typeof imported === 'object' ? imported : {};
        const sourceCur = pack.curriculumOverrides && typeof pack.curriculumOverrides === 'object'
            ? pack.curriculumOverrides
            : {};
        const sourceBooks = pack.bookOverrides && typeof pack.bookOverrides === 'object'
            ? pack.bookOverrides
            : {};
        const out = {};
        const ids = new Set([
            ...Object.keys(sourceCur),
            ...Object.keys(sourceBooks)
        ]);

        ids.forEach((cid) => {
            if (!cid) {
                return;
            }
            const raw = sourceCur[cid] && typeof sourceCur[cid] === 'object'
                ? deepClone(sourceCur[cid])
                : {};
            const bookLeg = sourceBooks[cid] && typeof sourceBooks[cid] === 'object'
                ? sourceBooks[cid]
                : null;

            let sessions = asSessionList(raw.sessions);
            if (!sessions.length && raw.teamDefault && Array.isArray(raw.teamDefault.sessions)) {
                sessions = asSessionList(raw.teamDefault.sessions);
            }
            if (!sessions.length && bookLeg) {
                sessions = asSessionList(bookLeg.defaultSyllabusRowTemplates);
            }

            const bookTitle = String(
                raw.bookTitle
                || (raw.teamDefault && raw.teamDefault.bookTitle)
                || (raw.classDefaults && raw.classDefaults.defaultBook)
                || cid
            ).trim() || cid;

            const applicableLevels = Array.isArray(raw.applicableLevels)
                ? raw.applicableLevels.filter(Boolean)
                : (Array.isArray(raw.levels) ? raw.levels.filter(Boolean) : []);

            const classDefaults = raw.classDefaults && typeof raw.classDefaults === 'object'
                ? deepClone(raw.classDefaults)
                : {};
            if (classDefaults.defaultTotalLessons == null && sessions.length) {
                classDefaults.defaultTotalLessons = sessions.length;
            }
            if (!classDefaults.defaultBook) {
                classDefaults.defaultBook = bookTitle;
            }

            const entry = {
                ...raw,
                isCustom: forceCustom ? true : !!raw.isCustom,
                bookTitle,
                applicableLevels,
                levels: Array.isArray(raw.levels) ? raw.levels.filter(Boolean) : applicableLevels.slice(),
                sessions,
                classDefaults,
                types: raw.types && typeof raw.types === 'object' ? deepClone(raw.types) : {},
                updatedAt: raw.updatedAt || (bookLeg && bookLeg.updatedAt) || new Date().toISOString()
            };

            if (raw.teamDefault && typeof raw.teamDefault === 'object') {
                entry.teamDefault = deepClone(raw.teamDefault);
            }
            if (raw.syllabusGeneralNotes != null) {
                entry.syllabusGeneralNotes = String(raw.syllabusGeneralNotes);
            }

            // Keep debate/custom flags from Class Calendar when present
            if (raw.isBuiltinDebate) {
                entry.isBuiltinDebate = true;
            }
            if (raw.duplicatedFrom) {
                entry.duplicatedFrom = raw.duplicatedFrom;
            }

            out[cid] = entry;
        });

        return out;
    }

    /**
     * Pack-first: ensure any stored override is catalog-visible when factory is empty.
     */
    function promotePackCurriculaForEmptyFactory(data) {
        if (!factoryCatalogEmpty() || !data || typeof data !== 'object') {
            return 0;
        }
        const normalized = normalizePackCurricula({
            curriculumOverrides: data.curriculumOverrides || {},
            bookOverrides: data.bookOverrides || {}
        }, { forceCustom: true });
        const before = JSON.stringify(data.curriculumOverrides || {});
        data.curriculumOverrides = normalized;
        const after = JSON.stringify(data.curriculumOverrides || {});
        return before === after ? 0 : Object.keys(normalized).length;
    }

    function mergeInto(target, imported) {
        const data = target || {};
        let templateCount = 0;
        let overrideCount = 0;
        let bookCount = 0;

        if (Array.isArray(imported.customSyllabusTemplates)) {
            if (!Array.isArray(data.customSyllabusTemplates)) {
                data.customSyllabusTemplates = [];
            }
            imported.customSyllabusTemplates.forEach((tpl) => {
                if (!tpl || !tpl.id) {
                    return;
                }
                const idx = data.customSyllabusTemplates.findIndex((x) => x.id === tpl.id);
                const copy = deepClone(tpl);
                if (idx === -1) {
                    data.customSyllabusTemplates.push(copy);
                } else {
                    data.customSyllabusTemplates[idx] = copy;
                }
                templateCount += 1;
            });
        }

        if (imported.defaultClassTypeOverrides && typeof imported.defaultClassTypeOverrides === 'object') {
            if (!data.defaultClassTypeOverrides || typeof data.defaultClassTypeOverrides !== 'object') {
                data.defaultClassTypeOverrides = {};
            }
            Object.keys(imported.defaultClassTypeOverrides).forEach((presetId) => {
                const patch = imported.defaultClassTypeOverrides[presetId];
                if (!patch || typeof patch !== 'object') {
                    return;
                }
                data.defaultClassTypeOverrides[presetId] = {
                    ...(data.defaultClassTypeOverrides[presetId] || {}),
                    ...deepClone(patch)
                };
                overrideCount += 1;
            });
        }

        // Companion is pack-first: always normalize so factory-keyed Class Calendar packs
        // become catalog-visible custom curricula with hydrated sessions.
        const ready = normalizePackCurricula(imported, { forceCustom: true });

        if (!data.curriculumOverrides || typeof data.curriculumOverrides !== 'object') {
            data.curriculumOverrides = {};
        }
        Object.keys(ready).forEach((cid) => {
            data.curriculumOverrides[cid] = ready[cid];
            bookCount += 1;
        });

        if (Array.isArray(imported.curriculumRemovedIds)) {
            data.curriculumRemovedIds = imported.curriculumRemovedIds.filter(Boolean);
        }

        if (imported.bookOverrides && typeof imported.bookOverrides === 'object') {
            if (!data.bookOverrides || typeof data.bookOverrides !== 'object') {
                data.bookOverrides = {};
            }
            Object.keys(imported.bookOverrides).forEach((bookId) => {
                const patch = imported.bookOverrides[bookId];
                if (!patch || typeof patch !== 'object') {
                    return;
                }
                data.bookOverrides[bookId] = deepClone(patch);
            });
        }

        return {
            templateCount,
            overrideCount,
            bookCount,
            curriculumCount: bookCount
        };
    }

    function downloadPack(data, baseName) {
        const payload = build(data);
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const dateStr = new Date().toISOString().split('T')[0];
        const safe = (baseName || 'syllabus-companion').trim()
            .replace(/[^a-zA-Z0-9가-힣\s-]/g, '')
            .replace(/\s+/g, '-') || 'syllabus-companion';
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safe}_lesson-plans-books_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    global.CCPSyllabusPack = {
        KIND,
        VERSION,
        build,
        isValid,
        mergeInto,
        downloadPack,
        factoryCatalogEmpty,
        promotePackCurriculaForEmptyFactory,
        normalizePackCurricula,
        asSessionList
    };
})(typeof window !== 'undefined' ? window : globalThis);
