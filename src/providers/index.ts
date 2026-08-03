import { XMLParser } from 'fast-xml-parser';
import type { Article, Source } from '../models';
import { hashString } from '../utils';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  trimValues: true,
});

type XmlObject = Record<string, unknown>;

function parseDate(dateStr: string): number {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? Date.now() : date.getTime();
}

function generateId(sourceId: string, url: string): string {
  return `${sourceId}:${hashString(url)}`;
}

function matchesPatterns(url: string, patterns: string[]): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    return patterns.some((pattern) => {
      if (pattern === '/') return pathname === '/' || pathname === '';
      return pathname.startsWith(pattern);
    });
  } catch {
    return false;
  }
}

function isHomepage(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return pathname === '/' || pathname === '';
  } catch {
    return false;
  }
}

function isUrlAllowed(url: string, source: Source): boolean {
  if (!url) return false;
  if (isHomepage(url)) return false;
  if (source.include?.length && !matchesPatterns(url, source.include)) {
    return false;
  }
  if (source.exclude?.length && matchesPatterns(url, source.exclude)) {
    return false;
  }
  return true;
}

function getAttr(obj: XmlObject | undefined, key: string): string | undefined {
  if (!obj) return undefined;
  return obj[key] as string | undefined;
}

function getXmlObjectValue(obj: XmlObject, key: string): unknown {
  return obj[key];
}

function getNodeUrl(node: unknown): string {
  if (typeof node === 'string') return node;
  if (node && typeof node === 'object') {
    const obj = node as XmlObject;
    const text = obj['#text'];
    if (typeof text === 'string') return text;
    const href = obj['@_href'];
    if (typeof href === 'string') return href;
  }
  return '';
}

function selectRssUrl(item: XmlObject): string {
  const link = getXmlObjectValue(item, 'link');
  if (Array.isArray(link)) {
    const first = getNodeUrl(link[0]);
    if (first && !isHomepage(first)) return first;
    for (const l of link) {
      const url = getNodeUrl(l);
      if (url && !isHomepage(url)) return url;
    }
    return first;
  }
  return getNodeUrl(link) || getNodeUrl(getXmlObjectValue(item, 'guid'));
}

export function parseRSS(source: Source, xml: string): Article[] {
  const result = parser.parse(xml);
  const rss = getXmlObjectValue(result, 'rss') as XmlObject | undefined;
  const channel = rss ? getXmlObjectValue(rss, 'channel') as XmlObject | undefined : undefined;
  const items = channel ? getXmlObjectValue(channel, 'item') : undefined;
  if (!items) return [];

  const itemArray = Array.isArray(items) ? items : [items];
  return itemArray
    .filter((item): item is XmlObject => item !== null && typeof item === 'object')
    .map((item) => {
      const url = selectRssUrl(item);
      return {
        id: generateId(source.id, url),
        sourceId: source.id,
        title: String(getXmlObjectValue(item, 'title') || 'Untitled'),
        url,
        author: getXmlObjectValue(item, 'author') ? String(getXmlObjectValue(item, 'author')) : getXmlObjectValue(item, 'dc:creator') ? String(getXmlObjectValue(item, 'dc:creator')) : undefined,
        publishedAt: getXmlObjectValue(item, 'pubDate') ? parseDate(String(getXmlObjectValue(item, 'pubDate'))) : getXmlObjectValue(item, 'dc:date') ? parseDate(String(getXmlObjectValue(item, 'dc:date'))) : undefined,
        fetchedAt: Date.now(),
        read: false,
        starred: false,
      };
    })
    .filter((article) => isUrlAllowed(article.url, source));
}

function selectAtomUrl(entry: XmlObject): string {
  const link = getXmlObjectValue(entry, 'link');
  const links = Array.isArray(link) ? link as XmlObject[] : link ? [link as XmlObject] : [];
  if (links.length === 0) return '';

  const alternate = links.find((l) => {
    const rel = String(getAttr(l, '@_rel') || 'alternate');
    const type = String(getAttr(l, '@_type') || '');
    return rel === 'alternate' && (!type || type.includes('html'));
  });
  const fallback = links.find((l) => {
    const rel = String(getAttr(l, '@_rel') || 'alternate');
    return rel === 'alternate';
  });
  const chosen = alternate || fallback || links[0];
  return String(getAttr(chosen, '@_href') || '');
}

export function parseAtom(source: Source, xml: string): Article[] {
  const result = parser.parse(xml);
  const feed = getXmlObjectValue(result, 'feed') as XmlObject | undefined;
  const entries = feed ? getXmlObjectValue(feed, 'entry') : undefined;
  if (!entries) return [];

  const entryArray = Array.isArray(entries) ? entries : [entries];
  return entryArray
    .filter((entry): entry is XmlObject => entry !== null && typeof entry === 'object')
    .map((entry) => {
      const url = selectAtomUrl(entry);

      return {
        id: generateId(source.id, String(getXmlObjectValue(entry, 'id') || url || '')),
        sourceId: source.id,
        title: String(getXmlObjectValue(entry, 'title') || 'Untitled'),
        url,
        author: getAttr(getXmlObjectValue(entry, 'author') as XmlObject | undefined, 'name'),
        publishedAt: getXmlObjectValue(entry, 'published') ? parseDate(String(getXmlObjectValue(entry, 'published'))) : getXmlObjectValue(entry, 'updated') ? parseDate(String(getXmlObjectValue(entry, 'updated'))) : undefined,
        fetchedAt: Date.now(),
        read: false,
        starred: false,
      };
    })
    .filter((article) => isUrlAllowed(article.url, source));
}

export function parseSitemap(source: Source, xml: string): Article[] {
  const result = parser.parse(xml);
  const urls = getXmlObjectValue(getXmlObjectValue(result, 'urlset') as XmlObject, 'url') || getXmlObjectValue(getXmlObjectValue(result, 'sitemapindex') as XmlObject, 'sitemap');
  if (!urls) return [];

  const urlArray = Array.isArray(urls) ? urls : [urls];
  const rawUrls = urlArray
    .filter((url): url is XmlObject => url !== null && typeof url === 'object')
    .map((url) => String(getXmlObjectValue(url, 'loc') || getXmlObjectValue(url, '@_href') || ''))
    .filter(Boolean);

  const filteredUrls = rawUrls.filter((url) => isUrlAllowed(url, source));
  const maxUrls = source.maxUrls ?? 2000;
  const cappedUrls = filteredUrls.slice(0, maxUrls);

  return cappedUrls.map((url) => ({
    id: generateId(source.id, url),
    sourceId: source.id,
    title: 'Sitemap Entry',
    url,
    author: undefined,
    publishedAt: undefined,
    fetchedAt: Date.now(),
    read: false,
    starred: false,
  }));
}

export function parseFeed(source: Source, xml: string): Article[] {
  switch (source.type) {
    case 'rss':
      return parseRSS(source, xml);
    case 'atom':
      return parseAtom(source, xml);
    case 'sitemap':
      return parseSitemap(source, xml);
    default:
      return [];
  }
}