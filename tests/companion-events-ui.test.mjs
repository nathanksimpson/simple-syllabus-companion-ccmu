import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import vm from 'node:vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEventsUi() {
    const utils = fs.readFileSync(path.join(root, 'vendor/ccmu/js/utils.js'), 'utf8');
    const metaCode = fs.readFileSync(path.join(root, 'js/class-metadata.js'), 'utf8');
    const eventsCode = fs.readFileSync(path.join(root, 'js/calendar-events.js'), 'utf8');
    const uiCode = fs.readFileSync(path.join(root, 'js/companion-events-ui.js'), 'utf8');
    const sandbox = {
        window: {},
        globalThis: {},
        document: {
            getElementById: () => null,
            body: { appendChild: () => {} }
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(utils, sandbox);
    vm.runInNewContext(metaCode, sandbox);
    vm.runInNewContext(eventsCode, sandbox);
    vm.runInNewContext(uiCode, sandbox);
    return sandbox.CCPCompanionEventsUI;
}

describe('companion events ui', () => {
    const api = loadEventsUi();

    it('exports openNewSharedEvent', () => {
        assert.equal(typeof api.openNewSharedEvent, 'function');
    });

    it('exports openModal and closeModal', () => {
        assert.equal(typeof api.openModal, 'function');
        assert.equal(typeof api.closeModal, 'function');
    });
});
