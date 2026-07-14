import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadScheduleLessonDates() {
    const code = fs.readFileSync(path.join(root, 'js/schedule-lesson-dates.js'), 'utf8');
    const sandbox = { window: {}, globalThis: {} };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(code, sandbox);
    return sandbox.CCPScheduleLessonDates;
}

describe('schedule template variants', () => {
    const api = loadScheduleLessonDates();

    function comboJson(combos) {
        return JSON.stringify(combos);
    }

    it('MWF twice weekly creates MW, MF, and WF', () => {
        const combos = api.getScheduleVariantMeetingDays('mwf', 2);
        assert.equal(combos.length, 3);
        assert.equal(comboJson(combos), '[[1,3],[1,5],[3,5]]');
    });

    it('MWF once weekly creates M, W, and F', () => {
        const combos = api.getScheduleVariantMeetingDays('mwf', 1);
        assert.equal(combos.length, 3);
        assert.equal(comboJson(combos), '[[1],[3],[5]]');
    });

    it('Tue/Thu twice weekly creates TR', () => {
        const combos = api.getScheduleVariantMeetingDays('tt', 2);
        assert.equal(combos.length, 1);
        assert.equal(comboJson(combos), '[[2,4]]');
    });

    it('Tue/Thu once weekly creates T and R', () => {
        const combos = api.getScheduleVariantMeetingDays('tt', 1);
        assert.equal(combos.length, 2);
        assert.equal(comboJson(combos), '[[2],[4]]');
    });

    it('formats compact day labels', () => {
        assert.equal(api.formatMeetingDaysShort([1, 3, 5]), 'MWF');
        assert.equal(api.formatMeetingDaysShort([1, 3]), 'MW');
        assert.equal(api.formatMeetingDaysShort([2, 4]), 'TuTh');
        assert.equal(api.formatMeetingDaysShort([2]), 'Tu');
    });

    it('syncs one class meeting days from template + frequency', () => {
        const days2 = api.syncTemplateMeetingDays({
            classScheduleTemplate: 'mwf',
            meetingsPerWeek: 2,
            meetingDays: []
        });
        assert.equal(comboJson(days2), '[1,3]');

        const days1 = api.syncTemplateMeetingDays({
            classScheduleTemplate: 'mwf',
            meetingsPerWeek: 1,
            meetingDays: []
        });
        assert.equal(comboJson(days1), '[1]');

        const preserved = api.syncTemplateMeetingDays({
            classScheduleTemplate: 'mwf',
            meetingsPerWeek: 2,
            meetingDays: [1, 5]
        });
        assert.equal(comboJson(preserved), '[1,5]');
    });
});
