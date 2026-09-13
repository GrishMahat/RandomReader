import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DAY_MS,
  extractPageTitle,
  fetchWithTimeout,
  getErrorMessage,
  hashString,
  hostnameOf,
  isSnoozed,
  normalizeDomain,
} from '../../src/utils/index';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Stub global fetch with a handler; returns captured abort signals. */
function stubFetch(handler: (url: string, init?: RequestInit) => Promise<Response>): AbortSignal[] {
  const signals: AbortSignal[] = [];
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    if (init?.signal instanceof AbortSignal) signals.push(init.signal);
    return handler(String(input), init);
  });
  return signals;
}

describe('DAY_MS', () => {
  it('is one day in milliseconds', () => {
    expect(DAY_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe('getErrorMessage', () => {
  it('unwraps Errors, passes strings, and falls back otherwise', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage('plain')).toBe('plain');
    expect(getErrorMessage(42)).toBe('Unknown error');
    expect(getErrorMessage(null)).toBe('Unknown error');
  });
});

describe('hashString', () => {
  it('is a stable 32-char hex digest that distinguishes inputs', () => {
    const a = hashString('https://example.com/a');
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(hashString('https://example.com/a')).toBe(a);
    expect(hashString('https://example.com/b')).not.toBe(a);
    expect(hashString('')).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('hostnameOf', () => {
  it('lowercases and strips www from valid URLs', () => {
    expect(hostnameOf('https://WWW.Example.COM/path?q=1')).toBe('example.com');
  });

  it('falls back to the normalized input for garbage', () => {
    expect(hostnameOf('not a url')).toBe('not a url');
    expect(hostnameOf('WWW.Foo')).toBe('foo');
  });
});

describe('normalizeDomain', () => {
  it('reduces URLs and bare domains to bare hostnames', () => {
    expect(normalizeDomain('https://WWW.Example.com:8080/a/b?x=1#f')).toBe('example.com');
    expect(normalizeDomain('example.com')).toBe('example.com');
    expect(normalizeDomain('HTTP://Foo.COM/')).toBe('foo.com');
    expect(normalizeDomain('  sub.example.com  ')).toBe('sub.example.com');
  });

  it('returns empty for empty input', () => {
    expect(normalizeDomain('')).toBe('');
    expect(normalizeDomain('   ')).toBe('');
  });
});

describe('isSnoozed', () => {
  it('is true only for a future timestamp', () => {
    expect(isSnoozed({})).toBe(false);
    expect(isSnoozed({ snoozedUntil: Date.now() + 10_000 })).toBe(true);
    expect(isSnoozed({ snoozedUntil: Date.now() - 10_000 })).toBe(false);
    expect(isSnoozed({ snoozedUntil: 'soon' as unknown as number })).toBe(false);
  });
});

describe('extractPageTitle', () => {
  it('extracts and cleans titles', () => {
    expect(extractPageTitle('<html><head><title>Hello World</title></head></html>')).toBe('Hello World');
    expect(extractPageTitle('<title>A <b>Bold</b> Title</title>')).toBe('A Bold Title');
    expect(extractPageTitle('<TITLE>Case Insensitive</TITLE>')).toBe('Case Insensitive');
  });

  it('decodes common entities and collapses whitespace', () => {
    expect(extractPageTitle('<title>Fish &amp; Chips &lt;3 &quot;Yum&quot;</title>')).toBe('Fish & Chips <3 "Yum"');
    expect(extractPageTitle('<title>  Lots\n   of   space </title>')).toBe('Lots of space');
  });

  it('returns null when there is no usable title', () => {
    expect(extractPageTitle('<html><body>no title here</body></html>')).toBeNull();
    expect(extractPageTitle('<title>   </title>')).toBeNull();
  });

  it('truncates runaway titles at 300 characters', () => {
    const title = extractPageTitle(`<title>${'x'.repeat(400)}</title>`);
    expect(title?.length).toBe(300);
  });
});

describe('fetchWithTimeout', () => {
  it('passes url and an abort signal through to fetch', async () => {
    const seen: string[] = [];
    const signals = stubFetch(async (url) => {
      seen.push(url);
      return new Response('hi');
    });
    const response = await fetchWithTimeout('https://example.com/feed', { timeout: 1000 });
    expect(await response.text()).toBe('hi');
    expect(seen).toEqual(['https://example.com/feed']);
    expect(signals).toHaveLength(1);
  });

  it('aborts past the timeout', async () => {
    // Faithful stub: like the real fetch, it rejects when the signal aborts.
    const signals = stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    await expect(fetchWithTimeout('https://example.com/slow', { timeout: 20 })).rejects.toThrow();
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(true);
  });
});
