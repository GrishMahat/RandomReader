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
  catalogUrl: z.string().default('https://raw.githubusercontent.com/GrishMahat/RandomReader/refs/heads/main/catalog.json'),
  catalogMode: z.enum(['remote', 'local']).default('remote'),
  autoRefreshInterval: z.number().default(86400000),
  refreshOnStartup: z.boolean().default(true),
  openIn: z.enum(['new_tab', 'current_tab']).default('new_tab'),
  includeTags: z.array(z.string()).default([]),
  excludeTags: z.array(z.string()).default([]),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  selectionMode: z.enum(['unread_only', 'all', 'starred_only']).default('unread_only'),
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

export type StarredMap = Record<string, Article>;

export const DEFAULT_SETTINGS: Settings = {
  catalogUrl: 'https://raw.githubusercontent.com/GrishMahat/RandomReader/refs/heads/main/catalog.json',
  catalogMode: 'remote',
  autoRefreshInterval: 86400000,
  refreshOnStartup: true,
  openIn: 'new_tab',
  includeTags: [],
  excludeTags: [],
  theme: 'system',
  selectionMode: 'unread_only',
  maxAgeDays: 0,
  keywordsInclude: [],
  keywordsExclude: [],
  tagMatchMode: 'any',
  showPreview: true,
  soundEffects: false,
  onboarded: false,
};