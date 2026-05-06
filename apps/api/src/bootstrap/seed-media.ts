import fs from 'node:fs';
import path from 'node:path';
import type { Core } from '@strapi/strapi';

type UploadFileRecord = {
  id: number;
  name?: string | null;
  url?: string | null;
  provider?: string | null;
};

export type SeedMediaAsset = {
  cardSlug: string;
  fileName: string;
  label: string;
  assetKey: string;
};

type SeedMediaOptions = {
  uploadsDir?: string;
  assets?: SeedMediaAsset[];
};

type SeedMediaResult = {
  uploaded: number;
  linked: number;
  mediaAssets: number;
  missingFiles: string[];
};

type UploadService = {
  upload(input: {
    data: {
      fileInfo: {
        alternativeText: string;
        caption: string;
        name: string;
      };
    };
    files: {
      filepath: string;
      originalFilename: string;
      name: string;
      type: string;
      size: number;
    };
  }): Promise<UploadFileRecord | UploadFileRecord[]>;
};

const DAILY_TAROT_CARD_FILES: Array<[string, string, string]> = [
  ['glupiec', 'daily_blazen.webp', 'Głupiec'],
  ['mag', 'daily_mag.webp', 'Mag'],
  ['kaplanka', 'daily_kaplanka.webp', 'Kapłanka'],
  ['cesarzowa', 'daily_cesarzowa.webp', 'Cesarzowa'],
  ['cesarz', 'daily_cesarz.webp', 'Cesarz'],
  ['kaplan', 'daily_kaplan.webp', 'Kapłan'],
  ['kochankowie', 'daily_kochankowie.webp', 'Kochankowie'],
  ['rydwan', 'daily_rydwan.webp', 'Rydwan'],
  ['sprawiedliwosc', 'daily_sprawiedliwosc.webp', 'Sprawiedliwość'],
  ['pustelnik', 'daily_pustelnik.webp', 'Pustelnik'],
  ['kolo-fortuny', 'daily_kolo_losu.webp', 'Koło Fortuny'],
  ['moc', 'daily_moc.webp', 'Moc'],
  ['wisielec', 'daily_wisielec.webp', 'Wisielec'],
  ['smierc', 'daily_smierc.webp', 'Śmierć'],
  ['umiarkowanie', 'daily_umiarkowanie.webp', 'Umiarkowanie'],
  ['diabel', 'daily_diabel.webp', 'Diabeł'],
  ['wieza', 'daily_wieza.webp', 'Wieża'],
  ['gwiazda', 'daily_gwiazda.webp', 'Gwiazda'],
  ['ksiezyc', 'daily_ksiezyc.webp', 'Księżyc'],
  ['slonce', 'daily_slonce.webp', 'Słońce'],
  ['sad-ostateczny', 'daily_sad.webp', 'Sąd Ostateczny'],
  ['swiat', 'daily_swiat.webp', 'Świat'],
];

export const DAILY_TAROT_SEED_ASSETS: SeedMediaAsset[] =
  DAILY_TAROT_CARD_FILES.map(([cardSlug, fileName, label]) => ({
    cardSlug,
    fileName,
    label,
    assetKey: `daily-card-${cardSlug}`,
  }));

const resolveSeedUploadsDir = (): string =>
  path.join(process.cwd(), 'public', 'uploads');

const isR2UploadEnabled = (): boolean =>
  process.env.R2_UPLOAD_ENABLED?.trim().toLowerCase() === 'true';

const getUploadService = (strapi: Core.Strapi): UploadService => {
  const service = strapi.plugin('upload').service('upload') as unknown;

  if (
    !service ||
    typeof service !== 'object' ||
    !('upload' in service) ||
    typeof (service as { upload: unknown }).upload !== 'function'
  ) {
    throw new Error('Strapi upload service is unavailable.');
  }

  return service as UploadService;
};

const asRecordArray = (value: unknown): UploadFileRecord[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is UploadFileRecord =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as { id?: unknown }).id === 'number',
      )
    : [];

const extractRelationId = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return value;
  }

  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { id?: unknown }).id === 'number'
  ) {
    return (value as { id: number }).id;
  }

  return null;
};

const extractProvider = (value: unknown): string | null => {
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { provider?: unknown }).provider === 'string'
  ) {
    return (value as { provider: string }).provider;
  }

  return null;
};

const stripExtension = (fileName: string): string =>
  fileName.replace(/\.[^.]+$/, '');

const findReusableUploadFile = async (
  strapi: Core.Strapi,
  asset: SeedMediaAsset,
): Promise<UploadFileRecord | null> => {
  const files = asRecordArray(
    await strapi.db.query('plugin::upload.file').findMany({
      where: {
        $or: [
          { name: asset.fileName },
          { name: stripExtension(asset.fileName) },
          { hash: stripExtension(asset.fileName) },
        ],
      },
      limit: 5,
    }),
  );

  const reusable = files.find((file) => {
    if (!isR2UploadEnabled()) {
      return true;
    }

    return file.provider === 'aws-s3';
  });

  return reusable ?? null;
};

const uploadSeedFile = async (
  strapi: Core.Strapi,
  asset: SeedMediaAsset,
  uploadsDir: string,
): Promise<UploadFileRecord> => {
  const filePath = path.join(uploadsDir, asset.fileName);
  const fileStats = fs.statSync(filePath);
  const uploadService = getUploadService(strapi);

  const uploaded = await uploadService.upload({
    data: {
      fileInfo: {
        alternativeText: `Karta tarota ${asset.label}`,
        caption: 'Star Sign seed media',
        name: asset.fileName,
      },
    },
    files: {
      filepath: filePath,
      originalFilename: asset.fileName,
      name: asset.fileName,
      type: 'image/webp',
      size: fileStats.size,
    },
  });

  const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;

  if (!file?.id) {
    throw new Error(`Upload seed media did not return file id: ${asset.fileName}`);
  }

  return file;
};

const ensureUploadFile = async (
  strapi: Core.Strapi,
  asset: SeedMediaAsset,
  uploadsDir: string,
): Promise<{ file: UploadFileRecord; uploaded: boolean } | null> => {
  const existing = await findReusableUploadFile(strapi, asset);

  if (existing) {
    return { file: existing, uploaded: false };
  }

  const filePath = path.join(uploadsDir, asset.fileName);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return {
    file: await uploadSeedFile(strapi, asset, uploadsDir),
    uploaded: true,
  };
};

const ensureTarotCardImage = async (
  strapi: Core.Strapi,
  asset: SeedMediaAsset,
  file: UploadFileRecord,
): Promise<boolean> => {
  const query = strapi.db.query('api::tarot-card.tarot-card');
  const card = (await query.findOne({
    where: { slug: asset.cardSlug },
    populate: ['image'],
  })) as { id: number; image?: unknown } | null;

  if (!card?.id) {
    return false;
  }

  const currentImageId = extractRelationId(card.image);
  const currentProvider = extractProvider(card.image);

  if (
    currentImageId === file.id ||
    (currentImageId && (!isR2UploadEnabled() || currentProvider === 'aws-s3'))
  ) {
    return false;
  }

  await query.update({
    where: { id: card.id },
    data: { image: file.id },
  });

  return true;
};

const ensureAicoMediaAsset = async (
  strapi: Core.Strapi,
  asset: SeedMediaAsset,
  file: UploadFileRecord,
): Promise<boolean> => {
  const query = strapi.db.query('plugin::ai-content-orchestrator.media-asset');
  const existing = await query.findOne({
    where: { asset_key: asset.assetKey },
  });
  const currentAssetId = extractRelationId(existing?.asset);
  const data = {
    asset_key: asset.assetKey,
    label: `Karta Dnia: ${asset.label}`,
    purpose: 'daily_card',
    period_scope: 'daily',
    priority: 10,
    active: true,
    cooldown_days: 3,
    keywords: ['daily', 'card', 'tarot', asset.cardSlug],
    mapping_source: 'seed',
    mapping_confidence: 1,
    mapping_reasons: ['Bootstrap seed media'],
    notes: 'Lokalny asset tarota przypięty automatycznie przez bootstrap.',
    asset: file.id,
    use_count: typeof existing?.use_count === 'number' ? existing.use_count : 0,
    last_used_at: existing?.last_used_at || null,
  };

  if (existing?.id) {
    if (currentAssetId === file.id) {
      return false;
    }

    await query.update({
      where: { id: existing.id },
      data,
    });
    return true;
  }

  await query.create({ data });
  return true;
};

export const ensureSeedMedia = async (
  strapi: Core.Strapi,
  options: SeedMediaOptions = {},
): Promise<SeedMediaResult> => {
  const uploadsDir = options.uploadsDir ?? resolveSeedUploadsDir();
  const assets = options.assets ?? DAILY_TAROT_SEED_ASSETS;
  const result: SeedMediaResult = {
    uploaded: 0,
    linked: 0,
    mediaAssets: 0,
    missingFiles: [],
  };

  for (const asset of assets) {
    const ensured = await ensureUploadFile(strapi, asset, uploadsDir);

    if (!ensured) {
      result.missingFiles.push(asset.fileName);
      continue;
    }

    if (ensured.uploaded) {
      result.uploaded += 1;
    }

    if (await ensureTarotCardImage(strapi, asset, ensured.file)) {
      result.linked += 1;
    }

    if (await ensureAicoMediaAsset(strapi, asset, ensured.file)) {
      result.mediaAssets += 1;
    }
  }

  if (result.missingFiles.length > 0) {
    strapi.log.warn(
      `[seed-media] Brak lokalnych assetów: ${result.missingFiles.join(', ')}`,
    );
  }

  if (result.uploaded > 0 || result.linked > 0 || result.mediaAssets > 0) {
    strapi.log.info(
      `[seed-media] Tarot assets: uploaded=${result.uploaded}, linked=${result.linked}, mediaAssets=${result.mediaAssets}`,
    );
  }

  return result;
};
