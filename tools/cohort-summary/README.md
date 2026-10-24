# Cohort Retention Summary

> Turn an order or activity export into a cohort retention table and heat map.

Part of [Marketing Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Drop in an Excel or CSV file with one row per order or activity (customer ID, date and optionally signup date). Customers are grouped into monthly or weekly cohorts, and the table shows the share of each cohort active in each following period, with a size-weighted average.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/cohort-summary/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- cohort-summary ../cohort-summary-repo`.

## Features

- Flexible column names; cohort by signup date or by first activity.
- Month or Monday-based week cohorts, 1 to 24 periods; periods after the report date stay blank.
- Colour-coded retention table, average retention, best and weakest cohort (cohorts under 10 customers excluded).
- Activity dated before the customer start is ignored and counted.
- CSV, copy summary and print.

## How it works

`js/core.js` exports `CohortCore`: `rowsToEvents`, `report`, `toText`, `toCsv`, `sampleRows` and `labelOf`. SheetJS only reads the file in `app.js`; the logic works on plain rows.

| File                 | Purpose                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `index.html`         | Page structure and the Content-Security-Policy (blocks all network access)                          |
| `css/theme.css`      | Shared look and feel, light/dark. Synced from `shared/` - do not edit here                          |
| `css/app.css`        | Styles for this tool only                                                                           |
| `js/common.js`       | Shared helpers (downloads, file reading, status messages). Synced from `shared/` - do not edit here |
| `js/core.js`         | The logic: pure functions, unit-tested, no browser needed                                           |
| `js/app.js`          | Connects the page to the logic (thin by design)                                                     |
| `vendor/`            | Bundled third-party code: SheetJS Community Edition 0.20.3 (Apache-2.0)                             |
| `tests/core.test.js` | Unit tests for the logic                                                                            |

## Privacy and security

- Everything happens in your browser. Nothing you open, type or create is sent anywhere.
- The page's Content-Security-Policy (`<meta http-equiv="Content-Security-Policy">`) forbids network requests, inline scripts and `eval`, so even a bug could not send your data out.
- Third-party code is bundled in `vendor/` (exact versions and licenses in `vendor/README.md`) instead of loaded from a CDN, so there is no third party in the loop when you use the tool.
- Campaign budgets, customer lists and results can be commercially sensitive, and customer-level files are personal data. The files you save (`.json`, `.csv`, `.pdf`) are not password-protected: keep them where only the right people can open them.
- Use customer IDs rather than names or e-mail addresses in the file you load: the tool never shows the IDs, but the file itself is personal data.

## Limitations

- "Retained" means active at least once in that period, not active in every period since.
- Time zones are ignored: dates are read as calendar dates.
- Only the first sheet is read, and the first row must be the headers. Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/cohort-summary/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). SheetJS Community Edition 0.20.3 (Apache-2.0).
