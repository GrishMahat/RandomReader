export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(id);
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** High-entropy 128-bit hash of a string, hex-encoded. Eliminates collision risk
 *  for article URLs across large catalogs. */
export function hashString(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x5bd1e995;
  let h3 = 5381;
  let h4 = 52711;

  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
    h3 = Math.imul(h3, 33) ^ c;
    h4 = Math.imul(h4, 31) ^ c;
  }

  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const p3 = (h3 >>> 0).toString(16).padStart(8, '0');
  const p4 = (h4 >>> 0).toString(16).padStart(8, '0');
  return `${p1}${p2}${p3}${p4}`;
}

/** Extract the text of an HTML <title> tag, decoded and stripped of tags. */
export function extractPageTitle(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match) return null;
  const title = match[1]
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return title ? title.slice(0, 300) : null;
}

/** Extract a bare hostname (lowercased, www stripped) from any URL-ish string. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.toLowerCase().replace(/^www\./, '');
  }
}

/** Normalize user input (URL or bare domain) into a bare, lowercased hostname. */
export function normalizeDomain(input: string): string {
  let host = input.trim().toLowerCase();
  if (!host) return '';
  const schemeIdx = host.indexOf('://');
  if (schemeIdx !== -1) host = host.slice(schemeIdx + 3);
  host = host.split('/')[0].split('?')[0].split('#')[0];
  const portIdx = host.lastIndexOf(':');
  if (portIdx !== -1 && /^\d+$/.test(host.slice(portIdx + 1))) {
    host = host.slice(0, portIdx);
  }
  return host.replace(/^www\./, '');
}
