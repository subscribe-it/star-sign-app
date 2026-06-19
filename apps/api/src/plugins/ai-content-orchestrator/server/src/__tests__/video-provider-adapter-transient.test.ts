import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLUGIN_ID } from '../constants';
import videoProviderAdapter from '../services/video-provider-adapter';
import type { Strapi } from '../types';

// Minimalny `strapi` z mapą serwisów pluginu (jak w runtime.test.ts /
// video.test.ts) — getPrediction nie dotyka entityService, więc wystarczy log
// + plugin().service() na potrzeby ewentualnego provider-status upsertu.
const createStrapi = (services: Record<string, unknown> = {}): Strapi =>
  ({
    entityService: {},
    plugin: (id: string) => {
      if (id !== PLUGIN_ID) {
        throw new Error(`Unexpected plugin ${id}`);
      }
      return {
        service: (name: string) => services[name],
      };
    },
    log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  }) as unknown as Strapi;

// Czyści wszystkie zmienne środowiskowe, z których getReplicateToken /
// getReplicateModel czytają konfigurację Replicate.
const clearReplicateEnv = () => {
  vi.stubEnv('AICO_VIDEO_GEN_TOKEN', '');
  vi.stubEnv('REPLICATE_API_TOKEN', '');
  vi.stubEnv('AICO_VIDEO_GEN_MODEL', '');
  vi.stubEnv('AICO_VIDEO_GEN_VERSION', '');
};

const setReplicateEnv = () => {
  vi.stubEnv('AICO_VIDEO_GEN_TOKEN', 'replicate-test-token');
  vi.stubEnv('AICO_VIDEO_GEN_MODEL', 'owner/model:version');
};

describe('video-provider-adapter.getPrediction — transient vs terminal mapping (fix #5)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // MUST-HAVE: a missing token/model at poll time is a TRANSIENT config gap
  // (e.g. runtime env not yet restored), NOT a terminal failure. Returning
  // 'failed' here would make pollRenders permanently abandon an already-paid
  // in-flight render. We require a clearly NON-terminal status instead.
  it('returns a non-terminal processing status when the Replicate token is missing', async () => {
    clearReplicateEnv();
    // Set the model so ONLY the token is missing — isolates the token branch.
    vi.stubEnv('AICO_VIDEO_GEN_MODEL', 'owner/model:version');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await videoProviderAdapter({ strapi: createStrapi() }).getPrediction('job_paid');

    expect(result).toEqual({ status: 'processing', videoUrl: null });
    expect(result.status).not.toBe('failed');
    // No paid network call may be attempted when credentials are absent.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a non-terminal processing status when the Replicate model is missing', async () => {
    clearReplicateEnv();
    // Set the token so ONLY the model is missing — isolates the model branch.
    vi.stubEnv('AICO_VIDEO_GEN_TOKEN', 'replicate-test-token');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await videoProviderAdapter({ strapi: createStrapi() }).getPrediction('job_paid');

    expect(result).toEqual({ status: 'processing', videoUrl: null });
    expect(result.status).not.toBe('failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a non-terminal processing status when both token and model are missing', async () => {
    clearReplicateEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await videoProviderAdapter({ strapi: createStrapi() }).getPrediction('job_paid');

    expect(result).toEqual({ status: 'processing', videoUrl: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Bonus contrast cases: with valid credentials, an EXPLICIT terminal provider
  // outcome must still map to 'failed', while a transient HTTP hiccup must NOT.
  it('still maps an explicit terminal provider status (404 not found) to failed', async () => {
    setReplicateEnv();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => ({}),
      }))
    );

    const result = await videoProviderAdapter({ strapi: createStrapi() }).getPrediction('job_missing');

    expect(result).toEqual({ status: 'failed', videoUrl: null });
  });

  it('maps a transient 429 rate-limit to a non-terminal processing status', async () => {
    setReplicateEnv();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => ({}),
      }))
    );

    const result = await videoProviderAdapter({ strapi: createStrapi() }).getPrediction('job_throttled');

    expect(result).toEqual({ status: 'processing', videoUrl: null });
    expect(result.status).not.toBe('failed');
  });

  it('maps a transient 5xx provider error to a non-terminal processing status', async () => {
    setReplicateEnv();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({}),
      }))
    );

    const result = await videoProviderAdapter({ strapi: createStrapi() }).getPrediction('job_5xx');

    expect(result).toEqual({ status: 'processing', videoUrl: null });
    expect(result.status).not.toBe('failed');
  });
});
