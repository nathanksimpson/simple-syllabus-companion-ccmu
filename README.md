# Simple Syllabus Companion Tool (CCMU)

Standalone syllabus creator that uses **lesson plans/books packs** (compatible with [Class Calendar Multi User](https://github.com/nathanksimpson/classcalendarmultiuser)).

Curricula are **pack-first**: the app does not ship a factory lesson catalog. Put packs under [`packs/`](packs/) (see [`packs/README.md`](packs/README.md)), or use **Import pack**.

## Quick start

1. Open this folder in a terminal.
2. (Optional) Sync shared UI/engine modules from Class Calendar after calendar updates:

    ```bash
    npm run sync:ccmu
    ```

    Default source: `D:\Simson USB\Class Calendar Multi User`  
    Override: `set CCMU_ROOT=your\path` then run sync again.

    Note: factory curriculum data from Class Calendar is **not** copied into this app. Curricula come from packs.

3. Start the local server:

   ```bash
   npm start
   ```

   Or double-click **START COMPANION.bat** (Windows).

4. Open http://localhost:8090

On first load, packs listed in [`packs/manifest.json`](packs/manifest.json) (including the demo pack) are imported automatically.

**Do not open `index.html` as a file** — the app needs HTTP for scripts and packs to load correctly.

## Proprietary curricula

- Save school/proprietary packs under `packs/private/` and list them in `packs/manifest.json`.
- That folder is **gitignored** so private packs stay off GitHub.
- Do not commit proprietary pack JSON into `packs/demo/` or other tracked paths.

## Workflow

### From Class Calendar

1. Class Calendar → **Data** tab → **Export lesson plans/books pack**
2. Save under `packs/private/` (or use Companion → **Import pack**)
3. **Syllabus** tab → **New syllabus** → pick curriculum, dates, meeting days
4. **Generate from schedule** → **Apply curriculum pages**
5. **Print** tab → print A4 진도표
6. **Export pack** → import back into Class Calendar Data tab

### Create curriculum here

1. **Curriculum** tab → **Add curriculum** → edit sessions
2. Continue with syllabus steps above

## Documentation

- [Korean step-by-step guide (한국어 사용 안내)](docs/ko/사용-안내.md) — includes screenshots; PDF: [docs/ko/사용-안내.pdf](docs/ko/사용-안내.pdf)
- Demo pack: [`packs/demo/demo-phonics.json`](packs/demo/demo-phonics.json) (also mirrored at [`docs/ko/fixtures/demo-pack.json`](docs/ko/fixtures/demo-pack.json))

## Data storage

- Work is saved in **browser localStorage** on this PC/browser.
- **Export backup** saves all projects + curriculum edits to a JSON file.
- **Export pack** saves only the curriculum subset (Class Calendar compatible).

## After Class Calendar updates

When shared engines/UI modules change in Class Calendar, run:

```bash
npm run sync:ccmu
```

Then hard-refresh the companion page (Ctrl+F5). Curriculum content still comes from your packs, not from sync.
