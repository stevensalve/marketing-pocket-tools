# A/B Test Significance

> Check whether a conversion difference is real, plan the sample size, and export a one-page summary.

Part of [Marketing Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Enter visitors and conversions for versions A and B and get the conversion rates, relative lift, p-value, a confidence range for the difference and a plain-language verdict. A second card tells you how many visitors you need per version for the next test, and how many days that takes.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/ab-test/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- ab-test ../ab-test-repo`.

## Features

- Two-proportion z-test (two-sided) at 80%, 90%, 95% or 99% confidence.
- Warnings for samples with few conversions.
- Sample-size planner: baseline rate, smallest improvement worth detecting (relative or percentage points), confidence and power; time needed from daily visitors.
- Copy as text, one-page PDF summary with your notes, and save/open as `.json`.

## How it works

`js/core.js` exports `AbCore`: `cdf`, `inv`, `check`, `compare`, `sampleSize`, `duration`, `toText`, `sanitize`, `buildPdf`, `serialize`, `parse` and `sample`. The normal distribution functions are implemented in the file (no statistics library).

| File                 | Purpose                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `index.html`         | Page structure and the Content-Security-Policy (blocks all network access)                          |
| `css/theme.css`      | Shared look and feel, light/dark. Synced from `shared/` - do not edit here                          |
| `css/app.css`        | Styles for this tool only                                                                           |
| `js/common.js`       | Shared helpers (downloads, file reading, status messages). Synced from `shared/` - do not edit here |
| `js/core.js`         | The logic: pure functions, unit-tested, no browser needed                                           |
| `js/app.js`          | Connects the page to the logic (thin by design)                                                     |
| `vendor/`            | Bundled third-party code: pdf-lib 1.17.1 (MIT)                                                      |
| `tests/core.test.js` | Unit tests for the logic                                                                            |

## Privacy and security

- Everything happens in your browser. Nothing you open, type or create is sent anywhere.
- The page's Content-Security-Policy (`<meta http-equiv="Content-Security-Policy">`) forbids network requests, inline scripts and `eval`, so even a bug could not send your data out.
- Third-party code is bundled in `vendor/` (exact versions and licenses in `vendor/README.md`) instead of loaded from a CDN, so there is no third party in the loop when you use the tool.
- Campaign budgets, customer lists and results can be commercially sensitive, and customer-level files are personal data. The files you save (`.json`, `.csv`, `.pdf`) are not password-protected: keep them where only the right people can open them.

## Limitations

- It tests one metric between two versions. It does not correct for testing many variants or many metrics, or for stopping a test early when it looks good.
- The z-test is an approximation: with very few conversions, treat results as a hint.
- PDF fonts are Latin only; the rupee sign prints as `Rs.` and other scripts as `?`. Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/ab-test/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). pdf-lib (MIT).
