# RandomReader

> Can't decide what to read? This extension is for you. Just click **Surprise Me** and go to a random blog or article — no scrolling, no doom-scrolling, no overthinking. Just chance.

A clean, distraction-free browser extension that opens random articles from curated feeds. Click **Surprise Me** and let chance decide what you read next.

![GitHub License](https://img.shields.io/github/license/GrishMahat/RandomReader)

> **Note:** The UI is intentionally minimal — the point is getting you to an article fast. If something looks off, it's a bug; file an [issue](https://github.com/GrishMahat/RandomReader/issues).

## Features

- 🎲 **Surprise Me** — opens a random article from your enabled sources in a new tab (or the current one)
- ⌨️ **Keyboard shortcut** — press `Alt+Shift+R` (macOS: `Command+Shift+Y`) to open a random article without opening the popup. Remap it anytime under `chrome://extensions/shortcuts`
- ⏸️ **Snooze sources** — hide a source from rolls for a day, a week, or a month without removing it, from the Sources page
- ⏱️ **Per-source max age** — override the global article-age filter for individual sources
- 🏷️ **Tag-based filtering** — include/exclude categories (e.g. `technology`, `web`, `security`) to narrow the pool
- 🔍 **Smart filtering** — selection pool (unread / all / starred), max article age, and keyword include/exclude
- 🕓 **Reading history** — every article opened via Surprise Me is tracked
- 📦 **Online catalog** — the source list ships from a public gist by default, with an auto-update mechanism (checked every 6 hours) so everyone gets the latest curated sources. Import your own `catalog.json` (file picker / drag-and-drop) or point to your own URL to take control.
- ⚡ **Background refresh** — feeds fetched automatically on a configurable interval (30 min → 30 days), no storage caps
- 🎨 **Clean UI** — gray accent theme with a wide, rounded popup

## Tech Stack

- [Manifest V3](https://developer.chrome.com/docs/extensions/develop/concepts/manifest-v3) WebExtension
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) + [CRXJS](https://crxjs.dev/)
- [Lit](https://lit.dev/) for UI
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) for RSS / Atom / sitemap parsing
- [Zod](https://zod.dev/) for runtime schema validation
- [Biome](https://biomejs.dev/) for linting and formatting
- `browser.storage.local` for persistence, `chrome.alarms` for background refresh

## Getting Started

### Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io/) v11 (install with `npm i -g pnpm@11`)

### Install & Build

```bash
pnpm install --frozen-lockfile
pnpm build
```

The built extension lands in `dist/chrome/`.

### Build for Firefox

```bash
pnpm build:firefox
```

Outputs to `dist/firefox/` with a `browser_specific_settings.gecko` manifest and a `background.scripts` event page (Firefox doesn't support MV3 `background.service_worker`).

### Build Outputs

| Command | Output | Description |
| --- | --- | --- |
| `pnpm build` | `dist/chrome/` + `release/random-reader-chrome.zip` | Chrome Web Store package |
| `pnpm build:firefox` | `dist/firefox/` + `release/random-reader-firefox.zip` + `release/random-reader.xpi` | Firefox package (AMO upload is `random-reader-firefox.zip`) |

> The AMO submission package (`release/random-reader-firefox.zip`) is a zip of the `dist/firefox/` directory contents with `manifest.json` at the archive root.

### Load in Firefox (temporary)

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `dist/firefox/manifest.json` (Firefox wants the `manifest.json` file, not the folder)
4. The extension stays loaded until Firefox restarts

For a permanent install, zip the **contents** of `dist/firefox/` (so `manifest.json` is at the zip root) and upload to [Firefox Add-ons](https://addons.mozilla.org/) (free, no developer fee) — Firefox blocks unsigned permanent add-ons.

### Load in Chrome (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked**
4. Select the `dist/chrome/` folder
5. Pin the extension and click the toolbar icon

### Development

```bash
pnpm dev
```

Runs the Vite dev server with CRXJS hot-reload.

> **Note:** CRXJS hot-reloads the popup and options pages automatically, but MV3 service workers are **not** reloaded by HMR. After changing anything under `src/background/`, go to `chrome://extensions` and click the reload button on the extension. Otherwise you'll be debugging stale service worker code.

## Configuration

### Settings

| Setting | Options | Default |
| --- | --- | --- |
| Open Articles In | `new_tab` / `current_tab` | `new_tab` |
| Feed Refresh Interval | 30 min → 30 days | 24 hours |
| Selection Pool | Unread Only / All / Starred Only | Unread Only |
| Max Article Age | All time → 3 months | All time |
| Include / Exclude Categories | any catalog tag | none |
| Keywords | include / exclude by title & summary | none |

### Catalog

Sources live in `catalog.json` (repo root) and are served from the repo itself (`https://raw.githubusercontent.com/GrishMahat/RandomReader/refs/heads/main/catalog.json`) as the default remote `catalogUrl` — so every user shares the same curated list. Each source has:

```json
{
  "id": "hn-frontpage",
  "name": "Hacker News",
  "type": "rss",
  "url": "https://news.ycombinator.com/rss",
  "language": "en",
  "enabled": true,
  "tags": ["technology", "tech", "news"]
}
```

- **`type`** — the feed format: `rss`, `atom`, or `sitemap`.
- **`include`** / **`exclude`** (optional) — path-prefix filters on the article URL.

`include`/`exclude` are mainly useful for **`sitemap`** sources, which list every URL on a site — including landing and category pages — so path filters keep only the real articles (e.g. `"/about/news/"` keeps news posts, `"/archive/"` drops archive pages).

RSS and Atom feeds generally link straight to an article, so they usually need no filtering. Add `exclude` only if a feed's links redirect to the blog homepage or a wrong page instead of the article:

```json
{
  "id": "example-feed",
  "name": "Example Feed",
  "type": "rss",
  "url": "https://example.com/rss",
  "enabled": true,
  "tags": ["web"],
  "exclude": ["/redirect/", "/home"]
}
```

The bundled catalog ships with 70+ verified sources across tech, web, security, science, and maker niches.

You can import your own catalog via the **Catalog** section in Options (drag-and-drop a `.json` file) or set a remote `catalogUrl` and sync. By default the extension checks the online catalog every 6 hours and auto-applies updates (guarded by the catalog `version` field), preserving your enabled/disabled source toggles.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Vite dev server with HMR (reload the service worker manually from `chrome://extensions`) |
| `pnpm build` | Type-check then build to `dist/chrome/` |
| `pnpm build:firefox` | Type-check then build to `dist/firefox/` |
| `pnpm preview` | Preview the build |
| `pnpm lint` | Type-check (`tsc --noEmit`) + Biome lint/format check |
| `pnpm format` | Apply Biome formatting to the whole codebase |

## Project Structure

```
catalog.json          # Source catalog (published to the gist used as default online catalog)
manifest.config.ts    # Shared extension manifest (CRXJS)
vite.config.ts        # Vite/CRXJS build config, per-browser manifest, release zips
biome.json            # Linter & formatter config
src/
├── background/       # Service worker: message router, feed refresh, alarms
│   ├── main.ts       # Message handlers (GET_SOURCES, OPEN_RANDOM, GET_HISTORY, ...)
│   ├── feeds.ts      # Fetch, parse, store articles; random selection
│   ├── random.ts     # Open-a-random-article logic
│   ├── catalog.ts    # Catalog load/import/validate
│   └── storage.ts    # History & starred storage helpers
├── popup/            # Popup UI (Lit)
├── options/          # Options page (Lit)
├── providers/        # RSS / Atom / sitemap parsers
├── models/           # Zod schemas & types
└── icons/            # Extension icons & logo
```

## License

Released under the **GNU General Public License v3.0**. See [LICENSE](LICENSE) for details.

This is free software: you can redistribute it and/or modify it under the terms of the GPL. If you distribute a modified version, you must make the source available under the same license.
