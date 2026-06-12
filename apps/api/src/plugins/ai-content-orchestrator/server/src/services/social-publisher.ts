import axios, { AxiosError } from 'axios';
import { createHash, createHmac, randomBytes } from 'crypto';

import {
  DEFAULT_RETRY_BACKOFF_SECONDS,
  DEFAULT_RETRY_MAX,
  SOCIAL_CHANNELS,
  SOCIAL_POST_TICKET_UID,
} from '../constants';
import type { ProviderKey, SocialPlatform, SocialPostTicketRecord, Strapi, WorkflowRecord } from '../types';
import { toSafeErrorMessage } from '../utils/json';
import { getAicoPromptTemplate, renderAicoPromptTemplate } from '../utils/aico-contract';
import {
  redactProviderPayload,
  sanitizeSocialTicketForAdmin,
} from '../utils/diagnostic-redaction';
import { getPluginService } from '../utils/plugin';
import { buildPublicFrontendUrl, getSocialDefaultImageUrl } from '../utils/public-url';
import {
  evaluatePolishContentQuality,
  formatPolishContentQualityIssues,
  POLISH_STYLE_REPAIR_MAX_ATTEMPTS,
} from '../utils/polish-content-quality';
import { getEntityService } from '../utils/entity-service';

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';
const X_UPLOAD_MEDIA_URL = 'https://upload.twitter.com/1.1/media/upload.json';
const X_STATUS_UPDATE_URL = 'https://api.twitter.com/1.1/statuses/update.json';
const X_VERIFY_URL = 'https://api.twitter.com/1.1/account/verify_credentials.json';
const DEFAULT_SOCIAL_IMAGE_URL = getSocialDefaultImageUrl();
const MAX_TICKET_BATCH = 50;
const DEFAULT_AUTONOMOUS_MAX_POSTS_PER_RUN = 12;
const DEFAULT_PLATFORM_DAILY_CAPS: Record<SocialPlatform, number> = {
  facebook: 8,
  instagram: 4,
  twitter: 24,
  tiktok: 0,
  youtube_shorts: 0,
};
const DEFAULT_PLATFORM_COOLDOWN_MINUTES: Record<SocialPlatform, number> = {
  facebook: 90,
  instagram: 180,
  twitter: 20,
  tiktok: 0,
  youtube_shorts: 0,
};
const DEFAULT_CONTENT_SAFETY_BLOCKED_PHRASES = [
  'gwarantowany zysk',
  'pewna wygrana',
  'diagnoza medyczna',
  'porada medyczna',
  'zrezygnuj z leczenia',
  'natychmiast kup',
];
const DEFAULT_CAPTION_LIMITS: Record<SocialPlatform, number> = {
  facebook: 2200,
  instagram: 2200,
  twitter: 280,
  tiktok: 0,
  youtube_shorts: 0,
};
const DEFAULT_RUNTIME_SOCIAL_CHANNELS = SOCIAL_CHANNELS.filter(
  (channel) => channel !== 'tiktok' && channel !== 'youtube_shorts'
) as SocialPlatform[];

type OpenRouterService = {
  requestJson: (input: {
    model: string;
    apiToken: string;
    prompt: string;
    schemaDescription: string;
    temperature?: number;
    maxCompletionTokens?: number;
  }) => Promise<{
    payload: unknown;
  }>;
};

type WorkflowService = {
  getById: (id: number) => Promise<WorkflowRecord | null>;
  decryptTokenForRuntime: (record: WorkflowRecord) => Promise<string>;
  decryptEncryptedValue: (encrypted: string, label: string) => string;
  normalizeRuntime: (record: WorkflowRecord) => Promise<{
    enabledChannels: SocialPlatform[];
    llmModel: string;
    retryMax: number;
    retryBackoffSeconds: number;
  }>;
};

type PublishClassification = {
  retryable: boolean;
  blockedReason?: string;
  retryAfterSeconds?: number;
  providerPayload?: Record<string, unknown>;
};

type ChannelStatus = {
  platform: SocialPlatform;
  status: 'ready' | 'needs_action' | 'blocked' | 'degraded';
  message: string;
  details?: Record<string, unknown>;
};

type AutonomousPublishPolicy = {
  maxPostsPerRun: number;
  maxPostsPerPlatformPerDay: Record<SocialPlatform, number>;
  cooldownMinutes: Record<SocialPlatform, number>;
};

type ContentSafetyPolicy = {
  enabled: boolean;
  blockedPhrases: string[];
  requireTargetUrl: boolean;
  maxCaptionLengthByPlatform: Record<SocialPlatform, number>;
};

type SocialAutonomyPolicyService = {
  evaluate: (input: {
    action: 'social.publish';
    requiresBrandSafety?: boolean;
    requiresLegalDisclaimer?: boolean;
  }) => Promise<{ allowed: boolean; reason: string }>;
};

type SocialProviderStatusService = {
  checkProviders?: (input: {
    action: 'social.publish';
    providers?: ProviderKey[];
  }) => Promise<{
    ready: boolean;
    requiredProviders: ProviderKey[];
    blockedProviders: Array<{
      provider: ProviderKey;
      status: string;
      blockedReason?: string | null;
    }>;
  }>;
  upsert?: (input: {
    provider: ProviderKey;
    status: 'unknown' | 'ready' | 'missing_credentials' | 'blocked' | 'failed';
    hasCredentials?: boolean;
    scopes?: string[];
    blockedReason?: string;
    workflowId?: number;
  }) => Promise<unknown>;
};

type AutonomousPublishRunState = {
  publishAttempts: number;
  publishedByPlatform: Map<SocialPlatform, number>;
  lastPublishedAtByPlatform: Map<SocialPlatform, Date>;
};

type AutonomousPublishDecision =
  | { allowed: true; policy: AutonomousPublishPolicy }
  | {
      allowed: false;
      reason: string;
      nextAttemptAt: Date;
      policy: AutonomousPublishPolicy;
    };

class PublishGuardrailError extends Error {
  readonly classification: PublishClassification;

  constructor(message: string, classification: PublishClassification) {
    super(message);
    this.name = 'PublishGuardrailError';
    this.classification = classification;
  }
}

const PLATFORM_SET = new Set<SocialPlatform>(SOCIAL_CHANNELS);
const SOCIAL_PLATFORM_PROVIDER: Partial<Record<SocialPlatform, ProviderKey>> = {
  facebook: 'facebook',
  instagram: 'instagram',
  twitter: 'twitter',
  tiktok: 'tiktok',
  youtube_shorts: 'youtube',
};
const SOCIAL_PROVIDER_SCOPES: Partial<Record<SocialPlatform, string[]>> = {
  facebook: ['pages_manage_posts'],
  instagram: ['instagram_content_publish'],
  twitter: ['tweet.write'],
  tiktok: ['video.publish'],
  youtube_shorts: ['youtube.upload'],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readPositiveInteger = (
  value: unknown,
  fallback: number,
  options: { min?: number; max?: number } = {}
): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const min = options.min ?? 0;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
};

const normalizePlatform = (value: unknown): SocialPlatform | null => {
  const candidate = String(value ?? '')
    .trim()
    .toLowerCase();

  return PLATFORM_SET.has(candidate as SocialPlatform) ? (candidate as SocialPlatform) : null;
};

const getWorkflowId = (workflow: SocialPostTicketRecord['workflow']): number | null => {
  if (typeof workflow === 'number') {
    return workflow;
  }

  if (workflow && typeof workflow === 'object' && typeof workflow.id === 'number') {
    return workflow.id;
  }

  return null;
};

const isPublicHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local')) {
      return false;
    }

    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) {
      return false;
    }

    const parts = host.split('.').map((part) => Number(part));
    if (parts.length === 4 && parts.every((part) => Number.isFinite(part))) {
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
        return false;
      }
      if (parts[0] === 169 && parts[1] === 254) {
        return false;
      }
      if (parts[0] === 0) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
};

const toAbsoluteUrl = (value: string, serverUrl: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (!trimmed.startsWith('/')) {
    return null;
  }

  const base = serverUrl.trim().replace(/\/$/, '');
  if (!base) {
    return null;
  }

  return `${base}${trimmed}`;
};

const appendLinkIfMissing = (text: string, link?: string | null): string => {
  const caption = text.trim();
  if (!link) {
    return caption;
  }

  if (caption.includes(link)) {
    return caption;
  }

  if (!caption) {
    return link;
  }

  return `${caption}\n\n${link}`;
};

const removeInlineLinks = (text: string): string =>
  text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const composeCaptionForPlatform = (
  platform: SocialPlatform,
  caption: string,
  link?: string | null
): string => {
  if (platform === 'instagram') {
    const withoutLinks = removeInlineLinks(caption);
    if (!link) {
      return withoutLinks;
    }
    return `${withoutLinks}\n\nLink w bio`;
  }

  if (platform === 'twitter') {
    const withLink = appendLinkIfMissing(caption, link);
    if (withLink.length <= 280) {
      return withLink;
    }

    const suffix = link ? ` ${link}` : '';
    const maxBodyLength = Math.max(0, 280 - suffix.length - 1);
    const body = withLink.slice(0, maxBodyLength).trimEnd();
    return `${body}…${suffix}`.trim();
  }

  return appendLinkIfMissing(caption, link);
};

const normalizeChannels = (value: unknown): SocialPlatform[] => {
  if (!Array.isArray(value)) {
    return [...DEFAULT_RUNTIME_SOCIAL_CHANNELS];
  }

  const channels = value
    .map((item) => normalizePlatform(item))
    .filter((item): item is SocialPlatform => item !== null);

  return channels.length > 0 ? Array.from(new Set(channels)) : [...DEFAULT_RUNTIME_SOCIAL_CHANNELS];
};

const readPlatformNumberMap = (
  value: unknown,
  defaults: Record<SocialPlatform, number>,
  options: { min?: number; max?: number } = {}
): Record<SocialPlatform, number> => {
  if (!isRecord(value)) {
    return { ...defaults };
  }

  return SOCIAL_CHANNELS.reduce(
    (acc, platform) => ({
      ...acc,
      [platform]: readPositiveInteger(value[platform], defaults[platform], options),
    }),
    {} as Record<SocialPlatform, number>
  );
};

const readBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const readStringList = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
};

const resolveAutonomousPublishPolicy = (workflow: WorkflowRecord): AutonomousPublishPolicy => {
  const rawGuardrails = isRecord(workflow.auto_publish_guardrails)
    ? workflow.auto_publish_guardrails
    : {};
  const socialGuardrails = isRecord(rawGuardrails.social)
    ? (rawGuardrails.social as Record<string, unknown>)
    : rawGuardrails;
  const envMaxPostsPerRun = process.env.AICO_SOCIAL_MAX_POSTS_PER_RUN;
  const maxPostsPerRunSource =
    socialGuardrails.maxPostsPerRun ??
    socialGuardrails.max_posts_per_run ??
    envMaxPostsPerRun;

  return {
    maxPostsPerRun: readPositiveInteger(
      maxPostsPerRunSource,
      DEFAULT_AUTONOMOUS_MAX_POSTS_PER_RUN,
      {
        min: 1,
        max: MAX_TICKET_BATCH,
      }
    ),
    maxPostsPerPlatformPerDay: readPlatformNumberMap(
      socialGuardrails.maxPostsPerPlatformPerDay ??
        socialGuardrails.max_posts_per_platform_per_day,
      DEFAULT_PLATFORM_DAILY_CAPS,
      { min: 0, max: 96 }
    ),
    cooldownMinutes: readPlatformNumberMap(
      socialGuardrails.cooldownMinutes ??
        socialGuardrails.cooldown_minutes ??
        socialGuardrails.minMinutesBetweenPosts ??
        socialGuardrails.min_minutes_between_posts,
      DEFAULT_PLATFORM_COOLDOWN_MINUTES,
      { min: 0, max: 24 * 60 }
    ),
  };
};

const normalizeForContentSafety = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const resolveContentSafetyPolicy = (workflow: WorkflowRecord): ContentSafetyPolicy => {
  const rawGuardrails = isRecord(workflow.auto_publish_guardrails)
    ? workflow.auto_publish_guardrails
    : {};
  const socialGuardrails = isRecord(rawGuardrails.social)
    ? (rawGuardrails.social as Record<string, unknown>)
    : rawGuardrails;
  const safetyGuardrails = isRecord(socialGuardrails.contentSafety)
    ? (socialGuardrails.contentSafety as Record<string, unknown>)
    : isRecord(socialGuardrails.content_safety)
      ? (socialGuardrails.content_safety as Record<string, unknown>)
      : {};
  const envBlocked = readStringList(process.env.AICO_SOCIAL_BLOCKED_PHRASES);
  const configuredBlocked = [
    ...readStringList(safetyGuardrails.blockedPhrases),
    ...readStringList(safetyGuardrails.blocked_phrases),
  ];

  return {
    enabled:
      process.env.AICO_SOCIAL_CONTENT_SAFETY_DISABLED !== 'true' &&
      readBoolean(safetyGuardrails.enabled, true),
    blockedPhrases: Array.from(
      new Set([...DEFAULT_CONTENT_SAFETY_BLOCKED_PHRASES, ...configuredBlocked, ...envBlocked])
    ),
    requireTargetUrl: readBoolean(
      safetyGuardrails.requireTargetUrl ?? safetyGuardrails.require_target_url,
      false
    ),
    maxCaptionLengthByPlatform: readPlatformNumberMap(
      safetyGuardrails.maxCaptionLengthByPlatform ??
        safetyGuardrails.max_caption_length_by_platform,
      DEFAULT_CAPTION_LIMITS,
      { min: 0, max: 5000 }
    ),
  };
};

const phraseHash = (phrase: string): string =>
  createHash('sha256').update(normalizeForContentSafety(phrase)).digest('hex').slice(0, 16);

const getNextUtcDayAttempt = (now: Date): Date =>
  new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 15, 0, 0)
  );

const getLaterDate = (first: Date | null, second: Date | null): Date | null => {
  if (!first) {
    return second;
  }

  if (!second) {
    return first;
  }

  return first.getTime() > second.getTime() ? first : second;
};

const buildCaptionVariants = (
  platform: SocialPlatform,
  caption: string,
  link?: string | null
): string[] => {
  const variants = [
    composeCaptionForPlatform(platform, caption, link),
    composeCaptionForPlatform(platform, `${caption}\n\nSprawdź, co to znaczy dla Ciebie.`, link),
    composeCaptionForPlatform(platform, `${caption}\n\nZapisz ten temat na później.`, link),
  ]
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Set(variants)).slice(0, 3);
};

const buildIdempotencyKey = (input: {
  workflowId: number;
  contentUid: string;
  contentId: number;
  platform: SocialPlatform;
  scheduledAt: string;
}): string => {
  const raw = [
    String(input.workflowId),
    input.contentUid,
    String(input.contentId),
    input.platform,
    input.scheduledAt,
  ].join(':');

  return createHash('sha256').update(raw).digest('hex');
};

const isAxios = (error: unknown): error is AxiosError => axios.isAxiosError(error);

const parseRetryAfterSeconds = (
  headers: Record<string, unknown> | undefined,
  now: Date
): number | undefined => {
  if (!headers) {
    return undefined;
  }

  const retryAfterRaw = headers['retry-after'];
  if (typeof retryAfterRaw === 'string') {
    const asNumber = Number(retryAfterRaw);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return Math.floor(asNumber);
    }

    const asDate = new Date(retryAfterRaw);
    if (Number.isFinite(asDate.getTime())) {
      const diff = Math.ceil((asDate.getTime() - now.getTime()) / 1000);
      if (diff > 0) {
        return diff;
      }
    }
  }

  const resetRaw = headers['x-rate-limit-reset'];
  if (typeof resetRaw === 'string') {
    const resetEpoch = Number(resetRaw);
    if (Number.isFinite(resetEpoch)) {
      const diff = Math.ceil(resetEpoch - now.getTime() / 1000);
      if (diff > 0) {
        return diff;
      }
    }
  }

  return undefined;
};

const computeBackoffSeconds = (
  base: number,
  attempt: number,
  retryAfterSeconds?: number
): number => {
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    return Math.min(60 * 60, retryAfterSeconds);
  }

  const multiplier = Math.min(8, 2 ** Math.max(0, attempt - 1));
  return Math.min(60 * 60, Math.max(15, Math.floor(base * multiplier)));
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const oauthEncode = (value: string): string =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );

const buildOAuthHeader = (input: {
  method: 'GET' | 'POST';
  url: string;
  queryParams?: Record<string, string>;
  bodyParams?: Record<string, string>;
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
}): string => {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: input.consumerKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: input.token,
    oauth_version: '1.0',
  };

  const allParams: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(oauthParams)) {
    allParams.push([key, value]);
  }
  for (const [key, value] of Object.entries(input.queryParams ?? {})) {
    allParams.push([key, value]);
  }
  for (const [key, value] of Object.entries(input.bodyParams ?? {})) {
    allParams.push([key, value]);
  }

  const encoded = allParams
    .map(([key, value]) => [oauthEncode(key), oauthEncode(value)] as const)
    .sort(([aKey, aValue], [bKey, bValue]) => {
      if (aKey === bKey) {
        return aValue.localeCompare(bValue);
      }
      return aKey.localeCompare(bKey);
    })
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const signatureBase = [
    input.method.toUpperCase(),
    oauthEncode(input.url),
    oauthEncode(encoded),
  ].join('&');

  const signingKey = `${oauthEncode(input.consumerSecret)}&${oauthEncode(input.tokenSecret)}`;
  const signature = createHmac('sha1', signingKey).update(signatureBase).digest('base64');

  const headerParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const serialized = Object.entries(headerParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${oauthEncode(key)}="${oauthEncode(value)}"`)
    .join(', ');

  return `OAuth ${serialized}`;
};

const normalizeTeaserPayload = (
  payload: unknown,
  channels: SocialPlatform[],
  fallback: { title: string; excerpt: string }
): Array<{ platform: SocialPlatform; caption: string }> => {
  const fallbackCaption =
    `${fallback.title}${fallback.excerpt ? `\n\n${fallback.excerpt}` : ''}`.trim();

  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray((payload as { teasers?: unknown }).teasers)
  ) {
    return channels.map((platform) => ({ platform, caption: fallbackCaption }));
  }

  const teaserMap = new Map<SocialPlatform, string>();

  for (const item of (payload as { teasers: unknown[] }).teasers) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const platform = normalizePlatform((item as { platform?: unknown }).platform);
    const caption = String((item as { caption?: unknown }).caption ?? '').trim();

    if (platform && caption) {
      teaserMap.set(platform, caption);
    }
  }

  return channels.map((platform) => ({
    platform,
    caption: teaserMap.get(platform) || fallbackCaption,
  }));
};

const socialPublisher = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  const workflowService = (): WorkflowService =>
    getPluginService<WorkflowService>(strapi, 'workflows');
  const llmService = (): OpenRouterService =>
    getPluginService<OpenRouterService>(strapi, 'open-router');

  return {
    async ensureSocialCaptionPolishQuality(input: {
      caption: string;
      platform: SocialPlatform;
      workflow: WorkflowRecord;
      apiToken: string | null;
      model: string;
    }): Promise<{ caption: string; repaired: boolean }> {
      const schemaDescription = '{"caption":"string"}';
      let currentPayload = { caption: input.caption };
      let report = evaluatePolishContentQuality({
        kind: 'social_teaser',
        payload: currentPayload,
      });

      if (report.valid) {
        return { caption: input.caption, repaired: false };
      }

      let lastIssueSummary = formatPolishContentQualityIssues(report.issues);

      if (!input.apiToken) {
        throw new Error(`quality_failed_polish_style social_teaser (${lastIssueSummary})`);
      }

      for (let attempt = 1; attempt <= POLISH_STYLE_REPAIR_MAX_ATTEMPTS; attempt += 1) {
        const prompt = renderAicoPromptTemplate(getAicoPromptTemplate('polishStyleRepair'), {
          payloadKind: 'social_teaser',
          schemaDescription,
          payloadJson: JSON.stringify(currentPayload),
          qualityIssues: lastIssueSummary,
        });
        const response = await llmService().requestJson({
          model: input.model,
          apiToken: input.apiToken,
          prompt,
          schemaDescription,
          temperature: 0.25,
          maxCompletionTokens: 400,
        });
        const payload = isRecord(response.payload) ? response.payload : {};
        const caption = String(payload.caption ?? '').trim();

        currentPayload = { caption };
        report = evaluatePolishContentQuality({
          kind: 'social_teaser',
          payload: currentPayload,
        });

        if (caption && report.valid) {
          return { caption, repaired: true };
        }

        lastIssueSummary = formatPolishContentQualityIssues(report.issues);
      }

      throw new Error(`quality_failed_polish_style social_teaser (${lastIssueSummary})`);
    },

    async generateTeaser(input: {
      workflowId: number;
      runId: number;
      contentUid: string;
      contentId: number;
      contentTitle: string;
      contentExcerpt: string;
      targetUrl: string;
      mediaUrl?: string;
      publishAt: Date;
    }): Promise<{ created: number; skipped: number; channels: SocialPlatform[] }> {
      const workflow = await workflowService().getById(input.workflowId);
      if (!workflow) {
        throw new Error(`Workflow #${input.workflowId} nie istnieje.`);
      }

      const normalized = await workflowService().normalizeRuntime(workflow);
      const channels = normalizeChannels(workflow.enabled_channels ?? normalized.enabledChannels);

      if (channels.length === 0) {
        return { created: 0, skipped: 0, channels: [] };
      }

      let teaserPayload: unknown = null;
      let apiToken: string | null = null;

      try {
        apiToken = await workflowService().decryptTokenForRuntime(workflow);
        const prompt = renderAicoPromptTemplate(getAicoPromptTemplate('socialTeaser'), {
          channels: channels.join(', '),
          contentTitle: input.contentTitle,
          contentExcerpt: input.contentExcerpt,
          targetUrl: input.targetUrl,
        });

        const response = await llmService().requestJson({
          model: normalized.llmModel,
          apiToken,
          prompt,
          schemaDescription: 'JSON teasers by platform',
          temperature: 0.6,
          maxCompletionTokens: 600,
        });
        teaserPayload = response.payload;
      } catch (error) {
        strapi.log.warn(
          `[aico] Fallback teaser generation for workflow #${workflow.id}: ${toSafeErrorMessage(error)}`
        );
      }

      const teasers = normalizeTeaserPayload(teaserPayload, channels, {
        title: input.contentTitle,
        excerpt: input.contentExcerpt,
      });

      const scheduledAtIso = input.publishAt.toISOString();
      let created = 0;
      let skipped = 0;

      for (const teaser of teasers) {
        const idempotencyKey = buildIdempotencyKey({
          workflowId: input.workflowId,
          contentUid: input.contentUid,
          contentId: input.contentId,
          platform: teaser.platform,
          scheduledAt: scheduledAtIso,
        });

        const existing = (await entityService.findMany(SOCIAL_POST_TICKET_UID, {
          filters: { idempotency_key: idempotencyKey },
          limit: 1,
        })) as SocialPostTicketRecord[];

        if (existing[0]) {
          skipped += 1;
          continue;
        }

        let baseCaption = teaser.caption;
        let polishQualityRepaired = false;

        try {
          const polishQualityResult = await this.ensureSocialCaptionPolishQuality({
            caption: teaser.caption,
            platform: teaser.platform,
            workflow,
            apiToken,
            model: normalized.llmModel,
          });
          baseCaption = polishQualityResult.caption;
          polishQualityRepaired = polishQualityResult.repaired;
        } catch (error) {
          skipped += 1;
          strapi.log.warn(
            `[aico] Skipped social teaser for workflow #${workflow.id} on ${teaser.platform}: ${toSafeErrorMessage(error)}`
          );
          continue;
        }

        const captionVariants = buildCaptionVariants(teaser.platform, baseCaption, input.targetUrl);
        const selected = await this.selectCaptionVariant(teaser.platform, captionVariants);
        const isTiktokDraft = teaser.platform === 'tiktok';

        await entityService.create(SOCIAL_POST_TICKET_UID, {
          data: {
            platform: teaser.platform,
            status: isTiktokDraft ? 'pending' : 'scheduled',
            caption: selected.caption,
            media_url: input.mediaUrl || null,
            target_url: input.targetUrl || null,
            scheduled_at: input.publishAt,
            attempt_count: 0,
            idempotency_key: idempotencyKey,
            blocked_reason: isTiktokDraft ? 'draft_only' : null,
            provider_payload: redactProviderPayload({
              channel: teaser.platform,
              source: 'editorial-teaser',
              draftOnly: isTiktokDraft,
              variantCount: captionVariants.length,
              selectedVariantIndex: selected.index,
              selectionReason: selected.reason,
              polishQualityRepaired,
            }),
            workflow: input.workflowId,
            source_run: input.runId,
            related_content_uid: input.contentUid,
            related_content_id: input.contentId,
          },
        });

        created += 1;
      }

      return { created, skipped, channels };
    },

    async selectCaptionVariant(
      platform: SocialPlatform,
      variants: string[]
    ): Promise<{ caption: string; index: number; reason: string }> {
      const safeVariants = variants.length > 0 ? variants : [''];
      const published = (await entityService.findMany(SOCIAL_POST_TICKET_UID, {
        filters: {
          platform,
          status: 'published',
        },
        fields: ['caption'],
        sort: { published_on: 'desc' },
        limit: 30,
      })) as Array<{ caption?: string | null }>;

      const targetLength =
        published.length > 0
          ? published.reduce((sum, item) => sum + String(item.caption ?? '').length, 0) /
            published.length
          : safeVariants[0].length;

      let bestIndex = 0;
      let bestScore = Number.POSITIVE_INFINITY;

      safeVariants.forEach((variant, index) => {
        const score = Math.abs(variant.length - targetLength) + index * 2;
        if (score < bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });

      return {
        caption: safeVariants[bestIndex],
        index: bestIndex,
        reason:
          published.length > 0
            ? 'selected_by_published_caption_length_history'
            : 'selected_default_variant',
      };
    },

    getAutonomousPublishPolicy(workflow: WorkflowRecord): AutonomousPublishPolicy {
      return resolveAutonomousPublishPolicy(workflow);
    },

    getContentSafetyPolicy(workflow: WorkflowRecord): ContentSafetyPolicy {
      return resolveContentSafetyPolicy(workflow);
    },

    async getPlatformPublishStats(
      platform: SocialPlatform,
      now: Date,
      dailyLimit: number
    ): Promise<{ publishedToday: number; lastPublishedAt: Date | null }> {
      const dayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
      );
      const publishedTodayRows = (await entityService.findMany(SOCIAL_POST_TICKET_UID, {
        filters: {
          platform,
          status: 'published',
          published_on: {
            $gte: dayStart.toISOString(),
            $lte: now.toISOString(),
          },
        },
        fields: ['id'],
        limit: Math.max(1, dailyLimit + 1),
      })) as Array<{ id: number }>;
      const lastPublishedRows = (await entityService.findMany(SOCIAL_POST_TICKET_UID, {
        filters: {
          platform,
          status: 'published',
        },
        fields: ['published_on'],
        sort: [{ published_on: 'desc' }, { id: 'desc' }],
        limit: 1,
      })) as Array<{ published_on?: string | null }>;
      const lastPublishedRaw = lastPublishedRows[0]?.published_on;
      const lastPublishedAt = lastPublishedRaw ? new Date(lastPublishedRaw) : null;

      return {
        publishedToday: publishedTodayRows.length,
        lastPublishedAt:
          lastPublishedAt && Number.isFinite(lastPublishedAt.getTime()) ? lastPublishedAt : null,
      };
    },

    async evaluateAutonomousPublishDecision(input: {
      ticket: SocialPostTicketRecord;
      workflow: WorkflowRecord;
      platform: SocialPlatform;
      now: Date;
      runState: AutonomousPublishRunState;
    }): Promise<AutonomousPublishDecision> {
      const policy = this.getAutonomousPublishPolicy(input.workflow);

      if (input.workflow.enabled === false) {
        return {
          allowed: false,
          reason: 'workflow_disabled',
          nextAttemptAt: getNextUtcDayAttempt(input.now),
          policy,
        };
      }

      if (input.workflow.auto_publish === false) {
        return {
          allowed: false,
          reason: 'workflow_auto_publish_disabled',
          nextAttemptAt: getNextUtcDayAttempt(input.now),
          policy,
        };
      }

      if (input.runState.publishAttempts >= policy.maxPostsPerRun) {
        return {
          allowed: false,
          reason: 'autonomous_run_cap',
          nextAttemptAt: new Date(input.now.getTime() + 15 * 60 * 1000),
          policy,
        };
      }

      const dailyLimit = policy.maxPostsPerPlatformPerDay[input.platform];
      if (dailyLimit <= 0) {
        return {
          allowed: false,
          reason: 'autonomous_daily_cap',
          nextAttemptAt: getNextUtcDayAttempt(input.now),
          policy,
        };
      }

      const stats = await this.getPlatformPublishStats(input.platform, input.now, dailyLimit);
      const publishedInRun = input.runState.publishedByPlatform.get(input.platform) ?? 0;
      if (stats.publishedToday + publishedInRun >= dailyLimit) {
        return {
          allowed: false,
          reason: 'autonomous_daily_cap',
          nextAttemptAt: getNextUtcDayAttempt(input.now),
          policy,
        };
      }

      const lastPublishedAt = getLaterDate(
        stats.lastPublishedAt,
        input.runState.lastPublishedAtByPlatform.get(input.platform) ?? null
      );
      const cooldownMinutes = policy.cooldownMinutes[input.platform];
      if (lastPublishedAt && cooldownMinutes > 0) {
        const nextAllowedAt = new Date(lastPublishedAt.getTime() + cooldownMinutes * 60 * 1000);
        if (nextAllowedAt.getTime() > input.now.getTime()) {
          return {
            allowed: false,
            reason: 'autonomous_cooldown',
            nextAttemptAt: nextAllowedAt,
            policy,
          };
        }
      }

      return { allowed: true, policy };
    },

    async rescheduleByAutonomousAgent(input: {
      ticket: SocialPostTicketRecord;
      decision: Exclude<AutonomousPublishDecision, { allowed: true }>;
      now: Date;
    }): Promise<void> {
      await entityService.update(SOCIAL_POST_TICKET_UID, input.ticket.id, {
        data: {
          status: 'scheduled',
          next_attempt_at: input.decision.nextAttemptAt,
          blocked_reason: input.decision.reason,
          provider_payload: redactProviderPayload({
            ...(input.ticket.provider_payload ?? {}),
            autonomousAgent: {
              decision: 'rescheduled',
              reason: input.decision.reason,
              decidedAt: input.now.toISOString(),
              nextAttemptAt: input.decision.nextAttemptAt.toISOString(),
              policy: input.decision.policy,
            },
          }),
        },
      });
    },

    async publishPending(
      now: Date
    ): Promise<{ processed: number; published: number; failed: number; rescheduled: number }> {
      const tickets = (await entityService.findMany(SOCIAL_POST_TICKET_UID, {
        filters: {
          platform: {
            $ne: 'tiktok',
          },
          status: {
            $in: ['scheduled', 'pending'],
          },
          scheduled_at: {
            $lte: now.toISOString(),
          },
          $or: [
            { next_attempt_at: { $null: true } },
            { next_attempt_at: { $lte: now.toISOString() } },
          ],
        },
        sort: [{ scheduled_at: 'asc' }, { id: 'asc' }],
        populate: ['workflow'],
        limit: MAX_TICKET_BATCH,
      })) as SocialPostTicketRecord[];

      let published = 0;
      let failed = 0;
      let rescheduled = 0;
      const runState: AutonomousPublishRunState = {
        publishAttempts: 0,
        publishedByPlatform: new Map(),
        lastPublishedAtByPlatform: new Map(),
      };

      for (const ticket of tickets) {
        const workflow = await this.resolveTicketWorkflow(ticket);
        const platform = normalizePlatform(ticket.platform);

        if (workflow && platform) {
          const decision = await this.evaluateAutonomousPublishDecision({
            ticket,
            workflow,
            platform,
            now,
            runState,
          });

          if (decision.allowed === false) {
            await this.rescheduleByAutonomousAgent({
              ticket,
              decision,
              now,
            });
            rescheduled += 1;
            continue;
          }
        }

        runState.publishAttempts += 1;
        const outcome = await this.publishTicket(ticket, now, workflow ?? undefined);
        if (outcome === 'published') {
          published += 1;
          if (platform) {
            runState.publishedByPlatform.set(
              platform,
              (runState.publishedByPlatform.get(platform) ?? 0) + 1
            );
            runState.lastPublishedAtByPlatform.set(platform, now);
          }
        } else if (outcome === 'rescheduled') {
          rescheduled += 1;
        } else {
          failed += 1;
        }
      }

      return {
        processed: tickets.length,
        published,
        failed,
        rescheduled,
      };
    },

    async listTickets(input?: {
      platform?: string;
      status?: string;
      workflowId?: number;
      limit?: number;
      page?: number;
    }): Promise<SocialPostTicketRecord[]> {
      const filters: Record<string, unknown> = {};

      if (input?.platform && normalizePlatform(input.platform)) {
        filters.platform = normalizePlatform(input.platform);
      }

      if (input?.status) {
        filters.status = input.status;
      }

      if (input?.workflowId && Number.isFinite(input.workflowId)) {
        filters.workflow = input.workflowId;
      }

      const page = Math.max(1, Number(input?.page ?? 1));
      const limit = Math.max(1, Math.min(200, Number(input?.limit ?? 50)));
      const start = (page - 1) * limit;

      const tickets = (await entityService.findMany(SOCIAL_POST_TICKET_UID, {
        filters,
        sort: [{ scheduled_at: 'desc' }, { id: 'desc' }],
        populate: ['workflow', 'source_run'],
        start,
        limit,
      })) as SocialPostTicketRecord[];

      return tickets.map((ticket) => sanitizeSocialTicketForAdmin(ticket));
    },

    async retryTicket(id: number): Promise<SocialPostTicketRecord> {
      const ticket = (await entityService.findOne(SOCIAL_POST_TICKET_UID, id, {
        populate: ['workflow', 'source_run'],
      })) as SocialPostTicketRecord | null;

      if (!ticket) {
        throw new Error(`Ticket social #${id} nie istnieje.`);
      }

      if (ticket.status === 'published' || ticket.status === 'canceled') {
        throw new Error(`Ticket #${id} ma status ${ticket.status} i nie może zostać ponowiony.`);
      }

      const updated = (await entityService.update(SOCIAL_POST_TICKET_UID, id, {
        data: {
          status: 'scheduled',
          blocked_reason: null,
          last_error: null,
          next_attempt_at: new Date(),
        },
        populate: ['workflow', 'source_run'],
      })) as SocialPostTicketRecord;

      return sanitizeSocialTicketForAdmin(updated);
    },

    async cancelTicket(id: number): Promise<SocialPostTicketRecord> {
      const ticket = (await entityService.findOne(SOCIAL_POST_TICKET_UID, id, {
        populate: ['workflow', 'source_run'],
      })) as SocialPostTicketRecord | null;

      if (!ticket) {
        throw new Error(`Ticket social #${id} nie istnieje.`);
      }

      if (ticket.status === 'published') {
        throw new Error('Opublikowany ticket nie może zostać anulowany.');
      }

      const updated = (await entityService.update(SOCIAL_POST_TICKET_UID, id, {
        data: {
          status: 'canceled',
          next_attempt_at: null,
          blocked_reason: 'manually_canceled',
        },
        populate: ['workflow', 'source_run'],
      })) as SocialPostTicketRecord;

      return sanitizeSocialTicketForAdmin(updated);
    },

    async testConnection(input: { workflowId: number; channels?: unknown }): Promise<{
      workflowId: number;
      overall: 'ready' | 'needs_action' | 'blocked' | 'degraded';
      channels: ChannelStatus[];
    }> {
      const workflow = await workflowService().getById(input.workflowId);
      if (!workflow) {
        throw new Error(`Workflow #${input.workflowId} nie istnieje.`);
      }

      const channels = normalizeChannels(input.channels ?? workflow.enabled_channels);
      const results: ChannelStatus[] = [];

      for (const channel of channels) {
        const result = await this.testChannelConnection(channel, workflow);
        results.push(result);
        await this.recordProviderConnectionStatus(channel, workflow.id, result);
      }

      const overall = results.some((item) => item.status === 'blocked')
        ? 'blocked'
        : results.some((item) => item.status === 'degraded')
          ? 'degraded'
          : results.some((item) => item.status === 'needs_action')
            ? 'needs_action'
            : 'ready';

      return {
        workflowId: workflow.id,
        overall,
        channels: results,
      };
    },

    async recordProviderConnectionStatus(
      platform: SocialPlatform,
      workflowId: number,
      result: ChannelStatus
    ): Promise<void> {
      const provider = SOCIAL_PLATFORM_PROVIDER[platform];
      const providerStatus = getPluginService<Partial<SocialProviderStatusService> | undefined>(
        strapi,
        'provider-status'
      );
      if (!provider || typeof providerStatus?.upsert !== 'function') {
        return;
      }

      const status =
        result.status === 'ready'
          ? 'ready'
          : result.status === 'needs_action'
            ? 'missing_credentials'
            : result.status === 'degraded'
              ? 'blocked'
              : 'failed';

      await providerStatus.upsert({
        provider,
        status,
        hasCredentials: result.status !== 'needs_action',
        scopes: result.status === 'ready' ? SOCIAL_PROVIDER_SCOPES[platform] ?? [] : [],
        blockedReason: result.status === 'ready' ? undefined : result.message,
        workflowId,
      });
    },

    async dryRunPublish(input: {
      workflowId: number;
      channels?: unknown;
      caption?: string;
      mediaUrl?: string;
      targetUrl?: string;
    }): Promise<{
      workflowId: number;
      overall: 'ready' | 'needs_action' | 'blocked' | 'degraded';
      channels: Array<ChannelStatus & { renderedCaption: string }>;
    }> {
      const workflow = await workflowService().getById(input.workflowId);
      if (!workflow) {
        throw new Error(`Workflow #${input.workflowId} nie istnieje.`);
      }

      const channels = normalizeChannels(input.channels ?? workflow.enabled_channels);

      const baseCaption = String(input.caption ?? 'Przykładowy autopost Star Sign').trim();
      const targetUrl = input.targetUrl?.trim() || buildPublicFrontendUrl('/');
      const mediaUrl = input.mediaUrl?.trim() || DEFAULT_SOCIAL_IMAGE_URL;

      const channelResults: Array<ChannelStatus & { renderedCaption: string }> = [];

      for (const channel of channels) {
        const connection = await this.testChannelConnection(channel, workflow);
        const renderedCaption = composeCaptionForPlatform(channel, baseCaption, targetUrl);

        if (connection.status === 'ready') {
          try {
            this.assertPublishGuardrails({
              platform: channel,
              caption: renderedCaption,
              mediaUrl,
              targetUrl,
              enabledChannels: normalizeChannels(workflow.enabled_channels),
            });
            this.assertContentSafety({
              platform: channel,
              caption: renderedCaption,
              targetUrl,
              workflow,
            });
          } catch (error) {
            const message = toSafeErrorMessage(error);
            channelResults.push({
              platform: channel,
              status: 'blocked',
              message,
              renderedCaption,
            });
            continue;
          }
        }

        channelResults.push({
          ...connection,
          renderedCaption,
        });
      }

      const overall = channelResults.some((item) => item.status === 'blocked')
        ? 'blocked'
        : channelResults.some((item) => item.status === 'degraded')
          ? 'degraded'
          : channelResults.some((item) => item.status === 'needs_action')
            ? 'needs_action'
            : 'ready';

      return {
        workflowId: workflow.id,
        overall,
        channels: channelResults,
      };
    },

    async publishTicket(
      ticket: SocialPostTicketRecord,
      now: Date,
      resolvedWorkflow?: WorkflowRecord
    ): Promise<'published' | 'failed' | 'rescheduled'> {
      const workflow = resolvedWorkflow ?? (await this.resolveTicketWorkflow(ticket));
      const attemptCount = Math.max(0, Number(ticket.attempt_count ?? 0)) + 1;

      try {
        if (!workflow) {
          throw new PublishGuardrailError('Ticket social nie ma przypisanego workflow.', {
            retryable: false,
            blockedReason: 'missing_workflow',
          });
        }

        const platform = normalizePlatform(ticket.platform);
        if (!platform) {
          throw new PublishGuardrailError(`Nieobsługiwana platforma: ${String(ticket.platform)}`, {
            retryable: false,
            blockedReason: 'unsupported_platform',
          });
        }

        await this.assertRuntimePolicyAndProviderReadiness(platform);

        const mediaUrl = await this.resolveMediaUrlForTicket(ticket, workflow);
        const caption = composeCaptionForPlatform(
          platform,
          ticket.caption || '',
          ticket.target_url || undefined
        );

        const enabledChannels = normalizeChannels(workflow.enabled_channels);
        this.assertPublishGuardrails({
          platform,
          caption,
          mediaUrl,
          targetUrl: ticket.target_url || undefined,
          enabledChannels,
        });
        this.assertContentSafety({
          platform,
          caption,
          targetUrl: ticket.target_url || undefined,
          workflow,
        });

        const publishResult = await this.publishToProvider({
          platform,
          caption,
          mediaUrl,
          targetUrl: ticket.target_url || undefined,
          workflow,
        });

        await entityService.update(SOCIAL_POST_TICKET_UID, ticket.id, {
          data: {
            status: 'published',
            published_on: now,
            attempt_count: attemptCount,
            next_attempt_at: null,
            last_error: null,
            blocked_reason: null,
            media_url: mediaUrl,
            provider_post_id: publishResult.providerPostId || null,
            provider_payload: redactProviderPayload(publishResult.providerPayload),
          },
        });

        return 'published';
      } catch (error) {
        const workflowRetryMax = workflow?.retry_max ?? DEFAULT_RETRY_MAX;
        const workflowBackoff = workflow?.retry_backoff_seconds ?? DEFAULT_RETRY_BACKOFF_SECONDS;
        const classification = this.classifyPublishError(error, now);

        if (classification.retryable && attemptCount < workflowRetryMax) {
          const retryIn = computeBackoffSeconds(
            workflowBackoff,
            attemptCount,
            classification.retryAfterSeconds
          );
          const nextAttemptAt = new Date(now.getTime() + retryIn * 1000);

          await entityService.update(SOCIAL_POST_TICKET_UID, ticket.id, {
            data: {
              status: 'scheduled',
              attempt_count: attemptCount,
              next_attempt_at: nextAttemptAt,
              last_error: toSafeErrorMessage(error),
              blocked_reason: null,
              provider_payload: redactProviderPayload(classification.providerPayload),
            },
          });

          return 'rescheduled';
        }

        await entityService.update(SOCIAL_POST_TICKET_UID, ticket.id, {
          data: {
            status: 'failed',
            attempt_count: attemptCount,
            next_attempt_at: null,
            last_error: toSafeErrorMessage(error),
            blocked_reason: classification.blockedReason || 'publish_failed',
            provider_payload: redactProviderPayload(classification.providerPayload),
          },
        });

        return 'failed';
      }
    },

    async assertRuntimePolicyAndProviderReadiness(platform: SocialPlatform): Promise<void> {
      const policy = getPluginService<Partial<SocialAutonomyPolicyService> | undefined>(
        strapi,
        'autonomy-policy'
      );
      if (typeof policy?.evaluate === 'function') {
        const decision = await policy.evaluate({
          action: 'social.publish',
          requiresBrandSafety: true,
          requiresLegalDisclaimer: true,
        });

        if (!decision.allowed) {
          throw new PublishGuardrailError('Autonomy policy zablokowała publikację social.', {
            retryable: false,
            blockedReason: decision.reason,
            providerPayload: {
              autonomyPolicy: {
                decision: 'blocked',
                reason: decision.reason,
              },
            },
          });
        }
      }

      const provider = SOCIAL_PLATFORM_PROVIDER[platform];
      const providerStatus = getPluginService<Partial<SocialProviderStatusService> | undefined>(
        strapi,
        'provider-status'
      );
      if (!provider) {
        return;
      }

      if (typeof providerStatus?.checkProviders !== 'function') {
        if (process.env.AICO_FULL_AUTONOMY_REQUIRED === 'true') {
          throw new PublishGuardrailError('Provider readiness service is unavailable.', {
            retryable: false,
            blockedReason: 'provider_readiness_service_missing',
            providerPayload: {
              providerReadiness: {
                decision: 'blocked',
                reason: 'provider_readiness_service_missing',
                requiredProviders: [provider],
              },
            },
          });
        }

        return;
      }

      const readiness = await providerStatus.checkProviders({
        action: 'social.publish',
        providers: [provider],
      });

      if (!readiness.ready) {
        throw new PublishGuardrailError('Provider readiness zablokował publikację social.', {
          retryable: false,
          blockedReason: 'provider_readiness_blocked',
          providerPayload: {
            providerReadiness: {
              decision: 'blocked',
              requiredProviders: readiness.requiredProviders,
              blockedProviders: readiness.blockedProviders,
            },
          },
        });
      }
    },

    classifyPublishError(error: unknown, now: Date): PublishClassification {
      if (error instanceof PublishGuardrailError) {
        return error.classification;
      }

      if (isAxios(error)) {
        const status = error.response?.status;
        const headers = (error.response?.headers as Record<string, unknown> | undefined) ?? {};

        if (status === 429) {
          return {
            retryable: true,
            blockedReason: 'rate_limited',
            retryAfterSeconds: parseRetryAfterSeconds(headers, now),
            providerPayload: redactProviderPayload({
              status,
              data: error.response?.data,
            }) ?? undefined,
          };
        }

        if (status && (status >= 500 || status === 408 || status === 409 || status === 425)) {
          return {
            retryable: true,
            blockedReason: 'provider_unavailable',
            providerPayload: redactProviderPayload({
              status,
              data: error.response?.data,
            }) ?? undefined,
          };
        }

        return {
          retryable: false,
          blockedReason: 'provider_rejected',
          providerPayload: redactProviderPayload({
            status,
            data: error.response?.data,
          }) ?? undefined,
        };
      }

      const message = toSafeErrorMessage(error).toLowerCase();
      const transientHints = [
        'timeout',
        'timed out',
        'socket',
        'econnreset',
        'enotfound',
        'network',
      ];

      if (transientHints.some((hint) => message.includes(hint))) {
        return {
          retryable: true,
          blockedReason: 'network_error',
        };
      }

      return {
        retryable: false,
        blockedReason: 'publish_failed',
      };
    },

    async resolveTicketWorkflow(ticket: SocialPostTicketRecord): Promise<WorkflowRecord | null> {
      if (ticket.workflow && typeof ticket.workflow === 'object') {
        return ticket.workflow as unknown as WorkflowRecord;
      }

      const workflowId = getWorkflowId(ticket.workflow);
      if (!workflowId) {
        return null;
      }

      return workflowService().getById(workflowId);
    },

    assertPublishGuardrails(input: {
      platform: SocialPlatform;
      caption: string;
      mediaUrl: string;
      targetUrl?: string;
      enabledChannels: SocialPlatform[];
    }): void {
      if (!input.enabledChannels.includes(input.platform)) {
        throw new PublishGuardrailError(`Kanał ${input.platform} nie jest aktywny w workflow.`, {
          retryable: false,
          blockedReason: 'channel_disabled',
        });
      }

      if (input.platform === 'tiktok') {
        throw new PublishGuardrailError('TikTok działa w V1 jako draft-only.', {
          retryable: false,
          blockedReason: 'tiktok_draft_only',
        });
      }

      if (!input.caption.trim()) {
        throw new PublishGuardrailError('Caption nie może być pusty.', {
          retryable: false,
          blockedReason: 'invalid_caption',
        });
      }

      if (!input.mediaUrl.trim()) {
        throw new PublishGuardrailError('Brak URL obrazu dla publikacji social.', {
          retryable: false,
          blockedReason: 'missing_media',
        });
      }

      if (!isPublicHttpUrl(input.mediaUrl)) {
        throw new PublishGuardrailError(`URL obrazu nie jest publiczny: ${input.mediaUrl}`, {
          retryable: false,
          blockedReason: 'media_url_not_public',
        });
      }

      if (input.targetUrl && !isPublicHttpUrl(input.targetUrl)) {
        throw new PublishGuardrailError(`URL docelowy nie jest publiczny: ${input.targetUrl}`, {
          retryable: false,
          blockedReason: 'target_url_not_public',
        });
      }

      if (input.platform === 'twitter' && input.caption.length > 280) {
        throw new PublishGuardrailError('Caption dla X przekracza limit 280 znaków.', {
          retryable: false,
          blockedReason: 'caption_too_long',
        });
      }
    },

    assertContentSafety(input: {
      platform: SocialPlatform;
      caption: string;
      targetUrl?: string;
      workflow: WorkflowRecord;
    }): void {
      const policy = this.getContentSafetyPolicy(input.workflow);

      if (!policy.enabled) {
        return;
      }

      if (policy.requireTargetUrl && !input.targetUrl?.trim()) {
        throw new PublishGuardrailError('Content safety wymaga URL docelowego.', {
          retryable: false,
          blockedReason: 'content_safety_missing_target_url',
          providerPayload: {
            contentSafety: {
              decision: 'blocked',
              reason: 'missing_target_url',
            },
          },
        });
      }

      const maxCaptionLength = policy.maxCaptionLengthByPlatform[input.platform];
      if (maxCaptionLength > 0 && input.caption.length > maxCaptionLength) {
        throw new PublishGuardrailError('Content safety zablokował zbyt długi caption.', {
          retryable: false,
          blockedReason: 'content_safety_caption_too_long',
          providerPayload: {
            contentSafety: {
              decision: 'blocked',
              reason: 'caption_too_long',
              limit: maxCaptionLength,
            },
          },
        });
      }

      const normalizedCaption = normalizeForContentSafety(input.caption);
      const matchedPhrase = policy.blockedPhrases.find((phrase) => {
        const normalizedPhrase = normalizeForContentSafety(phrase);
        return normalizedPhrase && normalizedCaption.includes(normalizedPhrase);
      });

      if (matchedPhrase) {
        throw new PublishGuardrailError('Content safety zablokował caption.', {
          retryable: false,
          blockedReason: 'content_safety_blocked_phrase',
          providerPayload: {
            contentSafety: {
              decision: 'blocked',
              reason: 'blocked_phrase',
              phraseHash: phraseHash(matchedPhrase),
            },
          },
        });
      }
    },

    async resolveMediaUrlForTicket(
      ticket: SocialPostTicketRecord,
      workflow: WorkflowRecord
    ): Promise<string> {
      const mediaCandidate = ticket.media_url?.trim();
      if (mediaCandidate) {
        return mediaCandidate;
      }

      const serverUrl = String(strapi.config.get('server.url') || '').trim();

      if (ticket.related_content_uid && ticket.related_content_id) {
        try {
          const entry = (await entityService.findOne(
            ticket.related_content_uid,
            ticket.related_content_id,
            {
              populate: ['image'],
            }
          )) as Record<string, unknown> | null;

          const image = (entry?.image || null) as { url?: string } | null;
          if (image?.url) {
            const absolute = toAbsoluteUrl(image.url, serverUrl);
            if (absolute) {
              return absolute;
            }
          }
        } catch (error) {
          strapi.log.warn(
            `[aico] Nie udało się pobrać obrazu dla ${ticket.related_content_uid}#${ticket.related_content_id}: ${toSafeErrorMessage(error)}`
          );
        }
      }

      if (DEFAULT_SOCIAL_IMAGE_URL) {
        return DEFAULT_SOCIAL_IMAGE_URL;
      }

      throw new PublishGuardrailError(
        `Brak obrazu do publikacji w ticket #${ticket.id} (workflow #${workflow.id}).`,
        {
          retryable: false,
          blockedReason: 'missing_media',
        }
      );
    },

    async publishToProvider(input: {
      platform: SocialPlatform;
      caption: string;
      mediaUrl: string;
      targetUrl?: string;
      workflow: WorkflowRecord;
    }): Promise<{ providerPostId?: string; providerPayload?: Record<string, unknown> }> {
      if (input.platform === 'facebook') {
        return this.publishToFacebook(input);
      }

      if (input.platform === 'instagram') {
        return this.publishToInstagram(input);
      }

      if (input.platform === 'twitter') {
        return this.publishToX(input);
      }

      if (input.platform === 'tiktok') {
        throw new PublishGuardrailError('TikTok działa w V1 jako draft-only.', {
          retryable: false,
          blockedReason: 'tiktok_draft_only',
        });
      }

      throw new PublishGuardrailError(`Nieobsługiwana platforma: ${input.platform}`, {
        retryable: false,
        blockedReason: 'unsupported_platform',
      });
    },

    async publishToFacebook(input: {
      caption: string;
      mediaUrl: string;
      targetUrl?: string;
      workflow: WorkflowRecord;
    }): Promise<{ providerPostId?: string; providerPayload?: Record<string, unknown> }> {
      if (!input.workflow.fb_page_id || !input.workflow.fb_access_token_encrypted) {
        throw new PublishGuardrailError('Workflow nie ma kompletnej konfiguracji Facebook.', {
          retryable: false,
          blockedReason: 'missing_facebook_config',
        });
      }

      const token = workflowService().decryptEncryptedValue(
        input.workflow.fb_access_token_encrypted,
        `Facebook token workflow #${input.workflow.id}`
      );

      const message = appendLinkIfMissing(input.caption, input.targetUrl);
      const endpoint = `${GRAPH_API_BASE}/${input.workflow.fb_page_id}/photos`;

      const response = await axios.post(
        endpoint,
        {
          url: input.mediaUrl,
          caption: message,
          published: true,
          access_token: token,
        },
        {
          timeout: 20_000,
        }
      );

      const providerPostId = String(response.data?.post_id || response.data?.id || '');
      if (!providerPostId) {
        throw new PublishGuardrailError('Facebook API nie zwróciło ID posta.', {
          retryable: true,
          blockedReason: 'facebook_missing_post_id',
          providerPayload: { data: response.data as Record<string, unknown> },
        });
      }

      return {
        providerPostId,
        providerPayload: {
          endpoint,
          postId: providerPostId,
        },
      };
    },

    async publishToInstagram(input: {
      caption: string;
      mediaUrl: string;
      workflow: WorkflowRecord;
    }): Promise<{ providerPostId?: string; providerPayload?: Record<string, unknown> }> {
      if (!input.workflow.ig_user_id || !input.workflow.ig_access_token_encrypted) {
        throw new PublishGuardrailError('Workflow nie ma kompletnej konfiguracji Instagram.', {
          retryable: false,
          blockedReason: 'missing_instagram_config',
        });
      }

      if (!isPublicHttpUrl(input.mediaUrl)) {
        throw new PublishGuardrailError('Instagram wymaga publicznego URL obrazu.', {
          retryable: false,
          blockedReason: 'media_url_not_public',
        });
      }

      const token = workflowService().decryptEncryptedValue(
        input.workflow.ig_access_token_encrypted,
        `Instagram token workflow #${input.workflow.id}`
      );

      const createContainer = await axios.post(
        `${GRAPH_API_BASE}/${input.workflow.ig_user_id}/media`,
        {
          image_url: input.mediaUrl,
          caption: input.caption,
          access_token: token,
        },
        {
          timeout: 20_000,
        }
      );

      const creationId = String(createContainer.data?.id || '');
      if (!creationId) {
        throw new PublishGuardrailError('Instagram API nie zwróciło creation_id.', {
          retryable: true,
          blockedReason: 'instagram_missing_creation_id',
          providerPayload: {
            data: createContainer.data as Record<string, unknown>,
          },
        });
      }

      const statusTrace: Array<{ attempt: number; status_code?: string; status?: string }> = [];
      let ready = false;

      for (let attempt = 1; attempt <= 10; attempt += 1) {
        const statusResponse = await axios.get(`${GRAPH_API_BASE}/${creationId}`, {
          params: {
            fields: 'status_code,status',
            access_token: token,
          },
          timeout: 15_000,
        });

        const statusCode = String(statusResponse.data?.status_code || '');
        const status = String(statusResponse.data?.status || '');
        statusTrace.push({ attempt, status_code: statusCode, status });

        if (statusCode === 'FINISHED') {
          ready = true;
          break;
        }

        if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
          throw new PublishGuardrailError(`Instagram container status: ${statusCode}`, {
            retryable: true,
            blockedReason: 'instagram_container_error',
            providerPayload: {
              creationId,
              statusTrace,
            },
          });
        }

        await sleep(2_000);
      }

      if (!ready) {
        throw new PublishGuardrailError('Instagram container nie osiągnął stanu FINISHED.', {
          retryable: true,
          blockedReason: 'instagram_container_timeout',
          providerPayload: {
            creationId,
            statusTrace,
          },
        });
      }

      const publishResponse = await axios.post(
        `${GRAPH_API_BASE}/${input.workflow.ig_user_id}/media_publish`,
        {
          creation_id: creationId,
          access_token: token,
        },
        {
          timeout: 20_000,
        }
      );

      const postId = String(publishResponse.data?.id || '');
      if (!postId) {
        throw new PublishGuardrailError('Instagram publish nie zwrócił ID posta.', {
          retryable: true,
          blockedReason: 'instagram_missing_post_id',
          providerPayload: {
            creationId,
            data: publishResponse.data as Record<string, unknown>,
          },
        });
      }

      return {
        providerPostId: postId,
        providerPayload: {
          creationId,
          statusTrace,
          postId,
        },
      };
    },

    async publishToX(input: {
      caption: string;
      mediaUrl: string;
      workflow: WorkflowRecord;
    }): Promise<{ providerPostId?: string; providerPayload?: Record<string, unknown> }> {
      if (
        !input.workflow.x_api_key ||
        !input.workflow.x_api_secret_encrypted ||
        !input.workflow.x_access_token_encrypted ||
        !input.workflow.x_access_token_secret_encrypted
      ) {
        throw new PublishGuardrailError('Workflow nie ma kompletnej konfiguracji X (OAuth 1.0a).', {
          retryable: false,
          blockedReason: 'missing_x_config',
        });
      }

      const consumerKey = input.workflow.x_api_key;
      const consumerSecret = workflowService().decryptEncryptedValue(
        input.workflow.x_api_secret_encrypted,
        `X API secret workflow #${input.workflow.id}`
      );
      const token = workflowService().decryptEncryptedValue(
        input.workflow.x_access_token_encrypted,
        `X access token workflow #${input.workflow.id}`
      );
      const tokenSecret = workflowService().decryptEncryptedValue(
        input.workflow.x_access_token_secret_encrypted,
        `X access token secret workflow #${input.workflow.id}`
      );

      const imageResponse = await axios.get<ArrayBuffer>(input.mediaUrl, {
        responseType: 'arraybuffer',
        timeout: 20_000,
      });
      const mediaBase64 = Buffer.from(imageResponse.data).toString('base64');

      const mediaBody = {
        media_data: mediaBase64,
      };
      const mediaAuthHeader = buildOAuthHeader({
        method: 'POST',
        url: X_UPLOAD_MEDIA_URL,
        bodyParams: mediaBody,
        consumerKey,
        consumerSecret,
        token,
        tokenSecret,
      });

      const mediaUploadResponse = await axios.post(
        X_UPLOAD_MEDIA_URL,
        new URLSearchParams(mediaBody).toString(),
        {
          headers: {
            Authorization: mediaAuthHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 30_000,
        }
      );

      const mediaId = String(
        mediaUploadResponse.data?.media_id_string || mediaUploadResponse.data?.media_id || ''
      );
      if (!mediaId) {
        throw new PublishGuardrailError('X media upload nie zwrócił media_id.', {
          retryable: true,
          blockedReason: 'x_missing_media_id',
          providerPayload: {
            data: mediaUploadResponse.data as Record<string, unknown>,
          },
        });
      }

      const statusBody = {
        status: input.caption,
        media_ids: mediaId,
      };

      const statusAuthHeader = buildOAuthHeader({
        method: 'POST',
        url: X_STATUS_UPDATE_URL,
        bodyParams: statusBody,
        consumerKey,
        consumerSecret,
        token,
        tokenSecret,
      });

      const statusResponse = await axios.post(
        X_STATUS_UPDATE_URL,
        new URLSearchParams(statusBody).toString(),
        {
          headers: {
            Authorization: statusAuthHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 20_000,
        }
      );

      const postId = String(statusResponse.data?.id_str || statusResponse.data?.id || '');
      if (!postId) {
        throw new PublishGuardrailError('X publish nie zwrócił ID posta.', {
          retryable: true,
          blockedReason: 'x_missing_post_id',
          providerPayload: {
            mediaId,
            data: statusResponse.data as Record<string, unknown>,
          },
        });
      }

      return {
        providerPostId: postId,
        providerPayload: {
          mediaId,
          postId,
        },
      };
    },

    async testChannelConnection(
      platform: SocialPlatform,
      workflow: WorkflowRecord
    ): Promise<ChannelStatus> {
      try {
        if (platform === 'facebook') {
          if (!workflow.fb_page_id || !workflow.fb_access_token_encrypted) {
            return {
              platform,
              status: 'needs_action',
              message: 'Brak fb_page_id lub tokena Facebook.',
            };
          }

          const token = workflowService().decryptEncryptedValue(
            workflow.fb_access_token_encrypted,
            `Facebook token workflow #${workflow.id}`
          );

          const response = await axios.get(`${GRAPH_API_BASE}/${workflow.fb_page_id}`, {
            params: {
              fields: 'id,name',
              access_token: token,
            },
            timeout: 15_000,
          });

          return {
            platform,
            status: 'ready',
            message: 'Połączenie Facebook OK.',
            details: {
              pageId: response.data?.id,
              pageName: response.data?.name,
            },
          };
        }

        if (platform === 'instagram') {
          if (!workflow.ig_user_id || !workflow.ig_access_token_encrypted) {
            return {
              platform,
              status: 'needs_action',
              message: 'Brak ig_user_id lub tokena Instagram.',
            };
          }

          const token = workflowService().decryptEncryptedValue(
            workflow.ig_access_token_encrypted,
            `Instagram token workflow #${workflow.id}`
          );

          const response = await axios.get(`${GRAPH_API_BASE}/${workflow.ig_user_id}`, {
            params: {
              fields: 'id,username',
              access_token: token,
            },
            timeout: 15_000,
          });

          return {
            platform,
            status: 'ready',
            message: 'Połączenie Instagram OK.',
            details: {
              userId: response.data?.id,
              username: response.data?.username,
            },
          };
        }

        if (platform === 'tiktok') {
          return {
            platform,
            status: 'degraded',
            message: 'TikTok jest dostępny jako draft-only; publikacja automatyczna jest wyłączona.',
            details: {
              draftOnly: true,
            },
          };
        }

        if (
          !workflow.x_api_key ||
          !workflow.x_api_secret_encrypted ||
          !workflow.x_access_token_encrypted ||
          !workflow.x_access_token_secret_encrypted
        ) {
          return {
            platform,
            status: 'needs_action',
            message: 'Brak kompletu credentiali X (api key/secret + access token/secret).',
          };
        }

        const consumerKey = workflow.x_api_key;
        const consumerSecret = workflowService().decryptEncryptedValue(
          workflow.x_api_secret_encrypted,
          `X API secret workflow #${workflow.id}`
        );
        const token = workflowService().decryptEncryptedValue(
          workflow.x_access_token_encrypted,
          `X access token workflow #${workflow.id}`
        );
        const tokenSecret = workflowService().decryptEncryptedValue(
          workflow.x_access_token_secret_encrypted,
          `X access token secret workflow #${workflow.id}`
        );

        const queryParams = {
          include_entities: 'false',
          skip_status: 'true',
        };

        const authHeader = buildOAuthHeader({
          method: 'GET',
          url: X_VERIFY_URL,
          queryParams,
          consumerKey,
          consumerSecret,
          token,
          tokenSecret,
        });

        const response = await axios.get(X_VERIFY_URL, {
          params: queryParams,
          headers: {
            Authorization: authHeader,
          },
          timeout: 15_000,
        });

        return {
          platform,
          status: 'ready',
          message: 'Połączenie X OK.',
          details: {
            userId: response.data?.id_str,
            screenName: response.data?.screen_name,
          },
        };
      } catch (error) {
        if (isAxios(error) && error.response?.status === 401) {
          return {
            platform,
            status: 'blocked',
            message: `Błąd autoryzacji ${platform}: 401`,
            details: {
              status: error.response.status,
              data: error.response.data as Record<string, unknown>,
            },
          };
        }

        if (isAxios(error) && error.response?.status === 403) {
          return {
            platform,
            status: 'blocked',
            message: `Dostęp odrzucony przez ${platform}: 403`,
            details: {
              status: error.response.status,
              data: error.response.data as Record<string, unknown>,
            },
          };
        }

        return {
          platform,
          status: 'degraded',
          message: `Połączenie ${platform} chwilowo niedostępne: ${toSafeErrorMessage(error)}`,
        };
      }
    },
  };
};

export default socialPublisher;
