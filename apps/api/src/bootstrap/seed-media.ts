import fs from 'node:fs';
import path from 'node:path';
import type { Core } from '@strapi/strapi';

type UploadFileRecord = {
  id: number;
  name?: string | null;
  hash?: string | null;
  mime?: string | null;
  url?: string | null;
  provider?: string | null;
};

type SeedMediaPurpose =
  | 'daily_card'
  | 'horoscope_sign'
  | 'blog_article'
  | 'zodiac_profile'
  | 'fallback_general';

type SeedMediaPeriodScope = 'any' | 'daily' | 'weekly' | 'monthly';

export type SeedMediaAsset = {
  cardSlug: string;
  fileName: string;
  label: string;
  assetKey: string;
  purpose?: SeedMediaPurpose;
  signSlug?: string | null;
  periodScope?: SeedMediaPeriodScope;
  keywords?: string[];
  priority?: number;
};

type SeedMediaOptions = {
  uploadsDir?: string;
  assets?: SeedMediaAsset[];
  articleSlugs?: string[];
  linkMappedContent?: boolean;
};

type SeedMediaResult = {
  uploaded: number;
  linked: number;
  zodiacLinked: number;
  articleLinked: number;
  missingFiles: string[];
};

type RelationUpdateQuery = {
  where(criteria: Record<string, unknown>): RelationUpdateQuery;
  whereIn(column: string, values: number[]): RelationUpdateQuery;
  update(data: Record<string, unknown>): Promise<number>;
};

type ZodiacSignRecord = {
  id: number;
  name?: string | null;
  slug?: string | null;
  image?: unknown;
};

type ArticleRecord = {
  id: number;
  title?: string | null;
  slug?: string | null;
  category?: { name?: string | null } | null;
  image?: unknown;
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

type LocalSeedUpload = {
  fileName: string;
  alternativeText: string;
  caption: string;
  mimeType: string;
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
    purpose: 'daily_card',
    periodScope: 'daily',
    priority: 10,
    keywords: ['daily', 'card', 'tarot', cardSlug],
  }));

/**
 * Statyczne ilustracje profilowe 12 znaków zodiaku (konstelacje, Lumina Silk).
 * Bootstrap uploaduje je idempotentnie (dedupe po nazwie pliku) i tworzy
 * Obrazy są podpinane bezpośrednio do znaków (linkZodiacSignImagesDirect),
 * także na czystej produkcji.
 */
const ZODIAC_SIGN_FILES: Array<[string, string, string]> = [
  ['baran', 'zodiac-baran-profile.webp', 'Baran'],
  ['byk', 'zodiac-byk-profile.webp', 'Byk'],
  ['bliznieta', 'zodiac-bliznieta-profile.webp', 'Bliźnięta'],
  ['rak', 'zodiac-rak-profile.webp', 'Rak'],
  ['lew', 'zodiac-lew-profile.webp', 'Lew'],
  ['panna', 'zodiac-panna-profile.webp', 'Panna'],
  ['waga', 'zodiac-waga-profile.webp', 'Waga'],
  ['skorpion', 'zodiac-skorpion-profile.webp', 'Skorpion'],
  ['strzelec', 'zodiac-strzelec-profile.webp', 'Strzelec'],
  ['koziorozec', 'zodiac-koziorozec-profile.webp', 'Koziorożec'],
  ['wodnik', 'zodiac-wodnik-profile.webp', 'Wodnik'],
  ['ryby', 'zodiac-ryby-profile.webp', 'Ryby'],
];

export const ZODIAC_PROFILE_SEED_ASSETS: SeedMediaAsset[] =
  ZODIAC_SIGN_FILES.map(([signSlug, fileName, label]) => ({
    cardSlug: signSlug,
    fileName,
    label,
    assetKey: `zodiac-${signSlug}-profile`,
    purpose: 'zodiac_profile',
    signSlug,
    priority: 10,
    keywords: ['zodiac', 'profile', signSlug],
  }));

const BLOG_PLACEHOLDER_FILE_NAME = 'blog_placeholder.webp';
const BLOG_LEGACY_PLACEHOLDER_FILE_NAMES = ['blog_placeholder.svg'];
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

const extractString = (value: unknown, key: string): string | null => {
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>)[key] === 'string'
  ) {
    const parsed = (value as Record<string, string>)[key].trim();
    return parsed.length > 0 ? parsed : null;
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

const extractUploadFile = (value: unknown): UploadFileRecord | null => {
  const id = extractRelationId(value);

  if (!id) {
    return null;
  }

  return {
    id,
    name: extractString(value, 'name'),
    hash: extractString(value, 'hash'),
    mime: extractString(value, 'mime'),
    url: extractString(value, 'url'),
    provider: extractProvider(value),
  };
};

const stripExtension = (fileName: string): string =>
  fileName.replace(/\.[^.]+$/, '');

const getSeedFileMimeType = (fileName: string): string => {
  if (/\.svg$/i.test(fileName)) {
    return 'image/svg+xml';
  }

  if (/\.webp$/i.test(fileName)) {
    return 'image/webp';
  }

  if (/\.png$/i.test(fileName)) {
    return 'image/png';
  }

  if (/\.jpe?g$/i.test(fileName)) {
    return 'image/jpeg';
  }

  if (/\.avif$/i.test(fileName)) {
    return 'image/avif';
  }

  return 'application/octet-stream';
};

const normalizeText = (value: string | null | undefined): string =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .toLowerCase()
    .trim();

const isBlogPlaceholderFileName = (
  value: string | null | undefined,
): boolean => {
  const clean = value?.split(/[?#]/)[0]?.trim();

  if (!clean) {
    return false;
  }

  const normalized = normalizeText(stripExtension(path.basename(clean))).replace(
    /[_\s]+/g,
    '-',
  );

  return normalized === 'blog-placeholder';
};

const shouldLinkMedia = (
  currentImage: unknown,
  file: UploadFileRecord,
): boolean => {
  const currentImageId = extractRelationId(currentImage);
  const currentProvider = extractProvider(currentImage);

  if (currentImageId === file.id) {
    return false;
  }

  if (
    currentImageId &&
    (!isR2UploadEnabled() || currentProvider === 'aws-s3')
  ) {
    return false;
  }

  return true;
};

const findReusableUploadFileByName = async (
  strapi: Core.Strapi,
  fileName: string,
): Promise<UploadFileRecord | null> => {
  const files = asRecordArray(
    await strapi.db.query('plugin::upload.file').findMany({
      where: {
        $or: [
          { name: fileName },
          { name: stripExtension(fileName) },
          { hash: stripExtension(fileName) },
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

const findReusableUploadFile = async (
  strapi: Core.Strapi,
  asset: SeedMediaAsset,
): Promise<UploadFileRecord | null> =>
  findReusableUploadFileByName(strapi, asset.fileName);

const findBlogPlaceholderUploadFiles = async (
  strapi: Core.Strapi,
): Promise<UploadFileRecord[]> =>
  asRecordArray(
    await strapi.db.query('plugin::upload.file').findMany({
      where: {
        $or: [
          { name: BLOG_PLACEHOLDER_FILE_NAME },
          { name: stripExtension(BLOG_PLACEHOLDER_FILE_NAME) },
          ...BLOG_LEGACY_PLACEHOLDER_FILE_NAMES.flatMap((fileName) => [
            { name: fileName },
            { name: stripExtension(fileName) },
          ]),
        ],
      },
      limit: 20,
    }),
  ).filter(
    (file) =>
      isBlogPlaceholderFileName(file.name) ||
      isBlogPlaceholderFileName(file.hash) ||
      isBlogPlaceholderFileName(file.url),
  );

const uploadLocalSeedFile = async (
  strapi: Core.Strapi,
  upload: LocalSeedUpload,
  uploadsDir: string,
): Promise<UploadFileRecord> => {
  const filePath = path.join(uploadsDir, upload.fileName);
  const fileStats = fs.statSync(filePath);
  const uploadService = getUploadService(strapi);

  const uploaded = await uploadService.upload({
    data: {
      fileInfo: {
        alternativeText: upload.alternativeText,
        caption: upload.caption,
        name: upload.fileName,
      },
    },
    files: {
      filepath: filePath,
      originalFilename: upload.fileName,
      name: upload.fileName,
      type: upload.mimeType,
      size: fileStats.size,
    },
  });

  const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;

  if (!file?.id) {
    throw new Error(
      `Upload seed media did not return file id: ${upload.fileName}`,
    );
  }

  return file;
};

const uploadSeedFile = async (
  strapi: Core.Strapi,
  asset: SeedMediaAsset,
  uploadsDir: string,
): Promise<UploadFileRecord> =>
  uploadLocalSeedFile(
    strapi,
    {
      fileName: asset.fileName,
      alternativeText: `Karta tarota ${asset.label}`,
      caption: 'Star Sign seed media',
      mimeType: getSeedFileMimeType(asset.fileName),
    },
    uploadsDir,
  );

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

const ensureBlogPlaceholderUploadFile = async (
  strapi: Core.Strapi,
  uploadsDir: string,
): Promise<{ file: UploadFileRecord; uploaded: boolean } | null> => {
  const existing = await findReusableUploadFileByName(
    strapi,
    BLOG_PLACEHOLDER_FILE_NAME,
  );

  if (existing) {
    return { file: existing, uploaded: false };
  }

  const filePath = path.join(uploadsDir, BLOG_PLACEHOLDER_FILE_NAME);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return {
    file: await uploadLocalSeedFile(
      strapi,
      {
        fileName: BLOG_PLACEHOLDER_FILE_NAME,
        alternativeText: 'Domyślna miniatura artykułu Star Sign',
        caption: 'Star Sign blog placeholder',
        mimeType: getSeedFileMimeType(BLOG_PLACEHOLDER_FILE_NAME),
      },
      uploadsDir,
    ),
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

  if (!shouldLinkMedia(card.image, file)) {
    return false;
  }

  await query.update({
    where: { id: card.id },
    data: { image: file.id },
  });

  return true;
};

const isBlogPlaceholderUpload = (value: unknown): boolean => {
  const file = extractUploadFile(value);

  if (!file) {
    return false;
  }

  return (
    isBlogPlaceholderFileName(file.name) ||
    isBlogPlaceholderFileName(file.hash) ||
    isBlogPlaceholderFileName(file.url)
  );
};

/**
 * Ilustracje znaków podpinamy bezpośrednio z uploadowanych plików seedowych (slug znaku z seeda).
 */
const linkZodiacSignImagesDirect = async (
  strapi: Core.Strapi,
  files: Array<{ signSlug: string; file: UploadFileRecord }>,
): Promise<number> => {
  if (files.length === 0) {
    return 0;
  }

  const query = strapi.db.query('api::zodiac-sign.zodiac-sign');
  const signs = (await query.findMany({
    populate: ['image'],
    limit: 100,
  })) as ZodiacSignRecord[];
  let linked = 0;

  for (const sign of signs) {
    const entry = files.find(
      (item) => normalizeText(item.signSlug) === normalizeText(sign.slug),
    );

    if (!entry || !shouldLinkMedia(sign.image, entry.file)) {
      continue;
    }

    await query.update({
      where: { id: sign.id },
      data: { image: entry.file.id },
    });
    linked += 1;
  }

  return linked;
};

/**
 * Seedowane artykuły bez okładki dostają domyślny placeholder
 * bloga (albo przepinamy ze starego placeholdera).
 */
const linkArticlePlaceholderDirect = async (
  strapi: Core.Strapi,
  articleSlugs: string[],
  placeholder: UploadFileRecord,
  knownPlaceholderFileIds: ReadonlySet<number>,
): Promise<number> => {
  if (articleSlugs.length === 0) {
    return 0;
  }

  const query = strapi.db.query('api::article.article');
  const articles = (await query.findMany({
    where: { slug: { $in: articleSlugs } },
    populate: ['image'],
    limit: articleSlugs.length,
  })) as ArticleRecord[];
  let linked = 0;

  for (const article of articles) {
    const currentImageId = extractRelationId(article.image);
    const currentIsPlaceholder =
      (typeof currentImageId === 'number' &&
        knownPlaceholderFileIds.has(currentImageId)) ||
      isBlogPlaceholderUpload(article.image);

    if (
      currentImageId === placeholder.id ||
      (!currentIsPlaceholder && !shouldLinkMedia(article.image, placeholder))
    ) {
      continue;
    }

    await query.update({
      where: { id: article.id },
      data: { image: placeholder.id },
    });
    linked += 1;
  }

  return linked;
};

const replaceLegacyBlogPlaceholderArticleRelations = async (
  strapi: Core.Strapi,
  currentFileId: number,
  knownPlaceholderFileIds: ReadonlySet<number>,
): Promise<number> => {
  const legacyFileIds = [...knownPlaceholderFileIds].filter(
    (fileId) => fileId !== currentFileId,
  );

  if (legacyFileIds.length === 0) {
    return 0;
  }

  const connection = (strapi.db as unknown as { connection?: unknown })
    .connection;

  if (typeof connection !== 'function') {
    return 0;
  }

  try {
    const updated = await (connection as (
      tableName: string,
    ) => RelationUpdateQuery)(
      'files_related_mph',
    )
      .where({
        related_type: 'api::article.article',
        field: 'image',
      })
      .whereIn('file_id', legacyFileIds)
      .update({ file_id: currentFileId });

    return typeof updated === 'number' ? updated : 0;
  } catch (error) {
    strapi.log.warn(
      `[seed-media] Nie udało się przepiąć legacy placeholderów bloga: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );
    return 0;
  }
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
    zodiacLinked: 0,
    articleLinked: 0,
    missingFiles: [],
  };

  let firstUploadError: string | null = null;

  for (const asset of assets) {
    try {
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

    } catch (error) {
      firstUploadError ??=
        error instanceof Error ? `${asset.fileName}: ${error.message}` : String(error);
    }
  }

  // Ilustracje profilowe znaków: upload + media-asset (purpose=zodiac_profile),
  // linkowanie do znaków realizuje ensureZodiacSignImages poniżej.
  // Assety są opcjonalne — brak pliku lokalnego pomijamy cicho, żeby środowiska
  // bez nich (np. testy) nie dostawały ostrzeżeń o missingFiles.
  // Diagnostyka produkcyjna (usuwane po ustabilizowaniu): stan plików
  // i ewentualny błąd trafiają do core-store, skąd czyta go publiczny
  // /api/app-settings/public — bez dostępu do logów kontenera.
  const seedMediaDiag: Record<string, unknown> = {
    cwd: process.cwd(),
    uploadsDir,
    uploadsDirExists: fs.existsSync(uploadsDir),
    uploadsZodiacSample: fs.existsSync(uploadsDir)
      ? fs
          .readdirSync(uploadsDir)
          .filter((f) => f.startsWith('zodiac'))
          .slice(0, 3)
      : [],
    zodiacFilesTotal: ZODIAC_PROFILE_SEED_ASSETS.length,
    r2Enabled: isR2UploadEnabled(),
    uploaded: 0,
    firstZodiacError: null as string | null,
    firstUploadError,
  };

  const zodiacUploads: Array<{ signSlug: string; file: UploadFileRecord }> =
    [];

  for (const asset of ZODIAC_PROFILE_SEED_ASSETS) {
    if (!fs.existsSync(path.join(uploadsDir, asset.fileName))) {
      continue;
    }

    try {
      const ensured = await ensureUploadFile(strapi, asset, uploadsDir);

      if (!ensured) {
        continue;
      }

      if (ensured.uploaded) {
        result.uploaded += 1;
        seedMediaDiag.uploaded = result.uploaded;
      }

      if (asset.signSlug) {
        zodiacUploads.push({ signSlug: asset.signSlug, file: ensured.file });
      }

    } catch (error) {
      if (!seedMediaDiag.firstZodiacError) {
        seedMediaDiag.firstZodiacError =
          error instanceof Error ? error.message : String(error);
      }
    }
  }

  try {
    await strapi
      .store({ type: 'plugin', name: 'seed-media-diag', key: 'state' })
      .set({
        value: {
          ...seedMediaDiag,
          at: new Date().toISOString(),
        },
      });
    strapi.log.info(
      `[seed-media-diag] ${JSON.stringify(seedMediaDiag)}`,
    );
  } catch (storeError) {
    strapi.log.warn(
      `[seed-media-diag] zapis niemożliwy: ${
        storeError instanceof Error ? storeError.message : String(storeError)
      }`,
    );
  }

  if (options.linkMappedContent !== false) {
    const knownPlaceholderFileIds = new Set<number>();

    for (const file of await findBlogPlaceholderUploadFiles(strapi)) {
      knownPlaceholderFileIds.add(file.id);
    }

    const placeholder = await ensureBlogPlaceholderUploadFile(
      strapi,
      uploadsDir,
    );

    if (placeholder) {
      if (placeholder.uploaded) {
        result.uploaded += 1;
      }

      knownPlaceholderFileIds.add(placeholder.file.id);
    } else {
      result.missingFiles.push(BLOG_PLACEHOLDER_FILE_NAME);
    }

    result.zodiacLinked = await linkZodiacSignImagesDirect(
      strapi,
      zodiacUploads,
    );
    result.articleLinked = placeholder
      ? await linkArticlePlaceholderDirect(
          strapi,
          options.articleSlugs ?? [],
          placeholder.file,
          knownPlaceholderFileIds,
        )
      : 0;

    if (placeholder) {
      result.articleLinked += await replaceLegacyBlogPlaceholderArticleRelations(
        strapi,
        placeholder.file.id,
        knownPlaceholderFileIds,
      );
    }
  }

  if (result.missingFiles.length > 0) {
    strapi.log.warn(
      `[seed-media] Brak lokalnych assetów: ${result.missingFiles.join(', ')}`,
    );
  }

  if (
    result.uploaded > 0 ||
    result.linked > 0 ||
    result.zodiacLinked > 0 ||
    result.articleLinked > 0
  ) {
    strapi.log.info(
      `[seed-media] Seed assets: uploaded=${result.uploaded}, tarotLinked=${result.linked}, zodiacLinked=${result.zodiacLinked}, articleLinked=${result.articleLinked}`,
    );
  }

  return result;
};
