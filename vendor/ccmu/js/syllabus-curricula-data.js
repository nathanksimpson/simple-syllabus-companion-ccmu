/**
 * Companion pack-first stub for CCPCurriculaData.
 * Factory lesson catalogs live in Class Calendar; this app loads curricula from packs/.
 * Do not reintroduce factory CURRICULA via npm run sync:ccmu (file excluded from sync).
 */
(function (global) {
    const CURRICULA = [];
    const LEGACY_ID_ALIASES = {};
    const DEBATE_BAND_LEVELS = {
        purple: [],
        yeoulSaemmul: [],
        senior: []
    };

    const LEVEL_GROUP_META = {
        redOrangeYellow: { order: 1, label: { en: 'Red / Orange / Yellow', ko: 'Red / Orange / Yellow' } },
        greenBlueNavy: { order: 2, label: { en: 'Green / Blue / Navy', ko: 'Green / Blue / Navy' } },
        purple: { order: 3, label: { en: 'Purple', ko: 'Purple' } },
        yeoulSaemmul: { order: 4, label: { en: 'Yeoul / Saemmul', ko: '여울 / 샘물' } },
        badaGaram: { order: 5, label: { en: 'Bada / Garam', ko: '바다 / 가람' } },
        mirinaeByeolmaru: { order: 6, label: { en: 'Mirinae / Byeolmaru', ko: '미리내 / 별마루' } }
    };

    const PROGRAM_TRACK_META = {
        juniorRainbow: { order: 1, label: { en: 'Junior Rainbow', ko: 'Junior Rainbow' } },
        seniorWaterflow: { order: 2, label: { en: 'Senior Waterflow', ko: 'Senior Waterflow' } }
    };

    function emptyTemplates() {
        return [];
    }

    function resolveDebateHomeworkBand() {
        return null;
    }

    function resolveDebatePresetId() {
        return null;
    }

    function getDebateBandLevels(band) {
        return (DEBATE_BAND_LEVELS[band] || []).slice();
    }

    function buildDebateRowTemplates() {
        return emptyTemplates();
    }

    global.CCPCurriculaData = {
        buildDebateRowTemplates,
        resolveDebateHomeworkBand,
        resolveDebatePresetId,
        getDebateBandLevels,
        DEBATE_BAND_LEVELS,
        buildWriteRightTemplates: emptyTemplates,
        buildEarlyWritersTemplates: emptyTemplates,
        buildBestWritingStarterTemplates: emptyTemplates,
        buildWriteNowTemplates: emptyTemplates,
        WRITE_RIGHT_SESSION_COUNT: 0,
        EARLY_WRITERS_WR_SESSION_COUNT: 0,
        BWS_SESSION_COUNT: 0,
        WRITE_NOW_SESSION_COUNT: 0,
        getAll() {
            return CURRICULA.slice();
        },
        getById(id) {
            const resolved = LEGACY_ID_ALIASES[id] || id;
            return CURRICULA.find((p) => p.id === resolved) || null;
        },
        resolvePresetId(id) {
            return LEGACY_ID_ALIASES[id] || id;
        },
        getLegacyAliases() {
            return { ...LEGACY_ID_ALIASES };
        },
        getLevelGroupMeta() {
            return LEVEL_GROUP_META;
        },
        getProgramTrackMeta() {
            return PROGRAM_TRACK_META;
        },
        groupPresetsByLevelGroup(presets, lang) {
            const lg = lang === 'ko' ? 'ko' : 'en';
            const groups = {};
            (presets || []).forEach((p) => {
                const key = p.levelGroup || 'other';
                if (!groups[key]) {
                    const meta = LEVEL_GROUP_META[key];
                    groups[key] = {
                        levelGroup: key,
                        label: meta ? meta.label[lg] : key,
                        order: meta ? meta.order : 99,
                        presets: []
                    };
                }
                groups[key].presets.push(p);
            });
            return Object.values(groups).sort((a, b) => a.order - b.order);
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
