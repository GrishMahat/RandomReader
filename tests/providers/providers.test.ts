import { describe, expect, it } from 'vitest';
import type { Source } from '../../src/models';
import { parseAtom, parseFeed, parseRSS, parseSitemap } from '../../src/providers/index';

function source(overrides: Partial<Source> & { id: string; type: Source['type'] }): Source {
  return {
    name: 'Test Source',
    url: 'https://example.com/feed',
    enabled: true,
    tags: [],
    errorCount: 0,
    feeds: [],
    ...overrides,
  };
}

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example Feed</title>
    <item>
      <title>First story breaks today</title>
      <link>https://a.com/1</link>
      <guid>https://a.com/1</guid>
      <pubDate>Mon, 01 Sep 2026 10:00:00 GMT</pubDate>
      <dc:creator>Alice</dc:creator>
    </item>
    <item>
      <title>Second story follows up</title>
      <link>https://a.com/2</link>
      <pubDate>Tue, 02 Sep 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Homepage link is not an article</title>
      <link>https://a.com/</link>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Atom</title>
  <entry>
    <id>tag:example.com,2026:1</id>
    <title type="html">Atom story title here</title>
    <link rel="alternate" type="text/html" href="https://b.com/1"/>
    <published>2026-09-01T10:00:00Z</published>
    <author><name>Bob</name></author>
  </entry>
</feed>`;

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://c.com/about/news/one</loc></url>
  <url><loc>https://c.com/about/news/two</loc></url>
  <url><loc>https://c.com/archive/old</loc></url>
  <url><loc>https://c.com/</loc></url>
</urlset>`;

describe('parseRSS', () => {
  it('extracts url, title, author, and dates while dropping homepage links', () => {
    const articles = parseRSS(source({ id: 't', type: 'rss' }), RSS);
    expect(articles).toHaveLength(2);
    expect(articles[0]).toMatchObject({
      sourceId: 't',
      title: 'First story breaks today',
      url: 'https://a.com/1',
      author: 'Alice',
      publishedAt: Date.parse('Mon, 01 Sep 2026 10:00:00 GMT'),
      read: false,
      starred: false,
    });
    expect(articles[0].id.startsWith('t:')).toBe(true);
    expect(articles[1].author).toBeUndefined();
  });

  it('falls back to guid for the url and skips the first homepage link', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item><title>Guid story</title><guid>https://a.com/guid-1</guid></item>
      <item><title>Multi link story</title><link>https://a.com/</link><link>https://a.com/real</link></item>
    </channel></rss>`;
    const articles = parseRSS(source({ id: 't', type: 'rss' }), xml);
    expect(articles.map((a) => a.url)).toEqual(['https://a.com/guid-1', 'https://a.com/real']);
  });

  it('falls back to fetch time for unparseable dates', () => {
    const before = Date.now();
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item><title>Dateless story</title><link>https://a.com/x</link><pubDate>not a date</pubDate></item>
    </channel></rss>`;
    const articles = parseRSS(source({ id: 't', type: 'rss' }), xml);
    expect(articles).toHaveLength(1);
    expect(articles[0].publishedAt ?? 0).toBeGreaterThanOrEqual(before);
    expect(articles[0].publishedAt ?? 0).toBeLessThanOrEqual(Date.now());
  });

  it('reads attributed link nodes and untitled items', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item><title>Attr link story</title><link foo="bar">https://a.com/both</link></item>
      <item><title type="x"/><link href="https://a.com/attr"/><guid>https://a.com/g</guid></item>
      <item><title>Nowhere story</title><link>https://a.com/</link><link>https://a.com/</link></item>
    </channel></rss>`;
    const articles = parseRSS(source({ id: 't', type: 'rss' }), xml);
    expect(articles.map((a) => [a.title, a.url])).toEqual([
      ['Attr link story', 'https://a.com/both'],
      ['Untitled', 'https://a.com/attr'],
    ]);
  });

  it('tolerates unparseable urls against include filters', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item><title>Bad link story</title><link>:::not a url:::</link></item>
    </channel></rss>`;
    const filtered = parseRSS(source({ id: 't', type: 'rss', include: ['/news/'] }), xml);
    expect(filtered).toEqual([]);
    const unfiltered = parseRSS(source({ id: 't', type: 'rss' }), xml);
    expect(unfiltered.map((a) => a.url)).toEqual([':::not a url:::']);
  });

  it('drops linkless items and honors the root include pattern', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item><title>No link story</title></item>
      <item><title>Root pattern story</title><link>https://a.com/news/x</link></item>
    </channel></rss>`;
    // '/' only ever matches the homepage, which is dropped first anyway.
    expect(parseRSS(source({ id: 't', type: 'rss', include: ['/'] }), xml)).toEqual([]);
    expect(parseRSS(source({ id: 't', type: 'rss' }), xml)).toHaveLength(1);
  });

  it('takes the first usable link from multi-link items', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item><title>Two link story</title><link>https://a.com/10</link><link>https://a.com/11</link></item>
    </channel></rss>`;
    const articles = parseRSS(source({ id: 't', type: 'rss' }), xml);
    expect(articles.map((a) => a.url)).toEqual(['https://a.com/10']);
  });
});

describe('parseAtom', () => {
  it('unwraps typed titles and reads alternate links', () => {
    const articles = parseAtom(source({ id: 't', type: 'atom' }), ATOM);
    expect(articles).toHaveLength(1);
    expect(articles[0]).toMatchObject({
      sourceId: 't',
      title: 'Atom story title here',
      url: 'https://b.com/1',
      author: 'Bob',
      publishedAt: Date.parse('2026-09-01T10:00:00Z'),
    });
  });

  it('handles entries without author, dates, ids, or links', () => {
    const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
      <entry><title>Bare story</title><link rel="alternate" type="text/html" href="https://b.com/9"/></entry>
      <entry><title>Linkless story</title></entry>
    </feed>`;
    const articles = parseAtom(source({ id: 't', type: 'atom' }), xml);
    expect(articles).toHaveLength(1);
    expect(articles[0]).toMatchObject({
      title: 'Bare story',
      url: 'https://b.com/9',
      author: undefined,
      publishedAt: undefined,
    });
    expect(articles[0].id.startsWith('t:')).toBe(true);
  });
});

describe('parseFeed', () => {
  it('dispatches on the declared type', () => {
    expect(parseFeed(source({ id: 't', type: 'rss' }), RSS)).toHaveLength(2);
    expect(parseFeed(source({ id: 't', type: 'atom' }), ATOM)).toHaveLength(1);
  });

  it('falls back across formats when the declared type yields nothing', () => {
    expect(parseFeed(source({ id: 't', type: 'rss' }), ATOM)).toHaveLength(1);
    expect(parseFeed(source({ id: 't', type: 'atom' }), RSS)).toHaveLength(2);
  });

  it('returns [] instead of throwing on non-feed input', () => {
    expect(parseFeed(source({ id: 't', type: 'rss' }), '<html><body>not a feed</body></html>')).toEqual([]);
  });

  it('parses unknown source types via the fallback', () => {
    // No declared parser matches, so every parser is tried; the RSS one hits.
    expect(parseFeed(source({ id: 't', type: 'bogus' as Source['type'] }), RSS)).toHaveLength(2);
  });
});

describe('parseSitemap', () => {
  it('lists page urls with placeholder titles, minus the homepage', () => {
    const articles = parseSitemap(source({ id: 't', type: 'sitemap' }), SITEMAP);
    expect(articles.map((a) => a.url).sort()).toEqual([
      'https://c.com/about/news/one',
      'https://c.com/about/news/two',
      'https://c.com/archive/old',
    ]);
    expect(articles[0].title).toBe('Sitemap Entry');
  });

  it('applies include and exclude path filters', () => {
    const included = parseSitemap(source({ id: 't', type: 'sitemap', include: ['/about/news/'] }), SITEMAP);
    expect(included).toHaveLength(2);
    const excluded = parseSitemap(source({ id: 't', type: 'sitemap', exclude: ['/archive/'] }), SITEMAP);
    expect(excluded.map((a) => a.url).sort()).toEqual(['https://c.com/about/news/one', 'https://c.com/about/news/two']);
  });

  it('reads sitemap indexes and caps oversized sitemaps', () => {
    const index = `<?xml version="1.0"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://d.com/s1.xml</loc></sitemap>
        <sitemap><loc>https://d.com/s2.xml</loc></sitemap>
      </sitemapindex>`;
    const articles = parseSitemap(source({ id: 't', type: 'sitemap' }), index);
    expect(articles.map((a) => a.url).sort()).toEqual(['https://d.com/s1.xml', 'https://d.com/s2.xml']);

    const big = `<?xml version="1.0"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${[1, 2, 3, 4, 5].map((n) => `<url><loc>https://e.com/p${n}</loc></url>`).join('')}
      </urlset>`;
    expect(parseSitemap(source({ id: 't', type: 'sitemap', maxUrls: 2 }), big)).toHaveLength(2);
  });
});
