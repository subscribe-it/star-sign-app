import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DAILY_TAROT_SEED_ASSETS,
  ensureSeedMedia,
  type SeedMediaAsset,
} from './seed-media';

const createTempUploadsDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'star-sign-seed-media-'));
  return dir;
};

const writeSeedFile = (dir: string, fileName: string): void => {
  fs.writeFileSync(path.join(dir, fileName), 'webp');
};

const createStrapiMock = (options: {
  existingUploadFiles?: Array<Record<string, unknown>>;
  tarotCardImage?: unknown;
  existingMediaAsset?: Record<string, unknown> | null;
  uploadedFile?: Record<string, unknown>;
}) => {
  const upload = vi.fn(async () => [
    options.uploadedFile ?? {
      id: 55,
      name: 'daily_blazen.webp',
      provider: 'aws-s3',
      url: 'https://cdn.example/production/daily_blazen.webp',
    },
  ]);
  const tarotUpdate = vi.fn(async () => ({ id: 10 }));
  const mediaAssetCreate = vi.fn(async ({ data }) => ({ id: 100, ...data }));
  const mediaAssetUpdate = vi.fn(async ({ where, data }) => ({
    id: where.id,
    ...data,
  }));
  const mediaAssetFindOne = vi.fn(async () => options.existingMediaAsset ?? null);
  const uploadFileFindMany = vi.fn(
    async () => options.existingUploadFiles ?? [],
  );
  const tarotFindOne = vi.fn(async () => ({
    id: 10,
    slug: 'glupiec',
    image: options.tarotCardImage ?? null,
  }));

  const strapi = {
    plugin: vi.fn(() => ({
      service: vi.fn(() => ({ upload })),
    })),
    db: {
      query: vi.fn((uid: string) => {
        if (uid === 'plugin::upload.file') {
          return {
            findMany: uploadFileFindMany,
          };
        }

        if (uid === 'api::tarot-card.tarot-card') {
          return {
            findOne: tarotFindOne,
            update: tarotUpdate,
          };
        }

        if (uid === 'plugin::ai-content-orchestrator.media-asset') {
          return {
            findOne: mediaAssetFindOne,
            create: mediaAssetCreate,
            update: mediaAssetUpdate,
          };
        }

        throw new Error(`Unexpected query uid: ${uid}`);
      }),
    },
    log: {
      info: vi.fn(),
      warn: vi.fn(),
    },
  };

  return {
    mediaAssetCreate,
    mediaAssetFindOne,
    mediaAssetUpdate,
    strapi,
    tarotUpdate,
    uploadFileFindMany,
    upload,
  };
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('seed media bootstrap', () => {
  it('defines one local daily tarot asset for every major arcana card', () => {
    const slugs = DAILY_TAROT_SEED_ASSETS.map((asset) => asset.cardSlug);

    expect(DAILY_TAROT_SEED_ASSETS).toHaveLength(22);
    expect(slugs).toContain('glupiec');
    expect(slugs).toContain('kolo-fortuny');
    expect(slugs).toContain('sad-ostateczny');
    expect(DAILY_TAROT_SEED_ASSETS).toContainEqual({
      cardSlug: 'glupiec',
      fileName: 'daily_blazen.webp',
      label: 'Głupiec',
      assetKey: 'daily-card-glupiec',
    });
  });

  it('uploads a missing local file, links the tarot card and creates AICO media asset', async () => {
    vi.stubEnv('R2_UPLOAD_ENABLED', 'true');
    const uploadsDir = createTempUploadsDir();
    const asset: SeedMediaAsset = {
      cardSlug: 'glupiec',
      fileName: 'daily_blazen.webp',
      label: 'Głupiec',
      assetKey: 'daily-card-glupiec',
    };
    writeSeedFile(uploadsDir, asset.fileName);
    const mocks = createStrapiMock({});

    const result = await ensureSeedMedia(mocks.strapi as never, {
      uploadsDir,
      assets: [asset],
    });

    expect(result).toEqual({
      uploaded: 1,
      linked: 1,
      mediaAssets: 1,
      missingFiles: [],
    });
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        files: expect.objectContaining({
          originalFilename: 'daily_blazen.webp',
          type: 'image/webp',
        }),
      }),
    );
    expect(mocks.tarotUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { image: 55 },
    });
    expect(mocks.mediaAssetCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        asset: 55,
        asset_key: 'daily-card-glupiec',
        purpose: 'daily_card',
      }),
    });
  });

  it('reuses an existing R2 upload file and does not overwrite an existing R2 card image', async () => {
    vi.stubEnv('R2_UPLOAD_ENABLED', 'true');
    const asset: SeedMediaAsset = {
      cardSlug: 'glupiec',
      fileName: 'daily_blazen.webp',
      label: 'Głupiec',
      assetKey: 'daily-card-glupiec',
    };
    const mocks = createStrapiMock({
      existingUploadFiles: [
        {
          id: 55,
          name: 'daily_blazen.webp',
          provider: 'aws-s3',
        },
      ],
      tarotCardImage: {
        id: 55,
        provider: 'aws-s3',
      },
      existingMediaAsset: {
        id: 100,
        asset: { id: 55 },
      },
    });

    const result = await ensureSeedMedia(mocks.strapi as never, {
      uploadsDir: '/does-not-need-to-exist',
      assets: [asset],
    });

    expect(result).toEqual({
      uploaded: 0,
      linked: 0,
      mediaAssets: 0,
      missingFiles: [],
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.tarotUpdate).not.toHaveBeenCalled();
    expect(mocks.mediaAssetUpdate).not.toHaveBeenCalled();
  });
});
