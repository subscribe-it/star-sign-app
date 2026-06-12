import { PROVIDER_KEYS } from '../constants';
import type { ProviderKey, Strapi } from '../types';
import { getPluginService } from '../utils/plugin';

type ProviderProbeStatus = 'ready' | 'missing_credentials' | 'blocked' | 'failed';

type ProviderStatusService = {
  upsert: (input: {
    provider: ProviderKey;
    status: ProviderProbeStatus;
    hasCredentials?: boolean;
    scopes?: string[];
    blockedReason?: string;
    lastError?: string;
    metadata?: Record<string, unknown> | null;
    workflowId?: number;
  }) => Promise<unknown>;
};

type ProviderProbeResult = {
  provider: ProviderKey;
  status: ProviderProbeStatus;
  hasCredentials: boolean;
  scopes: string[];
  blockedReason?: string;
  connectivity: 'skipped' | 'passed' | 'failed';
  liveEffects: false;
  metadata?: Record<string, unknown>;
};

type ProviderProbeInput = {
  providers?: ProviderKey[];
  includeConnectivity?: boolean;
};

type ProviderSpec = {
  envAny?: string[];
  envAll?: string[];
  scopes: string[];
  blockedReasonWhenConfigured?: string;
  connectivity?: {
    url: string;
    auth: 'bearer' | 'token';
  };
};

const PROVIDER_SPECS: Record<ProviderKey, ProviderSpec> = {
  openrouter: {
    envAny: ['AICO_OPENROUTER_TOKEN', 'OPENROUTER_API_KEY'],
    scopes: ['chat.completions'],
    connectivity: {
      url: 'https://openrouter.ai/api/v1/models',
      auth: 'bearer',
    },
  },
  replicate: {
    envAny: ['AICO_IMAGE_GEN_TOKEN', 'AICO_VIDEO_GEN_TOKEN', 'REPLICATE_API_TOKEN'],
    scopes: ['predictions.write'],
    connectivity: {
      url: 'https://api.replicate.com/v1/models',
      auth: 'token',
    },
  },
  openai: {
    envAny: ['OPENAI_API_KEY'],
    scopes: ['images.write'],
    connectivity: {
      url: 'https://api.openai.com/v1/models',
      auth: 'bearer',
    },
  },
  facebook: {
    envAll: ['AICO_FACEBOOK_PAGE_ID', 'AICO_FACEBOOK_ACCESS_TOKEN'],
    scopes: ['pages_manage_posts'],
    blockedReasonWhenConfigured: 'use_social_test_connection_probe',
  },
  instagram: {
    envAll: ['AICO_INSTAGRAM_USER_ID', 'AICO_INSTAGRAM_ACCESS_TOKEN'],
    scopes: ['instagram_content_publish'],
    blockedReasonWhenConfigured: 'use_social_test_connection_probe',
  },
  twitter: {
    envAll: [
      'AICO_X_API_KEY',
      'AICO_X_API_SECRET',
      'AICO_X_ACCESS_TOKEN',
      'AICO_X_ACCESS_TOKEN_SECRET',
    ],
    scopes: ['tweet.write'],
    blockedReasonWhenConfigured: 'use_social_test_connection_probe',
  },
  tiktok: {
    envAny: ['AICO_TIKTOK_ACCESS_TOKEN'],
    scopes: ['video.publish'],
    blockedReasonWhenConfigured: 'tiktok_content_posting_preflight_required',
  },
  youtube: {
    envAll: ['AICO_YOUTUBE_REFRESH_TOKEN', 'AICO_YOUTUBE_CLIENT_ID', 'AICO_YOUTUBE_CLIENT_SECRET'],
    scopes: ['youtube.upload'],
    blockedReasonWhenConfigured: 'youtube_upload_preflight_required',
  },
  meta_ads: {
    envAll: ['AICO_META_ADS_ACCESS_TOKEN', 'AICO_META_AD_ACCOUNT_ID'],
    scopes: ['ads_management'],
    blockedReasonWhenConfigured: 'meta_ads_sandbox_or_live_smoke_required',
  },
  google_ads: {
    envAll: [
      'AICO_GOOGLE_ADS_DEVELOPER_TOKEN',
      'AICO_GOOGLE_ADS_CLIENT_ID',
      'AICO_GOOGLE_ADS_CLIENT_SECRET',
      'AICO_GOOGLE_ADS_REFRESH_TOKEN',
      'AICO_GOOGLE_ADS_CUSTOMER_ID',
    ],
    scopes: ['adwords'],
    blockedReasonWhenConfigured: 'google_ads_sandbox_or_live_smoke_required',
  },
  ga4: {
    envAll: ['GA4_PROPERTY_ID'],
    envAny: ['AICO_GA4_ACCESS_TOKEN', 'GA4_SERVICE_ACCOUNT_JSON', 'GOOGLE_APPLICATION_CREDENTIALS'],
    scopes: ['analytics.readonly'],
    blockedReasonWhenConfigured: 'ga4_data_api_probe_required',
  },
};

const PLACEHOLDER_PATTERNS = [/^replace_me$/i, /^changeme$/i, /^test$/i, /^todo$/i, /^dummy/i];
const CONTROLLED_ADS_PROVIDERS = new Set<ProviderKey>(['meta_ads', 'google_ads']);

const isTruthy = (value: string | undefined): boolean =>
  ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());

const normalizeEnvMode = (value: string | undefined): string =>
  String(value ?? '').trim().toLowerCase();

const hasUsableEnv = (key: string): boolean => {
  const value = process.env[key]?.trim();
  return Boolean(value) && !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value ?? ''));
};

const hasCredentialsForSpec = (spec: ProviderSpec): boolean => {
  const anyOk = spec.envAny ? spec.envAny.some(hasUsableEnv) : true;
  const allOk = spec.envAll ? spec.envAll.every(hasUsableEnv) : true;
  return anyOk && allOk;
};

const firstUsableToken = (spec: ProviderSpec): string | undefined => {
  const key = [...(spec.envAny ?? []), ...(spec.envAll ?? [])].find(hasUsableEnv);
  return key ? process.env[key]?.trim() : undefined;
};

const normalizeProviders = (providers?: ProviderKey[]): ProviderKey[] => {
  if (!providers || providers.length === 0) {
    return [...PROVIDER_KEYS];
  }

  return Array.from(new Set(providers.filter((provider) => PROVIDER_KEYS.includes(provider))));
};

const toAuthHeader = (auth: ProviderSpec['connectivity']['auth'], token: string): string =>
  auth === 'token' ? `Token ${token}` : `Bearer ${token}`;

const runConnectivityProbe = async (
  spec: ProviderSpec,
  token: string
): Promise<{ ok: boolean; reason?: string }> => {
  if (!spec.connectivity) {
    return { ok: false, reason: 'connectivity_probe_not_supported' };
  }

  const response = await fetch(spec.connectivity.url, {
    method: 'GET',
    headers: {
      Authorization: toAuthHeader(spec.connectivity.auth, token),
      Accept: 'application/json',
    },
  });

  if (response.ok) {
    return { ok: true };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: 'provider_auth_failed' };
  }

  return { ok: false, reason: `provider_probe_http_${response.status}` };
};

const getControlledAdsProbeResult = (
  provider: ProviderKey,
  spec: ProviderSpec,
  hasCredentials: boolean
): ProviderProbeResult | null => {
  if (!CONTROLLED_ADS_PROVIDERS.has(provider) || !hasCredentials) {
    return null;
  }

  const providerMode = normalizeEnvMode(process.env.AICO_ADS_PROVIDER_MODE ?? 'disabled');
  if (providerMode !== 'controlled') {
    return null;
  }

  const controlledLiveEnabled = isTruthy(process.env.AICO_CONTROLLED_LIVE_ENABLED);
  const metadata = {
    providerMode,
    controlledLiveEnabled,
    controlledExternalMutation: false,
    liveSpendEnabled: false,
    liveEffects: false,
  };

  return {
    provider,
    status: controlledLiveEnabled ? 'ready' : 'blocked',
    hasCredentials,
    scopes: spec.scopes,
    blockedReason: controlledLiveEnabled ? undefined : 'controlled_live_gate_required',
    connectivity: 'skipped',
    liveEffects: false,
    metadata,
  };
};

const providerProbe = ({ strapi }: { strapi: Strapi }) => ({
  async testProvider(
    provider: ProviderKey,
    input: { includeConnectivity?: boolean } = {}
  ): Promise<ProviderProbeResult> {
    const spec = PROVIDER_SPECS[provider];
    const hasCredentials = hasCredentialsForSpec(spec);
    const token = firstUsableToken(spec);

    let result: ProviderProbeResult = {
      provider,
      status: hasCredentials ? 'blocked' : 'missing_credentials',
      hasCredentials,
      scopes: hasCredentials ? spec.scopes : [],
      blockedReason: hasCredentials
        ? spec.blockedReasonWhenConfigured ?? 'connectivity_probe_required'
        : 'missing_credentials',
      connectivity: 'skipped',
      liveEffects: false,
    };
    result = getControlledAdsProbeResult(provider, spec, hasCredentials) ?? result;

    if (hasCredentials && input.includeConnectivity && spec.connectivity && token) {
      try {
        const connectivity = await runConnectivityProbe(spec, token);
        result = {
          ...result,
          status: connectivity.ok ? 'ready' : 'failed',
          blockedReason: connectivity.ok ? undefined : connectivity.reason,
          connectivity: connectivity.ok ? 'passed' : 'failed',
        };
      } catch {
        result = {
          ...result,
          status: 'failed',
          blockedReason: 'provider_probe_failed',
          connectivity: 'failed',
        };
      }
    }

    const providerStatus = getPluginService<ProviderStatusService>(strapi, 'provider-status');
    await providerStatus.upsert({
      provider,
      status: result.status,
      hasCredentials: result.hasCredentials,
      scopes: result.scopes,
      blockedReason: result.blockedReason,
      lastError: result.status === 'failed' ? result.blockedReason : undefined,
      metadata: result.metadata,
    });

    return result;
  },

  async testProviders(input: ProviderProbeInput = {}): Promise<{
    includeConnectivity: boolean;
    liveEffects: false;
    results: ProviderProbeResult[];
  }> {
    const providers = normalizeProviders(input.providers);
    const results: ProviderProbeResult[] = [];

    for (const provider of providers) {
      results.push(await this.testProvider(provider, {
        includeConnectivity: Boolean(input.includeConnectivity),
      }));
    }

    return {
      includeConnectivity: Boolean(input.includeConnectivity),
      liveEffects: false,
      results,
    };
  },
});

export default providerProbe;
