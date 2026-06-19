import { describe, expect, it, vi } from 'vitest';

import { ADS_MUTATION_LEDGER_UID, DEFAULT_TIMEZONE, PLUGIN_ID } from '../constants';
import adsBudgetLedger from '../services/ads-budget-ledger';
import type { AdCampaignPlanRecord, AdsMutationLedgerRecord, Strapi } from '../types';
import { formatDateInZone } from '../utils/date-time';

// Minimalny `strapi` z mockowanym entityService + mapą serwisów pluginu (jak w
// runtime.test.ts / dashboard-usage.test.ts). Brak serwisu 'runtime-locks' w
// mapie => reserveActivation idzie bezpośrednio przez runReservation (bez
// runExclusive), więc test celuje wprost w ścieżkę reuse/create.
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

// Polityka z hojnymi capami — utrzymuje test w obrębie happy-path bramki
// budżetowej (kwoty < capów), żeby przejść do gałęzi reuse/create.
const buildAutonomyPolicy = () => ({
  getPolicy: vi.fn(async () => ({
    id: 1,
    policy_key: 'global',
    autonomy_mode: 'guarded',
    daily_ads_budget_pln: 100,
    daily_meta_ads_budget_pln: 100,
    daily_google_ads_budget_pln: 100,
    max_ads_mutations_per_day: 50,
  })),
});

const buildPlan = (overrides: Partial<AdCampaignPlanRecord> = {}): AdCampaignPlanRecord => ({
  id: 501,
  name: 'Star-Sign premium',
  platform: 'meta',
  status: 'ready',
  target_url: 'https://star-sign.pl/premium',
  daily_budget_pln: 12,
  ...overrides,
});

describe('ads-budget-ledger.reserveActivation — reuses a released row (fix #7)', () => {
  it('UPDATEs a same-day released row back to reserved instead of colliding on unique_key via create', async () => {
    const now = new Date('2026-06-19T09:00:00.000Z');
    const day = formatDateInZone(now, DEFAULT_TIMEZONE);
    const plan = buildPlan();
    // Deterministyczny unique_key budowany dokładnie tak jak w serwisie:
    // `ads:${day}:${platform}:${planId}:activate`.
    const uniqueKey = `ads:${day}:${plan.platform}:${plan.id}:activate`;

    // Istniejący wiersz w statusie NON-active ('released') z wcześniejszej próby
    // tego samego dnia — kolizja, gdyby reserveActivation próbowało create().
    const releasedRow: AdsMutationLedgerRecord = {
      id: 4242,
      unique_key: uniqueKey,
      day,
      platform: plan.platform,
      operation: 'activate',
      status: 'released',
      amount_pln: 12,
      provider_mode: 'live',
      blocked_reason: 'stop_loss',
      metadata: { planId: plan.id, prior: true },
    };

    const create = vi.fn(async () => {
      throw new Error('unique constraint violation on unique_key (create must NOT be called)');
    });
    const update = vi.fn(async (_uid: string, id: number, payload: { data: Record<string, unknown> }) => ({
      ...releasedRow,
      id,
      ...payload.data,
    }));
    // Pierwsze findMany: lookup po unique_key -> zwraca wiersz 'released'.
    // Drugie findMany: dzienne aktywne ledgery (status $in ACTIVE) -> wiersz
    // 'released' tam NIE występuje, więc zwracamy [].
    const findMany = vi.fn(
      async (uid: string, params: { filters?: Record<string, unknown> } = {}) => {
        expect(uid).toBe(ADS_MUTATION_LEDGER_UID);
        if (params.filters?.unique_key === uniqueKey) {
          return [releasedRow];
        }
        return [];
      }
    );

    const strapi = createStrapi(
      { 'autonomy-policy': buildAutonomyPolicy() },
      { findMany, create, update }
    );

    const result = await adsBudgetLedger({ strapi }).reserveActivation({
      plan,
      providerMode: 'live',
      now,
    });

    // Wynik: dozwolone i świeżo zarezerwowane (reason 'reserved', nie
    // 'already_reserved' — bo wiersz był NON-active).
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.reason).toBe('reserved');
      expect(result.ledger.status).toBe('reserved');
      expect(result.ledger.id).toBe(releasedRow.id);
    }

    // KLUCZOWE: reuse istniejącego wiersza przez update(existing.id), NIE create.
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      ADS_MUTATION_LEDGER_UID,
      releasedRow.id,
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'reserved',
          operation: 'activate',
          amount_pln: 12,
          ad_campaign_plan: plan.id,
        }),
      })
    );
  });

  it('still CREATEs a fresh row when no prior ledger row exists for the unique_key', async () => {
    const now = new Date('2026-06-19T09:00:00.000Z');
    const plan = buildPlan({ id: 777 });

    const create = vi.fn(async (_uid: string, payload: { data: Record<string, unknown> }) => ({
      id: 9001,
      ...payload.data,
    }));
    const update = vi.fn();
    // Brak istniejącego wiersza: oba findMany zwracają [].
    const findMany = vi.fn(async () => []);

    const strapi = createStrapi(
      { 'autonomy-policy': buildAutonomyPolicy() },
      { findMany, create, update }
    );

    const result = await adsBudgetLedger({ strapi }).reserveActivation({
      plan,
      providerMode: 'live',
      now,
    });

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.reason).toBe('reserved');
    }
    expect(update).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      ADS_MUTATION_LEDGER_UID,
      expect.objectContaining({
        data: expect.objectContaining({ status: 'reserved', operation: 'activate' }),
      })
    );
  });
});
