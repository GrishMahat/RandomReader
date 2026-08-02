import { XMLParser } from 'fast-xml-parser';
import type { Article, Source } from '../models';

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
  return `${sourceId}:${btoa(url).slice(0, 32)}`;
}

function extractContent(item: XmlObject): string | undefined {
  const content = item['content:encoded'] || item.content || item.description || item.summary;
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object' && '#text' in content) {
    return (content as XmlObject)['#text'] as string;
  }
  return undefined;
}

function matchesPatterns(url: string, patterns: string[]): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    return patterns.some((pattern) => pathname.startsWith(pattern));
  } catch {
    return false;
  }
}

function filterSitemapUrls(urls: string[], source: Source): string[] {
  if (!source.include?.length && !source.exclude?.length) {
    return urls;
  }
  return urls.filter((url) => {
    if (source.include?.length && !matchesPatterns(url, source.include)) {
      return false;
    }
    if (source.exclude?.length && matchesPatterns(url, source.exclude)) {
      return false;
    }
    return true;
  });
}

function getAttr(obj: XmlObject | undefined, key: string): string | undefined {
  if (!obj) return undefined;
  return obj[key] as string | undefined;
}

function getXmlObjectValue(obj: XmlObject, key: string): unknown {
  return obj[key];
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
    .map((item) => ({
      id: generateId(source.id, String(getXmlObjectValue(item, 'link') || getXmlObjectValue(item, 'guid') || '')),
      sourceId: source.id,
      title: String(getXmlObjectValue(item, 'title') || 'Untitled'),
      url: String(getXmlObjectValue(item, 'link') || getXmlObjectValue(item, 'guid') || ''),
      content: extractContent(item),
      summary: getXmlObjectValue(item, 'description') ? String(getXmlObjectValue(item, 'description')) : undefined,
      author: getXmlObjectValue(item, 'author') ? String(getXmlObjectValue(item, 'author')) : getXmlObjectValue(item, 'dc:creator') ? String(getXmlObjectValue(item, 'dc:creator')) : undefined,
      publishedAt: getXmlObjectValue(item, 'pubDate') ? parseDate(String(getXmlObjectValue(item, 'pubDate'))) : getXmlObjectValue(item, 'dc:date') ? parseDate(String(getXmlObjectValue(item, 'dc:date'))) : undefined,
      fetchedAt: Date.now(),
      read: false,
      starred: false,
    }));
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
      const link = getXmlObjectValue(entry, 'link');
      const linkObj = Array.isArray(link) ? link[0] : link;
      const url = getAttr(linkObj as XmlObject | undefined, '@_href');

      return {
        id: generateId(source.id, String(getXmlObjectValue(entry, 'id') || url || '')),
        sourceId: source.id,
        title: String(getXmlObjectValue(entry, 'title') || 'Untitled'),
        url: String(url || ''),
        content: getXmlObjectValue(entry, 'content') ? (typeof getXmlObjectValue(entry, 'content') === 'string' ? getXmlObjectValue(entry, 'content') as string : String(getAttr(getXmlObjectValue(entry, 'content') as XmlObject | undefined, '#text') || '')) : undefined,
        summary: getXmlObjectValue(entry, 'summary') ? (typeof getXmlObjectValue(entry, 'summary') === 'string' ? getXmlObjectValue(entry, 'summary') as string : String(getAttr(getXmlObjectValue(entry, 'summary') as XmlObject | undefined, '#text') || '')) : undefined,
        author: getAttr(getXmlObjectValue(entry, 'author') as XmlObject | undefined, 'name'),
        publishedAt: getXmlObjectValue(entry, 'published') ? parseDate(String(getXmlObjectValue(entry, 'published'))) : getXmlObjectValue(entry, 'updated') ? parseDate(String(getXmlObjectValue(entry, 'updated'))) : undefined,
        fetchedAt: Date.now(),
        read: false,
        starred: false,
      };
    });
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

  const filteredUrls = filterSitemapUrls(rawUrls, source);

  return filteredUrls.map((url) => ({
    id: generateId(source.id, url),
    sourceId: source.id,
    title: 'Sitemap Entry',
    url,
    content: undefined,
    summary: undefined,
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