import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import vm from 'node:vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadStore(seed) {
    const sandbox = {
        window: {},
        globalThis: {},
        setTimeout,
        clearTimeout,
        localStorage: {
            _data: {},
            getItem(k) { return this._data[k] || null; },
            setItem(k, v) { this._data[k] = String(v); },
            removeItem(k) { delete this._data[k]; }
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    if (seed) {
        sandbox.localStorage.setItem('ccp-syllabus-companion-v2', JSON.stringify(seed));
    }
    vm.runInNewContext(fs.readFileSync(path.join(root, 'vendor/ccmu/js/utils.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(root, 'vendor/ccmu/js/term-dates.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(root, 'vendor/ccmu/js/class-color-palette.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(root, 'js/syllabus-builder-store.js'), 'utf8'), sandbox);
    return sandbox.CCPCompanionStore;
}

describe('incomplete syllabus delete support', () => {
    it('heals projects missing an id so they can be selected', () => {
        const store = loadStore({
            schemaVersion: 2,
            projects: [{ name: '', color: '#356a9e', syllabusRows: [] }]
        });
        const projects = store.getProjects();
        assert.equal(projects.length, 1);
        assert.ok(projects[0].id);
        assert.ok(String(projects[0].name).trim());
        assert.ok(store.getProject(projects[0].id));
    });

    it('cascades delete to schedule variant children', () => {
        const store = loadStore({
            schemaVersion: 2,
            projects: [
                { id: 'parent1', name: 'Source', color: '#356a9e', syllabusRows: [] },
                { id: 'child1', name: 'Source (Mon/Wed)', parentProjectId: 'parent1', syllabusRows: [{}] },
                { id: 'child2', name: 'Source (Wed/Fri)', parentProjectId: 'parent1', syllabusRows: [{}] },
                { id: 'other', name: 'Other', syllabusRows: [{}] }
            ]
        });
        store.deleteProject('parent1');
        const remaining = store.getProjects().map((p) => p.id);
        assert.equal(remaining.length, 1);
        assert.equal(remaining[0], 'other');
    });

    it('repairs projects corrupted by saving applyCurriculumPages result', () => {
        const store = loadStore({
            schemaVersion: 2,
            projects: [{
                ok: true,
                applied: 3,
                rows: [{ weekLabel: 'W1', planTitle: 'Lesson 1' }],
                syllabusGeneralNotes: 'Notes',
                color: '#356a9e'
            }]
        });
        const projects = store.getProjects();
        assert.equal(projects.length, 1);
        assert.ok(projects[0].id);
        assert.equal(projects[0].ok, undefined);
        assert.equal(projects[0].applied, undefined);
        assert.equal(projects[0].rows, undefined);
        assert.equal(projects[0].syllabusRows.length, 1);
        assert.equal(projects[0].syllabusRows[0].planTitle, 'Lesson 1');
        assert.ok(store.getProject(projects[0].id));
    });

    it('does not resurrect a deleted project via upsertProjectDebounced', () => {
        const store = loadStore({
            schemaVersion: 2,
            projects: [
                { id: 'p1', name: 'Delete me', color: '#356a9e', syllabusRows: [{}] },
                { id: 'other', name: 'Other', color: '#356a9e', syllabusRows: [{}] }
            ]
        });
        store.deleteProject('p1');
        const result = store.upsertProjectDebounced({
            id: 'p1',
            name: 'Back from the dead',
            color: '#356a9e',
            syllabusRows: [{}]
        });
        assert.equal(result, null);
        const remaining = store.getProjects().map((p) => p.id);
        assert.equal(remaining.length, 1);
        assert.equal(remaining[0], 'other');
        assert.equal(store.getProject('p1'), null);
    });

    it('keeps delete after a pending debounced save', async () => {
        const store = loadStore({
            schemaVersion: 2,
            projects: [
                { id: 'p1', name: 'Delete me', color: '#356a9e', syllabusRows: [{}] },
                { id: 'other', name: 'Other', color: '#356a9e', syllabusRows: [{}] }
            ]
        });
        store.upsertProjectDebounced({
            id: 'p1',
            name: 'Edited',
            color: '#356a9e',
            syllabusRows: [{}]
        }, 50);
        store.deleteProject('p1');
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.equal(store.getProject('p1'), null);
        const remaining = store.getProjects().map((p) => p.id);
        assert.equal(remaining.length, 1);
        assert.equal(remaining[0], 'other');
    });
});
