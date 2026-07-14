/**
 * Capture Korean user-guide screenshots for docs/ko/사용-안내.md
 *
 * Prerequisites:
 *   npx playwright install chromium
 *
 * Usage:
 *   npm run capture:guide-screenshots
 *
 * Manual fallback: follow STEP_LIST below and save PNGs to docs/ko/images/
 * with the same filenames if Playwright is unavailable.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMAGES_DIR = path.join(ROOT, 'docs', 'ko', 'images');
const FIXTURE = path.join(ROOT, 'docs', 'ko', 'fixtures', 'demo-pack.json');
const BASE_URL = 'http://127.0.0.1:8090';
const VIEWPORT = { width: 1280, height: 800 };
const DEMO_CURRICULUM_ID = 'custom-demo-phonics-red';
const PLAYWRIGHT_VERSION = '1.50.1';

let serverProc = null;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerUp() {
    return new Promise((resolve) => {
        const req = http.get(BASE_URL, (res) => {
            res.resume();
            resolve(res.statusCode >= 200 && res.statusCode < 500);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1500, () => {
            req.destroy();
            resolve(false);
        });
    });
}

async function ensureServer() {
    if (await isServerUp()) {
        return;
    }
    console.log('Starting local server on port 8090...');
    serverProc = spawn('npx', ['--yes', 'serve', '-l', '8090'], {
        cwd: ROOT,
        shell: true,
        stdio: 'ignore'
    });
    for (let i = 0; i < 40; i += 1) {
        await sleep(500);
        if (await isServerUp()) {
            return;
        }
    }
    throw new Error('Could not start server on http://127.0.0.1:8090');
}

function ensurePlaywright() {
    spawnSync('npm', ['install', '--no-save', `playwright@${PLAYWRIGHT_VERSION}`], {
        cwd: ROOT,
        shell: true,
        stdio: 'inherit'
    });
}

async function launchBrowser(chromium) {
  const channels = ['msedge', 'chrome'];
  for (const channel of channels) {
    try {
      return await chromium.launch({ headless: true, channel, timeout: 60000 });
    } catch {
      // try next channel
    }
  }
  spawnSync('npx', ['--yes', `playwright@${PLAYWRIGHT_VERSION}`, 'install', 'chromium'], {
    cwd: ROOT,
    shell: true,
    stdio: 'inherit'
  });
  return chromium.launch({ headless: true, timeout: 60000 });
}

async function loadPlaywright() {
    return import('playwright');
}

async function screenshot(page, filename, options = {}) {
    const out = path.join(IMAGES_DIR, filename);
    if (options.locator) {
        await options.locator.screenshot({ path: out });
    } else if (options.clip) {
        await page.screenshot({ path: out, clip: options.clip });
    } else {
        await page.screenshot({ path: out, fullPage: !!options.fullPage });
    }
    console.log(`  saved ${filename}`);
}

async function setKorean(page) {
    await page.click('[data-lang="ko"]');
    await sleep(250);
}

async function setLightTheme(page) {
    await page.evaluate(() => {
        localStorage.setItem('ccp-theme', 'light');
        document.documentElement.setAttribute('data-theme', 'light');
        if (window.CCPTheme && window.CCPTheme.applyTheme) {
            window.CCPTheme.applyTheme('light', { buttonIds: ['headerThemeToggleBtn'] });
        }
    });
}

async function resetApp(page) {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.CCPCompanionStore && window.CCPSyllabusPack, null, {
        timeout: 30000
    });
    await page.evaluate(() => {
        localStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.CCPCompanionStore && window.CCPSyllabusPack, null, {
        timeout: 30000
    });
    await setLightTheme(page);
}

async function importDemoPack(page) {
    const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click('#importPackBtn')
    ]);
    await fileChooser.setFiles(FIXTURE);
    await page.waitForFunction((id) => {
        const data = window.CCPCompanionStore.getData();
        return data.curriculumOverrides && data.curriculumOverrides[id];
    }, DEMO_CURRICULUM_ID, { timeout: 15000 });
    await sleep(400);
}

async function switchTab(page, tabId) {
    await page.click(`#tabBtn-${tabId}, .app-zone-segment-btn[data-tab="${tabId}"]`);
    await sleep(300);
}

async function selectCurriculumInList(page, curriculumId) {
    const item = page.locator(`[data-curriculum-id="${curriculumId}"], [data-book-id="${curriculumId}"]`).first();
    if (await item.count()) {
        await item.click();
        await sleep(400);
        return;
    }
    const first = page.locator('.workspace-books-list [role="option"], .workspace-books-list button').first();
    if (await first.count()) {
        await first.click();
        await sleep(400);
    }
}

async function createDemoSyllabus(page) {
    await switchTab(page, 'syllabus');
    await page.click('#newProjectBtn');
    await sleep(300);
    await page.fill('#projectName', '초3 Red — 월수금 (데모)');
    await page.selectOption('#projectCurriculum', DEMO_CURRICULUM_ID);
    await sleep(200);
    await page.fill('#projectStartDate', '2026-03-02');
    await page.fill('#projectTermMonths', '3');
    const mwf = page.locator('input[name="classScheduleTemplate"][value="mwf"]');
    if (await mwf.count()) {
        await mwf.check();
    }
    const mpw2 = page.locator('input[name="meetingsPerWeek"][value="2"]');
    if (await mpw2.count()) {
        await mpw2.check();
    }
    const grade = page.locator('#projectGrade');
    if (await grade.count()) {
        await grade.selectOption({ index: 1 }).catch(() => {});
    }
    await sleep(300);
}

async function generateAndApply(page) {
    await page.click('#generateScheduleBtn');
    await page.waitForFunction(() => {
        const rows = document.querySelectorAll('#syllabusTableBody tr');
        return rows.length > 0;
    }, { timeout: 15000 });
    await sleep(500);
    await page.click('#applyCurriculumBtn');
    await sleep(800);
}

async function seedCalendarEvents(page) {
    await page.evaluate(() => {
        const store = window.CCPCompanionStore;
        const data = store.getData();
        data.calendarDisplayStart = '2026-03-01';
        data.calendarDisplayEnd = '2026-06-30';
        data.events = [
            {
                id: 'demo-holiday-1',
                title: '삼일절',
                date: '2026-03-01',
                kind: 'holiday',
                scope: 'term',
                blocksClass: true
            },
            {
                id: 'demo-eval-1',
                title: '1차 평가',
                date: '2026-04-15',
                kind: 'evaluation',
                scope: 'term',
                blocksClass: false
            }
        ];
        store.save(data);
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await setKorean(page);
}

async function main() {
    if (!fs.existsSync(FIXTURE)) {
        throw new Error(`Missing fixture: ${FIXTURE}`);
    }
    fs.mkdirSync(IMAGES_DIR, { recursive: true });

    ensurePlaywright();
    await ensureServer();

    const { chromium } = await loadPlaywright();
    const browser = await launchBrowser(chromium);
    const page = await browser.newPage({ viewport: VIEWPORT });

    try {
        await resetApp(page);
        await screenshot(page, '01-start-app.png');

        await setKorean(page);
        await screenshot(page, '02-app-home-ko.png');
        await screenshot(page, '03-header-ko.png', {
            locator: page.locator('#appTopBar')
        });
        await screenshot(page, '04-tabs-overview.png', {
            locator: page.locator('.app-zone-segment-nav')
        });

        await importDemoPack(page);
        await screenshot(page, '05-import-pack.png', {
            locator: page.locator('#appTopBar')
        });

        await switchTab(page, 'curriculum');
        await selectCurriculumInList(page, DEMO_CURRICULUM_ID);
        await screenshot(page, '06-curriculum-list.png');

        await switchTab(page, 'syllabus');
        await screenshot(page, '07-new-syllabus.png', {
            locator: page.locator('.syllabus-layout')
        });

        await createDemoSyllabus(page);
        await screenshot(page, '08-syllabus-form.png', {
            locator: page.locator('.project-editor')
        });

        await page.click('#generateScheduleBtn');
        await page.waitForFunction(() => document.querySelectorAll('#syllabusTableBody tr').length > 0, {
            timeout: 15000
        });
        await sleep(500);
        await screenshot(page, '09-generate-schedule.png', {
            locator: page.locator('.project-editor')
        });

        await page.click('#applyCurriculumBtn');
        await sleep(800);
        await screenshot(page, '10-apply-curriculum.png', {
            locator: page.locator('.project-editor')
        });

        await switchTab(page, 'print');
        await page.click('#printSelectAllBtn').catch(() => {});
        await sleep(1200);
        await screenshot(page, '11-print-preview.png');

        await screenshot(page, '12-export-pack.png', {
            locator: page.locator('.app-header-unified__tools')
        });

        await switchTab(page, 'curriculum');
        await screenshot(page, '13-curriculum-add.png', {
            locator: page.locator('.curriculum-tab-sidebar')
        });

        await selectCurriculumInList(page, DEMO_CURRICULUM_ID);
        await screenshot(page, '14-curriculum-editor.png', {
            locator: page.locator('.curriculum-tab-layout')
        });

        await seedCalendarEvents(page);
        await switchTab(page, 'calendar');
        await page.fill('#calDisplayStart', '2026-03-01');
        await page.fill('#calDisplayEnd', '2026-06-30');
        await sleep(400);
        await screenshot(page, '15-calendar-range.png', {
            locator: page.locator('.cal-range-bar')
        });

        try {
            await page.click('#calImportKrBtn');
            await sleep(2500);
        } catch {
            // Offline or API blocked — seeded events still show on calendar.
        }
        await screenshot(page, '16-calendar-holidays.png');

        await page.click('#calAddEventBtn');
        await page.waitForSelector('#companionEventModal', { state: 'visible', timeout: 5000 });
        await sleep(300);
        await screenshot(page, '17-event-modal.png', {
            locator: page.locator('#companionEventModal .modal-content')
        });
        await page.keyboard.press('Escape').catch(() => {});

        await screenshot(page, '18-backup-export.png', {
            locator: page.locator('#exportBackupBtn')
        });

        console.log(`\nDone. ${IMAGES_DIR}`);
    } finally {
        await browser.close();
        if (serverProc) {
            serverProc.kill();
        }
    }
}

main().catch((err) => {
    console.error(err);
    if (serverProc) {
        serverProc.kill();
    }
    process.exit(1);
});
