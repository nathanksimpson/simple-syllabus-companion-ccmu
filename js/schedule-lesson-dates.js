/**
 * Lesson date scheduling for Syllabus Companion (sequential term).
 * window.CCPScheduleLessonDates
 */
(function (global) {
    const utils = global.CCPUtils || {};
    const parseISODateLocal = utils.parseISODateLocal || function (s) {
        const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return new Date(NaN);
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    };
    const formatDateISO = utils.formatDateISO || function (date) {
        const d = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const DAY_SHORT_KEYS = ['dayShortSun', 'dayShortMon', 'dayShortTue', 'dayShortWed', 'dayShortThu', 'dayShortFri', 'dayShortSat'];

    function getDayShortLabels() {
        if (typeof global.__companionT === 'function') {
            return DAY_SHORT_KEYS.map((key) => global.__companionT(key));
        }
        return ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];
    }

    function formatMeetingDaysShort(days) {
        const labels = getDayShortLabels();
        return normalizeMeetingDaysArray(days)
            .map((d) => labels[d] || String(d))
            .join('');
    }

    const SCHEDULE_TEMPLATES = {
        mwf: { id: 'mwf', days: [1, 3, 5] },
        tt: { id: 'tt', days: [2, 4] }
    };

    function normalizeMeetingDaysArray(days) {
        if (!Array.isArray(days)) return [];
        return [...new Set(days.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b);
    }

    function meetingDaysEqual(a, b) {
        const left = normalizeMeetingDaysArray(a);
        const right = normalizeMeetingDaysArray(b);
        if (left.length !== right.length) return false;
        return left.every((day, i) => day === right[i]);
    }

    function combinationsOfSize(items, size) {
        if (size <= 0) return size === 0 ? [[]] : [];
        if (items.length < size) return [];
        const [first, ...rest] = items;
        const withFirst = combinationsOfSize(rest, size - 1).map((combo) => [first, ...combo]);
        const withoutFirst = combinationsOfSize(rest, size);
        return withFirst.concat(withoutFirst);
    }

    /** All 2-day subsets when 3+ days; the single schedule when exactly 2 days. */
    function getTwoPerWeekMeetingCombinations(meetingDays) {
        const normalized = normalizeMeetingDaysArray(meetingDays);
        if (normalized.length < 2) return [];
        if (normalized.length === 2) return [normalized];
        return combinationsOfSize(normalized, 2);
    }

    function getScheduleTemplateDays(templateId) {
        const key = String(templateId || '').trim().toLowerCase();
        return SCHEDULE_TEMPLATES[key] ? [...SCHEDULE_TEMPLATES[key].days] : [];
    }

    function inferScheduleTemplate(meetingDays) {
        const normalized = normalizeMeetingDaysArray(meetingDays);
        if (!normalized.length) return 'mwf';
        const mwf = SCHEDULE_TEMPLATES.mwf.days;
        const tt = SCHEDULE_TEMPLATES.tt.days;
        if (normalized.every((day) => mwf.includes(day)) && !normalized.some((day) => tt.includes(day))) {
            return 'mwf';
        }
        if (normalized.every((day) => tt.includes(day)) && !normalized.some((day) => mwf.includes(day))) {
            return 'tt';
        }
        return 'custom';
    }

    function inferMeetingsPerWeek(project) {
        if (project && project.parentProjectId) {
            return normalizeMeetingDaysArray(project.meetingDays).length || 1;
        }
        const days = normalizeMeetingDaysArray(project?.meetingDays);
        if (days.length === 1) return 1;
        if (days.length === 2) return 2;
        return 2;
    }

    function resolveProjectScheduleConfig(project) {
        const templateId = project?.classScheduleTemplate
            || inferScheduleTemplate(project?.meetingDays);
        const meetingsPerWeek = Number(project?.meetingsPerWeek) === 1 ? 1 : (
            Number(project?.meetingsPerWeek) === 2 ? 2 : inferMeetingsPerWeek(project)
        );
        const poolDays = templateId === 'custom'
            ? normalizeMeetingDaysArray(project?.meetingDays)
            : getScheduleTemplateDays(templateId);
        return {
            templateId,
            meetingsPerWeek,
            poolDays
        };
    }

    /**
     * Syllabus meeting-day sets to generate from a schedule template + weekly frequency.
     * 1x/week: one syllabus per weekday in the pool (M, W, F or T, R).
     * 2x/week: every 2-day combination from the pool (MW, MF, WF or TR).
     */
    function getScheduleVariantMeetingDays(templateId, meetingsPerWeek, customDays) {
        const mpw = Number(meetingsPerWeek) === 1 ? 1 : 2;
        const pool = templateId === 'custom'
            ? normalizeMeetingDaysArray(customDays)
            : getScheduleTemplateDays(templateId);
        if (!pool.length) return [];
        if (mpw === 1) {
            return pool.map((day) => [day]);
        }
        if (pool.length < 2) return [];
        if (pool.length === 2) return [pool];
        return combinationsOfSize(pool, 2);
    }

    function getScheduleVariantsForProject(project) {
        const config = resolveProjectScheduleConfig(project);
        return getScheduleVariantMeetingDays(
            config.templateId,
            config.meetingsPerWeek,
            project?.meetingDays
        );
    }

    /**
     * Actual meeting days for one class from template + meetings/week.
     * Preserves days that still fit the pool when possible; otherwise fills from the pool.
     */
    function defaultMeetingDaysForSchedule(templateId, meetingsPerWeek, existingDays) {
        const mpw = Number(meetingsPerWeek) === 1 ? 1 : 2;
        const pool = templateId === 'custom'
            ? normalizeMeetingDaysArray(existingDays)
            : getScheduleTemplateDays(templateId);
        if (!pool.length) {
            return normalizeMeetingDaysArray(existingDays);
        }
        const existing = normalizeMeetingDaysArray(existingDays).filter((day) => pool.includes(day));
        if (existing.length === mpw) {
            return existing;
        }
        if (existing.length > mpw) {
            return existing.slice(0, mpw);
        }
        const result = existing.slice();
        pool.forEach((day) => {
            if (result.length >= mpw) return;
            if (!result.includes(day)) result.push(day);
        });
        return normalizeMeetingDaysArray(result);
    }

    function syncTemplateMeetingDays(project) {
        if (!project || project.parentProjectId) {
            return normalizeMeetingDaysArray(project?.meetingDays);
        }
        const config = resolveProjectScheduleConfig(project);
        if (config.templateId === 'custom') {
            return normalizeMeetingDaysArray(project.meetingDays);
        }
        return defaultMeetingDaysForSchedule(
            config.templateId,
            config.meetingsPerWeek,
            project.meetingDays
        );
    }

    function getMeetingDaysFromClass(classData) {
        if (!classData) return [];
        return normalizeMeetingDaysArray(classData.meetingDays);
    }

    function sanitizeTotalLessons(value) {
        const parsed = parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed < 1) return 1;
        return parsed;
    }

    function collectAllMeetingDatesInRange(rangeStart, rangeEnd, meetingDays) {
        const set = new Set(normalizeMeetingDaysArray(meetingDays));
        if (set.size === 0) return [];
        const dates = [];
        const cur = new Date(rangeStart);
        while (cur <= rangeEnd) {
            if (set.has(cur.getDay())) {
                dates.push(new Date(cur));
            }
            cur.setDate(cur.getDate() + 1);
        }
        return dates;
    }

    function collectEligibleMeetingDates(rangeStart, rangeEnd, meetingDays, isHoliday) {
        return collectAllMeetingDatesInRange(rangeStart, rangeEnd, meetingDays).filter((d) => {
            const ds = formatDateISO(d);
            return !(typeof isHoliday === 'function' && isHoliday(ds));
        });
    }

    function enumerateMonthKeysBetween(startDateStr, endDateStr) {
        const start = parseISODateLocal(startDateStr);
        const end = parseISODateLocal(endDateStr);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
        const keys = [];
        const cur = new Date(start.getFullYear(), start.getMonth(), 1);
        const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
        while (cur <= endMonth) {
            keys.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
            cur.setMonth(cur.getMonth() + 1);
        }
        return keys;
    }

    function buildLessonGroups(totalLessons, mergeStarts) {
        const schedule = global.CCPSchedule;
        if (schedule && typeof schedule.buildLessonGroups === 'function') {
            return schedule.buildLessonGroups(totalLessons, mergeStarts || []);
        }
        const groups = [];
        const merges = Array.isArray(mergeStarts) ? mergeStarts : [];
        for (let day = 1; day <= totalLessons; day += 1) {
            if (merges.includes(day) && day < totalLessons) {
                groups.push({
                    start: day,
                    end: day + 1,
                    days: [day, day + 1],
                    label: `Day ${day} + ${day + 1}`,
                    compressed: true
                });
                day += 1;
            } else {
                groups.push({
                    start: day,
                    end: day,
                    days: [day],
                    label: `Day ${day}`,
                    compressed: false
                });
            }
        }
        return { groups, merges };
    }

    function buildScheduleGroupsForClass(classData, totalLessons) {
        const scheduleApi = global.CCPSchedule;
        const merges = getCompressionMergesFromClass(classData, totalLessons);
        const skips = getSkippedLessonsFromClass(classData, totalLessons);
        const labelFn = (group) => {
            if (group.compressed && group.end !== group.start) {
                return `Day ${group.start} + ${group.end}`;
            }
            return `Day ${group.start}`;
        };
        if (scheduleApi && typeof scheduleApi.buildScheduleGroups === 'function') {
            return scheduleApi.buildScheduleGroups(totalLessons, merges, skips, labelFn);
        }
        return buildLessonGroups(totalLessons, merges);
    }

    const SCHEDULE_MODEL_DEBATE_MONTHLY = 'debateMonthly';

    function classUsesDebateCompression(classData) {
        return (classData && classData.scheduleModel) === SCHEDULE_MODEL_DEBATE_MONTHLY;
    }

    function normalizeCompressionMerges(mergeStarts, totalLessons) {
        if (global.CCPSchedule && global.CCPSchedule.normalizeCompressionMerges) {
            return global.CCPSchedule.normalizeCompressionMerges(mergeStarts, totalLessons);
        }
        return Array.isArray(mergeStarts) ? mergeStarts : [];
    }

    function getCompressionMergesFromClass(classData, totalLessons) {
        if (classData && Array.isArray(classData.compressionMerges)) {
            return normalizeCompressionMerges(classData.compressionMerges, totalLessons);
        }
        return [];
    }

    function getCompressionMergesForPeriod(classData, period, totalLessons) {
        if (!period) {
            return getCompressionMergesFromClass(classData, totalLessons);
        }
        if (classData.compressionMode === 'manualPerMonth') {
            const byPeriod = classData.compressionMergesByPeriod && typeof classData.compressionMergesByPeriod === 'object'
                ? classData.compressionMergesByPeriod
                : {};
            if (Array.isArray(byPeriod[period.id])) {
                return normalizeCompressionMerges(byPeriod[period.id], totalLessons);
            }
            return [];
        }
        if (classData.compressionMode === 'manual') {
            return getCompressionMergesFromClass(classData, totalLessons);
        }
        return [];
    }

    function getSkippedLessonsFromClass(classData, totalLessons) {
        if (!classData || !Array.isArray(classData.skippedLessons)) {
            return [];
        }
        if (global.CCPSchedule && global.CCPSchedule.normalizeSkippedLessons) {
            return global.CCPSchedule.normalizeSkippedLessons(classData.skippedLessons, totalLessons);
        }
        return classData.skippedLessons
            .map(Number)
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= totalLessons)
            .sort((a, b) => a - b);
    }

    function resolveScheduleGroupsForClass(classData, availableSlots, options) {
        options = options || {};
        const totalLessons = sanitizeTotalLessons(classData.totalLessons || 8);
        const period = options.period || null;
        const scheduleApi = global.CCPSchedule;

        if (classUsesDebateCompression(classData) && period) {
            const userMerges = getCompressionMergesFromClass(classData, totalLessons);
            const mode = classData.compressionMode === 'manual' ? 'manual' : 'autoWhenNeeded';
            const mergesForPeriod = classData.compressionMode === 'manualPerMonth'
                ? getCompressionMergesForPeriod(classData, period, totalLessons)
                : userMerges;
            const effectiveMode = classData.compressionMode === 'manualPerMonth' ? 'manual' : mode;
            let mergesForPlan = mergesForPeriod;
            if (scheduleApi && scheduleApi.mergePlanToFit) {
                mergesForPlan = scheduleApi.mergePlanToFit(
                    availableSlots,
                    totalLessons,
                    mergesForPeriod,
                    effectiveMode,
                    null
                );
            }
            return buildScheduleGroupsForClass(
                { ...classData, compressionMerges: mergesForPlan },
                totalLessons
            );
        }

        return buildScheduleGroupsForClass(classData, totalLessons);
    }

    function ensureDebatePeriodsOnClass(classData) {
        const debateApi = global.CCPDebatePeriods;
        if (!classData || !classUsesDebateCompression(classData) || !debateApi) {
            return [];
        }
        return debateApi.ensureDebateBookPeriodsForClass(classData);
    }

    function suggestDebatePeriodsFromTerm(classData) {
        const debateApi = global.CCPDebatePeriods;
        if (!debateApi || !classData) return [];
        return debateApi.suggestPeriodsFromCalendarMonths(
            classData.startDate,
            classData.endDate,
            classData.book || 'Debate'
        );
    }

    function calculateDebateMonthlyLessonDates(classData, options) {
        options = options || {};
        const isHoliday = options.isHoliday || ((ds) => defaultIsHoliday(ds, classData));
        const meetingDays = getMeetingDaysFromClass(classData);
        const totalLessons = sanitizeTotalLessons(classData.totalLessons || 4);
        const userMerges = getCompressionMergesFromClass(classData, totalLessons);
        const mode = classData.compressionMode === 'manual' ? 'manual' : 'autoWhenNeeded';

        if (meetingDays.length === 0) {
            const { groups } = buildScheduleGroupsForClass(classData, totalLessons);
            return {
                lessons: [],
                compressed: false,
                availableCount: 0,
                scheduleModel: SCHEDULE_MODEL_DEBATE_MONTHLY,
                groups,
                totalGroups: groups.length,
                scheduledCount: 0,
                selectedMerges: userMerges,
                periodDetails: []
            };
        }

        const classStart = parseISODateLocal(classData.startDate);
        const classEnd = parseISODateLocal(classData.endDate);
        if (Number.isNaN(classStart.getTime()) || Number.isNaN(classEnd.getTime())) {
            const { groups } = buildScheduleGroupsForClass(classData, totalLessons);
            return {
                lessons: [],
                compressed: false,
                availableCount: 0,
                scheduleModel: SCHEDULE_MODEL_DEBATE_MONTHLY,
                groups,
                totalGroups: groups.length,
                scheduledCount: 0,
                selectedMerges: userMerges,
                periodDetails: []
            };
        }

        ensureDebatePeriodsOnClass(classData);
        const debateApi = global.CCPDebatePeriods;
        const periods = debateApi
            ? debateApi.enumerateDebatePeriodsInTerm(classData)
            : [];
        const lessons = [];
        const periodDetails = [];

        periods.forEach((period) => {
            const rangeStart = parseISODateLocal(period.rangeStartDate);
            const rangeEnd = parseISODateLocal(period.rangeEndDate);
            if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeStart > rangeEnd) {
                return;
            }

            const eligible = collectEligibleMeetingDates(rangeStart, rangeEnd, meetingDays, isHoliday);
            const slotCount = eligible.length;
            const effectiveMode = classData.compressionMode === 'manualPerMonth' ? 'manual' : mode;
            const { groups, merges: appliedMerges } = resolveScheduleGroupsForClass(
                classData,
                slotCount,
                { period }
            );
            const autoAdjusted = effectiveMode === 'autoWhenNeeded' && appliedMerges.length > 0;
            const scheduleCount = Math.min(groups.length, slotCount);
            const book = period.book || classData.book || '';

            for (let i = 0; i < scheduleCount; i += 1) {
                const group = groups[i];
                const date = eligible[i];
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                lessons.push({
                    date,
                    label: group.label,
                    compressed: group.compressed,
                    group,
                    monthKey,
                    book,
                    periodId: period.id,
                    periodStartDate: period.startDate
                });
            }

            periodDetails.push({
                periodId: period.id,
                startDate: period.startDate,
                book,
                eligibleCount: slotCount,
                mergesUsed: appliedMerges,
                autoAdjusted,
                scheduledInMonth: scheduleCount,
                totalGroups: groups.length,
                monthKey: period.startDate.slice(0, 7)
            });
        });

        const templateMerges = mode === 'autoWhenNeeded' ? [] : userMerges;
        const { groups: templateGroups } = buildScheduleGroupsForClass(
            { ...classData, compressionMerges: templateMerges },
            totalLessons
        );

        return {
            lessons,
            compressed: lessons.some((l) => l.compressed),
            availableCount: periodDetails.reduce((sum, d) => sum + d.eligibleCount, 0),
            scheduleModel: SCHEDULE_MODEL_DEBATE_MONTHLY,
            groups: templateGroups,
            totalGroups: templateGroups.length,
            scheduledCount: lessons.length,
            selectedMerges: userMerges,
            periodDetails,
            monthlyDetails: periodDetails
        };
    }

    function getUnscheduledLessonNumbers(classData, schedule) {
        const totalLessons = sanitizeTotalLessons(classData.totalLessons || 8);
        const skippedSet = new Set(getSkippedLessonsFromClass(classData, totalLessons));
        const placed = new Set();
        (schedule.lessons || []).forEach((lesson) => {
            if (lesson.group && Array.isArray(lesson.group.days)) {
                lesson.group.days.forEach((d) => placed.add(d));
            } else if (lesson.group && lesson.group.start) {
                placed.add(lesson.group.start);
                if (lesson.compressed && lesson.group.end) {
                    placed.add(lesson.group.end);
                }
            }
        });
        const nums = [];
        for (let n = 1; n <= totalLessons; n += 1) {
            if (!skippedSet.has(n) && !placed.has(n)) {
                nums.push(n);
            }
        }
        return nums;
    }

    /**
     * Per book-period Day 1–4 cycle fit for debateMonthly classes.
     * Complete = all groups placed; compressed = placed via merge; incomplete = content cut.
     */
    function getDebatePeriodCompleteness(classData, options) {
        options = options || {};
        const schedule = options.schedule || calculateDebateMonthlyLessonDates(classData, options);
        const periodDetails = schedule.periodDetails || schedule.monthlyDetails || [];
        const periodStatuses = periodDetails.map((detail) => {
            const eligibleCount = detail.eligibleCount != null ? detail.eligibleCount : 0;
            const scheduledInMonth = detail.scheduledInMonth != null ? detail.scheduledInMonth : 0;
            const totalGroups = detail.totalGroups != null ? detail.totalGroups : 0;
            const mergesUsed = Array.isArray(detail.mergesUsed) ? detail.mergesUsed : [];
            const cut = eligibleCount === 0 || scheduledInMonth < totalGroups;
            let status = 'complete';
            if (cut) {
                status = 'incomplete';
            } else if (detail.autoAdjusted || mergesUsed.length > 0) {
                status = 'compressed';
            }
            return {
                periodId: detail.periodId || '',
                startDate: detail.startDate || '',
                monthKey: detail.monthKey || (detail.startDate ? String(detail.startDate).slice(0, 7) : ''),
                book: detail.book || '',
                eligibleCount,
                scheduledInMonth,
                totalGroups,
                mergesUsed,
                autoAdjusted: !!detail.autoAdjusted,
                status,
                incomplete: status === 'incomplete',
                compressed: status === 'compressed'
            };
        });
        const incompletePeriods = periodStatuses.filter((p) => p.incomplete);
        const compressedPeriods = periodStatuses.filter((p) => p.compressed);
        return {
            periodStatuses,
            incompletePeriods,
            compressedPeriods,
            incomplete: incompletePeriods.length > 0,
            allCompressedOnly: incompletePeriods.length === 0 && compressedPeriods.length > 0
        };
    }

    function getClassScheduleGapStatus(classData, options) {
        options = options || {};
        const schedule = calculateLessonDates(classData, options);
        const totalLessons = sanitizeTotalLessons(classData.totalLessons || 8);
        const skipped = getSkippedLessonsFromClass(classData, totalLessons);
        const unplaced = getUnscheduledLessonNumbers(classData, schedule);
        const { groups } = buildScheduleGroupsForClass(classData, totalLessons);
        const periodDetails = schedule.periodDetails || schedule.monthlyDetails || [];
        const base = {
            scheduledCount: (schedule.lessons || []).length,
            requiredCount: groups.length,
            totalLessons,
            unplacedLessonNumbers: unplaced,
            skippedLessons: skipped,
            availableCount: schedule.availableCount != null ? schedule.availableCount : 0,
            periodDetails,
            periodStatuses: [],
            incompletePeriods: [],
            compressedPeriods: [],
            allCompressedOnly: false
        };

        if (classUsesDebateCompression(classData)) {
            const debateFit = getDebatePeriodCompleteness(classData, { ...options, schedule });
            return {
                ...base,
                incomplete: debateFit.incomplete,
                periodStatuses: debateFit.periodStatuses,
                incompletePeriods: debateFit.incompletePeriods,
                compressedPeriods: debateFit.compressedPeriods,
                allCompressedOnly: debateFit.allCompressedOnly
            };
        }

        return {
            ...base,
            incomplete: unplaced.length > 0
        };
    }

    function proposeScheduleAdjustments(classData, options) {
        options = options || {};
        const scheduleApi = global.CCPSchedule;
        if (!scheduleApi || !scheduleApi.proposeScheduleFit) {
            return { merges: [], skipped: [], canFullyFit: true };
        }
        const totalLessons = sanitizeTotalLessons(classData.totalLessons || 8);
        const gap = getClassScheduleGapStatus(classData, options);
        if (!gap.incomplete) {
            return {
                merges: getCompressionMergesFromClass(classData, totalLessons),
                skipped: gap.skippedLessons,
                canFullyFit: true
            };
        }
        if (classUsesDebateCompression(classData)) {
            const periodGaps = (gap.incompletePeriods && gap.incompletePeriods.length
                ? gap.incompletePeriods
                : (gap.periodDetails || [])
            ).filter((p) => p.totalGroups > p.eligibleCount || p.eligibleCount === 0);
            if (!periodGaps.length) {
                return {
                    merges: getCompressionMergesFromClass(classData, totalLessons),
                    skipped: gap.skippedLessons,
                    canFullyFit: false
                };
            }
            const worst = periodGaps.reduce((a, b) => (
                (b.totalGroups - b.eligibleCount) > (a.totalGroups - a.eligibleCount) ? b : a
            ));
            return scheduleApi.proposeScheduleFit(worst.eligibleCount, totalLessons, {});
        }
        return scheduleApi.proposeScheduleFit(gap.availableCount, totalLessons, {});
    }

    function calculateSequentialTermLessonDates(classData, options) {
        options = options || {};
        const isHoliday = options.isHoliday;
        const meetingDays = getMeetingDaysFromClass(classData);
        const totalLessons = sanitizeTotalLessons(classData.totalLessons || 8);

        if (meetingDays.length === 0) {
            return {
                lessons: [],
                compressed: false,
                availableCount: 0,
                scheduleModel: 'sequentialTerm',
                groups: [],
                totalGroups: totalLessons,
                scheduledCount: 0
            };
        }

        const classStart = parseISODateLocal(classData.startDate);
        const classEnd = parseISODateLocal(classData.endDate);
        if (Number.isNaN(classStart.getTime()) || Number.isNaN(classEnd.getTime())) {
            return {
                lessons: [],
                compressed: false,
                availableCount: 0,
                scheduleModel: 'sequentialTerm',
                groups: [],
                totalGroups: totalLessons,
                scheduledCount: 0
            };
        }

        const allEligible = collectEligibleMeetingDates(classStart, classEnd, meetingDays, isHoliday);
        const { groups } = buildScheduleGroupsForClass(classData, totalLessons);
        const lessons = [];
        const scheduleCount = Math.min(groups.length, allEligible.length);
        for (let i = 0; i < scheduleCount; i += 1) {
            const group = groups[i];
            const d = allEligible[i];
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            lessons.push({
                date: d,
                label: group.label || `Day ${group.start}`,
                compressed: group.compressed,
                group,
                monthKey,
                book: classData.book || ''
            });
        }

        return {
            lessons,
            compressed: lessons.some((l) => l.compressed),
            availableCount: allEligible.length,
            scheduleModel: 'sequentialTerm',
            groups,
            totalGroups: groups.length,
            scheduledCount: lessons.length
        };
    }

    function calculateLessonDates(classData, options) {
        options = options || {};
        if (classUsesDebateCompression(classData)) {
            return calculateDebateMonthlyLessonDates(classData, options);
        }
        return calculateSequentialTermLessonDates(classData, options);
    }

    function defaultIsHoliday(dateStr, classData) {
        const api = global.CCPCalendarEvents;
        const store = global.CCPCompanionStore;
        if (!api || !store || !classData || !classData.id) {
            return false;
        }
        const project = store.getProject(classData.id);
        if (!project) return false;
        return api.hasBlockingEventOnDate(dateStr, project, store.getData());
    }

    global.CCPScheduleLessonDates = {
        calculateLessonDates,
        calculateSequentialTermLessonDates,
        collectEligibleMeetingDates,
        collectAllMeetingDatesInRange,
        getMeetingDaysFromClass,
        normalizeMeetingDaysArray,
        meetingDaysEqual,
        formatMeetingDaysShort,
        getTwoPerWeekMeetingCombinations,
        SCHEDULE_TEMPLATES,
        getScheduleTemplateDays,
        inferScheduleTemplate,
        inferMeetingsPerWeek,
        resolveProjectScheduleConfig,
        getScheduleVariantMeetingDays,
        getScheduleVariantsForProject,
        defaultMeetingDaysForSchedule,
        syncTemplateMeetingDays,
        sanitizeTotalLessons,
        enumerateMonthKeysBetween,
        formatDateISO,
        parseISODateLocal,
        defaultIsHoliday,
        classUsesDebateCompression,
        SCHEDULE_MODEL_DEBATE_MONTHLY,
        getCompressionMergesFromClass,
        getCompressionMergesForPeriod,
        getSkippedLessonsFromClass,
        resolveScheduleGroupsForClass,
        ensureDebatePeriodsOnClass,
        suggestDebatePeriodsFromTerm,
        calculateDebateMonthlyLessonDates,
        getUnscheduledLessonNumbers,
        getDebatePeriodCompleteness,
        getClassScheduleGapStatus,
        proposeScheduleAdjustments,
        buildScheduleGroupsForClass
    };
})(typeof window !== 'undefined' ? window : globalThis);
