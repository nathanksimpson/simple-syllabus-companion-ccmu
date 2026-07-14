/**
 * localStorage persistence for Syllabus Companion.
 * window.CCPCompanionStore
 */
(function (global) {
    const STORAGE_KEY = 'ccp-syllabus-companion-v2';
    const STORAGE_KEY_V1 = 'ccp-syllabus-companion-v1';
    const PROJECT_KIND = 'ccp-syllabus-project';
    const SCHEMA_VERSION = 2;
    const DEFAULT_TERM_MONTHS = 3;

    function termDatesApi() {
        return global.CCPTermDates || null;
    }

    function paletteApi() {
        return global.CCPClassColorPalette || null;
    }

    function defaultProjectColor(index) {
        const palette = paletteApi();
        const colors = palette && palette.CALM_PALETTE ? palette.CALM_PALETTE : ['#356a9e'];
        return colors[Math.abs(index) % colors.length];
    }

    let saveTimer = null;

    function generateId(prefix) {
        const p = prefix || 'id';
        if (global.crypto && typeof global.crypto.randomUUID === 'function') {
            return `${p}_${global.crypto.randomUUID().slice(0, 8)}`;
        }
        return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    }

    function parseISODateLocal(dateStr) {
        if (global.CCPUtils && global.CCPUtils.parseISODateLocal) {
            return global.CCPUtils.parseISODateLocal(dateStr);
        }
        const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return new Date(NaN);
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }

    function formatDateISO(d) {
        if (global.CCPUtils && global.CCPUtils.formatDateISO) {
            return global.CCPUtils.formatDateISO(d);
        }
        if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function emptyData() {
        return {
            schemaVersion: SCHEMA_VERSION,
            calendarName: 'My term',
            calendarDisplayStart: '',
            calendarDisplayEnd: '',
            termStart: '',
            termEnd: '',
            useAutoTermEnd: true,
            termCalendarMonths: DEFAULT_TERM_MONTHS,
            termEndMode: 'calendarMonths',
            events: [],
            curriculumOverrides: {},
            curriculumRemovedIds: [],
            customSyllabusTemplates: [],
            customClassTypes: [],
            defaultClassTypeOverrides: {},
            bookOverrides: {},
            projects: []
        };
    }

    function getDefaultProjectDates(data) {
        const d = data || {};
        const td = termDatesApi();
        if (d.termStart && td) {
            const startDate = td.normalizeTermStartDate(d.termStart);
            const termShape = {
                termStart: startDate,
                termEnd: d.termEnd || '',
                useAutoTermEnd: d.useAutoTermEnd !== false,
                termMonthCount: d.termCalendarMonths || DEFAULT_TERM_MONTHS
            };
            let endDate = '';
            if (d.useAutoTermEnd === false && d.termEnd) {
                endDate = String(d.termEnd).trim();
            } else if (d.termEndMode === 'exactMonths' && td.computeTermEndDateExactMonths) {
                const computed = td.computeTermEndDateExactMonths(
                    startDate,
                    d.termCalendarMonths || DEFAULT_TERM_MONTHS
                );
                endDate = computed ? td.formatDateForInput(computed) : '';
            } else {
                endDate = td.getResolvedTermEndISO(termShape) || '';
            }
            return {
                startDate,
                endDate,
                useAutoTermEnd: d.useAutoTermEnd !== false,
                termCalendarMonths: d.termCalendarMonths || DEFAULT_TERM_MONTHS,
                termEndMode: d.termEndMode || 'calendarMonths'
            };
        }
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return {
            startDate: `${y}-${m}-${day}`,
            endDate: '',
            useAutoTermEnd: true,
            termCalendarMonths: DEFAULT_TERM_MONTHS,
            termEndMode: 'calendarMonths'
        };
    }

    function emptyProject(overrides, data) {
        const defaults = getDefaultProjectDates(data || (cache || null));
        const colorIdx = (data && data.projects) ? data.projects.length : 0;
        const color = defaultProjectColor(colorIdx);
        return {
            id: generateId('proj'),
            name: 'New syllabus',
            grade: '',
            levelPreset: '',
            levelCustom: '',
            sectionLevel: '',
            classTypeId: '',
            period: null,
            scheduleBlock: 'primary',
            book: '',
            curriculumId: '',
            color,
            textColor: '',
            startDate: defaults.startDate,
            endDate: defaults.endDate,
            useAutoTermEnd: defaults.useAutoTermEnd,
            termEndMode: defaults.termEndMode,
            termCalendarMonths: defaults.termCalendarMonths,
            classScheduleTemplate: 'mwf',
            meetingsPerWeek: 2,
            meetingDays: [1, 3],
            totalLessons: 20,
            scheduleModel: 'sequentialTerm',
            syllabusGeneralNotes: '',
            syllabusRows: [],
            events: [],
            debateBookPeriods: [],
            skippedLessons: [],
            compressionMerges: [],
            compressionMode: 'autoWhenNeeded',
            compressionMergesByPeriod: {},
            updatedAt: new Date().toISOString(),
            ...overrides
        };
    }

    function ensureProjectIdentity(project, index) {
        const migrated = project && typeof project === 'object' ? { ...project } : {};
        let healed = false;

        // Repair projects corrupted by wizard saving applyCurriculumPages() result as the project.
        if (typeof migrated.ok === 'boolean' || Object.prototype.hasOwnProperty.call(migrated, 'applied')) {
            if (!Array.isArray(migrated.syllabusRows) && Array.isArray(migrated.rows)) {
                migrated.syllabusRows = migrated.rows;
            }
            delete migrated.ok;
            delete migrated.applied;
            delete migrated.rows;
            healed = true;
        }

        if (!migrated.id || !String(migrated.id).trim()) {
            migrated.id = generateId('proj');
            healed = true;
        }
        if (!String(migrated.name || '').trim()) {
            migrated.name = 'New syllabus';
            healed = true;
        }
        if (!Array.isArray(migrated.syllabusRows)) {
            migrated.syllabusRows = [];
            healed = true;
        }
        if (!Array.isArray(migrated.events)) {
            migrated.events = [];
            healed = true;
        }
        if (!migrated.color) {
            migrated.color = defaultProjectColor(index || 0);
            healed = true;
        }
        return { project: migrated, healed };
    }

    function migrateProjectV1(p, index) {
        const raw = p && typeof p === 'object' ? p : {};
        const identity = ensureProjectIdentity(raw, index);
        const events = Array.isArray(identity.project.events) ? [...identity.project.events] : [];
        const migrated = { ...identity.project };
        if (Array.isArray(raw.holidays) && raw.holidays.length && global.CCPCalendarEvents) {
            raw.holidays.forEach((h) => {
                if (h && h.date) {
                    events.push(global.CCPCalendarEvents.migrateHolidayToEvent(h));
                }
            });
        }
        migrated.events = events;
        delete migrated.holidays;
        migrated.grade = migrated.grade || '';
        migrated.levelPreset = migrated.levelPreset || '';
        migrated.levelCustom = migrated.levelCustom || '';
        migrated.sectionLevel = migrated.sectionLevel || '';
        migrated.classTypeId = migrated.classTypeId || '';
        migrated.period = migrated.period == null || migrated.period === ''
            ? null
            : Number(migrated.period);
        migrated.scheduleBlock = migrated.scheduleBlock || 'primary';
        migrated.book = migrated.book || '';
        if (!migrated.color) {
            migrated.color = defaultProjectColor(index || 0);
        }
        if (migrated.textColor == null) {
            migrated.textColor = '';
        }
        if (!migrated.levelPreset && global.CCPClassMetadata) {
            const preset = global.CCPClassMetadata.resolveLevelPresetForForm(migrated);
            if (preset) {
                migrated.levelPreset = preset;
            }
        }
        if (!migrated.levelCustom && global.CCPClassMetadata) {
            const custom = global.CCPClassMetadata.resolveLevelCustomForForm(migrated);
            if (custom) {
                migrated.levelCustom = custom;
            }
        }
        migrated.updatedAt = migrated.updatedAt || new Date().toISOString();
        const next = migrateProjectScheduleFields(migrated);
        next.__healed = !!identity.healed;
        return next;
    }

    function migrateProjectScheduleFields(project) {
        const p = { ...project };
        const days = Array.isArray(p.meetingDays)
            ? [...new Set(p.meetingDays.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b)
            : [];
        const mwf = [1, 3, 5];
        const tt = [2, 4];
        const isSubset = (pool) => days.length > 0 && days.every((day) => pool.includes(day));

        if (!p.classScheduleTemplate) {
            if (isSubset(tt) && !days.some((day) => mwf.includes(day))) {
                p.classScheduleTemplate = 'tt';
            } else if (isSubset(mwf)) {
                p.classScheduleTemplate = 'mwf';
            } else if (days.length) {
                p.classScheduleTemplate = 'custom';
            } else {
                p.classScheduleTemplate = 'mwf';
            }
        }

        if (p.meetingsPerWeek !== 1 && p.meetingsPerWeek !== 2) {
            if (p.parentProjectId) {
                p.meetingsPerWeek = days.length === 1 ? 1 : 2;
            } else if (days.length === 1) {
                p.meetingsPerWeek = 1;
            } else {
                p.meetingsPerWeek = 2;
            }
        }

        const datesApi = global.CCPScheduleLessonDates;
        if (!p.parentProjectId && datesApi && typeof datesApi.syncTemplateMeetingDays === 'function') {
            p.meetingDays = datesApi.syncTemplateMeetingDays(p);
        } else if (!days.length) {
            p.meetingDays = p.classScheduleTemplate === 'tt' ? [...tt] : [...mwf];
        } else {
            p.meetingDays = days;
        }

        if (!Array.isArray(p.debateBookPeriods)) p.debateBookPeriods = [];
        if (!Array.isArray(p.skippedLessons)) p.skippedLessons = [];
        if (!Array.isArray(p.compressionMerges)) p.compressionMerges = [];
        if (!p.compressionMode) p.compressionMode = 'autoWhenNeeded';
        if (!p.compressionMergesByPeriod || typeof p.compressionMergesByPeriod !== 'object') {
            p.compressionMergesByPeriod = {};
        }

        return p;
    }

    function migrateWorkspaceTermFields(parsed) {
        const out = { ...parsed };
        const td = termDatesApi();
        if (!out.termStart && out.calendarDisplayStart) {
            out.termStart = out.calendarDisplayStart;
        }
        if (out.useAutoTermEnd !== true && out.useAutoTermEnd !== false) {
            out.useAutoTermEnd = true;
        }
        if (!out.termCalendarMonths) {
            out.termCalendarMonths = DEFAULT_TERM_MONTHS;
        }
        if (!out.termEndMode) {
            out.termEndMode = 'calendarMonths';
        }
        if (td && out.termStart) {
            out.termStart = td.normalizeTermStartDate(out.termStart);
            if (!out.termEnd || out.useAutoTermEnd !== false) {
                out.termEnd = td.getResolvedTermEndISO({
                    termStart: out.termStart,
                    termEnd: out.termEnd,
                    useAutoTermEnd: out.useAutoTermEnd,
                    termMonthCount: out.termCalendarMonths
                });
            }
        }
        return out;
    }

    function normalizeProjectsList(projects) {
        let healedAny = false;
        const list = Array.isArray(projects)
            ? projects
                .filter((p) => p && typeof p === 'object')
                .map((p, idx) => {
                    const migrated = migrateProjectV1(p, idx);
                    if (migrated.__healed) healedAny = true;
                    delete migrated.__healed;
                    if (!migrated.color) {
                        migrated.color = defaultProjectColor(idx);
                        healedAny = true;
                    }
                    return migrated;
                })
            : [];
        return { projects: list, healedAny };
    }

    function migrateToV2(parsed) {
        const base = emptyData();
        const { projects } = normalizeProjectsList(parsed.projects);
        const merged = migrateWorkspaceTermFields({
            ...base,
            ...parsed,
            schemaVersion: SCHEMA_VERSION,
            calendarName: parsed.calendarName || base.calendarName,
            calendarDisplayStart: parsed.calendarDisplayStart || '',
            calendarDisplayEnd: parsed.calendarDisplayEnd || '',
            events: Array.isArray(parsed.events) ? parsed.events : [],
            customClassTypes: Array.isArray(parsed.customClassTypes) ? parsed.customClassTypes : [],
            projects
        });
        return merged;
    }

    function computeDisplayRangeFromProjects(projects) {
        let min = null;
        let max = null;
        (projects || []).forEach((p) => {
            [p.startDate, p.endDate].forEach((ds) => {
                if (!ds) return;
                const d = parseISODateLocal(ds);
                if (Number.isNaN(d.getTime())) return;
                if (!min || d < min) min = d;
                if (!max || d > max) max = d;
            });
        });
        if (!min || !max) {
            const today = new Date();
            min = new Date(today.getFullYear(), today.getMonth(), 1);
            max = new Date(today.getFullYear(), today.getMonth() + 3, 0);
        } else {
            min = new Date(min.getFullYear(), min.getMonth(), 1);
            max = new Date(max.getFullYear(), max.getMonth() + 1, 0);
        }
        return {
            start: formatDateISO(min),
            end: formatDateISO(max)
        };
    }

    function ensureDisplayRange(data) {
        const d = data || load();
        if (!d.calendarDisplayStart || !d.calendarDisplayEnd) {
            const range = computeDisplayRangeFromProjects(d.projects);
            d.calendarDisplayStart = range.start;
            d.calendarDisplayEnd = range.end;
        }
        return d;
    }

    let cache = null;

    function load() {
        if (cache) {
            return cache;
        }
        try {
            let raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                raw = localStorage.getItem(STORAGE_KEY_V1);
            }
            if (!raw) {
                cache = emptyData();
                ensureDisplayRange(cache);
                return cache;
            }
            const parsed = JSON.parse(raw);
            if (parsed.schemaVersion === SCHEMA_VERSION) {
                const { projects, healedAny } = normalizeProjectsList(parsed.projects);
                cache = migrateWorkspaceTermFields({
                    ...emptyData(),
                    ...parsed,
                    projects
                });
                if (healedAny) {
                    save(cache);
                }
            } else {
                cache = migrateToV2(parsed);
                save(cache);
            }
            ensureDisplayRange(cache);
            if (global.CCPSyllabusPack
                && typeof global.CCPSyllabusPack.promotePackCurriculaForEmptyFactory === 'function') {
                const promoted = global.CCPSyllabusPack.promotePackCurriculaForEmptyFactory(cache);
                if (promoted > 0) {
                    save(cache);
                }
            }
            return cache;
        } catch {
            cache = emptyData();
            ensureDisplayRange(cache);
            return cache;
        }
    }

    function save(data) {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
        cache = data || load();
        cache.schemaVersion = SCHEMA_VERSION;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
        localStorage.removeItem(STORAGE_KEY_V1);
        return cache;
    }

    function saveDebounced(data, delayMs) {
        cache = data || load();
        if (saveTimer) {
            clearTimeout(saveTimer);
        }
        saveTimer = setTimeout(() => {
            save(cache);
            saveTimer = null;
        }, delayMs || 300);
        return cache;
    }

    function getData() {
        return load();
    }

    function getAppDataShape() {
        const d = load();
        return {
            curriculumOverrides: d.curriculumOverrides,
            curriculumRemovedIds: d.curriculumRemovedIds,
            customSyllabusTemplates: d.customSyllabusTemplates,
            customClassTypes: d.customClassTypes,
            defaultClassTypeOverrides: d.defaultClassTypeOverrides,
            bookOverrides: d.bookOverrides
        };
    }

    function getProjects() {
        return load().projects;
    }

    function getProject(id) {
        return load().projects.find((p) => p.id === id) || null;
    }

    function upsertProject(project) {
        const d = load();
        const { project: normalized } = ensureProjectIdentity(project, d.projects.length);
        const copy = migrateProjectScheduleFields({
            ...normalized,
            updatedAt: new Date().toISOString()
        });
        delete copy.__healed;
        const idx = d.projects.findIndex((p) => p.id === copy.id);
        if (idx === -1) {
            d.projects.push(copy);
        } else {
            d.projects[idx] = copy;
        }
        save(d);
        return copy;
    }

    function upsertProjectDebounced(project, delayMs) {
        const d = load();
        const { project: normalized } = ensureProjectIdentity(project, d.projects.length);
        const copy = migrateProjectScheduleFields({
            ...normalized,
            updatedAt: new Date().toISOString()
        });
        delete copy.__healed;
        const idx = d.projects.findIndex((p) => p.id === copy.id);
        // Do not resurrect a project that was deleted while autosave was in flight.
        if (idx === -1) {
            return null;
        }
        d.projects[idx] = copy;
        saveDebounced(d, delayMs);
        return copy;
    }

    function deleteProject(id) {
        if (!id) return;
        const d = load();
        d.projects = d.projects.filter((p) => p.id !== id && p.parentProjectId !== id);
        save(d);
    }

    function addProject(overrides) {
        const d = load();
        const p = emptyProject(overrides, d);
        upsertProject(p);
        return p;
    }

    function deepCloneJson(value) {
        return JSON.parse(JSON.stringify(value == null ? null : value));
    }

    function uniqueProjectCopyName(baseName, data) {
        const lang = global.__companionLang || 'en';
        const suffix = lang === 'ko' ? '복사' : 'copy';
        const root = String(baseName || (lang === 'ko' ? '새 진도표' : 'New syllabus')).trim()
            || (lang === 'ko' ? '새 진도표' : 'New syllabus');
        const names = new Set((data.projects || []).map((p) => String(p.name || '').trim().toLowerCase()));
        let candidate = `${root} (${suffix})`;
        let n = 2;
        while (names.has(candidate.toLowerCase())) {
            candidate = `${root} (${suffix} ${n})`;
            n += 1;
        }
        return candidate;
    }

    function duplicateProject(sourceId) {
        const d = load();
        const source = (d.projects || []).find((p) => p.id === sourceId);
        if (!source) return null;
        const copy = deepCloneJson(source);
        const newId = generateId('proj');
        copy.id = newId;
        copy.name = uniqueProjectCopyName(source.name, d);
        copy.duplicatedFrom = source.id;
        delete copy.parentProjectId;
        delete copy.sourceMeetingDays;
        copy.updatedAt = new Date().toISOString();
        if (Array.isArray(copy.syllabusRows)) {
            copy.syllabusRows = copy.syllabusRows.map((row) => ({
                ...row,
                id: generateId('row')
            }));
        }
        if (Array.isArray(copy.events)) {
            copy.events = copy.events.map((ev) => ({
                ...ev,
                id: generateId('evt')
            }));
        }
        return upsertProject(copy);
    }

    function setTermDates(fields) {
        const d = load();
        const td = termDatesApi();
        if (fields.termStart != null) {
            d.termStart = td ? td.normalizeTermStartDate(fields.termStart) : String(fields.termStart || '').trim();
        }
        if (fields.useAutoTermEnd != null) {
            d.useAutoTermEnd = fields.useAutoTermEnd !== false;
        }
        if (fields.termCalendarMonths != null) {
            d.termCalendarMonths = parseInt(fields.termCalendarMonths, 10) || DEFAULT_TERM_MONTHS;
        }
        if (fields.termEndMode != null) {
            d.termEndMode = fields.termEndMode || 'calendarMonths';
        }
        if (fields.termEnd != null) {
            d.termEnd = String(fields.termEnd || '').trim();
        }
        if (td && d.termStart) {
            if (d.useAutoTermEnd === false && d.termEnd) {
                // keep manual end
            } else if (d.termEndMode === 'exactMonths') {
                const computed = td.computeTermEndDateExactMonths(d.termStart, d.termCalendarMonths);
                d.termEnd = computed ? td.formatDateForInput(computed) : d.termEnd;
            } else {
                d.termEnd = td.getResolvedTermEndISO({
                    termStart: d.termStart,
                    termEnd: d.termEnd,
                    useAutoTermEnd: d.useAutoTermEnd,
                    termMonthCount: d.termCalendarMonths
                });
            }
        }
        if (fields.calendarDisplayStart != null) {
            d.calendarDisplayStart = fields.calendarDisplayStart;
        }
        if (fields.calendarDisplayEnd != null) {
            d.calendarDisplayEnd = fields.calendarDisplayEnd;
        }
        if (d.termStart && d.termEnd && !d.calendarDisplayStart) {
            d.calendarDisplayStart = d.termStart;
            d.calendarDisplayEnd = d.termEnd;
        }
        save(d);
        return d;
    }

    function getTermDateRange() {
        const d = load();
        const td = termDatesApi();
        if (!td || !d.termStart) {
            return { start: d.termStart || '', end: d.termEnd || '' };
        }
        return td.getTermDateRangeISO({
            termStart: d.termStart,
            termEnd: d.termEnd,
            useAutoTermEnd: d.useAutoTermEnd,
            termMonthCount: d.termCalendarMonths
        });
    }

    function upsertSharedEvent(event) {
        const d = load();
        if (!Array.isArray(d.events)) {
            d.events = [];
        }
        const ev = global.CCPCalendarEvents
            ? global.CCPCalendarEvents.normalizeEvent(event)
            : event;
        const idx = d.events.findIndex((e) => e.id === ev.id);
        if (idx === -1) {
            d.events.push(ev);
        } else {
            d.events[idx] = ev;
        }
        save(d);
        return ev;
    }

    function deleteSharedEvent(eventId) {
        const d = load();
        d.events = (d.events || []).filter((e) => e.id !== eventId);
        save(d);
    }

    function upsertProjectEvent(projectId, event) {
        const d = load();
        const idx = d.projects.findIndex((p) => p.id === projectId);
        if (idx === -1) return null;
        const proj = d.projects[idx];
        if (!Array.isArray(proj.events)) {
            proj.events = [];
        }
        const ev = global.CCPCalendarEvents
            ? global.CCPCalendarEvents.normalizeEvent(event)
            : event;
        const eidx = proj.events.findIndex((e) => e.id === ev.id);
        if (eidx === -1) {
            proj.events.push(ev);
        } else {
            proj.events[eidx] = ev;
        }
        proj.updatedAt = new Date().toISOString();
        d.projects[idx] = proj;
        save(d);
        return ev;
    }

    function deleteProjectEvent(projectId, eventId) {
        const d = load();
        const idx = d.projects.findIndex((p) => p.id === projectId);
        if (idx === -1) return;
        const proj = d.projects[idx];
        proj.events = (proj.events || []).filter((e) => e.id !== eventId);
        d.projects[idx] = proj;
        save(d);
    }

    function fitDisplayRangeToProjects() {
        const d = load();
        const range = computeDisplayRangeFromProjects(d.projects);
        d.calendarDisplayStart = range.start;
        d.calendarDisplayEnd = range.end;
        save(d);
        return range;
    }

    function setDisplayRange(start, end) {
        const d = load();
        d.calendarDisplayStart = start || d.calendarDisplayStart;
        d.calendarDisplayEnd = end || d.calendarDisplayEnd;
        save(d);
        return d;
    }

    function mergePack(imported) {
        const d = load();
        const counts = global.CCPSyllabusPack
            ? global.CCPSyllabusPack.mergeInto(d, imported)
            : { templateCount: 0, overrideCount: 0, bookCount: 0 };
        save(d);
        return counts;
    }

    function importCalendarJson(imported) {
        const d = load();
        let count = 0;
        if (imported && Array.isArray(imported.events) && global.CCPCalendarEvents) {
            const merged = global.CCPCalendarEvents.importCalendarEvents(imported);
            merged.forEach((ev) => {
                const idx = d.events.findIndex((e) => e.id === ev.id);
                if (idx === -1) {
                    d.events.push(ev);
                } else {
                    d.events[idx] = ev;
                }
                count += 1;
            });
        }
        if (imported && imported.calendarName) {
            d.calendarName = imported.calendarName;
        }
        save(d);
        return count;
    }

    async function importKoreanPublicHolidays(options) {
        const d = load();
        if (!global.CCPCalendarEvents || typeof global.CCPCalendarEvents.buildKrPublicHolidayImport !== 'function') {
            throw new Error('Holiday import unavailable');
        }
        const start = (options && options.start) || d.calendarDisplayStart;
        const end = (options && options.end) || d.calendarDisplayEnd;
        const importedEvents = await global.CCPCalendarEvents.buildKrPublicHolidayImport(start, end, options);
        if (!Array.isArray(d.events)) {
            d.events = [];
        }
        let added = 0;
        let skipped = 0;
        importedEvents.forEach((event) => {
            if (!global.CCPCalendarEvents.eventOverlapsDateRange(event, start, end)) {
                skipped += 1;
                return;
            }
            if (global.CCPCalendarEvents.isDuplicateKrHolidayImport(event, d.events)) {
                skipped += 1;
                return;
            }
            d.events.push(global.CCPCalendarEvents.normalizeEvent(event));
            added += 1;
        });
        save(d);
        return {
            added,
            skipped,
            start,
            end,
            sourceUrl: global.CCPCalendarEvents.KR_PUBLIC_HOLIDAYS_SOURCE_PAGE
        };
    }

    function exportProjectBackup() {
        const d = load();
        return {
            kind: PROJECT_KIND,
            schemaVersion: SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            ...d
        };
    }

    function importProjectBackup(imported) {
        if (!imported || imported.kind !== PROJECT_KIND) {
            return false;
        }
        const d = migrateToV2(imported);
        save(d);
        return true;
    }

    global.CCPCompanionStore = {
        STORAGE_KEY,
        PROJECT_KIND,
        SCHEMA_VERSION,
        generateId,
        emptyData,
        emptyProject,
        getDefaultProjectDates,
        setTermDates,
        getTermDateRange,
        defaultProjectColor,
        load,
        save,
        saveDebounced,
        getData,
        getAppDataShape,
        getProjects,
        getProject,
        upsertProject,
        upsertProjectDebounced,
        deleteProject,
        addProject,
        duplicateProject,
        upsertSharedEvent,
        deleteSharedEvent,
        upsertProjectEvent,
        deleteProjectEvent,
        fitDisplayRangeToProjects,
        setDisplayRange,
        computeDisplayRangeFromProjects,
        ensureDisplayRange,
        mergePack,
        importCalendarJson,
        importKoreanPublicHolidays,
        exportProjectBackup,
        importProjectBackup
    };
})(typeof window !== 'undefined' ? window : globalThis);
