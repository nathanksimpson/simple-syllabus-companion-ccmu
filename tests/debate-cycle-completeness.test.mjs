import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadDebateApis() {
    const sandbox = { window: {}, globalThis: {}, console };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    const files = [
        'vendor/ccmu/js/schedule-core.js',
        'vendor/ccmu/js/debate-periods.js',
        'js/schedule-lesson-dates.js'
    ];
    files.forEach((rel) => {
        const code = fs.readFileSync(path.join(root, rel), 'utf8');
        vm.runInNewContext(code, sandbox);
    });
    return {
        schedule: sandbox.CCPScheduleLessonDates,
        debate: sandbox.CCPDebatePeriods
    };
}

function baseDebateClass(overrides) {
    return {
        id: 'proj-debate',
        scheduleModel: 'debateMonthly',
        compressionMode: 'autoWhenNeeded',
        totalLessons: 4,
        meetingDays: [3],
        startDate: '2026-03-01',
        endDate: '2026-05-31',
        book: 'Purple Debate',
        debateBookPeriods: [
            { id: 'p1', startDate: '2026-03-01', book: 'Purple Debate' },
            { id: 'p2', startDate: '2026-04-01', book: 'Purple Debate' },
            { id: 'p3', startDate: '2026-05-01', book: 'Purple Debate' }
        ],
        compressionMerges: [],
        skippedLessons: [],
        ...overrides
    };
}

describe('debate cycle completeness', () => {
    const { schedule: api } = loadDebateApis();

    it('marks all periods complete when each month has four meetings', () => {
        // Wednesdays: March / April / May 2026 each have 4 Wednesdays
        const gap = api.getClassScheduleGapStatus(baseDebateClass(), {
            isHoliday: () => false
        });
        assert.equal(gap.incomplete, false);
        assert.equal(gap.periodStatuses.length, 3);
        assert.ok(gap.periodStatuses.every((p) => p.status === 'complete'));
        assert.equal(gap.incompletePeriods.length, 0);
    });

    it('marks a short month as compressed when auto Day 2+3 fits', () => {
        // April 2026 has 5 Wednesdays; block 2 → 3 meetings → auto Day 2+3 compress
        const blocked = new Set(['2026-04-22', '2026-04-29']);
        const gap = api.getClassScheduleGapStatus(baseDebateClass(), {
            isHoliday: (ds) => blocked.has(ds)
        });
        assert.equal(gap.incomplete, false);
        const april = gap.periodStatuses.find((p) => p.monthKey === '2026-04');
        assert.ok(april);
        assert.equal(april.eligibleCount, 3);
        assert.equal(april.status, 'compressed');
        assert.equal(gap.allCompressedOnly, true);
    });

    it('marks a very short month incomplete even after auto-compress', () => {
        // April 2026 Wednesdays: 1, 8, 15, 22, 29. Block 4 → 1 remaining (cannot fit Day 1–4 cycle).
        const blocked = new Set(['2026-04-01', '2026-04-08', '2026-04-15', '2026-04-22']);
        const gap = api.getClassScheduleGapStatus(baseDebateClass(), {
            isHoliday: (ds) => blocked.has(ds)
        });
        assert.equal(gap.incomplete, true);
        const april = gap.incompletePeriods.find((p) => p.monthKey === '2026-04');
        assert.ok(april);
        assert.equal(april.status, 'incomplete');
        assert.ok(april.eligibleCount <= 2);
        // Earlier months already placed Day 1–4 would hide this with old global logic
        assert.equal(gap.unplacedLessonNumbers.length, 0);
    });

    it('keeps sequential (non-debate) gap logic term-wide by lesson number', () => {
        const gap = api.getClassScheduleGapStatus({
            id: 'proj-seq',
            scheduleModel: 'sequentialTerm',
            totalLessons: 8,
            meetingDays: [1, 3, 5],
            startDate: '2026-03-01',
            endDate: '2026-03-10',
            compressionMerges: [],
            skippedLessons: []
        }, { isHoliday: () => false });
        assert.equal(gap.incomplete, true);
        assert.ok(gap.unplacedLessonNumbers.length > 0);
        assert.equal((gap.periodStatuses || []).length, 0);
    });
});
