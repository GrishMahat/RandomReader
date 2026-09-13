import { describe, expect, it } from 'vitest';
import type { ScoringContext } from '../../src/background/scoring';
import {
  BALANCED_PRESET,
  classifyLane,
  EXPLORER_PRESET,
  jaccardSimilarity,
  makeScoringContext,
  pickScored,
  pickWeighted,
  presetFor,
  scoreArticle,
  sourceDiversityWeight,
  tokenizeTitle,
} from '../../src/background/scoring';
import type { Article } from '../../src/models';
import { DAY_MS } from '../../src/utils';

const NOW = 1_786_000_000_000;

const TAGS: Record<string, string[]> = {
  techcrunch: ['technology', 'tech', 'news'],
  arstechnica: ['technology', 'tech'],
  bonappetit: ['food', 'cooking'],
  espn: ['sports'],
};

function article(overrides: Partial<Article> & { id: string }): Article {
  return {
    sourceId: 'techcrunch',
    title: 'Some technology article title here',
    url: `https://example.com/${overrides.id}`,
    fetchedAt: NOW,
    read: false,
    starred: false,
    ...overrides,
  };
}

/** Context with tech seen via one read; food/sports unseen. */
function baseCtx(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    ...makeScoringContext({
      now: NOW,
      tagBySource: TAGS,
      recentSourceIds: [],
      reads: [{ sourceId: 'techcrunch' }],
    }),
    ...overrides,
  };
}

/** Deterministic rng from a repeating sequence. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('sourceDiversityWeight', () => {
  it('is 1 with no history and decays with repeats', () => {
    expect(sourceDiversityWeight('a', [])).toBe(1);
    expect(sourceDiversityWeight('a', ['a'])).toBeCloseTo(1 / 3);
    expect(sourceDiversityWeight('a', ['a', 'a'])).toBeCloseTo(1 / 5);
    expect(sourceDiversityWeight('b', ['a', 'a'])).toBe(1);
  });

  it('scores empty token sets as zero overlap', () => {
    expect(jaccardSimilarity([], ['a'])).toBe(0);
    expect(jaccardSimilarity(['a'], [])).toBe(0);
  });
});

describe('tokenizeTitle', () => {
  it('keeps significant tokens, drops stopwords and short words', () => {
    expect(tokenizeTitle('The Best Rust Web Frameworks for 2026')).toEqual(['best', 'rust', 'frameworks', '2026']);
  });

  it('deduplicates tokens', () => {
    expect(tokenizeTitle('Pasta pasta butter pasta')).toEqual(['pasta', 'butter']);
  });

  it('returns [] for empty input and tokenizes non-Latin scripts', () => {
    expect(tokenizeTitle('')).toEqual([]);
    expect(tokenizeTitle('Привет мир разработка')).toEqual(['привет', 'разработка']);
  });
});

describe('classifyLane', () => {
  it('routes unseen-topic articles to unfamiliar', () => {
    const picked = classifyLane(
      article({ id: 'f', sourceId: 'bonappetit', title: 'Butter garlic pasta recipe' }),
      baseCtx(),
    );
    expect(picked).toBe('unfamiliar');
  });

  it('routes old seen-topic articles to timeless', () => {
    const picked = classifyLane(article({ id: 't', publishedAt: NOW - 30 * DAY_MS }), baseCtx());
    expect(picked).toBe('timeless');
  });

  it('routes recent seen-topic articles to familiar', () => {
    expect(classifyLane(article({ id: 'f' }), baseCtx())).toBe('familiar');
  });

  it('treats untagged sources as familiar, never unfamiliar', () => {
    expect(classifyLane(article({ id: 'u', sourceId: 'unknown-source' }), baseCtx())).toBe('familiar');
  });

  it('prefers unfamiliar over timeless when both apply', () => {
    const picked = classifyLane(
      article({ id: 'ot', sourceId: 'bonappetit', publishedAt: NOW - 60 * DAY_MS }),
      baseCtx(),
    );
    expect(picked).toBe('unfamiliar');
  });

  it('splits familiar and timeless at the 21-day boundary', () => {
    expect(classifyLane(article({ id: 'y', publishedAt: NOW - 20 * DAY_MS }), baseCtx())).toBe('familiar');
    expect(classifyLane(article({ id: 'o', publishedAt: NOW - 22 * DAY_MS }), baseCtx())).toBe('timeless');
  });
});

describe('scoreArticle', () => {
  it('ranks newer articles higher on freshness, all else equal', () => {
    const ctx = baseCtx();
    const fresh = scoreArticle(article({ id: 'new' }), ctx);
    const old = scoreArticle(article({ id: 'old', publishedAt: NOW - 10 * DAY_MS }), ctx);
    expect(fresh.freshness).toBeGreaterThan(old.freshness);
    expect(fresh.total).toBeGreaterThan(old.total);
  });

  it('gives history affinity to starred-topic articles, none to strangers', () => {
    const ctx = makeScoringContext({
      now: NOW,
      tagBySource: TAGS,
      recentSourceIds: [],
      stars: [{ sourceId: 'techcrunch', title: 'Rust web frameworks ship new async runtime' }],
    });
    const similar = scoreArticle(article({ id: 's', title: 'Async runtime lands in popular Rust web framework' }), ctx);
    const stranger = scoreArticle(
      article({ id: 'x', sourceId: 'espn', title: 'Championship final goes into overtime thriller' }),
      ctx,
    );
    expect(similar.history).toBeGreaterThan(0);
    expect(stranger.history).toBe(0);
    expect(similar.history).toBeGreaterThan(stranger.history);
  });

  it('rewards never-rolled sources and never-seen tags', () => {
    const ctx = baseCtx({ sourceCounts: { techcrunch: 5 } });
    const rolled = scoreArticle(article({ id: 'r', sourceId: 'techcrunch' }), ctx);
    // arstechnica shares only seen tags, but its source was never rolled.
    const fresh = scoreArticle(article({ id: 'n', sourceId: 'arstechnica' }), ctx);
    expect(fresh.unseen).toBeGreaterThan(rolled.unseen);
  });

  it('lowers topic scores for tags repeated in the recent window', () => {
    const seen = article({ id: 's' });
    const quiet = scoreArticle(seen, baseCtx());
    const noisy = scoreArticle(seen, baseCtx({ recentSourceIds: ['techcrunch', 'techcrunch', 'arstechnica'] }));
    expect(quiet.topic).toBe(1);
    expect(noisy.topic).toBeLessThan(quiet.topic);
  });

  it('clamps future dates to full freshness and falls back to fetchedAt', () => {
    const ctx = baseCtx();
    const future = scoreArticle(article({ id: 'f', publishedAt: NOW + DAY_MS }), ctx);
    expect(future.freshness).toBe(1);
    const byFetched = scoreArticle(article({ id: 'a', fetchedAt: NOW - 5 * DAY_MS }), ctx);
    const byPublished = scoreArticle(article({ id: 'b', publishedAt: NOW - 5 * DAY_MS }), ctx);
    expect(byFetched.freshness).toBeCloseTo(byPublished.freshness);
  });

  it('treats dateless articles as brand new', () => {
    const ctx = baseCtx();
    const dateless = scoreArticle(
      { ...article({ id: 'd' }), publishedAt: undefined, fetchedAt: undefined as unknown as number },
      ctx,
    );
    expect(dateless.freshness).toBe(1);
  });

  it('ignores unknown source ids in the recent window', () => {
    const seen = article({ id: 's' });
    expect(scoreArticle(seen, baseCtx({ recentSourceIds: ['ghost'] })).topic).toBe(1);
  });
});

describe('pickWeighted', () => {
  it('returns null for an empty list', () => {
    expect(pickWeighted([], () => 1)).toBeNull();
  });

  it('falls back to uniform when all weights are zero', () => {
    expect(pickWeighted(['a', 'b'], () => 0, seq([0.75]))).toBe('b');
  });

  it('lets low-weight items win: scores are weights, never an argmax', () => {
    const items = [
      { w: 9, id: 'heavy' },
      { w: 1, id: 'light' },
    ];
    expect(pickWeighted(items, (i) => i.w, seq([0.95]))?.id).toBe('light');
    expect(pickWeighted(items, (i) => i.w, seq([0.5]))?.id).toBe('heavy');
  });

  it('returns the last item when rounding survives every subtraction', () => {
    const items = [
      { w: 0.1, id: 'a' },
      { w: 0.2, id: 'b' },
      { w: 0.3, id: 'c' },
    ];
    expect(pickWeighted(items, (i) => i.w, seq([1]))?.id).toBe('c');
  });
});

describe('pickScored', () => {
  const familiar = article({ id: 'fam', title: 'New chips promise faster inference speeds' });
  const unfamiliar = article({
    id: 'unf',
    sourceId: 'bonappetit',
    title: 'Butter garlic pasta recipe for weeknights',
  });
  const timeless = article({
    id: 'old',
    title: 'Classic essay on the craft of programming tools',
    publishedAt: NOW - 30 * DAY_MS,
  });

  it('returns null for an empty candidate list', () => {
    expect(pickScored([], baseCtx())).toBeNull();
  });

  it('rolls lanes from the mix: first rng value selects the lane', () => {
    const candidates = [familiar, unfamiliar, timeless];
    const ctx = baseCtx();
    // Shares: familiar .4 / unfamiliar .3 / timeless .2 / wild .1.
    expect(pickScored(candidates, ctx, seq([0.0, 0.0]))?.lane).toBe('familiar');
    expect(pickScored(candidates, ctx, seq([0.5, 0.0]))?.lane).toBe('unfamiliar');
    expect(pickScored(candidates, ctx, seq([0.75, 0.0]))?.lane).toBe('timeless');
    const wild = pickScored(candidates, ctx, seq([0.95, 0.0]));
    expect(wild?.lane).toBe('wild');
    expect(wild?.article.id).toBe('fam');
  });

  it('redistributes shares of empty lanes instead of returning nothing', () => {
    const candidates = [familiar, article({ id: 'fam2', title: 'Startup raises round to scale cloud platform' })];
    const ctx = baseCtx();
    // Only familiar (.4) and wild (.1) are non-empty: rng 0.5 lands familiar,
    // rng 0.9 lands wild. Unfamiliar/timeless shares never strand a roll.
    expect(pickScored(candidates, ctx, seq([0.5, 0.0]))?.lane).toBe('familiar');
    expect(pickScored(candidates, ctx, seq([0.9, 0.0]))?.lane).toBe('wild');
  });

  it('picks uniformly by index in the wild lane, ignoring scores', () => {
    const heavy = article({ id: 'heavy', title: 'New chips promise faster inference speeds' });
    const light = article({ id: 'light', sourceId: 'unknown-source', title: 'Obscure note' });
    const ctx = baseCtx();
    // Only familiar (.4) and wild (.1) exist; rng 0.9 rolls wild, and the
    // second value indexes into it regardless of the score gap.
    const picked = pickScored([heavy, light], ctx, seq([0.9, 0.9]));
    expect(picked?.lane).toBe('wild');
    expect(picked?.article.id).toBe('light');
  });

  it('always returns the lone candidate', () => {
    const picked = pickScored([familiar], baseCtx(), seq([0.99, 0.99]));
    expect(picked?.article.id).toBe('fam');
  });
});

describe('makeScoringContext', () => {
  it('accumulates affinity across repeated reads', () => {
    const ctx = makeScoringContext({
      now: NOW,
      tagBySource: TAGS,
      recentSourceIds: [],
      reads: [{ sourceId: 'techcrunch' }, { sourceId: 'techcrunch' }],
    });
    expect(ctx.tagAffinity).toMatchObject({ technology: 2, tech: 2, news: 2 });
    expect(ctx.sourceAffinity).toMatchObject({ techcrunch: 2 });
    expect(ctx.maxTagAffinity).toBe(2);
  });

  it('defaults empty signals to zeroed affinity and live clock', () => {
    const before = Date.now();
    const ctx = makeScoringContext({ tagBySource: TAGS, recentSourceIds: [] });
    expect(ctx.tagAffinity).toEqual({});
    expect(ctx.sourceAffinity).toEqual({});
    expect(ctx.maxTagAffinity).toBe(0);
    expect(ctx.maxSourceAffinity).toBe(0);
    expect(ctx.starredTokenSets).toEqual([]);
    expect(ctx.sourceCounts).toEqual({});
    expect(ctx.now).toBeGreaterThanOrEqual(before);
    expect(ctx.now).toBeLessThanOrEqual(Date.now());
  });

  it('tolerates reads and stars from unknown sources', () => {
    const ctx = makeScoringContext({
      now: NOW,
      tagBySource: TAGS,
      recentSourceIds: [],
      reads: [{ sourceId: 'ghost' }],
      stars: [{ sourceId: 'ghost', title: 'Some ghost story' }],
    });
    expect(ctx.tagAffinity).toEqual({});
    expect(ctx.sourceAffinity).toEqual({ ghost: 4 });
    expect(ctx.maxTagAffinity).toBe(0);
  });
  it('weighs stars 3x and exposes maxima plus starred tokens', () => {
    const ctx = makeScoringContext({
      now: NOW,
      tagBySource: TAGS,
      recentSourceIds: [],
      reads: [{ sourceId: 'techcrunch' }],
      stars: [{ sourceId: 'bonappetit', title: 'Butter garlic pasta recipe' }],
    });
    expect(ctx.tagAffinity).toMatchObject({ technology: 1, food: 3, cooking: 3 });
    expect(ctx.sourceAffinity).toMatchObject({ techcrunch: 1, bonappetit: 3 });
    expect(ctx.maxTagAffinity).toBe(3);
    expect(ctx.maxSourceAffinity).toBe(3);
    expect(ctx.starredTokenSets).toEqual([['butter', 'garlic', 'pasta', 'recipe']]);
  });
});

describe('discovery presets', () => {
  const candidates = [
    article({ id: 'fam', title: 'New chips promise faster inference speeds' }),
    article({
      id: 'unf',
      sourceId: 'bonappetit',
      title: 'Butter garlic pasta recipe for weeknights',
    }),
    article({
      id: 'old',
      title: 'Classic essay on the craft of programming tools',
      publishedAt: NOW - 30 * DAY_MS,
    }),
  ];

  it('selects the preset by flag and both mixes sum to one', () => {
    expect(presetFor(false)).toBe(BALANCED_PRESET);
    expect(presetFor(true)).toBe(EXPLORER_PRESET);
    for (const preset of [BALANCED_PRESET, EXPLORER_PRESET]) {
      const total = Object.values(preset.mix).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1);
    }
  });

  it('routes the same roll differently under explorer shares', () => {
    const ctx = baseCtx();
    // rng 0.25 lands familiar in balanced (.25 < .4) but unfamiliar in
    // explorer (.25 - .2 familiar share = .05, inside unfamiliar's .4).
    expect(pickScored(candidates, ctx, seq([0.25, 0.0]))?.lane).toBe('familiar');
    expect(pickScored(candidates, ctx, seq([0.25, 0.0]), EXPLORER_PRESET)?.lane).toBe('unfamiliar');
    // Explorer doubles the wild share: rng 0.9 still lands wild here.
    expect(pickScored(candidates, ctx, seq([0.9, 0.0]), EXPLORER_PRESET)?.lane).toBe('wild');
  });

  it('applies custom weights to the total', () => {
    const ctx = baseCtx();
    const scored = scoreArticle(article({ id: 'w' }), ctx);
    const custom = scoreArticle(article({ id: 'w' }), ctx, {
      freshness: 0,
      source: 0,
      topic: 0,
      history: 0,
      unseen: 2,
    });
    expect(custom.total).toBeCloseTo(2 * scored.unseen);
  });
});
