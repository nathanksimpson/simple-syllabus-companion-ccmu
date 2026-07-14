/**
 * Export Class Calendar factory curricula as a Companion pack JSON.
 * Writes packs/private/ccmu-factory-base.json (gitignored).
 *
 * Usage: npm run export:factory-pack
 * Env: CCMU_ROOT = path to Class Calendar Multi User
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPANION_ROOT = path.resolve(__dirname, '..');
const CCMU_ROOT = process.env.CCMU_ROOT
    || 'D:\\Simson USB\\Class Calendar Multi User';
const OUT_PATH = path.join(COMPANION_ROOT, 'packs', 'private', 'ccmu-factory-base.json');

function slugifyBookKey(text) {
    return (text || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'book';
}

function bookSeriesBaseName(defaultBook, fallbackName) {
    const raw = (defaultBook || fallbackName || '').trim();
    if (!raw) {
        return fallbackName || 'Book';
    }
    return raw
        .replace(/\s+\d+\s*$/i, '')
        .replace(/\s*\((green|blue|navy|red|orange|yellow|purple)\)\s*$/i, '')
        .trim() || raw;
}

function deriveBookKey(preset) {
    const base = bookSeriesBaseName(preset.defaultBook, preset.fallbackName || preset.name);
    return slugifyBookKey(base);
}

function normalizeSessions(rows) {
    return (rows || []).map((r, i) => ({
        sessionNumber: r.sessionNumber != null ? r.sessionNumber : i + 1,
        planTitle: r.planTitle || '',
        planDetail: r.planDetail || '',
        note: r.note || ''
    }));
}

function loadFactoryPresets(ccmuRoot) {
    const dataPath = path.join(ccmuRoot, 'js', 'syllabus-curricula-data.js');
    if (!fs.existsSync(dataPath)) {
        throw new Error(`Missing factory data: ${dataPath}`);
    }
    const code = fs.readFileSync(dataPath, 'utf8');
    const sandbox = {};
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(code, sandbox);
    if (!sandbox.CCPCurriculaData || typeof sandbox.CCPCurriculaData.getAll !== 'function') {
        throw new Error('CCPCurriculaData.getAll unavailable after loading factory file');
    }
    return sandbox.CCPCurriculaData.getAll();
}

function buildPackFromPresets(presets) {
    const byKey = new Map();
    presets.forEach((preset) => {
        if (!preset || !preset.id) {
            return;
        }
        const templates = preset.defaultSyllabusRowTemplates;
        const hasSessions = Array.isArray(templates) && templates.length > 0;
        const isStub = !!preset.isStub;
        if (!hasSessions && !isStub) {
            return;
        }
        const key = deriveBookKey(preset);
        if (!byKey.has(key)) {
            byKey.set(key, {
                id: key,
                title: bookSeriesBaseName(preset.defaultBook, preset.fallbackName || preset.name),
                levels: [],
                sessions: hasSessions ? normalizeSessions(templates) : [],
                classDefaults: {},
                syllabusGeneralNotes: preset.syllabusGeneralNotes || '',
                isBuiltinDebate: !!preset.debateBand || (preset.programTrack === 'debate'),
                debateBand: preset.debateBand || ''
            });
        }
        const book = byKey.get(key);
        if (preset.level && !book.levels.includes(preset.level)) {
            book.levels.push(preset.level);
        }
        if (hasSessions && book.sessions.length === 0) {
            book.sessions = normalizeSessions(templates);
        }
        if (!book.syllabusGeneralNotes && preset.syllabusGeneralNotes) {
            book.syllabusGeneralNotes = preset.syllabusGeneralNotes;
        }
        if (preset.defaultTotalLessons != null) {
            book.classDefaults.defaultTotalLessons = Math.max(
                book.classDefaults.defaultTotalLessons || 0,
                preset.defaultTotalLessons
            );
        }
        if (preset.lessonLabelMode) {
            book.classDefaults.lessonLabelMode = preset.lessonLabelMode;
        }
        if (preset.homeworkImportMode) {
            book.classDefaults.homeworkImportMode = preset.homeworkImportMode;
        }
        if (preset.defaultBook) {
            book.classDefaults.defaultBook = bookSeriesBaseName(
                preset.defaultBook,
                preset.fallbackName || preset.name
            );
        }
    });

    const curriculumOverrides = {};
    [...byKey.values()].forEach((book) => {
        const sessions = book.sessions.length
            ? book.sessions
            : [{ sessionNumber: 1, planTitle: '', planDetail: '', note: '' }];
        curriculumOverrides[book.id] = {
            isCustom: true,
            bookTitle: book.title,
            applicableLevels: book.levels.slice(),
            levels: book.levels.slice(),
            sessions,
            classDefaults: {
                defaultTotalLessons: book.classDefaults.defaultTotalLessons || sessions.length,
                defaultBook: book.classDefaults.defaultBook || book.title,
                ...(book.classDefaults.lessonLabelMode
                    ? { lessonLabelMode: book.classDefaults.lessonLabelMode }
                    : {}),
                ...(book.classDefaults.homeworkImportMode
                    ? { homeworkImportMode: book.classDefaults.homeworkImportMode }
                    : {})
            },
            types: {},
            updatedAt: new Date().toISOString(),
            ...(book.syllabusGeneralNotes
                ? { syllabusGeneralNotes: String(book.syllabusGeneralNotes) }
                : {}),
            ...(book.isBuiltinDebate ? { isBuiltinDebate: true } : {})
        };
    });

    return {
        kind: 'ccp-syllabus-pack',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        source: 'ccmu-factory',
        customSyllabusTemplates: [],
        defaultClassTypeOverrides: {},
        bookOverrides: {},
        curriculumRemovedIds: [],
        curriculumOverrides
    };
}

const presets = loadFactoryPresets(CCMU_ROOT);
const pack = buildPackFromPresets(presets);
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
const count = Object.keys(pack.curriculumOverrides).length;
console.log(`Wrote ${count} factory curricula → ${OUT_PATH}`);
console.log(Object.keys(pack.curriculumOverrides).sort().join(', '));
