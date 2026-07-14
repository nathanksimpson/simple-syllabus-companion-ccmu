/**
 * Calendar events (Class Calendar compatible schema).
 * window.CCPCalendarEvents
 */
(function (global) {
    const EVENT_TYPES = {
        HOLIDAY: 'holiday',
        EVALUATION_DEADLINE: 'evaluation_deadline',
        HOMEWORK_DEADLINE: 'homework_deadline',
        EVALUATION_PERIOD: 'evaluation_period',
        OTHER: 'other'
    };

    const EVENT_TYPE_DEFAULT_COLORS = {
        holiday: { bg: '#fef3c7', text: '#b45309' },
        evaluation_deadline: { bg: '#fecaca', text: '#991b1b' },
        homework_deadline: { bg: '#dbeafe', text: '#1e40af' },
        evaluation_period: { bg: '#e9d5ff', text: '#6b21a1' },
        other: { bg: '#e5e7eb', text: '#374151' }
    };
    const KR_PUBLIC_HOLIDAYS_JSON_BASE = 'https://holidays.hyunbin.page';
    const KR_PUBLIC_HOLIDAYS_JSON_CDN = 'https://cdn.jsdelivr.net/gh/hyunbinseo/holidays-kr@main/public';
    const KR_PUBLIC_HOLIDAYS_SOURCE_PAGE = 'https://holidays.hyunbin.page/';
    const KR_PUBLIC_HOLIDAY_NAME_EN = {
        '1월 1일': 'New Year\'s Day',
        '신정': 'New Year\'s Day',
        '설날 전날': 'Day before Seollal (Lunar New Year)',
        '설날': 'Seollal (Lunar New Year)',
        '설날 다음 날': 'Day after Seollal (Lunar New Year)',
        '3ㆍ1절': 'Independence Movement Day (March 1)',
        '3·1절': 'Independence Movement Day (March 1)',
        '3.1절': 'Independence Movement Day (March 1)',
        '삼일절': 'Independence Movement Day (March 1)',
        '노동절': 'Labor Day',
        '어린이날': 'Children\'s Day',
        '부처님 오신 날': 'Buddha\'s Birthday',
        '석가탄신일': 'Buddha\'s Birthday',
        '전국동시지방선거': 'Local elections (national)',
        '현충일': 'Memorial Day',
        '제헌절': 'Constitution Day',
        '광복절': 'Liberation Day',
        '추석 전날': 'Day before Chuseok',
        '추석': 'Chuseok (Korean Thanksgiving)',
        '추석 다음 날': 'Day after Chuseok',
        '개천절': 'National Foundation Day',
        '한글날': 'Hangeul Day',
        '기독탄신일': 'Christmas Day',
        '크리스마스': 'Christmas Day',
        '대체공휴일': 'Substitute public holiday',
        '임시공휴일': 'Temporary public holiday'
    };

    const ELEMENTARY_GRADES = (global.CCPClassMetadata && global.CCPClassMetadata.ELEMENTARY_GRADES)
        || ['초1', '초2', '초3', '초4', '초5', '초6'];
    const MIDDLE_SCHOOL_GRADES = (global.CCPClassMetadata && global.CCPClassMetadata.MIDDLE_SCHOOL_GRADES)
        || ['중1', '중2', '중3'];
    const SECTION_OPTIONS = (global.CCPClassMetadata && global.CCPClassMetadata.getSectionLevelOptions
        ? global.CCPClassMetadata.getSectionLevelOptions().map((opt) => opt.value)
        : null) || ['m-section', 't-section', 'A', 'B', 'C'];

    function generateId() {
        if (global.CCPCompanionStore && global.CCPCompanionStore.generateId) {
            return global.CCPCompanionStore.generateId('ev');
        }
        return `ev_${Date.now().toString(36)}`;
    }

    function parseISODateLocal(dateStr) {
        if (global.CCPUtils && global.CCPUtils.parseISODateLocal) {
            return global.CCPUtils.parseISODateLocal(dateStr);
        }
        const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return new Date(NaN);
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }

    function formatDateISO(date) {
        if (global.CCPUtils && global.CCPUtils.formatDateISO) {
            return global.CCPUtils.formatDateISO(date);
        }
        const d = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function normalizeEventType(type) {
        const valid = Object.values(EVENT_TYPES);
        return valid.includes(type) ? type : EVENT_TYPES.HOLIDAY;
    }

    function eventTypeBlocksClass(type) {
        const normalized = normalizeEventType(type);
        return normalized === EVENT_TYPES.HOLIDAY
            || normalized === EVENT_TYPES.EVALUATION_PERIOD;
    }

    function normalizeEvent(raw) {
        const type = normalizeEventType(raw && raw.type);
        const defaults = EVENT_TYPE_DEFAULT_COLORS[type] || EVENT_TYPE_DEFAULT_COLORS.other;
        const isRange = raw && (raw.isRange === true
            || (type === EVENT_TYPES.EVALUATION_PERIOD && raw.startDate && raw.endDate));
        return {
            id: (raw && raw.id) || generateId(),
            type,
            name: (raw && raw.name) || '',
            notes: (raw && raw.notes) || '',
            isRange,
            date: isRange ? null : ((raw && raw.date) || null),
            startDate: isRange ? ((raw && raw.startDate) || null) : null,
            endDate: isRange ? ((raw && raw.endDate) || null) : null,
            bgColor: (raw && raw.bgColor) || defaults.bg,
            textColor: (raw && raw.textColor) || defaults.text,
            grades: Array.isArray(raw && raw.grades) ? [...raw.grades] : [],
            classNames: Array.isArray(raw && raw.classNames) ? [...raw.classNames] : [],
            sectionLevels: Array.isArray(raw && raw.sectionLevels) ? [...raw.sectionLevels] : [],
            allElementary: raw && raw.allElementary === true,
            allMiddleSchool: raw && raw.allMiddleSchool === true,
            linkedClassId: (raw && raw.linkedClassId) || '',
            syllabusUnitId: (raw && raw.syllabusUnitId) || '',
            nameKo: raw && raw.nameKo ? String(raw.nameKo).trim() : '',
            nameEn: raw && raw.nameEn ? String(raw.nameEn).trim() : ''
        };
    }

    function getCurrentLanguage() {
        return global.__companionLang === 'ko' ? 'ko' : 'en';
    }

    function getEventDisplayName(ev) {
        if (!ev) return '';
        const ko = ev.nameKo ? String(ev.nameKo).trim() : '';
        const en = ev.nameEn ? String(ev.nameEn).trim() : '';
        if (ko && en) {
            return getCurrentLanguage() === 'ko' ? ko : en;
        }
        return ev.name || en || ko || 'Event';
    }

    function normalizeKrHolidayLabelForLookup(name) {
        return String(name || '')
            .trim()
            .replace(/\u00B7/g, 'ㆍ')
            .replace(/·/g, 'ㆍ');
    }

    function translateKrPublicHolidayName(koName) {
        const raw = String(koName || '').trim();
        if (!raw) return '';
        const parts = raw.split(/\s*·\s*/).map((part) => part.trim()).filter(Boolean);
        const translated = parts.map((part) => {
            const key = normalizeKrHolidayLabelForLookup(part);
            if (KR_PUBLIC_HOLIDAY_NAME_EN[key]) {
                return KR_PUBLIC_HOLIDAY_NAME_EN[key];
            }
            const substituteMatch = part.match(/^대체공휴일\s*\((.+)\)$/);
            if (substituteMatch) {
                const inner = translateKrPublicHolidayName(substituteMatch[1]);
                return `Substitute holiday (${inner})`;
            }
            const temporaryMatch = part.match(/^임시공휴일\s*\((.+)\)$/);
            if (temporaryMatch) {
                const inner = translateKrPublicHolidayName(temporaryMatch[1]);
                return `Temporary public holiday (${inner})`;
            }
            return part;
        });
        return translated.join(' · ');
    }

    function eventHasAnyTargetFilter(event) {
        if (!event) return false;
        const hasGrades = event.grades && event.grades.length > 0;
        const hasClassNames = event.classNames && event.classNames.length > 0;
        const hasSections = event.sectionLevels && event.sectionLevels.length > 0;
        return hasGrades || hasClassNames || hasSections
            || event.allElementary === true
            || event.allMiddleSchool === true;
    }

    function isElementaryGrade(grade) {
        return ELEMENTARY_GRADES.includes((grade || '').trim());
    }

    function isMiddleSchoolGrade(grade) {
        return MIDDLE_SCHOOL_GRADES.includes((grade || '').trim());
    }

    function getProjectSectionPreset(project) {
        if (!project) return null;
        if (global.CCPClassMetadata) {
            const preset = global.CCPClassMetadata.resolveLevelPresetForForm(project);
            if (preset) return preset;
        }
        const sec = (project.sectionLevel || '').trim();
        if (sec) return sec;
        const legacyPreset = (project.levelPreset || '').trim();
        if (SECTION_OPTIONS.includes(legacyPreset)) return legacyPreset;
        return null;
    }

    /** Map syllabus project → class-shaped record for targeting filters. */
    function projectAsClassTarget(project) {
        return {
            name: (project && project.name) || '',
            grade: (project && project.grade) || '',
            levelPreset: (project && project.levelPreset) || '',
            levelCustom: (project && project.levelCustom) || '',
            level: global.CCPClassMetadata
                ? global.CCPClassMetadata.getLevelDisplayName(project)
                : ((project && project.levelCustom) || (project && project.levelPreset) || ''),
            sectionLevel: getProjectSectionPreset(project) || '',
            classTypeId: (project && project.classTypeId) || '',
            period: project && project.period != null ? project.period : null,
            scheduleBlock: (project && project.scheduleBlock) || 'primary',
            book: (project && project.book) || ''
        };
    }

    function targetFilterAppliesToProject(target, project) {
        if (!target || !project) return false;
        if (!eventHasAnyTargetFilter(target)) return true;

        const classData = projectAsClassTarget(project);
        const hasClassNames = target.classNames && target.classNames.length > 0;
        const hasGrades = target.grades && target.grades.length > 0;
        const hasSections = target.sectionLevels && target.sectionLevels.length > 0;

        if (hasClassNames && target.classNames.includes(classData.name)) return true;
        if (hasGrades && target.grades.includes(classData.grade)) return true;
        if (target.allElementary === true && isElementaryGrade(classData.grade)) return true;
        if (target.allMiddleSchool === true && isMiddleSchoolGrade(classData.grade)) return true;
        if (hasSections) {
            const sec = getProjectSectionPreset(project);
            if (sec && target.sectionLevels.includes(sec)) return true;
        }
        return false;
    }

    function getEventDates(event) {
        const ev = normalizeEvent(event);
        const dates = [];
        if (ev.isRange && ev.startDate && ev.endDate) {
            const current = parseISODateLocal(ev.startDate);
            const end = parseISODateLocal(ev.endDate);
            if (!Number.isNaN(current.getTime()) && !Number.isNaN(end.getTime())) {
                while (current <= end) {
                    dates.push(formatDateISO(current));
                    current.setDate(current.getDate() + 1);
                }
            }
        } else if (ev.date) {
            dates.push(ev.date);
        }
        return dates;
    }

    function eventAppliesToProject(event, project) {
        return targetFilterAppliesToProject(event, project);
    }

    function getSharedEvents(data) {
        const list = data && Array.isArray(data.events) ? data.events : [];
        return list.map(normalizeEvent);
    }

    function getProjectEvents(project) {
        const list = project && Array.isArray(project.events) ? project.events : [];
        return list.map(normalizeEvent);
    }

    function getEventsForProjectOnDate(dateStr, project, data) {
        const hits = [];
        getSharedEvents(data).forEach((ev) => {
            if (getEventDates(ev).includes(dateStr) && eventAppliesToProject(ev, project)) {
                hits.push(ev);
            }
        });
        getProjectEvents(project).forEach((ev) => {
            if (getEventDates(ev).includes(dateStr)) {
                hits.push(ev);
            }
        });
        return hits;
    }

    function hasBlockingEventOnDate(dateStr, project, data) {
        return getEventsForProjectOnDate(dateStr, project, data)
            .some((ev) => eventTypeBlocksClass(ev.type));
    }

    function getBlockingEventForProject(dateStr, project, data) {
        const onDay = getEventsForProjectOnDate(dateStr, project, data);
        const blocking = onDay.find((ev) => eventTypeBlocksClass(ev.type));
        if (!blocking) return null;
        return { ...blocking, name: getEventDisplayName(blocking) };
    }

    function getInlineScheduleEventForProjectOnDate(dateStr, project, data) {
        const order = [EVENT_TYPES.EVALUATION_PERIOD, EVENT_TYPES.EVALUATION_DEADLINE];
        const onDay = getEventsForProjectOnDate(dateStr, project, data);
        for (let i = 0; i < order.length; i += 1) {
            const type = order[i];
            const hit = onDay.find((ev) => normalizeEventType(ev.type) === type
                && !eventTypeBlocksClass(ev.type));
            if (hit) {
                return { ...hit, name: getEventDisplayName(hit) };
            }
        }
        return null;
    }

    function getSyllabusEventColors(event, type) {
        const normalized = normalizeEventType(type || (event && event.type) || EVENT_TYPES.OTHER);
        const defaults = EVENT_TYPE_DEFAULT_COLORS[normalized] || EVENT_TYPE_DEFAULT_COLORS.other;
        return {
            bg: (event && event.bgColor) || defaults.bg,
            text: (event && event.textColor) || defaults.text,
            type: normalized
        };
    }

    function getAllEventsFlat(data, projectFilter) {
        const out = [];
        getSharedEvents(data).forEach((ev) => {
            out.push({ event: ev, scope: 'shared', projectId: null });
        });
        const projects = (data && data.projects) || [];
        projects.forEach((proj) => {
            if (projectFilter && projectFilter !== 'all' && proj.id !== projectFilter) {
                return;
            }
            getProjectEvents(proj).forEach((ev) => {
                out.push({ event: ev, scope: 'syllabus', projectId: proj.id, projectName: proj.name });
            });
        });
        return out;
    }

    function addOneDayISO(dateStr) {
        const date = parseISODateLocal(dateStr);
        if (Number.isNaN(date.getTime())) return '';
        date.setDate(date.getDate() + 1);
        return formatDateISO(date);
    }

    function dedupeKrHolidayRows(rows) {
        const seen = new Set();
        return (rows || []).filter((row) => {
            const key = `${row.date}\0${row.localName}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function parseKrPublicHolidayYearJson(json, year) {
        if (!json || typeof json !== 'object' || Array.isArray(json)) {
            throw new Error('Invalid holiday data');
        }
        const rows = [];
        const yearPrefix = `${year}-`;
        Object.entries(json).forEach(([date, names]) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !date.startsWith(yearPrefix)) {
                return;
            }
            const list = Array.isArray(names) ? names : [names];
            const localName = list.map((name) => String(name).trim()).filter(Boolean).join(' · ');
            if (!localName) return;
            rows.push({
                date,
                localName,
                name: translateKrPublicHolidayName(localName),
                types: ['Public']
            });
        });
        return dedupeKrHolidayRows(rows);
    }

    async function fetchJsonFromFirstUrl(urls, fetchImpl) {
        const fetcher = fetchImpl || global.fetch;
        if (typeof fetcher !== 'function') {
            throw new Error('Fetch unavailable');
        }
        let lastError = null;
        for (let i = 0; i < urls.length; i += 1) {
            const url = urls[i];
            try {
                const response = await fetcher(url);
                if (!response || !response.ok) {
                    throw new Error(`HTTP ${response ? response.status : 'ERR'}`);
                }
                return await response.json();
            } catch (err) {
                lastError = err;
            }
        }
        throw lastError || new Error('Could not load holiday data');
    }

    async function fetchKrPublicHolidayRowsForYear(year, options) {
        const urls = [
            `${KR_PUBLIC_HOLIDAYS_JSON_BASE}/${year}.json`,
            `${KR_PUBLIC_HOLIDAYS_JSON_CDN}/${year}.json`
        ];
        const json = await fetchJsonFromFirstUrl(urls, options && options.fetch);
        const rows = parseKrPublicHolidayYearJson(json, year);
        if (rows.length === 0) {
            const err = new Error('YEAR_UNAVAILABLE');
            err.year = year;
            throw err;
        }
        return rows;
    }

    function groupKrPublicHolidayRows(rows) {
        const sorted = [...(rows || [])].sort((a, b) => a.date.localeCompare(b.date));
        const groups = [];
        sorted.forEach((row) => {
            const nameKo = row.localName;
            const nameEn = row.name || translateKrPublicHolidayName(nameKo);
            const last = groups[groups.length - 1];
            if (last
                && last.nameKo === nameKo
                && last.nameEn === nameEn
                && addOneDayISO(last.endDate) === row.date) {
                last.endDate = row.date;
                return;
            }
            groups.push({
                nameKo,
                nameEn,
                startDate: row.date,
                endDate: row.date
            });
        });
        return groups.map((group) => {
            const isRange = group.startDate !== group.endDate;
            return normalizeEvent({
                type: EVENT_TYPES.HOLIDAY,
                name: getCurrentLanguage() === 'ko' ? group.nameKo : group.nameEn,
                nameKo: group.nameKo,
                nameEn: group.nameEn,
                isRange,
                date: isRange ? null : group.startDate,
                startDate: isRange ? group.startDate : null,
                endDate: isRange ? group.endDate : null
            });
        });
    }

    function eventOverlapsDateRange(event, rangeStart, rangeEnd) {
        const dates = getEventDates(event);
        if (!rangeStart && !rangeEnd) return dates.length > 0;
        return dates.some((date) => {
            if (rangeStart && date < rangeStart) return false;
            if (rangeEnd && date > rangeEnd) return false;
            return true;
        });
    }

    function isDuplicateKrHolidayImport(candidate, existingEvents) {
        const candDates = getEventDates(candidate);
        const existing = (existingEvents || []).map(normalizeEvent).filter(
            (ev) => normalizeEventType(ev.type) === EVENT_TYPES.HOLIDAY
        );
        return existing.some((ev) => {
            const evDates = getEventDates(ev);
            const sharesDate = candDates.some((date) => evDates.includes(date));
            if (!sharesDate) return false;
            const evKo = ev.nameKo || ev.name;
            const evEn = ev.nameEn || translateKrPublicHolidayName(evKo);
            const candKo = candidate.nameKo || candidate.name;
            const candEn = candidate.nameEn || translateKrPublicHolidayName(candKo);
            if (evKo === candKo || evEn === candEn || ev.name === candidate.name) {
                return true;
            }
            return candDates.every((date) => evDates.includes(date));
        });
    }

    async function buildKrPublicHolidayImport(rangeStart, rangeEnd, options) {
        if (!rangeStart || !rangeEnd) {
            const err = new Error('RANGE_REQUIRED');
            throw err;
        }
        const startYear = parseInt(String(rangeStart).slice(0, 4), 10);
        const endYear = parseInt(String(rangeEnd).slice(0, 4), 10);
        if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
            throw new Error('Invalid date range');
        }
        const allRows = [];
        for (let year = startYear; year <= endYear; year += 1) {
            const rows = await fetchKrPublicHolidayRowsForYear(year, options);
            allRows.push(...rows);
        }
        const filteredRows = allRows.filter((row) => row.date >= rangeStart && row.date <= rangeEnd);
        return groupKrPublicHolidayRows(filteredRows);
    }

    function migrateHolidayToEvent(h) {
        return normalizeEvent({
            id: generateId(),
            type: EVENT_TYPES.HOLIDAY,
            name: h.title || h.name || 'Holiday',
            date: h.date,
            isRange: false
        });
    }

    function importCalendarEvents(imported) {
        if (!imported || !Array.isArray(imported.events)) {
            return [];
        }
        return imported.events.map(normalizeEvent);
    }

    global.CCPCalendarEvents = {
        EVENT_TYPES,
        EVENT_TYPE_DEFAULT_COLORS,
        ELEMENTARY_GRADES,
        MIDDLE_SCHOOL_GRADES,
        SECTION_OPTIONS,
        KR_PUBLIC_HOLIDAYS_SOURCE_PAGE,
        normalizeEvent,
        normalizeEventType,
        eventTypeBlocksClass,
        eventHasAnyTargetFilter,
        getEventDates,
        getEventDisplayName,
        translateKrPublicHolidayName,
        targetFilterAppliesToProject,
        eventAppliesToProject,
        getEventsForProjectOnDate,
        hasBlockingEventOnDate,
        getBlockingEventForProject,
        getInlineScheduleEventForProjectOnDate,
        getSyllabusEventColors,
        getSharedEvents,
        getProjectEvents,
        getAllEventsFlat,
        projectAsClassTarget,
        migrateHolidayToEvent,
        importCalendarEvents,
        parseKrPublicHolidayYearJson,
        fetchKrPublicHolidayRowsForYear,
        groupKrPublicHolidayRows,
        eventOverlapsDateRange,
        isDuplicateKrHolidayImport,
        buildKrPublicHolidayImport
    };
})(typeof window !== 'undefined' ? window : globalThis);
