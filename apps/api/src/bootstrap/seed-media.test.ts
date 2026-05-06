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
  mappedMediaAssets?: Array<Record<string, unknown>>;
  zodiacSigns?: Array<Record<string, unknown>>;
  articles?: Array<Record<string, unknown>>;
  uploadedFile?: Record<string, unknown>;
}) => {
  const storedUploadFiles = [...(options.existingUploadFiles ?? [])];
  const resolveUploadFile = (id: unknown): Record<string, unknown> | null => {
    if (typeof id !== 'number') {
      return null;
    }

    return (
      storedUploadFiles.find((file) => file.id === id) ?? {
        id,
      }
    );
  };
  const storedMediaAssets = [...(options.mappedMediaAssets ?? [])];
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
  const mediaAssetCreate = vi.fn(async ({ data }) => {
    const created = {
      id: 100 + storedMediaAssets.length,
      ...data,
      asset: resolveUploadFile(data.asset),
    };
    storedMediaAssets.push(created);
    return created;
  });
  const mediaAssetUpdate = vi.fn(async ({ where, data }) => {
    const index = storedMediaAssets.findIndex((asset) => asset.id === where.id);
    const updated = {
      ...(index >= 0 ? storedMediaAssets[index] : {}),
      id: where.id,
      ...data,
      asset: resolveUploadFile(data.asset),
    };

    if (index >= 0) {
      storedMediaAssets[index] = updated;
    }

    return updated;
  });
  const mediaAssetFindOne = vi.fn(async ({ where } = {}) => {
    const byAssetKey =
      typeof where?.asset_key === 'string'
        ? storedMediaAssets.find((asset) => asset.asset_key === where.asset_key)
        : null;

    return byAssetKey ?? options.existingMediaAsset ?? null;
  });
  const mediaAssetFindMany = vi.fn(async () => storedMediaAssets);
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

        if (uid === 'plugin::ai-content-orchestrator.media-asset') {
          return {
            findOne: mediaAssetFindOne,
            findMany: mediaAssetFindMany,
            create: mediaAssetCreate,
            update: mediaAssetUpdate,
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
    mediaAssetCreate,
    mediaAssetFindMany,
    mediaAssetFindOne,
    mediaAssetUpdate,
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
      linkMappedContent: false,
    });

    expect(result).toEqual({
      uploaded: 1,
      linked: 1,
      mediaAssets: 1,
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
      linkMappedContent: false,
    });

    expect(result).toEqual({
      uploaded: 0,
      linked: 0,
      mediaAssets: 0,
      zodiacLinked: 0,
      articleLinked: 0,
      missingFiles: [],
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.tarotUpdate).not.toHaveBeenCalled();
    expect(mocks.mediaAssetUpdate).not.toHaveBeenCalled();
  });

  it('links seeded zodiac signs from already mapped AICO zodiac assets', async () => {
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
          provider: 'local',
        },
      ],
      mappedMediaAssets: [
        {
          id: 201,
          asset_key: 'zodiac-profile-baran-01',
          label: 'Znak zodiaku Baran',
          purpose: 'zodiac_profile',
          sign_slug: 'baran',
          active: true,
          priority: 10,
          asset: {
            id: 77,
            name: 'zodiac_baran.webp',
            provider: 'local',
            url: '/uploads/zodiac_baran.webp',
          },
        },
      ],
      zodiacSigns: [{ id: 11, name: 'Baran', slug: 'baran', image: null }],
    });

    const result = await ensureSeedMedia(mocks.strapi as never, {
      uploadsDir: '/does-not-need-to-exist',
      assets: [asset],
    });

    expect(result.zodiacLinked).toBe(1);
    expect(mocks.zodiacUpdate).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { image: 77 },
    });
  });

  it('discovers existing zodiac upload files, creates AICO mapping and links the sign image', async () => {
    const mocks = createStrapiMock({
      existingUploadFiles: [
        {
          id: 77,
          name: 'zodiac-baran-profile-01.webp',
          mime: 'image/webp',
          provider: 'aws-s3',
          url: '/uploads/zodiac-baran-profile-01.webp',
        },
      ],
      zodiacSigns: [{ id: 11, name: 'Baran', slug: 'baran', image: null }],
    });

    const result = await ensureSeedMedia(mocks.strapi as never, {
      uploadsDir: '/does-not-need-to-exist',
      assets: [],
    });

    expect(result.mediaAssets).toBe(1);
    expect(result.zodiacLinked).toBe(1);
    expect(mocks.mediaAssetCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        asset: 77,
        asset_key: 'zodiac-profile-baran-01',
        purpose: 'zodiac_profile',
        sign_slug: 'baran',
        mapping_source: 'seed',
      }),
    });
    expect(mocks.zodiacUpdate).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { image: 77 },
    });
  });

  it('links seeded articles from already mapped AICO blog assets', async () => {
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
          provider: 'local',
        },
      ],
      mappedMediaAssets: [
        {
          id: 301,
          asset_key: 'blog-astro-01',
          label: 'Artykuł Astrologia',
          purpose: 'blog_article',
          active: true,
          priority: 10,
          keywords: ['astrologia', 'blog'],
          asset: {
            id: 88,
            name: 'blog_astrologia.webp',
            provider: 'local',
            url: '/uploads/blog_astrologia.webp',
          },
        },
      ],
      articles: [
        {
          id: 21,
          title: 'Jak czytać sygnały dnia według własnego znaku',
          slug: 'jak-czytac-sygnaly-dnia-wedlug-znaku',
          category: { name: 'Astrologia' },
          image: null,
        },
      ],
    });

    const result = await ensureSeedMedia(mocks.strapi as never, {
      uploadsDir: '/does-not-need-to-exist',
      assets: [asset],
      articleSlugs: ['jak-czytac-sygnaly-dnia-wedlug-znaku'],
    });

    expect(result.articleLinked).toBe(1);
    expect(mocks.articleUpdate).toHaveBeenCalledWith({
      where: { id: 21 },
      data: { image: 88 },
    });
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
    expect(result.mediaAssets).toBe(1);
    expect(result.articleLinked).toBe(1);
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        files: expect.objectContaining({
          originalFilename: 'blog_placeholder.webp',
          type: 'image/webp',
        }),
      }),
    );
    expect(mocks.mediaAssetCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        asset: 90,
        asset_key: 'blog-placeholder-default',
        purpose: 'blog_article',
        priority: -100,
        keywords: expect.arrayContaining(['placeholder', 'fallback']),
      }),
    });
    expect(mocks.articleUpdate).toHaveBeenCalledWith({
      where: { id: 21 },
      data: { image: 90 },
    });
  });

  it('allows a dedicated blog asset to replace the default placeholder', async () => {
    vi.stubEnv('R2_UPLOAD_ENABLED', 'true');
    const mocks = createStrapiMock({
      existingUploadFiles: [
        {
          id: 90,
          name: 'blog_placeholder.webp',
          mime: 'image/webp',
          provider: 'aws-s3',
        },
        {
          id: 88,
          name: 'blog_astrologia.webp',
          mime: 'image/webp',
          provider: 'aws-s3',
        },
      ],
      mappedMediaAssets: [
        {
          id: 301,
          asset_key: 'blog-placeholder-default',
          label: 'Domyślna miniatura bloga',
          purpose: 'blog_article',
          active: true,
          priority: -100,
          keywords: ['blog', 'placeholder', 'fallback'],
          asset: {
            id: 90,
            name: 'blog_placeholder.webp',
            provider: 'aws-s3',
            url: '/uploads/blog_placeholder.webp',
          },
        },
        {
          id: 302,
          asset_key: 'blog-astro-01',
          label: 'Artykuł Astrologia',
          purpose: 'blog_article',
          active: true,
          priority: 10,
          keywords: ['astrologia', 'blog'],
          asset: {
            id: 88,
            name: 'blog_astrologia.webp',
            provider: 'aws-s3',
            url: '/uploads/blog_astrologia.webp',
          },
        },
      ],
      articles: [
        {
          id: 21,
          title: 'Jak czytać sygnały dnia według własnego znaku',
          slug: 'jak-czytac-sygnaly-dnia-wedlug-znaku',
          category: { name: 'Astrologia' },
          image: {
            id: 90,
            provider: 'aws-s3',
          },
        },
      ],
    });

    const result = await ensureSeedMedia(mocks.strapi as never, {
      uploadsDir: '/does-not-need-to-exist',
      assets: [],
      articleSlugs: ['jak-czytac-sygnaly-dnia-wedlug-znaku'],
    });

    expect(result.articleLinked).toBe(1);
    expect(mocks.articleUpdate).toHaveBeenCalledWith({
      where: { id: 21 },
      data: { image: 88 },
    });
  });

  it('replaces a legacy placeholder upload with the current webp placeholder', async () => {
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
      mappedMediaAssets: [
        {
          id: 301,
          asset_key: 'blog-placeholder-default',
          label: 'Domyślna miniatura bloga',
          purpose: 'blog_article',
          active: true,
          priority: -100,
          keywords: ['blog', 'placeholder', 'fallback'],
          asset: {
            id: 91,
            name: 'blog_placeholder.svg',
            provider: 'aws-s3',
            url: '/uploads/blog_placeholder.svg',
          },
        },
      ],
      articles: [
        {
          id: 21,
          title: 'Artykuł ze starym placeholderem',
          slug: 'artykul-ze-starym-placeholderem',
          category: { name: 'Astrologia' },
          image: {
            id: 91,
            name: 'blog_placeholder.svg',
            provider: 'aws-s3',
            url: '/uploads/blog_placeholder.svg',
          },
        },
      ],
    });

    const result = await ensureSeedMedia(mocks.strapi as never, {
      uploadsDir: '/does-not-need-to-exist',
      assets: [],
      articleSlugs: ['artykul-ze-starym-placeholderem'],
    });

    expect(result.mediaAssets).toBe(1);
    expect(result.articleLinked).toBe(1);
    expect(mocks.mediaAssetUpdate).toHaveBeenCalledWith({
      where: { id: 301 },
      data: expect.objectContaining({
        asset: 90,
        asset_key: 'blog-placeholder-default',
      }),
    });
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
      mappedMediaAssets: [
        {
          id: 301,
          asset_key: 'blog-placeholder-default',
          label: 'Domyślna miniatura bloga',
          purpose: 'blog_article',
          active: true,
          priority: -100,
          keywords: ['blog', 'placeholder', 'fallback'],
          asset: {
            id: 90,
            name: 'blog_placeholder.webp',
            provider: 'aws-s3',
            url: '/uploads/blog_placeholder.webp',
          },
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
