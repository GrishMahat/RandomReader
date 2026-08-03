# Changelog

All notable changes to Random Reader are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/) and this project uses [Semantic Versioning](https://semver.org/).

## Unreleased

### Added
- **CRXJS migration**: project now uses `@crxjs/vite-plugin` with `manifest.config.ts` for type-safe manifest, HMR via `chrome-extension://` CORS, and `vite-plugin-zip-pack` for releases
- **Separate Chrome/Firefox release zips**: `random-reader-chrome.zip` and `random-reader-firefox.zip` with browser-specific manifests
- **GitHub Actions release workflow**: automated builds on tag push (`v*`), creates release with both zips

### Changed
- **Project structure**: reorganized `src/` to CRXJS conventions — `popup/main.ts`, `options/main.ts`, `background/main.ts` with `index.html` entry points
- **Manifest**: moved from `src/manifest.json` to root `manifest.config.ts` using plain object export
- **Build config**: added dev-server CORS for hot-reload, Firefox build uses `background.scripts` + `browser_specific_settings`

### Fixed
- **Asset imports**: fixed relative paths for icons in popup/options components
- **Release naming**: zips now include browser identifier to avoid confusion

## v0.1.2 - 2026-08-03

### Added
- **Hybrid random pool**: "Surprise Me" now prefers articles from the stored pool (filtered to enabled sources), falling back to a live fetch of a random source (up to 8 attempts) when the pool is empty.
- **Incremental batch refresh**: replaces the full sequential feed fetch — a random batch of sources is refreshed (20 on install/startup, 10 per alarm) at concurrency 4, tracking per-source `lastFetched`/`errorCount`.
- **Lucky streaks & source diversity**: recent sources are weighted down so rolls spread across the catalog, but repeats still happen and the popup announces streaks (≥2 same source) with odds (`~1 in N^streak`).
- **Persistent history & stars**: dedicated stores for reading history (capped at 200, deduped) and starred articles; starred items survive pool resets; new star toggle in the popup.
- **Blocked domains**: per-domain blocklist in the catalog, managed from Options, enforced during both pool selection and live fetches, preserved across catalog updates.
- **Sitemap depth**: `maxUrls` cap per source plus lazy real-`<title>` resolution (bounded cache) so sitemap entries aren't all "Sitemap Entry".
- **Online, versioned catalog**: ships from GitHub by default with a 6-hourly, version-guarded auto-update that preserves your source toggles and blocked domains; remote/local mode with file import.
- **Themes**: light/dark/system with live OS-color-scheme sync; new CSS variables for toggle styling.
- **Sound FX** on Surprise Me (Web Audio, click-gesture initialized).
- Options: restore-defaults, clear-data/clear-history, refresh counts, catalog source card, reading stats, interest-group source lists, toast notifications.

### Changed
- **Catalog v6: 136 sources** (was 77 bundled).
- **Multi-feed sources**: sources can declare `feeds[]` fetched in parallel and merged/deduped (Bloomberg: 5 feeds → ~58 articles; NYT: 4 feeds → ~162).
- **Article retention** extended from 30 to 90 days.
- **Storage**: removed the `content` and `summary` fields (~50% smaller pool); keyword filters now match titles only.
- **Pool safety cap** (7 MB): oldest non-starred articles dropped first to stay under the storage quota.
- Host permissions widened to `http://` + `https://` (for sitemap title resolution).

### Fixed
- **Article ID collisions**: ids were derived from the first 32 base64 chars of the URL (~24 URL chars), so articles sharing a long URL prefix (e.g., all Bloomberg video URLs) got the *same* id and deduped to one — this was why "Surprise Me" kept returning the same article. Ids now use a full-URL hash.
- **5 feed-type mismatches** (rss declared as atom or vice versa) that silently yielded zero articles: The Register, Python Blog, Business Insider, The Atlantic, Vox.
- Robust URL extraction for RSS/Atom (array links, `rel=alternate`, guid fallback) and homepage/path filtering for all feed types.
- Removed 7 paywalled publishers (Bloomberg, NYT, Washington Post, WSJ, Financial Times, The New Yorker, The Atlantic) and disabled dead feeds (Quartz, NYRB).

## v0.1.0 - 2026-08-02

Initial release. Bundled catalog of 77 sources, RSS/Atom/sitemap parsing, popup and options pages, background refresh on a configurable interval, tag/keyword/max-age filtering, selection modes, and reading history.
