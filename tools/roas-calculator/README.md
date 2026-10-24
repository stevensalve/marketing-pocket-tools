# ROAS & Campaign ROI Calculator

> Return on ad spend, ROI, CPA, CPC and CPM per campaign in rupees, with break-even against your margin.

Part of [Marketing Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

List campaigns with spend, impressions, clicks, conversions and revenue (any figure can be left blank). The tool calculates the ratios for each campaign and the total, names the best and weakest campaign by ROAS, and, when you give a gross margin, shows break-even ROAS and profit after ad spend.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/roas-calculator/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- roas-calculator ../roas-calculator-repo`.

## Features

- Lines such as `Meta - retargeting | 80000 | 800000 | 16000 | 560 | 392000`; `Rs.` and lakh/crore grouping in output.
- CTR, CPC, CPM, conversion rate, CPA, average order value, ROAS, ROI.
- Break-even ROAS (1 divided by margin), profit after spend, and a profitable or losing verdict per campaign.
- A small calculator for the most you can pay per sale.
- Copy summary, CSV, print, and save/open as `.json`.

## How it works

`js/core.js` exports `RoasCore`: `parseRows`, `rowsToText`, `metrics`, `breakEven`, `report`, `toText`, `toCsv`, `serialize`, `parse` and `sample`.

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

- Revenue is whatever you enter: it does not de-duplicate or attribute sales across channels.
- It uses one gross margin for every campaign and ignores returns, shipping and other costs unless you include them in the margin.
- Single currency (INR). Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/roas-calculator/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
