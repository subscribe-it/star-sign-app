import { AD_CAMPAIGN_PLAN_UID } from '../constants';
import type {
  AdCampaignPlanRecord,
  AdsMutationLedgerRecord,
  AdsPlatform,
  AutonomyPolicyRecord,
  Strapi,
} from '../types';
import { recordSystemAuditEvent } from '../utils/audit-trail';
import { getEntityService } from '../utils/entity-service';
import { getPluginService } from '../utils/plugin';

type AutonomyPolicyService = {
  evaluate: (input: {
    action: 'ads.mutate';
    platform: AdsPlatform;
    estimatedCostPln: number;
    requiresBrandSafety?: boolean;
    requiresLegalDisclaimer?: boolean;
  }) => Promise<{
    allowed: boolean;
    reason: string;
    budgetImpactPln: number;
    policy?: AutonomyPolicyRecord;
  }>;
};

type AdsProviderAdapterService = {
  createOrUpdateCampaign: (plan: AdCampaignPlanRecord) => Promise<{
    ok: boolean;
    mode: 'disabled' | 'sandbox' | 'controlled' | 'live';
    status: 'ready' | 'active' | 'blocked';
    reason: string;
    providerCampaignId?: string;
    providerAdsetId?: string;
    providerCreativeId?: string;
    providerPayload?: Record<string, unknown>;
  }>;
  pauseCampaign: (plan: AdCampaignPlanRecord) => Promise<{
    ok: boolean;
    mode: 'disabled' | 'sandbox' | 'controlled' | 'live';
    status: 'paused' | 'blocked';
    reason: string;
    providerCampaignId?: string;
    providerAdsetId?: string;
    providerCreativeId?: string;
    providerPayload?: Record<string, unknown>;
  }>;
  fetchSpend?: (plan: AdCampaignPlanRecord) => Promise<{
    ok: boolean;
    mode: string;
    reason: string;
    spendPln: number;
  }>;
};

type ProviderStatusService = {
  checkProviders: (input: { action: 'ads.mutate'; platform: AdsPlatform }) => Promise<{
    ready: boolean;
    requiredProviders: string[];
    blockedProviders: Array<{ provider: string; blockedReason?: string | null }>;
  }>;
};

type AdsBudgetLedgerService = {
  reserveActivation: (input: {
    plan: AdCampaignPlanRecord;
    providerMode: string;
  }) => Promise<
    | {
        allowed: true;
        reason: 'reserved' | 'already_reserved';
        ledger: AdsMutationLedgerRecord;
        totals: Record<string, unknown>;
      }
    | {
        allowed: false;
        reason:
          | 'ads_ledger_budget_cap_exceeded'
          | 'ads_ledger_platform_cap_exceeded'
          | 'ads_ledger_mutation_cap_reached';
        totals: Record<string, unknown>;
      }
  >;
  markApplied: (
    ledger: AdsMutationLedgerRecord,
    input: {
      providerDecision: string;
      providerCampaignId?: string | null;
      metadata?: Record<string, unknown>;
    }
  ) => Promise<AdsMutationLedgerRecord>;
  release: (
    ledger: AdsMutationLedgerRecord,
    input: { reason: string; metadata?: Record<string, unknown> }
  ) => Promise<AdsMutationLedgerRecord>;
  recordPause: (
    plan: AdCampaignPlanRecord,
    input: { providerMode: string; providerDecision: string; ok: boolean; now?: Date }
  ) => Promise<AdsMutationLedgerRecord>;
};

type CreateCampaignInput = {
  name: string;
  platform: AdsPlatform;
  targetUrl: string;
  dailyBudgetPln?: number;
  objective?: string;
  creativePayload?: Record<string, unknown>;
  targetingPayload?: Record<string, unknown>;
  dryRun?: boolean;
};

type PauseSweepInput = {
  reason?: string;
  limit?: number;
};

type PauseSweepResult = {
  reason: string;
  attempted: number;
  paused: number;
  blocked: number;
  failed: number;
  results: Array<{
    id: number;
    status: AdCampaignPlanRecord['status'] | 'error';
    blockedReason?: string | null;
    errorMessage?: string;
  }>;
};

const DEFAULT_PLATFORM_BUDGETS: Record<AdsPlatform, number> = {
  meta: 15,
  google: 10,
};
const DEFAULT_DAILY_ADS_BUDGET_PLN = 25;
const ACTIVE_PLAN_STATUSES = ['ready', 'active'];
const DEFAULT_PAUSE_SWEEP_LIMIT = 100;

const DEFAULT_AD_TARGET_HOSTS = ['star-sign.pl', 'www.star-sign.pl', 'star-sign.app', 'www.star-sign.app'];
const DEFAULT_AD_TARGET_PATH_PREFIXES = ['/', '/premium', '/horoskopy', '/blog', '/tarot', '/numerologia'];
const UNSAFE_AD_COPY_PATTERNS = [
  /gwarant/i,
  /pewn(?:a|e|y|o) przysz/i,
  /wylecz/i,
  /diagnoz/i,
  /inwestyc/i,
  /zysk/i,
  /kredyt/i,
  /pożycz/i,
  /chorob/i,
  /lek(?:arz|u|i)/i,
  /strach/i,
  /musisz/i,
];
const TOKEN_LIKE_QUERY_KEYS = [/token/i, /secret/i, /password/i, /session/i, /^key$/i, /api[_-]?key/i, /jwt/i, /auth/i];
const SENSITIVE_TARGETING_KEYS = [
  /custom_audience/i,
  /lookalike/i,
  /remarketing/i,
  /retarget/i,
  /health/i,
  /medical/i,
  /finance/i,
  /credit/i,
  /loan/i,
  /relig/i,
  /belief/i,
  /politic/i,
  /ethnic/i,
  /income/i,
  /children/i,
  /pregnan/i,
  /relationship/i,
  /sexual/i,
];

const getAllowedTargetHosts = (): string[] => {
  const configured = process.env.AICO_ADS_TARGET_URL_ALLOWLIST;
  if (!configured?.trim()) {
    return DEFAULT_AD_TARGET_HOSTS;
  }

  return configured
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
};

const getAllowedTargetPathPrefixes = (): string[] => {
  const configured = process.env.AICO_ADS_TARGET_PATH_ALLOWLIST;
  if (!configured?.trim()) {
    return DEFAULT_AD_TARGET_PATH_PREFIXES;
  }

  return configured
    .split(',')
    .map((path) => path.trim())
    .filter((path) => path.startsWith('/'));
};

const isAdsPlatform = (value: unknown): value is AdsPlatform => value === 'meta' || value === 'google';

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const getPlatformCap = (policy: AutonomyPolicyRecord | undefined, platform: AdsPlatform): number => {
  if (platform === 'meta') {
    return toNumber(policy?.daily_meta_ads_budget_pln, DEFAULT_PLATFORM_BUDGETS.meta);
  }

  return toNumber(policy?.daily_google_ads_budget_pln, DEFAULT_PLATFORM_BUDGETS.google);
};

const validateTargetUrl = (targetUrl: string): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return 'invalid_target_url';
  }

  if (parsed.protocol !== 'https:') {
    return 'target_url_must_be_https';
  }

  if (parsed.username || parsed.password) {
    return 'target_url_userinfo_not_allowed';
  }

  if (!getAllowedTargetHosts().includes(parsed.hostname.toLowerCase())) {
    return 'target_url_not_allowed';
  }

  if (!getAllowedTargetPathPrefixes().some((prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`))) {
    return 'target_url_path_not_allowed';
  }

  if (parsed.hash) {
    return 'target_url_fragment_not_allowed';
  }

  for (const key of parsed.searchParams.keys()) {
    if (TOKEN_LIKE_QUERY_KEYS.some((pattern) => pattern.test(key))) {
      return 'target_url_sensitive_query_not_allowed';
    }
  }

  return null;
};

const getAdsProviderMode = (): string =>
  String(process.env.AICO_ADS_PROVIDER_MODE ?? 'disabled').trim().toLowerCase();

const collectStrings = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
  }
  return [];
};

const validateAdCopySafety = (input: {
  name?: string;
  objective?: string;
  creativePayload?: Record<string, unknown>;
}): string | null => {
  const copy = [input.name ?? '', input.objective ?? '', ...collectStrings(input.creativePayload)].join(' ');
  return UNSAFE_AD_COPY_PATTERNS.some((pattern) => pattern.test(copy)) ? 'unsafe_ad_claims' : null;
};

const validateTargetingSafety = (targetingPayload?: Record<string, unknown>): string | null => {
  if (!targetingPayload) return null;

  const keys = Object.keys(targetingPayload);
  if (keys.some((key) => SENSITIVE_TARGETING_KEYS.some((pattern) => pattern.test(key)))) {
    return 'unsafe_ads_targeting';
  }

  const serialized = JSON.stringify(targetingPayload);
  return SENSITIVE_TARGETING_KEYS.some((pattern) => pattern.test(serialized)) ? 'unsafe_ads_targeting' : null;
};

const isTargetUrlPreflightRequired = (): boolean =>
  ['controlled', 'live'].includes(getAdsProviderMode()) ||
  ['1', 'true', 'yes', 'on'].includes(
    String(process.env.AICO_ADS_TARGET_URL_PREFLIGHT_REQUIRED ?? '').trim().toLowerCase()
  );

const preflightTargetUrl = async (targetUrl: string): Promise<string | null> => {
  if (!isTargetUrlPreflightRequired()) return null;

  let response: Response;
  try {
    response = await fetch(targetUrl, { method: 'HEAD', redirect: 'manual' });
    if (response.status === 405) {
      response = await fetch(targetUrl, { method: 'GET', redirect: 'manual' });
    }
  } catch {
    return 'target_url_preflight_failed';
  }

  if (response.status < 200 || response.status >= 300) {
    return `target_url_preflight_http_${response.status}`;
  }

  return null;
};

const adsAgent = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  const getExistingPlanBudget = async (
    platform: AdsPlatform
  ): Promise<{ globalPln: number; platformPln: number }> => {
    const plans = await entityService.findMany<AdCampaignPlanRecord>(AD_CAMPAIGN_PLAN_UID, {
      filters: { status: { $in: ACTIVE_PLAN_STATUSES } },
      fields: ['platform', 'daily_budget_pln'],
      limit: 500,
    });

    return plans.reduce(
      (totals, plan) => {
        const budget = toNumber(plan.daily_budget_pln, 0);
        totals.globalPln += budget;
        if (plan.platform === platform) {
          totals.platformPln += budget;
        }
        return totals;
      },
      { globalPln: 0, platformPln: 0 }
    );
  };

  return {
    async list(input: { status?: string; platform?: string; limit?: number } = {}): Promise<AdCampaignPlanRecord[]> {
      const filters: Record<string, unknown> = {};
      if (input.status) filters.status = input.status;
      if (input.platform) filters.platform = input.platform;

      return entityService.findMany<AdCampaignPlanRecord>(AD_CAMPAIGN_PLAN_UID, {
        filters,
        sort: [{ updatedAt: 'desc' }],
        populate: ['workflow', 'experiment'],
        limit: Math.max(1, Math.min(200, Number(input.limit ?? 50))),
      });
    },

    async createPlan(input: CreateCampaignInput): Promise<{
      dryRun: boolean;
      allowed: boolean;
      reason: string;
      plan?: AdCampaignPlanRecord;
      budget: { requestedPln: number; platform: AdsPlatform };
    }> {
      const platform = input.platform;
      const requestedPln = Number(input.dailyBudgetPln ?? DEFAULT_PLATFORM_BUDGETS[platform]);
      const budget = { requestedPln, platform };

      if (!isAdsPlatform(platform)) {
        return {
          dryRun: Boolean(input.dryRun),
          allowed: false,
          reason: 'invalid_ads_platform',
          budget,
        };
      }

      if (!Number.isFinite(requestedPln) || requestedPln <= 0) {
        return {
          dryRun: Boolean(input.dryRun),
          allowed: false,
          reason: 'invalid_ads_budget',
          budget,
        };
      }

      const targetUrlError = validateTargetUrl(input.targetUrl);
      if (targetUrlError) {
        return {
          dryRun: Boolean(input.dryRun),
          allowed: false,
          reason: targetUrlError,
          budget,
        };
      }

      const copySafetyError = validateAdCopySafety({
        name: input.name,
        objective: input.objective,
        creativePayload: input.creativePayload,
      });
      if (copySafetyError) {
        return {
          dryRun: Boolean(input.dryRun),
          allowed: false,
          reason: copySafetyError,
          budget,
        };
      }

      const targetingSafetyError = validateTargetingSafety(input.targetingPayload);
      if (targetingSafetyError) {
        return {
          dryRun: Boolean(input.dryRun),
          allowed: false,
          reason: targetingSafetyError,
          budget,
        };
      }

      const targetUrlPreflightError = await preflightTargetUrl(input.targetUrl);
      if (targetUrlPreflightError) {
        return {
          dryRun: Boolean(input.dryRun),
          allowed: false,
          reason: targetUrlPreflightError,
          budget,
        };
      }

      const policy = getPluginService<AutonomyPolicyService>(strapi, 'autonomy-policy');
      const decision = await policy.evaluate({
        action: 'ads.mutate',
        platform,
        estimatedCostPln: requestedPln,
        requiresBrandSafety: true,
        requiresLegalDisclaimer: true,
      });

      if (decision.allowed) {
        const existingBudget = await getExistingPlanBudget(platform);
        const globalCap = toNumber(decision.policy?.daily_ads_budget_pln, DEFAULT_DAILY_ADS_BUDGET_PLN);
        const platformCap = getPlatformCap(decision.policy, platform);

        if (
          existingBudget.globalPln + requestedPln > globalCap ||
          existingBudget.platformPln + requestedPln > platformCap
        ) {
          return {
            dryRun: Boolean(input.dryRun),
            allowed: false,
            reason: 'ads_budget_cap_exceeded',
            budget,
          };
        }
      }

      if (!decision.allowed || input.dryRun) {
        return {
          dryRun: Boolean(input.dryRun),
          allowed: decision.allowed,
          reason: decision.reason,
          budget,
        };
      }

      const plan = await entityService.create<AdCampaignPlanRecord>(AD_CAMPAIGN_PLAN_UID, {
        data: {
          name: input.name,
          platform,
          status: 'ready',
          objective: input.objective ?? 'traffic',
          target_url: input.targetUrl,
          daily_budget_pln: requestedPln,
          creative_payload: input.creativePayload,
          targeting_payload: input.targetingPayload,
          utm_campaign: `aico_${platform}_${Date.now()}`,
          stop_loss_state: {
            globalCapPln: 25,
            providerCallsEnabled: false,
            reason: 'provider_adapter_not_enabled',
          },
          metadata: {
            createdBy: 'ads-agent',
            liveSpendEnabled: false,
          },
        },
      });

      return {
        dryRun: false,
        allowed: true,
        reason: decision.reason,
        plan,
        budget,
      };
    },

    async pause(id: number): Promise<AdCampaignPlanRecord> {
      const plan = await entityService.findOne<AdCampaignPlanRecord>(AD_CAMPAIGN_PLAN_UID, id);
      if (!plan) {
        throw new Error('Nie znaleziono planu kampanii reklamowej.');
      }

      const providerMode = getAdsProviderMode();
      await recordSystemAuditEvent(strapi, {
        action: 'ads.pause.attempt',
        outcome: 'success',
        resourceUid: AD_CAMPAIGN_PLAN_UID,
        resourceId: id,
        metadata: {
          platform: plan.platform,
          providerMode,
          dailyBudgetPln: plan.daily_budget_pln,
          liveSpendEnabled: false,
        },
      });

      const ledgerService = getPluginService<Partial<AdsBudgetLedgerService> | undefined>(
        strapi,
        'ads-budget-ledger'
      );
      if (providerMode !== 'disabled' && typeof ledgerService?.recordPause !== 'function') {
        await recordSystemAuditEvent(strapi, {
          action: 'ads.pause.skipped',
          outcome: 'skipped',
          severity: 'warn',
          resourceUid: AD_CAMPAIGN_PLAN_UID,
          resourceId: id,
          metadata: {
            reason: 'ads_budget_ledger_service_missing',
            providerMode,
          },
        });
        return entityService.update<AdCampaignPlanRecord>(AD_CAMPAIGN_PLAN_UID, id, {
          data: {
            status: 'blocked',
            blocked_reason: 'ads_budget_ledger_service_missing',
            stop_loss_state: {
              providerMode,
              providerDecision: 'ads_budget_ledger_service_missing',
              providerPaused: false,
              liveSpendEnabled: false,
            },
          },
        });
      }

      const provider = getPluginService<Partial<AdsProviderAdapterService> | undefined>(
        strapi,
        'ads-provider-adapter'
      );
      if (typeof provider?.pauseCampaign !== 'function') {
        await recordSystemAuditEvent(strapi, {
          action: 'ads.pause.skipped',
          outcome: 'skipped',
          severity: 'warn',
          resourceUid: AD_CAMPAIGN_PLAN_UID,
          resourceId: id,
          metadata: {
            reason: 'provider_pause_adapter_missing',
            providerMode,
          },
        });
        return entityService.update<AdCampaignPlanRecord>(AD_CAMPAIGN_PLAN_UID, id, {
          data: {
            status: 'blocked',
            blocked_reason: 'provider_pause_adapter_missing',
            stop_loss_state: {
              providerMode,
              providerDecision: 'provider_pause_adapter_missing',
              providerPaused: false,
              liveSpendEnabled: false,
            },
          },
        });
      }

      const providerResult = await provider.pauseCampaign(plan);
      const planWithProviderIds: AdCampaignPlanRecord = {
        ...plan,
        provider_campaign_id: providerResult.providerCampaignId ?? plan.provider_campaign_id,
        provider_adset_id: providerResult.providerAdsetId ?? plan.provider_adset_id,
        provider_ad_id: providerResult.providerCreativeId ?? plan.provider_ad_id,
      };
      const pauseLedger =
        typeof ledgerService?.recordPause === 'function'
          ? await ledgerService.recordPause(planWithProviderIds, {
              providerMode: providerResult.mode,
              providerDecision: providerResult.reason,
              ok: providerResult.ok,
            })
          : null;

      await recordSystemAuditEvent(strapi, {
        action: providerResult.ok ? 'ads.pause.success' : 'ads.pause.skipped',
        outcome: providerResult.ok ? 'success' : 'skipped',
        severity: providerResult.ok ? 'info' : 'warn',
        resourceUid: AD_CAMPAIGN_PLAN_UID,
        resourceId: id,
        metadata: {
          platform: plan.platform,
          providerMode: providerResult.mode,
          providerDecision: providerResult.reason,
          ledgerId: pauseLedger?.id,
        },
      });

      return entityService.update<AdCampaignPlanRecord>(AD_CAMPAIGN_PLAN_UID, id, {
        data: {
          status: providerResult.status,
          blocked_reason: providerResult.ok ? null : providerResult.reason,
          provider_campaign_id: providerResult.providerCampaignId ?? plan.provider_campaign_id,
          provider_adset_id: providerResult.providerAdsetId ?? plan.provider_adset_id,
          provider_ad_id: providerResult.providerCreativeId ?? plan.provider_ad_id,
          stop_loss_state: {
            providerMode: providerResult.mode,
            providerDecision: providerResult.reason,
            providerPaused: providerResult.ok,
            liveSpendEnabled: false,
            ...(pauseLedger
              ? {
                  adsLedger: {
                    operation: 'pause',
                    ledgerId: pauseLedger.id,
                    status: pauseLedger.status,
                  },
                }
              : {}),
            ...(providerResult.providerPayload ?? {}),
          },
        },
      });
    },

    async pauseActiveForKillSwitch(input: PauseSweepInput = {}): Promise<PauseSweepResult> {
      const reason = input.reason ?? 'global_kill_switch';
      const limit = Math.max(1, Math.min(500, Number(input.limit ?? DEFAULT_PAUSE_SWEEP_LIMIT)));
      const candidates = await entityService.findMany<Pick<AdCampaignPlanRecord, 'id'>>(
        AD_CAMPAIGN_PLAN_UID,
        {
          filters: { status: { $in: ACTIVE_PLAN_STATUSES } },
          fields: ['id'],
          sort: [{ updatedAt: 'desc' }],
          limit,
        }
      );
      const result: PauseSweepResult = {
        reason,
        attempted: 0,
        paused: 0,
        blocked: 0,
        failed: 0,
        results: [],
      };

      await recordSystemAuditEvent(strapi, {
        action: 'ads.stop-loss-sweep.attempt',
        outcome: 'success',
        resourceUid: AD_CAMPAIGN_PLAN_UID,
        metadata: {
          reason,
          candidates: candidates.length,
          limit,
        },
      });

      for (const candidate of candidates) {
        const planId = Number(candidate.id);
        if (!Number.isFinite(planId)) continue;

        result.attempted += 1;

        try {
          const pausedPlan = await this.pause(planId);
          if (pausedPlan.status === 'paused') {
            result.paused += 1;
          } else if (pausedPlan.status === 'blocked') {
            result.blocked += 1;
          }
          result.results.push({
            id: planId,
            status: pausedPlan.status,
            blockedReason: pausedPlan.blocked_reason,
          });
        } catch (error) {
          result.failed += 1;
          result.results.push({
            id: planId,
            status: 'error',
            errorMessage: error instanceof Error ? error.message : 'unknown_pause_error',
          });
        }
      }

      await recordSystemAuditEvent(strapi, {
        action: 'ads.stop-loss-sweep.complete',
        outcome: result.failed > 0 || result.blocked > 0 ? 'skipped' : 'success',
        severity: result.failed > 0 || result.blocked > 0 ? 'warn' : 'info',
        resourceUid: AD_CAMPAIGN_PLAN_UID,
        metadata: {
          reason,
          attempted: result.attempted,
          paused: result.paused,
          blocked: result.blocked,
          failed: result.failed,
        },
      });

      return result;
    },

    async reconcileLiveSpend(input: { limit?: number } = {}): Promise<{
      providerMode: string;
      checked: number;
      pausedForStopLoss: number;
      results: Array<{ id: number; spendPln: number; dailyBudgetPln: number; action: 'ok' | 'paused' | 'spend_unavailable' }>;
    }> {
      const providerMode = getAdsProviderMode();
      const summary = {
        providerMode,
        checked: 0,
        pausedForStopLoss: 0,
        results: [] as Array<{
          id: number;
          spendPln: number;
          dailyBudgetPln: number;
          action: 'ok' | 'paused' | 'spend_unavailable';
        }>,
      };

      if (providerMode !== 'live') {
        return summary;
      }

      const provider = getPluginService<Partial<AdsProviderAdapterService> | undefined>(
        strapi,
        'ads-provider-adapter'
      );
      if (typeof provider?.fetchSpend !== 'function') {
        return summary;
      }

      // Stop-loss margin from policy.stop_loss_rules.pauseAtSpendPct (e.g. 0.9 to
      // pause at 90% of budget). Best-effort: default 1.0 (pause only at 100%),
      // which preserves prior behavior when no rules are configured.
      let pauseAtSpendPct = 1;
      try {
        const policySvc = getPluginService<
          { getPolicy?: () => Promise<AutonomyPolicyRecord> } | undefined
        >(strapi, 'autonomy-policy');
        if (typeof policySvc?.getPolicy === 'function') {
          const policy = await policySvc.getPolicy();
          const rules = (policy?.stop_loss_rules ?? {}) as Record<string, unknown>;
          const pct = Number(rules.pauseAtSpendPct);
          if (Number.isFinite(pct) && pct > 0 && pct <= 1) {
            pauseAtSpendPct = pct;
          }
        }
      } catch {
        // best-effort; keep default 1.0
      }

      const limit = Math.max(1, Math.min(200, Number(input.limit ?? 50)));
      const plans = await entityService.findMany<AdCampaignPlanRecord>(AD_CAMPAIGN_PLAN_UID, {
        filters: { status: 'active' },
        sort: [{ updatedAt: 'desc' }],
        limit,
      });

      for (const plan of plans) {
        summary.checked += 1;
        const dailyBudgetPln = toNumber(plan.daily_budget_pln, 0);
        const spend = await provider.fetchSpend(plan);

        if (!spend.ok) {
          summary.results.push({ id: plan.id, spendPln: 0, dailyBudgetPln, action: 'spend_unavailable' });
          await recordSystemAuditEvent(strapi, {
            action: 'ads.stop-loss.spend-check',
            outcome: 'skipped',
            severity: 'warn',
            resourceUid: AD_CAMPAIGN_PLAN_UID,
            resourceId: plan.id,
            metadata: { reason: spend.reason, platform: plan.platform },
          });
          continue;
        }

        const stopLossThresholdPln = dailyBudgetPln * pauseAtSpendPct;
        if (dailyBudgetPln > 0 && spend.spendPln >= stopLossThresholdPln) {
          await recordSystemAuditEvent(strapi, {
            action: 'ads.stop-loss.triggered',
            outcome: 'success',
            severity: 'warn',
            resourceUid: AD_CAMPAIGN_PLAN_UID,
            resourceId: plan.id,
            metadata: {
              platform: plan.platform,
              spendPln: spend.spendPln,
              dailyBudgetPln,
              pauseAtSpendPct,
              stopLossThresholdPln,
            },
          });
          await this.pause(plan.id);
          summary.pausedForStopLoss += 1;
          summary.results.push({ id: plan.id, spendPln: spend.spendPln, dailyBudgetPln, action: 'paused' });
        } else {
          summary.results.push({ id: plan.id, spendPln: spend.spendPln, dailyBudgetPln, action: 'ok' });
        }
      }

      return summary;
    },

    async activate(id: number): Promise<AdCampaignPlanRecord> {
      const plan = await entityService.findOne<AdCampaignPlanRecord>(AD_CAMPAIGN_PLAN_UID, id);
      if (!plan) {
        throw new Error('Nie znaleziono planu kampanii reklamowej.');
      }

      if (plan.status === 'active' && plan.provider_campaign_id) {
        await recordSystemAuditEvent(strapi, {
          action: 'ads.activate.noop',
          outcome: 'success',
          resourceUid: AD_CAMPAIGN_PLAN_UID,
          resourceId: id,
          metadata: {
            platform: plan.platform,
            reason: 'plan_already_active',
            providerCampaignId: plan.provider_campaign_id,
          },
        });
        return plan;
      }

      const policy = getPluginService<AutonomyPolicyService>(strapi, 'autonomy-policy');
      const decision = await policy.evaluate({
        action: 'ads.mutate',
        platform: plan.platform,
        estimatedCostPln: Number(plan.daily_budget_pln ?? 0),
        requiresBrandSafety: true,
        requiresLegalDisclaimer: true,
      });

      if (!decision.allowed) {
        return entityService.update<AdCampaignPlanRecord>(AD_CAMPAIGN_PLAN_UID, id, {
          data: {
            status: 'blocked',
            blocked_reason: decision.reason,
            stop_loss_state: {
              budgetImpactPln: decision.budgetImpactPln,
              policyDecision: decision.reason,
            },
          },
        });
      }

      if (['controlled', 'live'].includes(getAdsProviderMode())) {
        const providerStatus = getPluginService<ProviderStatusService | undefined>(strapi, 'provider-status');
        if (!providerStatus?.checkProviders) {
          return entityService.update<AdCampaignPlanRecord>(AD_CAMPAIGN_PLAN_UID, id, {
            data: {
              status: 'blocked',
              blocked_reason: 'provider_readiness_service_missing',
            },
          });
        }

        const providerDecision = await providerStatus.checkProviders({
          action: 'ads.mutate',
          platform: plan.platform,
        });
        if (!providerDecision.ready) {
          return entityService.update<AdCampaignPlanRecord>(AD_CAMPAIGN_PLAN_UID, id, {
            data: {
              status: 'blocked',
              blocked_reason: 'provider_readiness_blocked',
              stop_loss_state: {
                budgetImpactPln: decision.budgetImpactPln,
                policyDecision: decision.reason,
                providerReadiness: providerDecision,
              },
            },
          });
        }
      }

      const targetUrlPreflightError = await preflightTargetUrl(plan.target_url);
      if (targetUrlPreflightError) {
        return entityService.update<AdCampaignPlanRecord>(AD_CAMPAIGN_PLAN_UID, id, {
          data: {
            status: 'blocked',
            blocked_reason: targetUrlPreflightError,
            stop_loss_state: {
              budgetImpactPln: decision.budgetImpactPln,
              policyDecision: decision.reason,
              targetUrlPreflight: targetUrlPreflightError,
            },
          },
        });
      }

      const providerMode = getAdsProviderMode();
      await recordSystemAuditEvent(strapi, {
        action: 'ads.activate.attempt',
        outcome: 'success',
        resourceUid: AD_CAMPAIGN_PLAN_UID,
        resourceId: id,
        metadata: {
          platform: plan.platform,
          providerMode,
          dailyBudgetPln: plan.daily_budget_pln,
          liveSpendEnabled: false,
        },
      });
      const ledgerService = getPluginService<Partial<AdsBudgetLedgerService> | undefined>(
        strapi,
        'ads-budget-ledger'
      );
      let reservation:
        | Extract<Awaited<ReturnType<AdsBudgetLedgerService['reserveActivation']>>, { allowed: true }>
        | null = null;
      if (providerMode !== 'disabled') {
        if (typeof ledgerService?.reserveActivation !== 'function') {
          return entityService.update<AdCampaignPlanRecord>(AD_CAMPAIGN_PLAN_UID, id, {
            data: {
              status: 'blocked',
              blocked_reason: 'ads_budget_ledger_service_missing',
              stop_loss_state: {
                budgetImpactPln: decision.budgetImpactPln,
                policyDecision: decision.reason,
                providerMode,
              },
            },
          });
        }

        const reserved = await ledgerService.reserveActivation({
          plan,
          providerMode,
        });
        if (!reserved.allowed) {
          await recordSystemAuditEvent(strapi, {
            action: 'ads.activate.skipped',
            outcome: 'skipped',
            severity: 'warn',
            resourceUid: AD_CAMPAIGN_PLAN_UID,
            resourceId: id,
            metadata: {
              reason: reserved.reason,
              providerMode,
              totals: reserved.totals,
            },
          });
          return entityService.update<AdCampaignPlanRecord>(AD_CAMPAIGN_PLAN_UID, id, {
            data: {
              status: 'blocked',
              blocked_reason: reserved.reason,
              stop_loss_state: {
                budgetImpactPln: decision.budgetImpactPln,
                policyDecision: decision.reason,
                providerMode,
                adsLedger: reserved,
              },
            },
          });
        }

        reservation = reserved;
      }

      const provider = getPluginService<AdsProviderAdapterService>(strapi, 'ads-provider-adapter');
      const providerResult = await provider.createOrUpdateCampaign(plan);

      if (reservation && !providerResult.ok && typeof ledgerService?.release === 'function') {
        await ledgerService.release(reservation.ledger, {
          reason: providerResult.reason,
          metadata: {
            providerMode: providerResult.mode,
            providerDecision: providerResult.reason,
          },
        });
      }

      if (reservation && providerResult.ok && typeof ledgerService?.markApplied === 'function') {
        await ledgerService.markApplied(reservation.ledger, {
          providerDecision: providerResult.reason,
          providerCampaignId: providerResult.providerCampaignId,
          metadata: {
            providerMode: providerResult.mode,
            providerStatus: providerResult.status,
          },
        });
      }

      return entityService.update<AdCampaignPlanRecord>(AD_CAMPAIGN_PLAN_UID, id, {
        data: {
          status: providerResult.status,
          blocked_reason: providerResult.ok ? null : providerResult.reason,
          provider_campaign_id: providerResult.providerCampaignId,
          provider_adset_id: providerResult.providerAdsetId,
          provider_ad_id: providerResult.providerCreativeId,
          stop_loss_state: {
            policyDecision: decision.reason,
            providerMode: providerResult.mode,
            providerDecision: providerResult.reason,
            providerCallsEnabled: providerResult.mode === 'live',
            liveSpendEnabled: false,
            ...(reservation
              ? {
                  adsLedger: {
                    reason: reservation.reason,
                    ledgerId: reservation.ledger.id,
                    totals: reservation.totals,
                  },
                }
              : {}),
            ...(providerResult.providerPayload ?? {}),
          },
        },
      });
    },
  };
};

export default adsAgent;
