import { describe, expect, it } from 'vitest';
import { canonicalizeUrl, deduplicateArticles, normalizeTitle } from '../../src/background/dedup';
import type { Article } from '../../src/models';

function article(overrides: Partial<Article> & { id: string; url: string; title: string }): Article {
  return { sourceId: 'test', fetchedAt: 0, read: false, starred: false, ...overrides };
}

describe('canonicalizeUrl', () => {
  it('strips tracking params, case, www, and trailing slashes', () => {
    expect(canonicalizeUrl('https://WWW.Example.COM/Tech/Foo/?utm_source=rss&utm_medium=x&b=2')).toBe(
      'example.com/tech/foo?b=2',
    );
  });

  it('merges http/https, fragments, and query order', () => {
    const a = canonicalizeUrl('http://example.com/a#section');
    const b = canonicalizeUrl('https://example.com/a/');
    expect(a).toBe(b);
    expect(canonicalizeUrl('https://example.com/a?b=2&c=3')).toBe(canonicalizeUrl('https://example.com/a?c=3&b=2'));
  });

  it('keeps meaningful query params but drops click ids', () => {
    expect(canonicalizeUrl('https://example.com/a?page=2')).not.toBe(canonicalizeUrl('https://example.com/a?page=3'));
    expect(canonicalizeUrl('https://example.com/a?fbclid=xx&gclid=yy&msclkid=zz')).toBe('example.com/a');
  });

  it('merges AMP variants but keeps real output params', () => {
    expect(canonicalizeUrl('https://example.com/foo/amp')).toBe('example.com/foo');
    expect(canonicalizeUrl('https://example.com/foo?output=1')).toBe('example.com/foo');
    expect(canonicalizeUrl('https://example.com/foo?output=2')).toBe('example.com/foo?output=2');
  });

  it('merges mobile subdomains and preserves query value case', () => {
    expect(canonicalizeUrl('https://m.example.com/a')).toBe('example.com/a');
    expect(canonicalizeUrl('https://mobile.example.com/a')).toBe('example.com/a');
    expect(canonicalizeUrl('https://example.com/a?token=AbC')).toBe('example.com/a?token=AbC');
  });

  it('drops default ports but keeps non-default ones', () => {
    expect(canonicalizeUrl('http://example.com:80/a')).toBe('example.com/a');
    expect(canonicalizeUrl('https://example.com:443/a')).toBe('example.com/a');
    expect(canonicalizeUrl('http://example.com:8080/a')).toBe('example.com:8080/a');
    expect(canonicalizeUrl('http://example.com:8080/a')).not.toBe(canonicalizeUrl('http://example.com/a'));
  });

  it('handles AMP variants case-insensitively but keeps real params', () => {
    expect(canonicalizeUrl('https://example.com/foo/amp/')).toBe('example.com/foo');
    expect(canonicalizeUrl('https://example.com/amp')).toBe('example.com/');
    expect(canonicalizeUrl('https://example.com/foo?AMP=1')).toBe('example.com/foo');
    expect(canonicalizeUrl('https://example.com/foo?platform=amp')).toBe('example.com/foo');
    expect(canonicalizeUrl('https://example.com/foo?platform=web')).toBe('example.com/foo?platform=web');
    expect(canonicalizeUrl('https://example.com/foo?output=')).toBe('example.com/foo');
  });

  it('never throws on unparseable input', () => {
    expect(canonicalizeUrl('not a url')).toBe('not a url');
  });
});

describe('normalizeTitle', () => {
  it('folds case, diacritics, and punctuation', () => {
    expect(normalizeTitle('Café Review: The Best Espresso Machines!')).toBe('cafe review the best espresso machines');
  });
});

describe('deduplicateArticles', () => {
  it('passes empty input through and preserves first-occurrence order', () => {
    expect(deduplicateArticles([])).toEqual([]);
    // Same bucket, 5/7 overlap each pair: similar enough to compare, too
    // different to merge — order must survive untouched.
    const words = ['alpha', 'bravo', 'gamma'];
    const ids = ['c', 'a', 'b'].map((id, i) =>
      article({ id, url: `https://example.com/${id}`, title: `A distinct story headline number ${words[i]} here` }),
    );
    expect(deduplicateArticles(ids).map((a) => a.id)).toEqual(['c', 'a', 'b']);
  });
  it('merges URL variants and keeps the first occurrence with its flags', () => {
    const first = article({
      id: 'x:1',
      url: 'https://example.com/foo?utm_source=rss',
      title: 'First article about something notable here',
      starred: true,
    });
    const dup = article({
      id: 'x:2',
      url: 'http://www.example.com/foo/',
      title: 'Second completely different story headline',
    });
    const result = deduplicateArticles([first, dup]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('x:1');
    expect(result[0].starred).toBe(true);
  });

  it('merges by id even when URLs differ', () => {
    const result = deduplicateArticles([
      article({ id: 'same', url: 'https://a.com/1', title: 'An interesting technology development today' }),
      article({ id: 'same', url: 'https://b.com/2', title: 'A totally unrelated cultural event recap' }),
    ]);
    expect(result).toHaveLength(1);
  });

  it('merges cross-outlet syndication with identical titles', () => {
    const title = 'Senate passes sweeping infrastructure bill late Tuesday';
    const result = deduplicateArticles([
      article({ id: 'ap:1', url: 'https://apnews.com/x', title }),
      article({ id: 'npr:9', url: 'https://npr.org/y', title }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ap:1');
  });

  it('never matches placeholder or short generic titles', () => {
    const placeholders = deduplicateArticles([
      article({ id: 's:1', url: 'https://a.com/1', title: 'Sitemap Entry' }),
      article({ id: 's:2', url: 'https://a.com/2', title: 'SITEMAP ENTRY' }),
    ]);
    expect(placeholders).toHaveLength(2);
    const shorts = deduplicateArticles([
      article({ id: 'g:1', url: 'https://a.com/3', title: 'Update' }),
      article({ id: 'g:2', url: 'https://b.com/4', title: 'Update' }),
    ]);
    expect(shorts).toHaveLength(2);
  });

  it('splits exact title matching at the 16-character floor', () => {
    const atFloor = deduplicateArticles([
      article({ id: 'e:1', url: 'https://a.com/5', title: 'Abcdefghijklmnop' }),
      article({ id: 'e:2', url: 'https://b.com/6', title: 'Abcdefghijklmnop' }),
    ]);
    expect(atFloor).toHaveLength(1);
    const belowFloor = deduplicateArticles([
      article({ id: 'e:3', url: 'https://a.com/7', title: 'Abcdefghijklmno' }),
      article({ id: 'e:4', url: 'https://b.com/8', title: 'Abcdefghijklmno' }),
    ]);
    expect(belowFloor).toHaveLength(2);
  });

  it('skips fuzzy matching for titles under 32 characters', () => {
    // 6/7 overlap (0.857) would merge without the length guard; at 31
    // characters the candidate stays.
    const result = deduplicateArticles([
      article({ id: 'k:1', url: 'https://a.com/9', title: 'Review Pixel 10 Pro camera system test' }),
      article({ id: 'k:2', url: 'https://b.com/10', title: 'Review Pixel 10 Pro camera test' }),
    ]);
    expect(result.map((a) => a.id)).toEqual(['k:1', 'k:2']);
  });

  it('does not merge transitively through dropped articles', () => {
    // C matches dropped B (9/10) but not kept A (8/10): buckets only hold
    // survivors, so C stays. No drift chains.
    const result = deduplicateArticles([
      article({ id: 't:A', url: 'https://a.com/11', title: 'Full review of the Pixel 10 Pro camera system test' }),
      article({
        id: 't:B',
        url: 'https://b.com/12',
        title: 'Full review of the Pixel 10 Pro camera system test results',
      }),
      article({
        id: 't:C',
        url: 'https://c.com/13',
        title: 'Full review of the Pixel 10 Pro Max camera system test results',
      }),
    ]);
    expect(result.map((a) => a.id)).toEqual(['t:A', 't:C']);
  });

  it('keeps a large same-bucket pileup intact without blowing up', () => {
    // 300 headlines sharing leading tokens, each pair at 5/7 overlap:
    // all survive, and the bounded bucket scan keeps this linear.
    const articles = Array.from({ length: 300 }, (_, i) =>
      article({
        id: `p:${i}`,
        url: `https://example.com/pile/${i}`,
        title: `Bulk pileup story alpha${i} gamma here`,
      }),
    );
    const result = deduplicateArticles(articles);
    expect(result).toHaveLength(300);
  });

  it('skips fuzzy matching for titles with fewer than three tokens', () => {
    const a = 'Supercalifragilisticexpialidocious pneumonoultramicroscopicsilicovolcanoconiosis';
    const b = 'Supercalifragilisticexpialidocious antidisestablishmentarianism floccinaucinihilipilification';
    const result = deduplicateArticles([
      article({ id: 'q:1', url: 'https://a.com/20', title: a }),
      article({ id: 'q:2', url: 'https://b.com/21', title: b }),
    ]);
    expect(result).toHaveLength(2);
  });

  it('fuzzy-merges near-identical long headlines', () => {
    const result = deduplicateArticles([
      article({ id: 'c:1', url: 'https://a.com/5', title: 'Full review of the Pixel 10 Pro camera system test' }),
      article({
        id: 'c:2',
        url: 'https://b.com/6',
        title: 'Full review of the Pixel 10 Pro camera system test results',
      }),
    ]);
    expect(result).toHaveLength(1);
  });

  it('keeps sibling headlines apart below the overlap threshold', () => {
    const result = deduplicateArticles([
      article({ id: 'p:1', url: 'https://a.com/7', title: 'Full review of the Pixel 10 Pro camera system test' }),
      article({
        id: 'p:2',
        url: 'https://b.com/8',
        title: 'Full review of the Pixel 10 Pro Max camera system test results',
      }),
    ]);
    expect(result).toHaveLength(2);
  });
});
