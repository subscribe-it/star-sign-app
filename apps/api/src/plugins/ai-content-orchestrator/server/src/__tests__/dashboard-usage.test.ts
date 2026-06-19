import { describe, expect, it, vi } from 'vitest';

import { PLUGIN_ID, USAGE_DAILY_UID } from '../constants';
import dashboard from '../services/dashboard';
import type { Strapi } from '../types';

// Buduje minimalne `strapi` z mockowanym entityService oraz mapą serwisów
// pluginu (jak w runtime.test.ts), żeby przetestować agregację "Budżet i
// zużycie (dziś)" w izolacji od bazy danych.
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

const buildAutonomyPolicyService = () => ({
  getPolicy: vi.fn(async () => ({
    id: 1,
    policy_key: 'global',
    autonomy_mode: 'guarded',
    daily_llm_request_limit: 120,
    daily_media_job_limit: 20,
    daily_ads_budget_pln: 25,
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

describe('dashboard.getTodayUsageSummary', () => {
  it('reports LLM requests from autonomy counts and tokens summed from usage-daily', async () => {
    const autonomyPolicy = buildAutonomyPolicyService();
    const findMany = vi.fn(async (uid: string, _params?: Record<string, unknown>) => {
      expect(uid).toBe(USAGE_DAILY_UID);
      return [
        { request_count: 3, total_tokens: 1200 },
        { request_count: 2, total_tokens: 800 },
      ];
    });

    const strapi = createStrapi(
      { 'autonomy-policy': autonomyPolicy },
      { findMany, count: vi.fn(async () => 0) }
    );

    const usage = await dashboard({ strapi }).getTodayUsageSummary();

    // requests pochodzi z counts.llmRequestsToday (ten sam licznik, który bramka
    // autonomy-policy porównuje z capem) — NIE z sumy request_count w usage-daily
    // (która dałaby 5). tokens nadal sumowane z usage-daily (1200 + 800).
    expect(usage).toEqual({
      llm: { requests: 7, tokens: 2000, requestsCap: 120 },
      media: { jobsToday: 5, cap: 20 },
      ads: { spentPln: 12.5, capPln: 25 },
    });

    // Filtruje usage-daily po dzisiejszym dniu biznesowym (YYYY-MM-DD).
    const findManyArgs = findMany.mock.calls[0]?.[1] as { filters?: { day?: string } };
    expect(findManyArgs?.filters?.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(autonomyPolicy.getPolicy).toHaveBeenCalledTimes(1);
    expect(autonomyPolicy.getCounts).toHaveBeenCalledTimes(1);
  });

  it('keeps requests from counts and zeroes only the summed tokens when no usage-daily rows today', async () => {
    const autonomyPolicy = buildAutonomyPolicyService();
    const strapi = createStrapi(
      { 'autonomy-policy': autonomyPolicy },
      { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) }
    );

    const usage = await dashboard({ strapi }).getTodayUsageSummary();

    // Brak wierszy usage-daily zeruje tylko sumowane tokeny; requests nadal
    // pochodzi z counts.llmRequestsToday (7), spójnie z capem.
    expect(usage.llm.requests).toBe(7);
    expect(usage.llm.tokens).toBe(0);
    expect(usage.llm.requestsCap).toBe(120);
    expect(usage.media).toEqual({ jobsToday: 5, cap: 20 });
    expect(usage.ads).toEqual({ spentPln: 12.5, capPln: 25 });
  });

  it('exposes the usage summary inside getSummary()', async () => {
    const autonomyPolicy = buildAutonomyPolicyService();
    const strapi = createStrapi(
      { 'autonomy-policy': autonomyPolicy },
      {
        count: vi.fn(async () => 0),
        findMany: vi.fn(async (uid: string) =>
          uid === USAGE_DAILY_UID ? [{ request_count: 4, total_tokens: 999 }] : []
        ),
      }
    );

    const summary = await dashboard({ strapi }).getSummary();

    expect(summary.usage).toEqual({
      llm: { requests: 7, tokens: 999, requestsCap: 120 },
      media: { jobsToday: 5, cap: 20 },
      ads: { spentPln: 12.5, capPln: 25 },
    });
  });
});
