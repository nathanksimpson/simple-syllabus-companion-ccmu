/**
 * Syllabus Companion — main UI.
 */
(function () {
    const DAY_KEYS = ['daySun', 'dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat'];
    const MEETING_PRESETS = [
        { id: 'mwf', key: 'presetMwf', days: [1, 3, 5] },
        { id: 'mw', key: 'presetMw', days: [1, 3] },
        { id: 'wf', key: 'presetWf', days: [3, 5] },
        { id: 'mf', key: 'presetMf', days: [1, 5] },
        { id: 'tt', key: 'presetTt', days: [2, 4] },
        { id: 'clear', key: 'presetClear', days: [] }
    ];

    const PRINT_SELECTION_KEY = 'ccp-companion-print-selection';

    const DEFAULT_TAB_ORDER = ['calendar', 'curriculum', 'syllabus', 'print'];
    const LEGACY_DEFAULT_TAB_ORDER = ['curriculum', 'syllabus', 'calendar', 'print'];
    const TAB_ORDER_KEY = 'ccp-companion-tab-order-v2';
    const TAB_ORDER_KEY_LEGACY = 'ccp-companion-tab-order';

    let lang = localStorage.getItem('ccp-companion-lang') || 'en';
    let activeTab = 'calendar';
    let tabDragDidMove = false;
    let curriculumTabSelectedId = null;
    let activeProjectId = null;
    let isDeletingProject = false;
    let printSelectedProjectIds = loadPrintSelection();
    window.__companionLang = lang;

    function loadPrintSelection() {
        try {
            const raw = sessionStorage.getItem(PRINT_SELECTION_KEY);
            if (!raw) return new Set();
            const parsed = JSON.parse(raw);
            return new Set(Array.isArray(parsed) ? parsed : []);
        } catch {
            return new Set();
        }
    }

    function savePrintSelection() {
        sessionStorage.setItem(
            PRINT_SELECTION_KEY,
            JSON.stringify([...printSelectedProjectIds])
        );
    }

    function isPrintableProject(project) {
        return !!(project && Array.isArray(project.syllabusRows) && project.syllabusRows.length);
    }

    function prunePrintSelection() {
        const valid = new Set(window.CCPCompanionStore.getProjects().map((p) => p.id));
        printSelectedProjectIds = new Set(
            [...printSelectedProjectIds].filter((id) => valid.has(id))
        );
        savePrintSelection();
    }

    function ensureActiveProjectInPrintSelection() {
        if (!activeProjectId) return;
        const project = window.CCPCompanionStore.getProject(activeProjectId);
        if (isPrintableProject(project)) {
            printSelectedProjectIds.add(activeProjectId);
            savePrintSelection();
        }
    }

    function getSelectedPrintProjects() {
        prunePrintSelection();
        const store = window.CCPCompanionStore;
        return [...printSelectedProjectIds]
            .map((id) => store.getProject(id))
            .filter((p) => p && isPrintableProject(p));
    }

    function getPrintableProjects() {
        return window.CCPCompanionStore.getProjects().filter((p) => isPrintableProject(p));
    }

    function updatePrintSelectionCount() {
        const el = document.getElementById('printSelectionCount');
        if (!el) return;
        const selected = getSelectedPrintProjects();
        el.textContent = selected.length
            ? t('printSelectionCount').replace('{n}', String(selected.length))
            : '';
    }

    function renderPrintProjectList() {
        const mount = document.getElementById('printProjectListMount');
        if (!mount) return;
        prunePrintSelection();
        ensureActiveProjectInPrintSelection();
        const projects = window.CCPCompanionStore.getProjects();
        const printable = projects.filter((p) => isPrintableProject(p));

        if (!projects.length) {
            mount.innerHTML = `<p class="section-hint">${escapeHtml(t('noProjects'))}</p>`;
            updatePrintSelectionCount();
            return;
        }

        if (!printable.length) {
            mount.innerHTML = `<p class="section-hint">${escapeHtml(t('printSelectionEmpty'))}</p>`;
            updatePrintSelectionCount();
            return;
        }

        mount.innerHTML = projects.map((p) => {
            const printable = isPrintableProject(p);
            const checked = printable && printSelectedProjectIds.has(p.id);
            const api = window.CCPScheduleLessonDates;
            const daysLabel = api ? api.formatMeetingDaysShort(p.meetingDays || []) : '';
            const rowCount = p.syllabusRows?.length || 0;
            const meta = printable
                ? `${daysLabel ? `${daysLabel} · ` : ''}${t('printRowCount').replace('{n}', String(rowCount))}`
                : t('printNotPrintable');
            return `
                <label class="print-project-item${printable ? '' : ' is-disabled'}">
                    <input type="checkbox" class="print-project-cb" data-project-id="${escapeHtml(p.id)}"
                        ${checked ? ' checked' : ''}${printable ? '' : ' disabled'}>
                    <span>
                        <span>${escapeHtml(p.name || t('defaultSyllabusName'))}</span>
                        <span class="print-project-item__meta">${escapeHtml(meta)}</span>
                    </span>
                </label>`;
        }).join('');

        mount.querySelectorAll('.print-project-cb').forEach((cb) => {
            cb.addEventListener('change', () => {
                const id = cb.dataset.projectId;
                if (!id) return;
                if (cb.checked) {
                    printSelectedProjectIds.add(id);
                } else {
                    printSelectedProjectIds.delete(id);
                }
                savePrintSelection();
                updatePrintSelectionCount();
                refreshPrintPreview();
            });
        });

        updatePrintSelectionCount();
    }

    function t(key) {
        const pack = window.CCPCompanionI18n || {};
        return (pack[lang] && pack[lang][key])
            || (pack.en && pack.en[key])
            || key;
    }
    window.__companionT = t;

    function applyDataI18n(root = document) {
        root.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = el.getAttribute('data-i18n');
            if (key) el.textContent = t(key);
        });
        root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) el.placeholder = t(key);
        });
    }

    function escapeHtml(s) {
        return window.CCPUtils ? window.CCPUtils.escapeHtml(s) : String(s ?? '');
    }

    function setStatus(msg, isError) {
        const wrap = document.getElementById('statusMessage');
        const el = document.getElementById('statusMessageText');
        if (!wrap || !el) return;
        el.textContent = msg || '';
        wrap.classList.toggle('is-error', !!isError);
        if (msg && !isError) {
            setTimeout(() => {
                if (el.textContent === msg) {
                    el.textContent = '';
                }
            }, 4000);
        }
    }

    function applyI18n() {
        document.documentElement.lang = lang === 'ko' ? 'ko' : 'en';
        document.getElementById('appTitle').textContent = t('appTitle');
        document.getElementById('appSubtitle').textContent = t('appSubtitle');
        document.getElementById('importPackBtn').textContent = t('importPack');
        document.getElementById('exportPackBtn').textContent = t('exportPack');
        document.getElementById('importBackupBtn').textContent = t('importBackup');
        document.getElementById('exportBackupBtn').textContent = t('exportBackup');
        const importCalBtn = document.getElementById('importCalendarBtn');
        if (importCalBtn) importCalBtn.textContent = t('importCalendar');
        document.getElementById('curriculumTabIntro').textContent = t('curriculumTabIntro');
        document.getElementById('curriculumTabPick').textContent = t('curriculumTabPick');
        document.getElementById('curriculumAddBtn').textContent = t('curriculumAddBtn');
        document.getElementById('newProjectBtn').textContent = t('newProject');
        const helpBtn = document.getElementById('companionHelpBtn');
        if (helpBtn) helpBtn.textContent = t('helpMenu');
        const calSetupBtn = document.getElementById('calSetupGuideBtn');
        if (calSetupBtn) calSetupBtn.textContent = t('calSetupGuide');
        const exportWordBtn = document.getElementById('exportWordBtn');
        if (exportWordBtn) exportWordBtn.textContent = t('exportWordBtn');
        const helpItems = {
            checklist: 'helpChecklist',
            calendar: 'helpCalendarWizard',
            curriculum: 'helpCurriculumWizard',
            syllabus: 'helpSyllabusWizard',
            tour: 'helpTour',
            guide: 'helpGuide'
        };
        Object.entries(helpItems).forEach(([action, key]) => {
            const el = document.querySelector(`#companionHelpMenu [data-help="${action}"]`);
            if (el) el.textContent = t(key);
        });
        document.getElementById('selectProjectHint').textContent = t('selectProject');
        document.getElementById('printSyllabusBtn').textContent = t('printBtn');
        document.querySelectorAll('.app-zone-segment-btn').forEach((btn) => {
            const tab = btn.dataset.tab;
            if (tab === 'curriculum') btn.textContent = t('tabCurriculum');
            if (tab === 'syllabus') btn.textContent = t('tabSyllabus');
            if (tab === 'calendar') btn.textContent = t('tabCalendar');
            if (tab === 'print') btn.textContent = t('tabPrint');
            const dragHint = t('tabDragHint');
            if (dragHint !== 'tabDragHint') {
                btn.setAttribute('title', dragHint);
            }
        });
        const calLabels = [
            ['calDisplayStartLabel', 'calShowFrom'],
            ['calDisplayEndLabel', 'calShowTo'],
            ['calFitRangeBtn', 'calFitRange'],
            ['calEventFilterLabel', 'calEventFilter'],
            ['calImportKrBtn', 'calImportKrHolidays'],
            ['calAddEventBtn', 'calAddEvent'],
            ['calEventsHeading', 'calEventsHeading'],
            ['calKrSourceHint', 'calKrHolidaySource'],
            ['calLessonBarsHint', 'calLessonBarsHint']
        ];
        calLabels.forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = t(key);
        });
        const filterSel = document.getElementById('calEventFilter');
        if (filterSel && filterSel.options.length >= 2) {
            filterSel.options[0].textContent = t('calFilterAll');
            filterSel.options[1].textContent = t('calFilterActive');
        }
        document.querySelectorAll('.lang-toggle .btn').forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.lang === lang);
        });
        const themeBtn = document.getElementById('headerThemeToggleBtn');
        if (themeBtn && window.CCPTheme) {
            themeBtn.setAttribute('title', t('themeToggleTitle'));
            themeBtn.setAttribute('aria-label', t('ariaTheme'));
        }
        const langToggle = document.querySelector('.lang-toggle');
        if (langToggle) langToggle.setAttribute('aria-label', t('ariaLanguage'));
        const toolsMenu = document.getElementById('headerToolsMenu');
        if (toolsMenu) toolsMenu.setAttribute('aria-label', t('ariaTools'));
        const curriculumSearch = document.getElementById('curriculumTabListSearch');
        if (curriculumSearch) curriculumSearch.placeholder = t('searchCurricula');
        const printHint = document.getElementById('printTabHint');
        if (printHint) printHint.textContent = t('printTabHint');
        const printOptionsTitle = document.getElementById('printOptionsTitle');
        if (printOptionsTitle) printOptionsTitle.textContent = t('teacherSyllabusPrintOptions');
        const printShowDateLabel = document.getElementById('printShowDateLabel');
        if (printShowDateLabel) printShowDateLabel.textContent = t('syllabusPrintShowDateColumn');
        const printWeekFormatLabel = document.getElementById('printWeekFormatLabel');
        if (printWeekFormatLabel) printWeekFormatLabel.textContent = t('syllabusPrintWeekFormat');
        const printWeekAbbrev = document.getElementById('printWeekFormatAbbrevOpt');
        if (printWeekAbbrev) printWeekAbbrev.textContent = t('syllabusPrintWeekFormatAbbrev');
        const printWeekIndex = document.getElementById('printWeekFormatIndexOpt');
        if (printWeekIndex) printWeekIndex.textContent = t('syllabusPrintWeekFormatIndex');
        const printDetailLabel = document.getElementById('printDetailAppendixLabel');
        if (printDetailLabel) printDetailLabel.textContent = t('printSyllabusDetailAppendix');
        const printFrame = document.getElementById('printPreviewFrame');
        if (printFrame) printFrame.setAttribute('title', t('printPreview'));
        const printSelectionTitle = document.getElementById('printSelectionTitle');
        if (printSelectionTitle) printSelectionTitle.textContent = t('printSelectionTitle');
        const printSelectionHint = document.getElementById('printSelectionHint');
        if (printSelectionHint) printSelectionHint.textContent = t('printSelectionHint');
        const printSelectAllBtn = document.getElementById('printSelectAllBtn');
        if (printSelectAllBtn) printSelectAllBtn.textContent = t('printSelectAll');
        const printSelectNoneBtn = document.getElementById('printSelectNoneBtn');
        if (printSelectNoneBtn) printSelectNoneBtn.textContent = t('printSelectNone');
        updatePrintSelectionCount();
        applyDataI18n();
    }

    function normalizeTabOrder(order) {
        const valid = order.filter((id) => DEFAULT_TAB_ORDER.includes(id));
        const missing = DEFAULT_TAB_ORDER.filter((id) => !valid.includes(id));
        return valid.length ? [...valid, ...missing] : [...DEFAULT_TAB_ORDER];
    }

    function getTabOrder() {
        try {
            const raw = localStorage.getItem(TAB_ORDER_KEY);
            if (!raw) {
                const legacyRaw = localStorage.getItem(TAB_ORDER_KEY_LEGACY);
                if (legacyRaw) {
                    const legacy = JSON.parse(legacyRaw);
                    if (Array.isArray(legacy)) {
                        if (JSON.stringify(legacy) === JSON.stringify(LEGACY_DEFAULT_TAB_ORDER)) {
                            return [...DEFAULT_TAB_ORDER];
                        }
                        return normalizeTabOrder(legacy);
                    }
                }
                return [...DEFAULT_TAB_ORDER];
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [...DEFAULT_TAB_ORDER];
            return normalizeTabOrder(parsed);
        } catch {
            return [...DEFAULT_TAB_ORDER];
        }
    }

    function saveTabOrder(order) {
        localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(order));
        localStorage.removeItem(TAB_ORDER_KEY_LEGACY);
    }

    function applyTabOrder() {
        const panel = document.getElementById('companionSegmentPanel');
        if (!panel) return;
        const order = getTabOrder();
        const buttons = [...panel.querySelectorAll('.app-zone-segment-btn')];
        const byTab = Object.fromEntries(buttons.map((btn) => [btn.dataset.tab, btn]));
        order.forEach((tabId) => {
            if (byTab[tabId]) panel.appendChild(byTab[tabId]);
        });
    }

    function reorderTabs(fromId, toId) {
        if (!fromId || !toId || fromId === toId) return;
        const order = getTabOrder();
        if (!order.includes(fromId) || !order.includes(toId)) return;
        const next = order.filter((id) => id !== fromId);
        const insertAt = next.indexOf(toId);
        if (insertAt < 0) return;
        next.splice(insertAt, 0, fromId);
        saveTabOrder(next);
        applyTabOrder();
    }

    function switchTab(tabId) {
        activeTab = tabId;
        document.querySelectorAll('.app-zone-segment-btn').forEach((btn) => {
            const on = btn.dataset.tab === tabId;
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        document.querySelectorAll('.companion-panel').forEach((panel) => {
            panel.hidden = panel.dataset.panel !== tabId;
        });
        if (tabId === 'print') {
            renderPrintProjectList();
            refreshPrintPreview();
        }
        if (tabId === 'calendar') {
            refreshCalendarPanel();
        }
    }

    function getActiveProject() {
        if (!activeProjectId) return null;
        return window.CCPCompanionStore.getProject(activeProjectId);
    }

    function countChildProjects(projectId) {
        if (!projectId) return 0;
        return window.CCPCompanionStore.getProjects()
            .filter((p) => p.parentProjectId === projectId).length;
    }

    function confirmDeleteProject(project) {
        const children = countChildProjects(project?.id);
        if (children > 0) {
            return confirm(
                t('confirmDeleteWithVariants').replace('{n}', String(children))
            );
        }
        return confirm(t('confirmDelete'));
    }

    function setDeleteControlsDisabled(disabled) {
        document.querySelectorAll('[data-delete-project-id], #deleteProjectBtn, #deleteBrokenProjectBtn')
            .forEach((btn) => {
                btn.disabled = !!disabled;
            });
    }

    function removeProjectListRow(projectId) {
        if (!projectId) return;
        const mount = document.getElementById('projectListMount');
        if (!mount) return;
        const deleteBtn = [...mount.querySelectorAll('[data-delete-project-id]')]
            .find((btn) => btn.dataset.deleteProjectId === projectId);
        const row = deleteBtn?.closest('.project-list-row');
        if (row) {
            row.remove();
            return;
        }
        const itemBtn = [...mount.querySelectorAll('[data-project-id]')]
            .find((btn) => btn.dataset.projectId === projectId);
        itemBtn?.closest('.project-list-row')?.remove();
    }

    function deleteActiveOrListedProject(projectId) {
        if (isDeletingProject) return false;
        const id = projectId || activeProjectId;
        if (!id) return false;
        const project = window.CCPCompanionStore.getProject(id);
        if (!confirmDeleteProject(project || { id })) return false;

        isDeletingProject = true;
        setDeleteControlsDisabled(true);
        removeProjectListRow(id);

        window.CCPCompanionStore.deleteProject(id);
        printSelectedProjectIds.delete(id);
        savePrintSelection();
        if (activeProjectId === id) {
            activeProjectId = window.CCPCompanionStore.getProjects()[0]?.id || null;
        }
        renderProjectList();
        setDeleteControlsDisabled(true);
        setStatus(t('statusProjectDeleted'));

        requestAnimationFrame(() => {
            try {
                renderProjectEditor();
                if (activeTab === 'calendar') refreshCalendarPanel();
                if (activeTab === 'print') {
                    renderPrintProjectList();
                    refreshPrintPreview();
                }
            } finally {
                isDeletingProject = false;
                setDeleteControlsDisabled(false);
            }
        });
        return true;
    }

    function projectListLabel(project) {
        const name = String(project?.name || '').trim() || t('defaultSyllabusName');
        const rows = Array.isArray(project?.syllabusRows) ? project.syllabusRows.length : 0;
        if (!rows && !project?.parentProjectId) {
            const childCount = countChildProjects(project?.id);
            if (childCount > 0) {
                return `${name} (${t('projectSourceShell')})`;
            }
            return `${name} (${t('projectNoScheduleYet')})`;
        }
        return name;
    }

    function autoSaveProject(options) {
        const opts = options || {};
        const project = getActiveProject();
        if (!project) return;
        const mount = document.getElementById('projectEditorMount');
        if (!mount || !mount.querySelector('#projectName')) return;
        const updated = collectProjectFromForm(project);
        if (window.CCPCompanionStore.upsertProjectDebounced) {
            window.CCPCompanionStore.upsertProjectDebounced(updated);
        } else {
            window.CCPCompanionStore.upsertProject(updated);
        }
        setStatus(t('autoSaved'));
        if (opts.refreshCalendar !== false) {
            refreshCalendarPanel();
        }
        if (opts.refreshList) {
            renderProjectList();
        }
        if (opts.scheduleChanged && Array.isArray(updated.syllabusRows) && updated.syllabusRows.length) {
            showScheduleStaleHint(true);
        }
    }

    function initBooksEditor() {
        const editor = window.CCPBooksEditor;
        if (!editor) return;
        editor.init({
            standalone: true,
            getAppData: () => window.CCPCompanionStore.getData(),
            saveData: () => {
                window.CCPCompanionStore.save(window.CCPCompanionStore.getData());
            },
            t: (k) => t(k) !== k ? t(k) : k,
            getLang: () => lang,
            canAdoptTeamCurriculumDefault: () => false,
            canManageCurriculumCatalog: () => true,
            navigateToCurriculumTab: (bookId) => {
                curriculumTabSelectedId = bookId;
                initCurriculumPanel();
                switchTab('curriculum');
            }
        });
        editor.bindEditorUI();
    }

    function refreshCurriculumList() {
        const listEl = document.getElementById('curriculumTabList');
        const editor = window.CCPBooksEditor;
        if (!listEl || !editor) return;
        const searchQuery = (document.getElementById('curriculumTabListSearch')?.value || '').trim();
        editor.renderCurriculumList(listEl, curriculumTabSelectedId, { searchQuery });
        const books = editor.discoverBooks(window.CCPCompanionStore.getData());
        if (!books.length && !searchQuery) {
            listEl.innerHTML = `<p class="module-empty-hint" style="padding:12px">${escapeHtml(t('curriculumCatalogEmpty'))}</p>`;
        }
    }

    function initCurriculumPanel() {
        refreshCurriculumList();
        const mount = document.getElementById('curriculumTabEditorMount');
        const editor = window.CCPBooksEditor;
        if (!mount || !editor) return;
        if (curriculumTabSelectedId) {
            editor.renderCurriculumEditorMount(mount, curriculumTabSelectedId, {
                idPrefix: 'curriculumTab',
                standalone: true,
                onSaved: () => {
                    refreshCurriculumList();
                    renderProjectEditor();
                },
                onDuplicated: (newId) => {
                    curriculumTabSelectedId = newId;
                    initCurriculumPanel();
                }
            });
            applyDataI18n(mount);
        } else {
            mount.innerHTML = `<p class="module-empty-hint">${escapeHtml(t('curriculumTabPick'))}</p>`;
        }
    }

    function handleAddCurriculum() {
        if (window.CCPCompanionGuides) {
            window.CCPCompanionGuides.openCurriculumWizard();
            return;
        }
        const editor = window.CCPBooksEditor;
        if (!editor) return;
        const title = window.prompt(t('curriculumAddPrompt'));
        if (title == null) return;
        const trimmed = title.trim();
        if (!trimmed) {
            alert(t('curriculumAddTitleRequired'));
            return;
        }
        const appData = window.CCPCompanionStore.getData();
        const id = editor.createCurriculum({ bookTitle: trimmed }, appData);
        window.CCPCompanionStore.save(appData);
        curriculumTabSelectedId = id;
        initCurriculumPanel();
        setStatus(t('statusSaved'));
    }

    function renderProjectList() {
        const mount = document.getElementById('projectListMount');
        if (!mount) return;
        const projects = window.CCPCompanionStore.getProjects();
        if (!projects.length) {
            mount.innerHTML = `<p class="section-hint">${escapeHtml(t('noProjects'))}</p>`;
            return;
        }
        mount.innerHTML = projects.map((p) => {
            const color = p.color || '#356a9e';
            const label = projectListLabel(p);
            return `
            <div class="project-list-row${p.id === activeProjectId ? ' is-active' : ''}">
                <button type="button" class="project-list-item${p.id === activeProjectId ? ' is-active' : ''}"
                        data-project-id="${escapeHtml(p.id)}">
                    <span class="project-list-item__swatch" style="background:${escapeHtml(color)}" aria-hidden="true"></span>
                    <span class="project-list-item__label">${escapeHtml(label)}</span>
                </button>
                <button type="button" class="project-list-delete btn btn-danger btn-small"
                        data-delete-project-id="${escapeHtml(p.id)}"
                        title="${escapeHtml(t('deleteProject'))}"
                        aria-label="${escapeHtml(t('deleteProjectAria').replace('{name}', label))}">×</button>
            </div>`;
        }).join('');
        mount.querySelectorAll('[data-project-id]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.projectId;
                if (!id) return;
                activeProjectId = id;
                renderProjectList();
                renderProjectEditor();
            });
        });
        mount.querySelectorAll('[data-delete-project-id]').forEach((btn) => {
            if (isDeletingProject) btn.disabled = true;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isDeletingProject) return;
                deleteActiveOrListedProject(btn.dataset.deleteProjectId);
            });
        });
    }

    function curriculumOptionsHtml(selectedId) {
        const editor = window.CCPBooksEditor;
        if (!editor) return '';
        const books = editor.discoverBooks(window.CCPCompanionStore.getData());
        const opts = [`<option value="">${escapeHtml(t('selectCurriculum'))}</option>`];
        books.forEach((book) => {
            const sel = book.id === selectedId ? ' selected' : '';
            opts.push(`<option value="${escapeHtml(book.id)}"${sel}>${escapeHtml(book.displayName || book.name)}</option>`);
        });
        return opts.join('');
    }

    function meetingDaysHtml(project) {
        const selected = new Set(project.meetingDays || []);
        return DAY_KEYS.map((key, i) => `
            <label class="meeting-day-chip">
                <input type="checkbox" class="meeting-day-cb" value="${i}"${selected.has(i) ? ' checked' : ''}>
                ${escapeHtml(t(key))}
            </label>
        `).join('');
    }

    function gradeOptionsHtml(selected) {
        const meta = window.CCPClassMetadata;
        const grades = meta ? meta.SCHOOL_GRADE_OPTIONS : (
            window.CCPCalendarEvents
                ? [...(window.CCPCalendarEvents.ELEMENTARY_GRADES || []), ...(window.CCPCalendarEvents.MIDDLE_SCHOOL_GRADES || [])]
                : []
        );
        const opts = [`<option value="">${escapeHtml(t('selectGrade') || '—')}</option>`];
        grades.forEach((g) => {
            const sel = g === selected ? ' selected' : '';
            opts.push(`<option value="${escapeHtml(g)}"${sel}>${escapeHtml(g)}</option>`);
        });
        return opts.join('');
    }

    function levelPresetOptionsHtml(selected) {
        const meta = window.CCPClassMetadata;
        if (!meta) return `<option value="">${escapeHtml(t('selectLevel'))}</option>`;
        const opts = [`<option value="">${escapeHtml(t('selectLevel'))}</option>`];
        meta.SIMSON_LEVEL_GROUPS.forEach((group) => {
            const label = meta.getLocalizedGroupLabel(group, t);
            const inner = group.levels.map((level) => {
                const sel = level.id === selected ? ' selected' : '';
                return `<option value="${escapeHtml(level.id)}"${sel}>${escapeHtml(level.name)}</option>`;
            }).join('');
            opts.push(`<optgroup label="${escapeHtml(label)}">${inner}</optgroup>`);
        });
        return opts.join('');
    }

    function periodOptionsHtml(selected) {
        const meta = window.CCPClassMetadata;
        const min = meta ? meta.CLASS_PERIOD_MIN : 1;
        const max = meta ? meta.CLASS_PERIOD_MAX : 7;
        const opts = [`<option value="">—</option>`];
        for (let p = min; p <= max; p += 1) {
            const sel = String(p) === String(selected) ? ' selected' : '';
            opts.push(`<option value="${p}"${sel}>${p}</option>`);
        }
        return opts.join('');
    }

    function scheduleBlockOptionsHtml(selected) {
        const meta = window.CCPClassMetadata;
        const blocks = meta ? meta.SCHEDULE_BLOCK_OPTIONS : [
            { id: 'primary', labelKey: 'classScheduleBlockPrimary', fallbackLabel: 'Primary' },
            { id: 'secondary', labelKey: 'classScheduleBlockSecondary', fallbackLabel: 'Secondary' }
        ];
        return blocks.map((block) => {
            const label = t(block.labelKey) !== block.labelKey ? t(block.labelKey) : block.fallbackLabel;
            const sel = block.id === (selected || 'primary') ? ' selected' : '';
            return `<option value="${escapeHtml(block.id)}"${sel}>${escapeHtml(label)}</option>`;
        }).join('');
    }

    function classTypeOptionsHtml(selectedId) {
        const editor = window.CCPDefaultClassEditor;
        const store = window.CCPCompanionStore;
        if (!editor || !store) {
            return `<option value="">${escapeHtml(t('classTypeCustom'))}</option>`;
        }
        const select = document.createElement('select');
        editor.populateSelect(select, {
            appData: store.getData(),
            lang
        });
        if (selectedId && !Array.from(select.options).some((opt) => opt.value === selectedId)) {
            const def = editor.getById(selectedId, store.getData());
            if (def) {
                const extra = document.createElement('option');
                extra.value = selectedId;
                extra.textContent = editor.getOptionLabel(def);
                select.appendChild(extra);
            }
        }
        if (selectedId) {
            select.value = selectedId;
        }
        return select.innerHTML;
    }

    function applyClassTypeDefaultsToProjectForm(typeId) {
        const editor = window.CCPDefaultClassEditor;
        const mount = document.getElementById('projectEditorMount');
        if (!editor || !mount || !typeId) return;
        const def = editor.getById(typeId, window.CCPCompanionStore.getData());
        if (!def) return;
        if (def.defaultTotalLessons != null) {
            const lessonsInput = mount.querySelector('#projectTotalLessons');
            if (lessonsInput) {
                lessonsInput.value = String(def.defaultTotalLessons);
            }
        }
        if (def.defaultBook) {
            const bookInput = mount.querySelector('#projectBook');
            if (bookInput && !bookInput.value.trim()) {
                bookInput.value = def.defaultBook;
            }
        }
        if (def.level) {
            const levelSel = mount.querySelector('#projectLevelPreset');
            if (levelSel && window.CCPClassMetadata?.isSimsonLevelPreset(def.level)) {
                levelSel.value = def.level;
                handleProjectLevelPresetChange();
            }
        }
        if (Array.isArray(def.defaultMeetingDays) && def.defaultMeetingDays.length) {
            const api = window.CCPScheduleLessonDates;
            const template = api
                ? api.inferScheduleTemplate(def.defaultMeetingDays)
                : 'mwf';
            const templateInput = mount.querySelector(`input[name="classScheduleTemplate"][value="${template}"]`)
                || mount.querySelector('input[name="classScheduleTemplate"][value="mwf"]');
            if (templateInput) {
                templateInput.checked = true;
            }
            if (template === 'custom') {
                mount.querySelectorAll('.meeting-day-cb').forEach((cb) => {
                    cb.checked = def.defaultMeetingDays.includes(parseInt(cb.value, 10));
                });
            }
            refreshScheduleVariantsHint();
        }
        if (def.scheduleModel) {
            const scheduleModelInput = mount.querySelector('#projectScheduleModel');
            if (scheduleModelInput) {
                scheduleModelInput.value = def.scheduleModel;
            }
        }
        if (def.defaultCompressionMode) {
            const radio = mount.querySelector(`input[name="compressionMode"][value="${def.defaultCompressionMode}"]`);
            if (radio) radio.checked = true;
        }
        if (def.scheduleModel === 'debateMonthly' && def.defaultTotalLessons) {
            const lessonsInput = mount.querySelector('#projectTotalLessons');
            if (lessonsInput) lessonsInput.value = String(def.defaultTotalLessons);
        }
    }

    function handleProjectLevelPresetChange() {
        const mount = document.getElementById('projectEditorMount');
        const meta = window.CCPClassMetadata;
        if (!mount || !meta) return;
        const levelSel = mount.querySelector('#projectLevelPreset');
        const gradeSel = mount.querySelector('#projectGrade');
        if (!levelSel || !gradeSel) return;
        const def = meta.getSimsonLevelById(levelSel.value);
        if (def && def.grade) {
            gradeSel.value = def.grade;
        }
    }

    function meetingPresetsHtml() {
        return MEETING_PRESETS.map((p) => `
            <button type="button" class="btn btn-outline btn-small meeting-preset-btn" data-days="${p.days.join(',')}">${escapeHtml(t(p.key))}</button>
        `).join('');
    }

    function resolveProjectScheduleTemplate(project) {
        const api = window.CCPScheduleLessonDates;
        if (!project) return 'mwf';
        return project.classScheduleTemplate || (api ? api.inferScheduleTemplate(project.meetingDays) : 'mwf');
    }

    function resolveProjectMeetingsPerWeek(project) {
        const api = window.CCPScheduleLessonDates;
        if (!project) return 2;
        if (project.meetingsPerWeek === 1 || project.meetingsPerWeek === 2) {
            return project.meetingsPerWeek;
        }
        return api ? api.inferMeetingsPerWeek(project) : 2;
    }

    function getScheduleVariantsPreview(project) {
        const api = window.CCPScheduleLessonDates;
        if (!api || !project) return [];
        return api.getScheduleVariantsForProject(project);
    }

    function scheduleVariantsHintHtml(project) {
        const api = window.CCPScheduleLessonDates;
        const days = api ? api.formatMeetingDaysShort(project.meetingDays || []) : '';
        if (!days) {
            return `<p class="section-hint" id="scheduleVariantsHint">${escapeHtml(t('duplicateHint'))}</p>`;
        }
        const text = t('scheduleVariantsHint').replace('{days}', days);
        return `<p class="section-hint" id="scheduleVariantsHint">${escapeHtml(text)}</p>`;
    }

    function refreshScheduleVariantsHint() {
        const mount = document.getElementById('projectEditorMount');
        const hint = mount?.querySelector('#scheduleVariantsHint');
        if (!hint) return;
        const meetingDays = [];
        mount.querySelectorAll('.meeting-day-cb:checked').forEach((cb) => {
            meetingDays.push(parseInt(cb.value, 10));
        });
        const api = window.CCPScheduleLessonDates;
        const days = api ? api.formatMeetingDaysShort(meetingDays) : '';
        hint.hidden = false;
        hint.textContent = days
            ? t('scheduleVariantsHint').replace('{days}', days)
            : t('duplicateHint');
    }

    function updateMeetingDayCheckboxes(days) {
        const mount = document.getElementById('projectEditorMount');
        if (!mount) return;
        const selected = new Set((days || []).map(Number));
        mount.querySelectorAll('.meeting-day-cb').forEach((cb) => {
            cb.checked = selected.has(parseInt(cb.value, 10));
        });
    }

    function syncMeetingDaysFromTemplateControls() {
        const mount = document.getElementById('projectEditorMount');
        const api = window.CCPScheduleLessonDates;
        if (!mount || !api) return [];
        const classScheduleTemplate = mount.querySelector('input[name="classScheduleTemplate"]:checked')?.value || 'mwf';
        const meetingsPerWeek = parseInt(mount.querySelector('input[name="meetingsPerWeek"]:checked')?.value, 10) || 2;
        const current = [];
        mount.querySelectorAll('.meeting-day-cb:checked').forEach((cb) => {
            current.push(parseInt(cb.value, 10));
        });
        const synced = api.defaultMeetingDaysForSchedule
            ? api.defaultMeetingDaysForSchedule(classScheduleTemplate, meetingsPerWeek, current)
            : api.syncTemplateMeetingDays({
                classScheduleTemplate,
                meetingsPerWeek,
                meetingDays: current
            });
        updateMeetingDayCheckboxes(synced);
        return synced;
    }

    function showScheduleStaleHint(show) {
        const el = document.getElementById('scheduleStaleHint');
        if (!el) return;
        el.hidden = !show;
        if (show) el.textContent = t('scheduleChangedHint');
    }

    function customMeetingDaysHtml(project) {
        return `
            <div class="form-group meeting-days-editor">
                <label>${escapeHtml(t('meetingDays'))}</label>
                <div class="meeting-days-row">${meetingDaysHtml(project)}</div>
            </div>`;
    }

    function scheduleTemplateEditorHtml(project) {
        if (project.parentProjectId) {
            const api = window.CCPScheduleLessonDates;
            const label = api ? api.formatMeetingDaysShort(project.meetingDays || []) : '';
            const freq = resolveProjectMeetingsPerWeek(project) === 1
                ? t('meetingsPerWeek1')
                : t('meetingsPerWeek2');
            return `<p class="section-hint">${escapeHtml(
                t('variantScheduleSummary').replace('{days}', label).replace('{freq}', freq)
            )}</p>`;
        }

        const template = resolveProjectScheduleTemplate(project);
        const meetingsPerWeek = resolveProjectMeetingsPerWeek(project);
        return `
            <div class="form-group">
                <label>${escapeHtml(t('classScheduleTemplate'))}</label>
                <div class="schedule-template-row meeting-presets">
                    <label class="meeting-day-chip">
                        <input type="radio" name="classScheduleTemplate" value="mwf"${template === 'mwf' ? ' checked' : ''}>
                        ${escapeHtml(t('scheduleTemplateMwf'))}
                    </label>
                    <label class="meeting-day-chip">
                        <input type="radio" name="classScheduleTemplate" value="tt"${template === 'tt' ? ' checked' : ''}>
                        ${escapeHtml(t('scheduleTemplateTt'))}
                    </label>
                </div>
            </div>
            <div class="form-group">
                <label>${escapeHtml(t('meetingsPerWeek'))}</label>
                <div class="meetings-per-week-row meeting-presets">
                    <label class="meeting-day-chip">
                        <input type="radio" name="meetingsPerWeek" value="1"${meetingsPerWeek === 1 ? ' checked' : ''}>
                        ${escapeHtml(t('meetingsPerWeek1'))}
                    </label>
                    <label class="meeting-day-chip">
                        <input type="radio" name="meetingsPerWeek" value="2"${meetingsPerWeek === 2 ? ' checked' : ''}>
                        ${escapeHtml(t('meetingsPerWeek2'))}
                    </label>
                </div>
            </div>
            ${customMeetingDaysHtml(project)}
            ${scheduleVariantsHintHtml(project)}
            <p class="section-hint schedule-stale-hint" id="scheduleStaleHint" hidden></p>`;
    }

    function runScheduleGeneration(project) {
        const engine = window.CCPCompanionSyllabus;
        if (!engine || !project) return null;
        let prepared = engine.prepareDebateProjectForGeneration
            ? engine.prepareDebateProjectForGeneration(project)
            : project;
        const datesApi = window.CCPScheduleLessonDates;
        const holidayFn = (ds) => window.CCPCalendarEvents?.hasBlockingEventOnDate(
            ds,
            prepared,
            window.CCPCompanionStore.getData()
        );
        if (datesApi && datesApi.classUsesDebateCompression
            && datesApi.classUsesDebateCompression(engine.projectToClassShape(prepared, window.CCPCompanionStore.getAppDataShape()))) {
            let classShape = engine.projectToClassShape(prepared, window.CCPCompanionStore.getAppDataShape());
            let gap = datesApi.getClassScheduleGapStatus(classShape, { isHoliday: holidayFn });
            if (gap.incomplete && prepared.compressionMode === 'autoWhenNeeded') {
                const proposal = datesApi.proposeScheduleAdjustments(classShape, { isHoliday: holidayFn });
                if (proposal.skipped.length || proposal.merges.length) {
                    const msg = t('debateAutoAdjustConfirm')
                        .replace('{merges}', proposal.merges.join(', ') || '—')
                        .replace('{skips}', proposal.skipped.join(', ') || '—');
                    if (confirm(msg)) {
                        prepared = {
                            ...prepared,
                            compressionMerges: proposal.merges,
                            skippedLessons: proposal.skipped
                        };
                        classShape = engine.projectToClassShape(prepared, window.CCPCompanionStore.getAppDataShape());
                        gap = datesApi.getClassScheduleGapStatus(classShape, { isHoliday: holidayFn });
                    }
                }
            }
            if (gap.incomplete && (gap.incompletePeriods || []).length) {
                const months = gap.incompletePeriods.map((p) => {
                    const mk = p.monthKey || (p.startDate || '').slice(0, 7);
                    const book = p.book ? ` (${p.book})` : '';
                    return `• ${mk}${book} — ${p.eligibleCount}/${p.totalGroups} meetings`;
                }).join('\n');
                const msg = t('debateIncompletePeriodsConfirm').replace('{months}', months || '—');
                if (!confirm(msg)) {
                    setStatus(t('debateCycleStatusIncomplete'), true);
                    return null;
                }
            }
        }
        if (Array.isArray(prepared.syllabusRows) && prepared.syllabusRows.length) {
            if (!confirm(t('regenerateScheduleConfirm'))) {
                return null;
            }
        }
        const rows = engine.generateScheduleRows(prepared) || [];
        const updated = { ...prepared, syllabusRows: rows };
        window.CCPCompanionStore.upsertProject(updated);
        activeProjectId = updated.id;
        if (isPrintableProject(updated)) {
            printSelectedProjectIds.add(updated.id);
            savePrintSelection();
        }
        renderProjectList();
        renderProjectEditor();
        refreshCalendarPanel();
        return { ok: true, isMultiVariant: false, variants: [{ project: updated, rows, label: updated.name }] };
    }

    function syllabusTableHtml(rows) {
        if (!rows.length) {
            return `<p class="section-hint">${escapeHtml(t('noRows'))}</p>`;
        }
        const body = rows.map((row, idx) => `
            <tr data-row-idx="${idx}">
                <td class="syllabus-col-week">${escapeHtml(row.weekLabel || '')}</td>
                <td class="syllabus-col-num">${row.sessionNumber ? escapeHtml(String(row.sessionNumber)) : ''}</td>
                <td><textarea class="syllabus-ed-title" rows="2">${escapeHtml(row.planTitle || '')}</textarea></td>
                <td><textarea class="syllabus-ed-detail" rows="3">${escapeHtml(row.planDetail || '')}</textarea></td>
                <td><textarea class="syllabus-ed-note" rows="2">${escapeHtml(row.note || '')}</textarea></td>
            </tr>
        `).join('');
        return `
            <div class="syllabus-table-editor-wrap">
                <table class="syllabus-editor-table">
                    <thead>
                        <tr>
                            <th>${escapeHtml(t('colWeek'))}</th>
                            <th>${escapeHtml(t('colClass'))}</th>
                            <th>${escapeHtml(t('colPlan'))}</th>
                            <th>${escapeHtml(t('colPages'))}</th>
                            <th>${escapeHtml(t('colNote'))}</th>
                        </tr>
                    </thead>
                    <tbody id="syllabusTableBody">${body}</tbody>
                </table>
            </div>`;
    }

    function collectProjectFromForm(project) {
        const mount = document.getElementById('projectEditorMount');
        if (!mount || !project) return project;
        const name = mount.querySelector('#projectName')?.value?.trim() || project.name;
        const curriculumId = mount.querySelector('#projectCurriculum')?.value || '';
        const grade = mount.querySelector('#projectGrade')?.value || '';
        const levelPreset = mount.querySelector('#projectLevelPreset')?.value || '';
        const levelCustom = mount.querySelector('#projectLevelCustom')?.value?.trim() || '';
        const classTypeId = mount.querySelector('#projectClassType')?.value || '';
        const periodRaw = mount.querySelector('#projectPeriod')?.value;
        const period = periodRaw === '' || periodRaw == null ? null : parseInt(periodRaw, 10);
        const scheduleBlock = mount.querySelector('#projectScheduleBlock')?.value || 'primary';
        const book = mount.querySelector('#projectBook')?.value?.trim() || '';
        const totalLessons = parseInt(mount.querySelector('#projectTotalLessons')?.value, 10) || project.totalLessons || 20;
        const scheduleModel = mount.querySelector('#projectScheduleModel')?.value || project.scheduleModel || 'sequentialTerm';
        const startDate = mount.querySelector('#projectStartDate')?.value || '';
        const useAutoTermEnd = mount.querySelector('#projectEndAuto')?.checked !== false;
        const termCalendarMonths = parseInt(mount.querySelector('#projectTermMonths')?.value, 10) || 3;
        const endDate = mount.querySelector('#projectEndDate')?.value || '';
        const termEndMode = mount.querySelector('#projectTermEndMode')?.value || 'calendarMonths';
        const syllabusGeneralNotes = mount.querySelector('#projectGeneralNotes')?.value || '';
        const color = mount.querySelector('#projectColorValue')?.value || project.color || '';
        const textColor = project.textColor || '';
        let classScheduleTemplate = project.classScheduleTemplate || 'mwf';
        let meetingsPerWeek = resolveProjectMeetingsPerWeek(project);
        let meetingDays = Array.isArray(project.meetingDays) ? [...project.meetingDays] : [];

        if (!project.parentProjectId) {
            classScheduleTemplate = mount.querySelector('input[name="classScheduleTemplate"]:checked')?.value
                || classScheduleTemplate;
            const mpwRaw = parseInt(mount.querySelector('input[name="meetingsPerWeek"]:checked')?.value, 10);
            meetingsPerWeek = mpwRaw === 1 ? 1 : 2;
            meetingDays = [];
            mount.querySelectorAll('.meeting-day-cb:checked').forEach((cb) => {
                meetingDays.push(parseInt(cb.value, 10));
            });
            const api = window.CCPScheduleLessonDates;
            if (api && !meetingDays.length) {
                meetingDays = api.defaultMeetingDaysForSchedule
                    ? api.defaultMeetingDaysForSchedule(classScheduleTemplate, meetingsPerWeek, [])
                    : api.syncTemplateMeetingDays({
                        classScheduleTemplate,
                        meetingsPerWeek,
                        meetingDays: []
                    });
            } else if (api) {
                meetingDays = api.normalizeMeetingDaysArray(meetingDays);
            }
        }

        const syllabusRows = collectRowsFromTable();
        const debateFields = collectDebateFieldsFromForm(mount, project);
        const updated = {
            ...project,
            name,
            curriculumId,
            grade,
            levelPreset,
            levelCustom,
            sectionLevel: levelPreset,
            classTypeId,
            period: Number.isFinite(period) ? period : null,
            scheduleBlock,
            book,
            totalLessons,
            scheduleModel,
            startDate,
            useAutoTermEnd,
            termCalendarMonths,
            endDate,
            termEndMode,
            classScheduleTemplate,
            meetingsPerWeek,
            meetingDays,
            syllabusGeneralNotes,
            color,
            textColor,
            syllabusRows,
            ...debateFields
        };
        updated.endDate = window.CCPCompanionSyllabus.syncProjectEndDate(updated);
        return updated;
    }

    function collectRowsFromTable() {
        const tbody = document.getElementById('syllabusTableBody');
        if (!tbody) return getActiveProject()?.syllabusRows || [];
        const project = getActiveProject();
        const existing = project?.syllabusRows || [];
        return Array.from(tbody.querySelectorAll('tr')).map((tr, idx) => {
            const base = existing[idx] || { id: window.CCPCompanionStore.generateId('row'), kind: 'lesson', source: 'manual' };
            return {
                ...base,
                weekLabel: tr.querySelector('.syllabus-col-week')?.textContent?.trim() || base.weekLabel,
                sessionNumber: parseInt(tr.querySelector('.syllabus-col-num')?.textContent, 10) || base.sessionNumber,
                planTitle: tr.querySelector('.syllabus-ed-title')?.value || '',
                planDetail: tr.querySelector('.syllabus-ed-detail')?.value || '',
                note: tr.querySelector('.syllabus-ed-note')?.value || ''
            };
        });
    }

    function isDebateProject(project) {
        if (!project) return false;
        if (project.scheduleModel === 'debateMonthly') return true;
        const editor = window.CCPDefaultClassEditor;
        if (!editor || !project.classTypeId) return false;
        const def = editor.getById(project.classTypeId, window.CCPCompanionStore.getData());
        return def && def.scheduleModel === 'debateMonthly';
    }

    function scheduleWarningsHtml(project) {
        const engine = window.CCPCompanionSyllabus;
        if (!engine || !engine.getScheduleWarnings) return '';
        const warnings = engine.getScheduleWarnings(project);
        if (!warnings.length) return '';
        const allInfo = warnings.every((w) => w.level === 'info');
        const boxClass = allInfo
            ? 'companion-schedule-warnings companion-schedule-warnings--info'
            : 'companion-schedule-warnings';
        const items = warnings.map((w) => {
            const level = w.level === 'info' ? ' companion-schedule-warnings__item--info' : '';
            return `<li class="companion-schedule-warnings__item${level}">${escapeHtml(w.message)}</li>`;
        }).join('');
        return `<div class="${boxClass}" role="status"><ul>${items}</ul></div>`;
    }

    function debateCycleStatusLabel(status) {
        if (status === 'incomplete') return t('debateCycleStatusIncomplete');
        if (status === 'compressed') return t('debateCycleStatusCompressed');
        return t('debateCycleStatusComplete');
    }

    function debateCycleCoverageHtml(project) {
        const engine = window.CCPCompanionSyllabus;
        const datesApi = window.CCPScheduleLessonDates;
        if (!engine || !datesApi || !datesApi.getClassScheduleGapStatus) {
            return '';
        }
        const classShape = engine.projectToClassShape(project, window.CCPCompanionStore.getAppDataShape());
        const gap = datesApi.getClassScheduleGapStatus(classShape, {
            isHoliday: (ds) => window.CCPCalendarEvents?.hasBlockingEventOnDate(
                ds,
                project,
                window.CCPCompanionStore.getData()
            )
        });
        const statuses = gap.periodStatuses || [];
        let body;
        if (!statuses.length) {
            body = `<p class="section-hint">${escapeHtml(t('debateCycleNoPeriods'))}</p>`;
        } else {
            const rows = statuses.map((p) => {
                const periodLabel = escapeHtml(
                    [p.monthKey || (p.startDate || '').slice(0, 7), p.book].filter(Boolean).join(' · ') || '—'
                );
                const statusClass = `debate-cycle-status debate-cycle-status--${escapeHtml(p.status || 'complete')}`;
                return `<tr>
                    <td>${periodLabel}</td>
                    <td>${escapeHtml(String(p.eligibleCount ?? 0))}</td>
                    <td><span class="${statusClass}">${escapeHtml(debateCycleStatusLabel(p.status))}</span></td>
                </tr>`;
            }).join('');
            body = `<table class="debate-cycle-coverage-table">
                <thead><tr>
                    <th>${escapeHtml(t('debateCycleColPeriod'))}</th>
                    <th>${escapeHtml(t('debateCycleColMeetings'))}</th>
                    <th>${escapeHtml(t('debateCycleColStatus'))}</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
        }
        return `
            <details class="debate-schedule-section" open>
                <summary>${escapeHtml(t('debateCycleCoverageHeading'))}</summary>
                <p class="section-hint">${escapeHtml(t('debateCycleCoverageHint'))}</p>
                ${body}
            </details>`;
    }

    function debateBookPeriodsHtml(project) {
        const periods = Array.isArray(project.debateBookPeriods) ? project.debateBookPeriods : [];
        const rows = periods.map((p, idx) => `
            <tr data-period-idx="${idx}" data-period-id="${escapeHtml(p.id || '')}">
                <td><input type="date" class="debate-period-start" value="${escapeHtml(p.startDate || '')}"></td>
                <td><input type="text" class="debate-period-book" value="${escapeHtml(p.book || '')}" placeholder="${escapeHtml(t('debatePeriodBookPlaceholder'))}"></td>
                <td><button type="button" class="btn btn-outline btn-small debate-period-remove" data-idx="${idx}">${escapeHtml(t('debatePeriodRemove'))}</button></td>
            </tr>`).join('');
        return `
            <details class="debate-schedule-section" open>
                <summary>${escapeHtml(t('debateBookPeriodsHeading'))}</summary>
                <p class="section-hint">${escapeHtml(t('debateBookPeriodsHint'))}</p>
                <div class="debate-periods-toolbar">
                    <button type="button" class="btn btn-outline btn-small" id="debateFillPeriodsBtn">${escapeHtml(t('debateFillPeriodsFromTerm'))}</button>
                    <button type="button" class="btn btn-outline btn-small" id="debateAddPeriodBtn">${escapeHtml(t('debateAddPeriod'))}</button>
                </div>
                <table class="debate-periods-table">
                    <thead><tr>
                        <th>${escapeHtml(t('debatePeriodStart'))}</th>
                        <th>${escapeHtml(t('debatePeriodBook'))}</th>
                        <th></th>
                    </tr></thead>
                    <tbody id="debatePeriodsBody">${rows}</tbody>
                </table>
            </details>`;
    }

    function compressionModeHtml(project) {
        const mode = project.compressionMode || 'autoWhenNeeded';
        return `
            <details class="debate-schedule-section" open>
                <summary>${escapeHtml(t('compressionModeHeading'))}</summary>
                <p class="section-hint">${escapeHtml(t('debateCompressionHint'))}</p>
                <div class="compression-mode-radios">
                    <label><input type="radio" name="compressionMode" value="autoWhenNeeded"${mode === 'autoWhenNeeded' || !mode ? ' checked' : ''}> ${escapeHtml(t('compressionModeAuto'))}</label>
                    <label><input type="radio" name="compressionMode" value="manual"${mode === 'manual' ? ' checked' : ''}> ${escapeHtml(t('compressionModeManual'))}</label>
                    <label><input type="radio" name="compressionMode" value="manualPerMonth"${mode === 'manualPerMonth' ? ' checked' : ''}> ${escapeHtml(t('compressionModeManualPerMonth'))}</label>
                </div>
            </details>`;
    }

    function scheduleAdjustmentHtml(project) {
        const total = Math.min(Math.max(parseInt(project.totalLessons, 10) || 4, 1), 12);
        const skipped = new Set(project.skippedLessons || []);
        const merges = new Set(project.compressionMerges || []);
        let rows = '';
        for (let day = 1; day <= total; day += 1) {
            const canCombine = day < total;
            rows += `<tr>
                <td>${escapeHtml(t('debateDayLabel').replace('{n}', String(day)))}</td>
                <td><label><input type="checkbox" class="schedule-skip-lesson" data-day="${day}"${skipped.has(day) ? ' checked' : ''}> ${escapeHtml(t('scheduleSkipLesson'))}</label></td>
                <td>${canCombine ? `<label><input type="checkbox" class="schedule-combine-lesson" data-start="${day}"${merges.has(day) ? ' checked' : ''}> ${escapeHtml(t('scheduleCombineWithNext'))}</label>` : ''}</td>
            </tr>`;
        }
        return `
            <details class="debate-schedule-section" open>
                <summary>${escapeHtml(t('scheduleAdjustmentHeading'))}</summary>
                <p class="section-hint">${escapeHtml(t('scheduleAdjustmentHint'))}</p>
                <table class="schedule-adjustment-table">
                    <thead><tr>
                        <th>${escapeHtml(t('scheduleAdjustmentDay'))}</th>
                        <th>${escapeHtml(t('scheduleAdjustmentSkip'))}</th>
                        <th>${escapeHtml(t('scheduleAdjustmentCombine'))}</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </details>`;
    }

    function debateSchedulePanelHtml(project) {
        if (!isDebateProject(project)) return '';
        return `
            <div class="debate-schedule-panel" id="debateSchedulePanel">
                ${scheduleWarningsHtml(project)}
                ${debateCycleCoverageHtml(project)}
                ${debateBookPeriodsHtml(project)}
                ${compressionModeHtml(project)}
                ${scheduleAdjustmentHtml(project)}
            </div>`;
    }

    function collectDebateFieldsFromForm(mount, project) {
        const out = {
            debateBookPeriods: [],
            compressionMode: 'autoWhenNeeded',
            skippedLessons: [],
            compressionMerges: []
        };
        if (!mount) return out;
        out.compressionMode = mount.querySelector('input[name="compressionMode"]:checked')?.value || project.compressionMode || 'autoWhenNeeded';
        mount.querySelectorAll('#debatePeriodsBody tr').forEach((tr) => {
            const startDate = tr.querySelector('.debate-period-start')?.value || '';
            const book = tr.querySelector('.debate-period-book')?.value?.trim() || '';
            if (startDate) {
                const periodId = tr.dataset.periodId || window.CCPCompanionStore.generateId('dbp');
                out.debateBookPeriods.push({
                    id: periodId,
                    startDate,
                    book
                });
            }
        });
        mount.querySelectorAll('.schedule-skip-lesson:checked').forEach((cb) => {
            out.skippedLessons.push(parseInt(cb.dataset.day, 10));
        });
        mount.querySelectorAll('.schedule-combine-lesson:checked').forEach((cb) => {
            out.compressionMerges.push(parseInt(cb.dataset.start, 10));
        });
        return out;
    }

    function applyCurriculumDebateDefaults(curriculumId) {
        const editor = window.CCPBooksEditor;
        const mount = document.getElementById('projectEditorMount');
        if (!editor || !mount || !curriculumId) return;
        if (!editor.isDebateCurriculum(curriculumId)) return;
        const level = mount.querySelector('#projectLevelPreset')?.value
            || mount.querySelector('#projectLevelCustom')?.value?.trim()
            || '';
        const defaults = editor.buildDebateMergedDefaults(level, window.CCPCompanionStore.getData(), curriculumId);
        if (!defaults) return;
        const lessonsInput = mount.querySelector('#projectTotalLessons');
        if (lessonsInput && defaults.defaultTotalLessons) {
            lessonsInput.value = String(defaults.defaultTotalLessons);
        }
        const scheduleModelInput = mount.querySelector('#projectScheduleModel');
        if (scheduleModelInput && defaults.scheduleModel) {
            scheduleModelInput.value = defaults.scheduleModel;
        }
        const bookInput = mount.querySelector('#projectBook');
        if (bookInput && defaults.defaultBook && !bookInput.value.trim()) {
            bookInput.value = defaults.defaultBook;
        }
        const autoRadio = mount.querySelector('input[name="compressionMode"][value="autoWhenNeeded"]');
        if (autoRadio && defaults.defaultCompressionMode === 'autoWhenNeeded') {
            autoRadio.checked = true;
        }
    }

    function applyDebateAutoFillAndPersist(project) {
        const engine = window.CCPCompanionSyllabus;
        const store = window.CCPCompanionStore;
        if (!engine?.maybeAutoFillDebateBookPeriods || !store) return false;
        const p = project || collectProjectFromForm(getActiveProject());
        if (!p) return false;
        const { project: filled, filled: didFill } = engine.maybeAutoFillDebateBookPeriods(p);
        if (!didFill) return false;
        store.upsertProject(filled);
        renderProjectEditor({ skipDebateAutoFill: true });
        return true;
    }

    function renderProjectEditor(options = {}) {
        const mount = document.getElementById('projectEditorMount');
        let project = getActiveProject();
        if (!mount) return;
        if (!project) {
            mount.innerHTML = `<p class="module-empty-hint">${escapeHtml(t('selectProject'))}</p>`;
            return;
        }
        try {
            if (!options.skipDebateAutoFill) {
                const engine = window.CCPCompanionSyllabus;
                if (engine?.maybeAutoFillDebateBookPeriods) {
                    const { project: filled, filled: didFill } = engine.maybeAutoFillDebateBookPeriods(project);
                    if (didFill) {
                        window.CCPCompanionStore.upsertProject(filled);
                        renderProjectEditor({ skipDebateAutoFill: true });
                        return;
                    }
                }
            }
            const endDate = window.CCPCompanionSyllabus
                ? window.CCPCompanionSyllabus.syncProjectEndDate(project)
                : (project.endDate || '');
            const rows = Array.isArray(project.syllabusRows) ? project.syllabusRows : [];
            const meta = window.CCPClassMetadata;
            const levelPreset = meta
                ? meta.resolveLevelPresetForForm(project)
                : (project.levelPreset || '');
            const levelCustom = meta
                ? meta.resolveLevelCustomForForm(project)
                : (project.levelCustom || '');
            mount.innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    <label for="projectName">${escapeHtml(t('projectName'))}</label>
                    <input type="text" id="projectName" value="${escapeHtml(project.name || '')}">
                </div>
                <div class="form-group">
                    <label for="projectCurriculum">${escapeHtml(t('curriculum'))}</label>
                    <select id="projectCurriculum">${curriculumOptionsHtml(project.curriculumId)}</select>
                </div>
                <div class="form-group">
                    <label for="projectClassType">${escapeHtml(t('classTypeLabel'))}</label>
                    <select id="projectClassType">${classTypeOptionsHtml(project.classTypeId || '')}</select>
                </div>
                <div class="form-group">
                    <label for="projectPeriod">${escapeHtml(t('classPeriod'))}</label>
                    <select id="projectPeriod">${periodOptionsHtml(project.period)}</select>
                </div>
                <div class="form-group">
                    <label for="projectLevelPreset">${escapeHtml(t('classLevelPreset'))}</label>
                    <select id="projectLevelPreset">${levelPresetOptionsHtml(levelPreset)}</select>
                </div>
                <div class="form-group">
                    <label for="projectLevelCustom">${escapeHtml(t('classLevelCustom'))}</label>
                    <input type="text" id="projectLevelCustom" value="${escapeHtml(levelCustom)}" placeholder="${escapeHtml(t('classLevelCustom'))}">
                </div>
                <div class="form-group">
                    <label for="projectGrade">${escapeHtml(t('grade'))}</label>
                    <select id="projectGrade">${gradeOptionsHtml(project.grade || '')}</select>
                </div>
                <div class="form-group">
                    <label for="projectScheduleBlock">${escapeHtml(t('classScheduleBlock'))}</label>
                    <select id="projectScheduleBlock">${scheduleBlockOptionsHtml(project.scheduleBlock || 'primary')}</select>
                </div>
                <div class="form-group">
                    <label for="projectBook">${escapeHtml(t('defaultBook'))}</label>
                    <input type="text" id="projectBook" value="${escapeHtml(project.book || '')}" placeholder="${escapeHtml(t('bookPlaceholder'))}">
                </div>
                <div class="form-group">
                    <label for="projectTotalLessons">${escapeHtml(t('totalLessons') || 'Total lessons')}</label>
                    <input type="number" id="projectTotalLessons" min="1" max="200" value="${project.totalLessons || 20}">
                    <input type="hidden" id="projectScheduleModel" value="${escapeHtml(project.scheduleModel || 'sequentialTerm')}">
                </div>
                <div class="form-group">
                    <label>${escapeHtml(t('projectColorLabel'))}</label>
                    <input type="hidden" id="projectColorValue" value="${escapeHtml(project.color || '#356a9e')}">
                    <div id="projectColorPalette" class="class-color-palette-host"></div>
                    <div id="projectColorPreview" class="class-color-preview-row"></div>
                </div>
                <div class="form-group">
                    <label for="projectStartDate">${escapeHtml(t('startDate'))}</label>
                    <input type="date" id="projectStartDate" value="${escapeHtml(project.startDate || '')}">
                </div>
                <div class="form-group">
                    <label>${escapeHtml(t('endMode'))}</label>
                    <label><input type="radio" name="endMode" id="projectEndAuto" value="auto"${project.useAutoTermEnd !== false ? ' checked' : ''}> ${escapeHtml(t('endAuto'))}</label>
                    <label><input type="radio" name="endMode" id="projectEndFixed" value="fixed"${project.useAutoTermEnd === false ? ' checked' : ''}> ${escapeHtml(t('endFixed'))}</label>
                </div>
                <div class="form-group" id="termMonthsGroup">
                    <label for="projectTermMonths">${escapeHtml(t('termMonths'))}</label>
                    <input type="number" id="projectTermMonths" min="1" max="24" value="${project.termCalendarMonths || 3}">
                    <select id="projectTermEndMode" class="field-select" style="margin-top:6px">
                        <option value="calendarMonths"${project.termEndMode !== 'exactMonths' ? ' selected' : ''}>${escapeHtml(t('termEndModeCalendarMonths'))}</option>
                        <option value="exactMonths"${project.termEndMode === 'exactMonths' ? ' selected' : ''}>${escapeHtml(t('termEndModeExactMonths'))}</option>
                    </select>
                </div>
                <div class="form-group" id="endDateGroup">
                    <label for="projectEndDate">${escapeHtml(t('endDate'))}</label>
                    <input type="date" id="projectEndDate" value="${escapeHtml(endDate)}"${project.useAutoTermEnd !== false ? ' readonly' : ''}>
                </div>
            </div>
            <div class="form-group">
                <label>${escapeHtml(t('classSchedule'))}</label>
                ${scheduleTemplateEditorHtml(project)}
            </div>
            ${debateSchedulePanelHtml(project)}
            <p class="section-hint">${escapeHtml(t('openCalendarHint'))}</p>
            <div class="form-group">
                <label for="projectGeneralNotes">${escapeHtml(t('generalNotes'))}</label>
                <textarea id="projectGeneralNotes" rows="3">${escapeHtml(project.syllabusGeneralNotes || '')}</textarea>
            </div>
            <div class="syllabus-actions">
                <button type="button" class="btn btn-primary" id="generateScheduleBtn">${escapeHtml(t('generateSchedule'))}</button>
                <button type="button" class="btn btn-outline" id="applyCurriculumBtn">${escapeHtml(t('applyCurriculum'))}</button>
                <button type="button" class="btn btn-outline" id="duplicateProjectBtn">${escapeHtml(t('duplicateProject'))}</button>
                <button type="button" class="btn btn-outline" id="saveProjectBtn">${escapeHtml(t('saveProject'))}</button>
                <button type="button" class="btn btn-danger btn-small" id="deleteProjectBtn">${escapeHtml(t('deleteProject'))}</button>
            </div>
            ${syllabusTableHtml(rows)}
        `;
            bindProjectColorPicker(project);
            bindProjectEditorEvents();
            syncEndModeUi();
        } catch (err) {
            console.error('Failed to render syllabus editor', err);
            // Keep a usable editor shell even if helpers fail — do not strand the user.
            try {
                mount.innerHTML = `
                <div class="form-grid">
                    <div class="form-group">
                        <label for="projectName">${escapeHtml(t('projectName'))}</label>
                        <input type="text" id="projectName" value="${escapeHtml(project.name || '')}">
                    </div>
                    <div class="form-group">
                        <label for="projectStartDate">${escapeHtml(t('startDate'))}</label>
                        <input type="date" id="projectStartDate" value="${escapeHtml(project.startDate || '')}">
                    </div>
                    <div class="form-group">
                        <label for="projectEndDate">${escapeHtml(t('endDate'))}</label>
                        <input type="date" id="projectEndDate" value="${escapeHtml(project.endDate || '')}">
                    </div>
                </div>
                <p class="section-hint">${escapeHtml(t('projectEditorPartialLoad'))}</p>
                <div class="syllabus-actions">
                    <button type="button" class="btn btn-outline" id="saveProjectBtn">${escapeHtml(t('saveProject'))}</button>
                    <button type="button" class="btn btn-danger btn-small" id="deleteProjectBtn">${escapeHtml(t('deleteProject'))}</button>
                </div>`;
                mount.querySelector('#saveProjectBtn')?.addEventListener('click', () => {
                    const name = mount.querySelector('#projectName')?.value?.trim() || project.name;
                    const startDate = mount.querySelector('#projectStartDate')?.value || project.startDate || '';
                    const endDate = mount.querySelector('#projectEndDate')?.value || project.endDate || '';
                    window.CCPCompanionStore.upsertProject({
                        ...project,
                        name,
                        startDate,
                        endDate,
                        useAutoTermEnd: false
                    });
                    setStatus(t('statusSaved'));
                    renderProjectList();
                    renderProjectEditor();
                });
                mount.querySelector('#deleteProjectBtn')?.addEventListener('click', () => {
                    deleteActiveOrListedProject(project.id);
                });
            } catch (fallbackErr) {
                console.error('Fallback syllabus editor also failed', fallbackErr);
                mount.innerHTML = `
                <div class="module-empty-hint">
                    <p>${escapeHtml(t('projectEditorLoadError'))}</p>
                    <p class="section-hint">${escapeHtml(projectListLabel(project))}</p>
                    <button type="button" class="btn btn-danger btn-small" id="deleteBrokenProjectBtn">${escapeHtml(t('deleteProject'))}</button>
                </div>`;
                mount.querySelector('#deleteBrokenProjectBtn')?.addEventListener('click', () => {
                    deleteActiveOrListedProject(project.id);
                });
            }
        }
    }

    function bindProjectColorPicker(project) {
        const grid = document.getElementById('projectColorPalette');
        const preview = document.getElementById('projectColorPreview');
        const hidden = document.getElementById('projectColorValue');
        const palette = window.CCPClassColorPalette;
        if (!grid || !palette) return;
        const selected = project.color || '#356a9e';
        const onPick = (hex) => {
            if (hidden) hidden.value = hex;
            palette.renderGrid(grid, hex, onPick);
            palette.renderPreviewRow(preview, hex, project.name || t('defaultSyllabusName'));
            autoSaveProject();
            renderProjectList();
            if (activeTab === 'calendar') refreshCalendarPanel();
        };
        palette.renderGrid(grid, selected, onPick);
        palette.renderPreviewRow(preview, selected, project.name || t('defaultSyllabusName'));
    }

    function syncEndModeUi() {
        const auto = document.getElementById('projectEndAuto')?.checked;
        const endInput = document.getElementById('projectEndDate');
        const monthsGroup = document.getElementById('termMonthsGroup');
        if (endInput) {
            endInput.readOnly = !!auto;
            if (auto) {
                const active = getActiveProject();
                if (active) {
                    const p = collectProjectFromForm(active);
                    if (p && window.CCPCompanionSyllabus?.syncProjectEndDate) {
                        endInput.value = window.CCPCompanionSyllabus.syncProjectEndDate(p);
                    }
                    applyDebateAutoFillAndPersist(p);
                }
            }
        }
        if (monthsGroup) {
            monthsGroup.style.opacity = auto ? '1' : '0.5';
        }
    }

    function bindProjectEditorEvents() {
        const mount = document.getElementById('projectEditorMount');
        if (!mount) return;

        mount.querySelector('#projectEndAuto')?.addEventListener('change', syncEndModeUi);
        mount.querySelector('#projectEndFixed')?.addEventListener('change', syncEndModeUi);
        mount.querySelector('#projectStartDate')?.addEventListener('change', syncEndModeUi);
        mount.querySelector('#projectTermMonths')?.addEventListener('change', syncEndModeUi);
        mount.querySelector('#projectTermEndMode')?.addEventListener('change', syncEndModeUi);
        mount.querySelector('#projectLevelPreset')?.addEventListener('change', () => {
            handleProjectLevelPresetChange();
            autoSaveProject();
        });
        mount.querySelector('#projectClassType')?.addEventListener('change', (e) => {
            applyClassTypeDefaultsToProjectForm(e.target.value);
            const p = collectProjectFromForm(getActiveProject());
            window.CCPCompanionStore.upsertProject(p);
            if (!applyDebateAutoFillAndPersist(p)) {
                renderProjectEditor({ skipDebateAutoFill: true });
            }
        });

        mount.querySelector('#projectCurriculum')?.addEventListener('change', (e) => {
            applyCurriculumDebateDefaults(e.target.value);
            const p = collectProjectFromForm(getActiveProject());
            window.CCPCompanionStore.upsertProject(p);
            if (!applyDebateAutoFillAndPersist(p)) {
                renderProjectEditor({ skipDebateAutoFill: true });
            } else {
                autoSaveProject();
            }
        });

        mount.querySelector('#projectBook')?.addEventListener('change', () => {
            const p = collectProjectFromForm(getActiveProject());
            applyDebateAutoFillAndPersist(p);
        });

        mount.querySelector('#debateFillPeriodsBtn')?.addEventListener('click', () => {
            const p = collectProjectFromForm(getActiveProject());
            const api = window.CCPScheduleLessonDates;
            const engine = window.CCPCompanionSyllabus;
            if (!api || !engine) return;
            const classShape = engine.projectToClassShape(p, window.CCPCompanionStore.getAppDataShape());
            const suggested = api.suggestDebatePeriodsFromTerm(classShape);
            if (!suggested.length) {
                setStatus(t('debateFillPeriodsEmpty'), true);
                return;
            }
            p.debateBookPeriods = suggested;
            window.CCPCompanionStore.upsertProject(p);
            renderProjectEditor();
            setStatus(t('debateFillPeriodsDone').replace('{n}', String(suggested.length)));
        });

        mount.querySelector('#debateAddPeriodBtn')?.addEventListener('click', () => {
            const p = collectProjectFromForm(getActiveProject());
            const periods = Array.isArray(p.debateBookPeriods) ? [...p.debateBookPeriods] : [];
            periods.push({
                id: window.CCPCompanionStore.generateId('dbp'),
                startDate: p.startDate || '',
                book: p.book || ''
            });
            p.debateBookPeriods = periods;
            window.CCPCompanionStore.upsertProject(p);
            renderProjectEditor();
        });

        mount.querySelectorAll('.debate-period-remove').forEach((btn) => {
            btn.addEventListener('click', () => {
                const p = collectProjectFromForm(getActiveProject());
                const idx = parseInt(btn.dataset.idx, 10);
                p.debateBookPeriods = (p.debateBookPeriods || []).filter((_, i) => i !== idx);
                window.CCPCompanionStore.upsertProject(p);
                renderProjectEditor();
            });
        });

        mount.querySelectorAll('.schedule-skip-lesson, .schedule-combine-lesson').forEach((cb) => {
            cb.addEventListener('change', () => {
                const start = parseInt(cb.dataset.start, 10);
                if (cb.classList.contains('schedule-combine-lesson') && cb.checked) {
                    const skipPrev = mount.querySelector(`.schedule-skip-lesson[data-day="${start}"]`);
                    const skipNext = mount.querySelector(`.schedule-skip-lesson[data-day="${start + 1}"]`);
                    if (skipPrev?.checked || skipNext?.checked) {
                        cb.checked = false;
                        setStatus(t('scheduleCombineSkipConflict'), true);
                    }
                }
                autoSaveProject();
            });
        });

        mount.querySelectorAll('input[name="classScheduleTemplate"], input[name="meetingsPerWeek"]').forEach((el) => {
            el.addEventListener('change', () => {
                syncMeetingDaysFromTemplateControls();
                refreshScheduleVariantsHint();
                autoSaveProject({ scheduleChanged: true, refreshList: true });
            });
        });

        mount.querySelectorAll('.meeting-day-cb').forEach((cb) => {
            cb.addEventListener('change', () => {
                refreshScheduleVariantsHint();
                autoSaveProject({ scheduleChanged: true, refreshList: true });
            });
        });

        mount.querySelectorAll('input, select, textarea').forEach((el) => {
            if (el.name === 'classScheduleTemplate' || el.name === 'meetingsPerWeek' || el.classList.contains('meeting-day-cb')) {
                return;
            }
            el.addEventListener('change', () => autoSaveProject({ refreshCalendar: false }));
            if (el.tagName === 'TEXTAREA' || el.type === 'text') {
                el.addEventListener('input', () => autoSaveProject({ refreshCalendar: false }));
            }
        });

        mount.querySelector('#saveProjectBtn')?.addEventListener('click', () => {
            const p = collectProjectFromForm(getActiveProject());
            window.CCPCompanionStore.upsertProject(p);
            setStatus(t('statusSaved'));
            renderProjectList();
            refreshCalendarPanel();
        });

        mount.querySelector('#duplicateProjectBtn')?.addEventListener('click', () => {
            const current = collectProjectFromForm(getActiveProject());
            window.CCPCompanionStore.upsertProject(current);
            const copy = window.CCPCompanionStore.duplicateProject(current.id);
            if (!copy) {
                setStatus(t('duplicateProjectFailed'), true);
                return;
            }
            activeProjectId = copy.id;
            renderProjectList();
            renderProjectEditor();
            refreshCalendarPanel();
            setStatus(t('duplicateProjectDone'));
        });

        mount.querySelector('#deleteProjectBtn')?.addEventListener('click', () => {
            deleteActiveOrListedProject(activeProjectId);
        });

        mount.querySelector('#generateScheduleBtn')?.addEventListener('click', () => {
            const p = collectProjectFromForm(getActiveProject());
            const result = runScheduleGeneration(p);
            if (!result) return;
            const rows = result.variants[0]?.rows || [];
            setStatus(t('generateDone').replace('{n}', String(rows.length)));
        });

        mount.querySelector('#applyCurriculumBtn')?.addEventListener('click', () => {
            let p = collectProjectFromForm(getActiveProject());
            if (!p.syllabusRows?.length) {
                p.syllabusRows = window.CCPCompanionSyllabus.generateScheduleRows(p);
            }
            const result = window.CCPCompanionSyllabus.applyCurriculumPages(p);
            p.syllabusRows = result.rows;
            if (result.syllabusGeneralNotes) {
                p.syllabusGeneralNotes = result.syllabusGeneralNotes;
            }
            window.CCPCompanionStore.upsertProject(p);
            renderProjectEditor();
            setStatus(t('applyDone').replace('{n}', String(result.applied)));
        });
    }

    function loadPrintOptionsIntoForm() {
        const api = window.CCPCompanionSyllabusPrint;
        if (!api) return;
        const opts = api.loadPrintOptions();
        const showDate = document.getElementById('printShowDateColumn');
        const weekFormat = document.getElementById('printWeekFormat');
        const appendix = document.getElementById('printDetailAppendix');
        if (showDate) showDate.checked = opts.showDateColumn !== false;
        if (weekFormat) {
            weekFormat.value = opts.weekFormat === 'index' ? 'index' : 'abbrev';
        }
        if (appendix) appendix.checked = opts.detailAppendix === true;
    }

    function savePrintOptionsFromForm() {
        const api = window.CCPCompanionSyllabusPrint;
        if (!api) return;
        api.savePrintOptions({
            showDateColumn: document.getElementById('printShowDateColumn')?.checked !== false,
            weekFormat: document.getElementById('printWeekFormat')?.value === 'index' ? 'index' : 'abbrev',
            detailAppendix: document.getElementById('printDetailAppendix')?.checked === true
        });
    }

    function resizePrintPreviewFrame(frame) {
        if (!frame || !frame.contentDocument || !frame.contentDocument.body) return;
        const body = frame.contentDocument.body;
        const sheets = frame.contentDocument.querySelectorAll('.syllabus-a4-sheet');
        let height = body.scrollHeight;
        if (sheets.length) {
            height = 0;
            sheets.forEach((sheet) => {
                height += sheet.offsetHeight || sheet.scrollHeight || 0;
            });
            height += 16;
        }
        frame.style.height = `${Math.max(480, height)}px`;
    }

    function refreshPrintPreview() {
        const frame = document.getElementById('printPreviewFrame');
        if (!frame) return;

        const selected = getSelectedPrintProjects();
        if (!selected.length) {
            frame.onload = null;
            frame.srcdoc = `<p style="padding:24px;font-family:sans-serif">${escapeHtml(t('printNoSelection'))}</p>`;
            frame.style.height = '120px';
            return;
        }

        savePrintOptionsFromForm();
        const html = window.CCPCompanionSyllabus.buildPrintDocumentForProjects(selected);
        frame.onload = () => {
            const printApi = window.CCPCompanionSyllabusPrint;
            const mod = window.CCPSyllabus;
            if (printApi && mod && html && html.includes('syllabus-a4-sheet')) {
                printApi.fitSyllabusDocument(frame.contentDocument, mod);
            }
            requestAnimationFrame(() => {
                resizePrintPreviewFrame(frame);
            });
        };
        frame.srcdoc = html || `<p style="padding:24px;font-family:sans-serif">${escapeHtml(t('printNoRowsSelected'))}</p>`;
        if (!html) {
            frame.style.height = '120px';
        }
    }

    function refreshCalendarPanel() {
        const store = window.CCPCompanionStore;
        const data = store.getData();
        store.ensureDisplayRange();
        const d = store.getData();
        const startEl = document.getElementById('calDisplayStart');
        const endEl = document.getElementById('calDisplayEnd');
        if (startEl && !startEl.matches(':focus')) {
            startEl.value = d.calendarDisplayStart || '';
        }
        if (endEl && !endEl.matches(':focus')) {
            endEl.value = d.calendarDisplayEnd || '';
        }
        syncCalendarEndMin(d.calendarDisplayStart || startEl?.value || '');
        const filter = document.getElementById('calEventFilter')?.value || 'all';
        const project = getActiveProject();
        const monthsMount = document.getElementById('calMonthsMount');
        const listMount = document.getElementById('calEventList');
        const calView = window.CCPCompanionCalendarView;
        const eventsUi = window.CCPCompanionEventsUI;
        if (eventsUi) eventsUi.ensureModal();
        if (calView && monthsMount) {
            calView.render(monthsMount, {
                data: d,
                displayStart: d.calendarDisplayStart,
                displayEnd: d.calendarDisplayEnd,
                projectFilter: filter,
                activeProject: project,
                onDayClick: (dateStr) => {
                    if (!eventsUi) return;
                    const scope = filter === 'active' && project ? 'syllabus' : 'shared';
                    eventsUi.openModal({
                        scope,
                        projectId: project?.id,
                        prefillDate: dateStr
                    });
                },
                onEventClick: (eventId, scope) => {
                    if (!eventsUi) return;
                    const storeData = store.getData();
                    if (scope === 'syllabus') {
                        for (const p of storeData.projects || []) {
                            const ev = (p.events || []).find((e) => e.id === eventId);
                            if (ev) {
                                eventsUi.openModal({ event: ev, scope: 'syllabus', projectId: p.id });
                                return;
                            }
                        }
                    } else {
                        const ev = (storeData.events || []).find((e) => e.id === eventId);
                        if (ev) eventsUi.openModal({ event: ev, scope: 'shared' });
                    }
                }
            });
        }
        if (eventsUi && listMount) {
            eventsUi.renderEventList(listMount, {
                projectFilter: filter,
                activeProjectId: activeProjectId
            });
        }
    }

    function getHolidayImportRange() {
        const store = window.CCPCompanionStore;
        const data = store.getData();
        const activeProject = getActiveProject();
        if (activeProject && activeProject.startDate && activeProject.endDate) {
            return {
                start: activeProject.startDate,
                end: activeProject.endDate,
                scopeLabel: activeProject.name || t('calFilterActive')
            };
        }
        return {
            start: data.calendarDisplayStart,
            end: data.calendarDisplayEnd,
            scopeLabel: t('calFilterAll')
        };
    }

    async function handleImportKrHolidays() {
        const store = window.CCPCompanionStore;
        const range = getHolidayImportRange();
        if (!range.start || !range.end) {
            alert(t('calKrHolidayRangeMissing'));
            return;
        }
        const confirmMsg = t('calKrHolidayConfirm')
            .replace('{start}', range.start)
            .replace('{end}', range.end)
            .replace('{scope}', range.scopeLabel);
        if (!confirm(confirmMsg)) {
            return;
        }
        const btn = document.getElementById('calImportKrBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = t('calKrHolidayLoading');
        }
        try {
            const result = await store.importKoreanPublicHolidays({
                start: range.start,
                end: range.end
            });
            refreshCalendarPanel();
            setStatus(
                t('calKrHolidayDone')
                    .replace('{added}', String(result.added))
                    .replace('{skipped}', String(result.skipped))
            );
        } catch (err) {
            console.error('Korean holiday import failed:', err);
            const detail = err && err.message ? String(err.message) : '';
            let msg = t('calKrHolidayError');
            if (detail === 'YEAR_UNAVAILABLE' && err.year) {
                msg = t('calKrHolidayYearUnavailable').replace('{year}', String(err.year));
            } else if (detail === 'RANGE_REQUIRED') {
                msg = t('calKrHolidayRangeMissing');
            } else if (err instanceof TypeError || detail.toLowerCase().includes('fetch')) {
                msg = t('calKrHolidayNetworkError');
            }
            alert(msg);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = t('calImportKrHolidays');
            }
        }
    }

    window.__companionOnEventsChanged = refreshCalendarPanel;

    function dayAfterISO(iso) {
        const utils = window.CCPUtils;
        if (!utils || !iso) return '';
        const d = utils.parseISODateLocal(iso);
        if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
        d.setDate(d.getDate() + 1);
        return utils.formatDateISO(d);
    }

    function defaultEndThreeMonthsAfter(start) {
        const td = window.CCPTermDates;
        if (!td || !start) return '';
        const computed = td.computeTermEndDateFromStart(start, 3);
        return computed ? td.formatDateForInput(computed) : '';
    }

    function ensureEndOnOrAfterStart(start, end) {
        if (!start) return end || '';
        if (!end || end < start) {
            return defaultEndThreeMonthsAfter(start) || dayAfterISO(start);
        }
        return end;
    }

    function syncCalendarEndMin(start) {
        const endEl = document.getElementById('calDisplayEnd');
        if (!endEl) return;
        if (start) {
            endEl.min = start;
        } else {
            endEl.removeAttribute('min');
        }
    }

    function setupCalendarTab() {
        document.getElementById('calDisplayStart')?.addEventListener('change', (e) => {
            const start = e.target.value;
            const endEl = document.getElementById('calDisplayEnd');
            // Default end to ~3 months after start whenever start changes.
            const nextEnd = start
                ? (defaultEndThreeMonthsAfter(start) || dayAfterISO(start))
                : (endEl?.value || '');
            if (endEl && nextEnd !== endEl.value) {
                endEl.value = nextEnd;
            }
            syncCalendarEndMin(start);
            window.CCPCompanionStore.setDisplayRange(start, nextEnd);
            refreshCalendarPanel();
        });
        document.getElementById('calDisplayEnd')?.addEventListener('change', (e) => {
            const start = document.getElementById('calDisplayStart')?.value || '';
            let end = e.target.value;
            end = ensureEndOnOrAfterStart(start, end);
            if (e.target.value !== end) {
                e.target.value = end;
            }
            syncCalendarEndMin(start);
            window.CCPCompanionStore.setDisplayRange(start, end);
            refreshCalendarPanel();
        });
        document.getElementById('calFitRangeBtn')?.addEventListener('click', () => {
            window.CCPCompanionStore.fitDisplayRangeToProjects();
            refreshCalendarPanel();
            setStatus(t('statusSaved'));
        });
        document.getElementById('calEventFilter')?.addEventListener('change', refreshCalendarPanel);
        document.getElementById('calImportKrBtn')?.addEventListener('click', handleImportKrHolidays);
        document.getElementById('calSetupGuideBtn')?.addEventListener('click', () => {
            window.CCPCompanionGuides?.openCalendarWizard();
        });
        document.getElementById('calAddEventBtn')?.addEventListener('click', () => {
            const ui = window.CCPCompanionEventsUI;
            if (!ui) return;
            const project = getActiveProject();
            const filter = document.getElementById('calEventFilter')?.value || 'all';
            ui.openModal({
                scope: filter === 'active' && project ? 'syllabus' : 'shared',
                projectId: project?.id
            });
        });
    }

    function setupImportExport() {
        document.getElementById('importPackBtn')?.addEventListener('click', () => {
            document.getElementById('importPackFile')?.click();
        });
        document.getElementById('exportPackBtn')?.addEventListener('click', () => {
            window.CCPSyllabusPack.downloadPack(window.CCPCompanionStore.getData(), 'syllabus-companion');
            setStatus(t('statusSaved'));
            window.CCPCompanionGuides?.markExportComplete();
        });
        document.getElementById('importBackupBtn')?.addEventListener('click', () => {
            document.getElementById('importBackupFile')?.click();
        });
        document.getElementById('exportBackupBtn')?.addEventListener('click', () => {
            const payload = window.CCPCompanionStore.exportProjectBackup();
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `syllabus-companion-backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });

        document.getElementById('importPackFile')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const imported = JSON.parse(ev.target.result);
                    if (!window.CCPSyllabusPack.isValid(imported)) {
                        alert(t('packInvalid'));
                        return;
                    }
                    const counts = window.CCPCompanionStore.mergePack(imported);
                    initCurriculumPanel();
                    renderProjectEditor();
                    const bookN = counts.curriculumCount != null ? counts.curriculumCount : counts.bookCount;
                    setStatus(t('packImported')
                        .replace('{templates}', String(counts.templateCount || 0))
                        .replace('{books}', String(bookN || 0)));
                    switchTab('curriculum');
                } catch {
                    alert(t('packInvalid'));
                }
                e.target.value = '';
            };
            reader.readAsText(file);
        });

        document.getElementById('importBackupFile')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const imported = JSON.parse(ev.target.result);
                    if (window.CCPCompanionStore.importProjectBackup(imported)) {
                        activeProjectId = window.CCPCompanionStore.getProjects()[0]?.id || null;
                        renderProjectList();
                        renderProjectEditor();
                        initCurriculumPanel();
                        refreshCalendarPanel();
                        setStatus(t('statusSaved'));
                    } else {
                        alert(t('packInvalid'));
                    }
                } catch {
                    alert(t('packInvalid'));
                }
                e.target.value = '';
            };
            reader.readAsText(file);
        });

        document.getElementById('importCalendarBtn')?.addEventListener('click', () => {
            document.getElementById('importCalendarFile')?.click();
        });
        document.getElementById('importCalendarFile')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const imported = JSON.parse(ev.target.result);
                    const count = window.CCPCompanionStore.importCalendarJson(imported);
                    refreshCalendarPanel();
                    setStatus(t('calendarImported').replace('{n}', String(count)));
                } catch {
                    alert(t('packInvalid'));
                }
                e.target.value = '';
            };
            reader.readAsText(file);
        });
    }

    function setupTabs() {
        const panel = document.getElementById('companionSegmentPanel');
        if (!panel) return;

        panel.querySelectorAll('.app-zone-segment-btn').forEach((btn) => {
            btn.draggable = true;
        });

        panel.addEventListener('click', (e) => {
            const btn = e.target.closest('.app-zone-segment-btn');
            if (!btn || !panel.contains(btn)) return;
            if (tabDragDidMove) {
                tabDragDidMove = false;
                return;
            }
            switchTab(btn.dataset.tab);
        });

        panel.addEventListener('dragstart', (e) => {
            const btn = e.target.closest('.app-zone-segment-btn');
            if (!btn || !panel.contains(btn)) return;
            tabDragDidMove = false;
            btn.classList.add('is-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', btn.dataset.tab || '');
            if (e.dataTransfer.setDragImage) {
                e.dataTransfer.setDragImage(btn, Math.min(btn.offsetWidth / 2, 48), btn.offsetHeight / 2);
            }
        });

        panel.addEventListener('drag', () => {
            tabDragDidMove = true;
        });

        panel.addEventListener('dragover', (e) => {
            const btn = e.target.closest('.app-zone-segment-btn');
            if (!btn || !panel.contains(btn)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            panel.querySelectorAll('.app-zone-segment-btn.is-drag-over').forEach((el) => {
                if (el !== btn) el.classList.remove('is-drag-over');
            });
            btn.classList.add('is-drag-over');
        });

        panel.addEventListener('dragleave', (e) => {
            const btn = e.target.closest('.app-zone-segment-btn');
            if (!btn || !panel.contains(btn)) return;
            const related = e.relatedTarget;
            if (related && btn.contains(related)) return;
            btn.classList.remove('is-drag-over');
        });

        panel.addEventListener('drop', (e) => {
            const btn = e.target.closest('.app-zone-segment-btn');
            if (!btn || !panel.contains(btn)) return;
            e.preventDefault();
            panel.querySelectorAll('.app-zone-segment-btn').forEach((el) => {
                el.classList.remove('is-drag-over', 'is-dragging');
            });
            const fromId = e.dataTransfer.getData('text/plain');
            reorderTabs(fromId, btn.dataset.tab);
        });

        panel.addEventListener('dragend', () => {
            panel.querySelectorAll('.app-zone-segment-btn').forEach((el) => {
                el.classList.remove('is-drag-over', 'is-dragging');
            });
        });
    }

    function setupThemeToggle() {
        const btn = document.getElementById('headerThemeToggleBtn');
        if (!btn || !window.CCPTheme) return;
        window.CCPTheme.applyTheme(window.CCPTheme.getStoredTheme(), {
            buttonIds: ['headerThemeToggleBtn'],
            getButtonTitle: () => t('themeToggleTitle')
        });
        btn.addEventListener('click', () => {
            window.CCPTheme.toggleTheme({
                buttonIds: ['headerThemeToggleBtn'],
                getButtonTitle: () => t('themeToggleTitle')
            });
        });
    }

    function setupCurriculumTab() {
        document.getElementById('curriculumAddBtn')?.addEventListener('click', handleAddCurriculum);
        document.getElementById('curriculumTabListSearch')?.addEventListener('input', refreshCurriculumList);
        document.getElementById('curriculumTabList')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-curriculum-id],[data-book-id]');
            if (!btn) return;
            curriculumTabSelectedId = btn.dataset.curriculumId || btn.dataset.bookId;
            initCurriculumPanel();
        });
    }

    function setupSyllabusTab() {
        document.getElementById('newProjectBtn')?.addEventListener('click', () => {
            if (window.CCPCompanionGuides) {
                window.CCPCompanionGuides.openSyllabusWizard();
                return;
            }
            const p = window.CCPCompanionStore.addProject();
            activeProjectId = p.id;
            renderProjectList();
            renderProjectEditor();
            switchTab('syllabus');
        });
    }

    function setupPrintTab() {
        loadPrintOptionsIntoForm();
        ['printShowDateColumn', 'printWeekFormat', 'printDetailAppendix'].forEach((id) => {
            document.getElementById(id)?.addEventListener('change', () => {
                savePrintOptionsFromForm();
                if (activeTab === 'print') {
                    refreshPrintPreview();
                }
            });
        });

        document.getElementById('printSelectAllBtn')?.addEventListener('click', () => {
            getPrintableProjects().forEach((p) => {
                printSelectedProjectIds.add(p.id);
            });
            savePrintSelection();
            renderPrintProjectList();
            refreshPrintPreview();
        });

        document.getElementById('printSelectNoneBtn')?.addEventListener('click', () => {
            printSelectedProjectIds.clear();
            savePrintSelection();
            renderPrintProjectList();
            refreshPrintPreview();
        });

        document.getElementById('printSyllabusBtn')?.addEventListener('click', () => {
            savePrintOptionsFromForm();
            const selected = getSelectedPrintProjects();
            if (!selected.length) {
                alert(t('printNoSelection'));
                return;
            }
            const result = window.CCPCompanionSyllabus.printProjects(selected);
            if (!result.ok) {
                if (result.reason === 'blocked') {
                    alert(t('popupBlocked'));
                } else if (result.reason === 'noRows') {
                    alert(t('printNoRowsSelected'));
                }
                return;
            }
            if (result.count > 1) {
                setStatus(t('printMultiDone').replace('{n}', String(result.count)));
            }
            if (window.CCPCompanionGuides) {
                window.CCPCompanionGuides.markExportComplete();
            }
        });

        document.getElementById('exportWordBtn')?.addEventListener('click', async () => {
            savePrintOptionsFromForm();
            const selected = getSelectedPrintProjects();
            if (!selected.length) {
                alert(t('printNoSelection'));
                return;
            }
            const word = window.CCPCompanionWordExport;
            if (!word || !window.docx) {
                alert(t('exportWordNoBundle'));
                return;
            }
            try {
                const options = {
                    showDateColumn: document.getElementById('printShowDateColumn')?.checked !== false
                };
                const count = await word.downloadProjectsDocx(selected, options);
                setStatus(t('exportWordDone').replace('{n}', String(count)));
                if (window.CCPCompanionGuides) {
                    window.CCPCompanionGuides.markExportComplete();
                }
            } catch (err) {
                alert(t('exportWordNoBundle'));
            }
        });
    }

    function setupLangToggle() {
        document.querySelectorAll('.lang-toggle .btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                lang = btn.dataset.lang || 'en';
                window.__companionLang = lang;
                localStorage.setItem('ccp-companion-lang', lang);
                applyI18n();
                initCurriculumPanel();
                renderProjectList();
                renderProjectEditor();
                refreshCalendarPanel();
                if (window.CCPCompanionEventsUI) {
                    const listEl = document.getElementById('calEventList');
                    if (listEl) {
                        window.CCPCompanionEventsUI.renderEventList(listEl, {
                            projectFilter: document.getElementById('calEventFilter')?.value || 'all',
                            activeProjectId
                        });
                    }
                    if (typeof window.CCPCompanionEventsUI.applyEventModalI18n === 'function') {
                        window.CCPCompanionEventsUI.applyEventModalI18n();
                    }
                }
                if (activeTab === 'print') {
                    refreshPrintPreview();
                }
                if (window.CCPCompanionGuides?.applyLanguage) {
                    window.CCPCompanionGuides.applyLanguage();
                }
            });
        });
    }

    function initClassMetadataEditors() {
        const editor = window.CCPDefaultClassEditor;
        const store = window.CCPCompanionStore;
        if (!editor || !store) return;
        editor.init({
            getAppData: () => store.getData(),
            saveData: () => store.save(store.getData()),
            t: (key) => (t(key) !== key ? t(key) : key),
            getLang: () => lang,
            sanitizeTotalLessons: (n) => Math.max(1, parseInt(n, 10) || 1),
            generateId: () => store.generateId('ctype')
        });
    }

    async function boot() {
        if (window.CCPPacksBoot && typeof window.CCPPacksBoot.loadFromManifest === 'function') {
            try {
                const packResult = await window.CCPPacksBoot.loadFromManifest();
                if (packResult.applied.length) {
                    setStatus(t('packsBootApplied').replace('{n}', String(packResult.applied.length)));
                } else if (packResult.errors.length && !packResult.skipped.length) {
                    console.warn('Packs boot errors:', packResult.errors);
                    setStatus(t('packsBootError'), true);
                }
            } catch (err) {
                console.warn('Packs boot failed:', err);
            }
        }

        applyTabOrder();
        switchTab(activeTab);
        applyI18n();
        initClassMetadataEditors();
        initBooksEditor();
        setupTabs();
        setupCurriculumTab();
        setupSyllabusTab();
        setupCalendarTab();
        setupPrintTab();
        setupImportExport();
        setupThemeToggle();
        setupLangToggle();
        initCurriculumPanel();
        const projects = window.CCPCompanionStore.getProjects();
        if (projects.length) {
            activeProjectId = projects[0].id;
        }
        renderProjectList();
        renderProjectEditor();
        if (window.CCPCompanionGuides) {
            window.CCPCompanionGuides.init({
                switchTab,
                setStatus,
                refreshUi: () => {
                    applyI18n();
                    initCurriculumPanel();
                    renderProjectList();
                    renderProjectEditor();
                    refreshCalendarPanel();
                    renderPrintProjectList();
                    if (activeTab === 'print') refreshPrintPreview();
                    window.CCPCompanionGuides.refreshChecklist?.()
                        || window.CCPCompanionGuides.renderTermChecklist();
                },
                onCurriculumCreated: (id) => {
                    curriculumTabSelectedId = id;
                    initCurriculumPanel();
                    switchTab('curriculum');
                },
                onProjectCreated: (id) => {
                    activeProjectId = id;
                    renderProjectList();
                    renderProjectEditor();
                    switchTab('syllabus');
                }
            });
            const state = window.CCPCompanionGuides.loadChecklistState();
            if (!state.dismissed) {
                window.CCPCompanionGuides.showChecklist(true);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { boot(); });
    } else {
        boot();
    }
})();
