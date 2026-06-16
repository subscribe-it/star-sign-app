import { GENERATION_JOB_UID, SOCIAL_POST_TICKET_UID, VIDEO_ASSET_UID } from '../constants';
import type { AutonomyPolicyRecord, GenerationJobRecord, Strapi, VideoAssetRecord } from '../types';
import { recordSystemAuditEvent } from '../utils/audit-trail';
import { buildAstrologyVideoScript, type AstrologyVideoSubject } from '../utils/astrology-video';
import { getEntityService } from '../utils/entity-service';
import { getPluginService } from '../utils/plugin';

// Short-form platforms that accept a vertical (9:16) video: Reels / Shorts / TikTok / FB.
const VIDEO_PLATFORMS = ['tiktok', 'instagram', 'facebook', 'youtube_shorts'] as const;

const toAbsoluteMediaUrl = (value: unknown, serverUrl: string): string | null => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!serverUrl) return null;
  return `${serverUrl.replace(/\/$/, '')}/${raw.replace(/^\//, '')}`;
};

const resolveVideoMediaUrl = (video: VideoAssetRecord): string | null => {
  const asset = (video as unknown as { asset?: unknown }).asset;
  if (!asset || typeof asset !== 'object') return null;
  const direct = (asset as { url?: unknown }).url;
  if (typeof direct === 'string') return direct;
  const nested = (asset as { data?: { attributes?: { url?: unknown } } }).data?.attributes?.url;
  return typeof nested === 'string' ? nested : null;
};

type CreateVideoJobInput = {
  title: string;
  script?: string;
  subject?: AstrologyVideoSubject;
  workflowId?: number;
  generationJobId?: number;
  idempotencyKey?: string;
  durationSeconds?: number;
  dryRun?: boolean;
};

type PublishVideoInput = {
  videoAssetId: number;
  platforms?: string[];
  caption?: string;
  scheduledAt?: Date | string;
};

type PublishVideoTicketResult = {
  platform: string;
  id?: number;
  status: string;
  reason?: string;
};

type AutonomyPolicyService = {
  evaluate: (input: {
    action: 'video.generate';
    requiresBrandSafety?: boolean;
    requiresLegalDisclaimer?: boolean;
  }) => Promise<{ allowed: boolean; reason: string }>;
};

type VideoProviderAdapterService = {
  render: (video: VideoAssetRecord) => Promise<{
    ok: boolean;
    mode: 'disabled' | 'sandbox' | 'replicate' | 'live';
    status: VideoAssetRecord['status'];
    reason: string;
    provider?: string;
    providerJobId?: string;
    providerPayload?: Record<string, unknown>;
  }>;
};

type ProviderStatusService = {
  checkProviders: (input: { action: 'video.generate' }) => Promise<{
    ready: boolean;
    requiredProviders: string[];
    blockedProviders: Array<{ provider: string; blockedReason?: string | null }>;
  }>;
};

const isTruthy = (value: unknown): boolean =>
  ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());

const getVideoProviderMode = (): string =>
  String(process.env.AICO_VIDEO_PROVIDER_MODE ?? 'disabled').trim().toLowerCase();

const videoAgent = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  return {
    async list(input: { status?: string; limit?: number } = {}): Promise<VideoAssetRecord[]> {
      const filters: Record<string, unknown> = {};
      if (input.status) filters.status = input.status;

      return entityService.findMany<VideoAssetRecord>(VIDEO_ASSET_UID, {
        filters,
        sort: [{ createdAt: 'desc' }],
        populate: ['workflow', 'generation_job'],
        limit: Math.max(1, Math.min(200, Number(input.limit ?? 50))),
      });
    },

    async createJob(input: CreateVideoJobInput): Promise<{
      dryRun: boolean;
      video?: VideoAssetRecord;
      plan: Record<string, unknown>;
    }> {
      const durationSeconds = Math.max(20, Math.min(45, Number(input.durationSeconds ?? 30)));
      // Auto-build an astrology-themed script/storyboard/captions when a subject
      // (zodiac / tarot / horoscope) is provided and no explicit script is given.
      const built = input.subject
        ? buildAstrologyVideoScript(input.subject, { durationSeconds })
        : null;
      const plan = {
        title: input.title,
        aspectRatio: '9:16',
        resolution: '1080x1920',
        durationSeconds,
        channels: ['tiktok', 'youtube_shorts', 'instagram'],
        subjectKind: input.subject?.kind ?? null,
        status: 'queued',
      };

      if (input.dryRun) {
        return { dryRun: true, plan };
      }

      const policy = getPluginService<AutonomyPolicyService>(strapi, 'autonomy-policy');
      const decision = await policy.evaluate({
        action: 'video.generate',
        requiresBrandSafety: true,
        requiresLegalDisclaimer: true,
      });

      if (!decision.allowed) {
        return {
          dryRun: false,
          plan: {
            ...plan,
            status: 'blocked',
            blockedReason: decision.reason,
          },
        };
      }

      let generationJobId = input.generationJobId;

      if (!generationJobId && input.idempotencyKey) {
        const existingJobs = await entityService.findMany<GenerationJobRecord>(GENERATION_JOB_UID, {
          filters: { idempotency_key: input.idempotencyKey },
          limit: 1,
        });
        generationJobId = existingJobs[0]?.id;
      }

      if (!generationJobId) {
        generationJobId = (
          await entityService.create<{ id: number }>(GENERATION_JOB_UID, {
            data: {
              job_type: 'video',
              status: 'queued',
              input_summary: plan,
              workflow: input.workflowId,
              idempotency_key: input.idempotencyKey,
            },
          })
        ).id;
      }

      if (input.idempotencyKey) {
        const existingVideos = await entityService.findMany<VideoAssetRecord>(VIDEO_ASSET_UID, {
          filters: { generation_job: generationJobId },
          populate: ['workflow', 'generation_job'],
          limit: 1,
        });

        if (existingVideos[0]) {
          return { dryRun: false, video: existingVideos[0], plan: { ...plan, generationJobId } };
        }
      }

      const video = await entityService.create<VideoAssetRecord>(VIDEO_ASSET_UID, {
        data: {
          title: input.title,
          status: 'queued',
          script: input.script?.trim() || built?.script || '',
          storyboard: built ? { scenes: built.storyboard } : undefined,
          text_overlay: built ? { items: built.textOverlay } : undefined,
          subtitles: built ? built.subtitles : undefined,
          aspect_ratio: '9:16',
          duration_seconds: durationSeconds,
          platform_variants: {
            tiktok: { privacy: 'provider_preflight_required' },
            youtube_shorts: { privacy: 'unlisted_until_preflight' },
            instagram: { format: 'reels' },
            ...(built ? { captions: built.captionByPlatform } : {}),
          },
          workflow: input.workflowId,
          generation_job: generationJobId,
          metadata: {
            createdBy: 'video-agent',
            idempotencyKey: input.idempotencyKey,
            liveProviderCalls: false,
            subjectKind: built?.subjectKind ?? null,
            hashtags: built?.hashtags ?? [],
            captionByPlatform: built?.captionByPlatform ?? null,
          },
        },
      });

      return { dryRun: false, video, plan: { ...plan, generationJobId } };
    },

    async render(id: number): Promise<VideoAssetRecord> {
      const video = await entityService.findOne<VideoAssetRecord>(VIDEO_ASSET_UID, id, {
        populate: ['workflow', 'generation_job'],
      });
      if (!video) {
        throw new Error('Nie znaleziono assetu video.');
      }

      const policy = getPluginService<AutonomyPolicyService>(strapi, 'autonomy-policy');
      const decision = await policy.evaluate({
        action: 'video.generate',
        requiresBrandSafety: true,
        requiresLegalDisclaimer: true,
      });

      if (!decision.allowed) {
        return entityService.update<VideoAssetRecord>(VIDEO_ASSET_UID, id, {
          data: {
            status: 'failed',
            blocked_reason: decision.reason,
          },
        });
      }

      const providerStatus = getPluginService<ProviderStatusService | undefined>(strapi, 'provider-status');
      if (providerStatus?.checkProviders) {
        const providerDecision = await providerStatus.checkProviders({ action: 'video.generate' });
        if (!providerDecision.ready) {
          return entityService.update<VideoAssetRecord>(VIDEO_ASSET_UID, id, {
            data: {
              status: 'failed',
              blocked_reason: 'provider_readiness_blocked',
              metadata: {
                ...(video.metadata ?? {}),
                providerReadiness: providerDecision,
              },
            },
          });
        }
      } else if (isTruthy(process.env.AICO_FULL_AUTONOMY_REQUIRED) || getVideoProviderMode() === 'replicate') {
        return entityService.update<VideoAssetRecord>(VIDEO_ASSET_UID, id, {
          data: {
            status: 'failed',
            blocked_reason: 'provider_readiness_service_missing',
          },
        });
      }

      const adapter = getPluginService<VideoProviderAdapterService>(strapi, 'video-provider-adapter');
      const result = await adapter.render(video);

      return entityService.update<VideoAssetRecord>(VIDEO_ASSET_UID, id, {
        data: {
          status: result.status,
          provider: result.provider,
          provider_job_id: result.providerJobId,
          blocked_reason: result.ok ? null : result.reason,
          metadata: {
            ...(video.metadata ?? {}),
            providerMode: result.mode,
            providerDecision: result.reason,
            liveProviderCalls: result.mode === 'replicate',
            ...(result.providerPayload ?? {}),
          },
        },
      });
    },

    // Publish bridge: turn a rendered video asset into social-post-tickets for the
    // short-form platforms (TikTok / IG Reels / FB / YT Shorts). The social-publisher
    // then delivers them on its tick with the existing per-platform safety
    // (TikTok stays draft-only). Idempotent per (video, platform, day).
    async publish(input: PublishVideoInput): Promise<{
      created: number;
      skipped: number;
      blocked?: string;
      mediaUrl?: string;
      platforms: string[];
      tickets: PublishVideoTicketResult[];
    }> {
      const video = await entityService.findOne<VideoAssetRecord>(VIDEO_ASSET_UID, input.videoAssetId, {
        populate: ['asset', 'workflow'],
      });
      if (!video) {
        throw new Error('Nie znaleziono assetu video.');
      }

      const serverUrl = String(
        (strapi.config as { get?: (key: string) => unknown } | undefined)?.get?.('server.url') ??
          process.env.SERVER_URL ??
          ''
      ).trim();
      const mediaUrl = toAbsoluteMediaUrl(resolveVideoMediaUrl(video), serverUrl);
      if (!mediaUrl) {
        return { created: 0, skipped: 0, blocked: 'media_url_not_public', platforms: [], tickets: [] };
      }

      const policyService = getPluginService<
        | {
            getPolicy?: () => Promise<AutonomyPolicyRecord>;
            evaluate?: (i: {
              action: 'social.publish';
              requiresBrandSafety?: boolean;
              requiresLegalDisclaimer?: boolean;
            }) => Promise<{ allowed: boolean; reason: string }>;
          }
        | undefined
      >(strapi, 'autonomy-policy');

      let policy: AutonomyPolicyRecord | null = null;
      try {
        policy = (await policyService?.getPolicy?.()) ?? null;
      } catch {
        policy = null;
      }

      const allowList = Array.isArray(policy?.allowed_social_channels)
        ? (policy?.allowed_social_channels as string[])
        : null;
      const requested = input.platforms?.length ? input.platforms : [...VIDEO_PLATFORMS];
      const platforms = requested.filter(
        (p) => (VIDEO_PLATFORMS as readonly string[]).includes(p) && (!allowList || allowList.includes(p))
      );

      if (platforms.length === 0) {
        return { created: 0, skipped: 0, blocked: 'no_allowed_platforms', mediaUrl, platforms: [], tickets: [] };
      }

      if (typeof policyService?.evaluate === 'function') {
        const decision = await policyService.evaluate({
          action: 'social.publish',
          requiresBrandSafety: true,
          requiresLegalDisclaimer: true,
        });
        if (!decision.allowed) {
          return {
            created: 0,
            skipped: 0,
            blocked: decision.reason,
            mediaUrl,
            platforms,
            tickets: platforms.map((p) => ({ platform: p, status: 'blocked', reason: decision.reason })),
          };
        }
      }

      const captionByPlatform = (video.metadata?.captionByPlatform ?? {}) as Record<string, string>;
      const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : new Date();
      const day = scheduledAt.toISOString().slice(0, 10);
      const workflowId = typeof video.workflow === 'number' ? video.workflow : video.workflow?.id;

      let created = 0;
      let skipped = 0;
      const tickets: PublishVideoTicketResult[] = [];

      for (const platform of platforms) {
        const idempotencyKey = `video:${video.id}:${platform}:${day}`;
        const existing = (await entityService.findMany(SOCIAL_POST_TICKET_UID, {
          filters: { idempotency_key: idempotencyKey },
          limit: 1,
        })) as Array<{ id: number }>;

        if (existing[0]) {
          skipped += 1;
          tickets.push({ platform, id: existing[0].id, status: 'exists' });
          continue;
        }

        const caption =
          input.caption?.trim() || captionByPlatform[platform] || video.title || 'Astrologia';
        const isTiktokDraft = platform === 'tiktok';

        const row = (await entityService.create(SOCIAL_POST_TICKET_UID, {
          data: {
            platform,
            content_format: 'video',
            status: isTiktokDraft ? 'pending' : 'scheduled',
            caption,
            media_url: mediaUrl,
            scheduled_at: scheduledAt,
            attempt_count: 0,
            idempotency_key: idempotencyKey,
            blocked_reason: isTiktokDraft ? 'draft_only' : null,
            video_asset: video.id,
            workflow: workflowId,
            provider_payload: {
              source: 'video-agent',
              subjectKind: video.metadata?.subjectKind ?? null,
            },
          },
        })) as { id: number };

        created += 1;
        tickets.push({ platform, id: row.id, status: isTiktokDraft ? 'pending' : 'scheduled' });
      }

      await recordSystemAuditEvent(strapi, {
        action: 'video.publish.enqueue',
        outcome: 'success',
        resourceUid: VIDEO_ASSET_UID,
        resourceId: video.id,
        metadata: { created, skipped, platforms, mediaUrl },
      });

      return { created, skipped, mediaUrl, platforms, tickets };
    },
  };
};

export default videoAgent;
