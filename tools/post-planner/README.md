# Social Post Planner

> Plan posts by channel and date with caption counters, a month view and calendar reminders.

Part of [Marketing Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Add posts with a channel, date, time, caption and status. The caption counter shows characters, hashtags and mentions against the channel limits as you type; a month view and list show what is planned, what is overdue and which days have nothing.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/post-planner/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- post-planner ../post-planner-repo`.

## Features

- Channels Instagram, Facebook, LinkedIn, X, YouTube, WhatsApp and Other with published limits and hashtag caps.
- Live counters and warnings: over the limit, too many hashtags, leading hashtag, too many hashtags on X.
- Status Idea, Drafted, Scheduled and Posted; overdue and gap detection.
- Month grid starting Monday; filters and search.
- Calendar file (`.ics`) with a 30-minute reminder for unposted items, CSV, print, and save/open as `.json`.

## How it works

`js/core.js` exports `PostCore`: `CHANNELS`, `STATUSES`, `create`, `hashtags`, `counter`, `add`, `update`, `remove`, `list`, `month`, `summary`, `toCsv`, `toIcs`, `serialize`, `parse` and `sample`. "Today" is always passed in.

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

- It plans and reminds; it does not post for you or connect to any platform.
- Limits are common published figures and platforms change them: check before you post.
- Calendar events use your device's local time (no time zones). Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/post-planner/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
