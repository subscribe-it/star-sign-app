import { describe, it, expect } from 'vitest';

import videoAgent from '../services/video-agent';
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
