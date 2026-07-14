/**
 * Month grid calendar for Syllabus Companion (ClassManager markup).
 * window.CCPCompanionCalendarView
 */
(function (global) {
    const DAY_HEADER_KEYS = ['daySun', 'dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat'];

    function t(key) {
        if (typeof global.__companionT === 'function') return global.__companionT(key);
        return key;
    }

    function getLocale() {
        const lang = global.__companionLang || 'en';
        return lang === 'ko' ? 'ko-KR' : 'en-US';
    }

    function getDayHeaders() {
        return DAY_HEADER_KEYS.map((key) => t(key));
    }

    function parseDate(s) {
        if (global.CCPUtils) return global.CCPUtils.parseISODateLocal(s);
        const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return new Date(NaN);
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }

    function fmt(d) {
        if (global.CCPUtils) return global.CCPUtils.formatDateISO(d);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function escapeHtml(s) {
        return global.CCPUtils ? global.CCPUtils.escapeHtml(s) : String(s ?? '');
    }

    function enumerateMonths(startStr, endStr) {
        const start = parseDate(startStr);
        const end = parseDate(endStr);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
        const months = [];
        const cur = new Date(start.getFullYear(), start.getMonth(), 1);
        const last = new Date(end.getFullYear(), end.getMonth(), 1);
        while (cur <= last) {
            months.push({ year: cur.getFullYear(), month: cur.getMonth() });
            cur.setMonth(cur.getMonth() + 1);
        }
        return months;
    }

    function eventsOnDate(dateStr, data, projectFilter, activeProject) {
        const api = global.CCPCalendarEvents;
        if (!api) return [];
        const out = [];
        api.getSharedEvents(data).forEach((ev) => {
            if (!api.getEventDates(ev).includes(dateStr)) return;
            if (projectFilter === 'active' && activeProject) {
                if (!api.eventAppliesToProject(ev, activeProject)) return;
            }
            out.push({ event: ev, scope: 'shared' });
        });
        const projects = data.projects || [];
        projects.forEach((proj) => {
            if (projectFilter === 'active' && activeProject && proj.id !== activeProject.id) {
                return;
            }
            api.getProjectEvents(proj).forEach((ev) => {
                if (api.getEventDates(ev).includes(dateStr)) {
                    out.push({ event: ev, scope: 'syllabus', projectName: proj.name });
                }
            });
        });
        return out;
    }

    function resolveClassShape(project) {
        const engine = global.CCPCompanionSyllabus;
        const store = global.CCPCompanionStore;
        if (engine && engine.projectToClassShape && store) {
            return engine.projectToClassShape(project, store.getAppDataShape());
        }
        return project;
    }

    function buildScheduledLessonsByDate(project, data) {
        const map = Object.create(null);
        if (!project || !global.CCPScheduleLessonDates) return map;
        const classData = resolveClassShape(project);
        const holidayFn = (dateStr) => {
            const api = global.CCPCalendarEvents;
            if (!api || !data) return false;
            return api.hasBlockingEventOnDate(dateStr, project, data);
        };
        let result;
        try {
            result = global.CCPScheduleLessonDates.calculateLessonDates(classData, {
                isHoliday: holidayFn
            });
        } catch (err) {
            console.error('Calendar lesson schedule failed', err);
            return map;
        }
        const lessons = (result && result.lessons) || [];
        lessons.forEach((lesson) => {
            const dateStr = lesson.date instanceof Date
                ? fmt(lesson.date)
                : String(lesson.date || '');
            if (!dateStr) return;
            if (!map[dateStr]) map[dateStr] = [];
            map[dateStr].push(lesson);
        });
        return map;
    }

    function lessonLabelForBar(lesson) {
        if (!lesson) return '';
        if (lesson.label) return String(lesson.label);
        const days = lesson.group && Array.isArray(lesson.group.days) ? lesson.group.days : null;
        if (days && days.length === 1) return `Day ${days[0]}`;
        if (days && days.length > 1) return `Day ${days[0]}-${days[days.length - 1]}`;
        if (lesson.lessonNum != null) return `Day ${lesson.lessonNum}`;
        return '';
    }

    function isLessonDay(dateStr, project, scheduledByDate) {
        if (!project) return false;
        if (scheduledByDate) {
            return !!(scheduledByDate[dateStr] && scheduledByDate[dateStr].length);
        }
        if (!global.CCPScheduleLessonDates) return false;
        const d = parseDate(dateStr);
        if (Number.isNaN(d.getTime())) return false;
        const days = global.CCPScheduleLessonDates.getMeetingDaysFromClass(project);
        if (!days.includes(d.getDay())) return false;
        const start = parseDate(project.startDate);
        const end = parseDate(project.endDate || project.startDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
        if (d < start || d > end) return false;
        const api = global.CCPCalendarEvents;
        const store = global.CCPCompanionStore;
        if (api && store && api.hasBlockingEventOnDate(dateStr, project, store.getData())) {
            return false;
        }
        return true;
    }

    function renderMonth(year, month, options) {
        const { data, projectFilter, activeProject, scheduledByDate } = options;
        const first = new Date(year, month, 1);
        const last = new Date(year, month + 1, 0);
        const monthLabel = first.toLocaleString(getLocale(), { month: 'long', year: 'numeric' });
        const firstDay = first.getDay();
        const daysInMonth = last.getDate();
        const prevMonthDays = new Date(year, month, 0).getDate();
        const api = global.CCPCalendarEvents;
        const cells = [];

        for (let i = firstDay - 1; i >= 0; i -= 1) {
            cells.push(renderDayCell(prevMonthDays - i, true, '', [], options));
        }
        for (let day = 1; day <= daysInMonth; day += 1) {
            const dateStr = fmt(new Date(year, month, day));
            const evs = eventsOnDate(dateStr, data, projectFilter, activeProject);
            cells.push(renderDayCell(day, false, dateStr, evs, options));
        }
        const totalCells = firstDay + daysInMonth;
        const remaining = (7 - (totalCells % 7)) % 7;
        for (let i = 1; i <= remaining; i += 1) {
            cells.push(renderDayCell(i, true, '', [], options));
        }

        const weekRows = Math.ceil(cells.length / 7);
        let weekdayHtml = '';
        const dayHeaders = getDayHeaders();
        dayHeaders.forEach((h) => {
            weekdayHtml += `<div class="calendar-day-header">${escapeHtml(h)}</div>`;
        });

        return `<div class="month-calendar month-calendar-card" data-year="${year}" data-month="${month}"
            style="--calendar-week-rows:${weekRows}" data-week-rows="${weekRows}">
            <div class="month-header month-card-header">
                <div class="month-card-header__title-wrap"><h2>${escapeHtml(monthLabel)}</h2></div>
            </div>
            <div class="calendar-grid">${weekdayHtml}${cells.join('')}</div>
        </div>`;
    }

    function renderDayCell(dayNumber, isOtherMonth, dateStr, evs, options) {
        const { activeProject, scheduledByDate } = options;
        const api = global.CCPCalendarEvents;
        const classes = ['calendar-day'];
        if (isOtherMonth) classes.push('other-month');
        const blocking = !isOtherMonth && api
            ? evs.find((e) => api.eventTypeBlocksClass(e.event.type))
            : null;
        let style = '';
        if (blocking) {
            const blockType = api.normalizeEventType(blocking.event.type);
            classes.push(blockType === 'holiday' ? 'holiday' : 'has-eval-period');
            classes.push(`cal-item-${blockType}`);
            style = ` style="background-color:${escapeHtml(blocking.event.bgColor || '#fef3c7')}"`;
        }
        const dayLessons = (!isOtherMonth && activeProject && scheduledByDate)
            ? (scheduledByDate[dateStr] || [])
            : [];
        const lesson = dayLessons.length > 0
            || (!isOtherMonth && activeProject && !scheduledByDate && isLessonDay(dateStr, activeProject));
        if (lesson) classes.push('companion-lesson-day');

        let inner = `<div class="calendar-day-top"><div class="day-number">${dayNumber}</div></div>`;

        if (blocking) {
            const textColor = blocking.event.textColor || '';
            const colorStyle = textColor ? ` style="color:${escapeHtml(textColor)}"` : '';
            const blockingName = api.getEventDisplayName(blocking.event);
            inner += `<div class="holiday-name cal-item-${escapeHtml(api.normalizeEventType(blocking.event.type))}"${colorStyle}
                data-event-id="${escapeHtml(blocking.event.id)}" data-scope="${escapeHtml(blocking.scope)}"
                title="${escapeHtml(blockingName)}">${escapeHtml(blockingName)}</div>`;
        }

        const chips = evs.filter((e) => !api || !api.eventTypeBlocksClass(e.event.type));
        if (chips.length) {
            inner += '<div class="calendar-event-chips">';
            chips.slice(0, 2).forEach((item) => {
                const ev = item.event;
                const eventName = api.getEventDisplayName(ev);
                const scopeMark = item.scope === 'syllabus' ? '· ' : '';
                inner += `<div class="calendar-event-chip event-type-${escapeHtml(ev.type)}"
                    data-event-id="${escapeHtml(ev.id)}" data-scope="${escapeHtml(item.scope)}"
                    style="background:${escapeHtml(ev.bgColor || '#eee')};color:${escapeHtml(ev.textColor || '#333')}"
                    title="${escapeHtml(eventName)}">${scopeMark}${escapeHtml((eventName || '').slice(0, 14))}</div>`;
            });
            if (chips.length > 2) {
                inner += `<span class="event-bar-more">+${chips.length - 2}</span>`;
            }
            inner += '</div>';
        }

        if (lesson && activeProject) {
            const accent = activeProject.color || '#356a9e';
            const palette = global.CCPClassColorPalette;
            const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            const chip = palette ? palette.chipStyle(accent, theme) : null;
            const barStyle = chip
                ? ` style="border-left:${chip.borderLeft};background:${chip.background};color:${chip.color}"`
                : ` style="--lesson-accent:${escapeHtml(accent)}"`;
            const firstLesson = dayLessons[0];
            const lessonTag = lessonLabelForBar(firstLesson);
            const titleBase = activeProject.name || t('calLessonFallback');
            const barTitle = lessonTag ? `${titleBase} — ${lessonTag}` : titleBase;
            const titleText = lessonTag
                ? `${(titleBase).slice(0, 12)} ${lessonTag}`
                : titleBase.slice(0, 18);
            inner += `<div class="day-events"><div class="event-bar event-bar--calm event-bar--project"${barStyle} title="${escapeHtml(barTitle)}">
                <span class="companion-lesson-dot" style="background:${escapeHtml(accent)}"></span>
                <span class="event-title">${escapeHtml(titleText)}</span>
            </div></div>`;
        }

        const dataDate = !isOtherMonth && dateStr ? ` data-date="${dateStr}"` : '';
        return `<div class="${classes.join(' ')}"${dataDate}${style}>${inner}</div>`;
    }

    function render(container, options) {
        if (!container) return;
        const data = options.data || global.CCPCompanionStore.getData();
        const start = options.displayStart || data.calendarDisplayStart;
        const end = options.displayEnd || data.calendarDisplayEnd;
        const months = enumerateMonths(start, end);
        container.classList.add('calendar-container');
        if (!months.length) {
            container.innerHTML = `<p class="section-hint">${escapeHtml(t('calSetDateRange'))}</p>`;
            return;
        }
        const activeProject = options.activeProject || null;
        const scheduledByDate = activeProject
            ? buildScheduledLessonsByDate(activeProject, data)
            : Object.create(null);
        container.innerHTML = months.map((m) => renderMonth(m.year, m.month, {
            ...options,
            data,
            scheduledByDate
        })).join('');

        container.querySelectorAll('.calendar-day[data-date]').forEach((dayEl) => {
            dayEl.addEventListener('click', (e) => {
                if (e.target.closest('.calendar-event-chip, .holiday-name')) return;
                if (typeof options.onDayClick === 'function') {
                    options.onDayClick(dayEl.dataset.date);
                }
            });
        });
        container.querySelectorAll('[data-event-id]').forEach((chip) => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof options.onEventClick === 'function') {
                    options.onEventClick(chip.dataset.eventId, chip.dataset.scope);
                }
            });
        });
    }

    global.CCPCompanionCalendarView = {
        render,
        enumerateMonths,
        eventsOnDate,
        isLessonDay,
        buildScheduledLessonsByDate
    };
})(typeof window !== 'undefined' ? window : globalThis);
