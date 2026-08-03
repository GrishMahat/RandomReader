import type { Settings } from '../models';

export type ResolvedTheme = 'light' | 'dark';

const media = window.matchMedia('(prefers-color-scheme: dark)');

export function resolveTheme(theme: Settings['theme']): ResolvedTheme {
  if (theme === 'system') return media.matches ? 'dark' : 'light';
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
  const handler = (): void => {
    if (getTheme() === 'system') applyTheme(host, 'system');
  };
  media.addEventListener('change', handler);
  return () => media.removeEventListener('change', handler);
}
