import type { Settings } from '../models';

export type ResolvedTheme = 'light' | 'dark';

/** Lazy accessor so this module is safe to import in non-window contexts (e.g. tests, service worker). */
function getMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined') return null;
  return window.matchMedia('(prefers-color-scheme: dark)');
}

export function resolveTheme(theme: Settings['theme']): ResolvedTheme {
  if (theme === 'system') return getMediaQuery()?.matches ? 'dark' : 'light';
  return theme;
}

/** Set the resolved theme on a host element via `data-theme`, driving the stylesheets. */
export function applyTheme(host: HTMLElement, theme: Settings['theme']): void {
  host.setAttribute('data-theme', resolveTheme(theme));
}

/**
 * Keep a host's `data-theme` in sync when the OS color scheme changes while
 * the user's setting is `system`. Returns a cleanup function.
 */
export function subscribeToSystemTheme(host: HTMLElement, getTheme: () => Settings['theme']): () => void {
  const media = getMediaQuery();
  if (!media) return () => undefined;
  const handler = (): void => {
    if (getTheme() === 'system') applyTheme(host, 'system');
  };
  media.addEventListener('change', handler);
  return () => media.removeEventListener('change', handler);
}
