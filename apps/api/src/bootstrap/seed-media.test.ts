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
  zodiacSigns?: Array<Record<string, unknown>>;
  articles?: Array<Record<string, unknown>>;
  uploadedFile?: Record<string, unknown>;
}) => {
  const storedUploadFiles = [...(options.existingUploadFiles ?? [])];
  const upload = vi.fn(async (input: {
    files: { originalFilename: string; type: string };
  }) => {
    const fileName = input.files.originalFilename;
    const file = options.uploadedFile ?? {
      id: fileName === 'blog_placeholder.webp' ? 90 : 55,
      name: fileName,
      mime: input.files.type,
      provider: 'aws-s3',
      url: `https://cdn.example/production/${fileName}`,
    };
    storedUploadFiles.push(file);
    return [file];
  });
  const tarotUpdate = vi.fn(async () => ({ id: 10 }));
  const uploadFileFindMany = vi.fn(async ({ where } = {}) => {
    const clauses = Array.isArray(where?.$or) ? where.$or : null;

    if (!clauses) {
      return storedUploadFiles;
    }

    return storedUploadFiles.filter((file) =>
      clauses.some((clause: Record<string, unknown>) =>
        Object.entries(clause).some(([key, value]) => file[key] === value),
      ),
    );
  });
  const tarotFindOne = vi.fn(async () => ({
    id: 10,
    slug: 'glupiec',
    image: options.tarotCardImage ?? null,
  }));
  const zodiacFindMany = vi.fn(async () => options.zodiacSigns ?? []);
  const zodiacUpdate = vi.fn(async ({ where, data }) => ({
    id: where.id,
    ...data,
  }));
  const articleFindMany = vi.fn(async () => options.articles ?? []);
  const articleUpdate = vi.fn(async ({ where, data }) => ({
    id: where.id,
    ...data,
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

        if (uid === 'api::zodiac-sign.zodiac-sign') {
          return {
            findMany: zodiacFindMany,
            update: zodiacUpdate,
          };
        }

        if (uid === 'api::article.article') {
          return {
            findMany: articleFindMany,
            update: articleUpdate,
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
    articleFindMany,
    articleUpdate,
    strapi,
    tarotUpdate,
    zodiacFindMany,
    zodiacUpdate,
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
    expect(DAILY_TAROT_SEED_ASSETS[0]).toMatchObject({
      cardSlug: 'glupiec',
      fileName: 'daily_blazen.webp',
      label: 'Głupiec',
      assetKey: 'daily-card-glupiec',
      purpose: 'daily_card',
      periodScope: 'daily',
    });
  });

  it('uploads a missing local file, links the tarot card', async () => {
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
      linkMappedContent: false,
    });

    expect(result).toEqual({
      uploaded: 1,
      linked: 1,
      zodiacLinked: 0,
      articleLinked: 0,
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
    });

    const result = await ensureSeedMedia(mocks.strapi as never, {
      uploadsDir: '/does-not-need-to-exist',
      assets: [asset],
      linkMappedContent: false,
    });

    expect(result).toEqual({
      uploaded: 0,
      linked: 0,
      zodiacLinked: 0,
      articleLinked: 0,
      missingFiles: [],
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.tarotUpdate).not.toHaveBeenCalled();
  });

  it('uploads bundled zodiac profile images and links the sign', async () => {
    vi.stubEnv('R2_UPLOAD_ENABLED', 'true');
    const uploadsDir = createTempUploadsDir();
    writeSeedFile(uploadsDir, 'zodiac-baran-profile.webp');
    const mocks = createStrapiMock({
      zodiacSigns: [{ id: 11, name: 'Baran', slug: 'baran', image: null }],
    });

    const result = await ensureSeedMedia(mocks.strapi as never, {
      uploadsDir,
      assets: [],
    });

    expect(result.uploaded).toBe(1);
    expect(result.zodiacLinked).toBe(1);
    expect(result.missingFiles).not.toContain('zodiac-baran-profile.webp');
    expect(mocks.zodiacUpdate).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { image: 55 },
    });
  });

  it('silently skips optional zodiac profile images when local files are absent', async () => {
    const mocks = createStrapiMock({});

    const result = await ensureSeedMedia(mocks.strapi as never, {
      uploadsDir: '/does-not-need-to-exist',
      assets: [],
    });

    expect(result.uploaded).toBe(0);
    expect(result.zodiacLinked).toBe(0);
    expect(result.missingFiles).not.toContain('zodiac-baran-profile.webp');
  });

  it('uploads a default blog placeholder and links seeded articles without images', async () => {
    vi.stubEnv('R2_UPLOAD_ENABLED', 'true');
    const uploadsDir = createTempUploadsDir();
    writeSeedFile(uploadsDir, 'blog_placeholder.webp');
    const mocks = createStrapiMock({
      articles: [
        {
          id: 21,
          title: 'Mapa nieba na początek dnia',
          slug: 'mapa-nieba-na-poczatek-dnia',
          category: { name: 'Astrologia' },
          image: null,
        },
      ],
    });

    const result = await ensureSeedMedia(mocks.strapi as never, {
      uploadsDir,
      assets: [],
      articleSlugs: ['mapa-nieba-na-poczatek-dnia'],
    });

    expect(result.uploaded).toBe(1);
    expect(result.articleLinked).toBe(1);
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        files: expect.objectContaining({
          originalFilename: 'blog_placeholder.webp',
          type: 'image/webp',
        }),
      }),
    );
    expect(mocks.articleUpdate).toHaveBeenCalledWith({
      where: { id: 21 },
      data: { image: 90 },
    });
  });

  it('does not overwrite an existing real R2 article image with the placeholder', async () => {
    vi.stubEnv('R2_UPLOAD_ENABLED', 'true');
    const mocks = createStrapiMock({
      existingUploadFiles: [
        {
          id: 90,
          name: 'blog_placeholder.webp',
          mime: 'image/webp',
          provider: 'aws-s3',
        },
      ],
      articles: [
        {
          id: 21,
          title: 'Artykuł z realnym obrazem',
          slug: 'artykul-z-realnym-obrazem',
          category: { name: 'Astrologia' },
          image: {
            id: 99,
            provider: 'aws-s3',
          },
        },
      ],
    });

    const result = await ensureSeedMedia(mocks.strapi as never, {
      uploadsDir: '/does-not-need-to-exist',
      assets: [],
      articleSlugs: ['artykul-z-realnym-obrazem'],
    });

    expect(result.articleLinked).toBe(0);
    expect(mocks.articleUpdate).not.toHaveBeenCalled();
  });
});
