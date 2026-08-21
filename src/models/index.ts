import { z } from 'zod';

export const SourceTypeSchema = z.enum(['rss', 'atom', 'sitemap']);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  type: SourceTypeSchema,
  enabled: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  language: z.string().optional(),
  lastFetched: z.number().optional(),
  errorCount: z.number().default(0),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  feeds: z.array(z.string().url()).default([]),
  maxUrls: z.number().int().positive().optional(),
  /** Timestamp until which the source is temporarily excluded from rolls. */
  snoozedUntil: z.number().optional(),
  /** Per-source max article age override (days); falls back to the global setting. */
  maxAgeDays: z.number().int().positive().optional(),
  /**
   * Declared archive pagination for deep rolls. `{n}` is replaced with a
   * page number. Set `wpTotalPages: true` on WordPress sites so the exact
   * depth is discovered live from X-WP-TotalPages and cached per source;
   * otherwise `maxPages` is the static depth used as-is.
   */
  archive: z
    .object({
      template: z.string().url(),
      wpTotalPages: z.boolean().optional(),
      maxPages: z.number().int().positive().optional(),
    })
    .optional(),
});

export type Source = z.infer<typeof SourceSchema>;

export const ArticleSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  title: z.string(),
  url: z.string().url(),
  author: z.string().optional(),
  publishedAt: z.number().optional(),
  fetchedAt: z.number(),
  read: z.boolean().default(false),
  starred: z.boolean().default(false),
});

export type Article = z.infer<typeof ArticleSchema>;

export const SettingsSchema = z.object({
  catalogUrl: z
    .string()
    .default('https://raw.githubusercontent.com/GrishMahat/RandomReader/refs/heads/main/catalog.json'),
  catalogMode: z.enum(['remote', 'local']).default('remote'),
  autoRefreshInterval: z.number().default(86400000),
  refreshOnStartup: z.boolean().default(true),
  openIn: z.enum(['new_tab', 'current_tab']).default('new_tab'),
  includeTags: z.array(z.string()).default([]),
  excludeTags: z.array(z.string()).default([]),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  selectionMode: z.enum(['unread_only', 'all', 'starred_only']).default('unread_only'),
  /**
   * Where rolls come from: 'recent' samples the stored pool (latest feed
   * items); 'deep' fetches live from a random source's older pages
   * (`?paged=`/`?page=` where the site supports it, ~34% of the catalog),
   * falling back to recent behavior everywhere else.
   */
  discoveryMode: z.enum(['recent', 'deep']).default('recent'),
  maxAgeDays: z.number().default(0),
  keywordsInclude: z.array(z.string()).default([]),
  keywordsExclude: z.array(z.string()).default([]),
  tagMatchMode: z.enum(['any', 'all']).default('any'),
  showPreview: z.boolean().default(true),
  soundEffects: z.boolean().default(false),
  onboarded: z.boolean().default(false),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const CatalogSchema = z.object({
  version: z.number(),
  updatedAt: z.string(),
  sources: z.array(SourceSchema),
  blockedDomains: z.array(z.string()).default([]),
});

export type Catalog = z.infer<typeof CatalogSchema>;

export const HistoryEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  sourceId: z.string(),
  sourceName: z.string().optional(),
  author: z.string().optional(),
  openedAt: z.number(),
});

export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export const StarredEntrySchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  sourceId: z.string(),
});

export type StarredEntry = z.infer<typeof StarredEntrySchema>;

export const StarredMapSchema = z.record(z.string(), StarredEntrySchema);

export type StarredMap = Record<string, StarredEntry>;

/** Compact catalog summary shipped over the message pipe instead of full catalogs. */
export interface CatalogSummary {
  version: number;
  updatedAt: string;
  sourceCount: number;
}

/** Derived from SettingsSchema so Zod defaults and this object are always in sync. */
export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

/** Central registry of all chrome.storage.local keys used across the extension. */
export const STORAGE_KEYS = {
  ARTICLES: 'articles',
  TITLE_CACHE: 'titleCache',
  ROLL_STATS: 'rollStats',
  ROLL_HISTORY: 'rollHistory',
  CATALOG: 'catalog',
  CATALOG_VERSION: 'catalogVersion',
  LOCAL_CATALOG: 'localCatalog',
  SETTINGS: 'settings',
  READ_HISTORY: 'readHistory',
  STARRED: 'starred',
  /** Learned pagination depth per source id, for deep rolls. */
  SOURCE_DEPTH: 'sourceDepth',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** Type-safe Discriminated Union of all extension message protocols. */
export type ExtensionMessage =
  | { type: 'GET_RANDOM' }
  | { type: 'OPEN_RANDOM' }
  | { type: 'REFRESH_FEEDS' }
  | { type: 'REFRESH_CATALOG' }
  | { type: 'IMPORT_CATALOG'; raw: string }
  | { type: 'GET_CATALOG_INFO' }
  | { type: 'UPDATE_BLOCKED_DOMAINS'; domains: string[] }
  | { type: 'GET_SETTINGS' }
  | { type: 'SET_SETTINGS'; settings: Partial<Settings> }
  | { type: 'PATCH_SETTINGS'; settings: Partial<Settings> }
  | { type: 'GET_SOURCES' }
  | { type: 'TOGGLE_SOURCE'; sourceId: string }
  | { type: 'SNOOZE_SOURCE'; sourceId: string; until: number | null }
  | { type: 'TOGGLE_STAR'; article: Article; starred?: boolean }
  | { type: 'GET_ARTICLES' }
  | { type: 'GET_HISTORY' }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'CLEAR_DATA' };

/** History entry as viewed by the UI (read flag added). */
export type HistoryView = HistoryEntry & { read: boolean };

export interface SettingsResult {
  success: boolean;
  settings?: Settings;
  error?: string;
}

export interface SourcesResult {
  success: boolean;
  sources?: Source[];
  error?: string;
}

export interface RandomArticleResult {
  success: boolean;
  article?: Article;
  error?: string;
}

export interface OpenRandomResult {
  success: boolean;
  article?: Article;
  streak?: number;
  odds?: number;
  sourceName?: string;
  error?: string;
}

export interface RefreshFeedsResult {
  success: boolean;
  fetched?: number;
  added?: number;
  error?: string;
}

export interface RefreshCatalogResult {
  success: boolean;
  catalog?: Catalog | null;
  error?: string;
}

export interface ImportCatalogResult {
  success: boolean;
  catalog?: Catalog;
  error?: string;
}

export interface CatalogInfoResult {
  success: boolean;
  mode?: Settings['catalogMode'];
  catalogUrl?: string;
  local?: CatalogSummary | null;
  remote?: CatalogSummary | null;
  blockedDomains?: string[];
  error?: string;
}

export interface BlockedDomainsResult {
  success: boolean;
  blockedDomains?: string[];
  error?: string;
}

export interface StarredResult {
  success: boolean;
  starred?: boolean;
  error?: string;
}

export interface ArticlesResult {
  success: boolean;
  articles?: Article[];
  error?: string;
}

export interface HistoryResult {
  success: boolean;
  history?: HistoryView[];
  error?: string;
}

export interface OkResult {
  success: boolean;
  error?: string;
}

/**
 * The response half of the message pipe: every request type maps to exactly
 * one response interface. Callers get checked payloads from `sendMessage`,
 * and the background handler registry narrows automatically via this map.
 */
export interface MessageResponses {
  GET_RANDOM: RandomArticleResult;
  OPEN_RANDOM: OpenRandomResult;
  REFRESH_FEEDS: RefreshFeedsResult;
  REFRESH_CATALOG: RefreshCatalogResult;
  IMPORT_CATALOG: ImportCatalogResult;
  GET_CATALOG_INFO: CatalogInfoResult;
  UPDATE_BLOCKED_DOMAINS: BlockedDomainsResult;
  GET_SETTINGS: SettingsResult;
  SET_SETTINGS: SettingsResult;
  PATCH_SETTINGS: SettingsResult;
  GET_SOURCES: SourcesResult;
  TOGGLE_SOURCE: SourcesResult;
  SNOOZE_SOURCE: SourcesResult;
  TOGGLE_STAR: StarredResult;
  GET_ARTICLES: ArticlesResult;
  GET_HISTORY: HistoryResult;
  CLEAR_HISTORY: OkResult;
  CLEAR_DATA: OkResult;
}
