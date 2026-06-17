import { describe, it, expect } from 'vitest';

import { AUTONOMY_POLICY_UID } from '../constants';
import autonomyPolicy from '../services/autonomy-policy';
import type { Strapi } from '../types';

type Row = Record<string, unknown>;

const match = (row: Row, filters?: Record<string, unknown>): boolean => {
  if (!filters) return true;
  return Object.entries(filters).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && '$in' in (cond as Record<string, unknown>)) {
      return ((cond as { $in: unknown[] }).$in ?? []).includes(row[key]);
    }
    if (cond && typeof cond === 'object' && '$gte' in (cond as Record<string, unknown>)) {
      return String(row[key]) >= String((cond as { $gte: unknown }).$gte);
    }
    return row[key] === cond;
  });
};

const makeStrapi = () => {
  const store: Record<string, Row[]> = {};
  let id = 1;
  const entityService = {
    async findMany(uid: string, params: { filters?: Record<string, unknown> } = {}) {
      return (store[uid] ?? []).filter((r) => match(r, params.filters)).map((r) => ({ ...r }));
    },
    async create(uid: string, params: { data: Row }) {
      store[uid] = store[uid] ?? [];
      const row = { id: id++, ...params.data };
      store[uid].push(row);
      return { ...row };
    },
    async update(uid: string, rid: unknown, params: { data: Row }) {
      const row = (store[uid] ?? []).find((r) => r.id === rid);
      Object.assign(row ?? {}, params.data);
      return { ...(row ?? {}) };
    },
    async count(uid: string, params: { filters?: Record<string, unknown> } = {}) {
      return (store[uid] ?? []).filter((r) => match(r, params.filters)).length;
    },
  };
  const strapi = { entityService } as unknown as Strapi;
  return { strapi, store };
};

const seedPolicy = (store: Record<string, Row[]>, data: Row): void => {
  store[AUTONOMY_POLICY_UID] = [{ id: 1, policy_key: 'global', ...data }];
};

describe('autonomy-policy evaluate — critical/non-critical taxonomy (guarded != full)', () => {
  it('guarded BLOCKS high-impact live ads (> guarded_max_ads_impact_pct * global cap)', async () => {
    const { strapi, store } = makeStrapi();
    seedPolicy(store, {
      autonomy_mode: 'guarded',
      daily_ads_budget_pln: 25,
      daily_meta_ads_budget_pln: 15,
      guarded_max_ads_impact_pct: 0.4,
    });
    const policy = autonomyPolicy({ strapi });
    const decision = await policy.evaluate({ action: 'ads.mutate', platform: 'meta', estimatedCostPln: 15 });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('guarded_blocks_high_impact_ads');
  });

  it('guarded ALLOWS low-impact live ads (<= threshold)', async () => {
    const { strapi, store } = makeStrapi();
    seedPolicy(store, {
      autonomy_mode: 'guarded',
      daily_ads_budget_pln: 25,
      daily_meta_ads_budget_pln: 15,
      guarded_max_ads_impact_pct: 0.4,
    });
    const policy = autonomyPolicy({ strapi });
    const decision = await policy.evaluate({ action: 'ads.mutate', platform: 'meta', estimatedCostPln: 8 });
    expect(decision.allowed).toBe(true);
  });

  it('full ALLOWS higher-impact live ads within caps (the guarded gate does not apply)', async () => {
    const { strapi, store } = makeStrapi();
    seedPolicy(store, {
      autonomy_mode: 'full',
      daily_ads_budget_pln: 25,
      daily_meta_ads_budget_pln: 15,
      guarded_max_ads_impact_pct: 0.4,
    });
    const policy = autonomyPolicy({ strapi });
    const decision = await policy.evaluate({ action: 'ads.mutate', platform: 'meta', estimatedCostPln: 15 });
    expect(decision.allowed).toBe(true);
  });

  it('guarded auto-approves non-critical content publish within caps', async () => {
    const { strapi, store } = makeStrapi();
    seedPolicy(store, { autonomy_mode: 'guarded', max_auto_publish_per_day: 12 });
    const policy = autonomyPolicy({ strapi });
    const decision = await policy.evaluate({ action: 'content.publish' });
    expect(decision.allowed).toBe(true);
  });
});
