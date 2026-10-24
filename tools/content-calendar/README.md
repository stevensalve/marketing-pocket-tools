# Content Calendar

> Plan blogs, emails, videos and more with owners, draft deadlines and status, and see what is late.

Part of [Marketing Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Add pieces with a type, topic, funnel stage, owner, draft deadline, publish date and status. The board shows each status as a column, the list flags late, draft-overdue and at-risk pieces, and the mix report shows whether the content is balanced across the funnel, types and owners.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/content-calendar/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- content-calendar ../content-calendar-repo`.

## Features

- Status flow Idea, Briefed, Drafting, In review, Approved, Published, with one-click move to the next step.
- Late (publish date passed), draft overdue, and at risk (publishing within 3 days and not yet in review).
- Mix by funnel stage, type and owner with plain-language notes; weeks with nothing to publish.
- Calendar file (`.ics`) with draft deadlines and publish dates, CSV, print, and save/open as `.json`.

## How it works

`js/core.js` exports `ContentCore`: `TYPES`, `STATUSES`, `FUNNEL`, `create`, `add`, `update`, `remove`, `stateOf`, `list`, `board`, `mix`, `emptyWeeks`, `summary`, `toCsv`, `toIcs`, `serialize`, `parse` and `sample`. "Today" is always passed in.

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

- It tracks plans; it does not publish, approve or notify anyone.
- The 3-day at-risk window and the mix notes are simple rules of thumb.
- Dates are calendar dates (no time zones). Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/content-calendar/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
