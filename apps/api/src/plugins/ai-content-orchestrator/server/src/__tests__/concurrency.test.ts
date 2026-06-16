import { describe, it, expect } from 'vitest';

import {
  ADS_MUTATION_LEDGER_UID,
  AUTONOMY_POLICY_UID,
  RUNTIME_LOCK_UID,
} from '../constants';
import adsBudgetLedger from '../services/ads-budget-ledger';
import autonomyPolicy from '../services/autonomy-policy';
import runtimeLocks from '../services/runtime-locks';
import type { Strapi } from '../types';

type Row = Record<string, unknown>;

// Fields with a unique DB constraint. The fake `create` enforces them
// synchronously (check-then-insert in one tick) to faithfully simulate the
// database unique index that the real concurrency safety relies on.
const UNIQUE_FIELDS: Record<string, string> = {
  [RUNTIME_LOCK_UID]: 'lock_key',
  [ADS_MUTATION_LEDGER_UID]: 'unique_key',
  [AUTONOMY_POLICY_UID]: 'policy_key',
};

const matches = (row: Row, filters?: Record<string, unknown>): boolean => {
  if (!filters) return true;
  return Object.entries(filters).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && '$in' in (cond as Record<string, unknown>)) {
      return ((cond as { $in: unknown[] }).$in ?? []).includes(row[key]);
    }
    if (cond && typeof cond === 'object' && '$gte' in (cond as Record<string, unknown>)) {
      return String(row[key]) >= String((cond as { $gte: unknown }).$gte);
    }
    if (cond && typeof cond === 'object' && '$lt' in (cond as Record<string, unknown>)) {
      return String(row[key]) < String((cond as { $lt: unknown }).$lt);
    }
    return row[key] === cond;
  });
};

const createFakeStrapi = () => {
  const store: Record<string, Row[]> = {};
  let idSeq = 1;

  const entityService = {
    async findMany(uid: string, params: { filters?: Record<string, unknown>; limit?: number } = {}) {
      const rows = (store[uid] ?? []).filter((row) => matches(row, params.filters));
      const limit = params.limit ?? rows.length;
      return rows.slice(0, limit).map((row) => ({ ...row }));
    },
    async findOne(uid: string, id: unknown) {
      const row = (store[uid] ?? []).find((r) => r.id === id);
      return row ? { ...row } : null;
    },
    async create(uid: string, params: { data: Row }) {
      store[uid] = store[uid] ?? [];
      const uniqueField = UNIQUE_FIELDS[uid];
      const data = params.data ?? {};
      if (uniqueField && store[uid].some((r) => r[uniqueField] === data[uniqueField])) {
        throw new Error(`unique constraint violation on ${uid}.${uniqueField}`);
      }
      const row: Row = { id: idSeq++, ...data };
      store[uid].push(row);
      return { ...row };
    },
    async update(uid: string, id: unknown, params: { data: Row }) {
      store[uid] = store[uid] ?? [];
      const row = (store[uid] ?? []).find((r) => r.id === id);
      if (!row) throw new Error('not found');
      Object.assign(row, params.data ?? {});
      return { ...row };
    },
    async count(uid: string, params: { filters?: Record<string, unknown> } = {}) {
      return (store[uid] ?? []).filter((row) => matches(row, params.filters)).length;
    },
    async delete() {
      return null;
    },
  };

  // Minimal knex-like connection so tests exercise the REAL atomic CAS takeover
  // branch (connection present) rather than only the no-connection fallback.
  const TABLE_TO_UID: Record<string, string> = { aico_runtime_locks: RUNTIME_LOCK_UID };
  const connection = (table: string) => {
    const uid = TABLE_TO_UID[table];
    let criteria: Record<string, unknown> = {};
    const builder = {
      where(next: Record<string, unknown>) {
        criteria = next;
        return builder;
      },
      async update(data: Record<string, unknown>) {
        let count = 0;
        for (const row of store[uid] ?? []) {
          if (Object.entries(criteria).every(([k, v]) => row[k] === v)) {
            Object.assign(row, data);
            count += 1;
          }
        }
        return count;
      },
    };
    return builder;
  };

  // Minimal query engine supporting deleteMany (used by the retention reaper).
  const query = (uid: string) => ({
    async deleteMany({ where }: { where?: Record<string, unknown> }) {
      const rows = store[uid] ?? [];
      const remaining = rows.filter((row) => !matches(row, where));
      const count = rows.length - remaining.length;
      store[uid] = remaining;
      return { count };
    },
  });

  const services: Record<string, unknown> = {};
  const strapi = {
    entityService,
    db: { connection, query },
    log: { info() {}, warn() {}, error() {}, debug() {} },
    plugin: () => ({ service: (name: string) => services[name] }),
  } as unknown as Strapi;

  return { strapi, store, services };
};

describe('AICO concurrency safety (C1 runtime lock, C2 ads budget cap)', () => {
  it('C1: only one of two concurrent acquires for the same key wins', async () => {
    const { strapi, services } = createFakeStrapi();
    const locks = runtimeLocks({ strapi });
    services['runtime-locks'] = locks;

    const [a, b] = await Promise.all([locks.acquire({ key: 'tick' }), locks.acquire({ key: 'tick' })]);

    expect([a, b].filter((r) => r.acquired)).toHaveLength(1);
  });

  it('C1: lock can be re-acquired after release', async () => {
    const { strapi } = createFakeStrapi();
    const locks = runtimeLocks({ strapi });

    const first = await locks.acquire({ key: 'tick' });
    expect(first.acquired).toBe(true);
    if (first.acquired) {
      await locks.release(first.lock);
    }

    const second = await locks.acquire({ key: 'tick' });
    expect(second.acquired).toBe(true);
  });

  it('C2: concurrent reservations never exceed the daily platform cap', async () => {
    const { strapi, store, services } = createFakeStrapi();
    const locks = runtimeLocks({ strapi });
    const policy = autonomyPolicy({ strapi });
    const ledger = adsBudgetLedger({ strapi });
    services['runtime-locks'] = locks;
    services['autonomy-policy'] = policy;

    await strapi.entityService.create(AUTONOMY_POLICY_UID, {
      data: {
        policy_key: 'global',
        autonomy_mode: 'guarded',
        daily_ads_budget_pln: 25,
        daily_meta_ads_budget_pln: 15,
        daily_google_ads_budget_pln: 10,
        max_ads_mutations_per_day: 10,
      },
    });

    const planA = { id: 1, platform: 'meta', daily_budget_pln: 10, target_url: 'https://star-sign.pl/' };
    const planB = { id: 2, platform: 'meta', daily_budget_pln: 10, target_url: 'https://star-sign.pl/' };

    const [resA, resB] = await Promise.all([
      ledger.reserveActivation({ plan: planA as never, providerMode: 'live' }),
      ledger.reserveActivation({ plan: planB as never, providerMode: 'live' }),
    ]);

    // Exactly one reservation may succeed; 10 + 10 = 20 would breach the 15 PLN meta cap.
    expect([resA, resB].filter((r) => r.allowed)).toHaveLength(1);

    const reservedTotal = (store[ADS_MUTATION_LEDGER_UID] ?? [])
      .filter((row) => row.status === 'reserved')
      .reduce((sum, row) => sum + Number(row.amount_pln ?? 0), 0);
    expect(reservedTotal).toBeLessThanOrEqual(15);
  });

  it('C1: atomic CAS takeover — only one racer takes over an expired lock', async () => {
    const { strapi, store } = createFakeStrapi();
    const locks = runtimeLocks({ strapi });

    const first = await locks.acquire({ key: 'tick', ttlMs: 60_000 });
    expect(first.acquired).toBe(true);

    // Force the stored lock to look expired, then race two takeovers through the
    // real SQL compare-and-swap branch (connection is present in the fake strapi).
    const row = (store[RUNTIME_LOCK_UID] ?? [])[0];
    row.expires_at = new Date(Date.now() - 1_000);

    const [a, b] = await Promise.all([locks.acquire({ key: 'tick' }), locks.acquire({ key: 'tick' })]);

    expect([a, b].filter((r) => r.acquired)).toHaveLength(1);
  });

  it('C12: reapStale deletes locks whose TTL passed the cutoff', async () => {
    const { strapi, store } = createFakeStrapi();
    const locks = runtimeLocks({ strapi });

    const fresh = await locks.acquire({ key: 'fresh', ttlMs: 60_000 });
    const stale = await locks.acquire({ key: 'stale', ttlMs: 60_000 });
    expect(fresh.acquired && stale.acquired).toBe(true);

    // Backdate one lock's expiry well beyond the reaper cutoff.
    const staleRow = (store[RUNTIME_LOCK_UID] ?? []).find((r) => r.lock_key === 'stale');
    staleRow!.expires_at = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const reaped = await locks.reapStale({ olderThanMs: 24 * 60 * 60 * 1000 });

    expect(reaped).toBe(1);
    const remaining = (store[RUNTIME_LOCK_UID] ?? []).map((r) => r.lock_key);
    expect(remaining).toEqual(['fresh']);
  });

  it('C2: concurrent reservations across platforms never exceed the GLOBAL cap', async () => {
    const { strapi, store, services } = createFakeStrapi();
    const locks = runtimeLocks({ strapi });
    const policy = autonomyPolicy({ strapi });
    const ledger = adsBudgetLedger({ strapi });
    services['runtime-locks'] = locks;
    services['autonomy-policy'] = policy;

    await strapi.entityService.create(AUTONOMY_POLICY_UID, {
      data: {
        policy_key: 'global',
        autonomy_mode: 'guarded',
        daily_ads_budget_pln: 20,
        daily_meta_ads_budget_pln: 15,
        daily_google_ads_budget_pln: 15,
        max_ads_mutations_per_day: 10,
      },
    });

    const planMeta = { id: 1, platform: 'meta', daily_budget_pln: 15, target_url: 'https://star-sign.pl/' };
    const planGoogle = { id: 2, platform: 'google', daily_budget_pln: 10, target_url: 'https://star-sign.pl/' };

    const [resMeta, resGoogle] = await Promise.all([
      ledger.reserveActivation({ plan: planMeta as never, providerMode: 'live' }),
      ledger.reserveActivation({ plan: planGoogle as never, providerMode: 'live' }),
    ]);

    // 15 (meta) + 10 (google) = 25 would breach the 20 PLN GLOBAL cap. A single
    // daily lock key must serialize cross-platform reservations so only one fits.
    expect([resMeta, resGoogle].filter((r) => r.allowed)).toHaveLength(1);

    const reservedTotal = (store[ADS_MUTATION_LEDGER_UID] ?? [])
      .filter((row) => row.status === 'reserved')
      .reduce((sum, row) => sum + Number(row.amount_pln ?? 0), 0);
    expect(reservedTotal).toBeLessThanOrEqual(20);
  });
});
