/**
 * Copy shared syllabus/curriculum modules from Class Calendar Multi User.
 * Usage: npm run sync:ccmu
 * Env: CCMU_ROOT = path to calendar repo (default: D:\Simson USB\Class Calendar Multi User)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPANION_ROOT = path.resolve(__dirname, '..');
const CCMU_ROOT = process.env.CCMU_ROOT
    || 'D:\\Simson USB\\Class Calendar Multi User';

const FILES = [
    'js/utils.js',
    'js/class-color-palette.js',
    'js/term-dates.js',
    'js/schedule-core.js',
    'js/debate-periods.js',
    // syllabus-curricula-data.js is Companion-owned (empty stub). Curricula load from packs/.
    'js/syllabus-curricula.js',
    'js/syllabus-presets.js',
    'js/syllabus-templates.js',
    'js/syllabus-table.js',
    // books-editor.js: Companion keeps a pack-first discoverBooks patch (factory-empty → show pack curricula).
    // Re-check that behavior after syncing from Class Calendar.
    'js/books-editor.js',
    'js/default-class-editor.js',
    'js/homework-import.js',
    'css/tokens.css',
    'css/shell.css',
    'css/components.css',
    'css/calendar.css',
    'css/syllabus-print-a4.css',
    'templates/syllabus-editor.html',
    'templates/holiday-form.html',
    'js/theme-init.js',
    'js/theme-toggle.js'
];

function copyFile(rel) {
    const src = path.join(CCMU_ROOT, rel);
    const dest = path.join(COMPANION_ROOT, 'vendor', 'ccmu', rel);
    if (!fs.existsSync(src)) {
        console.warn('SKIP (missing):', rel);
        return false;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log('OK', rel);
    return true;
}

if (!fs.existsSync(CCMU_ROOT)) {
    console.error('CCMU root not found:', CCMU_ROOT);
    console.error('Set CCMU_ROOT env var to your Class Calendar Multi User folder.');
    process.exit(1);
}

console.log('Syncing from:', CCMU_ROOT);
console.log('Into:', path.join(COMPANION_ROOT, 'vendor', 'ccmu'));
let ok = 0;
let skip = 0;
FILES.forEach((rel) => {
    if (copyFile(rel)) {
        ok += 1;
    } else {
        skip += 1;
    }
});
console.log(`Done: ${ok} copied, ${skip} skipped.`);
