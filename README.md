# Simple Syllabus Companion Tool (CCMU)

Standalone syllabus creator that imports **lesson plans/books packs** from [Class Calendar Multi User](https://github.com/nathanksimpson/classcalendarmultiuser).

## Quick start

1. Open this folder in a terminal.
2. Sync shared modules from Class Calendar (once per session, or after calendar updates):

   ```bash
   npm run sync:ccmu
   ```

   Default source: `D:\Simson USB\Class Calendar Multi User`  
   Override: `set CCMU_ROOT=your\path` then run sync again.

3. Start the local server:

   ```bash
   npm start
   ```

   Or double-click **START COMPANION.bat** (Windows).

4. Open http://localhost:8090

**Do not open `index.html` as a file** — the app needs HTTP for scripts to load correctly.

## Workflow

### From Class Calendar

1. Class Calendar → **Data** tab → **Export lesson plans/books pack**
2. Syllabus Companion → **Import pack**
3. **Syllabus** tab → **New syllabus** → pick curriculum, dates, meeting days
4. **Generate from schedule** → **Apply curriculum pages**
5. **Print** tab → print A4 진도표
6. **Export pack** → import back into Class Calendar Data tab

### Create curriculum here

1. **Curriculum** tab → **Add curriculum** → edit sessions
2. Continue with syllabus steps above

## Documentation

- [Korean step-by-step guide (한국어 사용 안내)](docs/ko/사용-안내.md) — includes screenshots; PDF: [docs/ko/사용-안내.pdf](docs/ko/사용-안내.pdf)

## Data storage

- Work is saved in **browser localStorage** on this PC/browser.
- **Export backup** saves all projects + curriculum edits to a JSON file.
- **Export pack** saves only the curriculum subset (Class Calendar compatible).

## After Class Calendar updates

When syllabus engines change in Class Calendar, run:

```bash
npm run sync:ccmu
```

Then hard-refresh the companion page (Ctrl+F5).
