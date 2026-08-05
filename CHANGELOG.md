# Changelog

All notable changes to Random Reader are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/) and this project uses [Semantic Versioning](https://semver.org/).

## Unreleased

## v0.1.3 - 2026-08-05

### Added
- **CRXJS migration**: project now uses `@crxjs/vite-plugin` with `manifest.config.ts` for type-safe manifest, HMR via `chrome-extension://` CORS, and `vite-plugin-zip-pack` for releases
- **Separate Chrome/Firefox release zips**: `random-reader-chrome.zip` and `random-reader-firefox.zip` with browser-specific manifests
- **GitHub Actions release workflow**: automated builds on tag push (`v*`), creates release with both zips (XPI attached for Firefox)
- **Typed message layer**: `sendMessage()` wrapper in `src/utils/messaging.ts` (handles `chrome.runtime.lastError`) plus a type-safe `ExtensionMessage` discriminated union; the background 16-case switch is now a handler registry keyed by message type
- **`PATCH_SETTINGS` message**: partial settings writes that skip no-op storage writes and only reschedule alarms when the refresh interval actually changes; the popup's per-control saves use it
- **Interest-based onboarding**: `src/config/interests.ts` defines interest groups so new users can pick topics by label instead of staring at a blank settings page
- **Explicit Content Security Policy** in the manifest (`script-src 'self'; object-src 'self';`), applied to extension pages
- **Biome** linting and formatting (devDependency, `biome.json`, `pnpm lint` now runs `tsc` + Biome, `pnpm format` for auto-fixing)
- **256px icon** and privacy policy (`PRIVACY.md`) for store submission
- **Snooze sources**: a source can be snoozed for 1 day/week/month (or woken early) from the Sources page; snoozed sources are excluded from rolls until the time passes, and re-enabling a snoozed source clears its snooze
- **Per-source max article age**: a source can override the global maximum article age filter, per source
- **Roll shortcut**: pressing `Alt+Shift+R` (`Command+Shift+Y` on macOS) opens a random article without opening the popup (configurable under `chrome://extensions/shortcuts`)

### Changed
- **Options page refactored into Lit components**: `general-section`, `sources-section`, `filters-section`, `history-section`, `catalog-section`, and `onboarding-screen`; the main `render()` now delegates to named sub-template methods instead of one deeply nested template
- **Central storage-key registry**: all `chrome.storage.local` keys consolidated into a single `STORAGE_KEYS` object in `models/index.ts` (no more scattered string literals)
- **`DEFAULT_SETTINGS` derived from the Zod schema** so defaults and schema always stay in sync
- **128-bit article ID hash** (upgraded from 64-bit) to eliminate collisions across large catalogs
- **Article pool dedupes by URL** as a secondary key (beyond ID), so redirect/normalized duplicates collapse to one
- **Starred articles stored lightweight**: the starred map persists only `{id, url, title, sourceId}` instead of full article objects (halves storage for starred items)
- **Roll stats de-duplicated**: `lastSourceId` is no longer stored separately — it's derived from the roll history head
- **Fewer storage reads per roll**: `getRandomArticle` passes the already-loaded pool into `resolveArticleTitle` instead of reading storage twice; the title cache is held in memory
- **Feed fetching hardened**: `Promise.allSettled` with per-URL error logging instead of one-shot sequential fetch
- **Options computed values cached**: `availableTags`, `filteredSources`, and `filteredHistory` are recomputed only when their inputs change, not on every render
- **Catalog updates preserve fetch tracking**: per-source `lastFetched`/`errorCount` survive remote catalog merges
- **Refresh diagnostics**: batch results now distinguish "no catalog loaded", "no enabled sources", and "all sources failed to fetch" instead of a silent `{fetched: 0, added: 0}`
- **RSS/Atom/sitemap parser cleanup**: `getText()` helper replaces repeated `getXmlObjectValue()` one-liners; `getXmlObjectValue` is now null-safe
- **Theme util** lazy-loads `window.matchMedia` so it's importable outside a window context
- **Feed refresh interval options** in the UI now come from a named constant list with human-readable labels
- **README**: replaced the self-deprecating joke, documented the MV3 service-worker HMR limitation, refreshed scripts/structure/tech-stack sections

### Fixed
- **Dark mode on options content sections**: the resolved theme (`data-theme`) is now propagated to the section components (`general-section`, `sources-section`, `filters-section`, `history-section`, `catalog-section`, `onboarding-screen`), so their backgrounds and cards follow the selected theme instead of staying light
- **Options page error handling**: settings/sources/history/catalog loads now run through `Promise.allSettled` and surface an error toast on failure instead of showing a silent partial state; catalog-mode/import/restore reloads report partial failures
- **Empty `<title>` on the logo SVG** (accessibility)
- **Unused variable** left over in `fetchSource`
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
