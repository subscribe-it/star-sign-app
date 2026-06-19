import { ADS_MUTATION_LEDGER_UID, DEFAULT_TIMEZONE } from '../constants';
import type {
  AdCampaignPlanRecord,
  AdsMutationLedgerRecord,
  AdsPlatform,
  AutonomyPolicyRecord,
  Strapi,
} from '../types';
import { formatDateInZone } from '../utils/date-time';
import { getEntityService } from '../utils/entity-service';
import { getPluginService } from '../utils/plugin';

type AutonomyPolicyService = {
  getPolicy: () => Promise<AutonomyPolicyRecord>;
};

type RuntimeLocksLike = {
  runExclusive?: <T>(
    key: string,
    input: { ttlMs?: number; retries?: number; retryDelayMs?: number; metadata?: Record<string, unknown> },
    runner: () => Promise<T>
  ) => Promise<T>;
};

type ReserveActivationInput = {
  plan: AdCampaignPlanRecord;
  providerMode: string;
  now?: Date;
};

type ReserveActivationResult =
  | {
      allowed: true;
      reason: 'reserved' | 'already_reserved';
      ledger: AdsMutationLedgerRecord;
      day: string;
      totals: AdsLedgerTotals;
    }
  | {
      allowed: false;
      reason: 'ads_ledger_budget_cap_exceeded' | 'ads_ledger_platform_cap_exceeded' | 'ads_ledger_mutation_cap_reached';
      day: string;
      totals: AdsLedgerTotals;
    };

type AdsLedgerTotals = {
  globalReservedPln: number;
  platformReservedPln: number;
  mutationCount: number;
  globalCapPln: number;
  platformCapPln: number;
  mutationCap: number;
  requestedPln: number;
};

const ACTIVE_LEDGER_STATUSES = ['reserved', 'applied'];
const DEFAULT_DAILY_ADS_BUDGET_PLN = 25;
const DEFAULT_META_ADS_BUDGET_PLN = 15;
const DEFAULT_GOOGLE_ADS_BUDGET_PLN = 10;

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const getPlatformCap = (policy: AutonomyPolicyRecord, platform: AdsPlatform): number =>
  platform === 'meta'
    ? toNumber(policy.daily_meta_ads_budget_pln, DEFAULT_META_ADS_BUDGET_PLN)
    : toNumber(policy.daily_google_ads_budget_pln, DEFAULT_GOOGLE_ADS_BUDGET_PLN);

const getPlanId = (plan: AdCampaignPlanRecord): number => Number(plan.id);

const buildActivationKey = (day: string, plan: AdCampaignPlanRecord): string =>
  `ads:${day}:${plan.platform}:${getPlanId(plan)}:activate`;

const adsBudgetLedger = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  const getPolicy = async (): Promise<AutonomyPolicyRecord> => {
    const policy = getPluginService<AutonomyPolicyService>(strapi, 'autonomy-policy');
    return policy.getPolicy();
  };

  const getDay = (now = new Date()): string => formatDateInZone(now, DEFAULT_TIMEZONE);

  return {
    async reserveActivation(input: ReserveActivationInput): Promise<ReserveActivationResult> {
      const day = getDay(input.now);

      // The read-sum-then-create below is only safe against concurrent reservations
      // (different plans, multi-instance) if serialized. We serialize per
      // platform+day using the atomic runtime lock so the aggregate daily cap holds.
      const runReservation = async (): Promise<ReserveActivationResult> => {
        const requestedPln = toNumber(input.plan.daily_budget_pln, 0);
        const uniqueKey = buildActivationKey(day, input.plan);
        const existing = (
          await entityService.findMany<AdsMutationLedgerRecord>(ADS_MUTATION_LEDGER_UID, {
            filters: { unique_key: uniqueKey },
            limit: 1,
          })
        )[0];

        const policy = await getPolicy();
        const dailyLedgers = await entityService.findMany<AdsMutationLedgerRecord>(ADS_MUTATION_LEDGER_UID, {
          filters: {
            day,
            status: { $in: ACTIVE_LEDGER_STATUSES },
          },
          limit: 500,
        });
        const activeLedgers = dailyLedgers.filter((ledger) => ledger.unique_key !== uniqueKey);
        const globalReservedPln = activeLedgers.reduce((sum, ledger) => sum + toNumber(ledger.amount_pln, 0), 0);
        const platformReservedPln = activeLedgers
          .filter((ledger) => ledger.platform === input.plan.platform)
          .reduce((sum, ledger) => sum + toNumber(ledger.amount_pln, 0), 0);
        const totals: AdsLedgerTotals = {
          globalReservedPln,
          platformReservedPln,
          mutationCount: activeLedgers.length,
          globalCapPln: toNumber(policy.daily_ads_budget_pln, DEFAULT_DAILY_ADS_BUDGET_PLN),
          platformCapPln: getPlatformCap(policy, input.plan.platform),
          mutationCap: toNumber(policy.max_ads_mutations_per_day, 10),
          requestedPln,
        };

        if (existing && ACTIVE_LEDGER_STATUSES.includes(existing.status)) {
          return {
            allowed: true,
            reason: 'already_reserved',
            ledger: existing,
            day,
            totals,
          };
        }

        if (totals.mutationCount >= totals.mutationCap) {
          return {
            allowed: false,
            reason: 'ads_ledger_mutation_cap_reached',
            day,
            totals,
          };
        }

        if (totals.platformReservedPln + requestedPln > totals.platformCapPln) {
          return {
            allowed: false,
            reason: 'ads_ledger_platform_cap_exceeded',
            day,
            totals,
          };
        }

        if (totals.globalReservedPln + requestedPln > totals.globalCapPln) {
          return {
            allowed: false,
            reason: 'ads_ledger_budget_cap_exceeded',
            day,
            totals,
          };
        }

        // A row may already exist for this deterministic unique_key in a
        // NON-active status (released/blocked/failed) from a prior same-day
        // attempt. The idempotency short-circuit above only returns early for
        // ACTIVE statuses, so here we must REUSE that stale row via update()
        // rather than create() — a create would collide on unique_key and the
        // DB would throw, crashing the activation endpoint.
        const ledger = existing
          ? await entityService.update<AdsMutationLedgerRecord>(ADS_MUTATION_LEDGER_UID, existing.id, {
              data: {
                platform: input.plan.platform,
                operation: 'activate',
                status: 'reserved',
                amount_pln: requestedPln,
                provider_mode: input.providerMode,
                blocked_reason: null,
                provider_decision: null,
                provider_campaign_id: null,
                metadata: {
                  ...(existing.metadata ?? {}),
                  planId: input.plan.id,
                  targetUrl: input.plan.target_url,
                  totals,
                  reactivatedAt: (input.now ?? new Date()).toISOString(),
                },
                ad_campaign_plan: input.plan.id,
              },
            })
          : await entityService.create<AdsMutationLedgerRecord>(ADS_MUTATION_LEDGER_UID, {
              data: {
                unique_key: uniqueKey,
                day,
                platform: input.plan.platform,
                operation: 'activate',
                status: 'reserved',
                amount_pln: requestedPln,
                provider_mode: input.providerMode,
                metadata: {
                  planId: input.plan.id,
                  targetUrl: input.plan.target_url,
                  totals,
                },
                ad_campaign_plan: input.plan.id,
              },
            });

        return {
          allowed: true,
          reason: 'reserved',
          ledger,
          day,
          totals,
        };
      };

      const runtimeLocks = getPluginService<RuntimeLocksLike>(strapi, 'runtime-locks');
      if (runtimeLocks && typeof runtimeLocks.runExclusive === 'function') {
        // Single daily key (NOT per-platform): runReservation enforces the GLOBAL
        // daily_ads_budget_pln across all platforms, so meta+google reservations
        // must serialize against each other or the global cap can be breached.
        // The critical section is a few local DB queries (provider calls happen
        // outside the lock), so it completes well under ttlMs.
        return runtimeLocks.runExclusive(
          `ads-reserve:${day}`,
          { ttlMs: 15_000, retries: 50, retryDelayMs: 100 },
          runReservation
        );
      }

      return runReservation();
    },

    async markApplied(
      ledger: AdsMutationLedgerRecord,
      input: { providerDecision: string; providerCampaignId?: string | null; metadata?: Record<string, unknown> }
    ): Promise<AdsMutationLedgerRecord> {
      return entityService.update<AdsMutationLedgerRecord>(ADS_MUTATION_LEDGER_UID, ledger.id, {
        data: {
          status: 'applied',
          provider_decision: input.providerDecision,
          provider_campaign_id: input.providerCampaignId,
          metadata: {
            ...(ledger.metadata ?? {}),
            ...(input.metadata ?? {}),
          },
        },
      });
    },

    async release(
      ledger: AdsMutationLedgerRecord,
      input: { reason: string; metadata?: Record<string, unknown> }
    ): Promise<AdsMutationLedgerRecord> {
      return entityService.update<AdsMutationLedgerRecord>(ADS_MUTATION_LEDGER_UID, ledger.id, {
        data: {
          status: 'released',
          blocked_reason: input.reason,
          metadata: {
            ...(ledger.metadata ?? {}),
            releasedReason: input.reason,
            ...(input.metadata ?? {}),
          },
        },
      });
    },

    async recordPause(
      plan: AdCampaignPlanRecord,
      input: { providerMode: string; providerDecision: string; ok: boolean; now?: Date }
    ): Promise<AdsMutationLedgerRecord> {
      const day = getDay(input.now);
      return entityService.create<AdsMutationLedgerRecord>(ADS_MUTATION_LEDGER_UID, {
        data: {
          unique_key: `ads:${day}:${plan.platform}:${plan.id}:pause:${Date.now()}`,
          day,
          platform: plan.platform,
          operation: 'pause',
          status: input.ok ? 'applied' : 'failed',
          amount_pln: 0,
          provider_mode: input.providerMode,
          provider_decision: input.providerDecision,
          provider_campaign_id: plan.provider_campaign_id,
          blocked_reason: input.ok ? null : input.providerDecision,
          metadata: {
            planId: plan.id,
            liveSpendEnabled: false,
          },
          ad_campaign_plan: plan.id,
        },
      });
    },
  };
};

export default adsBudgetLedger;
