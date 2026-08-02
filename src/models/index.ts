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
});

export type Source = z.infer<typeof SourceSchema>;

export const ArticleSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  title: z.string(),
  url: z.string().url(),
  content: z.string().optional(),
  summary: z.string().optional(),
  author: z.string().optional(),
  publishedAt: z.number().optional(),
  fetchedAt: z.number(),
  read: z.boolean().default(false),
  starred: z.boolean().default(false),
});

export type Article = z.infer<typeof ArticleSchema>;

export const SettingsSchema = z.object({
  catalogUrl: z.string().default(''),
  autoRefreshInterval: z.number().default(86400000),
  openIn: z.enum(['new_tab', 'current_tab']).default('new_tab'),
  includeTags: z.array(z.string()).default([]),
  excludeTags: z.array(z.string()).default([]),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  selectionMode: z.enum(['unread_only', 'all', 'starred_only']).default('unread_only'),
  maxAgeDays: z.number().default(0),
  keywordsInclude: z.array(z.string()).default([]),
  keywordsExclude: z.array(z.string()).default([]),
  showPreview: z.boolean().default(true),
  soundEffects: z.boolean().default(false),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const CatalogSchema = z.object({
  version: z.number(),
  updatedAt: z.string(),
  sources: z.array(SourceSchema),
});

export type Catalog = z.infer<typeof CatalogSchema>;

export const DEFAULT_SETTINGS: Settings = {
  catalogUrl: '',
  autoRefreshInterval: 86400000,
  openIn: 'new_tab',
  includeTags: [],
  excludeTags: [],
  theme: 'system',
  selectionMode: 'unread_only',
  maxAgeDays: 0,
  keywordsInclude: [],
  keywordsExclude: [],
  showPreview: true,
  soundEffects: false,
};