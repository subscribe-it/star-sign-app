import { GENERATION_JOB_UID, VIDEO_ASSET_UID } from '../constants';
import type { GenerationJobRecord, Strapi, VideoAssetRecord } from '../types';
import { getEntityService } from '../utils/entity-service';
import { getPluginService } from '../utils/plugin';

type CreateVideoJobInput = {
  title: string;
  script?: string;
  workflowId?: number;
  generationJobId?: number;
  idempotencyKey?: string;
  durationSeconds?: number;
  dryRun?: boolean;
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
      const plan = {
        title: input.title,
        aspectRatio: '9:16',
        resolution: '1080x1920',
        durationSeconds,
        channels: ['tiktok', 'youtube_shorts', 'instagram'],
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
          script: input.script ?? '',
          aspect_ratio: '9:16',
          duration_seconds: durationSeconds,
          platform_variants: {
            tiktok: { privacy: 'provider_preflight_required' },
            youtube_shorts: { privacy: 'unlisted_until_preflight' },
            instagram: { format: 'reels' },
          },
          workflow: input.workflowId,
          generation_job: generationJobId,
          metadata: {
            createdBy: 'video-agent',
            idempotencyKey: input.idempotencyKey,
            liveProviderCalls: false,
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
  };
};

export default videoAgent;
