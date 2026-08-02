# RandomReader

> Can't decide what to read? This extension is for you. Just click **Surprise Me** and go to a random blog or article — no scrolling, no doom-scrolling, no overthinking. Just chance.

A clean, distraction-free browser extension that opens random articles from curated feeds. Click **Surprise Me** and let chance decide what you read next.

![GitHub License](https://img.shields.io/github/license/GrishMahat/RandomReader)

> **Why is the UI so terrible and nothing seems to work?**
> Don't look at me. I just wrote the extension. The UI has its own personal issues, and frankly, we don't talk about it.

## Features

- 🎲 **Surprise Me** — opens a random article from your enabled sources in a new tab (or the current one)
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
- `browser.storage.local` for persistence, `chrome.alarms` for background refresh

## Getting Started

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/)

### Install & Build

```bash
pnpm install
pnpm build
```

The built extension lands in `dist/`.

### Build for Firefox

```bash
pnpm build:firefox
```

Outputs to `dist-firefox/` with a `browser_specific_settings.gecko` manifest. Zip the folder contents and upload to [Firefox Add-ons](https://addons.mozilla.org/) (free, no developer fee).

### Load in Chrome (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked**
4. Select the `dist/` folder
5. Pin the extension and click the toolbar icon

### Development

```bash
pnpm dev
```

Runs the Vite dev server with CRXJS hot-reload.

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

Sources live in `catalog.json` (repo root) and are also published to a [public gist](https://gist.github.com/GrishMahat/bbe566d031b9847e8e83a367a5838253) that serves as the default remote `catalogUrl` — so every user shares the same curated list. Each source has:

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
| `pnpm dev` | Vite dev server with HMR |
| `pnpm build` | Type-check then build to `dist/` |
| `pnpm preview` | Preview the build |
| `pnpm lint` | Type-check only (`tsc --noEmit`) |

## Project Structure

```
catalog.json          # Source catalog (published to the gist used as default online catalog)
src/
├── background/       # Service worker: message router, feed refresh, alarms
│   ├── worker.ts     # Message handlers (GET_SOURCES, OPEN_RANDOM, GET_HISTORY, ...)
│   ├── feeds.ts      # Fetch, parse, store articles; random selection
│   ├── random.ts     # Open-a-random-article logic
│   ├── catalog.ts    # Catalog load/import/validate
│   └── cache.ts      # Feed cache helpers
├── popup/            # Popup UI (Lit)
├── options/          # Options page (Lit)
├── providers/        # RSS / Atom / sitemap parsers
├── models/           # Zod schemas & types
├── icons/            # Extension icons & logo
└── manifest.json     # Extension manifest
```

## License

Released under the **GNU General Public License v3.0**. See [LICENSE](LICENSE) for details.

This is free software: you can redistribute it and/or modify it under the terms of the GPL. If you distribute a modified version, you must make the source available under the same license.
