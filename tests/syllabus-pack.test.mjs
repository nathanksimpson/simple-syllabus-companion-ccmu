import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Minimal pack validation tests (logic mirrored in syllabus-pack.js for node)
const KIND = 'ccp-syllabus-pack';

function isValid(imported) {
    if (!imported || typeof imported !== 'object') return false;
    if (imported.kind === KIND) {
        return Array.isArray(imported.customSyllabusTemplates)
            || (imported.curriculumOverrides && typeof imported.curriculumOverrides === 'object');
    }
    return Array.isArray(imported.customSyllabusTemplates);
}

describe('syllabus pack', () => {
    it('accepts ccp-syllabus-pack with curriculumOverrides', () => {
        assert.equal(isValid({ kind: KIND, curriculumOverrides: { foo: {} } }), true);
    });
    it('rejects empty object', () => {
        assert.equal(isValid({}), false);
    });
});
