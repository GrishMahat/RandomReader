import type { Settings } from '../models';

/**
 * Shared settings vocabulary for both UI surfaces (popup + options).
 * Option tables, predicates, and formatting live here exactly once so the
 * surfaces can't drift apart.
 */

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
}

/** Max article age choices, shared by popup and options so the menus cannot drift. */
export const MAX_AGE_CHOICES: readonly SelectOption<number>[] = [
  { value: 0, label: 'All time' },
  { value: 1, label: 'Past 24 hours' },
  { value: 3, label: 'Past 3 days' },
  { value: 7, label: 'Past 7 days' },
  { value: 14, label: 'Past 2 weeks' },
  { value: 30, label: 'Past 30 days' },
  { value: 90, label: 'Past 3 months' },
];

export const OPEN_TARGETS: readonly SelectOption<Settings['openIn']>[] = [
  { value: 'new_tab', label: 'New Tab' },
  { value: 'current_tab', label: 'Current Tab' },
];

export const SELECTION_MODES: readonly SelectOption<Settings['selectionMode']>[] = [
  { value: 'unread_only', label: 'Unread Only' },
  { value: 'all', label: 'All Articles' },
  { value: 'starred_only', label: 'Starred Only' },
];

/** Snooze durations offered in the UI (days). */
export const SNOOZE_DAYS: readonly SelectOption<number>[] = [
  { value: 1, label: '1 day' },
  { value: 7, label: '1 week' },
  { value: 30, label: '1 month' },
];

/** Compact date used across history rows, snooze badges, and catalog info. */
export function formatTimestamp(ts?: number, { year = false }: { year?: boolean } = {}): string {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(year ? { year: 'numeric' as const } : {}),
  });
}

/**
 * Emit a `setting-change` CustomEvent from a section element toward its
 * parent. One definition instead of a copy in every component.
 */
export function emitSettingChange<K extends keyof Settings>(el: EventTarget, key: K, value: Settings[K]): void {
  el.dispatchEvent(
    new CustomEvent('setting-change', {
      detail: { key, value },
      bubbles: true,
      composed: true,
    }),
  );
}
