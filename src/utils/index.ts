export async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
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

/** Deterministic 64-bit-ish hash of a string, hex-encoded. Unique enough to
 *  identify articles by full URL without storing the URL in the id. */
export function hashString(input: string): string {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = (h1 * 33) ^ c;
    h2 = (h2 * 31) ^ c;
  }
  const hi = (h1 >>> 0).toString(16).padStart(8, '0');
  const lo = (h2 >>> 0).toString(16).padStart(8, '0');
  return hi + lo;
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