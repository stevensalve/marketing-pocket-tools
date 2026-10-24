# CAC & LTV Calculator

> Customer acquisition cost, lifetime value, LTV to CAC ratio and payback in rupees, with a what-if grid.

Part of [Marketing Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Enter marketing spend and new customers, then describe what a customer is worth: monthly revenue and churn for a subscription, or order value, orders per year and lifespan for repeat purchases. You get blended and paid CAC, LTV, the ratio, payback in months and a grid showing what happens if costs or retention change.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/cac-ltv/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- cac-ltv ../cac-ltv-repo`.

## Features

- Subscription and repeat-purchase models, both on gross margin.
- Blended CAC (all spend / all new customers) and paid CAC (ad spend / paid customers).
- Verdict bands: below 1x losing money, below 3x thin, 3x to 5x healthy, above 5x possibly under-investing.
- Warnings: very long lifetimes, payback over 12 months, paid CAC far above blended.
- Copy result, CSV, and save/open as `.json`.

## How it works

`js/core.js` exports `CacCore`: `validate`, `compute`, `sensitivity`, `toText`, `toCsv`, `serialize`, `parse` and `sample`.

| File                 | Purpose                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `index.html`         | Page structure and the Content-Security-Policy (blocks all network access)                          |
| `css/theme.css`      | Shared look and feel, light/dark. Synced from `shared/` - do not edit here                          |
| `css/app.css`        | Styles for this tool only                                                                           |
| `js/common.js`       | Shared helpers (downloads, file reading, status messages). Synced from `shared/` - do not edit here |
| `js/core.js`         | The logic: pure functions, unit-tested, no browser needed                                           |
| `js/app.js`          | Connects the page to the logic (thin by design)                                                     |
| `tests/core.test.js` | Unit tests for the logic                                                                            |

## Privacy and security

- Everything happens in your browser. Nothing you open, type or create is sent anywhere.
- The page's Content-Security-Policy (`<meta http-equiv="Content-Security-Policy">`) forbids network requests, inline scripts and `eval`, so even a bug could not send your data out.
- The tool has no third-party dependencies at all.
- Campaign budgets, customer lists and results can be commercially sensitive, and customer-level files are personal data. The files you save (`.json`, `.csv`, `.pdf`) are not password-protected: keep them where only the right people can open them.

## Limitations

- LTV is a projection from averages: it ignores discounting, expansion revenue and different customer segments.
- The 3x target is a common rule of thumb, not a law; cash-constrained businesses may need faster payback.
- Single currency (INR). Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/cac-ltv/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
