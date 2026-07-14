/**
 * Export docs/ko/사용-안내.md to docs/ko/사용-안내.pdf
 *
 * Usage:
 *   npm run export:guide-pdf
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MD_PATH = path.join(ROOT, 'docs', 'ko', '사용-안내.md');
const PDF_PATH = path.join(ROOT, 'docs', 'ko', '사용-안내.pdf');
const IMAGES_DIR = path.join(ROOT, 'docs', 'ko', 'images');
const PLAYWRIGHT_VERSION = '1.50.1';

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function markdownToHtml(markdown, baseDir) {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let inUl = false;
    let inOl = false;
    let inBlockquote = false;
    let inCode = false;

    const closeLists = () => {
        if (inUl) {
            out.push('</ul>');
            inUl = false;
        }
        if (inOl) {
            out.push('</ol>');
            inOl = false;
        }
    };

    const closeBlockquote = () => {
        if (inBlockquote) {
            out.push('</blockquote>');
            inBlockquote = false;
        }
    };

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();

        if (line.startsWith('```')) {
            closeLists();
            closeBlockquote();
            if (!inCode) {
                out.push('<pre><code>');
                inCode = true;
            } else {
                out.push('</code></pre>');
                inCode = false;
            }
            continue;
        }

        if (inCode) {
            out.push(escapeHtml(line));
            continue;
        }

        if (!line.trim()) {
            closeLists();
            closeBlockquote();
            continue;
        }

        if (line.startsWith('# ')) {
            closeLists();
            closeBlockquote();
            out.push(`<h1>${inline(line.slice(2))}</h1>`);
            continue;
        }
        if (line.startsWith('## ')) {
            closeLists();
            closeBlockquote();
            out.push(`<h2>${inline(line.slice(3))}</h2>`);
            continue;
        }
        if (line.startsWith('### ')) {
            closeLists();
            closeBlockquote();
            out.push(`<h3>${inline(line.slice(4))}</h3>`);
            continue;
        }

        if (line.startsWith('> ')) {
            closeLists();
            if (!inBlockquote) {
                out.push('<blockquote>');
                inBlockquote = true;
            }
            out.push(`<p>${inline(line.slice(2))}</p>`);
            continue;
        }

        const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (img) {
            closeLists();
            closeBlockquote();
            const src = path.resolve(baseDir, img[2]).replace(/\\/g, '/');
            out.push(`<figure><img src="file:///${src.replace(/^\/+/, '')}" alt="${escapeHtml(img[1])}"><figcaption>${escapeHtml(img[1])}</figcaption></figure>`);
            continue;
        }

        const ol = line.match(/^(\d+)\.\s+(.*)$/);
        if (ol) {
            closeBlockquote();
            if (!inOl) {
                closeLists();
                out.push('<ol>');
                inOl = true;
            }
            out.push(`<li>${inline(ol[2])}</li>`);
            continue;
        }

        if (line.startsWith('- ')) {
            closeBlockquote();
            if (!inUl) {
                closeLists();
                out.push('<ul>');
                inUl = true;
            }
            out.push(`<li>${inline(line.slice(2))}</li>`);
            continue;
        }

        closeLists();
        closeBlockquote();
        out.push(`<p>${inline(line)}</p>`);
    }

    closeLists();
    closeBlockquote();
    if (inCode) {
        out.push('</code></pre>');
    }
    return out.join('\n');
}

function inline(text) {
    return escapeHtml(text)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function buildHtmlDocument(bodyHtml) {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>수업계획표 도우미 — 사용 안내</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    body {
      font-family: "Noto Sans KR", "Malgun Gothic", sans-serif;
      font-size: 11pt;
      line-height: 1.65;
      color: #1a1a1a;
      max-width: 180mm;
      margin: 0 auto;
    }
    h1 { font-size: 22pt; margin: 0 0 12pt; page-break-after: avoid; }
    h2 {
      font-size: 15pt;
      margin: 22pt 0 8pt;
      padding-bottom: 4pt;
      border-bottom: 1px solid #ddd;
      page-break-after: avoid;
    }
    h3 { font-size: 12pt; margin: 14pt 0 6pt; page-break-after: avoid; }
    p, li { margin: 0 0 8pt; }
    ul, ol { margin: 0 0 10pt 18pt; padding: 0; }
    blockquote {
      margin: 10pt 0;
      padding: 8pt 12pt;
      border-left: 4px solid #4a7fd7;
      background: #f4f8ff;
      color: #234;
    }
    figure { margin: 12pt 0 16pt; page-break-inside: avoid; }
    img {
      width: 100%;
      border: 1px solid #ddd;
      border-radius: 6px;
      display: block;
    }
    figcaption {
      font-size: 9.5pt;
      color: #555;
      margin-top: 6pt;
      text-align: center;
    }
    code {
      font-family: Consolas, monospace;
      background: #f3f3f3;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 10pt;
    }
    pre code { display: block; padding: 10pt; white-space: pre-wrap; }
    strong { font-weight: 700; }
    a { color: #2457c5; text-decoration: none; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

async function loadPlaywright() {
    spawnSync('npm', ['install', '--no-save', `playwright@${PLAYWRIGHT_VERSION}`], {
        cwd: ROOT,
        shell: true,
        stdio: 'inherit'
    });
    return import('playwright');
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

async function main() {
    if (!fs.existsSync(MD_PATH)) {
        throw new Error(`Missing guide: ${MD_PATH}`);
    }

    const markdown = fs.readFileSync(MD_PATH, 'utf8');
    const bodyHtml = markdownToHtml(markdown, path.dirname(MD_PATH));
    const html = buildHtmlDocument(bodyHtml);
    const htmlPath = path.join(ROOT, 'docs', 'ko', '_guide-print.html');
    fs.writeFileSync(htmlPath, html, 'utf8');

    const { chromium } = await loadPlaywright();
    const browser = await launchBrowser(chromium);
    const page = await browser.newPage();
    await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
    });
    await page.pdf({
        path: PDF_PATH,
        format: 'A4',
        printBackground: true,
        margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' }
    });
    await browser.close();
    fs.unlinkSync(htmlPath);

    console.log(`PDF written: ${PDF_PATH}`);
    if (!fs.existsSync(IMAGES_DIR)) {
        console.warn('Warning: images folder missing — run capture:guide-screenshots first.');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
