/**
 * Class field metadata shared with Class Calendar Multi User.
 * window.CCPClassMetadata
 */
(function (global) {
    const CLASS_PERIOD_MIN = 1;
    const CLASS_PERIOD_MAX = 7;

    const SCHOOL_GRADE_OPTIONS = (() => {
        const elem = '\uCD08';
        const mid = '\uC911';
        return [
            elem + '1', elem + '2', elem + '3', elem + '4', elem + '5', elem + '6',
            mid + '1', mid + '2', mid + '3'
        ];
    })();

    const ELEMENTARY_GRADES = SCHOOL_GRADE_OPTIONS.slice(0, 6);
    const MIDDLE_SCHOOL_GRADES = SCHOOL_GRADE_OPTIONS.slice(6);

    const SIMSON_LEVEL_GROUPS = (() => {
        const mid = '\uC911';
        const mid1 = mid + '1';
        const mid2 = mid + '2';
        const mid3 = mid + '3';
        return [
            {
                id: 'elementary',
                labelKey: 'simsonLevelsElementary',
                fallbackLabel: 'Elementary',
                levels: [
                    { id: 'Red', name: 'Red', grade: null },
                    { id: 'Orange', name: 'Orange', grade: null },
                    { id: 'Yellow', name: 'Yellow', grade: null },
                    { id: 'Green', name: 'Green', grade: null },
                    { id: 'Blue', name: 'Blue', grade: null },
                    { id: 'Navy', name: 'Navy', grade: null },
                    { id: 'Purple', name: 'Purple', grade: null },
                    { id: 'Yeoul', name: 'Yeoul', grade: null },
                    { id: 'Saemmul', name: 'Saemmul', grade: null },
                    { id: 'Garam', name: 'Garam', grade: null },
                    { id: 'Bada', name: 'Bada', grade: null },
                    { id: 'Byeolmaru', name: 'Byeolmaru', grade: null },
                    { id: 'Mirinae', name: 'Mirinae', grade: null }
                ]
            },
            {
                id: 'middle',
                labelKey: 'simsonLevelsMiddleSchool',
                fallbackLabel: 'Middle school',
                levels: [
                    { id: '\uC720\uB9C8', name: '\uC720\uB9C8', grade: mid1 },
                    { id: '\uB808\uC624', name: '\uB808\uC624', grade: mid1 },
                    { id: '\uD30C\uBCF4', name: '\uD30C\uBCF4', grade: mid1 },
                    { id: '\uD3F4\uB77C', name: '\uD3F4\uB77C', grade: mid1 },
                    { id: '\uD649\uC2A4', name: '\uD649\uC2A4', grade: mid2 },
                    { id: '\uD2F0\uCE74', name: '\uD2F0\uCE74', grade: mid2 },
                    { id: '\uBE45\uD0A4', name: '\uBE45\uD0A4', grade: mid2 },
                    { id: '\uBC14\uC774\uCEEC', name: '\uBC14\uC774\uCEEC', grade: mid2 },
                    { id: '\uC548\uB098', name: '\uC548\uB098', grade: mid3 },
                    { id: '\uB0AD\uAC00', name: '\uB0AD\uAC00', grade: mid3 },
                    { id: '\uB85C\uCCB4', name: '\uB85C\uCCB4', grade: mid3 },
                    { id: '\uCE89\uCCB8', name: '\uCE89\uCCB8', grade: mid3 }
                ]
            }
        ];
    })();

    const LEGACY_SECTION_PRESETS = ['A', 'B', 'C', 'm-section', 't-section'];

    const SCHEDULE_BLOCK_OPTIONS = [
        { id: 'primary', labelKey: 'classScheduleBlockPrimary', fallbackLabel: 'Primary (main grid)' },
        { id: 'secondary', labelKey: 'classScheduleBlockSecondary', fallbackLabel: 'Secondary (Conversation / IPE / MS)' }
    ];

    function getAllSimsonLevels() {
        return SIMSON_LEVEL_GROUPS.flatMap((group) => group.levels);
    }

    function getSimsonLevelById(id) {
        const value = (id || '').trim();
        if (!value) return null;
        return getAllSimsonLevels().find((level) => level.id === value) || null;
    }

    function isSimsonLevelPreset(value) {
        return !!getSimsonLevelById(value);
    }

    function isLegacySectionPreset(value) {
        return LEGACY_SECTION_PRESETS.includes((value || '').trim());
    }

    function resolveLevelPresetForForm(record) {
        if (!record) return '';
        const preset = (record.levelPreset != null ? record.levelPreset : '').trim();
        if (isSimsonLevelPreset(preset)) return preset;
        const legacySection = (record.sectionLevel || '').trim();
        if (isSimsonLevelPreset(legacySection)) return legacySection;
        const legacyLevel = (record.level || '').trim();
        if (isSimsonLevelPreset(legacyLevel)) return legacyLevel;
        return '';
    }

    function resolveLevelCustomForForm(record) {
        if (!record) return '';
        const custom = (record.levelCustom || '').trim();
        if (custom) return custom;
        const preset = (record.levelPreset || '').trim();
        if (isLegacySectionPreset(preset)) return preset;
        const legacySection = (record.sectionLevel || '').trim();
        if (isLegacySectionPreset(legacySection)) return legacySection;
        const legacyLevel = (record.level || '').trim();
        if (legacyLevel && !isSimsonLevelPreset(legacyLevel) && !isLegacySectionPreset(legacyLevel)) {
            return legacyLevel;
        }
        if (preset && !isSimsonLevelPreset(preset) && !isLegacySectionPreset(preset)) {
            return preset;
        }
        return '';
    }

    function getLevelDisplayName(record) {
        if (!record) return '';
        const custom = (record.levelCustom || '').trim();
        if (custom) return custom;
        const preset = resolveLevelPresetForForm(record);
        if (preset) {
            const def = getSimsonLevelById(preset);
            return def ? def.name : preset;
        }
        return (record.levelPreset || record.sectionLevel || record.level || '').trim();
    }

    function getLocalizedGroupLabel(group, t) {
        if (typeof t === 'function' && group.labelKey) {
            const translated = t(group.labelKey);
            if (translated && translated !== group.labelKey) {
                return translated;
            }
        }
        return group.fallbackLabel || group.id || '';
    }

    function getSectionLevelOptions() {
        return getAllSimsonLevels().map((level) => ({
            value: level.id,
            label: level.name
        }));
    }

    global.CCPClassMetadata = {
        CLASS_PERIOD_MIN,
        CLASS_PERIOD_MAX,
        SCHOOL_GRADE_OPTIONS,
        ELEMENTARY_GRADES,
        MIDDLE_SCHOOL_GRADES,
        SIMSON_LEVEL_GROUPS,
        LEGACY_SECTION_PRESETS,
        SCHEDULE_BLOCK_OPTIONS,
        getAllSimsonLevels,
        getSimsonLevelById,
        isSimsonLevelPreset,
        isLegacySectionPreset,
        resolveLevelPresetForForm,
        resolveLevelCustomForForm,
        getLevelDisplayName,
        getLocalizedGroupLabel,
        getSectionLevelOptions
    };
})(typeof window !== 'undefined' ? window : globalThis);
