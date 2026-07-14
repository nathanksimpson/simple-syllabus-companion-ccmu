/**
 * Term checklist, phase wizards, welcome modal, and spotlight tour.
 * window.CCPCompanionGuides
 */
(function (global) {
    const CHECKLIST_KEY = 'ccp-companion-term-checklist-v1';
    const WELCOME_KEY = 'ccp-companion-welcome-seen-v1';

    let callbacks = {};
    let helpMenuOpen = false;

    function t(key) {
        if (typeof global.__companionT === 'function') return global.__companionT(key);
        return key;
    }

    function esc(s) {
        return global.CCPUtils ? global.CCPUtils.escapeHtml(s) : String(s ?? '');
    }

    function dayAfterISO(iso) {
        const utils = global.CCPUtils;
        if (!utils || !iso) return '';
        const d = utils.parseISODateLocal(iso);
        if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
        d.setDate(d.getDate() + 1);
        return utils.formatDateISO(d);
    }

    function defaultEndThreeMonthsAfter(start) {
        return computeAutoTermEndISO(start, 3, 'calendarMonths') || dayAfterISO(start);
    }

    function ensureEndOnOrAfterStart(start, end) {
        if (!start) return end || '';
        if (!end || end < start) return defaultEndThreeMonthsAfter(start);
        return end;
    }

    function computeAutoTermEndISO(start, months, mode) {
        const td = global.CCPTermDates;
        if (!td || !start) return '';
        const count = parseInt(months, 10) || 3;
        const computed = mode === 'exactMonths'
            ? td.computeTermEndDateExactMonths(start, count)
            : td.computeTermEndDateFromStart(start, count);
        return computed ? td.formatDateForInput(computed) : '';
    }

    function wizard() {
        return global.CCPCompanionWizard;
    }

    function store() {
        return global.CCPCompanionStore;
    }

    function loadChecklistState() {
        try {
            const raw = localStorage.getItem(CHECKLIST_KEY);
            if (!raw) {
                return { phase1: 'pending', phase2: 'pending', phase3: 'pending', phase4: 'pending', dismissed: false };
            }
            return { ...JSON.parse(raw) };
        } catch {
            return { phase1: 'pending', phase2: 'pending', phase3: 'pending', phase4: 'pending', dismissed: false };
        }
    }

    function saveChecklistState(state) {
        localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
    }

    function detectPhaseStatus(data) {
        const d = data || store().getData();
        const out = { phase1: 'pending', phase2: 'pending', phase3: 'pending', phase4: 'pending' };
        const hasTerm = !!(d.termStart && String(d.termStart).trim());
        const hasEvents = Array.isArray(d.events) && d.events.length > 0;
        if (hasTerm && hasEvents) out.phase1 = 'done';
        const editor = global.CCPBooksEditor;
        const books = editor ? editor.discoverBooks(d) : [];
        if (books.length > 0) out.phase2 = 'done';
        const hasRows = (d.projects || []).some((p) => Array.isArray(p.syllabusRows) && p.syllabusRows.length > 0);
        if (hasRows) out.phase3 = 'done';
        const saved = loadChecklistState();
        if (saved.phase4 === 'done' || saved.phase4 === 'skipped') out.phase4 = saved.phase4;
        return out;
    }

    function mergeChecklistState() {
        const saved = loadChecklistState();
        const detected = detectPhaseStatus();
        const merged = { ...saved };
        ['phase1', 'phase2', 'phase3'].forEach((key) => {
            if (detected[key] === 'done') merged[key] = 'done';
        });
        saveChecklistState(merged);
        return merged;
    }

    function markPhaseDone(phaseNum) {
        const state = loadChecklistState();
        state[`phase${phaseNum}`] = 'done';
        saveChecklistState(state);
        updateChecklistMount();
    }

    function markExportComplete() {
        markPhaseDone(4);
    }

    function renderTermChecklist() {
        const mount = document.getElementById('termSetupChecklist');
        if (!mount) return;
        const state = mergeChecklistState();
        const items = [
            { num: 1, labelKey: 'checklistPhase1Label', descKey: 'checklistPhase1Desc', actionKey: 'checklistPhase1Action', wizard: 'calendar' },
            { num: 2, labelKey: 'checklistPhase2Label', descKey: 'checklistPhase2Desc', actionKey: 'checklistPhase2Action', wizard: 'curriculum' },
            { num: 3, labelKey: 'checklistPhase3Label', descKey: 'checklistPhase3Desc', actionKey: 'checklistPhase3Action', wizard: 'syllabus' },
            { num: 4, labelKey: 'checklistPhase4Label', descKey: 'checklistPhase4Desc', actionKey: 'checklistPhase4Action', wizard: 'export' }
        ];
        mount.hidden = false;
        mount.classList.remove('is-show-strip');
        mount.innerHTML = `
            <div class="term-checklist-card">
                <div class="term-checklist-card__header">
                    <button type="button" class="btn btn-outline btn-small" id="checklistHideBtn">${esc(t('checklistHide'))}</button>
                    <h2 class="term-checklist-card__title">${esc(t('checklistTitle'))}</h2>
                </div>
                ${items.map((item) => {
                    const status = state[`phase${item.num}`] || 'pending';
                    const statusChar = status === 'done' ? '✓' : (status === 'skipped' ? '–' : '');
                    return `
                    <div class="term-checklist-item${status === 'done' ? ' is-done' : ''}${status === 'skipped' ? ' is-skipped' : ''}">
                        <div class="term-checklist-item__status" aria-hidden="true">${statusChar}</div>
                        <div class="term-checklist-item__body">
                            <p class="term-checklist-item__label">${esc(t(item.labelKey))}</p>
                            <p class="term-checklist-item__desc">${esc(t(item.descKey))}</p>
                            <button type="button" class="btn btn-outline btn-small" data-checklist-wizard="${item.wizard}">${esc(t(item.actionKey))}</button>
                        </div>
                    </div>`;
                }).join('')}
                <button type="button" class="btn btn-outline btn-small" id="checklistDismissBtn">${esc(t('checklistDismiss'))}</button>
            </div>`;

        mount.querySelectorAll('[data-checklist-wizard]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const kind = btn.dataset.checklistWizard;
                endSpotlightTour();
                if (kind === 'calendar') openCalendarWizard();
                else if (kind === 'curriculum') openCurriculumWizard();
                else if (kind === 'syllabus') openSyllabusWizard();
                else if (kind === 'export') {
                    if (typeof callbacks.switchTab === 'function') callbacks.switchTab('print');
                }
            });
        });
        const dismissChecklist = () => {
            const s = loadChecklistState();
            s.dismissed = true;
            saveChecklistState(s);
            renderShowStrip();
        };
        mount.querySelector('#checklistDismissBtn')?.addEventListener('click', dismissChecklist);
        mount.querySelector('#checklistHideBtn')?.addEventListener('click', dismissChecklist);
    }

    function renderShowStrip() {
        const mount = document.getElementById('termSetupChecklist');
        if (!mount) return;
        mount.hidden = false;
        mount.classList.add('is-show-strip');
        mount.innerHTML = `
            <div class="term-checklist-show-strip">
                <button type="button" class="btn btn-outline btn-small" id="checklistShowBtn">${esc(t('checklistShow'))}</button>
            </div>`;
        mount.querySelector('#checklistShowBtn')?.addEventListener('click', () => {
            showChecklist(true);
        });
    }

    function updateChecklistMount() {
        const state = loadChecklistState();
        if (state.dismissed) {
            renderShowStrip();
        } else {
            renderTermChecklist();
        }
    }

    function showChecklist(force) {
        const mount = document.getElementById('termSetupChecklist');
        if (!mount) return;
        if (force) {
            const s = loadChecklistState();
            s.dismissed = false;
            saveChecklistState(s);
        }
        updateChecklistMount();
    }

    function openCalendarWizard() {
        endSpotlightTour();
        const w = wizard();
        const st = store();
        if (!w || !st) return;
        const data = st.getData();
        const range = st.getTermDateRange();
        const ctx = {
            termStart: data.termStart || '',
            termEnd: data.termEnd || range.end || '',
            useAutoTermEnd: data.useAutoTermEnd !== false,
            termCalendarMonths: data.termCalendarMonths || 3,
            termEndMode: data.termEndMode || 'calendarMonths',
            displayStart: data.calendarDisplayStart || data.termStart || '',
            displayEnd: ensureEndOnOrAfterStart(
                data.calendarDisplayStart || data.termStart || '',
                data.calendarDisplayEnd || data.termEnd || ''
            )
        };

        w.openWizard({
            titleKey: 'calendarWizardTitle',
            ctx,
            onComplete: () => {
                markPhaseDone(1);
                if (typeof callbacks.refreshUi === 'function') callbacks.refreshUi();
            },
            steps: [
                {
                    titleKey: 'calendarWizardStep1Title',
                    render: () => `<p class="companion-wizard__hint">${esc(t('calendarWizardStep1Body'))}</p>`
                },
                {
                    titleKey: 'calendarWizardStep2Title',
                    render: () => `
                        <p class="companion-wizard__hint">${esc(t('calendarWizardStep2Body'))}</p>
                        <div class="form-group">
                            <label for="wizTermStart">${esc(t('termStartLabel'))}</label>
                            <input type="date" id="wizTermStart" value="${esc(ctx.termStart)}">
                        </div>
                        <div class="form-group">
                            <label class="wizard-check-row" for="wizTermAutoEnd">
                                <input type="checkbox" id="wizTermAutoEnd"${ctx.useAutoTermEnd ? ' checked' : ''}>
                                <span>${esc(t('endAuto'))}</span>
                            </label>
                            <p class="companion-wizard__hint wizard-auto-hint">${esc(t('wizardAutoEndHint'))}</p>
                            <div class="wizard-auto-fields" id="wizTermMonthsWrap">
                                <div class="form-group">
                                    <label for="wizTermMonths">${esc(t('termMonths'))}</label>
                                    <input type="number" id="wizTermMonths" min="1" max="24" value="${ctx.termCalendarMonths}">
                                    <select id="wizTermEndMode" class="field-select" style="margin-top:6px">
                                        <option value="calendarMonths"${ctx.termEndMode !== 'exactMonths' ? ' selected' : ''}>${esc(t('termEndModeCalendarMonths'))}</option>
                                        <option value="exactMonths"${ctx.termEndMode === 'exactMonths' ? ' selected' : ''}>${esc(t('termEndModeExactMonths'))}</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="form-group" id="wizTermEndWrap">
                            <label for="wizTermEnd">${esc(t('endDate'))}</label>
                            <input type="date" id="wizTermEnd" value="${esc(ctx.termEnd)}">
                        </div>`,
                    bind: (body) => {
                        const auto = body.querySelector('#wizTermAutoEnd');
                        const startInput = body.querySelector('#wizTermStart');
                        const endInput = body.querySelector('#wizTermEnd');
                        const monthsWrap = body.querySelector('#wizTermMonthsWrap');
                        const monthsInput = body.querySelector('#wizTermMonths');
                        const endMode = body.querySelector('#wizTermEndMode');
                        const sync = () => {
                            const on = !!(auto && auto.checked);
                            if (endInput) endInput.readOnly = on;
                            if (monthsInput) monthsInput.disabled = !on;
                            if (endMode) endMode.disabled = !on;
                            if (monthsWrap) monthsWrap.classList.toggle('is-disabled', !on);
                            if (on && startInput && endInput) {
                                const next = computeAutoTermEndISO(
                                    startInput.value,
                                    monthsInput?.value,
                                    endMode?.value || 'calendarMonths'
                                );
                                if (next) {
                                    endInput.value = next;
                                    ctx.termEnd = next;
                                }
                            }
                            if (startInput) {
                                ctx.termStart = startInput.value || '';
                            }
                            ctx.useAutoTermEnd = on;
                            ctx.termCalendarMonths = parseInt(monthsInput?.value, 10) || 3;
                            ctx.termEndMode = endMode?.value || 'calendarMonths';
                            if (!on && endInput) {
                                ctx.termEnd = endInput.value || '';
                            }
                        };
                        auto?.addEventListener('change', sync);
                        startInput?.addEventListener('change', sync);
                        monthsInput?.addEventListener('change', sync);
                        monthsInput?.addEventListener('input', sync);
                        endMode?.addEventListener('change', sync);
                        endInput?.addEventListener('change', () => {
                            if (auto && !auto.checked) {
                                ctx.termEnd = endInput.value || '';
                            }
                        });
                        sync();
                    },
                    onLeave: () => {
                        const body = document.getElementById('companionWizardBody');
                        if (!body) return false;
                        const termStart = body.querySelector('#wizTermStart')?.value || '';
                        if (!termStart) {
                            alert(t('termStartRequired'));
                            return false;
                        }
                        ctx.termStart = termStart;
                        ctx.useAutoTermEnd = body.querySelector('#wizTermAutoEnd')?.checked !== false;
                        ctx.termCalendarMonths = parseInt(body.querySelector('#wizTermMonths')?.value, 10) || 3;
                        ctx.termEndMode = body.querySelector('#wizTermEndMode')?.value || 'calendarMonths';
                        ctx.termEnd = body.querySelector('#wizTermEnd')?.value || '';
                        st.setTermDates({
                            termStart: ctx.termStart,
                            useAutoTermEnd: ctx.useAutoTermEnd,
                            termCalendarMonths: ctx.termCalendarMonths,
                            termEndMode: ctx.termEndMode,
                            termEnd: ctx.termEnd
                        });
                        const updated = st.getData();
                        ctx.termEnd = updated.termEnd || ctx.termEnd;
                        ctx.displayStart = updated.termStart;
                        ctx.displayEnd = ensureEndOnOrAfterStart(updated.termStart, updated.termEnd);
                        return true;
                    }
                },
                {
                    titleKey: 'calendarWizardStep3Title',
                    render: () => {
                        ctx.displayEnd = ensureEndOnOrAfterStart(ctx.displayStart, ctx.displayEnd);
                        const minAttr = ctx.displayStart ? ` min="${esc(ctx.displayStart)}"` : '';
                        return `
                        <p class="companion-wizard__hint">${esc(t('calendarWizardStep3Body'))}</p>
                        <div class="form-group">
                            <label for="wizDisplayStart">${esc(t('calShowFrom'))}</label>
                            <input type="date" id="wizDisplayStart" value="${esc(ctx.displayStart)}">
                        </div>
                        <div class="form-group">
                            <label for="wizDisplayEnd">${esc(t('calShowTo'))}</label>
                            <input type="date" id="wizDisplayEnd" value="${esc(ctx.displayEnd)}"${minAttr}>
                        </div>`;
                    },
                    bind: (body) => {
                        const startEl = body.querySelector('#wizDisplayStart');
                        const endEl = body.querySelector('#wizDisplayEnd');
                        const syncFromStart = () => {
                            const start = startEl?.value || '';
                            // Default end to ~3 months after start whenever start changes.
                            const end = start ? defaultEndThreeMonthsAfter(start) : '';
                            if (endEl) {
                                endEl.value = end;
                                if (start) endEl.min = start;
                                else endEl.removeAttribute('min');
                            }
                            ctx.displayStart = start;
                            ctx.displayEnd = end;
                        };
                        startEl?.addEventListener('change', syncFromStart);
                        endEl?.addEventListener('change', () => {
                            const start = startEl?.value || '';
                            let end = endEl?.value || '';
                            end = ensureEndOnOrAfterStart(start, end);
                            if (endEl && endEl.value !== end) endEl.value = end;
                            ctx.displayStart = start;
                            ctx.displayEnd = end;
                        });
                    },
                    onLeave: () => {
                        const body = document.getElementById('companionWizardBody');
                        const start = body?.querySelector('#wizDisplayStart')?.value || ctx.displayStart;
                        let end = body?.querySelector('#wizDisplayEnd')?.value || ctx.displayEnd;
                        end = ensureEndOnOrAfterStart(start, end);
                        ctx.displayStart = start;
                        ctx.displayEnd = end;
                        st.setDisplayRange(start, end);
                        return true;
                    }
                },
                {
                    titleKey: 'calendarWizardStep4Title',
                    render: () => `<p class="companion-wizard__hint">${esc(t('calendarWizardStep4Body'))}</p>`,
                    nextLabelKey: 'calendarWizardImportKr',
                    onLeave: async () => {
                        try {
                            const d = st.getData();
                            const result = await st.importKoreanPublicHolidays({
                                start: d.calendarDisplayStart,
                                end: d.calendarDisplayEnd
                            });
                            if (typeof callbacks.setStatus === 'function') {
                                callbacks.setStatus(t('calKrImported').replace('{n}', String(result.added)));
                            }
                        } catch (err) {
                            alert(t('calKrImportFailed'));
                            return false;
                        }
                        return true;
                    }
                },
                {
                    titleKey: 'calendarWizardStep5Title',
                    render: () => `
                        <p class="companion-wizard__hint">${esc(t('calendarWizardStep5Body'))}</p>
                        <button type="button" class="btn btn-primary btn-small" id="wizOpenEventBtn">${esc(t('calendarWizardAddEvent'))}</button>`,
                    bind: (body) => {
                        body.querySelector('#wizOpenEventBtn')?.addEventListener('click', () => {
                            if (global.CCPCompanionEventsUI) {
                                global.CCPCompanionEventsUI.openNewSharedEvent({
                                    prefillDate: ctx.termStart || ''
                                });
                            }
                        });
                    },
                    allowSkip: true,
                    skipLabelKey: 'wizardSkip'
                },
                {
                    titleKey: 'calendarWizardStep6Title',
                    render: () => `<p class="companion-wizard__hint">${esc(t('calendarWizardStep6Body'))}</p>`,
                    finishLabelKey: 'checklistPhase2Action'
                }
            ]
        });
    }

    function openCurriculumWizard() {
        endSpotlightTour();
        const w = wizard();
        const st = store();
        const editor = global.CCPBooksEditor;
        if (!w || !st || !editor) return;
        const ctx = { bookTitle: '', lessonCount: 8, sessions: [{ title: '', pages: '' }, { title: '', pages: '' }, { title: '', pages: '' }] };

        w.openWizard({
            titleKey: 'curriculumWizardTitle',
            ctx,
            onComplete: () => {
                markPhaseDone(2);
                if (typeof callbacks.refreshUi === 'function') callbacks.refreshUi();
            },
            steps: [
                {
                    titleKey: 'curriculumWizardStep1Title',
                    render: () => `<p class="companion-wizard__hint">${esc(t('curriculumWizardStep1Body'))}</p>`
                },
                {
                    titleKey: 'curriculumWizardStep2Title',
                    render: () => `
                        <p class="companion-wizard__hint">${esc(t('curriculumWizardStep2Body'))}</p>
                        <div class="form-group">
                            <label for="wizBookTitle">${esc(t('curriculumBookName'))}</label>
                            <input type="text" id="wizBookTitle" value="${esc(ctx.bookTitle)}" placeholder="${esc(t('curriculumAddPrompt'))}">
                        </div>
                        <button type="button" class="btn btn-outline btn-small" id="wizImportPackBtn">${esc(t('curriculumWizardImportPack'))}</button>`,
                    bind: (body) => {
                        body.querySelector('#wizImportPackBtn')?.addEventListener('click', () => {
                            document.getElementById('importPackFile')?.click();
                        });
                    },
                    onLeave: () => {
                        const title = document.getElementById('companionWizardBody')?.querySelector('#wizBookTitle')?.value?.trim();
                        if (!title) {
                            alert(t('curriculumAddTitleRequired'));
                            return false;
                        }
                        ctx.bookTitle = title;
                        return true;
                    }
                },
                {
                    titleKey: 'curriculumWizardStep3Title',
                    render: () => `
                        <div class="form-group">
                            <label for="wizLessonCount">${esc(t('totalLessons'))}</label>
                            <input type="number" id="wizLessonCount" min="1" max="200" value="${ctx.lessonCount}">
                        </div>`,
                    onLeave: () => {
                        ctx.lessonCount = parseInt(document.getElementById('companionWizardBody')?.querySelector('#wizLessonCount')?.value, 10) || 8;
                        return true;
                    }
                },
                {
                    titleKey: 'curriculumWizardStep4Title',
                    render: () => `
                        <p class="companion-wizard__hint">${esc(t('curriculumWizardStep4Body'))}</p>
                        <table class="wizard-sessions-table">
                            <thead><tr><th>#</th><th>${esc(t('colPlan'))}</th><th>${esc(t('colPages'))}</th></tr></thead>
                            <tbody>
                                ${ctx.sessions.map((s, i) => `
                                    <tr>
                                        <td>${i + 1}</td>
                                        <td><input type="text" class="wiz-session-title" data-idx="${i}" value="${esc(s.title)}"></td>
                                        <td><input type="text" class="wiz-session-pages" data-idx="${i}" value="${esc(s.pages)}"></td>
                                    </tr>`).join('')}
                            </tbody>
                        </table>`,
                    onLeave: () => {
                        const body = document.getElementById('companionWizardBody');
                        ctx.sessions.forEach((s, i) => {
                            s.title = body?.querySelector(`.wiz-session-title[data-idx="${i}"]`)?.value?.trim() || '';
                            s.pages = body?.querySelector(`.wiz-session-pages[data-idx="${i}"]`)?.value?.trim() || '';
                        });
                        const appData = st.getData();
                        const id = editor.createCurriculum({
                            bookTitle: ctx.bookTitle,
                            classDefaults: { defaultTotalLessons: ctx.lessonCount }
                        }, appData);
                        const entry = appData.curriculumOverrides && appData.curriculumOverrides[id];
                        if (entry && Array.isArray(entry.sessions)) {
                            while (entry.sessions.length < ctx.lessonCount) {
                                entry.sessions.push({
                                    sessionNumber: entry.sessions.length + 1,
                                    planTitle: '',
                                    planDetail: '',
                                    note: ''
                                });
                            }
                            ctx.sessions.forEach((s, i) => {
                                if (!entry.sessions[i]) return;
                                if (s.title) entry.sessions[i].planTitle = s.title;
                                if (s.pages) entry.sessions[i].planDetail = s.pages;
                            });
                        }
                        st.save(appData);
                        if (typeof callbacks.onCurriculumCreated === 'function') {
                            callbacks.onCurriculumCreated(id);
                        }
                        return true;
                    }
                },
                {
                    titleKey: 'curriculumWizardStep5Title',
                    render: () => `<p class="companion-wizard__hint">${esc(t('curriculumWizardStep5Body'))}</p>`,
                    finishLabelKey: 'checklistPhase3Action'
                }
            ]
        });
    }

    function openSyllabusWizard() {
        endSpotlightTour();
        const w = wizard();
        const st = store();
        const engine = global.CCPCompanionSyllabus;
        if (!w || !st || !engine) return;
        const data = st.getData();
        const defaults = st.getDefaultProjectDates(data);
        const ctx = {
            curriculumId: '',
            name: '',
            color: st.defaultProjectColor(data.projects.length),
            textColor: '',
            startDate: defaults.startDate,
            endDate: defaults.endDate,
            useAutoTermEnd: defaults.useAutoTermEnd,
            termCalendarMonths: defaults.termCalendarMonths,
            termEndMode: defaults.termEndMode,
            meetingTemplate: 'mwf',
            meetingsPerWeek: 2,
            meetingDays: [1, 3],
            projectId: null
        };

        const hasTerm = !!(data.termStart);
        const hasEvents = Array.isArray(data.events) && data.events.length > 0;

        w.openWizard({
            titleKey: 'syllabusWizardTitle',
            ctx,
            onComplete: () => {
                try {
                    const datesApi = global.CCPScheduleLessonDates;
                    const meetingDays = datesApi && datesApi.defaultMeetingDaysForSchedule
                        ? datesApi.defaultMeetingDaysForSchedule(
                            ctx.meetingTemplate,
                            ctx.meetingsPerWeek,
                            ctx.meetingDays
                        )
                        : (ctx.meetingDays || []);
                    const fields = {
                        name: ctx.name,
                        curriculumId: ctx.curriculumId,
                        color: ctx.color,
                        textColor: ctx.textColor,
                        startDate: ctx.startDate,
                        endDate: ctx.endDate,
                        useAutoTermEnd: ctx.useAutoTermEnd !== false,
                        termCalendarMonths: ctx.termCalendarMonths,
                        termEndMode: ctx.termEndMode || 'calendarMonths',
                        classScheduleTemplate: ctx.meetingTemplate,
                        meetingsPerWeek: ctx.meetingsPerWeek,
                        meetingDays,
                        syllabusRows: []
                    };
                    let project = ctx.projectId ? st.getProject(ctx.projectId) : null;
                    if (project) {
                        project = { ...project, ...fields };
                        st.upsertProject(project);
                    } else {
                        project = st.addProject(fields);
                        ctx.projectId = project.id;
                    }
                    markPhaseDone(3);
                    if (typeof callbacks.onProjectCreated === 'function') {
                        callbacks.onProjectCreated(project.id);
                    } else if (typeof callbacks.switchTab === 'function') {
                        callbacks.switchTab('syllabus');
                    }
                    if (typeof callbacks.refreshUi === 'function') callbacks.refreshUi();
                    if (typeof callbacks.setStatus === 'function') {
                        callbacks.setStatus(t('syllabusWizardFinishedOpenEditor'));
                    }
                } catch (err) {
                    console.error('Syllabus wizard create failed', err);
                    if (typeof callbacks.setStatus === 'function') {
                        callbacks.setStatus(t('syllabusWizardCreateFailed'), true);
                    }
                }
            },
            steps: [
                {
                    titleKey: 'syllabusWizardStep1Title',
                    render: () => {
                        let warn = '';
                        if (!hasTerm || !hasEvents) {
                            warn = `<div class="companion-wizard__warning">
                                ${esc(t('syllabusWizardCalendarWarning'))}
                                <button type="button" class="btn btn-outline btn-small" id="wizGoCalendarChecklist" style="margin-top:8px">${esc(t('syllabusWizardGoCalendar'))}</button>
                            </div>`;
                        }
                        return `${warn}<p class="companion-wizard__hint">${esc(t('syllabusWizardStep1Body'))}</p>`;
                    },
                    bind: (body) => {
                        body.querySelector('#wizGoCalendarChecklist')?.addEventListener('click', () => {
                            w.closeWizard();
                            showChecklist(true);
                            if (typeof callbacks.switchTab === 'function') callbacks.switchTab('calendar');
                        });
                    }
                },
                {
                    titleKey: 'syllabusWizardStep2Title',
                    render: () => {
                        const editor = global.CCPBooksEditor;
                        const books = editor ? editor.discoverBooks(data) : [];
                        if (!books.length) {
                            return `<div class="companion-wizard__warning">
                                ${esc(t('syllabusWizardNoCurriculum'))}
                                <button type="button" class="btn btn-outline btn-small" id="wizGoCurriculum" style="margin-top:8px">${esc(t('syllabusWizardGoCurriculum'))}</button>
                            </div>`;
                        }
                        const opts = books.map((b) => {
                            const sel = b.id === ctx.curriculumId ? ' selected' : '';
                            return `<option value="${esc(b.id)}"${sel}>${esc(b.displayName || b.name)}</option>`;
                        }).join('');
                        return `
                            <p class="companion-wizard__hint">${esc(t('syllabusWizardStep2Body'))}</p>
                            <div class="form-group">
                                <label for="wizCurriculum">${esc(t('curriculum'))}</label>
                                <select id="wizCurriculum"><option value="">${esc(t('selectCurriculum'))}</option>${opts}</select>
                            </div>`;
                    },
                    bind: (body) => {
                        body.querySelector('#wizGoCurriculum')?.addEventListener('click', () => {
                            w.closeWizard();
                            openCurriculumWizard();
                        });
                    },
                    onLeave: () => {
                        const editor = global.CCPBooksEditor;
                        const books = editor ? editor.discoverBooks(data) : [];
                        ctx.curriculumId = document.getElementById('companionWizardBody')?.querySelector('#wizCurriculum')?.value || '';
                        if (books.length && !ctx.curriculumId) {
                            alert(t('syllabusCurriculumRequired'));
                            return false;
                        }
                        return true;
                    }
                },
                {
                    titleKey: 'syllabusWizardStep3Title',
                    render: () => `
                        <div class="form-group">
                            <label for="wizSyllabusName">${esc(t('projectName'))}</label>
                            <input type="text" id="wizSyllabusName" value="${esc(ctx.name)}" placeholder="${esc(t('defaultSyllabusName'))}">
                        </div>
                        <div class="form-group">
                            <label>${esc(t('projectColorLabel'))}</label>
                            <div id="wizColorPalette" class="class-color-palette-host"></div>
                            <div id="wizColorPreview" class="class-color-preview-row"></div>
                        </div>`,
                    bind: (body) => {
                        const grid = body.querySelector('#wizColorPalette');
                        const preview = body.querySelector('#wizColorPreview');
                        if (global.CCPClassColorPalette && grid) {
                            const onPick = (hex) => {
                                ctx.color = hex;
                                global.CCPClassColorPalette.renderGrid(grid, hex, onPick);
                                global.CCPClassColorPalette.renderPreviewRow(preview, hex, ctx.name || t('defaultSyllabusName'));
                            };
                            global.CCPClassColorPalette.renderGrid(grid, ctx.color, onPick);
                            global.CCPClassColorPalette.renderPreviewRow(preview, ctx.color, ctx.name || t('defaultSyllabusName'));
                        }
                    },
                    onLeave: () => {
                        const name = document.getElementById('companionWizardBody')?.querySelector('#wizSyllabusName')?.value?.trim();
                        if (!name) {
                            alert(t('syllabusNameRequired'));
                            return false;
                        }
                        ctx.name = name;
                        return true;
                    }
                },
                {
                    titleKey: 'syllabusWizardStep4Title',
                    render: () => `
                        <p class="companion-wizard__hint">${esc(t('syllabusWizardTermDatesHint'))}</p>
                        <div class="form-group">
                            <label for="wizStartDate">${esc(t('startDate'))}</label>
                            <input type="date" id="wizStartDate" value="${esc(ctx.startDate)}" required>
                        </div>
                        <div class="form-group">
                            <label for="wizSyllabusMonths">${esc(t('termMonths'))}</label>
                            <input type="number" id="wizSyllabusMonths" min="1" max="24" value="${ctx.termCalendarMonths}">
                        </div>
                        <div class="form-group">
                            <label for="wizSyllabusEnd">${esc(t('endDate'))}</label>
                            <input type="date" id="wizSyllabusEnd" value="${esc(ctx.endDate)}">
                            <p class="section-hint">${esc(t('syllabusWizardEndDateHint'))}</p>
                        </div>`,
                    onLeave: () => {
                        const body = document.getElementById('companionWizardBody');
                        const startDate = body?.querySelector('#wizStartDate')?.value || '';
                        if (!startDate) {
                            alert(t('syllabusStartDateRequired'));
                            return false;
                        }
                        ctx.startDate = startDate;
                        ctx.termCalendarMonths = parseInt(body?.querySelector('#wizSyllabusMonths')?.value, 10) || 3;
                        ctx.endDate = body?.querySelector('#wizSyllabusEnd')?.value || '';
                        ctx.useAutoTermEnd = !ctx.endDate;
                        if (ctx.endDate && ctx.endDate < ctx.startDate) {
                            alert(t('syllabusEndBeforeStart'));
                            return false;
                        }
                        if (!ctx.endDate) {
                            const computed = computeAutoTermEndISO(ctx.startDate, ctx.termCalendarMonths, ctx.termEndMode);
                            ctx.endDate = computed || dayAfterISO(ctx.startDate);
                        }
                        return true;
                    }
                },
                {
                    titleKey: 'syllabusWizardStep5Title',
                    render: () => {
                        const tpl = ctx.meetingTemplate === 'tt' ? 'tt' : 'mwf';
                        const mpw = Number(ctx.meetingsPerWeek) === 1 ? 1 : 2;
                        return `
                        <p class="companion-wizard__hint">${esc(t('syllabusWizardStep5Body'))}</p>
                        <div class="form-group">
                            <label>${esc(t('classScheduleTemplate'))}</label>
                            <div class="schedule-template-row meeting-presets">
                                <label class="meeting-day-chip">
                                    <input type="radio" name="wizMeetTpl" value="mwf"${tpl === 'mwf' ? ' checked' : ''}>
                                    ${esc(t('scheduleTemplateMwf'))}
                                </label>
                                <label class="meeting-day-chip">
                                    <input type="radio" name="wizMeetTpl" value="tt"${tpl === 'tt' ? ' checked' : ''}>
                                    ${esc(t('scheduleTemplateTt'))}
                                </label>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>${esc(t('meetingsPerWeek'))}</label>
                            <div class="meetings-per-week-row meeting-presets">
                                <label class="meeting-day-chip">
                                    <input type="radio" name="wizMeetingsPerWeek" value="1"${mpw === 1 ? ' checked' : ''}>
                                    ${esc(t('meetingsPerWeek1'))}
                                </label>
                                <label class="meeting-day-chip">
                                    <input type="radio" name="wizMeetingsPerWeek" value="2"${mpw === 2 ? ' checked' : ''}>
                                    ${esc(t('meetingsPerWeek2'))}
                                </label>
                            </div>
                        </div>`;
                    },
                    onLeave: () => {
                        const body = document.getElementById('companionWizardBody');
                        const tpl = body?.querySelector('input[name="wizMeetTpl"]:checked')?.value || 'mwf';
                        const mpwRaw = body?.querySelector('input[name="wizMeetingsPerWeek"]:checked')?.value;
                        ctx.meetingTemplate = tpl === 'tt' ? 'tt' : 'mwf';
                        ctx.meetingsPerWeek = Number(mpwRaw) === 1 ? 1 : 2;
                        const datesApi = global.CCPScheduleLessonDates;
                        ctx.meetingDays = datesApi && datesApi.defaultMeetingDaysForSchedule
                            ? datesApi.defaultMeetingDaysForSchedule(ctx.meetingTemplate, ctx.meetingsPerWeek, [])
                            : (ctx.meetingTemplate === 'tt' ? [2, 4] : [1, 3]);
                        if (ctx.meetingsPerWeek === 1 && ctx.meetingTemplate === 'tt') {
                            ctx.meetingDays = [2];
                        } else if (ctx.meetingsPerWeek === 1 && ctx.meetingTemplate === 'mwf') {
                            ctx.meetingDays = [1];
                        }
                        return true;
                    }
                },
                {
                    titleKey: 'syllabusWizardStep6Title',
                    render: () => `<p class="companion-wizard__hint">${esc(t('syllabusWizardStep6Body'))}</p>`
                },
                {
                    titleKey: 'syllabusWizardStep7Title',
                    render: () => `<p class="companion-wizard__hint">${esc(t('syllabusWizardStep7Body'))}</p>`
                },
                {
                    titleKey: 'syllabusWizardStep8Title',
                    render: () => `<p class="companion-wizard__hint">${esc(t('syllabusWizardStep8Body'))}</p>`,
                    finishLabelKey: 'syllabusWizardOpenEditor'
                }
            ]
        });
    }

    function ensureWelcomeModal() {
        if (document.getElementById('companionWelcomeOverlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'companionWelcomeOverlay';
        overlay.className = 'companion-welcome-overlay';
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="companion-welcome" role="dialog" aria-labelledby="companionWelcomeTitle">
                <h2 id="companionWelcomeTitle"></h2>
                <p id="companionWelcomeBody"></p>
                <label class="wizard-check-row" for="companionWelcomeTour">
                    <input type="checkbox" id="companionWelcomeTour">
                    <span id="companionWelcomeTourLabel"></span>
                </label>
                <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
                    <button type="button" class="btn btn-primary btn-small" id="companionWelcomeStart"></button>
                    <a class="btn btn-outline btn-small" id="companionWelcomeGuide" href="docs/ko/사용-안내.pdf" target="_blank" rel="noopener"></a>
                    <button type="button" class="btn btn-outline btn-small" id="companionWelcomeClose"></button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#companionWelcomeStart')?.addEventListener('click', () => {
            const tour = overlay.querySelector('#companionWelcomeTour')?.checked;
            overlay.hidden = true;
            localStorage.setItem(WELCOME_KEY, '1');
            showChecklist(true);
            if (tour) startSpotlightTour();
        });
        overlay.querySelector('#companionWelcomeClose')?.addEventListener('click', () => {
            overlay.hidden = true;
            localStorage.setItem(WELCOME_KEY, '1');
        });
    }

    function maybeShowWelcome() {
        if (localStorage.getItem(WELCOME_KEY)) return;
        ensureWelcomeModal();
        const overlay = document.getElementById('companionWelcomeOverlay');
        if (!overlay) return;
        document.getElementById('companionWelcomeTitle').textContent = t('welcomeTitle');
        document.getElementById('companionWelcomeBody').textContent = t('welcomeBody');
        document.getElementById('companionWelcomeTourLabel').textContent = t('welcomeTourCheckbox');
        document.getElementById('companionWelcomeStart').textContent = t('welcomeStartSetup');
        document.getElementById('companionWelcomeGuide').textContent = t('welcomeUserGuide');
        document.getElementById('companionWelcomeClose').textContent = t('welcomeClose');
        overlay.hidden = false;
    }

    const TOUR_STOPS = [
        { selector: '#termSetupChecklist', key: 'tourChecklist' },
        { selector: '#tabBtn-calendar', key: 'tourCalendar' },
        { selector: '#tabBtn-curriculum', key: 'tourCurriculum' },
        { selector: '#newProjectBtn', key: 'tourSyllabus' },
        { selector: '#exportWordBtn', key: 'tourWord' },
        { selector: '#companionHelpBtn', key: 'tourHelp' }
    ];

    let tourIndex = 0;
    let tourRing = null;
    let tourTooltip = null;

    function clearTourUi() {
        tourRing?.remove();
        tourTooltip?.remove();
        tourRing = null;
        tourTooltip = null;
    }

    function showTourStep(index) {
        clearTourUi();
        if (index >= TOUR_STOPS.length) return;
        const stop = TOUR_STOPS[index];
        const el = document.querySelector(stop.selector);
        if (!el) {
            showTourStep(index + 1);
            return;
        }
        const rect = el.getBoundingClientRect();
        tourRing = document.createElement('div');
        tourRing.className = 'companion-spotlight-ring';
        tourRing.style.top = `${rect.top - 4}px`;
        tourRing.style.left = `${rect.left - 4}px`;
        tourRing.style.width = `${rect.width + 8}px`;
        tourRing.style.height = `${rect.height + 8}px`;
        document.body.appendChild(tourRing);

        tourTooltip = document.createElement('div');
        tourTooltip.className = 'companion-spotlight-tooltip';
        tourTooltip.innerHTML = `
            <p>${esc(t(stop.key))}</p>
            <div class="companion-spotlight-tooltip__actions">
                <button type="button" class="btn btn-outline btn-small" data-tour-action="skip">${esc(t('tourSkip'))}</button>
                <button type="button" class="btn btn-primary btn-small" data-tour-action="next">${esc(index >= TOUR_STOPS.length - 1 ? t('tourDone') : t('tourNext'))}</button>
            </div>`;
        tourTooltip.style.top = `${Math.min(rect.bottom + 12, window.innerHeight - 120)}px`;
        tourTooltip.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
        document.body.appendChild(tourTooltip);

        tourTooltip.querySelector('[data-tour-action="skip"]')?.addEventListener('click', () => {
            clearTourUi();
        });
        tourTooltip.querySelector('[data-tour-action="next"]')?.addEventListener('click', () => {
            tourIndex += 1;
            if (tourIndex >= TOUR_STOPS.length) clearTourUi();
            else showTourStep(tourIndex);
        });
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function endSpotlightTour() {
        clearTourUi();
    }

    function startSpotlightTour() {
        tourIndex = 0;
        showTourStep(0);
    }

    function setHelpMenuOpen(open) {
        const btn = document.getElementById('companionHelpBtn');
        const menu = document.getElementById('companionHelpMenu');
        const wrap = document.querySelector('.companion-help-menu');
        if (!btn || !menu || !wrap) return;
        helpMenuOpen = !!open;
        menu.hidden = !helpMenuOpen;
        btn.setAttribute('aria-expanded', helpMenuOpen ? 'true' : 'false');
        wrap.classList.toggle('is-open', helpMenuOpen);
        // Always render on body so header overflow / backdrop-filter cannot clip it.
        if (menu.parentElement !== document.body) {
            document.body.appendChild(menu);
        }
        if (helpMenuOpen) {
            const rect = btn.getBoundingClientRect();
            const width = Math.max(220, menu.offsetWidth || 220);
            let left = Math.round(rect.right - width);
            left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
            menu.style.position = 'fixed';
            menu.style.top = `${Math.round(rect.bottom + 6)}px`;
            menu.style.left = `${left}px`;
            menu.style.right = 'auto';
            menu.style.zIndex = '10000';
        } else {
            menu.style.position = '';
            menu.style.top = '';
            menu.style.left = '';
            menu.style.right = '';
            menu.style.zIndex = '';
        }
    }

    function setupHelpMenu() {
        const btn = document.getElementById('companionHelpBtn');
        const menu = document.getElementById('companionHelpMenu');
        const wrap = document.querySelector('.companion-help-menu');
        if (!btn || !menu || !wrap || wrap.dataset.helpMenuBound === '1') return;
        wrap.dataset.helpMenuBound = '1';

        // Mount once on body so open/close only toggles visibility/position.
        document.body.appendChild(menu);

        document.addEventListener('click', (e) => {
            const el = e.target instanceof Element
                ? e.target
                : (e.target && e.target.parentElement instanceof Element ? e.target.parentElement : null);
            if (!el) return;

            if (el.closest('#companionHelpBtn')) {
                e.preventDefault();
                e.stopPropagation();
                setHelpMenuOpen(!helpMenuOpen);
                return;
            }
            if (helpMenuOpen && !el.closest('#companionHelpMenu')) {
                setHelpMenuOpen(false);
            }
        }, true);

        menu.addEventListener('click', (e) => e.stopPropagation());
        const closeThen = (fn) => () => {
            setHelpMenuOpen(false);
            fn();
        };
        menu.querySelector('[data-help="checklist"]')?.addEventListener('click', closeThen(() => {
            showChecklist(true);
        }));
        menu.querySelector('[data-help="calendar"]')?.addEventListener('click', closeThen(() => {
            openCalendarWizard();
        }));
        menu.querySelector('[data-help="curriculum"]')?.addEventListener('click', closeThen(() => {
            openCurriculumWizard();
        }));
        menu.querySelector('[data-help="syllabus"]')?.addEventListener('click', closeThen(() => {
            openSyllabusWizard();
        }));
        menu.querySelector('[data-help="tour"]')?.addEventListener('click', closeThen(() => {
            startSpotlightTour();
        }));
        menu.querySelector('[data-help="guide"]')?.addEventListener('click', closeThen(() => {
            window.open('docs/ko/사용-안내.pdf', '_blank', 'noopener');
        }));
    }

    function applyWelcomeLanguage() {
        const overlay = document.getElementById('companionWelcomeOverlay');
        if (!overlay || overlay.hidden) return;
        const title = document.getElementById('companionWelcomeTitle');
        const body = document.getElementById('companionWelcomeBody');
        const tourLabel = document.getElementById('companionWelcomeTourLabel');
        const start = document.getElementById('companionWelcomeStart');
        const guide = document.getElementById('companionWelcomeGuide');
        const close = document.getElementById('companionWelcomeClose');
        if (title) title.textContent = t('welcomeTitle');
        if (body) body.textContent = t('welcomeBody');
        if (tourLabel) tourLabel.textContent = t('welcomeTourCheckbox');
        if (start) start.textContent = t('welcomeStartSetup');
        if (guide) guide.textContent = t('welcomeUserGuide');
        if (close) close.textContent = t('welcomeClose');
    }

    function applyLanguage() {
        updateChecklistMount();
        applyWelcomeLanguage();
        if (tourTooltip) {
            showTourStep(tourIndex);
        }
        const w = wizard();
        if (w?.isOpen?.() && typeof w.refreshLanguage === 'function') {
            w.refreshLanguage();
        }
    }

    function init(options) {
        callbacks = options || {};
        updateChecklistMount();
        setupHelpMenu();
        maybeShowWelcome();
    }

    global.CCPCompanionGuides = {
        init,
        showChecklist,
        renderTermChecklist,
        refreshChecklist: updateChecklistMount,
        applyLanguage,
        openCalendarWizard,
        openCurriculumWizard,
        openSyllabusWizard,
        startSpotlightTour,
        endSpotlightTour,
        markExportComplete,
        markPhaseDone,
        loadChecklistState,
        detectPhaseStatus,
        mergeChecklistState
    };
})(typeof window !== 'undefined' ? window : globalThis);
