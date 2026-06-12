import { AUTONOMY_POLICY_UID } from '../constants';
import type { AutonomyPolicyRecord, ProviderKey, Strapi } from '../types';
import { getPluginService } from '../utils/plugin';

type PolicyDecision = {
  allowed: boolean;
  reason: string;
  budgetImpactPln: number;
};

type AutonomyPolicyService = {
  getPolicy: () => Promise<AutonomyPolicyRecord>;
  evaluate: (input: {
    action:
      | 'llm.generate'
      | 'media.generate'
      | 'video.generate'
      | 'content.publish'
      | 'social.publish'
      | 'ads.mutate';
    platform?: string;
    estimatedCostPln?: number;
    requiresBrandSafety?: boolean;
    requiresLegalDisclaimer?: boolean;
  }) => Promise<PolicyDecision>;
};

type TrafficIngestorService = {
  importFirstParty: (input: { dryRun?: boolean }) => Promise<Record<string, unknown>>;
};

type StrategyPlannerService = {
  runAutopilot?: (input?: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

type ProviderReadiness = {
  provider: ProviderKey;
  status: string;
  ready: boolean;
  hasCredentials: boolean;
  blockedReason?: string | null;
};

type ProviderStatusService = {
  getReadinessMatrix?: () => Promise<ProviderReadiness[]>;
  checkProviders?: (input: {
    action: string;
    platform?: string;
    providers?: ProviderKey[];
  }) => Promise<{
    ready: boolean;
    requiredProviders: ProviderKey[];
    blockedProviders: ProviderReadiness[];
  }>;
};

type AutopilotStep = {
  id: string;
  label: string;
  status: 'planned' | 'allowed' | 'blocked' | 'skipped';
  reason?: string;
  output?: Record<string, unknown>;
};

type AutopilotTickResult = {
  dryRun: boolean;
  policy: {
    id: number;
    mode: AutonomyPolicyRecord['autonomy_mode'];
    globalKillSwitch: boolean;
    dailyAdsBudgetPln: number;
  };
  providerReadiness: ProviderReadiness[];
  steps: AutopilotStep[];
  liveEffects: false;
};

const SOCIAL_PROVIDER_BY_CHANNEL: Record<string, ProviderKey> = {
  facebook: 'facebook',
  instagram: 'instagram',
  twitter: 'twitter',
  tiktok: 'tiktok',
  youtube_shorts: 'youtube',
};

const getRuntimeSocialProviders = (): ProviderKey[] => {
  const channels = String(process.env.AICO_SOCIAL_CHANNELS ?? 'facebook,instagram,twitter')
    .split(',')
    .map((channel) => channel.trim().toLowerCase())
    .filter(Boolean);
  const providers = channels
    .map((channel) => SOCIAL_PROVIDER_BY_CHANNEL[channel])
    .filter((provider): provider is ProviderKey => Boolean(provider));

  return Array.from(new Set(providers));
};

const toNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const autopilot = ({ strapi }: { strapi: Strapi }) => {
  return {
    async dryRunTick(): Promise<AutopilotTickResult> {
      const policyService = getPluginService<AutonomyPolicyService>(strapi, 'autonomy-policy');
      const trafficIngestor = getPluginService<TrafficIngestorService>(strapi, 'traffic-ingestor');
      const strategyPlanner = getPluginService<StrategyPlannerService>(strapi, 'strategy-planner');
      const providerStatus = getPluginService<ProviderStatusService | undefined>(strapi, 'provider-status');
      const policy = await policyService.getPolicy();
      const providerReadiness =
        typeof providerStatus?.getReadinessMatrix === 'function'
          ? await providerStatus.getReadinessMatrix()
          : [];

      const steps: AutopilotStep[] = [];

      const pushDecision = async (
        id: string,
        label: string,
        decisionInput: Parameters<AutonomyPolicyService['evaluate']>[0],
        output?: Record<string, unknown>,
        providers?: ProviderKey[]
      ): Promise<void> => {
        const decision = await policyService.evaluate(decisionInput);
        const providerDecision =
          decision.allowed && typeof providerStatus?.checkProviders === 'function'
            ? await providerStatus.checkProviders({
                action: decisionInput.action,
                platform: decisionInput.platform,
                providers,
              })
            : { ready: true, requiredProviders: [], blockedProviders: [] };
        steps.push({
          id,
          label,
          status: decision.allowed && providerDecision.ready ? 'allowed' : 'blocked',
          reason: decision.allowed
            ? providerDecision.ready
              ? decision.reason
              : 'provider_readiness_blocked'
            : decision.reason,
          output: {
            ...(output ?? {}),
            requiredProviders: providerDecision.requiredProviders,
            blockedProviders: providerDecision.blockedProviders.map((provider) => ({
              provider: provider.provider,
              status: provider.status,
              blockedReason: provider.blockedReason,
            })),
          },
        });
      };

      const traffic = await trafficIngestor.importFirstParty({ dryRun: true });
      steps.push({
        id: 'traffic-ingestor',
        label: 'Import first-party traffic snapshot',
        status: 'planned',
        reason: 'dry_run_no_write',
        output: traffic,
      });

      steps.push({
        id: 'strategy-agent',
        label: 'Refresh full stack growth strategy',
        status: strategyPlanner.runAutopilot ? 'planned' : 'skipped',
        reason: strategyPlanner.runAutopilot ? 'dry_run_strategy_available' : 'strategy_autopilot_not_available',
        output: { backlogTargets: ['content', 'social', 'video', 'ads', 'homepage'] },
      });

      await pushDecision('editorial-agent', 'Generate editorial content via OpenRouter', {
        action: 'llm.generate',
        requiresBrandSafety: true,
        requiresLegalDisclaimer: true,
      });
      await pushDecision('creative-agent', 'Generate or select image asset', {
        action: 'media.generate',
        requiresBrandSafety: true,
      });
      await pushDecision('video-agent', 'Create short video job', {
        action: 'video.generate',
        requiresBrandSafety: true,
        requiresLegalDisclaimer: true,
      });
      await pushDecision('publication-agent', 'Publish approved Strapi content', {
        action: 'content.publish',
        requiresBrandSafety: true,
        requiresLegalDisclaimer: true,
      });
      await pushDecision('social-agent', 'Publish organic social tickets', {
        action: 'social.publish',
        requiresBrandSafety: true,
        requiresLegalDisclaimer: true,
      }, undefined, getRuntimeSocialProviders());
      await pushDecision('ads-agent-meta', 'Mutate capped Meta Ads campaign', {
        action: 'ads.mutate',
        platform: 'meta',
        estimatedCostPln: 15,
        requiresBrandSafety: true,
        requiresLegalDisclaimer: true,
      });
      await pushDecision('ads-agent-google', 'Mutate capped Google Ads campaign', {
        action: 'ads.mutate',
        platform: 'google',
        estimatedCostPln: 10,
        requiresBrandSafety: true,
        requiresLegalDisclaimer: true,
      });
      steps.push({
        id: 'homepage-agent',
        label: 'Refresh homepage recommendations',
        status: 'planned',
        reason: 'dry_run_no_write',
        output: { source: 'traffic_and_strategy_feedback' },
      });

      strapi
        .plugin('ai-content-orchestrator')
        .service('audit-trail')
        .record?.({
          action: 'autopilot.tick.dry-run',
          outcome: 'success',
          actor: { actorType: 'system' },
          resourceUid: AUTONOMY_POLICY_UID,
          resourceId: policy.id,
          metadata: {
            steps: steps.map((step) => ({
              id: step.id,
              status: step.status,
              reason: step.reason,
            })),
          },
        });

      return {
        dryRun: true,
        policy: {
          id: policy.id,
          mode: policy.autonomy_mode,
        globalKillSwitch: Boolean(policy.global_kill_switch),
          dailyAdsBudgetPln: toNumber(policy.daily_ads_budget_pln, 25),
        },
        providerReadiness,
        steps,
        liveEffects: false,
      };
    },
  };
};

export default autopilot;
