import fs from 'node:fs';

import { afterEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  axiosGet: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    get: mocks.axiosGet,
  },
}));

import videoAgent from '../services/video-agent';
import { VIDEO_ASSET_UID } from '../constants';
import type { Strapi } from '../types';
import { buildAstrologyVideoScript } from '../utils/astrology-video';

describe('astrology video script builder', () => {
  it('builds a zodiac script with Polish sign + hashtags + 3-scene storyboard', () => {
    const script = buildAstrologyVideoScript({ kind: 'zodiac', sign: 'leo' });
    expect(script.title).toContain('Lew');
    expect(script.hashtags).toContain('lew');
    expect(script.hashtags).toContain('horoskop');
    expect(script.storyboard).toHaveLength(3);
    expect(Object.keys(script.captionByPlatform)).toEqual([
      'facebook',
      'instagram',
      'tiktok',
      'youtube_shorts',
    ]);
    // storyboard scene durations sum to the clamped total duration
    const total = script.storyboard.reduce((sum, s) => sum + s.durationSeconds, 0);
    expect(total).toBe(script.durationSeconds);
  });

  it('clamps duration to 20-45s and supports tarot + horoscope subjects', () => {
    expect(buildAstrologyVideoScript({ kind: 'zodiac', sign: 'leo' }, { durationSeconds: 5 }).durationSeconds).toBe(20);
    expect(buildAstrologyVideoScript({ kind: 'zodiac', sign: 'leo' }, { durationSeconds: 99 }).durationSeconds).toBe(45);
    expect(buildAstrologyVideoScript({ kind: 'tarot', card: 'Wieża' }).title).toContain('Wieża');
    expect(buildAstrologyVideoScript({ kind: 'horoscope', period: 'Tygodniowy', sign: 'rak' }).title).toContain('Rak');
  });
});

type Row = Record<string, unknown>;

const makeStrapi = (overrides: { video?: Row; policy?: unknown; serverUrl?: string }) => {
  const store: { tickets: Row[] } = { tickets: [] };
  let id = 100;
  const entityService = {
    async findOne() {
      return overrides.video ?? null;
    },
    async findMany(_uid: string, params: { filters?: Record<string, unknown> } = {}) {
      const key = params.filters?.idempotency_key;
      if (key) return store.tickets.filter((t) => t.idempotency_key === key);
      return [];
    },
    async create(_uid: string, params: { data: Row }) {
      const row = { id: id++, ...params.data };
      store.tickets.push(row);
      return row;
    },
  };
  const services: Record<string, unknown> = {
    'autonomy-policy':
      overrides.policy ?? {
        getPolicy: async () => ({}),
        evaluate: async () => ({ allowed: true, reason: 'allowed' }),
      },
  };
  const strapi = {
    entityService,
    config: { get: (k: string) => (k === 'server.url' ? overrides.serverUrl ?? 'https://api.star-sign.pl' : '') },
    log: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      debug: () => undefined,
    },
    plugin: () => ({ service: (n: string) => services[n] }),
  } as unknown as Strapi;
  return { strapi, store };
};

describe('video-agent.publish — short-form publish bridge', () => {
  const video = {
    id: 7,
    title: 'Lew',
    status: 'uploaded',
    asset: { url: '/uploads/lew.mp4' },
    metadata: {
      captionByPlatform: { instagram: 'IG', facebook: 'FB', tiktok: 'TT', youtube_shorts: 'YT' },
      subjectKind: 'zodiac',
    },
    workflow: 11,
  };

  it('creates one video ticket per allowed platform with an absolute media URL', async () => {
    const { strapi, store } = makeStrapi({
      video,
      policy: {
        getPolicy: async () => ({ allowed_social_channels: ['facebook', 'instagram', 'tiktok', 'youtube_shorts'] }),
        evaluate: async () => ({ allowed: true, reason: 'allowed' }),
      },
    });
    const res = await videoAgent({ strapi }).publish({ videoAssetId: 7 });

    expect(res.created).toBe(4);
    expect(res.mediaUrl).toBe('https://api.star-sign.pl/uploads/lew.mp4');
    expect(store.tickets.every((t) => t.content_format === 'video')).toBe(true);
    expect(store.tickets.find((t) => t.platform === 'tiktok')?.status).toBe('pending'); // TikTok draft-only
  });

  it('is idempotent per (video, platform, day)', async () => {
    const { strapi } = makeStrapi({
      video,
      policy: {
        getPolicy: async () => ({ allowed_social_channels: ['facebook'] }),
        evaluate: async () => ({ allowed: true, reason: 'allowed' }),
      },
    });
    const agent = videoAgent({ strapi });
    const first = await agent.publish({ videoAssetId: 7, platforms: ['facebook'] });
    const second = await agent.publish({ videoAssetId: 7, platforms: ['facebook'] });
    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(1);
  });

  it('blocks publishing when the asset has no public media URL', async () => {
    const { strapi } = makeStrapi({ video: { id: 8, title: 'x', status: 'uploaded', asset: null, metadata: {} } });
    const res = await videoAgent({ strapi }).publish({ videoAssetId: 8 });
    expect(res.blocked).toBe('media_url_not_public');
    expect(res.created).toBe(0);
  });

  it('blocks publishing a video that is not in a ready status', async () => {
    const { strapi } = makeStrapi({ video: { id: 9, title: 'x', status: 'queued', asset: { url: '/uploads/x.mp4' }, metadata: {} } });
    const res = await videoAgent({ strapi }).publish({ videoAssetId: 9 });
    expect(res.blocked).toBe('video_not_ready');
  });

  it('rejects a non-public (localhost) media URL', async () => {
    const { strapi } = makeStrapi({
      video: { id: 10, title: 'x', status: 'uploaded', asset: { url: '/uploads/x.mp4' }, metadata: {} },
      serverUrl: 'http://localhost:1337',
    });
    const res = await videoAgent({ strapi }).publish({ videoAssetId: 10 });
    expect(res.blocked).toBe('media_url_not_public');
  });
});

type Update = { uid: string; id: number; data: Row };

const makePollStrapi = (input: {
  rendering: Row[];
  getPrediction: (jobId: string) => Promise<{ status: string; videoUrl: string | null }>;
  uploadFileId?: number;
}) => {
  const updates: Update[] = [];
  let uploadFilepath = '';
  const upload = vi.fn(async (params: { files: { filepath: string } }) => {
    uploadFilepath = params.files.filepath;
    return [{ id: input.uploadFileId ?? 77 }];
  });
  const entityService = {
    async findMany(uid: string) {
      if (uid === VIDEO_ASSET_UID) return input.rendering;
      return [];
    },
    async update(uid: string, id: number, params: { data: Row }) {
      const row = { id, ...params.data };
      updates.push({ uid, id, data: params.data });
      return row;
    },
  };
  const services: Record<string, unknown> = {
    'video-provider-adapter': { getPrediction: input.getPrediction },
  };
  const strapi = {
    entityService,
    config: { get: () => '' },
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    plugin: (name: string) => ({
      service: (n: string) => {
        if (name === 'upload' && n === 'upload') return { upload };
        return services[n];
      },
    }),
  } as unknown as Strapi;
  return { strapi, updates, upload, getUploadFilepath: () => uploadFilepath };
};

describe('video-agent.pollRenders — render completion sweep', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('downloads + attaches the asset and flips status to uploaded on success', async () => {
    vi.stubEnv('AICO_VIDEO_PROVIDER_MODE', 'replicate');
    mocks.axiosGet.mockResolvedValue({ data: Buffer.from('mp4-bytes') });

    const { strapi, updates, upload, getUploadFilepath } = makePollStrapi({
      rendering: [{ id: 7, title: 'Lew', status: 'rendering', provider_job_id: 'job_abc' }],
      getPrediction: async () => ({
        status: 'succeeded',
        videoUrl: 'https://cdn.example/render.mp4',
      }),
      uploadFileId: 99,
    });

    const res = await videoAgent({ strapi }).pollRenders();

    expect(res).toEqual({ checked: 1, completed: 1, failed: 0, pending: 0 });
    expect(mocks.axiosGet).toHaveBeenCalledWith('https://cdn.example/render.mp4', expect.any(Object));
    expect(upload).toHaveBeenCalledTimes(1);
    const update = updates.find((u) => u.uid === VIDEO_ASSET_UID && u.id === 7);
    expect(update?.data.status).toBe('uploaded');
    expect(update?.data.asset).toBe(99);
    expect(update?.data.blocked_reason).toBeNull();
    // temp file is cleaned up in finally
    expect(getUploadFilepath()).not.toBe('');
    expect(fs.existsSync(getUploadFilepath())).toBe(false);
  });

  it('marks the asset failed when the provider render failed', async () => {
    vi.stubEnv('AICO_VIDEO_PROVIDER_MODE', 'replicate');

    const { strapi, updates, upload } = makePollStrapi({
      rendering: [{ id: 8, title: 'Rak', status: 'rendering', provider_job_id: 'job_xyz' }],
      getPrediction: async () => ({ status: 'failed', videoUrl: null }),
    });

    const res = await videoAgent({ strapi }).pollRenders();

    expect(res).toEqual({ checked: 1, completed: 0, failed: 1, pending: 0 });
    expect(upload).not.toHaveBeenCalled();
    expect(mocks.axiosGet).not.toHaveBeenCalled();
    const update = updates.find((u) => u.uid === VIDEO_ASSET_UID && u.id === 8);
    expect(update?.data.status).toBe('failed');
    expect(update?.data.last_error).toBe('render_failed');
  });

  it('leaves the asset rendering while the provider is still processing', async () => {
    vi.stubEnv('AICO_VIDEO_PROVIDER_MODE', 'replicate');

    const { strapi, updates } = makePollStrapi({
      rendering: [{ id: 9, title: 'Byk', status: 'rendering', provider_job_id: 'job_proc' }],
      getPrediction: async () => ({ status: 'processing', videoUrl: null }),
    });

    const res = await videoAgent({ strapi }).pollRenders();

    expect(res).toEqual({ checked: 1, completed: 0, failed: 0, pending: 1 });
    expect(updates).toHaveLength(0);
  });

  it('no-ops when the provider mode is not replicate', async () => {
    vi.stubEnv('AICO_VIDEO_PROVIDER_MODE', 'sandbox');

    const { strapi, updates } = makePollStrapi({
      rendering: [{ id: 10, title: 'Waga', status: 'rendering', provider_job_id: 'job_off' }],
      getPrediction: async () => ({ status: 'succeeded', videoUrl: 'https://cdn.example/x.mp4' }),
    });

    const res = await videoAgent({ strapi }).pollRenders();

    expect(res).toEqual({ checked: 0, completed: 0, failed: 0, pending: 0 });
    expect(updates).toHaveLength(0);
  });
});
