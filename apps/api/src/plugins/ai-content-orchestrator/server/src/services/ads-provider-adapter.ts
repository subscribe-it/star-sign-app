import { AD_CAMPAIGN_PLAN_UID } from '../constants';
import type { AdCampaignPlanRecord, AutonomyPolicyRecord, Strapi } from '../types';
import { recordSystemAuditEvent } from '../utils/audit-trail';
import { getPluginService } from '../utils/plugin';

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

type AdsSpendResult = {
  ok: boolean;
  mode: AdsProviderMode;
  reason: string;
  spendPln: number;
};

type AutonomyPolicyService = {
  getPolicy: () => Promise<AutonomyPolicyRecord>;
};

const normalizeApiVersion = (value: unknown, fallback: string): string => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

// API versions must be reviewed against provider deprecation schedules.
// Override via env without code changes when providers sunset a version.
const META_API_VERSION = normalizeApiVersion(
  process.env.AICO_META_GRAPH_API_VERSION,
  'v21.0',
);
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const GOOGLE_ADS_API_VERSION = normalizeApiVersion(
  process.env.AICO_GOOGLE_ADS_API_VERSION,
  'v18',
);
const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PROVIDER_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_PLATFORM_CAPS_PLN = { meta: 15, google: 10 } as const;
const GLOBAL_DAILY_CAP_PLN = 25;

const normalizeMode = (value: unknown): AdsProviderMode => {
  const mode = String(value ?? '').trim().toLowerCase();
  return mode === 'sandbox' || mode === 'controlled' || mode === 'live' ? mode : 'disabled';
};

const buildSandboxId = (prefix: string, plan: AdCampaignPlanRecord): string =>
  `sandbox_${prefix}_${plan.platform}_${plan.id}`;

const isTruthy = (value: unknown): boolean =>
  ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getRequestTimeoutMs = (): number => {
  const configured = Number(process.env.AICO_ADS_PROVIDER_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : PROVIDER_REQUEST_TIMEOUT_MS;
};

type ProviderHttpResult = {
  ok: boolean;
  reason: string;
  payload: Record<string, unknown>;
};

const fetchProviderJson = async (
  errorPrefix: string,
  url: string,
  init: RequestInit
): Promise<ProviderHttpResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getRequestTimeoutMs());

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    let payload: Record<string, unknown> = {};
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    if (!response.ok) {
      return { ok: false, reason: `${errorPrefix}_http_${response.status}`, payload };
    }

    return { ok: true, reason: 'ok', payload };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      ok: false,
      reason: aborted ? `${errorPrefix}_timeout` : `${errorPrefix}_request_failed`,
      payload: {},
    };
  } finally {
    clearTimeout(timer);
  }
};

const truncate = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;

const getCreativeCopy = (plan: AdCampaignPlanRecord): { headline: string; description: string } => {
  const payload = (plan.creative_payload ?? {}) as Record<string, unknown>;
  const headline =
    typeof payload.headline === 'string' && payload.headline.trim()
      ? payload.headline.trim()
      : plan.name;
  const description =
    typeof payload.description === 'string' && payload.description.trim()
      ? payload.description.trim()
      : typeof payload.message === 'string' && payload.message.trim()
        ? payload.message.trim()
        : 'Codzienne horoskopy i tarot online na Star-Sign.';

  return { headline, description };
};

const getMetaAdAccountId = (): string | null => {
  const raw = String(process.env.AICO_META_AD_ACCOUNT_ID ?? '').trim();
  if (!raw) return null;
  return raw.startsWith('act_') ? raw.slice(4) : raw;
};

const getGoogleCustomerId = (): string | null => {
  const raw = String(process.env.AICO_GOOGLE_ADS_CUSTOMER_ID ?? '').trim().replace(/-/g, '');
  return raw || null;
};

const adsProviderAdapter = ({ strapi }: { strapi: Strapi }) => {
  const getPlatformCapPln = async (platform: AdCampaignPlanRecord['platform']): Promise<number> => {
    let policy: AutonomyPolicyRecord | undefined;
    try {
      const policyService = getPluginService<Partial<AutonomyPolicyService> | undefined>(
        strapi,
        'autonomy-policy'
      );
      if (typeof policyService?.getPolicy === 'function') {
        policy = await policyService.getPolicy();
      }
    } catch {
      policy = undefined;
    }

    const platformCap =
      platform === 'meta'
        ? toNumber(policy?.daily_meta_ads_budget_pln, DEFAULT_PLATFORM_CAPS_PLN.meta)
        : toNumber(policy?.daily_google_ads_budget_pln, DEFAULT_PLATFORM_CAPS_PLN.google);
    const globalCap = toNumber(policy?.daily_ads_budget_pln, GLOBAL_DAILY_CAP_PLN);

    return Math.max(0, Math.min(platformCap, globalCap));
  };

  const getClampedDailyBudgetPln = async (plan: AdCampaignPlanRecord): Promise<number> => {
    const requested = Math.max(0, toNumber(plan.daily_budget_pln, 0));
    const cap = await getPlatformCapPln(plan.platform);
    return Math.min(requested, cap);
  };

  const auditProviderMutation = async (input: {
    plan: AdCampaignPlanRecord;
    operation: string;
    ok: boolean;
    reason: string;
    providerCampaignId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> => {
    await recordSystemAuditEvent(strapi, {
      action: `ads.provider.${input.operation}`,
      outcome: input.ok ? 'success' : 'skipped',
      severity: input.ok ? 'info' : 'warn',
      resourceUid: AD_CAMPAIGN_PLAN_UID,
      resourceId: input.plan.id,
      metadata: {
        provider: input.plan.platform === 'meta' ? 'meta_ads' : 'google_ads',
        platform: input.plan.platform,
        providerMode: 'live',
        providerDecision: input.reason,
        providerCampaignId: input.providerCampaignId ?? null,
        ...(input.metadata ?? {}),
      },
    });
  };

  const blockedLive = (reason: string, payload?: Record<string, unknown>): AdsProviderResult => ({
    ok: false,
    mode: 'live',
    status: 'blocked',
    reason,
    providerPayload: { liveSpendEnabled: false, ...(payload ?? {}) },
  });

  const checkLiveCredentials = (plan: AdCampaignPlanRecord): string | null => {
    if (plan.platform === 'meta') {
      if (!String(process.env.AICO_META_ADS_ACCESS_TOKEN ?? '').trim() || !getMetaAdAccountId()) {
        return 'meta_ads_credentials_missing';
      }
      return null;
    }

    const required = [
      'AICO_GOOGLE_ADS_DEVELOPER_TOKEN',
      'AICO_GOOGLE_ADS_CLIENT_ID',
      'AICO_GOOGLE_ADS_CLIENT_SECRET',
      'AICO_GOOGLE_ADS_REFRESH_TOKEN',
    ];
    if (required.some((key) => !String(process.env[key] ?? '').trim()) || !getGoogleCustomerId()) {
      return 'google_ads_credentials_missing';
    }
    return null;
  };

  // === Meta Marketing API ===

  const metaRequest = async (
    path: string,
    body: Record<string, unknown> | null,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<ProviderHttpResult> =>
    fetchProviderJson('meta_ads', `${META_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${String(process.env.AICO_META_ADS_ACCESS_TOKEN ?? '').trim()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  const createMetaCampaign = async (
    plan: AdCampaignPlanRecord,
    dailyBudgetPln: number
  ): Promise<AdsProviderResult> => {
    const accountId = getMetaAdAccountId();
    const campaign = await metaRequest(`/act_${accountId}/campaigns`, {
      name: plan.name,
      objective: 'OUTCOME_TRAFFIC',
      status: 'PAUSED',
      special_ad_categories: [],
    });
    if (!campaign.ok) {
      return blockedLive(campaign.reason, { providerResponse: campaign.payload });
    }
    const campaignId = String(campaign.payload.id ?? '');

    const adset = await metaRequest(`/act_${accountId}/adsets`, {
      name: `${plan.name} – adset`,
      campaign_id: campaignId,
      status: 'PAUSED',
      daily_budget: Math.round(dailyBudgetPln * 100),
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: { geo_locations: { countries: ['PL'] } },
    });
    if (!adset.ok) {
      return blockedLive(adset.reason, { providerCampaignId: campaignId, providerResponse: adset.payload });
    }
    const adsetId = String(adset.payload.id ?? '');

    const copy = getCreativeCopy(plan);
    const pageId = String(process.env.AICO_FACEBOOK_PAGE_ID ?? '').trim();
    const creative = await metaRequest(`/act_${accountId}/adcreatives`, {
      name: `${plan.name} – creative`,
      ...(pageId
        ? {
            object_story_spec: {
              page_id: pageId,
              link_data: {
                link: plan.target_url,
                message: copy.description,
                name: truncate(copy.headline, 40),
              },
            },
          }
        : {
            object_url: plan.target_url,
            title: truncate(copy.headline, 40),
            body: copy.description,
          }),
    });
    if (!creative.ok) {
      return blockedLive(creative.reason, { providerCampaignId: campaignId, providerResponse: creative.payload });
    }
    const creativeId = String(creative.payload.id ?? '');

    const ad = await metaRequest(`/act_${accountId}/ads`, {
      name: `${plan.name} – ad`,
      adset_id: adsetId,
      creative: { creative_id: creativeId },
      status: 'PAUSED',
    });
    if (!ad.ok) {
      return blockedLive(ad.reason, { providerCampaignId: campaignId, providerResponse: ad.payload });
    }

    return {
      ok: true,
      mode: 'live',
      status: 'ready',
      reason: 'live_meta_campaign_created_paused',
      providerCampaignId: campaignId,
      providerAdsetId: adsetId,
      providerCreativeId: creativeId,
      providerPayload: {
        liveSpendEnabled: false,
        providerStatus: 'PAUSED',
        dailyBudgetPln,
        dailyBudgetMinorUnits: Math.round(dailyBudgetPln * 100),
        adId: String(ad.payload.id ?? ''),
      },
    };
  };

  const setMetaCampaignStatus = async (
    plan: AdCampaignPlanRecord,
    status: 'PAUSED' | 'ACTIVE'
  ): Promise<ProviderHttpResult> => metaRequest(`/${plan.provider_campaign_id}`, { status });

  const fetchMetaSpendPln = async (plan: AdCampaignPlanRecord): Promise<AdsSpendResult> => {
    const insights = await metaRequest(
      `/${plan.provider_campaign_id}/insights?fields=spend&date_preset=today`,
      null,
      'GET'
    );
    if (!insights.ok) {
      return { ok: false, mode: 'live', reason: insights.reason, spendPln: 0 };
    }

    const rows = Array.isArray(insights.payload.data) ? (insights.payload.data as Array<Record<string, unknown>>) : [];
    const spendPln = rows.reduce((total, row) => total + toNumber(row.spend, 0), 0);
    return { ok: true, mode: 'live', reason: 'live_meta_spend_fetched', spendPln };
  };

  // === Google Ads API (REST) ===

  const getGoogleAccessToken = async (): Promise<{ token?: string; reason?: string }> => {
    const result = await fetchProviderJson('google_ads_oauth', GOOGLE_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: String(process.env.AICO_GOOGLE_ADS_CLIENT_ID ?? '').trim(),
        client_secret: String(process.env.AICO_GOOGLE_ADS_CLIENT_SECRET ?? '').trim(),
        refresh_token: String(process.env.AICO_GOOGLE_ADS_REFRESH_TOKEN ?? '').trim(),
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!result.ok) {
      return { reason: result.reason };
    }

    const token = String(result.payload.access_token ?? '');
    return token ? { token } : { reason: 'google_ads_oauth_token_missing' };
  };

  const googleRequest = async (
    accessToken: string,
    path: string,
    body: Record<string, unknown>
  ): Promise<ProviderHttpResult> => {
    const loginCustomerId = String(process.env.AICO_GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? '').trim().replace(/-/g, '');
    return fetchProviderJson('google_ads', `${GOOGLE_ADS_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': String(process.env.AICO_GOOGLE_ADS_DEVELOPER_TOKEN ?? '').trim(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(loginCustomerId ? { 'login-customer-id': loginCustomerId } : {}),
      },
      body: JSON.stringify(body),
    });
  };

  const firstMutateResourceName = (result: ProviderHttpResult): string => {
    if (!result.ok) return '';
    const results = Array.isArray(result.payload.results)
      ? (result.payload.results as Array<Record<string, unknown>>)
      : [];
    return String(results[0]?.resourceName ?? '');
  };

  const buildResponsiveSearchAd = (plan: AdCampaignPlanRecord): Record<string, unknown> => {
    const copy = getCreativeCopy(plan);
    const headlines = Array.from(
      new Set([
        truncate(copy.headline, 30),
        truncate(`Star-Sign – ${plan.objective ?? 'horoskopy'}`, 30),
        'Sprawdź swój horoskop',
      ])
    ).map((text) => ({ text }));
    const descriptions = Array.from(
      new Set([truncate(copy.description, 90), 'Horoskopy, tarot i numerologia po polsku.'])
    ).map((text) => ({ text }));

    return {
      finalUrls: [plan.target_url],
      responsiveSearchAd: { headlines, descriptions },
    };
  };

  const createGoogleCampaign = async (
    plan: AdCampaignPlanRecord,
    dailyBudgetPln: number
  ): Promise<AdsProviderResult> => {
    const auth = await getGoogleAccessToken();
    if (!auth.token) {
      return blockedLive(auth.reason ?? 'google_ads_oauth_failed');
    }
    const customerId = getGoogleCustomerId();
    const suffix = `${plan.id}_${Date.now()}`;

    const budget = await googleRequest(auth.token, `/customers/${customerId}/campaignBudgets:mutate`, {
      operations: [
        {
          create: {
            name: `aico_budget_${suffix}`,
            amountMicros: String(Math.round(dailyBudgetPln * 1_000_000)),
            deliveryMethod: 'STANDARD',
            explicitlyShared: false,
          },
        },
      ],
    });
    if (!budget.ok) {
      return blockedLive(budget.reason, { providerResponse: budget.payload });
    }
    const budgetResourceName = firstMutateResourceName(budget);

    const campaign = await googleRequest(auth.token, `/customers/${customerId}/campaigns:mutate`, {
      operations: [
        {
          create: {
            name: `aico_campaign_${suffix}`,
            status: 'PAUSED',
            advertisingChannelType: 'SEARCH',
            campaignBudget: budgetResourceName,
            manualCpc: {},
            networkSettings: {
              targetGoogleSearch: true,
              targetSearchNetwork: false,
              targetContentNetwork: false,
            },
          },
        },
      ],
    });
    if (!campaign.ok) {
      return blockedLive(campaign.reason, { providerResponse: campaign.payload });
    }
    const campaignResourceName = firstMutateResourceName(campaign);

    const adGroup = await googleRequest(auth.token, `/customers/${customerId}/adGroups:mutate`, {
      operations: [
        {
          create: {
            name: `aico_adgroup_${suffix}`,
            campaign: campaignResourceName,
            status: 'PAUSED',
            type: 'SEARCH_STANDARD',
          },
        },
      ],
    });
    if (!adGroup.ok) {
      return blockedLive(adGroup.reason, {
        providerCampaignId: campaignResourceName,
        providerResponse: adGroup.payload,
      });
    }
    const adGroupResourceName = firstMutateResourceName(adGroup);

    const ad = await googleRequest(auth.token, `/customers/${customerId}/adGroupAds:mutate`, {
      operations: [
        {
          create: {
            adGroup: adGroupResourceName,
            status: 'PAUSED',
            ad: buildResponsiveSearchAd(plan),
          },
        },
      ],
    });
    if (!ad.ok) {
      return blockedLive(ad.reason, {
        providerCampaignId: campaignResourceName,
        providerResponse: ad.payload,
      });
    }

    return {
      ok: true,
      mode: 'live',
      status: 'ready',
      reason: 'live_google_campaign_created_paused',
      providerCampaignId: campaignResourceName,
      providerAdsetId: adGroupResourceName,
      providerCreativeId: firstMutateResourceName(ad),
      providerPayload: {
        liveSpendEnabled: false,
        providerStatus: 'PAUSED',
        dailyBudgetPln,
        dailyBudgetMicros: Math.round(dailyBudgetPln * 1_000_000),
        campaignBudget: budgetResourceName,
      },
    };
  };

  const setGoogleCampaignStatus = async (
    plan: AdCampaignPlanRecord,
    status: 'PAUSED' | 'ENABLED'
  ): Promise<ProviderHttpResult> => {
    const auth = await getGoogleAccessToken();
    if (!auth.token) {
      return { ok: false, reason: auth.reason ?? 'google_ads_oauth_failed', payload: {} };
    }

    return googleRequest(auth.token, `/customers/${getGoogleCustomerId()}/campaigns:mutate`, {
      operations: [
        {
          update: {
            resourceName: plan.provider_campaign_id,
            status,
          },
          updateMask: 'status',
        },
      ],
    });
  };

  const fetchGoogleSpendPln = async (plan: AdCampaignPlanRecord): Promise<AdsSpendResult> => {
    const auth = await getGoogleAccessToken();
    if (!auth.token) {
      return { ok: false, mode: 'live', reason: auth.reason ?? 'google_ads_oauth_failed', spendPln: 0 };
    }

    const result = await googleRequest(
      auth.token,
      `/customers/${getGoogleCustomerId()}/googleAds:searchStream`,
      {
        query: `SELECT metrics.cost_micros FROM campaign WHERE campaign.resource_name = '${plan.provider_campaign_id}' AND segments.date DURING TODAY`,
      }
    );
    if (!result.ok) {
      return { ok: false, mode: 'live', reason: result.reason, spendPln: 0 };
    }

    const chunks = Array.isArray(result.payload)
      ? (result.payload as unknown as Array<Record<string, unknown>>)
      : [result.payload];
    let costMicros = 0;
    for (const chunk of chunks) {
      const rows = Array.isArray(chunk?.results) ? (chunk.results as Array<Record<string, unknown>>) : [];
      for (const row of rows) {
        const metrics = (row.metrics ?? {}) as Record<string, unknown>;
        costMicros += toNumber(metrics.costMicros ?? metrics.cost_micros, 0);
      }
    }

    return { ok: true, mode: 'live', reason: 'live_google_spend_fetched', spendPln: costMicros / 1_000_000 };
  };

  // === Live orchestration helpers ===

  const guardLiveGate = (plan: AdCampaignPlanRecord): AdsProviderResult | null => {
    if (!isTruthy(process.env.AICO_CONTROLLED_LIVE_ENABLED)) {
      return blockedLive('live_gate_not_enabled', {
        message: 'AICO_ADS_PROVIDER_MODE=live wymaga AICO_CONTROLLED_LIVE_ENABLED=true.',
      });
    }

    const credentialError = checkLiveCredentials(plan);
    if (credentialError) {
      return blockedLive(credentialError);
    }

    return null;
  };

  const liveCreateOrUpdate = async (plan: AdCampaignPlanRecord): Promise<AdsProviderResult> => {
    const gateError = guardLiveGate(plan);
    if (gateError) {
      await auditProviderMutation({
        plan,
        operation: 'create.blocked',
        ok: false,
        reason: gateError.reason,
      });
      return gateError;
    }

    // Idempotency: an already-active plan with provider ids is a no-op.
    if (plan.provider_campaign_id && plan.status === 'active') {
      const result: AdsProviderResult = {
        ok: true,
        mode: 'live',
        status: 'active',
        reason: 'live_campaign_already_active',
        providerCampaignId: plan.provider_campaign_id,
        providerAdsetId: plan.provider_adset_id ?? undefined,
        providerCreativeId: plan.provider_ad_id ?? undefined,
        providerPayload: { liveSpendEnabled: true, idempotentNoop: true },
      };
      await auditProviderMutation({
        plan,
        operation: 'activate.noop',
        ok: true,
        reason: result.reason,
        providerCampaignId: plan.provider_campaign_id,
      });
      return result;
    }

    // Existing paused/ready campaign with provider ids: explicit activation un-pauses it.
    if (plan.provider_campaign_id) {
      const resumed =
        plan.platform === 'meta'
          ? await setMetaCampaignStatus(plan, 'ACTIVE')
          : await setGoogleCampaignStatus(plan, 'ENABLED');
      const result: AdsProviderResult = resumed.ok
        ? {
            ok: true,
            mode: 'live',
            status: 'active',
            reason: 'live_campaign_resumed',
            providerCampaignId: plan.provider_campaign_id,
            providerAdsetId: plan.provider_adset_id ?? undefined,
            providerCreativeId: plan.provider_ad_id ?? undefined,
            providerPayload: { liveSpendEnabled: true, providerStatus: 'ACTIVE' },
          }
        : blockedLive(resumed.reason, {
            providerCampaignId: plan.provider_campaign_id,
            providerResponse: resumed.payload,
          });
      await auditProviderMutation({
        plan,
        operation: 'resume',
        ok: result.ok,
        reason: result.reason,
        providerCampaignId: plan.provider_campaign_id,
      });
      return result;
    }

    const dailyBudgetPln = await getClampedDailyBudgetPln(plan);
    if (dailyBudgetPln <= 0) {
      const result = blockedLive('live_budget_clamped_to_zero');
      await auditProviderMutation({ plan, operation: 'create.blocked', ok: false, reason: result.reason });
      return result;
    }

    const result =
      plan.platform === 'meta'
        ? await createMetaCampaign(plan, dailyBudgetPln)
        : await createGoogleCampaign(plan, dailyBudgetPln);
    await auditProviderMutation({
      plan,
      operation: 'create',
      ok: result.ok,
      reason: result.reason,
      providerCampaignId: result.providerCampaignId,
      metadata: { dailyBudgetPln },
    });
    return result;
  };

  const livePause = async (plan: AdCampaignPlanRecord): Promise<AdsProviderResult> => {
    if (!plan.provider_campaign_id) {
      // Nothing was ever created at the provider, so a local pause is safe.
      return {
        ok: true,
        mode: 'live',
        status: 'paused',
        reason: 'live_pause_noop_no_provider_campaign',
        providerPayload: { providerPaused: true, liveSpendEnabled: false },
      };
    }

    const credentialError = checkLiveCredentials(plan);
    if (credentialError) {
      const result = blockedLive(credentialError, { providerPaused: false });
      await auditProviderMutation({
        plan,
        operation: 'pause.blocked',
        ok: false,
        reason: result.reason,
        providerCampaignId: plan.provider_campaign_id,
      });
      return result;
    }

    const paused =
      plan.platform === 'meta'
        ? await setMetaCampaignStatus(plan, 'PAUSED')
        : await setGoogleCampaignStatus(plan, 'PAUSED');
    const result: AdsProviderResult = paused.ok
      ? {
          ok: true,
          mode: 'live',
          status: 'paused',
          reason: 'live_campaign_paused',
          providerCampaignId: plan.provider_campaign_id,
          providerAdsetId: plan.provider_adset_id ?? undefined,
          providerCreativeId: plan.provider_ad_id ?? undefined,
          providerPayload: { providerPaused: true, liveSpendEnabled: false, providerStatus: 'PAUSED' },
        }
      : blockedLive(paused.reason, {
          providerCampaignId: plan.provider_campaign_id,
          providerPaused: false,
          providerResponse: paused.payload,
        });
    await auditProviderMutation({
      plan,
      operation: 'pause',
      ok: result.ok,
      reason: result.reason,
      providerCampaignId: plan.provider_campaign_id,
    });
    return result;
  };

  return {
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
        try {
          return await liveCreateOrUpdate(plan);
        } catch (error) {
          return blockedLive('live_provider_mutation_failed', {
            errorMessage: error instanceof Error ? error.message : 'unknown_live_error',
          });
        }
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
        try {
          return await livePause(plan);
        } catch (error) {
          return blockedLive('live_provider_pause_failed', {
            providerPaused: false,
            errorMessage: error instanceof Error ? error.message : 'unknown_live_error',
          });
        }
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

    async fetchSpend(plan: AdCampaignPlanRecord): Promise<AdsSpendResult> {
      const mode = this.getMode();

      if (mode !== 'live') {
        return { ok: true, mode, reason: 'spend_not_tracked_outside_live', spendPln: 0 };
      }

      if (!plan.provider_campaign_id) {
        return { ok: true, mode, reason: 'spend_noop_no_provider_campaign', spendPln: 0 };
      }

      const credentialError = checkLiveCredentials(plan);
      if (credentialError) {
        return { ok: false, mode, reason: credentialError, spendPln: 0 };
      }

      try {
        return plan.platform === 'meta' ? await fetchMetaSpendPln(plan) : await fetchGoogleSpendPln(plan);
      } catch {
        return {
          ok: false,
          mode,
          reason: 'live_spend_fetch_failed',
          spendPln: 0,
        };
      }
    },
  };
};

export default adsProviderAdapter;
