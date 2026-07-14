import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadCalendarEvents(extra = {}) {
    const metaCode = fs.readFileSync(path.join(root, 'js/class-metadata.js'), 'utf8');
    const code = fs.readFileSync(path.join(root, 'js/calendar-events.js'), 'utf8');
    const sandbox = { window: {}, globalThis: {}, ...extra };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(metaCode, sandbox);
    vm.runInNewContext(code, sandbox);
    return sandbox.CCPCalendarEvents;
}

describe('calendar events', () => {
    const api = loadCalendarEvents();

    it('blocks holiday and evaluation_period types', () => {
        assert.equal(api.eventTypeBlocksClass('holiday'), true);
        assert.equal(api.eventTypeBlocksClass('evaluation_period'), true);
        assert.equal(api.eventTypeBlocksClass('other'), false);
    });

    it('expands range events to dates', () => {
        const ev = api.normalizeEvent({
            type: 'evaluation_period',
            name: 'Midterms',
            isRange: true,
            startDate: '2026-03-02',
            endDate: '2026-03-04'
        });
        const dates = api.getEventDates(ev);
        assert.equal(dates.length, 3);
        assert.ok(dates.includes('2026-03-02'));
        assert.ok(dates.includes('2026-03-03'));
        assert.ok(dates.includes('2026-03-04'));
    });

    it('applies grade targeting to projects', () => {
        const project = { name: 'Simson 4A', grade: '초4', levelPreset: 'Blue' };
        const ev = api.normalizeEvent({
            type: 'holiday',
            name: 'Grade 4 only',
            date: '2026-05-05',
            grades: ['초4']
        });
        assert.equal(api.targetFilterAppliesToProject(ev, project), true);
        assert.equal(api.targetFilterAppliesToProject(ev, { ...project, grade: '중1' }), false);
    });

    it('applies Simson level targeting to projects', () => {
        const project = { name: 'Blue class', grade: '초4', levelPreset: 'Blue' };
        const ev = api.normalizeEvent({
            type: 'holiday',
            name: 'Blue only',
            date: '2026-05-05',
            sectionLevels: ['Blue']
        });
        assert.equal(api.targetFilterAppliesToProject(ev, project), true);
        assert.equal(api.targetFilterAppliesToProject(ev, { ...project, levelPreset: 'Red' }), false);
    });

    it('merges shared and per-syllabus events on a date', () => {
        const data = {
            events: [api.normalizeEvent({ type: 'holiday', name: 'Shared', date: '2026-05-05' })],
            projects: [{
                id: 'p1',
                name: 'Class A',
                grade: '초4',
                events: [api.normalizeEvent({ type: 'other', name: 'Local', date: '2026-05-05' })]
            }]
        };
        const project = data.projects[0];
        const hits = api.getEventsForProjectOnDate('2026-05-05', project, data);
        assert.equal(hits.length, 2);
        assert.equal(api.hasBlockingEventOnDate('2026-05-05', project, data), true);
    });

    it('migrates legacy holiday rows', () => {
        const ev = api.migrateHolidayToEvent({ date: '2026-01-01', title: "New Year's" });
        assert.equal(ev.type, 'holiday');
        assert.equal(ev.name, "New Year's");
        assert.equal(ev.date, '2026-01-01');
    });

    it('prefers localized bilingual event names', () => {
        const enApi = loadCalendarEvents({ __companionLang: 'en' });
        const event = enApi.normalizeEvent({
            type: 'holiday',
            name: 'Children\'s Day',
            nameKo: '어린이날',
            nameEn: 'Children\'s Day',
            date: '2026-05-05'
        });
        assert.equal(enApi.getEventDisplayName(event), 'Children\'s Day');

        const koApi = loadCalendarEvents({ __companionLang: 'ko' });
        assert.equal(koApi.getEventDisplayName(event), '어린이날');
    });

    it('parses KR holiday JSON and groups consecutive days', () => {
        const rows = api.parseKrPublicHolidayYearJson({
            '2026-09-24': '추석 전날',
            '2026-09-25': '추석',
            '2026-09-26': '추석 다음 날',
            '2026-10-09': '한글날'
        }, 2026);
        assert.equal(rows.length, 4);
        const grouped = api.groupKrPublicHolidayRows([
            { date: '2026-05-05', localName: '어린이날', name: 'Children\'s Day' },
            { date: '2026-05-06', localName: '어린이날', name: 'Children\'s Day' },
            { date: '2026-10-09', localName: '한글날', name: 'Hangeul Day' }
        ]);
        assert.equal(grouped.length, 2);
        assert.equal(grouped[0].isRange, true);
        assert.equal(grouped[0].startDate, '2026-05-05');
        assert.equal(grouped[0].endDate, '2026-05-06');
        assert.equal(grouped[1].date, '2026-10-09');
    });

    it('detects duplicate KR holiday imports by overlapping dates and names', () => {
        const existing = [api.normalizeEvent({
            type: 'holiday',
            name: 'Children\'s Day',
            nameKo: '어린이날',
            nameEn: 'Children\'s Day',
            date: '2026-05-05'
        })];
        const candidate = api.normalizeEvent({
            type: 'holiday',
            name: '어린이날',
            nameKo: '어린이날',
            nameEn: 'Children\'s Day',
            date: '2026-05-05'
        });
        assert.equal(api.isDuplicateKrHolidayImport(candidate, existing), true);
    });

    it('builds KR holiday imports from a date range', async () => {
        const events = await api.buildKrPublicHolidayImport('2026-05-01', '2026-05-31', {
            fetch: async () => ({
                ok: true,
                async json() {
                    return {
                        '2026-05-05': '어린이날',
                        '2026-06-06': '현충일'
                    };
                }
            })
        });
        assert.equal(events.length, 1);
        assert.equal(events[0].nameKo, '어린이날');
        assert.equal(events[0].date, '2026-05-05');
    });
});
