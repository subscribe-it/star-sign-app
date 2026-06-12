import type { AdCampaignPlanRecord, Strapi } from '../types';

type AdsProviderMode = 'disabled' | 'sandbox' | 'controlled' | 'live';

type AdsProviderResult = {
  ok: boolean;
  mode: AdsProviderMode;
  status: 'ready' | 'active' | 'paused' | 'blocked';
  reason: string;
  providerCampaignId?: string;
  providerAdsetId?: string;
  providerCreativeId?: string;
  providerPayload?: Record<string, unknown>;
};

const normalizeMode = (value: unknown): AdsProviderMode => {
  const mode = String(value ?? '').trim().toLowerCase();
  return mode === 'sandbox' || mode === 'controlled' || mode === 'live' ? mode : 'disabled';
};

const buildSandboxId = (prefix: string, plan: AdCampaignPlanRecord): string =>
  `sandbox_${prefix}_${plan.platform}_${plan.id}`;

const isTruthy = (value: unknown): boolean =>
  ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());

const adsProviderAdapter = (_input: { strapi: Strapi }) => ({
  getMode(): AdsProviderMode {
    return normalizeMode(process.env.AICO_ADS_PROVIDER_MODE);
  },

  async createOrUpdateCampaign(plan: AdCampaignPlanRecord): Promise<AdsProviderResult> {
    const mode = this.getMode();

    if (mode === 'disabled') {
      return {
        ok: false,
        mode,
        status: 'blocked',
        reason: 'provider_adapter_not_enabled',
      };
    }

    if (mode === 'live') {
      return {
        ok: false,
        mode,
        status: 'blocked',
        reason: 'provider_adapter_live_not_implemented',
        providerPayload: {
          liveProviderCallsEnabled: false,
          message: 'Live Meta/Google Ads mutations require a dedicated adapter and controlled smoke.',
        },
      };
    }

    if (mode === 'controlled') {
      if (!isTruthy(process.env.AICO_CONTROLLED_LIVE_ENABLED)) {
        return {
          ok: false,
          mode,
          status: 'blocked',
          reason: 'controlled_live_not_enabled',
        };
      }

      return {
        ok: true,
        mode,
        status: 'ready',
        reason: 'controlled_ads_preflight_passed',
        providerCampaignId: `controlled_${plan.platform}_campaign_${plan.id}`,
        providerAdsetId: `controlled_${plan.platform}_adset_${plan.id}`,
        providerCreativeId: `controlled_${plan.platform}_creative_${plan.id}`,
        providerPayload: {
          providerCallsEnabled: false,
          liveSpendEnabled: false,
          controlledExternalMutation: false,
          plannedProviderStatus: 'PAUSED',
          noSensitiveTargeting: true,
          dailyBudgetPln: plan.daily_budget_pln,
        },
      };
    }

    return {
      ok: true,
      mode,
      status: 'active',
      reason: 'sandbox_campaign_created',
      providerCampaignId: buildSandboxId('campaign', plan),
      providerAdsetId: buildSandboxId('adset', plan),
      providerCreativeId: buildSandboxId('creative', plan),
      providerPayload: {
        sandbox: true,
        liveSpendEnabled: false,
        dailyBudgetPln: plan.daily_budget_pln,
        targetUrl: plan.target_url,
      },
    };
  },

  async pauseCampaign(plan: AdCampaignPlanRecord): Promise<AdsProviderResult> {
    const mode = this.getMode();

    if (mode === 'live') {
      return {
        ok: false,
        mode,
        status: 'blocked',
        reason: 'provider_pause_live_not_implemented',
        providerPayload: {
          liveProviderCallsEnabled: false,
          providerPaused: false,
          message: 'Live Meta/Google Ads pause requires a dedicated provider adapter before local status can be paused.',
        },
      };
    }

    if (mode === 'controlled') {
      return {
        ok: true,
        mode,
        status: 'paused',
        reason: 'controlled_ads_pause_noop',
        providerCampaignId: plan.provider_campaign_id ?? `controlled_${plan.platform}_campaign_${plan.id}`,
        providerAdsetId: plan.provider_adset_id ?? `controlled_${plan.platform}_adset_${plan.id}`,
        providerCreativeId: plan.provider_ad_id ?? `controlled_${plan.platform}_creative_${plan.id}`,
        providerPayload: {
          providerCallsEnabled: false,
          liveSpendEnabled: false,
          controlledExternalMutation: false,
          providerPaused: true,
          plannedProviderStatus: 'PAUSED',
        },
      };
    }

    if (mode === 'sandbox') {
      return {
        ok: true,
        mode,
        status: 'paused',
        reason: 'sandbox_campaign_paused',
        providerCampaignId: plan.provider_campaign_id ?? buildSandboxId('campaign', plan),
        providerAdsetId: plan.provider_adset_id ?? buildSandboxId('adset', plan),
        providerCreativeId: plan.provider_ad_id ?? buildSandboxId('creative', plan),
        providerPayload: {
          sandbox: true,
          providerPaused: true,
          liveSpendEnabled: false,
        },
      };
    }

    return {
      ok: true,
      mode,
      status: 'paused',
      reason: 'provider_pause_noop_adapter_disabled',
      providerPayload: {
        providerCallsEnabled: false,
        providerPaused: true,
        liveSpendEnabled: false,
      },
    };
  },
});

export default adsProviderAdapter;
