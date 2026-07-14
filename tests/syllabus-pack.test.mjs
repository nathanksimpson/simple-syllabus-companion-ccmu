import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const KIND = 'ccp-syllabus-pack';

function isValid(imported) {
    if (!imported || typeof imported !== 'object') return false;
    if (imported.kind === KIND) {
        return Array.isArray(imported.customSyllabusTemplates)
            || (imported.curriculumOverrides && typeof imported.curriculumOverrides === 'object');
    }
    return Array.isArray(imported.customSyllabusTemplates);
}

function mergeInto(target, imported) {
    const data = target || {};
    let bookCount = 0;
    if (imported.curriculumOverrides && typeof imported.curriculumOverrides === 'object') {
        if (!data.curriculumOverrides || typeof data.curriculumOverrides !== 'object') {
            data.curriculumOverrides = {};
        }
        Object.keys(imported.curriculumOverrides).forEach((cid) => {
            data.curriculumOverrides[cid] = JSON.parse(JSON.stringify(imported.curriculumOverrides[cid]));
            bookCount += 1;
        });
    }
    return { bookCount, data };
}

describe('syllabus pack', () => {
    it('accepts ccp-syllabus-pack with curriculumOverrides', () => {
        assert.equal(isValid({ kind: KIND, curriculumOverrides: { foo: {} } }), true);
    });
    it('rejects empty object', () => {
        assert.equal(isValid({}), false);
    });
});

describe('pack-first demo pack', () => {
    it('ships a valid demo pack under packs/demo', () => {
        const packPath = path.join(ROOT, 'packs', 'demo', 'demo-phonics.json');
        const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
        assert.equal(isValid(pack), true);
        assert.ok(pack.curriculumOverrides['custom-demo-phonics-red']);
        assert.equal(pack.curriculumOverrides['custom-demo-phonics-red'].isCustom, true);
    });

    it('manifest lists the demo pack', () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'packs', 'manifest.json'), 'utf8'));
        assert.ok(Array.isArray(manifest.packs));
        assert.ok(manifest.packs.includes('demo/demo-phonics.json'));
    });

    it('merges custom curricula without factory catalog', () => {
        const pack = JSON.parse(
            fs.readFileSync(path.join(ROOT, 'packs', 'demo', 'demo-phonics.json'), 'utf8')
        );
        const { bookCount, data } = mergeInto({ curriculumOverrides: {} }, pack);
        assert.equal(bookCount, 1);
        const entry = data.curriculumOverrides['custom-demo-phonics-red'];
        assert.equal(entry.isCustom, true);
        assert.ok(Array.isArray(entry.sessions) && entry.sessions.length > 0);
    });
});

describe('factory stub', () => {
    it('keeps vendor curricula data as an empty pack-first stub', () => {
        const src = fs.readFileSync(
            path.join(ROOT, 'vendor', 'ccmu', 'js', 'syllabus-curricula-data.js'),
            'utf8'
        );
        assert.match(src, /const CURRICULA = \[\];/);
        assert.match(src, /pack-first/);
        const sync = fs.readFileSync(path.join(ROOT, 'scripts', 'sync-from-ccmu.mjs'), 'utf8');
        assert.equal(sync.includes("'js/syllabus-curricula-data.js'"), false);
    });
});
