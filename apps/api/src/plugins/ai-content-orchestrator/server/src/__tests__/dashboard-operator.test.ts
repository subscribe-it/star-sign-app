import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CONTENT_PLAN_ITEM_UID,
  PLUGIN_ID,
  PUBLICATION_TICKET_UID,
  RUN_LOG_UID,
  TOPIC_QUEUE_UID,
} from '../constants';
import dashboard from '../services/dashboard';
import type { Strapi } from '../types';

// Buduje minimalne `strapi` z mockowanym entityService oraz mapą serwisów
// pluginu (jak w dashboard-usage.test.ts), żeby przetestować narrację
// operatorską "Co zrobił autopilot" w izolacji od bazy danych.
const createStrapi = (
  services: Record<string, unknown>,
  entityService: Record<string, unknown>
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
    log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  }) as unknown as Strapi;

const buildAutonomyPolicyService = (
  overrides: Record<string, unknown> = {}
) => ({
  getPolicy: vi.fn(async () => ({
    id: 1,
    policy_key: 'global',
    autonomy_mode: 'guarded',
    global_kill_switch: false,
    daily_llm_request_limit: 120,
    daily_media_job_limit: 20,
    daily_ads_budget_pln: 25,
    ...overrides,
  })),
  getCounts: vi.fn(async () => ({
    generationJobsToday: 0,
    llmRequestsToday: 7,
    mediaJobsToday: 5,
    videoJobsToday: 0,
    autoPublishesToday: 0,
    socialPostsToday: 0,
    adsMutationsToday: 0,
    adsSpendTodayPln: 12.5,
  })),
});

// Liczy `count` zależnie od UID i filtra statusu, żeby symulować realne dane:
//   run-log (generate) -> total/sukcesy/błędy/running
//   topic-queue (pending), content-plan-item (planned/approved/queued),
//   publication-ticket (scheduled).
const buildCount = (counts: {
  generatedTotal: number;
  successes: number;
  failures: number;
  running: number;
  pendingTopics: number;
  plannedItems: number;
  scheduledPublications: number;
}) =>
  vi.fn(async (uid: string, params?: { filters?: Record<string, unknown> }) => {
    const status = params?.filters?.status as string | undefined;
    if (uid === RUN_LOG_UID) {
      if (status === 'success') return counts.successes;
      if (status === 'failed') return counts.failures;
      if (status === 'running') return counts.running;
      return counts.generatedTotal;
    }
    if (uid === TOPIC_QUEUE_UID) return counts.pendingTopics;
    if (uid === CONTENT_PLAN_ITEM_UID) return counts.plannedItems;
    if (uid === PUBLICATION_TICKET_UID) return counts.scheduledPublications;
    return 0;
  });

describe('dashboard.getOperatorSummary', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.AICO_OPENROUTER_TOKEN;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('returns the operator narrative shape with today counts, spend and pipeline', async () => {
    process.env.AICO_OPENROUTER_TOKEN = 'test-token';
    const autonomyPolicy = buildAutonomyPolicyService();
    const count = buildCount({
      generatedTotal: 4,
      successes: 3,
      failures: 1,
      running: 0,
      pendingTopics: 2,
      plannedItems: 5,
      scheduledPublications: 1,
    });
    const findMany = vi.fn(async () => [{ request_count: 4, total_tokens: 999 }]);

    const strapi = createStrapi({ 'autonomy-policy': autonomyPolicy }, { count, findMany });
    const operator = await dashboard({ strapi }).getOperatorSummary();

    expect(operator.generated).toEqual({ total: 4, successes: 3, failures: 1, running: 0 });
    expect(operator.spend).toEqual({
      llm: { requests: 7, tokens: 999, requestsCap: 120 },
      media: { jobsToday: 5, cap: 20 },
      ads: { spentPln: 12.5, capPln: 25 },
    });
    expect(operator.pipeline).toEqual({
      pendingTopics: 2,
      plannedItems: 5,
      scheduledPublications: 1,
    });
    expect(operator.autonomy).toEqual({
      mode: 'guarded',
      modeLabel: 'Pod nadzorem',
      killSwitch: false,
      llmTokenConfigured: true,
    });
    expect(Array.isArray(operator.recommendations)).toBe(true);

    // Counts za dziś filtrują run-log po typie generate oraz po dacie startu.
    const generateCall = count.mock.calls.find(
      ([uid, params]) =>
        uid === RUN_LOG_UID &&
        (params as { filters?: { run_type?: string } })?.filters?.run_type === 'generate'
    );
    const filters = (generateCall?.[1] as { filters?: { started_at?: { $gte?: string } } })?.filters;
    expect(filters?.started_at?.$gte).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('recommends fixing the missing OpenRouter token when it is not configured', async () => {
    const autonomyPolicy = buildAutonomyPolicyService();
    const count = buildCount({
      generatedTotal: 0,
      successes: 0,
      failures: 0,
      running: 0,
      pendingTopics: 0,
      plannedItems: 0,
      scheduledPublications: 0,
    });

    const strapi = createStrapi(
      { 'autonomy-policy': autonomyPolicy },
      { count, findMany: vi.fn(async () => []) }
    );
    const operator = await dashboard({ strapi }).getOperatorSummary();

    expect(operator.autonomy.llmTokenConfigured).toBe(false);
    const keys = operator.recommendations.map((rec) => rec.key);
    expect(keys).toContain('openrouter-token-missing');
    expect(operator.recommendations.find((rec) => rec.key === 'openrouter-token-missing')?.tone).toBe(
      'danger'
    );
  });

  it('surfaces failures and queued topics as recommendations', async () => {
    process.env.AICO_OPENROUTER_TOKEN = 'test-token';
    const autonomyPolicy = buildAutonomyPolicyService();
    const count = buildCount({
      generatedTotal: 3,
      successes: 1,
      failures: 2,
      running: 0,
      pendingTopics: 1,
      plannedItems: 0,
      scheduledPublications: 0,
    });

    const strapi = createStrapi(
      { 'autonomy-policy': autonomyPolicy },
      { count, findMany: vi.fn(async () => []) }
    );
    const operator = await dashboard({ strapi }).getOperatorSummary();

    const keys = operator.recommendations.map((rec) => rec.key);
    expect(keys).toContain('generation-failures');
    expect(keys).toContain('topics-waiting');
    // Brak blokerów => brak "all-good" obok prawdziwych ostrzeżeń.
    expect(keys).not.toContain('all-good');
  });

  it('degrades gracefully to zeros and a neutral narrative when services/queries throw', async () => {
    process.env.AICO_OPENROUTER_TOKEN = 'test-token';
    const failingAutonomy = {
      getPolicy: vi.fn(async () => {
        throw new Error('policy unavailable');
      }),
      getCounts: vi.fn(async () => {
        throw new Error('counts unavailable');
      }),
    };
    const count = vi.fn(async () => {
      throw new Error('db down');
    });
    const findMany = vi.fn(async () => {
      throw new Error('db down');
    });

    const strapi = createStrapi({ 'autonomy-policy': failingAutonomy }, { count, findMany });
    const operator = await dashboard({ strapi }).getOperatorSummary();

    // Nie rzuca; wszystko zeruje się bezpiecznie.
    expect(operator.generated).toEqual({ total: 0, successes: 0, failures: 0, running: 0 });
    expect(operator.spend).toEqual({
      llm: { requests: 0, tokens: 0, requestsCap: 0 },
      media: { jobsToday: 0, cap: 0 },
      ads: { spentPln: 0, capPln: 0 },
    });
    expect(operator.pipeline).toEqual({
      pendingTopics: 0,
      plannedItems: 0,
      scheduledPublications: 0,
    });
    // Brak polityki => domyślny tryb "guarded".
    expect(operator.autonomy.mode).toBe('guarded');
    expect(operator.autonomy.killSwitch).toBe(false);
    expect(operator.recommendations.length).toBeGreaterThan(0);
  });

  it('warns about the global kill switch and draft_only mode', async () => {
    process.env.AICO_OPENROUTER_TOKEN = 'test-token';
    const autonomyPolicy = buildAutonomyPolicyService({
      autonomy_mode: 'draft_only',
      global_kill_switch: true,
    });
    const count = buildCount({
      generatedTotal: 0,
      successes: 0,
      failures: 0,
      running: 0,
      pendingTopics: 0,
      plannedItems: 0,
      scheduledPublications: 0,
    });

    const strapi = createStrapi(
      { 'autonomy-policy': autonomyPolicy },
      { count, findMany: vi.fn(async () => []) }
    );
    const operator = await dashboard({ strapi }).getOperatorSummary();

    expect(operator.autonomy.modeLabel).toBe('Tylko szkice');
    const keys = operator.recommendations.map((rec) => rec.key);
    expect(keys).toContain('kill-switch-on');
    expect(keys).toContain('autonomy-draft-only');
  });
});
