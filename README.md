# RandomReader

> Can't decide what to read? Click **Surprise Me** and land on a random article from a curated catalog. No scrolling, no feed, no overthinking. Just chance.

A distraction-free browser extension that opens random articles from curated feeds.

![GitHub License](https://img.shields.io/github/license/GrishMahat/RandomReader)

> **Note:** The UI is intentionally minimal because the point is getting you to an article fast. If something looks off, it's a bug; file an [issue](https://github.com/GrishMahat/RandomReader/issues).

## Features

- **Surprise Me** opens a random article from your enabled sources in a new tab (or the current one)
- **Keyboard shortcut** (`Ctrl+.`, macOS `Cmd+.`) rolls without opening the popup; remap it under `chrome://extensions/shortcuts`
- **Snooze sources** hides a source from rolls for a day, a week, or a month without removing it
- **Per-source max age** overrides the global article-age filter for individual sources
- **Tag filtering** includes or excludes categories (`technology`, `web`, `security`, ...) to narrow the pool
- **Selection pool** picks from unread only, everything, or starred articles; keyword include/exclude filters by title
- **Explorer mode** tilts rolls toward unfamiliar topics, new sources, and wildcards instead of the balanced mix (filters always still apply)
- **Reading history** tracks every article opened via Surprise Me, exportable as CSV/JSON
- **Online catalog** ships from this repo via GitHub raw and is checked every 6 hours, preserving your source toggles on update. Import your own `catalog.json` (file picker or drag-and-drop) or point at your own URL.
- **Background refresh** fetches feeds automatically on a configurable interval (30 minutes to 24 hours). The stored pool is capped at 7 MB; oldest unstarred articles drop first.
- **Light and dark themes** with an accent color that stays out of the way

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

For a permanent install, zip the **contents** of `dist/firefox/` (so `manifest.json` is at the zip root) and upload to [Firefox Add-ons](https://addons.mozilla.org/) (free, no developer fee), since Firefox blocks unsigned permanent add-ons.

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
| Feed Refresh Interval | 30 minutes to 24 hours | 24 hours |
| Selection Pool | Unread Only / All / Starred Only | Unread Only |
| Article Discovery | Recent posts / Deep archive | Recent posts |
| Explorer Mode | off / on | off |
| Max Article Age | All time up to 3 months | All time |
| Include / Exclude Categories | any catalog tag | none |
| Keywords | include / exclude by title | none |

### Catalog

Sources live in `catalog.json` (repo root) and are served from the repo itself (`https://raw.githubusercontent.com/GrishMahat/RandomReader/refs/heads/main/catalog.json`) as the default remote `catalogUrl`, so every user shares the same curated list. Each source has:

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

- **`type`** is the feed format: `rss`, `atom`, or `sitemap`.
- **`include`** / **`exclude`** (optional) are path-prefix filters applied to the article URL.
- **`archive`** (optional) declares paginated history for Deep archive discovery, e.g. `"archive": { "template": "https://example.com/feed/?paged={n}", "wpTotalPages": true }`. With `wpTotalPages: true` the exact depth is discovered live from the WordPress REST API (`X-WP-TotalPages`) and cached per source, so no depth numbers live in the catalog. Without the flag, `maxPages` is the static depth; an audit of the catalog found ~34% of feeds respond to one of the pagination conventions.

`include`/`exclude` matter mainly for **`sitemap`** sources, which list every URL on a site, landing and category pages included. Path filters keep only the real articles (for example `"/about/news/"` keeps news posts while `"/archive/"` drops archive pages).

RSS and Atom feeds generally link straight to an article, so they usually need no filtering. Add `exclude` only if a feed's links redirect to the blog homepage or some other wrong page:

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

The bundled catalog ships with 130+ verified sources across tech, web, security, science, and maker niches.

You can import your own catalog via the **Catalog** section in Options (drag-and-drop a `.json` file) or set a remote `catalogUrl` and sync. The extension checks the online catalog every 6 hours and applies updates, keeping your enabled/disabled source toggles, snoozes, and blocked domains intact.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Vite dev server with HMR (reload the service worker manually from `chrome://extensions`) |
| `pnpm build` | Type-check then build to `dist/chrome/` |
| `pnpm build:firefox` | Type-check then build to `dist/firefox/` |
| `pnpm preview` | Preview the build |
| `pnpm lint` | Type-check (`tsc --noEmit`) + Biome lint/format check |
| `pnpm format` | Apply Biome formatting to the whole codebase |
| `pnpm test` | Run the Vitest suite once (`vitest run`) |
| `pnpm test:coverage` | Same, with a V8 coverage report (`coverage/`, gitignored) |

A pre-commit hook (`.githooks/pre-commit`) runs `pnpm lint` automatically. It's enabled on `pnpm install` via the `prepare` script; to enable it in an existing checkout, run `git config core.hooksPath .githooks` once.

## Project Structure

```
catalog.json          # Source catalog (served via GitHub raw as the default online catalog)
manifest.config.ts    # Shared extension manifest (CRXJS)
vite.config.ts        # Vite/CRXJS build config, per-browser manifest, release zips
biome.json            # Linter & formatter config
src/
├── background/       # Service worker
│   ├── main.ts       # Alarm scheduling + message handler registry
│   ├── feeds.ts      # Pool CRUD, roll tracking, batch refresh, random selection
│   ├── random.ts     # Open-a-random-article flow (tab handling, streaks)
│   ├── catalog.ts    # Catalog load/import/validate/update
│   └── store.ts      # Single typed seam over chrome.storage.local
├── providers/        # RSS / Atom / sitemap parsers
├── models/           # Zod schemas, message types, response map
├── utils/            # Messaging, icons, theme, shared settings vocabulary
├── config/           # Interest groups for onboarding
├── popup/            # Popup UI (Lit)
├── options/          # Options page (Lit)
└── icons/            # Extension icons & logo
```

## License

Released under the **GNU General Public License v3.0**. See [LICENSE](LICENSE) for details.

This is free software: you can redistribute it and/or modify it under the terms of the GPL. If you distribute a modified version, you must make the source available under the same license.
