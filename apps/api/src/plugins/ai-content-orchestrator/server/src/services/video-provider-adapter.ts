import type { ProviderKey, Strapi, VideoAssetRecord } from '../types';
import { getPluginService } from '../utils/plugin';

type VideoProviderMode = 'disabled' | 'sandbox' | 'replicate' | 'live';

type VideoProviderResult = {
  ok: boolean;
  mode: VideoProviderMode;
  status: VideoAssetRecord['status'];
  reason: string;
  provider?: string;
  providerJobId?: string;
  providerPayload?: Record<string, unknown>;
};

type ProviderStatusService = {
  upsert: (input: {
    provider: ProviderKey;
    status: 'ready' | 'missing_credentials' | 'blocked' | 'failed';
    hasCredentials?: boolean;
    scopes?: string[];
    blockedReason?: string;
    lastError?: string;
  }) => Promise<unknown>;
};

type ReplicatePredictionResponse = {
  id?: string;
  status?: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | string;
  created_at?: string;
  urls?: {
    get?: string;
    cancel?: string;
    web?: string;
  };
  output?: unknown;
};

const normalizeMode = (value: unknown): VideoProviderMode => {
  const mode = String(value ?? '').trim().toLowerCase();
  return mode === 'sandbox' || mode === 'replicate' || mode === 'live' ? mode : 'disabled';
};

const getReplicateToken = (): string | null =>
  process.env.AICO_VIDEO_GEN_TOKEN?.trim() || process.env.REPLICATE_API_TOKEN?.trim() || null;

const getReplicateModel = (): string | null =>
  process.env.AICO_VIDEO_GEN_MODEL?.trim() || process.env.AICO_VIDEO_GEN_VERSION?.trim() || null;

const parseInputOverrides = (): Record<string, unknown> => {
  const raw = process.env.AICO_VIDEO_GEN_INPUT_JSON?.trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const allowed: Record<string, unknown> = {};
    if (typeof parsed.negative_prompt === 'string') {
      allowed.negative_prompt = parsed.negative_prompt.slice(0, 1000);
    }
    if (typeof parsed.fps === 'number' && [12, 16, 24, 30].includes(parsed.fps)) {
      allowed.fps = parsed.fps;
    }
    if (typeof parsed.guidance_scale === 'number' && parsed.guidance_scale >= 0 && parsed.guidance_scale <= 20) {
      allowed.guidance_scale = parsed.guidance_scale;
    }
    if (typeof parsed.seed === 'number' && Number.isInteger(parsed.seed) && parsed.seed >= 0) {
      allowed.seed = parsed.seed;
    }

    return allowed;
  } catch {
    return {};
  }
};

const buildPrompt = (video: VideoAssetRecord): string => {
  const script = video.script?.trim();
  if (script) return script;

  return `Create a vertical 9:16 short astrology video for: ${video.title}`;
};

const toProviderStatus = (
  status: ReplicatePredictionResponse['status']
): VideoAssetRecord['status'] => {
  if (status === 'failed' || status === 'canceled') return 'failed';
  return 'rendering';
};

const isTruthy = (value: unknown): boolean =>
  ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());

const upsertReplicateStatus = async (
  strapi: Strapi,
  input: {
    status: 'ready' | 'missing_credentials' | 'blocked' | 'failed';
    blockedReason?: string;
    lastError?: string;
    hasCredentials?: boolean;
  }
): Promise<void> => {
  try {
    await getPluginService<ProviderStatusService>(strapi, 'provider-status').upsert({
      provider: 'replicate',
      status: input.status,
      hasCredentials: input.hasCredentials ?? input.status !== 'missing_credentials',
      scopes: input.status === 'missing_credentials' ? [] : ['predictions.write'],
      blockedReason: input.blockedReason,
      lastError: input.lastError,
    });
  } catch {
    strapi.log.debug('AICO Replicate video provider-status upsert skipped.');
  }
};

const videoProviderAdapter = ({ strapi }: { strapi: Strapi }) => ({
  getMode(): VideoProviderMode {
    return normalizeMode(process.env.AICO_VIDEO_PROVIDER_MODE);
  },

  async render(video: VideoAssetRecord): Promise<VideoProviderResult> {
    const mode = this.getMode();

    if (mode === 'disabled') {
      return {
        ok: false,
        mode,
        status: 'failed',
        reason: 'provider_adapter_not_enabled',
      };
    }

    if (mode === 'live') {
      return {
        ok: false,
        mode,
        status: 'failed',
        reason: 'provider_adapter_live_not_implemented',
        providerPayload: {
          liveProviderCallsEnabled: false,
          message: 'Live video rendering requires a dedicated adapter and controlled smoke.',
        },
      };
    }

    if (mode === 'replicate') {
      if (!isTruthy(process.env.AICO_CONTROLLED_LIVE_ENABLED)) {
        return {
          ok: false,
          mode,
          status: 'failed',
          reason: 'controlled_live_not_enabled',
        };
      }

      const token = getReplicateToken();
      if (!token) {
        await upsertReplicateStatus(strapi, {
          status: 'missing_credentials',
          hasCredentials: false,
          blockedReason: 'replicate_video_missing_token',
          lastError: 'replicate_video_missing_token',
        });
        return {
          ok: false,
          mode,
          status: 'failed',
          reason: 'replicate_video_missing_token',
        };
      }

      const model = getReplicateModel();
      if (!model) {
        await upsertReplicateStatus(strapi, {
          status: 'blocked',
          blockedReason: 'replicate_video_missing_model',
          lastError: 'replicate_video_missing_model',
        });
        return {
          ok: false,
          mode,
          status: 'failed',
          reason: 'replicate_video_missing_model',
        };
      }

      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Cancel-After': process.env.AICO_VIDEO_GEN_CANCEL_AFTER?.trim() || '15m',
        },
        body: JSON.stringify({
          version: model,
          input: {
            prompt: buildPrompt(video),
            aspect_ratio: video.aspect_ratio ?? '9:16',
            duration: Number(video.duration_seconds ?? 30),
            duration_seconds: Number(video.duration_seconds ?? 30),
            ...parseInputOverrides(),
          },
        }),
      });

      if (!response.ok) {
        const reason = `replicate_video_prediction_http_${response.status}`;
        await upsertReplicateStatus(strapi, {
          status: response.status === 401 || response.status === 403 ? 'failed' : 'blocked',
          blockedReason: reason,
          lastError: reason,
        });
        return {
          ok: false,
          mode,
          status: 'failed',
          reason,
        };
      }

      const prediction = (await response.json()) as ReplicatePredictionResponse;
      const predictionStatus = prediction.status ?? 'starting';
      const providerStatus = toProviderStatus(predictionStatus);
      const ok = providerStatus !== 'failed' && Boolean(prediction.id);
      await upsertReplicateStatus(strapi, {
        status: ok ? 'ready' : 'failed',
        blockedReason: ok ? undefined : 'replicate_video_prediction_failed',
        lastError: ok ? undefined : 'replicate_video_prediction_failed',
      });

      return {
        ok,
        mode,
        status: providerStatus,
        reason: ok ? 'replicate_video_prediction_created' : 'replicate_video_prediction_failed',
        provider: 'replicate',
        providerJobId: prediction.id,
        providerPayload: {
          providerCallsEnabled: true,
          liveRenderEnabled: true,
          liveSocialPublishEnabled: false,
          controlledExternalRender: true,
          asyncJobOnly: true,
        },
      };
    }

    return {
      ok: true,
      mode,
      status: 'qc_passed',
      reason: 'sandbox_video_rendered',
      provider: 'sandbox-video-provider',
      providerJobId: `sandbox_video_${video.id}`,
      providerPayload: {
        sandbox: true,
        liveRenderEnabled: false,
        aspectRatio: video.aspect_ratio ?? '9:16',
        durationSeconds: video.duration_seconds ?? 30,
      },
    };
  },
});

export default videoProviderAdapter;
