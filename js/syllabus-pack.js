/**
 * ccp-syllabus-pack import/export (compatible with Class Calendar Multi User).
 * window.CCPSyllabusPack
 */
(function (global) {
    const KIND = 'ccp-syllabus-pack';
    const VERSION = 1;

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj || null));
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

        if (imported.curriculumOverrides && typeof imported.curriculumOverrides === 'object') {
            if (!data.curriculumOverrides || typeof data.curriculumOverrides !== 'object') {
                data.curriculumOverrides = {};
            }
            Object.keys(imported.curriculumOverrides).forEach((cid) => {
                const patch = imported.curriculumOverrides[cid];
                if (!patch || typeof patch !== 'object') {
                    return;
                }
                data.curriculumOverrides[cid] = deepClone(patch);
                bookCount += 1;
            });
        }

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
                if (!bookCount) {
                    bookCount += 1;
                }
            });
        }

        return { templateCount, overrideCount, bookCount };
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
        downloadPack
    };
})(typeof window !== 'undefined' ? window : globalThis);
