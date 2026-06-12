import { PROVIDER_CREDENTIAL_STATUS_UID, PROVIDER_KEYS } from '../constants';
import type { ProviderCredentialStatusRecord, ProviderKey, Strapi } from '../types';
import { redactProviderPayload } from '../utils/diagnostic-redaction';
import { getEntityService } from '../utils/entity-service';

type UpsertProviderStatusInput = {
  provider: ProviderKey;
  status: ProviderCredentialStatusRecord['status'];
  hasCredentials?: boolean;
  scopes?: string[];
  blockedReason?: string;
  lastError?: string;
  metadata?: Record<string, unknown> | null;
  workflowId?: number;
};

export type ProviderReadiness = {
  provider: ProviderKey;
  status: ProviderCredentialStatusRecord['status'];
  ready: boolean;
  hasCredentials: boolean;
  scopes: string[];
  requiredScopes: string[];
  missingScopes: string[];
  requiredFor: string[];
  stale: boolean;
  blockedReason?: string | null;
  lastTestedAt?: string | null;
  lastError?: Record<string, unknown> | null;
};

const PROVIDER_REQUIRED_FOR: Record<ProviderKey, string[]> = {
  openrouter: ['llm.generate', 'content.strategy', 'quality.review'],
  replicate: ['media.generate', 'video.generate'],
  openai: ['media.generate.optional', 'video.generate.optional'],
  facebook: ['social.publish.facebook'],
  instagram: ['social.publish.instagram', 'social.publish.reels'],
  twitter: ['social.publish.twitter'],
  tiktok: ['social.publish.tiktok'],
  youtube: ['social.publish.youtube_shorts'],
  meta_ads: ['ads.mutate.meta'],
  google_ads: ['ads.mutate.google'],
  ga4: ['traffic.import.ga4', 'performance.feedback'],
};

const PROVIDER_REQUIRED_SCOPES: Record<ProviderKey, string[]> = {
  openrouter: ['chat.completions'],
  replicate: ['predictions.write'],
  openai: ['images.write'],
  facebook: ['pages_manage_posts'],
  instagram: ['instagram_content_publish'],
  twitter: ['tweet.write'],
  tiktok: ['video.publish'],
  youtube: ['youtube.upload'],
  meta_ads: ['ads_management'],
  google_ads: ['adwords'],
  ga4: ['analytics.readonly'],
};

const REQUIRED_PROVIDERS_BY_ACTION: Record<string, ProviderKey[]> = {
  'llm.generate': ['openrouter'],
  'media.generate': ['replicate'],
  'video.generate': ['replicate'],
  'social.publish': ['facebook', 'instagram', 'twitter', 'tiktok', 'youtube'],
  'ads.mutate.meta': ['meta_ads'],
  'ads.mutate.google': ['google_ads'],
  'traffic.import.ga4': ['ga4'],
};

const getReadinessMaxAgeMs = (): number => {
  const hours = Number(process.env.AICO_PROVIDER_READINESS_MAX_AGE_HOURS ?? 24);
  const normalized = Number.isFinite(hours) && hours > 0 ? hours : 24;
  return normalized * 60 * 60 * 1000;
};

const sanitizeProviderStatus = (record: ProviderCredentialStatusRecord): ProviderCredentialStatusRecord => ({
  ...record,
  last_error: record.last_error ? '[REDACTED provider error]' : record.last_error,
  metadata: redactProviderPayload(record.metadata),
});

const toReadiness = (provider: ProviderKey, record?: ProviderCredentialStatusRecord): ProviderReadiness => {
  const status = record?.status ?? 'missing_credentials';
  const hasCredentials = Boolean(record?.has_credentials);
  const scopes = Array.isArray(record?.scopes) ? record.scopes : [];
  const requiredScopes = PROVIDER_REQUIRED_SCOPES[provider];
  const missingScopes = requiredScopes.filter((scope) => !scopes.includes(scope));
  const lastTestedAt = record?.last_tested_at ?? null;
  const lastTestedMs = lastTestedAt ? Date.parse(lastTestedAt) : NaN;
  const stale =
    !Number.isFinite(lastTestedMs) || Date.now() - lastTestedMs > getReadinessMaxAgeMs();
  const ready = status === 'ready' && hasCredentials && missingScopes.length === 0 && !stale;

  return {
    provider,
    status,
    ready,
    hasCredentials,
    scopes,
    requiredScopes,
    missingScopes,
    requiredFor: PROVIDER_REQUIRED_FOR[provider],
    stale,
    blockedReason:
      record?.blocked_reason ??
      (ready
        ? null
        : status === 'missing_credentials'
          ? 'missing_credentials'
          : missingScopes.length > 0
            ? 'missing_provider_scopes'
            : stale
              ? 'provider_readiness_stale'
              : 'provider_not_ready'),
    lastTestedAt,
    lastError: record?.last_error ? redactProviderPayload({ lastError: record.last_error }) : null,
  };
};

const providerStatus = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  return {
    async list(input: { provider?: string; limit?: number } = {}): Promise<ProviderCredentialStatusRecord[]> {
      const filters: Record<string, unknown> = {};
      if (input.provider) filters.provider = input.provider;

      const statuses = await entityService.findMany<ProviderCredentialStatusRecord>(PROVIDER_CREDENTIAL_STATUS_UID, {
        filters,
        sort: [{ provider: 'asc' }, { updatedAt: 'desc' }],
        populate: ['workflow'],
        limit: Math.max(1, Math.min(200, Number(input.limit ?? 100))),
      });

      return statuses.map(sanitizeProviderStatus);
    },

    async getReadinessMatrix(): Promise<ProviderReadiness[]> {
      const statuses = await entityService.findMany<ProviderCredentialStatusRecord>(PROVIDER_CREDENTIAL_STATUS_UID, {
        sort: [{ provider: 'asc' }, { updatedAt: 'desc' }],
        limit: 500,
      });
      const latestByProvider = new Map<ProviderKey, ProviderCredentialStatusRecord>();

      for (const status of statuses) {
        if (!latestByProvider.has(status.provider)) {
          latestByProvider.set(status.provider, status);
        }
      }

      return PROVIDER_KEYS.map((provider) => toReadiness(provider, latestByProvider.get(provider)));
    },

    async checkProviders(
      input: { action: string; platform?: string; providers?: ProviderKey[] }
    ): Promise<{ ready: boolean; requiredProviders: ProviderKey[]; blockedProviders: ProviderReadiness[] }> {
      const actionKey =
        input.action === 'ads.mutate' && input.platform
          ? `ads.mutate.${input.platform}`
          : input.action;
      const requiredProviders = input.providers ?? REQUIRED_PROVIDERS_BY_ACTION[actionKey] ?? [];

      if (requiredProviders.length === 0) {
        return { ready: true, requiredProviders: [], blockedProviders: [] };
      }

      const matrix = await this.getReadinessMatrix();
      const blockedProviders = matrix.filter(
        (provider) => requiredProviders.includes(provider.provider) && !provider.ready
      );

      return {
        ready: blockedProviders.length === 0,
        requiredProviders,
        blockedProviders,
      };
    },

    async upsert(input: UpsertProviderStatusInput): Promise<ProviderCredentialStatusRecord> {
      const existing = await entityService.findMany<ProviderCredentialStatusRecord>(
        PROVIDER_CREDENTIAL_STATUS_UID,
        {
          filters: {
            provider: input.provider,
            workflow: input.workflowId,
          },
          limit: 1,
        }
      );

      const data = {
        provider: input.provider,
        status: input.status,
        has_credentials: Boolean(input.hasCredentials),
        scopes: input.scopes ?? [],
        blocked_reason: input.blockedReason,
        last_error: input.lastError,
        last_tested_at: new Date().toISOString(),
        metadata: input.metadata ?? null,
        workflow: input.workflowId,
      };

      return existing[0]
        ? entityService.update<ProviderCredentialStatusRecord>(
            PROVIDER_CREDENTIAL_STATUS_UID,
            existing[0].id,
            { data }
          )
        : entityService.create<ProviderCredentialStatusRecord>(PROVIDER_CREDENTIAL_STATUS_UID, {
            data,
          });
    },
  };
};

export default providerStatus;
