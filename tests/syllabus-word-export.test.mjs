import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import vm from 'node:vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadWordExport() {
    const code = fs.readFileSync(path.join(root, 'js/syllabus-word-export.js'), 'utf8');
    const sandbox = { window: {}, globalThis: {} };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(code, sandbox);
    return sandbox.CCPCompanionWordExport;
}

describe('syllabus word export helpers', () => {
    const api = loadWordExport();

    it('builds table headers with date column by default', () => {
        const headers = api.buildTableHeaders();
        assert.equal(headers.length, 6);
        assert.equal(headers[2], 'Date');
    });

    it('maps syllabus row to cells', () => {
        const cells = api.rowToCells({
            weekLabel: 'W1',
            sessionNumber: 3,
            dateLabel: 'Mar 5',
            planTitle: 'Unit 2',
            planDetail: 'pp. 10–12',
            note: 'Quiz'
        });
        assert.equal(cells[0], 'W1');
        assert.equal(cells[1], '3');
        assert.equal(cells[2], 'Mar 5');
        assert.ok(cells[3].includes('Unit 2'));
        assert.equal(cells[5], 'Quiz');
    });

    it('escapes newlines in cell text', () => {
        assert.equal(api.escapeCellText('line1\nline2'), 'line1 line2');
    });
});
