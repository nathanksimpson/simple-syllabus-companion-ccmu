# Curriculum packs

This app loads curricula from **JSON packs**, not from built-in factory lesson plans.

## How it works

1. List pack files in [`manifest.json`](manifest.json) (paths relative to this `packs/` folder).
2. Start the companion (`npm start`) and open http://localhost:8090
3. On boot, the app fetches those packs and merges them into browser localStorage.

You can also use **Import pack** in the app header (any valid Class Calendar lesson plans/books pack).

## Folders

| Path | Purpose |
|------|---------|
| `demo/` | Sample pack shipped with the app (safe for GitHub) |
| `private/` | **Your proprietary packs** — gitignored; never committed |

## Add your own pack

1. Export a pack from Class Calendar (**Data** → Export lesson plans/books pack), or from this app (**Export pack**).
2. Save the JSON file under `packs/private/` (recommended for school/proprietary content).
3. Create or edit **`packs/manifest.local.json`** (gitignored — stays off GitHub):

```json
{
  "packs": [
    "private/my-school.json"
  ]
}
```

   Public [`manifest.json`](manifest.json) is for shared demo packs only. The app loads both manifests.
4. Hard-refresh the browser (Ctrl+F5). New or changed packs are applied automatically.

## Full Class Calendar catalog (recommended)

A Class Calendar “lesson plans/books pack” usually contains **only books you edited**, not the whole factory list (Write Right, Early Writers, Best Writing Starter, etc.).

To load the full catalog locally (stays off GitHub):

```bash
npm run export:factory-pack
```

This writes `packs/private/ccmu-factory-base.json`. List it in `packs/manifest.local.json` **above** your school pack so school overrides win:

```json
{
  "packs": [
    "private/ccmu-factory-base.json",
    "private/jamsil-le-el-2026-summer.json"
  ]
}
```

`npm run sync:ccmu` also refreshes that factory pack when Class Calendar updates.

## Privacy

Files under `packs/private/` and `packs/manifest.local.json` are gitignored. Do not put proprietary lesson plans in `demo/` or other tracked paths if the repository is public.
