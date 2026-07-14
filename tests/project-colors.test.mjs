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
    const sandbox = { window: {}, globalThis: {}, localStorage: { _data: {}, getItem() { return null; }, setItem() {}, removeItem() {} } };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(utils, sandbox);
    vm.runInNewContext(termDates, sandbox);
    vm.runInNewContext(palette, sandbox);
    vm.runInNewContext(storeCode, sandbox);
    return sandbox.CCPCompanionStore;
}

describe('project colors', () => {
    const store = loadStore();

    it('assigns palette color to new projects', () => {
        const p = store.emptyProject({}, store.emptyData());
        assert.match(p.color, /^#[0-9a-f]{6}$/i);
    });

    it('migrates missing color when loading from storage', () => {
        const sandbox = { window: {}, globalThis: {}, localStorage: { _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = v; }, removeItem(k) { delete this._data[k]; } } };
        sandbox.window = sandbox;
        sandbox.globalThis = sandbox;
        vm.runInNewContext(fs.readFileSync(path.join(root, 'vendor/ccmu/js/utils.js'), 'utf8'), sandbox);
        vm.runInNewContext(fs.readFileSync(path.join(root, 'vendor/ccmu/js/term-dates.js'), 'utf8'), sandbox);
        vm.runInNewContext(fs.readFileSync(path.join(root, 'vendor/ccmu/js/class-color-palette.js'), 'utf8'), sandbox);
        sandbox.localStorage.setItem('ccp-syllabus-companion-v2', JSON.stringify({
            schemaVersion: 2,
            projects: [{ id: 'p1', name: 'Test', meetingDays: [1, 3, 5] }]
        }));
        vm.runInNewContext(fs.readFileSync(path.join(root, 'js/syllabus-builder-store.js'), 'utf8'), sandbox);
        const loaded = sandbox.CCPCompanionStore.getProject('p1');
        assert.ok(loaded.color);
    });
});
