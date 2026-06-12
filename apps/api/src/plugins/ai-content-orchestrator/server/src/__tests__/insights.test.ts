import { describe, expect, it, vi, afterEach } from 'vitest';

import {
  CONTENT_PERFORMANCE_SNAPSHOT_UID,
  CONTENT_UIDS,
  EDITORIAL_MEMORY_UID,
  GROWTH_EXPERIMENT_UID,
  PLUGIN_ID,
  RUN_LOG_UID,
  TRAFFIC_SNAPSHOT_UID,
} from '../constants';
import insightsEngine, {
  computeBestPublishHours,
  computeContentInsights,
  computeTrafficInsights,
  detectRepeatedRunFailures,
  isInsightsEnabled,
  PERFORMANCE_INSIGHT_MEMORY_KEY,
  SYSTEM_HEALTH_MEMORY_KEY,
} from '../services/insights-engine';
import experimentAgent, {
  bonferroniZCritical,
  EXPERIMENT_Z_CRITICAL_95,
  twoProportionZTest,
} from '../services/experiment-agent';
import strategyPlanner, { EMPTY_INSIGHT_BIAS } from '../services/strategy-planner';
import type { Strapi } from '../types';

const createStrapi = (
  services: Record<string, unknown>,
  entityService: Record<string, unknown>,
  storeState: Record<string, Record<string, unknown>> = {}
): Strapi =>
  ({
    entityService,
    plugin: (id: string) => {
      if (id !== PLUGIN_ID) {
        throw new Error(`Unexpected plugin ${id}`);
      }

      return {
        service: (name: string) => services[name],
      };
    },
    store: ({ key }: { key: string }) => ({
      get: async () => storeState[key] ?? null,
      set: async ({ value }: { value: Record<string, unknown> }) => {
        storeState[key] = value;
      },
    }),
    log: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  }) as unknown as Strapi;

const snapshot = (input: {
  day: string;
  slug: string;
  title?: string;
  entryId?: number;
  views?: number;
  score?: number;
  cta?: number;
}) => ({
  id: Math.floor(Math.random() * 100000),
  unique_key: `${input.slug}:${input.day}`,
  snapshot_day: input.day,
  content_uid: CONTENT_UIDS.article,
  content_entry_id: input.entryId ?? 1,
  content_slug: input.slug,
  content_title: input.title ?? input.slug,
  views: input.views ?? 0,
  cta_clicks: input.cta ?? 0,
  checkout_events: 0,
  premium_events: 0,
  score: input.score ?? 0,
});

describe('insights-engine computations', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves enablement from AICO_INSIGHTS_ENABLED with workflows fallback', () => {
    expect(isInsightsEnabled({ AICO_INSIGHTS_ENABLED: 'true' } as NodeJS.ProcessEnv)).toBe(true);
    expect(
      isInsightsEnabled({
        AICO_INSIGHTS_ENABLED: 'false',
        AICO_ENABLE_WORKFLOWS: 'true',
      } as NodeJS.ProcessEnv)
    ).toBe(false);
    expect(isInsightsEnabled({ AICO_ENABLE_WORKFLOWS: 'true' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isInsightsEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it('computes top, bottom and trending content from fixture snapshots', () => {
    const snapshots = [
      snapshot({ day: '2026-06-01', slug: 'mocny-temat', views: 10, score: 30 }),
      snapshot({ day: '2026-06-08', slug: 'mocny-temat', views: 40, score: 50 }),
      snapshot({ day: '2026-06-01', slug: 'slaby-temat', views: 0, score: 0 }),
      snapshot({ day: '2026-06-08', slug: 'slaby-temat', views: 0, score: 0 }),
      snapshot({ day: '2026-06-01', slug: 'spadajacy-temat', views: 50, score: 20 }),
      snapshot({ day: '2026-06-08', slug: 'spadajacy-temat', views: 5, score: 5 }),
    ];

    const insights = computeContentInsights(snapshots);

    expect(insights.topContent[0]?.key).toBe('mocny-temat');
    expect(insights.topContent[0]?.scorePerDay).toBe(40);
    expect(insights.bottomContent.map((entry) => entry.key)).toContain('slaby-temat');
    expect(insights.trendingTopics.map((entry) => entry.key)).toEqual(['mocny-temat']);
    expect(insights.trendingTopics[0]?.viewsGrowth).toBe(30);
  });

  it('computes channel effectiveness and best weekdays from traffic snapshots', () => {
    const traffic = computeTrafficInsights([
      {
        id: 1,
        unique_key: 'ga4:1:2026-06-08',
        snapshot_day: '2026-06-08', // poniedziałek
        source: 'ga4',
        views: 90,
        social_engagements: 5,
      },
      {
        id: 2,
        unique_key: 'social:2026-06-06',
        snapshot_day: '2026-06-06', // sobota
        source: 'social',
        views: 10,
        social_engagements: 20,
        ad_clicks: 3,
      },
    ]);

    expect(traffic.organicViews).toBe(90);
    expect(traffic.socialEngagements).toBe(25);
    expect(traffic.adClicks).toBe(3);
    expect(traffic.bestWeekdays[0]).toBe('poniedziałek');
    expect(traffic.channelRecommendation).toBe('invest_organic');
  });

  it('prefers ga4 over first_party for the same day (no double count, fix #5)', () => {
    const traffic = computeTrafficInsights([
      {
        id: 1,
        unique_key: 'ga4:2026-06-08',
        snapshot_day: '2026-06-08',
        source: 'ga4',
        views: 100,
      },
      {
        id: 2,
        unique_key: 'fp:2026-06-08',
        snapshot_day: '2026-06-08',
        source: 'first_party',
        views: 100,
      },
    ]);

    // Bez precedencji dałoby 200 (podwójne liczenie); z precedencją ga4 → 100.
    expect(traffic.organicViews).toBe(100);
  });

  it('ignores a daily organic outlier (>20x median) before it skews totals (fix #5)', () => {
    const baseline = Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      unique_key: `fp:2026-06-0${index + 1}`,
      snapshot_day: `2026-06-0${index + 1}`,
      source: 'first_party' as const,
      views: 100,
    }));
    const withSpike = [
      ...baseline,
      {
        id: 99,
        unique_key: 'fp:2026-06-09',
        snapshot_day: '2026-06-09',
        source: 'first_party' as const,
        views: 100_000, // 1000x mediany — outlier
      },
    ];

    const traffic = computeTrafficInsights(withSpike);
    // Outlier pominięty: suma to tylko 6 dni po 100.
    expect(traffic.organicViews).toBe(600);
  });

  it('finds best publish hours from view events with deterministic fallback', () => {
    const events = [
      { id: 1, event_type: 'view_item', occurred_at: '2026-06-10T18:10:00.000Z' },
      { id: 2, event_type: 'view_item', occurred_at: '2026-06-11T18:40:00.000Z' },
      { id: 3, event_type: 'premium_content_view', occurred_at: '2026-06-11T07:00:00.000Z' },
      { id: 4, event_type: 'premium_cta_click', occurred_at: '2026-06-11T03:00:00.000Z' },
    ];

    expect(computeBestPublishHours(events)).toEqual([18, 7]);
    expect(computeBestPublishHours([])).toEqual([8]);
    expect(computeBestPublishHours([], [9, 17])).toEqual([9, 17]);
  });

  it('detects repeated step failures in run logs', () => {
    const failedStepRun = {
      id: 1,
      run_type: 'generate' as const,
      status: 'failed' as const,
      started_at: '2026-06-10T10:00:00.000Z',
      details: { steps: [{ id: 'generate', status: 'failed' }] },
    };

    const issues = detectRepeatedRunFailures([
      failedStepRun,
      { ...failedStepRun, id: 2 },
      { ...failedStepRun, id: 3 },
      {
        id: 4,
        run_type: 'generate' as const,
        status: 'success' as const,
        started_at: '2026-06-10T11:00:00.000Z',
        details: { steps: [{ id: 'generate', status: 'success' }] },
      },
    ]);

    expect(issues).toEqual([{ step: 'generate', failures: 3 }]);
    expect(detectRepeatedRunFailures([failedStepRun, { ...failedStepRun, id: 2 }])).toEqual([]);
  });
});

describe('insights-engine daily tick', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const createEntityService = (memories: Array<Record<string, unknown>> = []) => {
    const created: Array<{ uid: string; data: Record<string, unknown> }> = [];
    const updated: Array<{ uid: string; id: unknown; data: Record<string, unknown> }> = [];

    const entityService = {
      findMany: vi.fn(async (uid: string, params: Record<string, unknown> = {}) => {
        if (uid === EDITORIAL_MEMORY_UID) {
          const filters = (params.filters ?? {}) as { key?: string };
          return filters.key
            ? memories.filter((memory) => memory.key === filters.key)
            : memories;
        }
        if (uid === CONTENT_PERFORMANCE_SNAPSHOT_UID) {
          return [
            snapshot({ day: '2026-06-01', slug: 'temat-a', views: 5, score: 10 }),
            snapshot({ day: '2026-06-10', slug: 'temat-a', views: 25, score: 40 }),
          ];
        }
        if (uid === TRAFFIC_SNAPSHOT_UID || uid === CONTENT_UIDS.analyticsEvent) {
          return [];
        }
        if (uid === RUN_LOG_UID) {
          const failed = {
            status: 'failed',
            details: { steps: [{ id: 'seo_guardrails', status: 'failed' }] },
          };
          return [
            { id: 1, ...failed },
            { id: 2, ...failed },
            { id: 3, ...failed },
          ];
        }
        return [];
      }),
      create: vi.fn(async (uid: string, params: { data: Record<string, unknown> }) => {
        created.push({ uid, data: params.data });
        const row = { id: created.length + 100, ...params.data };
        if (uid === EDITORIAL_MEMORY_UID) {
          memories.push(row);
        }
        return row;
      }),
      update: vi.fn(async (uid: string, id: unknown, params: { data: Record<string, unknown> }) => {
        updated.push({ uid, id, data: params.data });
        return { id, ...params.data };
      }),
    };

    return { entityService, created, updated };
  };

  it('throttles to one run per day and writes insight + health memories', async () => {
    vi.stubEnv('AICO_INSIGHTS_ENABLED', 'true');

    const auditRecords: Array<Record<string, unknown>> = [];
    const { entityService, created } = createEntityService();
    const storeState: Record<string, Record<string, unknown>> = {};
    const strapi = createStrapi(
      {
        'audit-trail': { record: async (input: Record<string, unknown>) => auditRecords.push(input) },
      },
      entityService,
      storeState
    );

    const service = insightsEngine({ strapi });
    const now = new Date('2026-06-12T06:00:00.000Z');

    const first = (await service.runDailyTick({ now })) as Record<string, unknown>;
    expect(first.skipped).toBe(false);

    const keys = created.map((entry) => entry.data.key);
    expect(keys).toContain(PERFORMANCE_INSIGHT_MEMORY_KEY);
    expect(keys).toContain(SYSTEM_HEALTH_MEMORY_KEY);

    const healthEntry = created.find((entry) => entry.data.key === SYSTEM_HEALTH_MEMORY_KEY);
    expect((healthEntry?.data.metadata as Record<string, unknown>).kind).toBe('system_health');
    expect(
      auditRecords.some(
        (event) => event.action === 'insights.health.warning' && event.severity === 'warn'
      )
    ).toBe(true);
    expect(auditRecords.some((event) => event.action === 'insights.run')).toBe(true);

    const second = (await service.runDailyTick({ now })) as Record<string, unknown>;
    expect(second).toMatchObject({ skipped: true, reason: 'already_ran_today' });

    const nextDay = (await service.runDailyTick({
      now: new Date('2026-06-13T06:00:00.000Z'),
    })) as Record<string, unknown>;
    expect(nextDay.skipped).toBe(false);
  });

  it('skips the tick when the runtime lock is held by another instance', async () => {
    vi.stubEnv('AICO_INSIGHTS_ENABLED', 'true');

    const { entityService } = createEntityService();
    const withLock = vi.fn(async () => undefined); // lock niedostępny
    const strapi = createStrapi(
      { 'runtime-locks': { withLock } },
      entityService,
      {}
    );

    const service = insightsEngine({ strapi });
    const result = (await service.runDailyTick({
      now: new Date('2026-06-12T06:00:00.000Z'),
    })) as Record<string, unknown>;

    expect(result).toMatchObject({ skipped: true, reason: 'lock_held', day: '2026-06-12' });
    expect(withLock).toHaveBeenCalledWith(
      'insights.daily',
      expect.objectContaining({ ttlMs: expect.any(Number) }),
      expect.any(Function)
    );
    // Ciężka praca nie wystartowała.
    expect(entityService.create).not.toHaveBeenCalled();
  });

  it('runs the tick under the runtime lock when acquired', async () => {
    vi.stubEnv('AICO_INSIGHTS_ENABLED', 'true');

    const { entityService, created } = createEntityService();
    const withLock = vi.fn(
      async (_key: string, _input: unknown, runner: () => Promise<unknown>) => runner()
    );
    const strapi = createStrapi(
      {
        'runtime-locks': { withLock },
        'audit-trail': { record: async () => undefined },
      },
      entityService,
      {}
    );

    const service = insightsEngine({ strapi });
    const result = (await service.runDailyTick({
      now: new Date('2026-06-12T06:00:00.000Z'),
    })) as Record<string, unknown>;

    expect(result.skipped).toBe(false);
    expect(withLock).toHaveBeenCalledTimes(1);
    expect(created.map((entry) => entry.data.key)).toContain(PERFORMANCE_INSIGHT_MEMORY_KEY);
  });

  it('skips entirely when insights are disabled', async () => {
    vi.stubEnv('AICO_INSIGHTS_ENABLED', 'false');

    const { entityService } = createEntityService();
    const service = insightsEngine({ strapi: createStrapi({}, entityService) });

    const result = (await service.runDailyTick({
      now: new Date('2026-06-12T06:00:00.000Z'),
    })) as Record<string, unknown>;

    expect(result).toMatchObject({ skipped: true, reason: 'insights_disabled' });
    expect(entityService.findMany).not.toHaveBeenCalled();
  });
});

describe('strategy planner insight bias', () => {
  it('reads fresh performance insight memory into a deterministic bias', async () => {
    const memory = {
      id: 7,
      key: 'insight:performance',
      active: true,
      metadata: {
        kind: 'performance_insight',
        validUntil: '2099-01-01T00:00:00.000Z',
        trendingTopics: [{ key: 'temat-a', title: 'Temat A' }],
        bottomContent: [{ key: 'temat-b', title: 'Temat B' }],
        bestPublishHours: [18, 7],
      },
    };
    const entityService = {
      findMany: vi.fn(async () => [memory]),
    };

    const planner = strategyPlanner({ strapi: createStrapi({}, entityService) });
    const bias = await planner.resolveInsightBias(new Date('2026-06-12T00:00:00.000Z'));

    expect(bias).toEqual({
      trendingTitles: ['Temat A'],
      underperforming: ['Temat B'],
      bestHours: [18, 7],
    });
  });

  it('returns empty bias for stale or missing insight memory', async () => {
    const stale = {
      id: 8,
      key: 'insight:performance',
      active: true,
      metadata: {
        kind: 'performance_insight',
        validUntil: '2020-01-01T00:00:00.000Z',
        trendingTopics: [{ title: 'Stary temat' }],
      },
    };
    const planner = strategyPlanner({
      strapi: createStrapi({}, { findMany: vi.fn(async () => [stale]) }),
    });

    expect(await planner.resolveInsightBias(new Date('2026-06-12T00:00:00.000Z'))).toEqual(
      EMPTY_INSIGHT_BIAS
    );

    const plannerEmpty = strategyPlanner({
      strapi: createStrapi({}, { findMany: vi.fn(async () => []) }),
    });
    expect(await plannerEmpty.resolveInsightBias()).toEqual(EMPTY_INSIGHT_BIAS);
  });

  it('rejects insight memory with missing or unparseable validUntil (fix #6)', async () => {
    const now = new Date('2026-06-12T00:00:00.000Z');

    const corrupt = {
      id: 9,
      key: 'insight:performance',
      active: true,
      metadata: {
        kind: 'performance_insight',
        validUntil: 'not-a-date',
        trendingTopics: [{ title: 'Uszkodzony temat' }],
      },
    };
    const plannerCorrupt = strategyPlanner({
      strapi: createStrapi({}, { findMany: vi.fn(async () => [corrupt]) }),
    });
    expect(await plannerCorrupt.resolveInsightBias(now)).toEqual(EMPTY_INSIGHT_BIAS);

    const missing = {
      id: 10,
      key: 'insight:performance',
      active: true,
      metadata: {
        kind: 'performance_insight',
        trendingTopics: [{ title: 'Bez daty' }],
      },
    };
    const plannerMissing = strategyPlanner({
      strapi: createStrapi({}, { findMany: vi.fn(async () => [missing]) }),
    });
    expect(await plannerMissing.resolveInsightBias(now)).toEqual(EMPTY_INSIGHT_BIAS);
  });

  it('treats missing or unparseable validUntil as stale insight', async () => {
    const withoutValidUntil = {
      id: 9,
      key: 'insight:performance',
      active: true,
      metadata: {
        kind: 'performance_insight',
        trendingTopics: [{ title: 'Temat bez daty' }],
      },
    };
    const planner = strategyPlanner({
      strapi: createStrapi({}, { findMany: vi.fn(async () => [withoutValidUntil]) }),
    });
    expect(await planner.resolveInsightBias(new Date('2026-06-12T00:00:00.000Z'))).toEqual(
      EMPTY_INSIGHT_BIAS
    );

    const unparseable = {
      ...withoutValidUntil,
      id: 10,
      metadata: { ...withoutValidUntil.metadata, validUntil: 'nie-data' },
    };
    const plannerUnparseable = strategyPlanner({
      strapi: createStrapi({}, { findMany: vi.fn(async () => [unparseable]) }),
    });
    expect(
      await plannerUnparseable.resolveInsightBias(new Date('2026-06-12T00:00:00.000Z'))
    ).toEqual(EMPTY_INSIGHT_BIAS);
  });

  it('biases candidates toward trending topics, best hours and away from weak content', () => {
    const planner = strategyPlanner({ strapi: createStrapi({}, {}) });

    const candidates = planner.buildCandidates({
      workflows: [],
      categories: [{ id: 1, name: 'Astrologia' }],
      weekStart: '2026-06-12',
      limit: 2,
      performanceHints: ['Słaby temat', 'Dobry temat'],
      insightBias: {
        trendingTitles: ['Rosnący temat'],
        underperforming: ['Słaby temat'],
        bestHours: [18],
      },
      trigger: 'test',
    });

    expect(candidates[0].title).toBe('Co dalej po temacie: Rosnący temat');
    expect(candidates[0].priority_score).toBe(100);
    expect(String(candidates[0].target_publish_at)).toContain('T18:00:00');
    expect(
      candidates.every((candidate) => candidate.title !== 'Co dalej po temacie: Słaby temat')
    ).toBe(true);
    expect(candidates[1].title).toBe('Co dalej po temacie: Dobry temat');
  });

  it('keeps the deterministic fallback when no insights exist', () => {
    const planner = strategyPlanner({ strapi: createStrapi({}, {}) });

    const candidates = planner.buildCandidates({
      workflows: [],
      categories: [{ id: 1, name: 'Astrologia' }],
      weekStart: '2026-06-12',
      limit: 1,
      performanceHints: [],
      trigger: 'test',
    });

    expect(candidates[0].title).toBe('Astrologia: astrologiczny przewodnik na 2026-06-12');
    expect(String(candidates[0].target_publish_at)).toContain('T08:00:00');
    expect(candidates[0].priority_score).toBe(90);
  });
});

describe('experiment agent evaluation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('computes a correct two-proportion z-test for known values', () => {
    // p1 = 60/200 = 0.30, p2 = 40/200 = 0.20 → z ≈ 2.3094 (istotny przy 95%).
    const significant = twoProportionZTest({
      aSuccesses: 60,
      aTrials: 200,
      bSuccesses: 40,
      bTrials: 200,
    });
    expect(significant.z).toBeCloseTo(2.3094, 3);
    expect(significant.significant).toBe(true);
    expect(significant.winner).toBe('a');

    const equal = twoProportionZTest({
      aSuccesses: 50,
      aTrials: 500,
      bSuccesses: 50,
      bTrials: 500,
    });
    expect(equal.z).toBe(0);
    expect(equal.significant).toBe(false);
    expect(equal.winner).toBeNull();

    expect(twoProportionZTest({ aSuccesses: 0, aTrials: 0, bSuccesses: 1, bTrials: 10 })).toEqual({
      z: 0,
      significant: false,
      winner: null,
    });
  });

  it('clamps successes to [0, trials] so proportions can never exceed 1 (fix #1)', () => {
    // successes > trials (np. zliczone CTA > views) — bez clampu pA > 1 wypaczałoby z.
    const clamped = twoProportionZTest({
      aSuccesses: 300,
      aTrials: 200,
      bSuccesses: 200,
      bTrials: 200,
    });
    // Po clampie oba sukcesy = trials → pA = pB = 1 → brak różnicy → z = 0.
    expect(clamped.z).toBe(0);
    expect(clamped.significant).toBe(false);

    const negative = twoProportionZTest({
      aSuccesses: -50,
      aTrials: 100,
      bSuccesses: 10,
      bTrials: 100,
    });
    expect(Number.isFinite(negative.z)).toBe(true);
  });

  it('applies Bonferroni tightening for >2 variants only (fix #3)', () => {
    // 2 warianty (1 porównanie) = klasyczne 1.96.
    expect(bonferroniZCritical(1)).toBe(EXPERIMENT_Z_CRITICAL_95);
    // 3 warianty = 3 porównania par → zaostrzony próg z (> 1.96).
    const z3 = bonferroniZCritical(3);
    expect(z3).toBeGreaterThan(EXPERIMENT_Z_CRITICAL_95);
    // Więcej porównań = jeszcze ostrzejszy próg.
    expect(bonferroniZCritical(6)).toBeGreaterThan(z3);
  });

  const experimentFixture = {
    id: 11,
    name: 'Tytuły CTA',
    experiment_type: 'content_title' as const,
    status: 'running' as const,
    primary_metric: 'premium_cta_click',
    started_at: '2026-06-01T00:00:00.000Z',
    variants: [
      { key: 'a', content_slug: 'wariant-a' },
      { key: 'b', content_slug: 'wariant-b' },
    ],
  };

  const variantSnapshots = [
    snapshot({ day: '2026-06-05', slug: 'wariant-a', views: 200, cta: 60 }),
    snapshot({ day: '2026-06-05', slug: 'wariant-b', views: 200, cta: 40 }),
  ];

  const createExperimentEnv = (
    snapshots: Array<Record<string, unknown>> = variantSnapshots,
    experiment: Record<string, unknown> = experimentFixture
  ) => {
    const updates: Array<{ uid: string; id: unknown; data: Record<string, unknown> }> = [];
    const created: Array<{ uid: string; data: Record<string, unknown> }> = [];
    const auditRecords: Array<Record<string, unknown>> = [];

    const entityService = {
      findMany: vi.fn(async (uid: string, _params?: Record<string, unknown>) => {
        if (uid === GROWTH_EXPERIMENT_UID) return [experiment];
        if (uid === CONTENT_PERFORMANCE_SNAPSHOT_UID) return snapshots;
        if (uid === EDITORIAL_MEMORY_UID) return [];
        return [];
      }),
      update: vi.fn(async (uid: string, id: unknown, params: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: params.data });
        return { id, ...params.data };
      }),
      create: vi.fn(async (uid: string, params: { data: Record<string, unknown> }) => {
        created.push({ uid, data: params.data });
        return { id: 999, ...params.data };
      }),
    };

    const strapi = createStrapi(
      {
        'audit-trail': { record: async (input: Record<string, unknown>) => auditRecords.push(input) },
      },
      entityService
    );

    return { agent: experimentAgent({ strapi }), entityService, updates, created, auditRecords };
  };

  it('marks a significant winner as recommendation only without auto-approve', async () => {
    vi.stubEnv('AICO_STRATEGY_AUTO_APPROVE_PLAN', 'false');
    const { agent, updates, created, auditRecords } = createExperimentEnv();

    const result = await agent.evaluate({ now: new Date('2026-06-12T00:00:00.000Z') });

    expect(result.evaluated).toBe(1);
    expect(result.decided).toBe(1);
    expect(result.results[0]).toMatchObject({
      outcome: 'winner',
      winnerVariantKey: 'a',
      loserVariantKey: 'b',
      applied: false,
    });

    const experimentUpdate = updates.find((entry) => entry.uid === GROWTH_EXPERIMENT_UID);
    expect(experimentUpdate?.data.status).toBeUndefined();
    expect(
      (experimentUpdate?.data.decision as Record<string, unknown>).recommendedWinner
    ).toBe('a');

    const memory = created.find((entry) => entry.uid === EDITORIAL_MEMORY_UID);
    expect(memory?.data.key).toBe('experiment:11:decision');
    expect(auditRecords.some((event) => event.action === 'experiment.evaluate')).toBe(true);
  });

  it('auto-applies the winner when AICO_STRATEGY_AUTO_APPROVE_PLAN=true', async () => {
    vi.stubEnv('AICO_STRATEGY_AUTO_APPROVE_PLAN', 'true');
    const { agent, updates } = createExperimentEnv();

    const result = await agent.evaluate({ now: new Date('2026-06-12T00:00:00.000Z') });

    expect(result.results[0]).toMatchObject({ outcome: 'winner', applied: true });
    const experimentUpdate = updates.find((entry) => entry.uid === GROWTH_EXPERIMENT_UID);
    expect(experimentUpdate?.data.status).toBe('completed');
    expect(experimentUpdate?.data.winner_variant_key).toBe('a');
  });

  it('clamps successes above trials in the z-test instead of producing p > 1', () => {
    const clamped = twoProportionZTest({
      aSuccesses: 500, // > prób → clamp do 200
      aTrials: 200,
      bSuccesses: 200,
      bTrials: 200,
    });
    // Po clampie obie proporcje = 1.0 → brak różnicy, brak zwycięzcy.
    expect(clamped.z).toBe(0);
    expect(clamped.significant).toBe(false);
    expect(clamped.winner).toBeNull();
  });

  it('returns invalid_metrics and never auto-applies when successes exceed views', async () => {
    vi.stubEnv('AICO_STRATEGY_AUTO_APPROVE_PLAN', 'true');
    const { agent, updates } = createExperimentEnv([
      snapshot({ day: '2026-06-05', slug: 'wariant-a', views: 200, cta: 999 }),
      snapshot({ day: '2026-06-05', slug: 'wariant-b', views: 200, cta: 40 }),
    ]);

    const result = await agent.evaluate({ now: new Date('2026-06-12T00:00:00.000Z') });

    expect(result.decided).toBe(0);
    expect(result.results[0]).toMatchObject({
      outcome: 'inconclusive',
      reason: 'invalid_metrics',
      applied: false,
    });
    expect(updates.filter((entry) => entry.uid === GROWTH_EXPERIMENT_UID)).toHaveLength(0);
  });

  it('returns inconclusive without a decision when started_at is missing', async () => {
    vi.stubEnv('AICO_STRATEGY_AUTO_APPROVE_PLAN', 'true');
    const { agent, updates, entityService, auditRecords } = createExperimentEnv(variantSnapshots, {
      ...experimentFixture,
      started_at: null,
    });

    const result = await agent.evaluate({ now: new Date('2026-06-12T00:00:00.000Z') });

    expect(result.results[0]).toMatchObject({
      outcome: 'inconclusive',
      reason: 'missing_started_at',
      applied: false,
    });
    expect(updates.filter((entry) => entry.uid === GROWTH_EXPERIMENT_UID)).toHaveLength(0);
    // Bez started_at nie wolno skanować snapshotów.
    expect(
      entityService.findMany.mock.calls.some(
        (call) => call[0] === CONTENT_PERFORMANCE_SNAPSHOT_UID
      )
    ).toBe(false);
    // Ślad audytowy o pominięciu ewaluacji (fix #2).
    expect(
      auditRecords.some((event) => event.action === 'experiment.evaluate.skipped_no_start')
    ).toBe(true);
  });

  it('filters snapshots by experiment variants with deterministic sort and limit', async () => {
    vi.stubEnv('AICO_STRATEGY_AUTO_APPROVE_PLAN', 'false');
    const { agent, entityService } = createExperimentEnv();

    await agent.evaluate({ now: new Date('2026-06-12T00:00:00.000Z') });

    const snapshotCall = entityService.findMany.mock.calls.find(
      (call) => call[0] === CONTENT_PERFORMANCE_SNAPSHOT_UID
    );
    expect(snapshotCall?.[1]).toMatchObject({
      filters: {
        snapshot_day: { $gte: '2026-06-01' },
        $or: [{ content_slug: { $in: ['wariant-a', 'wariant-b'] } }],
      },
      sort: [{ snapshot_day: 'asc' }],
      limit: 2000,
    });
  });

  it('returns insufficient sample below the minimum size and leaves the experiment running', async () => {
    vi.stubEnv('AICO_STRATEGY_AUTO_APPROVE_PLAN', 'true');
    const { agent, updates } = createExperimentEnv();

    const result = await agent.evaluate({
      now: new Date('2026-06-12T00:00:00.000Z'),
      minSampleSize: 500,
    });

    expect(result.results[0]).toMatchObject({ outcome: 'insufficient_sample', applied: false });
    expect(updates.filter((entry) => entry.uid === GROWTH_EXPERIMENT_UID)).toHaveLength(0);
  });

  it('applies Bonferroni for >2 variants so a borderline winner becomes inconclusive (fix #3)', async () => {
    vi.stubEnv('AICO_STRATEGY_AUTO_APPROVE_PLAN', 'false');

    const threeVariantExperiment = {
      ...experimentFixture,
      variants: [
        { key: 'a', content_slug: 'wariant-a' },
        { key: 'b', content_slug: 'wariant-b' },
        { key: 'c', content_slug: 'wariant-c' },
      ],
    };

    // best vs runnerUp: 120/1000 vs 90/1000 → z ≈ 2.08 (istotne przy 95%/1.96),
    // ale poniżej progu Bonferroniego dla 3 porównań (~2.39) → inconclusive.
    const borderlineSnapshots = [
      snapshot({ day: '2026-06-05', slug: 'wariant-a', views: 1000, cta: 120 }),
      snapshot({ day: '2026-06-05', slug: 'wariant-b', views: 1000, cta: 90 }),
      snapshot({ day: '2026-06-05', slug: 'wariant-c', views: 1000, cta: 60 }),
    ];

    const { agent, updates } = createExperimentEnv(borderlineSnapshots, threeVariantExperiment);
    const result = await agent.evaluate({ now: new Date('2026-06-12T00:00:00.000Z') });

    expect(result.results[0]).toMatchObject({ outcome: 'inconclusive', applied: false });
    const decisionUpdate = updates.find((entry) => entry.uid === GROWTH_EXPERIMENT_UID);
    const decision = decisionUpdate?.data.decision as Record<string, unknown>;
    expect(decision.comparisons).toBe(3);
    expect(Number(decision.zCritical)).toBeGreaterThan(EXPERIMENT_Z_CRITICAL_95);
  });
});
