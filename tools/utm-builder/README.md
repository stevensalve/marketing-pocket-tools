# UTM Link Builder

> Build tagged campaign links with naming rules and catch inconsistent names.

Part of [Marketing Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Type one link per line with its source, medium and campaign. The tool applies your naming rules (lower case, hyphens or underscores), adds the `utm_` parameters without disturbing the rest of the address, and flags near-duplicate names such as `Diwali Sale` and `diwali_sale` that would split your reports.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/utm-builder/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- utm-builder ../utm-builder-repo`.

## Features

- Batch input: `page | source | medium | campaign | term | content`.
- Naming rules: lower case, space replacement, and an allowed-medium list (editable).
- Keeps existing query parameters and the `#` fragment; replaces any old `utm_` values and tells you.
- Warnings for missing https, links over 2,000 characters, duplicate links and different spellings of one name.
- Copy one link or all, CSV (Excel-safe), and save/open as `.json`.

## How it works

`js/core.js` exports `UtmCore`: `FIELDS`, `COMMON_MEDIUMS`, `defaultRules`, `clean`, `build`, `parseBatch`, `batchToText`, `buildBatch`, `audit`, `toCsv`, `serialize`, `parse` and `sample`.

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

- It tags links; it does not shorten them or check that the pages exist.
- Only http and https addresses are accepted.
- The allowed-medium list is a convention you set, not something your analytics tool enforces. Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/utm-builder/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
