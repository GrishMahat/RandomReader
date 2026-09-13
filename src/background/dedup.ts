import type { Article } from '../models';
import { jaccardSimilarity, TITLE_STOPWORDS } from './scoring';

// ─── Deduplication v2 ─────────────────────────────────────────────────────────
// Four passes over one ordered list; the first occurrence always wins, so
// callers put existing pool entries before fresh fetches and read/starred
// flags are never clobbered by re-fetches:
//   1. exact id,
//   2. canonical URL (tracking params, case, www/mobile hosts, AMP variants),
//   3. normalized-title exact match (catches cross-outlet syndication where
//      the URL differs),
//   4. fuzzy title match, bucketed by leading tokens so it stays linear-ish
//      even against a full-size pool.

/** Exact title matching below this normalized length is skipped: short
 *  generic headlines ("Update", "Review") collide across unrelated stories. */
export const TITLE_MATCH_MIN_LENGTH = 16;

/** Fuzzy matching needs longer titles to be safe against siblings like
 *  "iPhone 18 Pro …" vs "iPhone 18 Pro Max …". */
export const FUZZY_MIN_LENGTH = 32;

/** Token overlap at or above this merges. 4/5 shared tokens (0.8) stays
 *  separate; 8/9 (0.89) merges. */
export const FUZZY_JACCARD_THRESHOLD = 0.85;

/** Max bucket members scanned per candidate (most recent first). Bounds
 *  fuzzy matching to O(1) per article even when thousands of headlines
 *  share leading tokens, keeping full-pool refreshes linear. Exact
 *  id/URL/title matching is unbounded and unaffected. */
export const FUZZY_BUCKET_SCAN_MAX = 64;

/** Unresolved sitemap entries share one placeholder title and must never
 *  match each other (compared normalized). */
const SITEMAP_PLACEHOLDER_TITLE = 'sitemap entry';

/** Query params that identify the click, not the article. `utm_*` handled
 *  by prefix; the rest are exact lowercase names. */
const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'wbraid',
  'gbraid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'yclid',
  '_hsenc',
  '_hsmi',
  'hsctatracking',
  'mkt_tok',
  'pk_campaign',
  'pk_kwd',
  'pk_medium',
  'pk_source',
  'pk_content',
  'srsltid',
  'scid',
  'oly_anon_id',
  'oly_enc_id',
  'rb_clickid',
  'vero_conv',
  'vero_id',
]);

/** AMP / alternate-output params stripped only for AMP-ish values, so a
 *  legitimate `?output=2` pagination param survives. */
const AMP_PARAMS = new Set(['amp', 'output', 'outputtype', 'output-type', 'platform']);
const AMP_VALUES = new Set(['', '1', 'true', 'amp']);

function isTrackingParam(name: string, value: string): boolean {
  const key = name.toLowerCase();
  if (key.startsWith('utm_') || TRACKING_PARAMS.has(key)) return true;
  return AMP_PARAMS.has(key) && AMP_VALUES.has(value.toLowerCase());
}

function stripMobileSubdomain(host: string): string {
  return host.replace(/^(www\.|m\.|mobile\.)+/, '');
}

/** Canonical identity key for a URL: scheme dropped (http/https merge),
 *  host lowercased without www/mobile prefixes (non-default ports kept via
 *  `.host`, so :8080 never merges with :80), AMP path suffix removed,
 *  fragment dropped, tracking params removed, survivors sorted. Falls back
 *  to a trimmed lowercase string for unparseable input (never throws). */
export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = stripMobileSubdomain(parsed.host.toLowerCase());
    let path = parsed.pathname.replace(/\/+$/, '').toLowerCase() || '/';
    path = path.replace(/\/amp$/, '') || '/';
    const params = [...parsed.searchParams.entries()]
      .filter(([name, value]) => !isTrackingParam(name, value))
      .map(([name, value]) => `${name.toLowerCase()}=${value}`)
      .sort();
    return params.length > 0 ? `${host}${path}?${params.join('&')}` : `${host}${path}`;
  } catch {
    return url.toLowerCase().replace(/\/+$/, '').trim();
  }
}

/** Lowercase, diacritics folded, punctuation to spaces, whitespace collapsed.
 *  "Café Review!" and "cafe review" normalize identically. */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Content tokens for similarity: unlike scoring affinity (which drops
 *  short tokens), short discriminators like "ai", "4k", "max" are kept —
 *  they are exactly what separates sibling headlines. */
function contentTokens(normalizedTitle: string): string[] {
  return [...new Set(normalizedTitle.split(' ').filter((t) => t.length >= 2 && !TITLE_STOPWORDS.has(t)))];
}

/** Bucket key from leading tokens; short-token titles skip fuzzy matching
 *  (their bucket would be huge and meaningless). */
function bucketKey(tokens: string[]): string | null {
  return tokens.length >= 3 ? tokens.slice(0, 3).join(' ') : null;
}

function titleEligible(normalizedTitle: string): boolean {
  return normalizedTitle.length >= TITLE_MATCH_MIN_LENGTH && normalizedTitle !== SITEMAP_PLACEHOLDER_TITLE;
}

function isFuzzyDuplicate(tokens: string[], buckets: Map<string, number[]>, keptTokens: string[][]): boolean {
  const key = bucketKey(tokens);
  if (!key) return false;
  const members = buckets.get(key) ?? [];
  for (const idx of members.slice(-FUZZY_BUCKET_SCAN_MAX)) {
    if (jaccardSimilarity(tokens, keptTokens[idx]) >= FUZZY_JACCARD_THRESHOLD) return true;
  }
  return false;
}

export function deduplicateArticles(articles: Article[]): Article[] {
  const kept: Article[] = [];
  const keptTokens: string[][] = [];
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const buckets = new Map<string, number[]>();

  for (const article of articles) {
    if (seenIds.has(article.id)) continue;
    const urlKey = canonicalizeUrl(article.url);
    if (seenUrls.has(urlKey)) continue;

    const normalized = normalizeTitle(article.title);
    if (titleEligible(normalized)) {
      if (seenTitles.has(normalized)) continue;
      const tokens = contentTokens(normalized);
      if (normalized.length >= FUZZY_MIN_LENGTH && isFuzzyDuplicate(tokens, buckets, keptTokens)) continue;
      seenTitles.add(normalized);
      const key = bucketKey(tokens);
      if (key) {
        const list = buckets.get(key);
        if (list) list.push(kept.length);
        else buckets.set(key, [kept.length]);
      }
      keptTokens.push(tokens);
    } else {
      keptTokens.push([]);
    }

    seenIds.add(article.id);
    seenUrls.add(urlKey);
    kept.push(article);
  }
  return kept;
}
