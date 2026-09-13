import type { Article, HistoryEntry, StarredEntry } from '../models';
import { DAY_MS } from '../utils';

// ─── Discovery scoring ────────────────────────────────────────────────────────
// Picks are a mixture model, not an argmax: first roll a lane from LANE_MIX,
// then weighted-pick *within* that lane. The lane roll is what guarantees the
// anti-bubble proportions structurally (40/30/20/10) — weights alone could
// still collapse into "17 articles about Rust". Scores only ever act as
// weights, so a low-scoring article can always win. Serendipity is the product.

/** Sampling lanes. `wild` is uniform over all filtered candidates; the rest
 *  are ranked by score within the lane. */
export type Lane = 'familiar' | 'unfamiliar' | 'timeless' | 'wild';
export type RankedLane = Exclude<Lane, 'wild'>;

/** Sampling proportions per roll. Lanes with no candidates are skipped and
 *  their share redistributes over the remaining lanes, so the mix degrades
 *  gracefully (e.g. a 7-day max-age setting empties the timeless lane, and a
 *  brand-new user with no history empties the familiar lane). */
export const LANE_MIX: Record<Lane, number> = {
  familiar: 0.4,
  unfamiliar: 0.3,
  timeless: 0.2,
  wild: 0.1,
};

/** Articles older than this count as "timeless" (evergreen resurfacing).
 *  No content-quality signal exists client-side, so age combined with the
 *  diversity factors is the honest proxy — never labeled as quality. */
export const TIMELESS_AGE_MS = 21 * DAY_MS;

/** Recency half-life for the freshness factor. */
export const FRESHNESS_HALF_LIFE_MS = 3 * DAY_MS;

/** Relative factor weights in the total score. Deliberately constants, not
 *  settings: the product stays opinionated, and the lane mix above — not
 *  sliders — is the anti-bubble guarantee. */
export const FACTOR_WEIGHTS = {
  freshness: 1,
  source: 1.25,
  topic: 1.25,
  history: 1,
  unseen: 0.75,
} as const;

/** Reads count 1x, stars count 3x toward taste affinity. */
const STAR_AFFINITY_WEIGHT = 3;

/** A discovery preset: lane shares plus factor weights. Explorer tilts the
 *  mix toward unfamiliar topics, new sources, and wildcards; it never
 *  touches hard filters (max age, tags, blocked domains still apply). */
export interface DiscoveryPreset {
  mix: Record<Lane, number>;
  weights: { freshness: number; source: number; topic: number; history: number; unseen: number };
}

export const BALANCED_PRESET: DiscoveryPreset = {
  mix: LANE_MIX,
  weights: { ...FACTOR_WEIGHTS },
};

export const EXPLORER_PRESET: DiscoveryPreset = {
  mix: { familiar: 0.2, unfamiliar: 0.4, timeless: 0.2, wild: 0.2 },
  weights: { freshness: 0.6, source: 0.8, topic: 1.5, history: 0.4, unseen: 1.5 },
};

export function presetFor(explorerMode: boolean): DiscoveryPreset {
  return explorerMode ? EXPLORER_PRESET : BALANCED_PRESET;
}

/** Cap on tracked per-source roll counts; the catalog is ~140 sources, so
 *  this only guards against pathological growth, never triggers in practice. */
export const MAX_SOURCE_COUNTS = 1000;

export interface ScoreBreakdown {
  /** 0..1 recency gradient (exponential decay, not a binary cutoff). */
  freshness: number;
  /** 0..1 short-window source avoidance. */
  source: number;
  /** 0..1 short-window topic avoidance. */
  topic: number;
  /** 0..1 affinity to starred + read history. */
  history: number;
  /** 0..1 never-rolled sources / never-seen tags bonus. */
  unseen: number;
  /** Weighted sum; used as a pick weight, never an argmax. */
  total: number;
}

/** Everything scoring needs, assembled by the caller from stores it already
 *  holds. Plain data (no chrome APIs) so this module stays pure and testable. */
export interface ScoringContext {
  now: number;
  /** Tag list per source id, from the active catalog. */
  tagBySource: Record<string, string[]>;
  /** Recently rolled source ids, newest first (short window). */
  recentSourceIds: string[];
  /** All-time roll counts per source id (long window). */
  sourceCounts: Record<string, number>;
  /** Tag -> affinity count (reads 1x + stars 3x). Keys present ⟺ seen. */
  tagAffinity: Record<string, number>;
  /** Source id -> affinity count (reads 1x + stars 3x). */
  sourceAffinity: Record<string, number>;
  maxTagAffinity: number;
  maxSourceAffinity: number;
  /** Token sets of starred titles, for title-overlap affinity. */
  starredTokenSets: string[][];
}

/** Headline-frequent glue words, dropped by title tokenizers. Shared with
 *  dedup so similarity and affinity tokenize identically. */
export const TITLE_STOPWORDS = new Set([
  'with',
  'from',
  'that',
  'this',
  'what',
  'when',
  'where',
  'which',
  'while',
  'your',
  'yours',
  'you',
  'they',
  'them',
  'their',
  'there',
  'these',
  'those',
  'are',
  'has',
  'have',
  'had',
  'will',
  'would',
  'could',
  'should',
  'been',
  'into',
  'over',
  'under',
  'about',
  'after',
  'before',
  'than',
  'then',
  'also',
  'just',
  'very',
  'much',
  'many',
  'such',
  'each',
  'other',
  'some',
  'more',
  'most',
  'between',
  'through',
  'during',
  'without',
  'within',
]);

/** Significant tokens of a title: lowercased, de-duplicated, short and
 *  stopwords dropped. Unicode-aware so non-Latin titles still tokenize. */
export function tokenizeTitle(title: string): string[] {
  const tokens = title
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 3 && !TITLE_STOPWORDS.has(t));
  return [...new Set(tokens)];
}

/** Token-set overlap 0..1. Shared with dedup, which matches near-identical
 *  syndicated headlines. */
export function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let inter = 0;
  for (const t of a) if (setB.has(t)) inter++;
  return inter / (a.length + setB.size - inter);
}

/** Short-window source avoidance. Extracted (not inlined) because live
 *  source selection reuses it to spread fetch load; behavior is the
 *  pre-scoring formula exactly, so lucky-streak dynamics don't change. */
export function sourceDiversityWeight(sourceId: string, recentSourceIds: string[]): number {
  const count = recentSourceIds.filter((id) => id === sourceId).length;
  return 1 / (1 + count * 2);
}

export function pickWeighted<T>(items: T[], weight: (item: T) => number, rng: () => number = Math.random): T | null {
  if (items.length === 0) return null;
  const weights = items.map(weight);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function articleAgeMs(article: Article, now: number): number {
  return Math.max(0, now - (article.publishedAt ?? article.fetchedAt ?? now));
}

export function scoreArticle(
  article: Article,
  ctx: ScoringContext,
  weights: DiscoveryPreset['weights'] = FACTOR_WEIGHTS,
): ScoreBreakdown {
  const tags = ctx.tagBySource[article.sourceId] ?? [];

  const freshness = Math.exp(-articleAgeMs(article, ctx.now) / FRESHNESS_HALF_LIFE_MS);

  const source = sourceDiversityWeight(article.sourceId, ctx.recentSourceIds);

  // Topic diversity mirrors the source decay over mean tag occurrences in
  // the recent window. Untagged sources can't diversify: stay neutral.
  let topic: number;
  if (tags.length === 0) {
    topic = 0.5;
  } else {
    let occurrences = 0;
    for (const tag of tags) {
      for (const id of ctx.recentSourceIds) {
        if ((ctx.tagBySource[id] ?? []).includes(tag)) occurrences++;
      }
    }
    topic = 1 / (1 + occurrences / tags.length);
  }

  // History affinity pulls toward demonstrated taste; the lane mix keeps it
  // from becoming a bubble on its own.
  const tagScore =
    tags.length === 0 || ctx.maxTagAffinity <= 0
      ? 0
      : tags.reduce((sum, t) => sum + (ctx.tagAffinity[t] ?? 0), 0) / tags.length / ctx.maxTagAffinity;
  const sourceScore =
    ctx.maxSourceAffinity <= 0 ? 0 : (ctx.sourceAffinity[article.sourceId] ?? 0) / ctx.maxSourceAffinity;
  const titleTokens = tokenizeTitle(article.title);
  let titleScore = 0;
  for (const starred of ctx.starredTokenSets) {
    titleScore = Math.max(titleScore, jaccardSimilarity(titleTokens, starred));
  }
  const history = 0.5 * tagScore + 0.25 * sourceScore + 0.25 * titleScore;

  // Unseen bonus: never-rolled sources and never-seen tags. Affinity counts
  // are always >= 1 when present, so `<= 0` (via ?? 0) means unseen.
  const sourceUnseen = ctx.sourceCounts[article.sourceId] ? 0 : 1;
  const tagUnseen = tags.length === 0 ? 0 : tags.filter((t) => (ctx.tagAffinity[t] ?? 0) <= 0).length / tags.length;
  const unseen = 0.5 * sourceUnseen + 0.5 * tagUnseen;

  const total =
    weights.freshness * freshness +
    weights.source * source +
    weights.topic * topic +
    weights.history * history +
    weights.unseen * unseen;
  return { freshness, source, topic, history, unseen, total };
}

/** Lane assignment precedence: unseen topics first (discovery), then old
 *  standbys (resurfacing), everything else is familiar. Untagged sources can
 *  never be "unfamiliar" — unknown is not unseen. */
export function classifyLane(article: Article, ctx: ScoringContext): RankedLane {
  const tags = ctx.tagBySource[article.sourceId] ?? [];
  if (tags.some((t) => (ctx.tagAffinity[t] ?? 0) <= 0)) return 'unfamiliar';
  if (articleAgeMs(article, ctx.now) > TIMELESS_AGE_MS) return 'timeless';
  return 'familiar';
}

export interface ScoredPick {
  article: Article;
  lane: Lane;
  breakdown: ScoreBreakdown;
}

/** Mixture-model pick: roll a lane from LANE_MIX (skipping empty lanes),
 *  then weighted-pick within it — uniform for `wild`, scored otherwise.
 *  `rng` is injectable so tests are deterministic; production passes nothing
 *  and gets Math.random. Returns null only for an empty candidate list. */
export function pickScored(
  candidates: Article[],
  ctx: ScoringContext,
  rng: () => number = Math.random,
  preset: DiscoveryPreset = BALANCED_PRESET,
): ScoredPick | null {
  if (candidates.length === 0) return null;

  const scored = candidates.map((article) => ({
    article,
    breakdown: scoreArticle(article, ctx, preset.weights),
    lane: classifyLane(article, ctx) as Lane,
  }));
  // `wild` is the whole candidate set, so at least one lane is never empty.
  const wild: typeof scored = [...scored];
  const byLane = new Map<Lane, typeof scored>([['wild', wild]]);
  for (const s of scored) {
    const list = byLane.get(s.lane);
    if (list) list.push(s);
    else byLane.set(s.lane, [s]);
  }

  const lanes = (Object.keys(preset.mix) as Lane[])
    .map((lane) => ({ lane, share: preset.mix[lane], items: byLane.get(lane) ?? [] }))
    .filter((entry) => entry.items.length > 0);
  const totalShare = lanes.reduce((sum, entry) => sum + entry.share, 0);
  let r = rng() * totalShare;
  let chosen = lanes[lanes.length - 1];
  for (const entry of lanes) {
    r -= entry.share;
    if (r <= 0) {
      chosen = entry;
      break;
    }
  }

  if (chosen.lane === 'wild') {
    const winner = chosen.items[Math.floor(rng() * chosen.items.length)];
    return { article: winner.article, lane: 'wild', breakdown: winner.breakdown };
  }
  const winner = pickWeighted(chosen.items, (s) => s.breakdown.total, rng);
  // pickWeighted returns null only for empty input, excluded above.
  const fallback = chosen.items[0];
  const final = winner ?? fallback;
  return { article: final.article, lane: final.lane, breakdown: final.breakdown };
}

/** Assemble a context from caller-owned store data. Accepts the history and
 *  starred entry shapes structurally, so feeds.ts passes its arrays directly. */
export function makeScoringContext(args: {
  now?: number;
  tagBySource: Record<string, string[]>;
  recentSourceIds: string[];
  sourceCounts?: Record<string, number>;
  reads?: Pick<HistoryEntry, 'sourceId'>[];
  stars?: Pick<StarredEntry, 'sourceId' | 'title'>[];
}): ScoringContext {
  const tagAffinity: Record<string, number> = {};
  const sourceAffinity: Record<string, number> = {};
  const credit = (sourceId: string, weight: number) => {
    sourceAffinity[sourceId] = (sourceAffinity[sourceId] ?? 0) + weight;
    for (const tag of args.tagBySource[sourceId] ?? []) {
      tagAffinity[tag] = (tagAffinity[tag] ?? 0) + weight;
    }
  };
  for (const read of args.reads ?? []) credit(read.sourceId, 1);
  for (const star of args.stars ?? []) credit(star.sourceId, STAR_AFFINITY_WEIGHT);

  const maxOf = (record: Record<string, number>): number => {
    const values = Object.values(record);
    return values.length > 0 ? Math.max(...values) : 0;
  };
  return {
    now: args.now ?? Date.now(),
    tagBySource: args.tagBySource,
    recentSourceIds: args.recentSourceIds,
    sourceCounts: args.sourceCounts ?? {},
    tagAffinity,
    sourceAffinity,
    maxTagAffinity: maxOf(tagAffinity),
    maxSourceAffinity: maxOf(sourceAffinity),
    starredTokenSets: (args.stars ?? []).map((star) => tokenizeTitle(star.title)),
  };
}
