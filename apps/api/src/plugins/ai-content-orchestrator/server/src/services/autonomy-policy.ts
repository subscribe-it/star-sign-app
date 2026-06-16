import {
  ADS_MUTATION_LEDGER_UID,
  AUTONOMY_POLICY_UID,
  DEFAULT_TIMEZONE,
  GENERATION_JOB_UID,
  PUBLICATION_TICKET_UID,
  SOCIAL_POST_TICKET_UID,
} from '../constants';
import type { AdsMutationLedgerRecord, AdsPlatform, AutonomyMode, AutonomyPolicyRecord, Strapi } from '../types';
import { formatDateInZone, startOfDayInZoneIso } from '../utils/date-time';
import { getEntityService } from '../utils/entity-service';

type AutonomyAction =
  | 'llm.generate'
  | 'media.generate'
  | 'video.generate'
  | 'content.publish'
  | 'social.publish'
  | 'ads.mutate';

type PolicyDecisionInput = {
  action: AutonomyAction;
  platform?: AdsPlatform | string;
  estimatedCostPln?: number;
  requiresBrandSafety?: boolean;
  requiresLegalDisclaimer?: boolean;
};

type PolicyDecision = {
  allowed: boolean;
  mode: AutonomyMode;
  reason: string;
  budgetImpactPln: number;
  policy: AutonomyPolicyRecord;
  counts: {
    generationJobsToday: number;
    llmRequestsToday: number;
    mediaJobsToday: number;
    videoJobsToday: number;
    autoPublishesToday: number;
    socialPostsToday: number;
    adsMutationsToday: number;
    adsSpendTodayPln: number;
  };
};

const GLOBAL_POLICY_KEY = 'global';
const DEFAULT_DAILY_ADS_BUDGET_PLN = 25;
const DEFAULT_META_ADS_BUDGET_PLN = 15;
const DEFAULT_GOOGLE_ADS_BUDGET_PLN = 10;
const DEFAULT_GUARDED_MAX_ADS_IMPACT_PCT = 0.4;

// Decision taxonomy: which actions are financially/operationally CRITICAL (real
// money / live exposure) vs NON_CRITICAL (content, organic social, generation —
// reversible, no live spend). In `guarded` mode the agent acts autonomously on
// non-critical actions within caps, but a critical action is only auto-approved
// when its impact is small (<= guarded_max_ads_impact_pct of the daily cap);
// larger critical actions require `full` mode. Unknown actions default to CRITICAL
// (fail-safe).
const NON_CRITICAL_ACTIONS = new Set([
  'llm.generate',
  'media.generate',
  'video.generate',
  'content.publish',
  'social.publish',
]);
const LLM_JOB_TYPES = ['article', 'horoscope', 'social_caption', 'ad_creative', 'homepage_slot'];
const ACTIVE_ADS_LEDGER_STATUSES = ['reserved', 'applied'];

const toNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const toBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const normalizePolicy = (policy: AutonomyPolicyRecord): AutonomyPolicyRecord => ({
  ...policy,
  autonomy_mode: policy.autonomy_mode ?? 'guarded',
  global_kill_switch: toBoolean(policy.global_kill_switch, false),
  daily_ads_budget_pln: toNumber(policy.daily_ads_budget_pln, DEFAULT_DAILY_ADS_BUDGET_PLN),
  daily_meta_ads_budget_pln: toNumber(policy.daily_meta_ads_budget_pln, DEFAULT_META_ADS_BUDGET_PLN),
  daily_google_ads_budget_pln: toNumber(policy.daily_google_ads_budget_pln, DEFAULT_GOOGLE_ADS_BUDGET_PLN),
  daily_llm_request_limit: toNumber(policy.daily_llm_request_limit, 120),
  daily_media_job_limit: toNumber(policy.daily_media_job_limit, 20),
  daily_video_job_limit: toNumber(policy.daily_video_job_limit, 3),
  max_auto_publish_per_day: toNumber(policy.max_auto_publish_per_day, 12),
  max_social_posts_per_day: toNumber(policy.max_social_posts_per_day, 10),
  max_ads_mutations_per_day: toNumber(policy.max_ads_mutations_per_day, 10),
  brand_safety_required: toBoolean(policy.brand_safety_required, true),
  legal_disclaimer_required: toBoolean(policy.legal_disclaimer_required, true),
  no_sensitive_targeting: toBoolean(policy.no_sensitive_targeting, true),
  guarded_max_ads_impact_pct: Math.min(
    1,
    Math.max(0, toNumber(policy.guarded_max_ads_impact_pct, DEFAULT_GUARDED_MAX_ADS_IMPACT_PCT))
  ),
  ads_stop_loss_on_tick: toBoolean(policy.ads_stop_loss_on_tick, true),
  auto_apply_experiments: toBoolean(policy.auto_apply_experiments, false),
});

const autonomyPolicy = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  return {
    async getPolicy(): Promise<AutonomyPolicyRecord> {
      const existing = await entityService.findMany<AutonomyPolicyRecord>(AUTONOMY_POLICY_UID, {
        filters: { policy_key: GLOBAL_POLICY_KEY },
        limit: 1,
      });

      if (existing[0]) {
        return normalizePolicy(existing[0]);
      }

      const created = await entityService.create<AutonomyPolicyRecord>(AUTONOMY_POLICY_UID, {
        data: {
          policy_key: GLOBAL_POLICY_KEY,
          autonomy_mode: 'guarded',
          daily_ads_budget_pln: DEFAULT_DAILY_ADS_BUDGET_PLN,
          daily_meta_ads_budget_pln: DEFAULT_META_ADS_BUDGET_PLN,
          daily_google_ads_budget_pln: DEFAULT_GOOGLE_ADS_BUDGET_PLN,
          brand_safety_required: true,
          legal_disclaimer_required: true,
          no_sensitive_targeting: true,
        },
      });

      return normalizePolicy(created);
    },

    async updatePolicy(input: Partial<AutonomyPolicyRecord>): Promise<AutonomyPolicyRecord> {
      const policy = await this.getPolicy();
      const updated = await entityService.update<AutonomyPolicyRecord>(AUTONOMY_POLICY_UID, policy.id, {
        data: {
          ...input,
          policy_key: GLOBAL_POLICY_KEY,
        },
      });

      return normalizePolicy(updated);
    },

    async getCounts(): Promise<PolicyDecision['counts']> {
      const now = new Date();
      // Align daily windows with the business day in the workflow time zone so the
      // spend cap reads the same `day` the ledger writes (was UTC → off-by-one near midnight).
      const dayStart = startOfDayInZoneIso(now, DEFAULT_TIMEZONE);
      const businessDay = formatDateInZone(now, DEFAULT_TIMEZONE);
      const [
        generationJobsToday,
        llmRequestsToday,
        mediaJobsToday,
        videoJobsToday,
        autoPublishesToday,
        socialPostsToday,
        adsMutationsToday,
        activeAdsLedger,
      ] =
        await Promise.all([
          entityService.count(GENERATION_JOB_UID, {
            filters: { createdAt: { $gte: dayStart } },
          }),
          entityService.count(GENERATION_JOB_UID, {
            filters: { job_type: { $in: LLM_JOB_TYPES }, createdAt: { $gte: dayStart } },
          }),
          entityService.count(GENERATION_JOB_UID, {
            filters: { job_type: 'image', createdAt: { $gte: dayStart } },
          }),
          entityService.count(GENERATION_JOB_UID, {
            filters: { job_type: 'video', createdAt: { $gte: dayStart } },
          }),
          entityService.count(PUBLICATION_TICKET_UID, {
            filters: { createdAt: { $gte: dayStart } },
          }),
          entityService.count(SOCIAL_POST_TICKET_UID, {
            filters: { createdAt: { $gte: dayStart } },
          }),
          entityService.count(ADS_MUTATION_LEDGER_UID, {
            filters: { day: businessDay, operation: 'activate' },
          }),
          entityService.findMany<AdsMutationLedgerRecord>(ADS_MUTATION_LEDGER_UID, {
            filters: {
              day: businessDay,
              status: { $in: ACTIVE_ADS_LEDGER_STATUSES },
            },
            fields: ['amount_pln'],
            limit: 500,
          }),
        ]);

      const adsSpendTodayPln = activeAdsLedger.reduce(
        (sum, ledger) => sum + toNumber(ledger.amount_pln, 0),
        0
      );

      return {
        generationJobsToday,
        llmRequestsToday,
        mediaJobsToday,
        videoJobsToday,
        autoPublishesToday,
        socialPostsToday,
        adsMutationsToday,
        adsSpendTodayPln,
      };
    },

    async evaluate(input: PolicyDecisionInput): Promise<PolicyDecision> {
      const [policy, counts] = await Promise.all([this.getPolicy(), this.getCounts()]);
      const mode = policy.autonomy_mode;
      const budgetImpactPln = toNumber(input.estimatedCostPln, 0);

      if (policy.global_kill_switch || mode === 'off') {
        return {
          allowed: false,
          mode,
          reason: 'global_kill_switch_or_off_mode',
          budgetImpactPln,
          policy,
          counts,
        };
      }

      if (mode === 'draft_only' && ['content.publish', 'social.publish', 'ads.mutate'].includes(input.action)) {
        return {
          allowed: false,
          mode,
          reason: 'draft_only_blocks_live_effects',
          budgetImpactPln,
          policy,
          counts,
        };
      }

      if (policy.brand_safety_required && input.requiresBrandSafety === false) {
        return {
          allowed: false,
          mode,
          reason: 'brand_safety_required',
          budgetImpactPln,
          policy,
          counts,
        };
      }

      if (policy.legal_disclaimer_required && input.requiresLegalDisclaimer === false) {
        return {
          allowed: false,
          mode,
          reason: 'legal_disclaimer_required',
          budgetImpactPln,
          policy,
          counts,
        };
      }

      if (input.action === 'llm.generate' && counts.llmRequestsToday >= (policy.daily_llm_request_limit ?? 120)) {
        return {
          allowed: false,
          mode,
          reason: 'llm_daily_cap_reached',
          budgetImpactPln,
          policy,
          counts,
        };
      }

      if (input.action === 'media.generate' && counts.mediaJobsToday >= (policy.daily_media_job_limit ?? 20)) {
        return {
          allowed: false,
          mode,
          reason: 'media_daily_cap_reached',
          budgetImpactPln,
          policy,
          counts,
        };
      }

      if (input.action === 'video.generate' && counts.videoJobsToday >= (policy.daily_video_job_limit ?? 3)) {
        return {
          allowed: false,
          mode,
          reason: 'video_daily_cap_reached',
          budgetImpactPln,
          policy,
          counts,
        };
      }

      if (
        input.action === 'content.publish' &&
        counts.autoPublishesToday >= (policy.max_auto_publish_per_day ?? 12)
      ) {
        return {
          allowed: false,
          mode,
          reason: 'auto_publish_daily_cap_reached',
          budgetImpactPln,
          policy,
          counts,
        };
      }

      if (input.action === 'social.publish' && counts.socialPostsToday >= (policy.max_social_posts_per_day ?? 10)) {
        return {
          allowed: false,
          mode,
          reason: 'social_daily_cap_reached',
          budgetImpactPln,
          policy,
          counts,
        };
      }

      if (input.action === 'ads.mutate') {
        const globalCap = toNumber(policy.daily_ads_budget_pln, DEFAULT_DAILY_ADS_BUDGET_PLN);
        const platformCap =
          input.platform === 'meta'
            ? toNumber(policy.daily_meta_ads_budget_pln, DEFAULT_META_ADS_BUDGET_PLN)
            : input.platform === 'google'
              ? toNumber(policy.daily_google_ads_budget_pln, DEFAULT_GOOGLE_ADS_BUDGET_PLN)
              : globalCap;

        // Critical-action gate: in `guarded` the agent only auto-approves
        // low-impact live spend; larger spend is critical and needs `full` mode.
        if (mode === 'guarded') {
          const guardedMaxImpactPct = Math.min(
            1,
            Math.max(0, toNumber(policy.guarded_max_ads_impact_pct, DEFAULT_GUARDED_MAX_ADS_IMPACT_PCT))
          );
          if (budgetImpactPln > guardedMaxImpactPct * globalCap) {
            return {
              allowed: false,
              mode,
              reason: 'guarded_blocks_high_impact_ads',
              budgetImpactPln,
              policy,
              counts,
            };
          }
        }

        if (counts.adsMutationsToday >= (policy.max_ads_mutations_per_day ?? 10)) {
          return {
            allowed: false,
            mode,
            reason: 'ads_mutation_daily_cap_reached',
            budgetImpactPln,
            policy,
            counts,
          };
        }

        if (budgetImpactPln > platformCap || counts.adsSpendTodayPln + budgetImpactPln > globalCap) {
          return {
            allowed: false,
            mode,
            reason: 'ads_budget_cap_exceeded',
            budgetImpactPln,
            policy,
            counts,
          };
        }
      }

      return {
        allowed: true,
        mode,
        reason: 'allowed',
        budgetImpactPln,
        policy,
        counts,
      };
    },
  };
};

export default autonomyPolicy;
