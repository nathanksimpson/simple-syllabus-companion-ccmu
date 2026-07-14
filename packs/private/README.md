# Private packs (not committed)

Put proprietary or school-specific curriculum packs here as `.json` files.

Then list them in [`../manifest.json`](../manifest.json), for example:

```json
"private/my-school.json"
```

This folder’s contents (except this README) are gitignored so they stay off GitHub.

Also list your file in `../manifest.local.json` (gitignored), for example:

```json
{
  "packs": [
    "private/my-school.json"
  ]
}
```
