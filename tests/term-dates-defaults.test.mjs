import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import vm from 'node:vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadStore() {
    const utils = fs.readFileSync(path.join(root, 'vendor/ccmu/js/utils.js'), 'utf8');
    const termDates = fs.readFileSync(path.join(root, 'vendor/ccmu/js/term-dates.js'), 'utf8');
    const palette = fs.readFileSync(path.join(root, 'vendor/ccmu/js/class-color-palette.js'), 'utf8');
    const storeCode = fs.readFileSync(path.join(root, 'js/syllabus-builder-store.js'), 'utf8');
    const sandbox = { window: {}, globalThis: {}, localStorage: { _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = v; }, removeItem(k) { delete this._data[k]; } } };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(utils, sandbox);
    vm.runInNewContext(termDates, sandbox);
    vm.runInNewContext(palette, sandbox);
    vm.runInNewContext(storeCode, sandbox);
    return sandbox.CCPCompanionStore;
}

describe('term dates defaults', () => {
    const store = loadStore();

    it('uses today when workspace term is not set', () => {
        const data = store.emptyData();
        const defaults = store.getDefaultProjectDates(data);
        assert.match(defaults.startDate, /^\d{4}-\d{2}-\d{2}$/);
    });

    it('defaults new project from workspace term dates', () => {
        const data = store.emptyData();
        data.termStart = '2026-03-02';
        data.termCalendarMonths = 3;
        data.useAutoTermEnd = true;
        const defaults = store.getDefaultProjectDates(data);
        assert.equal(defaults.startDate, '2026-03-02');
        assert.ok(defaults.endDate >= defaults.startDate);
        const project = store.emptyProject({}, data);
        assert.equal(project.startDate, '2026-03-02');
    });
});
