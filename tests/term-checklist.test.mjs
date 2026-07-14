import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import vm from 'node:vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadGuidesDetect() {
    const guidesCode = fs.readFileSync(path.join(root, 'js/companion-guides.js'), 'utf8');
    const sandbox = { window: {}, globalThis: {}, localStorage: { _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = v; } } };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.window.CCPBooksEditor = { discoverBooks: () => [{ id: 'book1' }] };
    vm.runInNewContext(guidesCode, sandbox);
    return sandbox.CCPCompanionGuides;
}

describe('term checklist', () => {
    const guides = loadGuidesDetect();

    it('marks phase 1 done when term and events exist', () => {
        const status = guides.detectPhaseStatus({
            termStart: '2026-03-01',
            events: [{ id: 'e1' }],
            projects: [],
            curriculumOverrides: {}
        });
        assert.equal(status.phase1, 'done');
    });

    it('keeps phase 1 pending without events', () => {
        const status = guides.detectPhaseStatus({
            termStart: '2026-03-01',
            events: [],
            projects: []
        });
        assert.equal(status.phase1, 'pending');
    });

    it('marks phase 3 done when a project has rows', () => {
        const status = guides.detectPhaseStatus({
            termStart: '2026-03-01',
            events: [{ id: 'e1' }],
            projects: [{ syllabusRows: [{ id: 'r1' }] }]
        });
        assert.equal(status.phase3, 'done');
    });
});
