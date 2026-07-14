/**
 * Syllabus A4 print formatting — aligned with Class Calendar Multi User.
 * window.CCPCompanionSyllabusPrint
 */
(function (global) {
    const PRINT_OPTIONS_KEY = 'ccp-companion-print-options';

    const DEFAULT_PRINT_OPTIONS = {
        weekFormat: 'abbrev',
        showDateColumn: true,
        detailAppendix: false
    };

    function loadPrintOptions() {
        try {
            const raw = localStorage.getItem(PRINT_OPTIONS_KEY);
            if (!raw) return { ...DEFAULT_PRINT_OPTIONS };
            const parsed = JSON.parse(raw);
            return {
                ...DEFAULT_PRINT_OPTIONS,
                ...parsed
            };
        } catch {
            return { ...DEFAULT_PRINT_OPTIONS };
        }
    }

    function savePrintOptions(options) {
        localStorage.setItem(PRINT_OPTIONS_KEY, JSON.stringify({
            ...loadPrintOptions(),
            ...options
        }));
    }

    function getA4Spec(mod) {
        if (mod && mod.SYLLABUS_A4_PAGE) {
            return mod.SYLLABUS_A4_PAGE;
        }
        return {
            pageW: 210,
            pageH: 297,
            margin: 7,
            fitSafety: 8,
            get contentW() {
                return this.pageW - this.margin * 2;
            },
            get contentH() {
                return this.pageH - this.margin * 2;
            },
            get fitContentH() {
                return this.contentH - this.fitSafety;
            }
        };
    }

    function getSyllabusYearForClass(classData, calendarDisplayStart) {
        const start = (classData && classData.startDate || '').trim();
        if (start && /^\d{4}/.test(start)) {
            return start.slice(0, 4);
        }
        const term = (calendarDisplayStart || '').trim();
        if (term && /^\d{4}/.test(term)) {
            return term.slice(0, 4);
        }
        return String(new Date().getFullYear());
    }

    function getClassScheduleStartMonthKey(classData, calendarDisplayStart) {
        const start = (classData && classData.startDate || '').trim();
        if (/^\d{4}-\d{2}/.test(start)) {
            return start.slice(0, 7);
        }
        const term = (calendarDisplayStart || '').trim();
        if (/^\d{4}-\d{2}/.test(term)) {
            return term;
        }
        return null;
    }

    function getTermSeasonI18nKeyForMonth(monthNum) {
        if (monthNum >= 3 && monthNum <= 5) return 'termSeasonSpring';
        if (monthNum >= 6 && monthNum <= 8) return 'termSeasonSummer';
        if (monthNum >= 9 && monthNum <= 11) return 'termSeasonFall';
        if (monthNum === 12 || monthNum === 1 || monthNum === 2) return 'termSeasonWinter';
        return null;
    }

    function formatClassTermLabel(classData, t, calendarDisplayStart) {
        const monthKey = getClassScheduleStartMonthKey(classData, calendarDisplayStart);
        if (!monthKey) return '';
        const [yearStr, monthStr] = monthKey.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        if (!year || !month) return '';
        const seasonKey = getTermSeasonI18nKeyForMonth(month);
        if (!seasonKey) return '';
        const season = t(seasonKey);
        return season !== seasonKey ? `${season} ${year}` : `${year}`;
    }

    function getClassLevelPresetName(classData) {
        const meta = global.CCPClassMetadata;
        if (!meta || !classData) return '';
        const presetId = meta.resolveLevelPresetForForm(classData);
        if (!presetId) return '';
        const def = meta.getSimsonLevelById(presetId);
        return def ? def.name : presetId;
    }

    function getBooksUsedForClassTitle(classData, appData) {
        const seen = new Set();
        const list = [];
        const add = (raw) => {
            const book = String(raw || '').trim();
            if (book && !seen.has(book)) {
                seen.add(book);
                list.push(book);
            }
        };
        add(classData && classData.book);
        const editor = global.CCPBooksEditor;
        const curriculumId = (classData && classData.curriculumId || '').trim();
        if (editor && curriculumId && !editor.isNoCurriculum(curriculumId)) {
            const bookMeta = editor.getBookById(curriculumId, appData);
            if (bookMeta) {
                add(bookMeta.displayName || bookMeta.name);
            }
        }
        return list;
    }

    function formatSyllabusPdfClassTitle(classData, t, calendarDisplayStart, appData) {
        if (!classData) return 'Syllabus';
        const meta = global.CCPClassMetadata;
        const subject = (classData.name || '').trim();
        const levelPreset = getClassLevelPresetName(classData);
        const levelCustom = meta ? meta.resolveLevelCustomForForm(classData) : (classData.levelCustom || '');
        const gradeRaw = (classData.grade || '').trim();
        const norm = (s) => String(s || '').trim().toLowerCase();

        const parts = [];
        if (subject) parts.push(subject);
        if (levelPreset && norm(levelPreset) !== norm(subject)) {
            parts.push(levelPreset);
        } else if (levelPreset && !subject) {
            parts.push(levelPreset);
        }
        if (levelCustom && norm(levelCustom) !== norm(levelPreset) && norm(levelCustom) !== norm(subject)) {
            parts.push(`[${levelCustom}]`);
        }
        if (gradeRaw) {
            const gradePart = /\bclass\b/i.test(gradeRaw) ? gradeRaw : `${gradeRaw} Class`;
            parts.push(`[${gradePart}]`);
        }

        let title = parts.length ? parts.join(' ') : subject || levelPreset || 'Class';
        const books = getBooksUsedForClassTitle(classData, appData);
        if (books.length) {
            title += ` · ${books.join('; ')}`;
        }
        const termLabel = formatClassTermLabel(classData, t, calendarDisplayStart);
        if (termLabel) {
            title = `${termLabel} · ${title}`;
        }
        return title;
    }

    function formatMeetingDaysSummary(classData) {
        const datesApi = global.CCPScheduleLessonDates;
        if (!datesApi) return '—';
        const days = datesApi.getMeetingDaysFromClass(classData);
        if (!days.length) return '—';
        const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days.map((d) => names[d] || d).join(', ');
    }

    function buildJindoPrintTitle(classData, t) {
        if (!classData) return '';
        const parts = [];
        const name = (classData.name || '').trim();
        if (name) parts.push(name);
        const book = (classData.book || '').trim();
        if (book) parts.push(book);
        const days = formatMeetingDaysSummary(classData);
        if (days && days !== '—') {
            const suffix = t('syllabusPrintMeetingDaysSuffix').replace('{days}', days);
            if (suffix && suffix !== 'syllabusPrintMeetingDaysSuffix') {
                parts.push(suffix);
            } else {
                parts.push(`[${days}]`);
            }
        }
        return parts.join(' · ');
    }

    function resolveGeneralNotes(classData, project, appData) {
        const editor = global.CCPBooksEditor;
        if (editor && typeof editor.resolveSyllabusGeneralNotesForClass === 'function') {
            const fromEditor = editor.resolveSyllabusGeneralNotesForClass(classData, appData);
            if (fromEditor) return String(fromEditor).trim();
        }
        if (project && project.syllabusGeneralNotes) {
            return String(project.syllabusGeneralNotes).trim();
        }
        if (classData && classData.syllabusGeneralNotes) {
            return String(classData.syllabusGeneralNotes).trim();
        }
        return '';
    }

    function getSyllabusSectionMeta(classData, calendarDisplayStart, t, appData) {
        return {
            classData,
            classTitle: formatSyllabusPdfClassTitle(classData, t, calendarDisplayStart, appData),
            tableYear: getSyllabusYearForClass(classData, calendarDisplayStart),
            subtitle: '',
            termRange: ''
        };
    }

    function getSyllabusTableLabels(t, lang, classData, printOptions, calendarDisplayStart) {
        const useKo = lang === 'ko';
        const opts = printOptions || DEFAULT_PRINT_OPTIONS;
        const detailAppendix = opts.detailAppendix === true;
        return {
            colMonth: t('syllabusColMonth'),
            colWeek: t('syllabusColWeek'),
            colClass: t('syllabusColClass'),
            colDate: t('syllabusColDate'),
            colPlan: t('syllabusColPlan'),
            colPlanPrint: t('syllabusColPlanPrint'),
            colPlanJindo: t('syllabusColPlanJindo'),
            colYear: t('syllabusColYear'),
            continuationTitle: t('syllabusPrintContinuedTitle'),
            continuationHint: t('syllabusPrintContinuedHint'),
            continuationPage: t('syllabusPrintContinuedPage'),
            continuationHomeworkLabel: t('syllabusPrintContinuedHomework'),
            colNote: t('syllabusColNote'),
            jindoTable: true,
            useKoreanJindo: useKo,
            includeDetailAppendix: detailAppendix,
            syllabusPrintContinuation: detailAppendix ? 'always' : 'never',
            weekFormat: opts.weekFormat || 'stored',
            showDateColumn: opts.showDateColumn !== false,
            pdfLayout: true,
            a4Pdf: true,
            tableYear: getSyllabusYearForClass(classData, calendarDisplayStart),
            jindoTitle: classData ? buildJindoPrintTitle(classData, t) : ''
        };
    }

    function getSyllabusRenderLabels(classData, project, appData, t, lang, printOptions, calendarDisplayStart) {
        const meta = getSyllabusSectionMeta(classData, calendarDisplayStart, t, appData);
        return {
            ...getSyllabusTableLabels(t, lang, classData, printOptions, calendarDisplayStart),
            classTitle: meta.classTitle,
            jindoTitle: buildJindoPrintTitle(classData, t),
            tableYear: meta.tableYear,
            subtitle: meta.subtitle,
            termRange: meta.termRange,
            generalNotes: resolveGeneralNotes(classData, project, appData)
        };
    }

    function buildPrintSection(classData, rows, labels) {
        return {
            classData,
            rows: rows || [],
            classTitle: labels.classTitle,
            jindoTitle: labels.jindoTitle,
            tableYear: labels.tableYear,
            subtitle: labels.subtitle,
            termRange: labels.termRange,
            generalNotes: labels.generalNotes
        };
    }

    function buildPrintDocument(project, rows, context) {
        const mod = global.CCPSyllabus;
        if (!mod || !project) return '';
        const ctx = context || {};
        const t = typeof ctx.t === 'function' ? ctx.t : (k) => k;
        const lang = ctx.lang || 'en';
        const appData = ctx.appData || {};
        const printOptions = ctx.printOptions || loadPrintOptions();
        const calendarDisplayStart = ctx.calendarDisplayStart || '';
        const classData = typeof ctx.projectToClassShape === 'function'
            ? ctx.projectToClassShape(project, appData)
            : project;
        const syllabusRows = rows || project.syllabusRows || [];
        const labels = getSyllabusRenderLabels(
            classData,
            project,
            appData,
            t,
            lang,
            printOptions,
            calendarDisplayStart
        );
        const section = buildPrintSection(classData, syllabusRows, labels);
        const meta = {
            title: labels.classTitle || classData.name || 'Syllabus',
            subtitle: calendarDisplayStart || (classData.startDate ? classData.startDate.slice(0, 7) : '')
        };
        return mod.renderSyllabusDocumentHtml(meta, [section], labels);
    }

    function buildPrintDocumentForProjects(projects, context) {
        const mod = global.CCPSyllabus;
        if (!mod || !Array.isArray(projects) || !projects.length) return '';
        const ctx = context || {};
        const t = typeof ctx.t === 'function' ? ctx.t : (k) => k;
        const lang = ctx.lang || 'en';
        const appData = ctx.appData || {};
        const printOptions = ctx.printOptions || loadPrintOptions();
        const calendarDisplayStart = ctx.calendarDisplayStart || '';
        const projectToClassShape = typeof ctx.projectToClassShape === 'function'
            ? ctx.projectToClassShape
            : (project) => project;
        const sections = [];

        projects.forEach((project) => {
            const rows = project.syllabusRows || [];
            if (!rows.length) return;
            const classData = projectToClassShape(project, appData);
            const labels = getSyllabusRenderLabels(
                classData,
                project,
                appData,
                t,
                lang,
                printOptions,
                calendarDisplayStart
            );
            sections.push(buildPrintSection(classData, rows, labels));
        });

        if (!sections.length) return '';

        const sharedLabels = {
            ...getSyllabusTableLabels(t, lang, sections[0].classData, printOptions, calendarDisplayStart),
            pdfLayout: true,
            a4Pdf: true
        };
        const meta = {
            title: buildPrintWindowTitle(projects, t, calendarDisplayStart, appData, projectToClassShape),
            subtitle: calendarDisplayStart || ''
        };
        return mod.renderSyllabusDocumentHtml(meta, sections, sharedLabels);
    }

    function buildPrintWindowTitle(projects, t, calendarDisplayStart, appData, projectToClassShape) {
        const list = Array.isArray(projects) ? projects : [];
        if (list.length === 1) {
            const classData = projectToClassShape(list[0], appData);
            return formatSyllabusPdfClassTitle(
                classData,
                t,
                calendarDisplayStart,
                appData
            ) || list[0].name || 'Syllabus';
        }
        const label = t('printMultiTitle').replace('{n}', String(list.length));
        return label !== 'printMultiTitle' ? label : `Syllabi (${list.length})`;
    }

    function fitSyllabusDocument(doc, mod) {
        if (!doc || !mod || typeof mod.fitSyllabusPagesToA4 !== 'function') {
            return null;
        }
        if (!doc.querySelector('.syllabus-a4-sheet')) {
            return null;
        }
        return mod.fitSyllabusPagesToA4(doc, getA4Spec(mod));
    }

    function schedulePrintWindow(printWin, mod, windowTitle) {
        if (!printWin) return;
        printWin.document.title = windowTitle || 'Syllabus';
        printWin.focus();
        const runPrint = () => {
            fitSyllabusDocument(printWin.document, mod);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    try {
                        printWin.print();
                    } catch {
                        /* user can print manually */
                    }
                });
            });
        };
        setTimeout(runPrint, 400);
    }

    function printDocument(docHtml, windowTitle, mod) {
        const syllabusMod = mod || global.CCPSyllabus;
        const printWin = window.open('', '_blank');
        if (!printWin) {
            return { ok: false, reason: 'blocked' };
        }
        printWin.document.open();
        printWin.document.write(docHtml);
        printWin.document.close();
        schedulePrintWindow(printWin, syllabusMod, windowTitle);
        return { ok: true, printWin };
    }

    function fitPreviewFrame(frame, mod) {
        if (!frame || !frame.contentDocument) return;
        fitSyllabusDocument(frame.contentDocument, mod || global.CCPSyllabus);
    }

    global.CCPCompanionSyllabusPrint = {
        PRINT_OPTIONS_KEY,
        DEFAULT_PRINT_OPTIONS,
        loadPrintOptions,
        savePrintOptions,
        getA4Spec,
        buildPrintDocument,
        buildPrintDocumentForProjects,
        buildPrintWindowTitle,
        fitSyllabusDocument,
        schedulePrintWindow,
        printDocument,
        fitPreviewFrame,
        formatSyllabusPdfClassTitle,
        buildJindoPrintTitle,
        getSyllabusRenderLabels
    };
})(typeof window !== 'undefined' ? window : globalThis);
