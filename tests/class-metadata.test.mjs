import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadClassMetadata() {
    const code = fs.readFileSync(path.join(root, 'js/class-metadata.js'), 'utf8');
    const sandbox = { window: {}, globalThis: {} };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(code, sandbox);
    return sandbox.CCPClassMetadata;
}

describe('class metadata', () => {
    const api = loadClassMetadata();

    it('exposes grouped Simson levels', () => {
        assert.equal(api.SIMSON_LEVEL_GROUPS.length, 2);
        assert.ok(api.getAllSimsonLevels().length > 20);
        assert.equal(api.getSimsonLevelById('Navy')?.name, 'Navy');
    });

    it('resolves preset and custom level fields like Class Calendar', () => {
        const preset = api.resolveLevelPresetForForm({ levelPreset: 'Navy' });
        assert.equal(preset, 'Navy');
        const fromLegacy = api.resolveLevelPresetForForm({ sectionLevel: 'Red' });
        assert.equal(fromLegacy, 'Red');
        const custom = api.resolveLevelCustomForForm({ levelCustom: 'Simson 3' });
        assert.equal(custom, 'Simson 3');
    });

    it('maps middle-school presets to grades', () => {
        const kangchen = api.getSimsonLevelById('캉첸');
        assert.ok(kangchen);
        assert.equal(kangchen.grade, '중3');
    });
});
