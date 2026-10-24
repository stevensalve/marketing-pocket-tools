# Ad Copy Length Checker

> Check headlines and descriptions against platform character limits and common review flags before you upload.

Part of [Marketing Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Choose where the ad will run, type one version per line, and see each line counted against its limit, what would be cut off, and wording that reviewers often check. Includes an SMS length counter.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/ad-copy-checker/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- ad-copy-checker ../ad-copy-checker-repo`.

## Features

- Presets for Google Search responsive ads, Meta feed, LinkedIn, X, email and a custom limit; every limit is editable.
- Counts characters the way Google does (wide characters count as two).
- Flags ALL CAPS words, repeated exclamation marks, double spaces, many emoji and claims such as "best", "guaranteed" or "free".
- Minimum and maximum line counts and duplicate headline check for Google.
- SMS segments for GSM-7 and Unicode text; copy report, CSV, and save/open as `.json`.

## How it works

`js/core.js` exports `AdCore`: `PRESETS`, `length`, `cut`, `checkLine`, `parseLines`, `audit`, `sms`, `toCsv`, `toText`, `serialize`, `parse` and `sample`.

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
- Ad copy is usually public once published, but unreleased campaigns are confidential: keep saved files accordingly.

## Limitations

- The limits are common published figures at the time of writing and platforms change them: confirm in the ad manager.
- The wording flags are prompts for a human check, not a prediction of approval or rejection.
- Some platforms count emoji or special characters differently. Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/ad-copy-checker/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
