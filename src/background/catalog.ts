import BUNDLED_CATALOG from '../../catalog.json';
import type { Catalog, Settings, Source } from '../models';
import { CatalogSchema, DEFAULT_SETTINGS, SettingsSchema, STORAGE_KEYS } from '../models';
import { fetchWithTimeout, getErrorMessage, isSnoozed } from '../utils';
import { loadStore, saveStore, saveStoreMany } from './store';

/** Remote (URL-fetched) catalog stored for the "remote" mode. */
export async function getStoredCatalog(): Promise<Catalog | null> {
  return loadStore(STORAGE_KEYS.CATALOG, CatalogSchema, null);
}

/** Catalog imported from a local file, used in "local" mode. */
export async function getLocalCatalog(): Promise<Catalog | null> {
  return loadStore(STORAGE_KEYS.LOCAL_CATALOG, CatalogSchema, null);
}

/**
 * The catalog that is currently active for the user: the imported local
 * catalog in "local" mode (falling back to the remote one if none was
 * imported yet), otherwise the remote catalog.
 */
export async function getCatalog(): Promise<Catalog | null> {
  const settings = await getSettings();
  if (settings.catalogMode === 'local') {
    return (await getLocalCatalog()) ?? (await getStoredCatalog());
  }
  return getStoredCatalog();
}

export async function setCatalog(catalog: Catalog): Promise<void> {
  await saveStoreMany({
    [STORAGE_KEYS.CATALOG]: catalog,
    [STORAGE_KEYS.CATALOG_VERSION]: catalog.version,
  });
}

export async function setLocalCatalog(catalog: Catalog): Promise<void> {
  await saveStore(STORAGE_KEYS.LOCAL_CATALOG, catalog);
}

/** Persist a catalog to the storage key that matches the current mode. */
export async function setActiveCatalog(catalog: Catalog): Promise<void> {
  const settings = await getSettings();
  if (settings.catalogMode === 'local') {
    await setLocalCatalog(catalog);
  } else {
    await setCatalog(catalog);
  }
}

/**
 * Record fetch outcomes for specific sources onto the active catalog,
 * preserving everything else. This is the only way other modules should
 * mutate per-source tracking data; nothing reaches into catalog internals.
 */
export async function markSourcesFetched(
  updates: Map<string, { lastFetched?: number; errorCountDelta?: number; errorCount?: number }>,
): Promise<void> {
  if (updates.size === 0) return;

  // Read fresh so concurrent mode switches aren't clobbered.
  const catalog = await getCatalog();
  if (!catalog) return;
  let changed = false;
  const sources = catalog.sources.map((source) => {
    const u = updates.get(source.id);
    if (!u) return source;
    changed = true;
    return {
      ...source,
      ...(u.lastFetched !== undefined ? { lastFetched: u.lastFetched } : {}),
      errorCount: u.errorCount !== undefined ? u.errorCount : source.errorCount + (u.errorCountDelta ?? 0),
    };
  });
  if (!changed) return;
  await setActiveCatalog({ ...catalog, sources });
}

export async function getSettings(): Promise<Settings> {
  // Zod fills schema defaults for any missing field, so old storage data
  // lacking new keys parses cleanly instead of crashing callers.
  return loadStore(STORAGE_KEYS.SETTINGS, SettingsSchema, DEFAULT_SETTINGS);
}

export async function setSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await saveStore(STORAGE_KEYS.SETTINGS, updated);
  return updated;
}

/**
 * Merge only the supplied keys into settings and write only when something
 * actually changed. Returns whether a write occurred so callers can skip
 * dependent work (e.g. alarm rescheduling) on no-op updates.
 */
export async function patchSettings(settings: Partial<Settings>): Promise<{ settings: Settings; changed: boolean }> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  const changed = (Object.keys(settings) as (keyof Settings)[]).some((k) => current[k] !== updated[k]);
  if (changed) {
    await saveStore(STORAGE_KEYS.SETTINGS, updated);
  }
  return { settings: updated, changed };
}

export async function fetchAndValidateCatalog(url: string): Promise<Catalog | null> {
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    const parsed = CatalogSchema.safeParse(json);
    if (!parsed.success) {
      console.error('Invalid catalog format:', parsed.error);
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.error('Failed to fetch catalog:', getErrorMessage(error));
    return null;
  }
}

export function validateCatalogJson(raw: string): { ok: true; catalog: Catalog } | { ok: false; error: string } {
  try {
    const json = JSON.parse(raw);
    const parsed = CatalogSchema.safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ');
      return { ok: false, error: `Invalid catalog: ${issues}` };
    }
    return { ok: true, catalog: parsed.data };
  } catch {
    return { ok: false, error: 'Invalid JSON file' };
  }
}

export async function importCatalogFromJson(
  raw: string,
): Promise<{ ok: true; catalog: Catalog } | { ok: false; error: string }> {
  const result = validateCatalogJson(raw);
  if (!result.ok) return result;
  await setLocalCatalog(result.catalog);
  await setSettings({ catalogMode: 'local' });
  return result;
}

/**
 * Apply a remote catalog update, preserving the user's `enabled` toggles,
 * `lastFetched`, and `errorCount` for sources that already exist locally.
 * New sources are added with their own enabled state.
 */
function mergeCatalogWithToggles(remote: Catalog, local: Catalog | null): Catalog {
  if (!local) return remote;

  // Preserve per-source user data from the existing local catalog.
  const localById = new Map(local.sources.map((s) => [s.id, s]));
  const sources: Source[] = remote.sources.map((s) => {
    const prev = localById.get(s.id);
    if (!prev) return s;
    return {
      ...s,
      enabled: prev.enabled,
      // Preserve fetch tracking so a catalog update doesn't trigger a full re-fetch.
      lastFetched: prev.lastFetched,
      errorCount: prev.errorCount,
      snoozedUntil: prev.snoozedUntil,
    };
  });

  // Keep user-added blocked domains across remote catalog updates.
  const blockedDomains = [...new Set([...(remote.blockedDomains ?? []), ...(local.blockedDomains ?? [])])];
  return { ...remote, sources, blockedDomains };
}

/**
 * Returns the bundled catalog.json as a parsed Catalog.
 * Used as a fallback when the remote catalog cannot be fetched on first install.
 */
function getBundledCatalog(): Catalog | null {
  const parsed = CatalogSchema.safeParse(BUNDLED_CATALOG);
  if (!parsed.success) {
    console.error('Bundled catalog is invalid:', parsed.error);
    return null;
  }
  return parsed.data;
}

/**
 * The single catalog update path: fetch → merge with user toggles → persist.
 *
 * No version gate: the merge already preserves every per-source user choice
 * (enabled, snooze, lastFetched), and startup refresh used to run ungated
 * while the alarm path gated on `remote.version > storedVersion`. That split
 * meant a version reset silently stranded users whose stored version was
 * higher than the remote one. One path, one policy.
 *
 * Returns null only when nothing could be fetched and nothing was stored.
 */
export async function refreshCatalog(): Promise<{ catalog: Catalog | null; fetched: boolean }> {
  const settings = await getSettings();

  // In local mode never touch the remote catalog; the imported file is the source of truth.
  if (settings.catalogMode === 'local' || !settings.catalogUrl) {
    return { catalog: await getCatalog(), fetched: false };
  }

  const remote = await fetchAndValidateCatalog(settings.catalogUrl);
  if (!remote) {
    // Fall back to whatever is already stored, then to the bundled catalog.
    const stored = await getCatalog();
    if (stored) return { catalog: stored, fetched: false };
    const bundled = getBundledCatalog();
    if (bundled) {
      await setCatalog(bundled);
      return { catalog: bundled, fetched: false };
    }
    return { catalog: null, fetched: false };
  }

  const local = await getStoredCatalog();
  const merged = mergeCatalogWithToggles(remote, local);
  await setCatalog(merged);
  return { catalog: merged, fetched: true };
}

export function getEnabledSources(catalog: Catalog | null): Source[] {
  if (!catalog) return [];
  return catalog.sources.filter((s) => s.enabled && !isSnoozed(s));
}
