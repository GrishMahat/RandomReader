#!/usr/bin/env node
/**
 * Measures the real archive depth (last working page) for catalog sources
 * that use a static `archive.maxPages`, i.e. paginating feeds with no
 * WordPress index to ask live, and writes the measured values back into
 * catalog.json.
 *
 * Method per source: fetch page 1 for a content signature, then gallop
 * (100, 200, 400, ...) until a page stops returning fresh items, then binary
 * search between the last working and first failing page. A page counts as
 * "working" only if it returns items AND differs from page 1 (some sites
 * redirect out-of-range pages back to page 1).
 *
 * Sources flagged `wpTotalPages: true` are skipped: their depth is discovered
 * live by the extension at roll time.
 *
 * Usage:
 *   pnpm catalog:depths            # measure static-archive sources
 *   node scripts/update-archive-depths.mjs --all   # include wpTotalPages sources (informational only)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = resolve(ROOT, 'catalog.json');

const UA = 'Mozilla/5.0 (compatible; RandomReaderCatalogDepth/0.1; +https://github.com/GrishMahat/RandomReader)';
const TIMEOUT_MS = 10_000;
const CONCURRENCY = 4;
const PROBE_START = 2;
const MAX_PAGE = 200_000;
const MAX_REQUESTS_PER_SOURCE = 48;

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
const includeFlagged = process.argv.includes('--all');

const targets = catalog.sources.filter((s) => s.archive?.template && (includeFlagged || !s.archive.wpTotalPages));

async function getText(url) {
  // One retry: a few hosts rate-limit bursts and a single miss would
  // otherwise look identical to "this page doesn't exist".
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': UA }, redirect: 'follow' });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      // retry once
    } finally {
      clearTimeout(t);
    }
  }
  return null;
}

function signature(xml) {
  // Signature of the FIRST ARTICLE only (its own <item>/<entry> block), so
  // feed-level metadata and rotating sidebars can't masquerade as new content.
  const block = /<(item|entry)[\s>][\s\S]*?<\/\1>/i.exec(xml)?.[0];
  if (!block) return null;
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(block)?.[1] ?? '';
  const link =
    /<link[^>]*href=["']([^"']+)["']/i.exec(block)?.[1] ?? /<link[^>]*>([\s\S]*?)<\/link>/i.exec(block)?.[1] ?? '';
  const sig = `${title}|${link}`.toLowerCase().replace(/\s+/g, ' ').trim();
  return sig || null;
}

function itemCount(xml) {
  return (xml.match(/<item[\s>]/g) || []).length + (xml.match(/<entry[\s>]/g) || []).length;
}

function pageUrl(source, n) {
  return source.archive.template.replace('{n}', String(n));
}

/**
 * A page "works" when its first article differs from a SIMULTANEOUSLY
 * fetched page 1 (live news feeds rotate between requests, so a cached
 * page-1 signature false-passes ignore-the-param sites) AND has never been
 * seen before (sites that clamp out-of-range pages to their last real page
 * would otherwise pass forever).
 */
function makePageTester(source) {
  const seen = new Set();
  return async (n) => {
    const [p1Xml, pNXml] = await Promise.all([getText(pageUrl(source, 1)), getText(pageUrl(source, n))]);
    if (!pNXml || itemCount(pNXml) === 0) return false;
    const sigN = signature(pNXml);
    if (!sigN) return false;
    if (p1Xml) {
      const sig1 = signature(p1Xml);
      if (sig1) seen.add(sig1);
    }
    if (seen.has(sigN)) return false;
    seen.add(sigN);
    return true;
  };
}

async function measureDepth(source) {
  let requests = 0;
  const works = makePageTester(source);

  const baseXml = await getText(pageUrl(source, 1));
  requests++;
  if (!baseXml || itemCount(baseXml) === 0) {
    return { depth: null, requests, note: 'page 1 unusable' };
  }

  // Gallop from page 2, doubling, while pages keep serving unseen articles.
  let lo = 1;
  let hi = null;
  let candidate = PROBE_START;
  while (hi === null && requests < MAX_REQUESTS_PER_SOURCE && candidate <= MAX_PAGE) {
    if (await works(candidate)) {
      lo = candidate;
      candidate *= 2;
    } else {
      hi = candidate;
    }
    requests++;
  }
  if (hi === null) {
    return { depth: lo, requests, note: 'budget exhausted at last working page' };
  }

  // Binary search between last working and first failing.
  while (hi - lo > 1 && requests < MAX_REQUESTS_PER_SOURCE) {
    const mid = Math.floor((lo + hi) / 2);
    if (mid <= lo || mid >= hi) break;
    if (await works(mid)) lo = mid;
    else hi = mid;
    requests++;
  }

  return {
    depth: lo > 1 ? lo : null,
    requests,
    note: lo > 1 ? 'converged' : 'no pagination beyond page 1',
  };
}

const results = [];
for (let i = 0; i < targets.length; i += CONCURRENCY) {
  const chunk = targets.slice(i, i + CONCURRENCY);
  const settled = await Promise.all(chunk.map(async (s) => ({ source: s, ...(await measureDepth(s)) })));
  results.push(...settled);
  process.stdout.write(`\r${Math.min(i + CONCURRENCY, targets.length)}/${targets.length}`);
}
console.log('');

let changed = 0;
for (const r of results) {
  const before = r.source.archive.maxPages ?? null;
  if (r.depth && r.depth !== before) {
    r.source.archive.maxPages = r.depth;
    changed++;
  } else if (!r.depth && r.note === 'no pagination beyond page 1') {
    // The convention doesn't actually work for this source; drop the entry.
    delete r.source.archive;
    changed++;
  }
  console.log(
    `${(r.source.id + ' ').padEnd(22)} ${String(before).padStart(6)} -> ${String(r.depth).padStart(6)}  (${r.requests} req, ${r.note})`,
  );
}

if (changed > 0) {
  catalog.updatedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n');
}
console.log(`\n${changed} maxPages updated in catalog.json`);
