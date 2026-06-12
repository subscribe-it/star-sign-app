import { afterEach, describe, expect, it, vi } from 'vitest';

import { AD_CAMPAIGN_PLAN_UID, PLUGIN_ID } from '../constants';
import adsAgent from '../services/ads-agent';
import adsProviderAdapter from '../services/ads-provider-adapter';
import productionReadiness from '../services/production-readiness';
import providerProbe from '../services/provider-probe';
import type { AdCampaignPlanRecord, Strapi } from '../types';

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
    log: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  }) as unknown as Strapi;

const jsonResponse = (payload: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});

const stubLiveMetaEnv = () => {
  vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'live');
  vi.stubEnv('AICO_CONTROLLED_LIVE_ENABLED', 'true');
  vi.stubEnv('AICO_AUDIT_TRAIL_STRICT', '');
  vi.stubEnv('AICO_META_ADS_ACCESS_TOKEN', 'meta-live-token');
  vi.stubEnv('AICO_META_AD_ACCOUNT_ID', 'act_987654321');
  vi.stubEnv('AICO_FACEBOOK_PAGE_ID', '');
};

const stubLiveGoogleEnv = () => {
  vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'live');
  vi.stubEnv('AICO_CONTROLLED_LIVE_ENABLED', 'true');
  vi.stubEnv('AICO_AUDIT_TRAIL_STRICT', '');
  vi.stubEnv('AICO_GOOGLE_ADS_DEVELOPER_TOKEN', 'google-dev-token');
  vi.stubEnv('AICO_GOOGLE_ADS_CLIENT_ID', 'google-client-id');
  vi.stubEnv('AICO_GOOGLE_ADS_CLIENT_SECRET', 'google-client-secret');
  vi.stubEnv('AICO_GOOGLE_ADS_REFRESH_TOKEN', 'google-refresh-token');
  vi.stubEnv('AICO_GOOGLE_ADS_CUSTOMER_ID', '111-222-3333');
  vi.stubEnv('AICO_GOOGLE_ADS_LOGIN_CUSTOMER_ID', '');
};

const metaPlan = (overrides: Partial<AdCampaignPlanRecord> = {}): AdCampaignPlanRecord => ({
  id: 101,
  name: 'Star-Sign premium',
  platform: 'meta',
  status: 'ready',
  target_url: 'https://star-sign.pl/premium',
  daily_budget_pln: 20,
  creative_payload: { headline: 'Horoskop premium', description: 'Codzienny horoskop premium dla Ciebie.' },
  ...overrides,
});

const googlePlan = (overrides: Partial<AdCampaignPlanRecord> = {}): AdCampaignPlanRecord => ({
  id: 202,
  name: 'Star-Sign search',
  platform: 'google',
  status: 'ready',
  target_url: 'https://star-sign.pl/premium',
  daily_budget_pln: 20,
  creative_payload: { headline: 'Horoskop premium', description: 'Codzienny horoskop premium dla Ciebie.' },
  ...overrides,
});

describe('live ads provider adapter', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('creates live Meta campaign chain always PAUSED with budget clamped to platform cap', async () => {
    stubLiveMetaEnv();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'camp_1' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'adset_1' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'creative_1' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'ad_1' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await adsProviderAdapter({ strapi: createStrapi({}, {}) }).createOrUpdateCampaign(
      metaPlan()
    );

    expect(result).toMatchObject({
      ok: true,
      mode: 'live',
      status: 'ready',
      reason: 'live_meta_campaign_created_paused',
      providerCampaignId: 'camp_1',
      providerAdsetId: 'adset_1',
      providerCreativeId: 'creative_1',
      providerPayload: expect.objectContaining({
        liveSpendEnabled: false,
        providerStatus: 'PAUSED',
        dailyBudgetPln: 15,
        dailyBudgetMinorUnits: 1500,
      }),
    });

    const [campaignUrl, campaignInit] = fetchMock.mock.calls[0];
    expect(campaignUrl).toBe('https://graph.facebook.com/v21.0/act_987654321/campaigns');
    expect(JSON.parse(campaignInit.body)).toMatchObject({ status: 'PAUSED', objective: 'OUTCOME_TRAFFIC' });
    expect(campaignInit.headers.Authorization).toBe('Bearer meta-live-token');

    const [, adsetInit] = fetchMock.mock.calls[1];
    expect(JSON.parse(adsetInit.body)).toMatchObject({
      status: 'PAUSED',
      campaign_id: 'camp_1',
      daily_budget: 1500,
    });

    const [, adInit] = fetchMock.mock.calls[3];
    expect(JSON.parse(adInit.body)).toMatchObject({ status: 'PAUSED', creative: { creative_id: 'creative_1' } });
  });

  it('creates live Google campaign chain always PAUSED with budget clamped to platform cap', async () => {
    stubLiveGoogleEnv();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'google-access-token' }))
      .mockResolvedValueOnce(jsonResponse({ results: [{ resourceName: 'customers/1112223333/campaignBudgets/9' }] }))
      .mockResolvedValueOnce(jsonResponse({ results: [{ resourceName: 'customers/1112223333/campaigns/77' }] }))
      .mockResolvedValueOnce(jsonResponse({ results: [{ resourceName: 'customers/1112223333/adGroups/88' }] }))
      .mockResolvedValueOnce(jsonResponse({ results: [{ resourceName: 'customers/1112223333/adGroupAds/88~1' }] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await adsProviderAdapter({ strapi: createStrapi({}, {}) }).createOrUpdateCampaign(
      googlePlan()
    );

    expect(result).toMatchObject({
      ok: true,
      mode: 'live',
      status: 'ready',
      reason: 'live_google_campaign_created_paused',
      providerCampaignId: 'customers/1112223333/campaigns/77',
      providerAdsetId: 'customers/1112223333/adGroups/88',
      providerPayload: expect.objectContaining({
        liveSpendEnabled: false,
        providerStatus: 'PAUSED',
        dailyBudgetPln: 10,
        dailyBudgetMicros: 10_000_000,
      }),
    });

    const [budgetUrl, budgetInit] = fetchMock.mock.calls[1];
    expect(budgetUrl).toBe('https://googleads.googleapis.com/v18/customers/1112223333/campaignBudgets:mutate');
    expect(budgetInit.headers['developer-token']).toBe('google-dev-token');
    expect(JSON.parse(budgetInit.body).operations[0].create.amountMicros).toBe('10000000');

    const [, campaignInit] = fetchMock.mock.calls[2];
    expect(JSON.parse(campaignInit.body).operations[0].create).toMatchObject({
      status: 'PAUSED',
      advertisingChannelType: 'SEARCH',
      campaignBudget: 'customers/1112223333/campaignBudgets/9',
    });

    const [, adInit] = fetchMock.mock.calls[4];
    const adCreate = JSON.parse(adInit.body).operations[0].create;
    expect(adCreate.status).toBe('PAUSED');
    expect(adCreate.ad.finalUrls).toEqual(['https://star-sign.pl/premium']);
    expect(adCreate.ad.responsiveSearchAd.headlines.length).toBeGreaterThanOrEqual(3);
    expect(adCreate.ad.responsiveSearchAd.descriptions.length).toBeGreaterThanOrEqual(2);
  });

  it('blocks live mutations without the controlled live gate and without provider calls', async () => {
    stubLiveMetaEnv();
    vi.stubEnv('AICO_CONTROLLED_LIVE_ENABLED', 'false');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await adsProviderAdapter({ strapi: createStrapi({}, {}) }).createOrUpdateCampaign(
      metaPlan()
    );

    expect(result).toMatchObject({
      ok: false,
      mode: 'live',
      status: 'blocked',
      reason: 'live_gate_not_enabled',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps live provider HTTP errors to a blocked result without throwing', async () => {
    stubLiveMetaEnv();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(jsonResponse({ error: { message: 'bad request' } }, 400))
    );

    const result = await adsProviderAdapter({ strapi: createStrapi({}, {}) }).createOrUpdateCampaign(
      metaPlan()
    );

    expect(result).toMatchObject({
      ok: false,
      mode: 'live',
      status: 'blocked',
      reason: 'meta_ads_http_400',
    });
  });

  it('pauses a live Meta campaign through the provider API', async () => {
    stubLiveMetaEnv();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    const auditTrailService = { record: vi.fn(async () => null) };

    const result = await adsProviderAdapter({
      strapi: createStrapi({ 'audit-trail': auditTrailService }, {}),
    }).pauseCampaign(metaPlan({ status: 'active', provider_campaign_id: 'camp_live_1' }));

    expect(result).toMatchObject({
      ok: true,
      mode: 'live',
      status: 'paused',
      reason: 'live_campaign_paused',
      providerCampaignId: 'camp_live_1',
      providerPayload: expect.objectContaining({ providerPaused: true, liveSpendEnabled: false }),
    });
    const [pauseUrl, pauseInit] = fetchMock.mock.calls[0];
    expect(pauseUrl).toBe('https://graph.facebook.com/v21.0/camp_live_1');
    expect(JSON.parse(pauseInit.body)).toEqual({ status: 'PAUSED' });
    expect(auditTrailService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ads.provider.pause',
        outcome: 'success',
        metadata: expect.objectContaining({ provider: 'meta_ads', providerCampaignId: 'camp_live_1' }),
      })
    );
  });

  it('resumes an existing paused live campaign instead of recreating it', async () => {
    stubLiveMetaEnv();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ success: true }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await adsProviderAdapter({ strapi: createStrapi({}, {}) }).createOrUpdateCampaign(
      metaPlan({ status: 'paused', provider_campaign_id: 'camp_live_2' })
    );

    expect(result).toMatchObject({
      ok: true,
      mode: 'live',
      status: 'active',
      reason: 'live_campaign_resumed',
      providerCampaignId: 'camp_live_2',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ status: 'ACTIVE' });
  });

  it('treats re-activation of an already-active live campaign as a provider no-op', async () => {
    stubLiveMetaEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await adsProviderAdapter({ strapi: createStrapi({}, {}) }).createOrUpdateCampaign(
      metaPlan({ status: 'active', provider_campaign_id: 'camp_live_3' })
    );

    expect(result).toMatchObject({
      ok: true,
      mode: 'live',
      status: 'active',
      reason: 'live_campaign_already_active',
      providerCampaignId: 'camp_live_3',
      providerPayload: expect.objectContaining({ idempotentNoop: true }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches live Meta spend from the insights endpoint for stop-loss reconciliation', async () => {
    stubLiveMetaEnv();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ data: [{ spend: '7.35' }] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await adsProviderAdapter({ strapi: createStrapi({}, {}) }).fetchSpend(
      metaPlan({ status: 'active', provider_campaign_id: 'camp_live_4' })
    );

    expect(result).toEqual({ ok: true, mode: 'live', reason: 'live_meta_spend_fetched', spendPln: 7.35 });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://graph.facebook.com/v21.0/camp_live_4/insights?fields=spend&date_preset=today'
    );
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });

  it('fetches live Google spend via searchStream cost_micros', async () => {
    stubLiveGoogleEnv();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'google-access-token' }))
      .mockResolvedValueOnce(jsonResponse([{ results: [{ metrics: { costMicros: '5250000' } }] }]));
    vi.stubGlobal('fetch', fetchMock);

    const result = await adsProviderAdapter({ strapi: createStrapi({}, {}) }).fetchSpend(
      googlePlan({ status: 'active', provider_campaign_id: 'customers/1112223333/campaigns/77' })
    );

    expect(result).toEqual({ ok: true, mode: 'live', reason: 'live_google_spend_fetched', spendPln: 5.25 });
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://googleads.googleapis.com/v18/customers/1112223333/googleAds:searchStream'
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).query).toContain('metrics.cost_micros');
  });
});

describe('live ads agent gating', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const planRecord = metaPlan({ id: 301 });

  const createAgentEnv = (overrides: Record<string, unknown> = {}) => {
    const updates: Array<{ id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      findOne: vi.fn(async () => ({ ...planRecord })),
      update: vi.fn(async (_uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ id, data: input.data });
        return { id, ...input.data };
      }),
      ...((overrides.entityService as Record<string, unknown>) ?? {}),
    };
    return { updates, entityService };
  };

  it('blocks live activation when autonomy policy denies the mutation, without provider calls', async () => {
    stubLiveMetaEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { entityService } = createAgentEnv();
    const providerAdapter = { createOrUpdateCampaign: vi.fn() };

    const result = await adsAgent({
      strapi: createStrapi(
        {
          'autonomy-policy': {
            evaluate: vi.fn(async () => ({
              allowed: false,
              reason: 'policy_kill_switch_enabled',
              budgetImpactPln: 0,
            })),
          },
          'ads-provider-adapter': providerAdapter,
        },
        entityService
      ),
    }).activate(301);

    expect(result).toMatchObject({ status: 'blocked', blocked_reason: 'policy_kill_switch_enabled' });
    expect(providerAdapter.createOrUpdateCampaign).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks live activation before provider calls when ledger reservation fails', async () => {
    stubLiveMetaEnv();
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200 })));
    const { entityService } = createAgentEnv();
    const providerAdapter = { createOrUpdateCampaign: vi.fn() };

    const result = await adsAgent({
      strapi: createStrapi(
        {
          'autonomy-policy': {
            evaluate: vi.fn(async () => ({ allowed: true, reason: 'allowed', budgetImpactPln: 15 })),
          },
          'provider-status': {
            checkProviders: vi.fn(async () => ({
              ready: true,
              requiredProviders: ['meta_ads'],
              blockedProviders: [],
            })),
          },
          'ads-provider-adapter': providerAdapter,
          'ads-budget-ledger': {
            reserveActivation: vi.fn(async () => ({
              allowed: false,
              reason: 'ads_ledger_platform_cap_exceeded',
              totals: { platformReservedPln: 15 },
            })),
          },
        },
        entityService
      ),
    }).activate(301);

    expect(result).toMatchObject({
      status: 'blocked',
      blocked_reason: 'ads_ledger_platform_cap_exceeded',
    });
    expect(providerAdapter.createOrUpdateCampaign).not.toHaveBeenCalled();
  });

  it('treats re-activation of an already-active plan as a no-op before policy and ledger', async () => {
    stubLiveMetaEnv();
    const activePlan = metaPlan({ id: 302, status: 'active', provider_campaign_id: 'camp_live_active' });
    const entityService = {
      findOne: vi.fn(async () => activePlan),
      update: vi.fn(),
    };
    const policy = { evaluate: vi.fn() };
    const providerAdapter = { createOrUpdateCampaign: vi.fn() };
    const ledger = { reserveActivation: vi.fn() };

    const result = await adsAgent({
      strapi: createStrapi(
        {
          'autonomy-policy': policy,
          'ads-provider-adapter': providerAdapter,
          'ads-budget-ledger': ledger,
        },
        entityService
      ),
    }).activate(302);

    expect(result).toBe(activePlan);
    expect(policy.evaluate).not.toHaveBeenCalled();
    expect(ledger.reserveActivation).not.toHaveBeenCalled();
    expect(providerAdapter.createOrUpdateCampaign).not.toHaveBeenCalled();
    expect(entityService.update).not.toHaveBeenCalled();
  });

  it('pauses active live plans whose spend reached the daily budget during stop-loss reconciliation', async () => {
    stubLiveMetaEnv();
    const activePlan = metaPlan({
      id: 303,
      status: 'active',
      daily_budget_pln: 10,
      provider_campaign_id: 'camp_live_sl',
    });
    const updates: Array<{ id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      findMany: vi.fn(async () => [activePlan]),
      findOne: vi.fn(async () => activePlan),
      update: vi.fn(async (_uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ id, data: input.data });
        return { id, ...input.data };
      }),
    };
    const providerAdapter = {
      fetchSpend: vi.fn(async () => ({ ok: true, mode: 'live', reason: 'live_meta_spend_fetched', spendPln: 11.4 })),
      pauseCampaign: vi.fn(async () => ({
        ok: true,
        mode: 'live' as const,
        status: 'paused' as const,
        reason: 'live_campaign_paused',
        providerCampaignId: 'camp_live_sl',
      })),
    };

    const result = await adsAgent({
      strapi: createStrapi(
        {
          'ads-provider-adapter': providerAdapter,
          'ads-budget-ledger': { recordPause: vi.fn(async () => ({ id: 5, status: 'applied' })) },
        },
        entityService
      ),
    }).reconcileLiveSpend();

    expect(result).toMatchObject({ providerMode: 'live', checked: 1, pausedForStopLoss: 1 });
    expect(providerAdapter.pauseCampaign).toHaveBeenCalled();
    expect(updates[0]).toMatchObject({ id: 303, data: expect.objectContaining({ status: 'paused' }) });
  });
});

describe('live ads production readiness and probes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const stubReadinessBaseEnv = () => {
    vi.stubEnv('AICO_FULL_AUTONOMY_REQUIRED', 'true');
    vi.stubEnv('AICO_STRICT_AUDIT_REQUIRED', 'true');
    vi.stubEnv('AICO_AUDIT_TRAIL_STRICT', 'true');
    vi.stubEnv('AICO_CONTROLLED_LIVE_ENABLED', 'true');
    vi.stubEnv('AICO_ADMIN_RUN_NOW_ENABLED', 'true');
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'live');
    vi.stubEnv('AICO_VIDEO_PROVIDER_MODE', 'replicate');
    vi.stubEnv('AICO_RUNTIME_LOCKS_DISABLED', 'false');
    vi.stubEnv('AICO_SOCIAL_CONTENT_SAFETY_DISABLED', 'false');
  };

  const buildReadinessService = (adsProvidersReady: boolean) => {
    const matrix = [
      'openrouter',
      'replicate',
      'facebook',
      'instagram',
      'twitter',
      'meta_ads',
      'google_ads',
      'ga4',
    ].map((provider) => ({
      provider,
      ready: ['meta_ads', 'google_ads'].includes(provider) ? adsProvidersReady : true,
      status: ['meta_ads', 'google_ads'].includes(provider) && !adsProvidersReady ? 'blocked' : 'ready',
      blockedReason:
        ['meta_ads', 'google_ads'].includes(provider) && !adsProvidersReady
          ? 'provider_readiness_stale'
          : null,
    }));

    return productionReadiness({
      strapi: createStrapi(
        {
          'autonomy-policy': {
            getPolicy: vi.fn(async () => ({
              id: 1,
              autonomy_mode: 'full',
              global_kill_switch: false,
              daily_ads_budget_pln: 25,
              brand_safety_required: true,
              legal_disclaimer_required: true,
              no_sensitive_targeting: true,
            })),
          },
          'provider-status': {
            getReadinessMatrix: vi.fn(async () => matrix),
          },
          audit: {
            preflight: vi.fn(async () => ({ decision: 'GO', strict: true, summary: {} })),
          },
        },
        {}
      ),
    });
  };

  it('accepts ads mode=live in production readiness when meta_ads and google_ads are ready and fresh', async () => {
    stubReadinessBaseEnv();
    const result = await buildReadinessService(true).evaluate({ includeStrictAudit: true });

    expect(result.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'live.ads-adapter', status: 'pass' })])
    );
    expect(result.blockers).toEqual([]);
  });

  it('keeps ads mode=live a blocker when ads provider statuses are not ready or stale', async () => {
    stubReadinessBaseEnv();
    const result = await buildReadinessService(false).evaluate({ includeStrictAudit: true });

    expect(result.decision).toBe('NO_GO');
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'live.ads-adapter',
          details: expect.objectContaining({ mode: 'live', liveAdsSmokeReady: false }),
        }),
      ])
    );
  });

  it('runs a read-only live Meta credentials probe without mutations', async () => {
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'live');
    vi.stubEnv('AICO_META_ADS_ACCESS_TOKEN', 'meta-live-token');
    vi.stubEnv('AICO_META_AD_ACCOUNT_ID', 'act_987654321');
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ account_status: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    const providerStatusService = { upsert: vi.fn(async () => ({})) };

    const result = await providerProbe({
      strapi: createStrapi({ 'provider-status': providerStatusService }, {}),
    }).testProvider('meta_ads', { includeConnectivity: true });

    expect(result).toMatchObject({
      provider: 'meta_ads',
      status: 'ready',
      connectivity: 'passed',
      liveEffects: false,
      metadata: expect.objectContaining({ readOnlyProbe: true, mutations: false }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [probeUrl, probeInit] = fetchMock.mock.calls[0];
    expect(probeUrl).toBe('https://graph.facebook.com/v21.0/act_987654321?fields=account_status');
    expect(probeInit.method).toBe('GET');
    expect(providerStatusService.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'meta_ads', status: 'ready' })
    );
  });

  it('runs a read-only live Google Ads credentials probe via listAccessibleCustomers', async () => {
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'live');
    vi.stubEnv('AICO_GOOGLE_ADS_DEVELOPER_TOKEN', 'google-dev-token');
    vi.stubEnv('AICO_GOOGLE_ADS_CLIENT_ID', 'google-client-id');
    vi.stubEnv('AICO_GOOGLE_ADS_CLIENT_SECRET', 'google-client-secret');
    vi.stubEnv('AICO_GOOGLE_ADS_REFRESH_TOKEN', 'google-refresh-token');
    vi.stubEnv('AICO_GOOGLE_ADS_CUSTOMER_ID', '111-222-3333');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'google-access-token' }))
      .mockResolvedValueOnce(jsonResponse({ resourceNames: ['customers/1112223333'] }));
    vi.stubGlobal('fetch', fetchMock);
    const providerStatusService = { upsert: vi.fn(async () => ({})) };

    const result = await providerProbe({
      strapi: createStrapi({ 'provider-status': providerStatusService }, {}),
    }).testProvider('google_ads', { includeConnectivity: true });

    expect(result).toMatchObject({
      provider: 'google_ads',
      status: 'ready',
      connectivity: 'passed',
      metadata: expect.objectContaining({ accessibleCustomers: 1, readOnlyProbe: true }),
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://googleads.googleapis.com/v18/customers:listAccessibleCustomers'
    );
    expect(fetchMock.mock.calls[1][1].method).toBe('GET');
  });

  it('marks the live probe failed on auth errors without throwing', async () => {
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'live');
    vi.stubEnv('AICO_META_ADS_ACCESS_TOKEN', 'meta-live-token');
    vi.stubEnv('AICO_META_AD_ACCOUNT_ID', 'act_987654321');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ error: 'denied' }, 401)));
    const providerStatusService = { upsert: vi.fn(async () => ({})) };

    const result = await providerProbe({
      strapi: createStrapi({ 'provider-status': providerStatusService }, {}),
    }).testProvider('meta_ads', { includeConnectivity: true });

    expect(result).toMatchObject({
      provider: 'meta_ads',
      status: 'failed',
      blockedReason: 'provider_auth_failed',
      connectivity: 'failed',
    });
  });
});

// Sanity reference so unused import warnings never hide UID drift.
void AD_CAMPAIGN_PLAN_UID;
