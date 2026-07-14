import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadPackModule() {
    const code = fs.readFileSync(path.join(ROOT, 'js', 'syllabus-pack.js'), 'utf8');
    const sandbox = {
        CCPCurriculaData: { getAll: () => [] }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(code, sandbox);
    return sandbox.CCPSyllabusPack;
}

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
});

describe('robust Class Calendar pack normalize', () => {
    const packApi = loadPackModule();

    it('exposes normalizePackCurricula', () => {
        assert.equal(typeof packApi.normalizePackCurricula, 'function');
    });

    it('marks factory-keyed curricula as isCustom and keeps all books', () => {
        const sample = {
            kind: KIND,
            curriculumOverrides: {
                'hand-in-hand': {
                    bookTitle: 'Hand in Hand Red',
                    sessions: [{ sessionNumber: 1, planTitle: 'A', planDetail: '', note: '' }]
                },
                news: {
                    isCustom: true,
                    bookTitle: 'News',
                    sessions: [{ sessionNumber: 1, planTitle: 'B', planDetail: '', note: '' }]
                }
            },
            bookOverrides: {
                animation: {
                    defaultSyllabusRowTemplates: [
                        { sessionNumber: 1, planTitle: 'Anim', planDetail: '', note: '' }
                    ]
                }
            }
        };
        const ready = packApi.normalizePackCurricula(sample, { forceCustom: true });
        assert.equal(Object.keys(ready).length, 3);
        assert.equal(ready['hand-in-hand'].isCustom, true);
        assert.equal(ready.news.isCustom, true);
        assert.equal(ready.animation.isCustom, true);
        assert.equal(ready.animation.sessions.length, 1);
        assert.equal(ready.animation.bookTitle, 'animation');
    });

    it('hydrates sessions from teamDefault when sessions missing', () => {
        const ready = packApi.normalizePackCurricula({
            curriculumOverrides: {
                toefl: {
                    bookTitle: 'TOEFL',
                    teamDefault: {
                        sessions: [{ sessionNumber: 1, planTitle: 'Intro', planDetail: '', note: '' }]
                    }
                }
            }
        }, { forceCustom: true });
        assert.equal(ready.toefl.sessions.length, 1);
        assert.equal(ready.toefl.sessions[0].planTitle, 'Intro');
    });

    it('mergeInto reports full curriculumCount for a Class Calendar-shaped pack', () => {
        const imported = {
            kind: KIND,
            curriculumOverrides: {
                a: { bookTitle: 'A', sessions: [{ sessionNumber: 1 }] },
                b: { bookTitle: 'B', sessions: [{ sessionNumber: 1 }] },
                c: { isCustom: true, bookTitle: 'C', sessions: [{ sessionNumber: 1 }] }
            },
            bookOverrides: {
                d: { defaultSyllabusRowTemplates: [{ sessionNumber: 1, planTitle: 'D' }] }
            }
        };
        const target = {
            curriculumOverrides: {},
            bookOverrides: {},
            customSyllabusTemplates: [],
            defaultClassTypeOverrides: {}
        };
        const counts = packApi.mergeInto(target, imported);
        assert.equal(counts.curriculumCount, 4);
        assert.equal(Object.keys(target.curriculumOverrides).length, 4);
        assert.ok(Object.values(target.curriculumOverrides).every((row) => row.isCustom === true));
    });

    it('normalizes the Jamsil summer pack to 15 visible curricula when present', () => {
        const candidates = [
            path.join(ROOT, 'packs', 'private', 'jamsil-le-el-2026-summer.json'),
            path.join('c:/Users/SIMSTER/Downloads/1-Jamsil-Le-El-2026-Summer_lesson-plans-books_2026-07-14.json')
        ];
        const packPath = candidates.find((p) => fs.existsSync(p));
        if (!packPath) {
            return; // local-only proprietary fixture
        }
        const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
        const ready = packApi.normalizePackCurricula(pack, { forceCustom: true });
        assert.equal(Object.keys(ready).length, 15);
        assert.ok(ready['hand-in-hand'].isCustom);
        assert.ok(ready['monster-phonics'].sessions.length >= 20);
        assert.ok(ready.news.isCustom);
        const target = { curriculumOverrides: {}, bookOverrides: {} };
        const counts = packApi.mergeInto(target, pack);
        assert.equal(counts.curriculumCount, 15);
        assert.equal(Object.keys(target.curriculumOverrides).length, 15);
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
