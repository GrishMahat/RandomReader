# Privacy Policy for Random Reader

**Last updated:** August 3, 2026

Random Reader ("the extension") is a browser extension that helps you discover random articles from curated RSS/Atom feeds. This policy explains what data the extension collects, how it's used, and your rights.

## Data We Collect (Stored Locally on Your Device)

The extension stores the following data **locally in your browser** using Chrome/Firefox storage APIs. This data never leaves your device unless you explicitly export it.

| Data Type | Purpose | Retention |
|-----------|---------|-----------|
| **Reading history** | Track articles you've opened via "Surprise Me" (title, URL, source, author, timestamp) | Capped at 200 entries, oldest removed first |
| **Starred articles** | Articles you've marked as favorites | Until you un-star or clear data |
| **Settings** | Your preferences (theme, open behavior, filters, refresh interval, sound, etc.) | Until changed or reset |
| **Source toggles** | Which of the 136+ catalog sources are enabled/disabled | Until changed |
| **Blocked domains** | Domains you've chosen to exclude from results | Until removed |
| **Feed cache** | Fetched article metadata (title, URL, publication date, source) for the random pool | 90 days, auto-cleaned |

## Data We Do NOT Collect

- No personal identifiers (name, email, IP address)
- No browsing history outside the extension
- No analytics, telemetry, or usage tracking
- No data sent to any external server (including the developer)
- No advertising IDs or cross-site tracking

## Network Requests

The extension makes network requests **only** to:
1. **RSS/Atom feed URLs** defined in the source catalog (e.g., `https://example.com/feed.xml`) — to fetch article lists
2. **Sitemap URLs** defined in the source catalog — to resolve article titles
3. **Optional remote catalog URL** (default: GitHub raw URL) — to check for catalog updates every 6 hours

All requests are initiated by the background worker on your behalf. No cookies, auth tokens, or user identifiers are sent.

## Your Rights & Controls

- **View/export history**: Options → History → Export CSV/JSON
- **Clear history**: Options → History → Clear History
- **Clear all data**: Options → General → Clear All Data (removes history, stars, cached articles)
- **Reset settings**: Options → General → Restore Defaults
- **Disable feeds**: Options → Sources → toggle any source off
- **Block domains**: Options → Catalog → Blocked Domains
- **Uninstall**: Removes all local data automatically

## Third-Party Services

The default catalog is hosted on GitHub (`raw.githubusercontent.com`). Fetching it is subject to GitHub's privacy policy. You can switch to a local catalog file in Options → Catalog to avoid this request.

## Children's Privacy

This extension is not directed at children under 13. We do not knowingly collect data from children.

## Changes to This Policy

Updates will be posted here with a new "Last updated" date. Continued use after changes constitutes acceptance.

## Contact

Questions: [GitHub Issues](https://github.com/grishmahat/random-reader/issues) or email the developer.

---

**Summary:** Your data stays on your device. We don't see it, sell it, or track you.