/**
 * Syllabus generation + print helpers for Companion.
 * window.CCPCompanionSyllabus
 */
(function (global) {
    const store = () => global.CCPCompanionStore;
    const dates = () => global.CCPScheduleLessonDates;
    const termDates = () => global.CCPTermDates;

    function projectToClassShape(project, appData) {
        const editor = global.CCPBooksEditor;
        let totalLessons = project.totalLessons || 20;
        let scheduleModel = project.scheduleModel || 'sequentialTerm';
        let book = project.book || '';
        const curriculumId = (project.curriculumId || '').trim();

        if (editor && curriculumId) {
            const templates = editor.getTemplatesForBookId(curriculumId, appData);
            if (templates.length) {
                totalLessons = templates.length;
            }
            const bookMeta = editor.getBookById(curriculumId, appData);
            if (bookMeta) {
                if (bookMeta.defaultTotalLessons) {
                    totalLessons = bookMeta.defaultTotalLessons;
                }
                if (bookMeta.scheduleModel) {
                    scheduleModel = bookMeta.scheduleModel;
                }
                book = bookMeta.displayName || bookMeta.name || book;
            }
            if (editor.isDebateCurriculum && editor.isDebateCurriculum(curriculumId)) {
                const level = (project.levelPreset || project.levelCustom || '').trim();
                const debateDefaults = editor.buildDebateMergedDefaults(level, appData, curriculumId);
                if (debateDefaults) {
                    scheduleModel = debateDefaults.scheduleModel || scheduleModel;
                    totalLessons = debateDefaults.defaultTotalLessons || totalLessons;
                    if (!project.book && debateDefaults.defaultBook) {
                        book = debateDefaults.defaultBook;
                    }
                }
            }
        }

        let endDate = project.endDate || '';
        if (project.useAutoTermEnd !== false && project.startDate && termDates()) {
            const months = parseInt(project.termCalendarMonths, 10) || 3;
            const mode = project.termEndMode || 'calendarMonths';
            const computed = mode === 'exactMonths'
                ? termDates().computeTermEndDateExactMonths(project.startDate, months)
                : termDates().computeTermEndDateFromStart(project.startDate, months);
            if (computed) {
                endDate = termDates().formatDateForInput(computed);
            }
        }

        return {
            id: project.id,
            name: project.name || 'Syllabus',
            grade: project.grade || '',
            levelPreset: project.levelPreset || '',
            levelCustom: project.levelCustom || '',
            sectionLevel: project.sectionLevel || '',
            classTypeId: project.classTypeId || '',
            period: project.period != null ? project.period : null,
            scheduleBlock: project.scheduleBlock || 'primary',
            book: project.book || book,
            startDate: project.startDate || '',
            endDate,
            meetingDays: Array.isArray(project.meetingDays) ? [...project.meetingDays] : [],
            totalLessons,
            scheduleModel,
            curriculumId,
            book,
            syllabusGeneralNotes: project.syllabusGeneralNotes || '',
            syllabusRows: Array.isArray(project.syllabusRows) ? project.syllabusRows : [],
            syllabusUnits: [],
            skippedLessons: project.skippedLessons || [],
            compressionMerges: project.compressionMerges || [],
            compressionMode: project.compressionMode || 'autoWhenNeeded',
            compressionMergesByPeriod: project.compressionMergesByPeriod || {},
            debateBookPeriods: Array.isArray(project.debateBookPeriods) ? [...project.debateBookPeriods] : [],
            events: project.events || []
        };
    }

    function eventsApi() {
        return global.CCPCalendarEvents;
    }

    function getStoreData() {
        return store().getData();
    }

    function isHolidayForProject(dateStr, project) {
        const api = eventsApi();
        if (!api) return false;
        return api.hasBlockingEventOnDate(dateStr, project, getStoreData());
    }

    function getHolidayForProject(dateStr, project) {
        const api = eventsApi();
        if (!api) return null;
        return api.getBlockingEventForProject(dateStr, project, getStoreData());
    }

    function syllabusScheduleHooks(project) {
        const classShape = projectToClassShape(project, store().getAppDataShape());
        const api = eventsApi();
        return {
            useFullMonthNames: true,
            isHolidayForClass: (dateStr) => isHolidayForProject(dateStr, project),
            getHolidayForClass: (dateStr) => getHolidayForProject(dateStr, project),
            getInlineEventForClass: (dateStr) => (
                api ? api.getInlineScheduleEventForProjectOnDate(dateStr, project, getStoreData()) : null
            ),
            slotHolidayDetail: 'No regular lesson — holiday / no class',
            slotEventDetail: 'Special session — not a regular lesson',
            overflowIntro: 'Lessons not scheduled this term:',
            overflowNote: '',
            skippedDetail: 'Skipped this term',
            extraPeriodTitle: 'Open class period',
            extraPeriodDetail: 'No lesson scheduled',
            extraPeriodNote: '',
            getEventColors: (event, type) => (
                api ? api.getSyllabusEventColors(event, type) : { bg: '#fde8e8', text: '#7f1d1d', type: 'holiday' }
            )
        };
    }

    function getRowTemplatesForProject(project, appData) {
        const editor = global.CCPBooksEditor;
        const curriculumId = (project.curriculumId || '').trim();
        if (editor && curriculumId && !editor.isNoCurriculum(curriculumId)) {
            const fromBook = editor.getTemplatesForBookId(curriculumId, appData);
            if (fromBook.length) {
                return fromBook;
            }
        }
        return [];
    }

    function getUnscheduledLessonNumbers(classData, schedule) {
        if (dates() && dates().getUnscheduledLessonNumbers) {
            return dates().getUnscheduledLessonNumbers(classData, schedule);
        }
        const totalLessons = dates().sanitizeTotalLessons(classData.totalLessons || 8);
        const placed = new Set();
        (schedule.lessons || []).forEach((lesson) => {
            if (lesson.group && Array.isArray(lesson.group.days)) {
                lesson.group.days.forEach((d) => placed.add(d));
            }
        });
        const unplaced = [];
        for (let n = 1; n <= totalLessons; n += 1) {
            if (!placed.has(n)) {
                unplaced.push(n);
            }
        }
        return unplaced;
    }

    function debateLessonGroupIncludesDay(group, dayNum) {
        if (!group || !Array.isArray(group.days)) {
            return false;
        }
        return group.days.includes(dayNum);
    }

    function annotateDebateTemplateHints(classData, items) {
        const api = dates();
        if (!api || !api.classUsesDebateCompression(classData) || !Array.isArray(items)) {
            return;
        }
        const dated = items.filter((item) => item.date
            && !item.__syllabusHoliday
            && !item.__syllabusExtraPeriod
            && !item.__syllabusOverflowIntro
            && !item.__syllabusUnscheduled);
        dated.forEach((item) => {
            if (item.compressed && item.group
                && item.group.start === 2 && item.group.end === 3) {
                item.__debateTemplateKey = 'day2and3combined';
            }
        });
        const periodOrder = [];
        dated.forEach((item) => {
            const key = item.periodId || item.periodStartDate || item.monthKey;
            if (key && !periodOrder.includes(key)) {
                periodOrder.push(key);
            }
        });
        periodOrder.forEach((periodKey, periodIndex) => {
            const inPeriod = dated.filter((item) => {
                const key = item.periodId || item.periodStartDate || item.monthKey;
                return key === periodKey;
            });
            if (!inPeriod.length) {
                return;
            }
            const last = inPeriod[inPeriod.length - 1];
            const nextPeriodKey = periodOrder[periodIndex + 1];
            const hasNextPeriod = !!(nextPeriodKey && dated.some((item) => {
                const key = item.periodId || item.periodStartDate || item.monthKey;
                return key === nextPeriodKey;
            }));
            const isLastPeriodInTerm = periodIndex === periodOrder.length - 1;
            if ((hasNextPeriod || isLastPeriodInTerm)
                && debateLessonGroupIncludesDay(last.group, 4)
                && last.__debateTemplateKey !== 'day2and3combined') {
                last.__debateTemplateKey = 'day4and1bridge';
            }
        });
        if (dated.length) {
            const termLast = dated[dated.length - 1];
            if (debateLessonGroupIncludesDay(termLast.group, 4)
                && termLast.__debateTemplateKey !== 'day2and3combined') {
                termLast.__debateTemplateKey = 'day4and1bridge';
            }
        }
    }

    function buildSyllabusTimeline(project) {
        const classData = projectToClassShape(project, store().getAppDataShape());
        const schedule = dates().calculateLessonDates(classData, {
            isHoliday: (ds) => isHolidayForProject(ds, project)
        });
        const lessons = schedule.lessons || [];
        const unscheduledLessonNumbers = getUnscheduledLessonNumbers(classData, schedule);
        const meetingDays = dates().getMeetingDaysFromClass(classData);
        const classStart = dates().parseISODateLocal(classData.startDate);
        const classEnd = dates().parseISODateLocal(classData.endDate);
        const mod = global.CCPSyllabus;

        if (meetingDays.length === 0
            || Number.isNaN(classStart.getTime())
            || Number.isNaN(classEnd.getTime())) {
            const slots = lessons.map((lesson) => {
                const dateStr = lesson.date instanceof Date
                    ? dates().formatDateISO(lesson.date)
                    : lesson.date;
                return {
                    date: dateStr,
                    monthKey: lesson.monthKey || (dateStr ? dateStr.slice(0, 7) : ''),
                    kind: 'lesson',
                    label: lesson.label,
                    lesson
                };
            });
            return { slots, unscheduledLessonNumbers };
        }

        const meetingDates = dates().collectAllMeetingDatesInRange(classStart, classEnd, meetingDays);
        const slots = mod && mod.buildTimelineSlotsFromLessons
            ? mod.buildTimelineSlotsFromLessons(lessons, meetingDates, {
                isHoliday: (dateStr) => isHolidayForProject(dateStr, project),
                formatDateISO: dates().formatDateISO
            })
            : meetingDates.map((d) => {
                const dateStr = dates().formatDateISO(d);
                const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return {
                    date: dateStr,
                    monthKey,
                    kind: isHolidayForProject(dateStr, project) ? 'holiday' : 'extra'
                };
            });

        return { slots, unscheduledLessonNumbers };
    }

    function lessonsForSyllabusBuild(project) {
        const classData = projectToClassShape(project, store().getAppDataShape());
        const { slots, unscheduledLessonNumbers } = buildSyllabusTimeline(project);
        const items = [];

        slots.forEach((slot) => {
            if (slot.kind === 'holiday') {
                items.push({
                    date: slot.date,
                    monthKey: slot.monthKey,
                    label: '',
                    __syllabusHoliday: true
                });
                return;
            }
            if (slot.kind === 'extra') {
                items.push({
                    date: slot.date,
                    monthKey: slot.monthKey,
                    label: '',
                    __syllabusExtraPeriod: true
                });
                return;
            }
            const lesson = slot.lesson || {};
            const dateStr = slot.date || (lesson.date instanceof Date
                ? dates().formatDateISO(lesson.date)
                : lesson.date);
            items.push({
                ...lesson,
                date: dateStr,
                monthKey: slot.monthKey || lesson.monthKey || (dateStr ? dateStr.slice(0, 7) : ''),
                label: slot.label || lesson.label
            });
        });

        if (unscheduledLessonNumbers.length > 0) {
            items.push({ __syllabusOverflowIntro: true });
            unscheduledLessonNumbers.forEach((lessonNum) => {
                items.push({
                    __syllabusUnscheduled: true,
                    lessonNum,
                    label: `Day ${lessonNum}`
                });
            });
        }

        const totalLessons = dates().sanitizeTotalLessons(classData.totalLessons || 8);
        const skipped = dates().getSkippedLessonsFromClass
            ? dates().getSkippedLessonsFromClass(classData, totalLessons)
            : (classData.skippedLessons || []);
        const placedNums = new Set();
        items.forEach((item) => {
            if (item.group && item.group.days) {
                item.group.days.forEach((d) => placedNums.add(d));
            }
        });
        skipped.forEach((lessonNum) => {
            if (!placedNums.has(lessonNum)) {
                items.push({
                    __syllabusSkipped: true,
                    lessonNum,
                    label: `Day ${lessonNum}`
                });
            }
        });

        annotateDebateTemplateHints(classData, items);
        return items;
    }

    function getScheduleWarnings(project) {
        const api = dates();
        const t = typeof global.__companionT === 'function' ? global.__companionT : (k) => k;
        const warnings = [];
        if (!api || !project) return warnings;

        const classData = projectToClassShape(project, store().getAppDataShape());
        const isDebate = api.classUsesDebateCompression(classData);

        if (isDebate) {
            const periods = classData.debateBookPeriods || [];
            if (!periods.length) {
                warnings.push({ id: 'debate_periods', message: t('warnDebateBookPeriods') });
            }
        }

        const gap = api.getClassScheduleGapStatus(classData, {
            isHoliday: (ds) => isHolidayForProject(ds, project)
        });
        if (isDebate && gap.incomplete && (gap.incompletePeriods || []).length) {
            const months = gap.incompletePeriods.map((p) => {
                const mk = p.monthKey || (p.startDate || '').slice(0, 7);
                const book = p.book ? ` (${p.book})` : '';
                return mk + book;
            }).join(', ');
            warnings.push({
                id: 'debate_period_gap',
                message: t('warnDebatePeriodGap').replace('{months}', months || '—')
            });
        } else if (!isDebate && gap.incomplete && gap.unplacedLessonNumbers.length) {
            const labels = gap.unplacedLessonNumbers.map((n) => `Day ${n}`).join(', ');
            warnings.push({
                id: 'schedule_gap',
                message: t('warnScheduleGap').replace('{labels}', labels)
            });
        } else if (isDebate && gap.allCompressedOnly) {
            const months = (gap.compressedPeriods || []).map((p) => p.monthKey || (p.startDate || '').slice(0, 7)).join(', ');
            warnings.push({
                id: 'debate_compressed',
                level: 'info',
                message: t('warnDebateCompressedCycles').replace('{months}', months || '—')
            });
        }

        const { slots } = buildSyllabusTimeline(project);
        const emptyPeriods = (slots || []).filter((s) => s.kind === 'extra').length;
        if (emptyPeriods > 0) {
            warnings.push({
                id: 'empty_periods',
                message: t('warnEmptyClassPeriods').replace('{n}', String(emptyPeriods))
            });
        }

        const rows = project.syllabusRows || [];
        const emptyContent = rows.filter((r) => (
            (r.kind === 'lesson' || !r.kind)
            && r.date
            && !(r.planDetail || '').trim()
            && !(r.planTitle || '').trim()
        )).length;
        if (emptyContent > 0) {
            warnings.push({
                id: 'empty_syllabus',
                message: t('warnEmptySyllabusContent').replace('{n}', String(emptyContent))
            });
        }

        return warnings;
    }

    function maybeAutoFillDebateBookPeriods(project) {
        const api = dates();
        const appData = store().getAppDataShape();
        const endDate = syncProjectEndDate(project);
        const synced = { ...project, endDate };
        const classShape = projectToClassShape(synced, appData);
        if (!api || !api.classUsesDebateCompression(classShape)) {
            return { project, filled: false };
        }
        const start = project.startDate;
        if (!start || !endDate) {
            return { project, filled: false };
        }
        const inRange = (Array.isArray(project.debateBookPeriods) ? project.debateBookPeriods : [])
            .filter((p) => p && p.startDate >= start && p.startDate <= endDate);
        if (inRange.length > 0) {
            return { project, filled: false };
        }
        const suggested = api.suggestDebatePeriodsFromTerm(synced);
        if (!suggested.length) {
            return { project, filled: false };
        }
        return {
            project: { ...project, endDate, debateBookPeriods: suggested },
            filled: true
        };
    }

    function prepareDebateProjectForGeneration(project) {
        const api = dates();
        const classShape = projectToClassShape(project, store().getAppDataShape());
        if (!api || !api.classUsesDebateCompression(classShape)) {
            return project;
        }
        const { project: filled } = maybeAutoFillDebateBookPeriods(project);
        const next = { ...filled };
        if (!next.compressionMode) {
            next.compressionMode = 'autoWhenNeeded';
        }
        if (next.scheduleModel !== 'debateMonthly') {
            next.scheduleModel = 'debateMonthly';
        }
        if (!next.totalLessons || next.totalLessons > 8) {
            next.totalLessons = 4;
        }
        return next;
    }

    function buildGeneratedRows(project) {
        const mod = global.CCPSyllabus;
        if (!mod) {
            return [];
        }
        const appData = store().getAppDataShape();
        const classData = projectToClassShape(project, appData);
        const rowTemplates = getRowTemplatesForProject(project, appData);
        const hooks = {
            ...syllabusScheduleHooks(project),
            rowTemplates
        };
        if (rowTemplates.length && global.CCPSyllabusTemplates) {
            hooks.templateIndexes = global.CCPSyllabusTemplates.buildTemplateIndexes(rowTemplates);
        }
        return mod.buildSyllabusRowsFromSchedule(
            classData,
            lessonsForSyllabusBuild(project),
            hooks
        );
    }

    function generateScheduleRows(project) {
        const existing = Array.isArray(project.syllabusRows) ? project.syllabusRows : [];
        const generated = buildGeneratedRows(project);
        const mod = global.CCPSyllabus;
        if (!mod) {
            return generated;
        }
        return mod.mergeSyllabusRows(existing, generated);
    }

    function applyCurriculumPages(project) {
        const api = global.CCPSyllabusTemplates;
        const mod = global.CCPSyllabus;
        if (!api || !mod) {
            return { ok: false, applied: 0, rows: project.syllabusRows || [] };
        }
        const appData = store().getAppDataShape();
        const templates = getRowTemplatesForProject(project, appData);
        if (!templates.length) {
            return { ok: false, applied: 0, rows: project.syllabusRows || [] };
        }
        let rows = project.syllabusRows || [];
        if (!rows.length) {
            rows = buildGeneratedRows(project);
        }
        const result = api.applyRowTemplatesToSyllabusRows(rows, templates, { force: true });
        const editor = global.CCPBooksEditor;
        let generalNotes = project.syllabusGeneralNotes || '';
        if (editor && project.curriculumId) {
            const notes = editor.getCurriculumSyllabusGeneralNotes(
                project.curriculumId,
                '',
                appData
            );
            if (notes) {
                generalNotes = notes;
            }
        }
        return {
            ok: result.applied > 0,
            applied: result.applied,
            rows: result.rows,
            syllabusGeneralNotes: generalNotes
        };
    }

    function formatMeetingDaysSummary(classData) {
        const days = dates().getMeetingDaysFromClass(classData);
        if (!days.length) return '—';
        const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days.map((d) => names[d] || d).join(', ');
    }

    function buildPrintDocument(project, rows) {
        const printApi = global.CCPCompanionSyllabusPrint;
        if (!printApi) {
            return '';
        }
        const data = store().getData();
        const lang = global.__companionLang || localStorage.getItem('ccp-companion-lang') || 'en';
        const t = typeof global.__companionT === 'function' ? global.__companionT : (k) => k;
        return printApi.buildPrintDocument(project, rows, {
            t,
            lang,
            appData: data,
            printOptions: printApi.loadPrintOptions(),
            calendarDisplayStart: data.calendarDisplayStart || '',
            projectToClassShape: (p, appData) => projectToClassShape(p, appData)
        });
    }

    function buildTransientScheduleVariantProject(baseProject, comboDays) {
        const api = dates();
        const endDate = syncProjectEndDate(baseProject);
        const syncedBase = { ...baseProject, endDate };
        const comboLabel = api.formatMeetingDaysShort(comboDays);
        const baseName = getBaseProjectDisplayName(syncedBase);
        return {
            ...copyScheduleFieldsFromBase(syncedBase, endDate),
            id: `${baseProject.id || 'proj'}__print_${comboLabel}`,
            meetingDays: [...comboDays],
            meetingsPerWeek: comboDays.length,
            name: `${baseName} (${comboLabel})`,
            syllabusRows: []
        };
    }

    function buildPrintableVariantsForProject(project) {
        const api = dates();
        if (!api || !project) return [];
        if (project.parentProjectId) {
            return [project];
        }
        const combinations = api.getScheduleVariantsForProject(project);
        if (combinations.length <= 1) {
            return [project];
        }
        return combinations.map((comboDays) => {
            const variantProject = buildTransientScheduleVariantProject(project, comboDays);
            let rows = generateScheduleRows(variantProject);
            variantProject.syllabusRows = rows;
            const applied = applyCurriculumPages(variantProject);
            if (applied && Array.isArray(applied.rows) && applied.rows.length) {
                rows = applied.rows;
                if (applied.syllabusGeneralNotes) {
                    variantProject.syllabusGeneralNotes = applied.syllabusGeneralNotes;
                }
            }
            variantProject.syllabusRows = rows;
            return variantProject;
        });
    }

    function expandProjectsForPrint(projects) {
        return (projects || []).flatMap((project) => buildPrintableVariantsForProject(project));
    }

    function buildPrintDocumentForProjects(projects) {
        const printApi = global.CCPCompanionSyllabusPrint;
        if (!printApi) {
            return '';
        }
        const expandedProjects = expandProjectsForPrint(projects)
            .filter((p) => Array.isArray(p.syllabusRows) && p.syllabusRows.length);
        if (!expandedProjects.length) {
            return '';
        }
        const data = store().getData();
        const lang = global.__companionLang || localStorage.getItem('ccp-companion-lang') || 'en';
        const t = typeof global.__companionT === 'function' ? global.__companionT : (k) => k;
        return printApi.buildPrintDocumentForProjects(expandedProjects, {
            t,
            lang,
            appData: data,
            printOptions: printApi.loadPrintOptions(),
            calendarDisplayStart: data.calendarDisplayStart || '',
            projectToClassShape: (p, appData) => projectToClassShape(p, appData)
        });
    }

    function printProjects(projects) {
        const printable = (projects || []).filter((p) => Array.isArray(p.syllabusRows) && p.syllabusRows.length);
        if (!printable.length) {
            return { ok: false, reason: 'noRows' };
        }
        const expandedProjects = expandProjectsForPrint(printable)
            .filter((p) => Array.isArray(p.syllabusRows) && p.syllabusRows.length);
        if (!expandedProjects.length) {
            return { ok: false, reason: 'noRows' };
        }
        const docHtml = buildPrintDocumentForProjects(printable);
        if (!docHtml) {
            return { ok: false, reason: 'noRows' };
        }
        const printApi = global.CCPCompanionSyllabusPrint;
        const data = store().getData();
        const t = typeof global.__companionT === 'function' ? global.__companionT : (k) => k;
        const title = printApi.buildPrintWindowTitle(
            expandedProjects,
            t,
            data.calendarDisplayStart || '',
            data,
            (p, appData) => projectToClassShape(p, appData)
        );
        if (printApi && printApi.printDocument) {
            const result = printApi.printDocument(docHtml, title, global.CCPSyllabus);
            if (result.ok) return { ok: true, count: expandedProjects.length };
            if (result.reason === 'blocked') {
                return { ok: false, reason: 'blocked' };
            }
            return { ok: false, reason: 'unknown' };
        }
        return { ok: false, reason: 'unknown' };
    }

    function printProject(project, rows) {
        const docHtml = buildPrintDocument(project, rows);
        if (!docHtml) {
            return false;
        }
        const printApi = global.CCPCompanionSyllabusPrint;
        const classData = projectToClassShape(project, store().getAppDataShape());
        const title = (printApi && printApi.formatSyllabusPdfClassTitle)
            ? printApi.formatSyllabusPdfClassTitle(
                classData,
                typeof global.__companionT === 'function' ? global.__companionT : (k) => k,
                store().getData().calendarDisplayStart || '',
                store().getData()
            )
            : (project.name || 'Syllabus');
        if (printApi && printApi.printDocument) {
            const result = printApi.printDocument(docHtml, title, global.CCPSyllabus);
            if (result.ok) return true;
            if (result.reason === 'blocked') {
                alert('Pop-up blocked. Allow pop-ups to print.');
            }
            return false;
        }
        return false;
    }

    function syncProjectEndDate(project) {
        if (project.useAutoTermEnd === false) {
            return project.endDate || '';
        }
        if (!project.startDate || !termDates()) {
            return project.endDate || '';
        }
        const months = parseInt(project.termCalendarMonths, 10) || 3;
        const mode = project.termEndMode || 'calendarMonths';
        const computed = mode === 'exactMonths'
            ? termDates().computeTermEndDateExactMonths(project.startDate, months)
            : termDates().computeTermEndDateFromStart(project.startDate, months);
        return computed ? termDates().formatDateForInput(computed) : (project.endDate || '');
    }

    function getBaseProjectDisplayName(project) {
        const raw = String(project?.name || 'Syllabus').trim() || 'Syllabus';
        return raw.replace(/\s*\([^)]+\)\s*$/, '').trim() || 'Syllabus';
    }

    function copyScheduleFieldsFromBase(baseProject, endDate) {
        return {
            name: baseProject.name,
            grade: baseProject.grade || '',
            levelPreset: baseProject.levelPreset || '',
            levelCustom: baseProject.levelCustom || '',
            sectionLevel: baseProject.sectionLevel || '',
            classTypeId: baseProject.classTypeId || '',
            period: baseProject.period != null ? baseProject.period : null,
            scheduleBlock: baseProject.scheduleBlock || 'primary',
            book: baseProject.book || '',
            curriculumId: baseProject.curriculumId || '',
            startDate: baseProject.startDate || '',
            endDate: endDate || baseProject.endDate || '',
            useAutoTermEnd: baseProject.useAutoTermEnd !== false,
            termEndMode: baseProject.termEndMode || 'calendarMonths',
            termCalendarMonths: baseProject.termCalendarMonths || 3,
            totalLessons: baseProject.totalLessons || 20,
            scheduleModel: baseProject.scheduleModel || 'sequentialTerm',
            syllabusGeneralNotes: baseProject.syllabusGeneralNotes || '',
            events: Array.isArray(baseProject.events) ? [...baseProject.events] : [],
            debateBookPeriods: Array.isArray(baseProject.debateBookPeriods)
                ? [...baseProject.debateBookPeriods]
                : [],
            skippedLessons: Array.isArray(baseProject.skippedLessons)
                ? [...baseProject.skippedLessons]
                : [],
            compressionMerges: Array.isArray(baseProject.compressionMerges)
                ? [...baseProject.compressionMerges]
                : [],
            compressionMode: baseProject.compressionMode || 'autoWhenNeeded',
            compressionMergesByPeriod: baseProject.compressionMergesByPeriod
                ? { ...baseProject.compressionMergesByPeriod }
                : {},
            classScheduleTemplate: baseProject.classScheduleTemplate || 'mwf',
            meetingsPerWeek: baseProject.meetingsPerWeek || 2
        };
    }

    function findScheduleVariantProject(allProjects, parentId, comboDays) {
        const api = dates();
        if (!api) return null;
        return (allProjects || []).find((p) => (
            p.parentProjectId === parentId
            && api.meetingDaysEqual(p.meetingDays, comboDays)
        )) || null;
    }

    function buildScheduleVariantProject(baseProject, comboDays, existingVariant) {
        const api = dates();
        const storeApi = store();
        const endDate = syncProjectEndDate(baseProject);
        const syncedBase = { ...baseProject, endDate };
        const comboLabel = api.formatMeetingDaysShort(comboDays);
        const baseName = getBaseProjectDisplayName(syncedBase);
        const shared = copyScheduleFieldsFromBase(syncedBase, endDate);
        const sourceMeetingDays = api.syncTemplateMeetingDays(syncedBase);

        if (existingVariant) {
            return {
                ...existingVariant,
                ...shared,
                id: existingVariant.id,
                meetingDays: [...comboDays],
                meetingsPerWeek: comboDays.length,
                parentProjectId: syncedBase.id,
                sourceMeetingDays,
                name: `${baseName} (${comboLabel})`
            };
        }

        return {
            ...shared,
            id: storeApi.generateId('proj'),
            meetingDays: [...comboDays],
            meetingsPerWeek: comboDays.length,
            parentProjectId: syncedBase.id,
            sourceMeetingDays,
            name: `${baseName} (${comboLabel})`,
            syllabusRows: []
        };
    }

    function generateScheduleVariants(baseProject, options) {
        options = options || {};
        const api = dates();
        if (!api) {
            return { ok: false, reason: 'missingDatesApi', variants: [] };
        }

        let workingProject = prepareDebateProjectForGeneration(baseProject);
        const config = api.resolveProjectScheduleConfig(workingProject);
        const combinations = api.getScheduleVariantMeetingDays(
            config.templateId,
            config.meetingsPerWeek,
            workingProject.meetingDays
        );
        if (!combinations.length) {
            return { ok: false, reason: 'invalidScheduleConfig', variants: [] };
        }

        const storeApi = store();
        const allProjects = storeApi.getProjects();
        const endDate = syncProjectEndDate(workingProject);
        const syncedBase = {
            ...workingProject,
            endDate,
            classScheduleTemplate: config.templateId,
            meetingsPerWeek: config.meetingsPerWeek,
            meetingDays: api.syncTemplateMeetingDays({
                ...workingProject,
                classScheduleTemplate: config.templateId,
                meetingsPerWeek: config.meetingsPerWeek
            })
        };
        const sourceMeetingDays = api.syncTemplateMeetingDays(syncedBase);
        const isMultiVariant = combinations.length > 1;
        const variants = [];

        combinations.forEach((comboDays) => {
            const existing = isMultiVariant
                ? findScheduleVariantProject(allProjects, syncedBase.id, comboDays)
                : syncedBase;
            const variantProject = isMultiVariant
                ? buildScheduleVariantProject(syncedBase, comboDays, existing)
                : {
                    ...syncedBase,
                    meetingDays: [...comboDays],
                    meetingsPerWeek: comboDays.length
                };

            let rows = generateScheduleRows(variantProject);
            let appliedCount = 0;
            if (options.applyCurriculum) {
                variantProject.syllabusRows = rows;
                const applied = applyCurriculumPages(variantProject);
                rows = applied.rows;
                appliedCount = applied.applied || 0;
                if (applied.syllabusGeneralNotes) {
                    variantProject.syllabusGeneralNotes = applied.syllabusGeneralNotes;
                }
            }
            variantProject.syllabusRows = rows;
            variants.push({
                project: variantProject,
                rows,
                label: api.formatMeetingDaysShort(comboDays),
                appliedCount
            });
        });

        const updatedBase = {
            ...syncedBase,
            sourceMeetingDays,
            updatedAt: new Date().toISOString()
        };
        if (isMultiVariant) {
            updatedBase.syllabusRows = [];
        } else if (variants[0]) {
            updatedBase.syllabusRows = variants[0].project.syllabusRows;
            updatedBase.meetingDays = [...variants[0].project.meetingDays];
            updatedBase.meetingsPerWeek = variants[0].project.meetingsPerWeek;
            variants[0].project = updatedBase;
        }

        return {
            ok: true,
            variants,
            base: updatedBase,
            isMultiVariant
        };
    }

    function generateTwoPerWeekScheduleVariants(baseProject, options) {
        return generateScheduleVariants(baseProject, options);
    }

    function persistScheduleVariants(result) {
        if (!result?.ok) return result;
        const storeApi = store();
        storeApi.upsertProject(result.base);
        result.variants.forEach(({ project }) => {
            storeApi.upsertProject(project);
        });
        return result;
    }

    function persistTwoPerWeekScheduleVariants(result) {
        return persistScheduleVariants(result);
    }

    global.CCPCompanionSyllabus = {
        projectToClassShape,
        generateScheduleRows,
        generateScheduleVariants,
        generateTwoPerWeekScheduleVariants,
        persistScheduleVariants,
        persistTwoPerWeekScheduleVariants,
        applyCurriculumPages,
        buildPrintDocument,
        buildPrintDocumentForProjects,
        expandProjectsForPrint,
        printProjects,
        printProject,
        syncProjectEndDate,
        getRowTemplatesForProject,
        lessonsForSyllabusBuild,
        getBaseProjectDisplayName,
        getScheduleWarnings,
        prepareDebateProjectForGeneration,
        maybeAutoFillDebateBookPeriods,
        annotateDebateTemplateHints
    };
})(typeof window !== 'undefined' ? window : globalThis);
