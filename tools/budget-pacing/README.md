# Budget Pacing Tracker

> Compare spend to date with a straight-line plan for each channel and see projections and daily allowances.

Part of [Marketing Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Enter the plan period, each channel's budget and spend so far. The tool shows where a straight-line plan would be today, whether each channel is ahead, behind or on pace, where it will end up at the current rate, and what daily spend fits what is left.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/budget-pacing/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- budget-pacing ../budget-pacing-repo`.

## Features

- Per-channel flight dates (default: the plan period).
- Pacing against a straight-line plan: 90% to 110% is on pace; overspent, not started, finished and underspent states.
- Projected total, projected gap to budget, current spend per day and allowed spend per day.
- Plain-language flags for channels that will run out early or are falling behind.
- Copy summary, CSV, print, and save/open as `.json`.

## How it works

`js/core.js` exports `PacingCore`: `parseRows`, `rowsToText`, `pace`, `report`, `toText`, `toCsv`, `serialize`, `parse` and `sample`. "Today" is always passed in; spend is to date including today.

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

- Straight-line pacing assumes even daily spend: campaigns with planned peaks (a festival sale) will look ahead or behind by design.
- The projection assumes the average daily spend so far continues.
- Single currency (INR); no taxes or agency fees. Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/budget-pacing/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
