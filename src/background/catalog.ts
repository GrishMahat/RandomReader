import BUNDLED_CATALOG from '../../catalog.json';
import type { Catalog, Settings, Source } from '../models';
import { CatalogSchema, DEFAULT_SETTINGS, SettingsSchema, STORAGE_KEYS } from '../models';
import { fetchWithTimeout, getErrorMessage } from '../utils';

/** Remote (URL-fetched) catalog stored for the "remote" mode. */
export async function getStoredCatalog(): Promise<Catalog | null> {
  const result = (await chrome.storage.local.get([STORAGE_KEYS.CATALOG, STORAGE_KEYS.CATALOG_VERSION])) as Record<
    string,
    unknown
  >;
  const catalog = result[STORAGE_KEYS.CATALOG] as Catalog | undefined;
  return catalog ?? null;
}

/** Catalog imported from a local file, used in "local" mode. */
export async function getLocalCatalog(): Promise<Catalog | null> {
  const result = (await chrome.storage.local.get(STORAGE_KEYS.LOCAL_CATALOG)) as Record<string, unknown>;
  const catalog = result[STORAGE_KEYS.LOCAL_CATALOG] as Catalog | undefined;
  return catalog ?? null;
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

export async function getCatalogVersion(): Promise<number> {
  const result = (await chrome.storage.local.get(STORAGE_KEYS.CATALOG_VERSION)) as Record<string, unknown>;
  return (result[STORAGE_KEYS.CATALOG_VERSION] as number) ?? 0;
}

export async function setCatalog(catalog: Catalog): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.CATALOG]: catalog,
    [STORAGE_KEYS.CATALOG_VERSION]: catalog.version,
  });
}

export async function setLocalCatalog(catalog: Catalog): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.LOCAL_CATALOG]: catalog });
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

export async function getSettings(): Promise<Settings> {
  const result = (await chrome.storage.local.get(STORAGE_KEYS.SETTINGS)) as Record<string, unknown>;
  const stored = result[STORAGE_KEYS.SETTINGS] as Partial<Settings> | undefined;
  // Use Zod parse so any missing or undefined fields always get schema defaults.
  // This prevents crashes when old storage data lacks new fields (e.g. includeTags undefined).
  const parsed = SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...stored });
  return parsed.success ? parsed.data : { ...DEFAULT_SETTINGS };
}

export async function setSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
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
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
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
 * New sources (higher version) are added with their own enabled state.
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

export async function refreshCatalog(): Promise<Catalog | null> {
  const settings = await getSettings();

  // In local mode never touch the remote catalog — the imported file is the source of truth.
  if (settings.catalogMode === 'local') {
    return getCatalog();
  }

  if (!settings.catalogUrl) {
    return getCatalog();
  }

  const remote = await fetchAndValidateCatalog(settings.catalogUrl);
  if (!remote) {
    // Fall back to whatever is already stored, then to the bundled catalog.
    const stored = await getCatalog();
    if (stored) return stored;
    const bundled = getBundledCatalog();
    if (bundled) {
      await setCatalog(bundled);
      return bundled;
    }
    return null;
  }

  const local = await getStoredCatalog();
  const merged = mergeCatalogWithToggles(remote, local);
  await setCatalog(merged);
  return merged;
}

/**
 * Version-aware catalog update: only fetch and apply when the remote catalog is
 * newer than the stored one. Keeps the user's enabled/disabled source toggles,
 * lastFetched, and errorCount.
 */
export async function updateCatalogIfNewer(): Promise<{ updated: boolean; catalog: Catalog | null }> {
  const settings = await getSettings();

  if (settings.catalogMode === 'local') {
    return { updated: false, catalog: await getCatalog() };
  }

  if (!settings.catalogUrl) {
    return { updated: false, catalog: await getCatalog() };
  }

  const storedVersion = await getCatalogVersion();
  const remote = await fetchAndValidateCatalog(settings.catalogUrl);
  if (!remote) {
    return { updated: false, catalog: await getCatalog() };
  }

  if (remote.version <= storedVersion) {
    return { updated: false, catalog: await getCatalog() };
  }

  const local = await getStoredCatalog();
  const merged = mergeCatalogWithToggles(remote, local);
  await setCatalog(merged);
  return { updated: true, catalog: merged };
}

/** True when the source is snoozed — `snoozedUntil` set and still in the future. */
export function isSourceSnoozed(source: Source): boolean {
  return typeof source.snoozedUntil === 'number' && source.snoozedUntil > Date.now();
}

export function getEnabledSources(catalog: Catalog | null): Source[] {
  if (!catalog) return [];
  return catalog.sources.filter((s) => s.enabled && !isSourceSnoozed(s));
}
