import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { DEFAULT_TIMEZONE, GENERATION_JOB_UID, SOCIAL_POST_TICKET_UID, VIDEO_ASSET_UID } from '../constants';
import type { AutonomyPolicyRecord, GenerationJobRecord, Strapi, VideoAssetRecord } from '../types';
import { recordSystemAuditEvent } from '../utils/audit-trail';
import { buildAstrologyVideoScript, type AstrologyVideoSubject } from '../utils/astrology-video';
import { formatDateInZone } from '../utils/date-time';
import { getEntityService } from '../utils/entity-service';
import { resolveMediaPublicDir } from './media-generator';
import { getPluginService } from '../utils/plugin';

// Hard cap on the rendered-video download (bytes) to bound memory / guard
// against a hostile or misbehaving provider returning an oversized payload.
const MAX_RENDERED_VIDEO_BYTES = 200 * 1024 * 1024;

// Short-form platforms that accept a vertical (9:16) video: Reels / Shorts / TikTok / FB.
const VIDEO_PLATFORMS = ['tiktok', 'instagram', 'facebook', 'youtube_shorts'] as const;

// Platforms whose autonomous video delivery is NOT implemented in social-publisher
// yet — we enqueue them as drafts (status pending) for manual review instead of
// 'scheduled', so the publisher never tries (and fails) to auto-send them.
const DRAFT_ONLY_VIDEO_PLATFORMS = new Set(['tiktok', 'youtube_shorts']);

// Only publish a video that actually has a finished, attachable asset.
const PUBLISHABLE_VIDEO_STATUSES = new Set(['uploaded', 'qc_passed', 'scheduled']);

const toAbsoluteMediaUrl = (value: unknown, serverUrl: string): string | null => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!serverUrl) return null;
  return `${serverUrl.replace(/\/$/, '')}/${raw.replace(/^\//, '')}`;
};

// A social platform must be able to fetch the media — reject localhost / private
// hosts so we never persist a non-public URL into tickets or the audit trail.
const isPublicHttpUrl = (value: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host)) return false;
  if (host.endsWith('.local')) return false;
  if (/^10\./.test(host) || /^192\.168\./.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  return true;
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
  getPrediction?: (jobId: string) => Promise<{ status: string; videoUrl: string | null }>;
};

type PollRendersResult = {
  checked: number;
  completed: number;
  failed: number;
  pending: number;
};

// Replicate prediction statuses we treat as terminal failures for a render job.
const TERMINAL_FAILED_RENDER_STATUSES = new Set(['failed', 'canceled']);

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

// Best-effort extension/mime sniff from a provider URL; default to mp4 which is
// the universal short-form container.
const resolveVideoFileMeta = (url: string): { ext: string; mime: string } => {
  let pathname = '';
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    pathname = url.toLowerCase();
  }
  if (pathname.endsWith('.webm')) return { ext: 'webm', mime: 'video/webm' };
  if (pathname.endsWith('.mov')) return { ext: 'mov', mime: 'video/quicktime' };
  if (pathname.endsWith('.m4v')) return { ext: 'm4v', mime: 'video/x-m4v' };
  return { ext: 'mp4', mime: 'video/mp4' };
};

// Download a rendered video from the (already SSRF-checked) provider URL and
// upload it into Strapi, mirroring media-generator: bounded download → temp file
// in public/uploads/tmp → upload service → fileId → cleanup in finally.
const downloadAndUploadVideo = async (
  strapi: Strapi,
  videoUrl: string,
  asset: VideoAssetRecord
): Promise<number> => {
  const response = await axios.get(videoUrl, {
    responseType: 'arraybuffer',
    timeout: 120_000,
    maxContentLength: MAX_RENDERED_VIDEO_BYTES,
    maxBodyLength: MAX_RENDERED_VIDEO_BYTES,
  });
  const buffer = Buffer.from(response.data, 'binary');

  const { ext, mime } = resolveVideoFileMeta(videoUrl);
  const publicDir = resolveMediaPublicDir();
  const tmpDir = path.join(publicDir, 'uploads', 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const filename = `video_${asset.id}_${Date.now()}.${ext}`;
  const tmpPath = path.join(tmpDir, filename);
  fs.writeFileSync(tmpPath, buffer);

  try {
    const uploadService = strapi.plugin('upload').service('upload');
    const uploadedFiles = await uploadService.upload({
      data: {
        fileInfo: {
          alternativeText: asset.title,
          caption: asset.title,
          name: filename,
        },
      },
      files: {
        filepath: tmpPath,
        originalFilename: filename,
        name: filename,
        type: mime,
        size: buffer.length,
      },
    });

    return uploadedFiles[0].id as number;
  } finally {
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
};

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

    // Render completion sweep: for assets stuck at 'rendering' with a provider job
    // id, poll the provider, and when the render succeeded download the result +
    // attach it to the asset so it becomes publishable ('uploaded'). Best-effort
    // and idempotent — a poll is a read, the download/upload only runs once the
    // asset flips to 'uploaded', and a transient provider hiccup leaves the asset
    // 'rendering' for the next tick. Replicate-mode only.
    async pollRenders(input: { limit?: number } = {}): Promise<PollRendersResult> {
      const result: PollRendersResult = { checked: 0, completed: 0, failed: 0, pending: 0 };

      if (getVideoProviderMode() !== 'replicate') {
        return result;
      }

      const adapter = getPluginService<VideoProviderAdapterService | undefined>(
        strapi,
        'video-provider-adapter'
      );
      if (!adapter || typeof adapter.getPrediction !== 'function') {
        return result;
      }

      const limit = Math.max(1, Math.min(50, Number(input.limit ?? 10)));
      const assets = await entityService.findMany<VideoAssetRecord>(VIDEO_ASSET_UID, {
        filters: { status: 'rendering', provider_job_id: { $notNull: true } },
        sort: [{ updatedAt: 'asc' }],
        limit,
      });

      for (const asset of assets) {
        const jobId = String(asset.provider_job_id ?? '').trim();
        if (!jobId) {
          continue;
        }

        result.checked += 1;

        try {
          const prediction = await adapter.getPrediction(jobId);

          if (prediction.status === 'succeeded') {
            const videoUrl = prediction.videoUrl;
            if (!videoUrl || !isPublicHttpUrl(videoUrl)) {
              // Succeeded but no usable/public URL — terminal failure so we don't
              // poll a finished job forever.
              await entityService.update<VideoAssetRecord>(VIDEO_ASSET_UID, asset.id, {
                data: {
                  status: 'failed',
                  last_error: 'render_succeeded_no_public_url',
                },
              });
              result.failed += 1;
              continue;
            }

            const fileId = await downloadAndUploadVideo(strapi, videoUrl, asset);
            await entityService.update<VideoAssetRecord>(VIDEO_ASSET_UID, asset.id, {
              data: {
                asset: fileId,
                status: 'uploaded',
                blocked_reason: null,
                last_error: null,
              } as never,
            });
            result.completed += 1;
            continue;
          }

          if (TERMINAL_FAILED_RENDER_STATUSES.has(prediction.status)) {
            await entityService.update<VideoAssetRecord>(VIDEO_ASSET_UID, asset.id, {
              data: {
                status: 'failed',
                last_error: `render_${prediction.status}`,
              },
            });
            result.failed += 1;
            continue;
          }

          // starting / processing / transient — leave as 'rendering'.
          result.pending += 1;
        } catch (error) {
          // Per-item best-effort: never let one asset abort the sweep. Leave it
          // 'rendering' so it is retried on the next tick.
          result.pending += 1;
          strapi.log.warn(
            `[aico] video render poll failed for asset #${asset.id} (job ${jobId}): ${
              (error as { message?: string })?.message ?? String(error)
            }`
          );
        }
      }

      if (result.checked > 0) {
        await recordSystemAuditEvent(strapi, {
          action: 'video.renders.poll',
          outcome: result.failed > 0 ? 'skipped' : 'success',
          severity: result.failed > 0 ? 'warn' : 'info',
          resourceUid: VIDEO_ASSET_UID,
          metadata: {
            checked: result.checked,
            completed: result.completed,
            failed: result.failed,
            pending: result.pending,
          },
        });
      }

      return result;
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

      if (!PUBLISHABLE_VIDEO_STATUSES.has(String(video.status))) {
        return { created: 0, skipped: 0, blocked: 'video_not_ready', platforms: [], tickets: [] };
      }

      const serverUrl = String(
        (strapi.config as { get?: (key: string) => unknown } | undefined)?.get?.('server.url') ??
          process.env.SERVER_URL ??
          ''
      ).trim();
      const mediaUrl = toAbsoluteMediaUrl(resolveVideoMediaUrl(video), serverUrl);
      if (!mediaUrl || !isPublicHttpUrl(mediaUrl)) {
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
      // Business-timezone day so the idempotency window matches the social daily cap.
      const day = formatDateInZone(scheduledAt, DEFAULT_TIMEZONE);
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
        const isDraft = DRAFT_ONLY_VIDEO_PLATFORMS.has(platform);

        const row = (await entityService.create(SOCIAL_POST_TICKET_UID, {
          data: {
            platform,
            content_format: 'video',
            status: isDraft ? 'pending' : 'scheduled',
            caption,
            media_url: mediaUrl,
            scheduled_at: scheduledAt,
            attempt_count: 0,
            idempotency_key: idempotencyKey,
            blocked_reason: isDraft ? 'draft_only' : null,
            video_asset: video.id,
            workflow: workflowId,
            provider_payload: {
              source: 'video-agent',
              subjectKind: video.metadata?.subjectKind ?? null,
            },
          },
        })) as { id: number };

        created += 1;
        tickets.push({ platform, id: row.id, status: isDraft ? 'pending' : 'scheduled' });
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
