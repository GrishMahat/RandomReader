# Changelog

All notable changes to Random Reader are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/) and this project uses [Semantic Versioning](https://semver.org/).

## v0.2.0 - 2026-08-21

### Added
- **Deep archive discovery**: a new "Article Discovery" setting (Recent posts / Deep archive). Deep rolls pick a weighted-random source and fetch from somewhere inside its history instead of the latest feed page, best strategy first: WordPress REST `X-WP-TotalPages` probed once per source for an exact page count (30 of 46 paginating sources expose it, declared via the `wpTotalPages` flag so no depths are hardcoded in the catalog), then static `maxPages` for sites without an index, then `?paged=` / `?page=` probing with learned per-source depth, then plain feed fetch as fallback. An audit of all 136 catalog sources found 46 feeds (34%) support one of the pagination conventions; oversized sitemaps now also contribute a random window of their URL list instead of always the newest entries.
- **Typed store seam**: new `src/background/store.ts` is the only module that touches `chrome.storage.local`. Every read passes through a Zod schema (`ArticleSchema`, `HistoryEntrySchema`, and `StarredMapSchema` now actually run, so corrupted or stale data falls back instead of flowing into the pool as a blind cast), writes are centralized for atomic multi-key updates, and `clearUserData()` derives its key list from `STORAGE_KEYS` instead of hand-enumerating them.
- **Typed message responses**: a `MessageResponses` map in `models/index.ts` pairs every request type with one response interface. `sendMessage({ type })` returns exactly the declared payload, handler parameters narrow automatically, and all ad-hoc response shapes are gone (the duplicated `SettingsResponse` in popup and options, plus `GenericResponse`, `CatalogInfoResponse`, `ImportResponse`, and seven per-handler `Extract<>` casts).
- **Compact catalog info**: `GET_CATALOG_INFO` ships version/updatedAt/source-count summaries over the message pipe instead of two full catalog objects (~35 KB saved per options open).
- **Shared settings vocabulary**: `src/utils/ui.ts` holds one table each for max-age, open-target, selection-mode, and snooze options plus `formatTimestamp` and an `emitSettingChange` helper. The popup's max-age menu gains the 3-day/2-week/3-month choices it was missing.
- **Vector icon set**: `src/utils/icons.ts` provides lucide-style inline SVGs; sidebar navigation, toolbar buttons, dropzone, toasts, chips, and empty states no longer use emoji or text glyphs as structural icons.
- **Design system**: both UIs share one token vocabulary of warm paper neutrals, a teal brand accent, an elevation scale, and motion timing. Keyboard focus is visible everywhere via `:focus-visible`, and `prefers-reduced-motion` collapses animations.
- **Redesigned popup**: "Surprise Me" is a 44px gradient hero button with hover lift, tabs are a segmented control, cards carry soft shadows, history rows have hover states, and the onboarding banner uses the accent tint.
- **Redesigned options page**: SVG nav icons, upgraded toast with real elevation and slide-up animation, glowing drag-and-drop dropzone, larger toggle switches, tabular numerals for stats, flattened card headers, and a polished onboarding screen with radial accent glow.
- **Theme-aware document backdrop**: the options HTML shell resets browser default margins, sets `color-scheme`, follows the OS theme before first paint, and syncs the document background when the user picks light/dark explicitly.

### Changed
- **One catalog update path**: `updateCatalogIfNewer` and its version gate are gone. Startup, the 6-hour alarm, and manual sync all call the same `refreshCatalog()`, which merges remote updates while preserving source toggles, snoozes, and blocked domains. A stored version higher than the remote one can no longer silently skip updates (the public catalog reset from v2 to v1 used to strand those users on the alarm path).
- **Honest sync reporting**: `REFRESH_CATALOG` returns failure when the fetch fails instead of always reporting success, so the "Catalog synced" toast no longer lies.
- **Atomic roll recording**: roll stats and roll history are written in a single storage call, so a crash between them cannot leave streak and history inconsistent.
- **Race-safe batch refresh**: the article pool is re-read after fetching (the fetch loop takes seconds) and existing entries win dedupe, so articles starred or read during a refresh keep their flags. Title resolution patches a single article through the store instead of writing back a stale pool snapshot.
- **Source tracking behind a seam**: feed fetch outcomes reach the catalog through a dedicated `markSourcesFetched()` interface instead of feeds.ts rewriting catalog internals.
- **Consistent diversity weighting**: live on-demand picks use the same source weighting as pooled rolls instead of uniform random, so live results don't hammer recently-seen sources.
- **Teal accent**: purple replaced with deep teal (`#0F766E` light / brighter gradient stops in dark) across buttons, toggles, chips, focus rings, and the roll-button glow.
- **Unified naming**: the history timestamp is `openedAt` end-to-end (model, message, UI, CSV export header), the snooze predicate is one shared `isSnoozed()`, four `formatDate` variants collapsed into `formatTimestamp`, three copies of `emitSettingChange` became one, and `DAY_MS` has a single definition.

### Fixed
- **White edges around the options page in dark mode**: `options/index.html` shipped without any CSS, so the browser's default 8px body margin left a white frame around the app.
- **"Catalog synced" shown on failed syncs**: the handler returned `success: true` unconditionally regardless of fetch outcome.
- **Stale-pool clobbering**: refreshing feeds could wipe stars and read flags applied while the fetch was in flight; title resolution could write back an outdated pool array.
- **Drifted option menus**: popup and options offered different max-age choices for the same setting.
- **Dead code removed**: unused `debounce()`/`clamp()` helpers, and the duplicate `browsers` entry in the Technology interest group (already covered by Web & Browsers).
- **Options settings apply immediately**: every control on the Options page now persists through `PATCH_SETTINGS` the moment it changes, matching the popup's behavior, instead of silently reverting if the page closed without pressing Save Settings. The Article Discovery select also no longer renders blank when stored settings predate the field.

### Known limitations
- **Deep archive still skews toward newer posts**: a deep roll picks a random source from everything enabled, then a random page in that source, then a random article from that page. But only 41 of 135 sources have any depth to pick from (a WordPress `X-WP-TotalPages` index, a measured maximum, or a declared archive template); the other 94 are page-one-only feeds. For roughly 7 in 10 deep rolls, "a random page" therefore collapses to page 1, and the roll returns recent items. That is a real bias toward newer posts, not uniform randomness across history. Deep mode is still slightly more varied than Recent alone, but it does not yet deliver truly random picks from across a site's history. The next update will chip away at this bias step by step, starting with an option to restrict deep rolls to depth-capable sources only so every deep roll actually reaches into an archive, with the long-term goal of choosing uniformly at random from everything a source has published.

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
- **Roll shortcut**: pressing `Ctrl+.` (`Cmd+.` on macOS) opens a random article without opening the popup (configurable under `chrome://extensions/shortcuts`)

### Changed

- **Options page refactored into Lit components**: `general-section`, `sources-section`, `filters-section`, `history-section`, `catalog-section`, and `onboarding-screen`; the main `render()` now delegates to named sub-template methods instead of one deeply nested template
- **Central storage-key registry**: all `chrome.storage.local` keys consolidated into a single `STORAGE_KEYS` object in `models/index.ts` (no more scattered string literals)
- **`DEFAULT_SETTINGS` derived from the Zod schema** so defaults and schema always stay in sync
- **128-bit article ID hash** (upgraded from 64-bit) to eliminate collisions across large catalogs
- **Article pool dedupes by URL** as a secondary key (beyond ID), so redirect/normalized duplicates collapse to one
- **Starred articles stored lightweight**: the starred map persists only `{id, url, title, sourceId}` instead of full article objects (halves storage for starred items)
- **Roll stats de-duplicated**: `lastSourceId` is no longer stored separately; it's derived from the roll history head
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
- **Incremental batch refresh**: replaces the full sequential feed fetch. A random batch of sources is refreshed (20 on install/startup, 10 per alarm) at concurrency 4, tracking per-source `lastFetched`/`errorCount`.
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
- **Article ID collisions**: ids were derived from the first 32 base64 chars of the URL (~24 URL chars), so articles sharing a long URL prefix (e.g., all Bloomberg video URLs) got the *same* id and deduped to one, which is why "Surprise Me" kept returning the same article. Ids now use a full-URL hash.
- **5 feed-type mismatches** (rss declared as atom or vice versa) that silently yielded zero articles: The Register, Python Blog, Business Insider, The Atlantic, Vox.
- Robust URL extraction for RSS/Atom (array links, `rel=alternate`, guid fallback) and homepage/path filtering for all feed types.
- Removed 7 paywalled publishers (Bloomberg, NYT, Washington Post, WSJ, Financial Times, The New Yorker, The Atlantic) and disabled dead feeds (Quartz, NYRB).

## v0.1.0 - 2026-08-02

Initial release. Bundled catalog of 77 sources, RSS/Atom/sitemap parsing, popup and options pages, background refresh on a configurable interval, tag/keyword/max-age filtering, selection modes, and reading history.
