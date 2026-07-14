/**
 * Event editor modal for Syllabus Companion.
 * window.CCPCompanionEventsUI
 */
(function (global) {
    const EMPTY_APPLICABILITY = {
        allClasses: true,
        grades: [],
        sectionLevels: [],
        classNames: [],
        allElementary: false,
        allMiddleSchool: false
    };

    let draftApplicability = { ...EMPTY_APPLICABILITY };
    let editingContext = null;

    function t(key) {
        if (typeof global.__companionT === 'function') return global.__companionT(key);
        return key;
    }

    function escapeHtml(s) {
        return global.CCPUtils ? global.CCPUtils.escapeHtml(s) : String(s ?? '');
    }

    function getModal() {
        return document.getElementById('companionEventModal');
    }

    function ensureModal() {
        if (document.getElementById('companionEventModal')) return;
        const wrap = document.createElement('div');
        wrap.id = 'companionEventModal';
        wrap.className = 'modal';
        wrap.innerHTML = `
            <div class="modal-content" role="dialog" aria-labelledby="companionEventModalTitle">
                <div class="modal-header">
                    <h2 id="companionEventModalTitle"></h2>
                    <button type="button" class="modal-close" data-close-modal aria-label="">×</button>
                </div>
                <form id="companionEventForm" class="modal-body">
                    <input type="hidden" id="companionEventId">
                    <div class="form-group">
                        <label for="companionEventScope" data-i18n="eventScope"></label>
                        <select id="companionEventScope">
                            <option value="shared" data-i18n="eventScopeTermWide"></option>
                            <option value="syllabus" data-i18n="eventScopeSyllabus"></option>
                        </select>
                    </div>
                    <div class="form-group" id="companionEventProjectWrap" hidden>
                        <label for="companionEventProjectId" data-i18n="eventSyllabusLabel"></label>
                        <select id="companionEventProjectId"></select>
                    </div>
                    <div class="form-group">
                        <label for="companionEventName" data-i18n="eventName"></label>
                        <input type="text" id="companionEventName" required>
                    </div>
                    <div class="form-group">
                        <label for="companionEventType" data-i18n="eventType"></label>
                        <select id="companionEventType">
                            <option value="holiday" data-i18n="eventTypeHoliday"></option>
                            <option value="evaluation_period" data-i18n="eventTypeEvalPeriod"></option>
                            <option value="evaluation_deadline" data-i18n="eventTypeEvalDeadline"></option>
                            <option value="homework_deadline" data-i18n="eventTypeHomeworkDeadline"></option>
                            <option value="other" data-i18n="eventTypeOther"></option>
                        </select>
                    </div>
                    <div class="form-row editor-popout-colors">
                        <div class="form-group">
                            <label for="companionEventBg" data-i18n="eventBg"></label>
                            <input type="color" id="companionEventBg" value="#fef3c7">
                        </div>
                        <div class="form-group">
                            <label for="companionEventFg" data-i18n="eventFg"></label>
                            <input type="color" id="companionEventFg" value="#b45309">
                        </div>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="companionEventIsRange"> <span data-i18n="eventDateRange"></span></label>
                    </div>
                    <div class="form-group" id="companionEventSingleWrap">
                        <label for="companionEventDate" data-i18n="eventDate"></label>
                        <input type="date" id="companionEventDate">
                    </div>
                    <div class="form-row" id="companionEventRangeWrap" hidden>
                        <div class="form-group">
                            <label for="companionEventStart" data-i18n="eventStart"></label>
                            <input type="date" id="companionEventStart">
                        </div>
                        <div class="form-group">
                            <label for="companionEventEnd" data-i18n="eventEnd"></label>
                            <input type="date" id="companionEventEnd">
                        </div>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="companionEventAllClasses" checked> <span data-i18n="eventAllSyllabi"></span></label>
                    </div>
                    <div id="companionApplicabilityPanel" class="companion-applicability" hidden>
                        <p class="section-hint" data-i18n="eventApplicabilityHint"></p>
                        <div class="form-group">
                            <label><input type="checkbox" data-app-filter="allElementary"> <span data-i18n="eventAllElementary"></span></label>
                            <label><input type="checkbox" data-app-filter="allMiddleSchool"> <span data-i18n="eventAllMiddleSchool"></span></label>
                        </div>
                        <div class="form-group">
                            <span class="form-label" data-i18n="eventGrades"></span>
                            <div id="companionAppGrades" class="checkbox-grid"></div>
                        </div>
                        <div class="form-group">
                            <span class="form-label" data-i18n="eventSections"></span>
                            <div id="companionAppSections" class="companion-level-groups"></div>
                        </div>
                        <div class="form-group">
                            <span class="form-label" data-i18n="eventSyllabusNames"></span>
                            <div id="companionAppNames" class="checkbox-grid"></div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="companionEventNotes" data-i18n="eventNotes"></label>
                        <textarea id="companionEventNotes" rows="2"></textarea>
                    </div>
                    <footer class="modal-footer">
                        <button type="button" class="btn btn-danger btn-small" id="companionEventDeleteBtn" hidden data-i18n="eventDelete"></button>
                        <button type="submit" class="btn btn-primary" data-i18n="eventSave"></button>
                    </footer>
                </form>
            </div>`;
        document.body.appendChild(wrap);

        wrap.querySelectorAll('[data-close-modal]').forEach((el) => {
            el.addEventListener('click', closeModal);
        });
        wrap.addEventListener('click', (e) => {
            if (e.target === wrap) closeModal();
        });
        document.getElementById('companionEventIsRange').addEventListener('change', syncRangeUi);
        document.getElementById('companionEventScope').addEventListener('change', syncScopeUi);
        document.getElementById('companionEventAllClasses').addEventListener('change', syncApplicabilityUi);
        document.getElementById('companionEventType').addEventListener('change', syncTypeColors);
        document.getElementById('companionEventForm').addEventListener('submit', (e) => {
            e.preventDefault();
            saveFromForm();
        });
        document.getElementById('companionEventDeleteBtn').addEventListener('click', () => {
            deleteCurrent();
        });
        applyEventModalI18n();
    }

    function applyEventModalI18n() {
        const modal = document.getElementById('companionEventModal');
        if (!modal) return;
        modal.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = el.getAttribute('data-i18n');
            if (!key) return;
            if (el.tagName === 'OPTION') {
                el.textContent = t(key);
            } else {
                el.textContent = t(key);
            }
        });
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) closeBtn.setAttribute('aria-label', t('modalClose'));
        const titleEl = document.getElementById('companionEventModalTitle');
        const idVal = document.getElementById('companionEventId')?.value;
        if (titleEl) {
            titleEl.textContent = idVal ? t('editEvent') : t('addEventTitle');
        }
    }

    function syncRangeUi() {
        const isRange = document.getElementById('companionEventIsRange').checked;
        document.getElementById('companionEventSingleWrap').hidden = isRange;
        document.getElementById('companionEventRangeWrap').hidden = !isRange;
    }

    function syncScopeUi() {
        const scope = document.getElementById('companionEventScope').value;
        const wrap = document.getElementById('companionEventProjectWrap');
        const appAll = document.getElementById('companionEventAllClasses');
        wrap.hidden = scope !== 'syllabus';
        if (scope === 'syllabus') {
            appAll.checked = true;
            document.getElementById('companionApplicabilityPanel').hidden = true;
        }
        syncApplicabilityUi();
    }

    function syncApplicabilityUi() {
        const scope = document.getElementById('companionEventScope').value;
        const all = document.getElementById('companionEventAllClasses').checked;
        document.getElementById('companionApplicabilityPanel').hidden = scope === 'syllabus' || all;
    }

    function syncTypeColors() {
        const type = document.getElementById('companionEventType').value;
        const api = global.CCPCalendarEvents;
        if (!api) return;
        const colors = api.EVENT_TYPE_DEFAULT_COLORS[type];
        if (colors) {
            document.getElementById('companionEventBg').value = colors.bg;
            document.getElementById('companionEventFg').value = colors.text;
        }
    }

    function renderApplicabilityOptions() {
        const api = global.CCPCalendarEvents;
        const store = global.CCPCompanionStore;
        if (!api || !store) return;
        const gradesEl = document.getElementById('companionAppGrades');
        const secEl = document.getElementById('companionAppSections');
        const namesEl = document.getElementById('companionAppNames');
        const gradeList = api.ELEMENTARY_GRADES.concat(api.MIDDLE_SCHOOL_GRADES);
        gradesEl.innerHTML = gradeList.map((g) => `
            <label><input type="checkbox" data-app-key="grades" value="${escapeHtml(g)}"
                ${draftApplicability.grades.includes(g) ? 'checked' : ''}> ${escapeHtml(g)}</label>`).join('');
        const meta = global.CCPClassMetadata;
        if (meta && meta.SIMSON_LEVEL_GROUPS) {
            secEl.innerHTML = meta.SIMSON_LEVEL_GROUPS.map((group) => {
                const label = meta.getLocalizedGroupLabel(group, t);
                const items = group.levels.map((level) => `
                    <label class="companion-level-chip"><input type="checkbox" data-app-key="sectionLevels" value="${escapeHtml(level.id)}"
                        ${draftApplicability.sectionLevels.includes(level.id) ? 'checked' : ''}> ${escapeHtml(level.name)}</label>`).join('');
                return `<div class="companion-level-group"><span class="form-label">${escapeHtml(label)}</span><div class="checkbox-grid">${items}</div></div>`;
            }).join('');
        } else {
            secEl.innerHTML = api.SECTION_OPTIONS.map((s) => `
                <label><input type="checkbox" data-app-key="sectionLevels" value="${escapeHtml(s)}"
                    ${draftApplicability.sectionLevels.includes(s) ? 'checked' : ''}> ${escapeHtml(s)}</label>`).join('');
        }
        namesEl.innerHTML = store.getProjects().map((p) => `
            <label><input type="checkbox" data-app-key="classNames" value="${escapeHtml(p.name)}"
                ${draftApplicability.classNames.includes(p.name) ? 'checked' : ''}> ${escapeHtml(p.name)}</label>`).join('');
        document.querySelector('[data-app-filter="allElementary"]').checked = draftApplicability.allElementary;
        document.querySelector('[data-app-filter="allMiddleSchool"]').checked = draftApplicability.allMiddleSchool;
    }

    function readApplicabilityFromDom() {
        if (document.getElementById('companionEventAllClasses').checked) {
            return { ...EMPTY_APPLICABILITY };
        }
        const out = {
            allClasses: false,
            grades: [],
            sectionLevels: [],
            classNames: [],
            allElementary: document.querySelector('[data-app-filter="allElementary"]').checked,
            allMiddleSchool: document.querySelector('[data-app-filter="allMiddleSchool"]').checked
        };
        document.querySelectorAll('#companionApplicabilityPanel input[data-app-key]').forEach((cb) => {
            if (!cb.checked) return;
            const key = cb.dataset.appKey;
            if (Array.isArray(out[key])) out[key].push(cb.value);
        });
        return out;
    }

    function applicabilityFromEvent(ev) {
        if (!ev || !global.CCPCalendarEvents) return { ...EMPTY_APPLICABILITY };
        if (!global.CCPCalendarEvents.eventHasAnyTargetFilter(ev)) {
            return { ...EMPTY_APPLICABILITY };
        }
        return {
            allClasses: false,
            grades: [...(ev.grades || [])],
            sectionLevels: [...(ev.sectionLevels || [])],
            classNames: [...(ev.classNames || [])],
            allElementary: ev.allElementary === true,
            allMiddleSchool: ev.allMiddleSchool === true
        };
    }

    function fillProjectSelect(selectedId) {
        const sel = document.getElementById('companionEventProjectId');
        const store = global.CCPCompanionStore;
        sel.innerHTML = store.getProjects().map((p) => `
            <option value="${escapeHtml(p.id)}"${p.id === selectedId ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
    }

    function openModal(options) {
        ensureModal();
        editingContext = options || {};
        const api = global.CCPCalendarEvents;
        const store = global.CCPCompanionStore;
        const ev = options.event ? api.normalizeEvent(options.event) : null;
        const scope = options.scope || (ev ? options.eventScope : 'shared');
        const projectId = options.projectId || editingContext.projectId || store.getProjects()[0]?.id;

        document.getElementById('companionEventId').value = ev ? ev.id : '';
        document.getElementById('companionEventScope').value = scope === 'syllabus' ? 'syllabus' : 'shared';
        fillProjectSelect(projectId);
        document.getElementById('companionEventProjectId').value = projectId || '';
        document.getElementById('companionEventName').value = ev ? api.getEventDisplayName(ev) : '';
        document.getElementById('companionEventType').value = ev ? ev.type : 'holiday';
        document.getElementById('companionEventBg').value = ev ? ev.bgColor : '#fef3c7';
        document.getElementById('companionEventFg').value = ev ? ev.textColor : '#b45309';
        document.getElementById('companionEventIsRange').checked = ev ? ev.isRange : false;
        document.getElementById('companionEventDate').value = options.prefillDate || (ev && ev.date) || '';
        document.getElementById('companionEventStart').value = ev && ev.startDate ? ev.startDate : (options.prefillDate || '');
        document.getElementById('companionEventEnd').value = ev && ev.endDate ? ev.endDate : (options.prefillDate || '');
        document.getElementById('companionEventNotes').value = ev ? ev.notes : '';

        draftApplicability = ev ? applicabilityFromEvent(ev) : { ...EMPTY_APPLICABILITY };
        document.getElementById('companionEventAllClasses').checked = draftApplicability.allClasses;
        renderApplicabilityOptions();
        syncRangeUi();
        syncScopeUi();
        document.getElementById('companionEventDeleteBtn').hidden = !ev;
        applyEventModalI18n();
        const modal = getModal();
        if (options.stackAboveWizard) {
            modal.classList.add('modal--stack-above-wizard');
        }
        modal.classList.add('active');
    }

    function openNewSharedEvent(options) {
        const opts = options || {};
        if (global.CCPCompanionGuides?.endSpotlightTour) {
            global.CCPCompanionGuides.endSpotlightTour();
        }
        openModal({
            scope: 'shared',
            prefillDate: opts.prefillDate || '',
            stackAboveWizard: true
        });
    }

    function closeModal() {
        const m = getModal();
        if (m) {
            m.classList.remove('active');
            m.classList.remove('modal--stack-above-wizard');
        }
        editingContext = null;
    }

    function buildEventFromForm() {
        const api = global.CCPCalendarEvents;
        const store = global.CCPCompanionStore;
        const isRange = document.getElementById('companionEventIsRange').checked;
        const scope = document.getElementById('companionEventScope').value;
        const app = scope === 'shared' ? readApplicabilityFromDom() : EMPTY_APPLICABILITY;
        const raw = {
            id: document.getElementById('companionEventId').value || store.generateId('ev'),
            type: document.getElementById('companionEventType').value,
            name: document.getElementById('companionEventName').value.trim(),
            notes: document.getElementById('companionEventNotes').value.trim(),
            isRange,
            date: isRange ? null : document.getElementById('companionEventDate').value,
            startDate: isRange ? document.getElementById('companionEventStart').value : null,
            endDate: isRange ? document.getElementById('companionEventEnd').value : null,
            bgColor: document.getElementById('companionEventBg').value,
            textColor: document.getElementById('companionEventFg').value,
            grades: app.grades,
            sectionLevels: app.sectionLevels,
            classNames: app.classNames,
            allElementary: app.allElementary,
            allMiddleSchool: app.allMiddleSchool
        };
        return api.normalizeEvent(raw);
    }

    function saveFromForm() {
        const store = global.CCPCompanionStore;
        const ev = buildEventFromForm();
        const scope = document.getElementById('companionEventScope').value;
        if (scope === 'syllabus') {
            const pid = document.getElementById('companionEventProjectId').value;
            store.upsertProjectEvent(pid, ev);
        } else {
            store.upsertSharedEvent(ev);
        }
        closeModal();
        if (typeof global.__companionOnEventsChanged === 'function') {
            global.__companionOnEventsChanged();
        }
    }

    function deleteCurrent() {
        const id = document.getElementById('companionEventId').value;
        if (!id || !confirm(t('eventDeleteConfirm'))) return;
        const store = global.CCPCompanionStore;
        const scope = document.getElementById('companionEventScope').value;
        if (scope === 'syllabus') {
            store.deleteProjectEvent(document.getElementById('companionEventProjectId').value, id);
        } else {
            store.deleteSharedEvent(id);
        }
        closeModal();
        if (typeof global.__companionOnEventsChanged === 'function') {
            global.__companionOnEventsChanged();
        }
    }

    function renderEventList(container, options) {
        if (!container) return;
        const store = global.CCPCompanionStore;
        const api = global.CCPCalendarEvents;
        const data = store.getData();
        const filter = options && options.projectFilter;
        const activeId = options && options.activeProjectId;
        const flat = api.getAllEventsFlat(data, filter === 'active' ? activeId : 'all');
        if (!flat.length) {
            container.innerHTML = `<p class="section-hint">${escapeHtml(t('eventListEmpty'))}</p>`;
            return;
        }
        container.innerHTML = flat.map((item) => {
            const ev = item.event;
            const eventName = api.getEventDisplayName(ev);
            const dates = api.getEventDates(ev).join(', ');
            const scopeLabel = item.scope === 'syllabus'
                ? t('eventScopeLabelSyllabus').replace('{name}', item.projectName || '')
                : t('eventScopeLabelTermWide');
            return `<button type="button" class="cal-event-list-item" data-event-id="${escapeHtml(ev.id)}"
                data-scope="${item.scope}" data-project-id="${escapeHtml(item.projectId || '')}">
                <span class="cal-event-list-swatch" style="background:${escapeHtml(ev.bgColor)}"></span>
                <span class="cal-event-list-main">
                    <strong>${escapeHtml(eventName)}</strong>
                    <span class="section-hint">${escapeHtml(dates)} · ${escapeHtml(scopeLabel)}</span>
                </span></button>`;
        }).join('');
        container.querySelectorAll('.cal-event-list-item').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.eventId;
                const scope = btn.dataset.scope;
                const pid = btn.dataset.projectId;
                let event = null;
                if (scope === 'syllabus') {
                    const proj = store.getProject(pid);
                    event = (proj && proj.events || []).find((e) => e.id === id);
                } else {
                    event = (data.events || []).find((e) => e.id === id);
                }
                openModal({ event, scope, projectId: pid, eventScope: scope });
            });
        });
    }

    global.CCPCompanionEventsUI = {
        ensureModal,
        openModal,
        openNewSharedEvent,
        closeModal,
        renderEventList,
        applyEventModalI18n
    };
})(typeof window !== 'undefined' ? window : globalThis);
