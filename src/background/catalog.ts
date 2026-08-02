import type { Catalog, Source, Settings } from '../models';
import { DEFAULT_SETTINGS, CatalogSchema, SettingsSchema } from '../models';
import { fetchWithTimeout, getErrorMessage } from '../utils';
import bundledCatalog from '../catalog.json' with { type: 'json' };

const CATALOG_KEY = 'catalog';
const SETTINGS_KEY = 'settings';

const LOCAL_CATALOG = CatalogSchema.parse(bundledCatalog);

export async function getCatalog(): Promise<Catalog | null> {
  const result = await chrome.storage.local.get(CATALOG_KEY) as Record<string, unknown>;
  return (result[CATALOG_KEY] as Catalog) || LOCAL_CATALOG;
}

export async function setCatalog(catalog: Catalog): Promise<void> {
  await chrome.storage.local.set({ [CATALOG_KEY]: catalog });
}

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY) as Record<string, unknown>;
  const stored = result[SETTINGS_KEY] as Partial<Settings> | undefined;
  // Use Zod parse so any missing or undefined fields always get schema defaults.
  // This prevents crashes when old storage data lacks new fields (e.g. includeTags undefined).
  const parsed = SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...stored });
  return parsed.success ? parsed.data : { ...DEFAULT_SETTINGS };
}

export async function setSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
  return updated;
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

export async function importCatalogFromJson(raw: string): Promise<{ ok: true; catalog: Catalog } | { ok: false; error: string }> {
  const result = validateCatalogJson(raw);
  if (!result.ok) return result;
  await setCatalog(result.catalog);
  return result;
}

export async function refreshCatalog(): Promise<Catalog | null> {
  const settings = await getSettings();

  if (!settings.catalogUrl) {
    await setCatalog(LOCAL_CATALOG);
    return LOCAL_CATALOG;
  }

  const catalog = await fetchAndValidateCatalog(settings.catalogUrl);
  if (catalog) {
    await setCatalog(catalog);
  }
  return catalog;
}

export function getEnabledSources(catalog: Catalog | null): Source[] {
  if (!catalog) return [];
  return catalog.sources.filter((s) => s.enabled);
}