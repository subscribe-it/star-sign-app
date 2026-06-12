import fs from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  axiosGet: vi.fn(),
  replicateCtor: vi.fn(),
  replicateRun: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    get: mocks.axiosGet,
  },
}));

vi.mock('replicate', () => ({
  default: vi.fn().mockImplementation(function replicateMock(input) {
    mocks.replicateCtor(input);
    return {
      run: mocks.replicateRun,
    };
  }),
}));

import mediaGenerator, {
  resolveImageGenToken,
  resolveMediaPublicDir,
} from '../services/media-generator';
import { MEDIA_ASSET_UID } from '../constants';

describe('media-generator', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('stores temporary uploads under the API public directory independently from current working directory', async () => {
    const originalCwd = process.cwd();
    const runtimeDirectory = mkdtempSync(join(tmpdir(), 'aico-media-cwd-'));
    const publicDir = resolveMediaPublicDir();
    let uploadFilepath = '';

    mocks.replicateRun.mockResolvedValue('https://cdn.example/image.webp');
    mocks.axiosGet.mockResolvedValue({ data: Buffer.from('webp-image') });

    const upload = vi.fn(async (input) => {
      uploadFilepath = input.files.filepath;
      expect(fs.existsSync(uploadFilepath)).toBe(true);
      return [{ id: 44 }];
    });
    const create = vi.fn(async () => ({ id: 55 }));
    const policyEvaluate = vi.fn(async () => ({ allowed: true, reason: 'allowed' }));
    const checkProviders = vi.fn(async () => ({ ready: true, blockedProviders: [] }));
    const strapi = {
      log: {
        info: vi.fn(),
      },
      plugin: vi.fn((name: string) => ({
        service: vi.fn((serviceName: string) => {
          if (name === 'upload' && serviceName === 'upload') {
            return { upload };
          }
          if (name === 'ai-content-orchestrator' && serviceName === 'autonomy-policy') {
            return { evaluate: policyEvaluate };
          }
          if (name === 'ai-content-orchestrator' && serviceName === 'provider-status') {
            return { checkProviders };
          }
          throw new Error(`Unexpected service: ${name}.${serviceName}`);
        }),
      })),
      entityService: {
        create,
      },
    };

    try {
      process.chdir(runtimeDirectory);

      const result = await mediaGenerator({ strapi: strapi as never }).generateAndUpload({
        prompt: 'Mystic illustration',
        label: 'Hero image',
        purpose: 'article_cover',
        signSlug: 'baran',
        apiToken: 'replicate-token',
        model: 'custom/model',
      });

      expect(result).toEqual({ mediaAssetId: 55, uploadFileId: 44 });
      expect(policyEvaluate).toHaveBeenCalledWith({
        action: 'media.generate',
        requiresBrandSafety: true,
      });
      expect(checkProviders).toHaveBeenCalledWith({
        action: 'media.generate',
        providers: ['replicate'],
      });
      expect(mocks.replicateCtor).toHaveBeenCalledWith({ auth: 'replicate-token' });
      expect(mocks.replicateRun).toHaveBeenCalledWith('custom/model', {
        input: expect.objectContaining({
          prompt: 'Mystic illustration',
          output_format: 'webp',
        }),
      });
      expect(uploadFilepath).toMatch(/apps\/api\/public\/uploads\/tmp\/auto_\d+\.webp$/);
      expect(uploadFilepath.startsWith(path.join(publicDir, 'uploads', 'tmp'))).toBe(true);
      expect(fs.existsSync(uploadFilepath)).toBe(false);
      expect(create).toHaveBeenCalledWith(MEDIA_ASSET_UID, {
        data: expect.objectContaining({
          asset_key: expect.stringMatching(/^auto_baran_\d+$/),
          label: 'Hero image',
          purpose: 'article_cover',
          sign_slug: 'baran',
          asset: 44,
        }),
      });
    } finally {
      process.chdir(originalCwd);
      rmSync(runtimeDirectory, { recursive: true, force: true });
      if (uploadFilepath) {
        rmSync(uploadFilepath, { force: true });
      }
    }
  });

  it('blocks provider calls when media generation policy denies the action', async () => {
    const policyEvaluate = vi.fn(async () => ({ allowed: false, reason: 'media_daily_cap_reached' }));
    const checkProviders = vi.fn();
    const strapi = {
      log: { info: vi.fn() },
      plugin: vi.fn((name: string) => ({
        service: vi.fn((serviceName: string) => {
          if (name === 'ai-content-orchestrator' && serviceName === 'autonomy-policy') {
            return { evaluate: policyEvaluate };
          }
          if (name === 'ai-content-orchestrator' && serviceName === 'provider-status') {
            return { checkProviders };
          }
          throw new Error(`Unexpected service: ${name}.${serviceName}`);
        }),
      })),
      entityService: {
        create: vi.fn(),
      },
    };

    await expect(
      mediaGenerator({ strapi: strapi as never }).generateAndUpload({
        prompt: 'Blocked',
        label: 'Blocked',
        purpose: 'article_cover',
        apiToken: 'replicate-token',
      })
    ).rejects.toThrow('media_daily_cap_reached');

    expect(checkProviders).not.toHaveBeenCalled();
    expect(mocks.replicateCtor).not.toHaveBeenCalled();
    expect(mocks.axiosGet).not.toHaveBeenCalled();
  });

  it('blocks provider calls when Replicate readiness is not ready', async () => {
    const policyEvaluate = vi.fn(async () => ({ allowed: true, reason: 'allowed' }));
    const checkProviders = vi.fn(async () => ({
      ready: false,
      blockedProviders: [
        {
          provider: 'replicate',
          status: 'missing_credentials',
          blockedReason: 'missing_credentials',
        },
      ],
    }));
    const strapi = {
      log: { info: vi.fn() },
      plugin: vi.fn((name: string) => ({
        service: vi.fn((serviceName: string) => {
          if (name === 'ai-content-orchestrator' && serviceName === 'autonomy-policy') {
            return { evaluate: policyEvaluate };
          }
          if (name === 'ai-content-orchestrator' && serviceName === 'provider-status') {
            return { checkProviders };
          }
          throw new Error(`Unexpected service: ${name}.${serviceName}`);
        }),
      })),
      entityService: {
        create: vi.fn(),
      },
    };

    await expect(
      mediaGenerator({ strapi: strapi as never }).generateAndUpload({
        prompt: 'Blocked',
        label: 'Blocked',
        purpose: 'article_cover',
        apiToken: 'replicate-token',
      })
    ).rejects.toThrow('replicate:missing_credentials');

    expect(mocks.replicateCtor).not.toHaveBeenCalled();
    expect(mocks.axiosGet).not.toHaveBeenCalled();
  });

  it('uses AICO image generation env token before Replicate env fallback', () => {
    vi.stubEnv('AICO_IMAGE_GEN_TOKEN', 'image-token');
    vi.stubEnv('REPLICATE_API_TOKEN', 'replicate-token');

    expect(resolveImageGenToken()).toBe('image-token');
    expect(resolveImageGenToken('input-token')).toBe('input-token');
  });
});
