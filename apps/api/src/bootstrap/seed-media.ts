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
  mediaAssets: number;
  zodiacLinked: number;
  articleLinked: number;
  missingFiles: string[];
};

type MediaAssetRecord = {
  id: number;
  asset_key?: string | null;
  label?: string | null;
  purpose?: SeedMediaPurpose | null;
  sign_slug?: string | null;
  period_scope?: SeedMediaPeriodScope | null;
  keywords?: unknown;
  priority?: number | null;
  active?: boolean | null;
  mapping_source?: 'manual' | 'suggestion' | 'bulk_suggestion' | 'seed' | null;
  use_count?: number | null;
  last_used_at?: string | null;
  asset?: unknown;
};

type LinkedMediaAsset = {
  mediaAsset: MediaAssetRecord;
  file: UploadFileRecord;
};

type BlogPlaceholderMediaAssetResult = {
  changed: boolean;
  previousFileId: number | null;
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

const BLOG_PLACEHOLDER_FILE_NAME = 'blog_placeholder.webp';
const BLOG_LEGACY_PLACEHOLDER_FILE_NAMES = ['blog_placeholder.svg'];
const BLOG_PLACEHOLDER_ASSET_KEY = 'blog-placeholder-default';
const BLOG_PLACEHOLDER_LABEL = 'Domyślna miniatura bloga';
const BLOG_PLACEHOLDER_KEYWORDS = [
  'blog',
  'article',
  'placeholder',
  'fallback',
  'default',
  'journal',
];

const DISCOVERABLE_CONTENT_PURPOSES = new Set<SeedMediaPurpose>([
  'zodiac_profile',
  'horoscope_sign',
  'blog_article',
]);

const IMAGE_FILE_EXTENSION_PATTERN = /\.(?:avif|jpe?g|png|svg|webp)$/i;

type SeedMediaMappingSuggestion = {
  asset_key: string;
  label: string;
  purpose: SeedMediaPurpose;
  sign_slug: string | null;
  period_scope: SeedMediaPeriodScope;
  keywords: string[];
  confidence: number;
  reasons: string[];
};

const SIGN_TOKEN_TO_PL_SLUG: Record<string, string> = {
  aries: 'baran',
  baran: 'baran',
  taurus: 'byk',
  byk: 'byk',
  gemini: 'bliznieta',
  bliznieta: 'bliznieta',
  cancer: 'rak',
  rak: 'rak',
  leo: 'lew',
  lew: 'lew',
  virgo: 'panna',
  panna: 'panna',
  libra: 'waga',
  waga: 'waga',
  scorpio: 'skorpion',
  skorpion: 'skorpion',
  sagittarius: 'strzelec',
  strzelec: 'strzelec',
  capricorn: 'koziorozec',
  koziorozec: 'koziorozec',
  aquarius: 'wodnik',
  wodnik: 'wodnik',
  pisces: 'ryby',
  ryby: 'ryby',
};

const SEED_MEDIA_MAPPING_STOPWORDS = new Set([
  'img',
  'image',
  'photo',
  'picture',
  'cover',
  'webp',
  'jpg',
  'jpeg',
  'png',
  'avif',
  'astro',
  'blog',
  'daily',
  'weekly',
  'monthly',
  'card',
  'tarot',
  'article',
  'artykul',
  'grafika',
  'horoskop',
  'dzienny',
  'dzienna',
  'tygodniowy',
  'tygodniowa',
  'miesieczny',
  'miesieczna',
]);

const stripFileExtension = (fileName: string): string =>
  fileName.replace(/\.[a-z0-9]+$/i, '');

const slugifySeedMediaToken = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toSeedMediaTokens = (fileName: string): string[] =>
  slugifySeedMediaToken(stripFileExtension(fileName))
    .replace(/-/g, '_')
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);

const detectSeedMediaSignSlug = (tokens: string[]): string | null => {
  for (const token of tokens) {
    if (SIGN_TOKEN_TO_PL_SLUG[token]) {
      return SIGN_TOKEN_TO_PL_SLUG[token];
    }
  }

  return null;
};

const detectSeedMediaPeriodScope = (
  tokens: string[],
): SeedMediaPeriodScope => {
  if (tokens.includes('daily') || tokens.includes('dzienny') || tokens.includes('dzienna')) {
    return 'daily';
  }

  if (tokens.includes('weekly') || tokens.includes('tygodniowy') || tokens.includes('tygodniowa')) {
    return 'weekly';
  }

  if (
    tokens.includes('monthly') ||
    tokens.includes('miesieczny') ||
    tokens.includes('miesieczna')
  ) {
    return 'monthly';
  }

  return 'any';
};

const detectSeedMediaPurpose = (
  tokens: string[],
  signSlug: string | null,
): SeedMediaPurpose => {
  if (
    tokens.includes('blog') ||
    tokens.includes('article') ||
    tokens.includes('artykul') ||
    tokens.includes('post')
  ) {
    return 'blog_article';
  }

  if (
    signSlug &&
    (tokens.includes('zodiac') ||
      tokens.includes('znak') ||
      tokens.includes('profile') ||
      tokens.includes('profil'))
  ) {
    return 'zodiac_profile';
  }

  if (tokens.includes('card') || tokens.includes('karta') || tokens.includes('tarot')) {
    return 'daily_card';
  }

  if (tokens.includes('horoscope') || tokens.includes('horoskop') || signSlug) {
    return 'horoscope_sign';
  }

  return 'fallback_general';
};

const extractSeedMediaNumericHints = (tokens: string[]): number[] =>
  tokens
    .map((token) => token.match(/\d+/g) ?? [])
    .flat()
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 9999);

const nextSeedMediaOrdinalForPrefix = (
  existingAssetKeys: Set<string>,
  prefix: string,
): number => {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedPrefix}-(\\d{1,4})(?:-[0-9]+)?$`);
  let max = 0;

  for (const key of existingAssetKeys) {
    const matched = key.match(pattern);
    if (!matched?.[1]) {
      continue;
    }

    const parsed = Number(matched[1]);
    if (Number.isFinite(parsed) && parsed > max) {
      max = parsed;
    }
  }

  return max + 1;
};

const ensureUniqueSeedMediaAssetKey = (
  existingAssetKeys: Set<string>,
  candidate: string,
): string => {
  if (!existingAssetKeys.has(candidate)) {
    return candidate;
  }

  let suffix = 2;
  while (existingAssetKeys.has(`${candidate}-${suffix}`)) {
    suffix += 1;
  }

  return `${candidate}-${suffix}`;
};

const deriveSeedMediaAssetKey = (input: {
  purpose: SeedMediaPurpose;
  signSlug: string | null;
  periodScope: SeedMediaPeriodScope;
  numericHints: number[];
  existingAssetKeys: Set<string>;
}): string => {
  const useHintOrNext = (prefix: string): string => {
    const hinted = input.numericHints.find((item) => item > 0);
    const ordinal =
      hinted ?? nextSeedMediaOrdinalForPrefix(input.existingAssetKeys, prefix);
    return ensureUniqueSeedMediaAssetKey(input.existingAssetKeys, `${prefix}-${String(ordinal).padStart(2, '0')}`);
  };

  if (input.purpose === 'blog_article') {
    return useHintOrNext('blog-astro');
  }

  if (input.purpose === 'daily_card') {
    return useHintOrNext('daily-card');
  }

  if (input.purpose === 'horoscope_sign' && input.signSlug) {
    const period = input.periodScope === 'any' ? 'daily' : input.periodScope;
    return useHintOrNext(`horoscope-${input.signSlug}-${period}`);
  }

  if (input.purpose === 'zodiac_profile' && input.signSlug) {
    return useHintOrNext(`zodiac-profile-${input.signSlug}`);
  }

  return useHintOrNext('fallback-general');
};

const deriveSeedMediaKeywords = (
  tokens: string[],
  signSlug: string | null,
): string[] => {
  const output = new Set<string>();

  for (const token of tokens) {
    if (
      SEED_MEDIA_MAPPING_STOPWORDS.has(token) ||
      /^\d+$/.test(token) ||
      token.length < 3
    ) {
      continue;
    }

    output.add(token);

    if (output.size >= 6) {
      break;
    }
  }

  if (signSlug) {
    output.add(signSlug);
  }

  return [...output];
};

const toSeedMediaTitleCase = (value: string): string =>
  value
    .split(/\s+/)
    .map((token) => {
      if (!token) {
        return token;
      }

      if (/^\d+$/.test(token)) {
        return token;
      }

      if (token.length <= 2) {
        return token.toUpperCase();
      }

      return `${token.slice(0, 1).toUpperCase()}${token.slice(1).toLowerCase()}`;
    })
    .join(' ');

const deriveSeedMediaLabel = (input: {
  fileName: string;
  purpose: SeedMediaPurpose;
  signSlug: string | null;
  periodScope: SeedMediaPeriodScope;
}): string => {
  const displayName = toSeedMediaTitleCase(
    stripFileExtension(input.fileName).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(),
  );
  const safeDisplayName = displayName.length > 0 ? displayName : 'Asset';

  if (input.purpose === 'horoscope_sign') {
    const period = input.periodScope === 'any' ? 'daily' : input.periodScope;
    const signPart = input.signSlug ? ` ${input.signSlug}` : '';
    return `Horoskop${signPart} ${period} - ${safeDisplayName}`.replace(/\s+/g, ' ').trim();
  }

  if (input.purpose === 'daily_card') {
    return `Karta dnia - ${safeDisplayName}`;
  }

  if (input.purpose === 'zodiac_profile') {
    const signPart = input.signSlug ? ` ${input.signSlug}` : '';
    return `Znak zodiaku${signPart} - ${safeDisplayName}`.replace(/\s+/g, ' ').trim();
  }

  if (input.purpose === 'blog_article') {
    return `Artykuł - ${safeDisplayName}`;
  }

  return `Grafika - ${safeDisplayName}`;
};

const purposeUsesSeedMediaSign = (purpose: SeedMediaPurpose): boolean =>
  purpose === 'horoscope_sign' || purpose === 'zodiac_profile';

const suggestSeedMediaMapping = (input: {
  fileName: string;
  existingAssetKeys: Set<string>;
}): SeedMediaMappingSuggestion => {
  const tokens = toSeedMediaTokens(input.fileName);
  const signSlug = detectSeedMediaSignSlug(tokens);
  const periodScope = detectSeedMediaPeriodScope(tokens);
  const purpose = detectSeedMediaPurpose(tokens, signSlug);
  const numericHints = extractSeedMediaNumericHints(tokens);
  const normalizedSignSlug = purposeUsesSeedMediaSign(purpose) ? signSlug : null;
  const assetKey = deriveSeedMediaAssetKey({
    purpose,
    signSlug: normalizedSignSlug,
    periodScope,
    numericHints,
    existingAssetKeys: input.existingAssetKeys,
  });

  input.existingAssetKeys.add(assetKey);

  const reasons: string[] = [];
  let confidence = 0.2;

  if (signSlug) {
    confidence += 0.25;
    reasons.push(`Wykryto znak po tokenie nazwy pliku: ${signSlug}`);
  }

  if (periodScope !== 'any') {
    confidence += 0.2;
    reasons.push(`Wykryto okres po tokenie nazwy pliku: ${periodScope}`);
  }

  if (purpose !== 'fallback_general') {
    confidence += 0.35;
    reasons.push(`Wykryto cel obrazu: ${purpose}`);
  } else {
    reasons.push('Brak jednoznacznych tokenów. Użyto fallback_general.');
  }

  if (numericHints.length > 0) {
    confidence += 0.1;
    reasons.push(`Wykryto numerację: ${numericHints[0]}`);
  }

  return {
    asset_key: assetKey,
    label: deriveSeedMediaLabel({
      fileName: input.fileName,
      purpose,
      signSlug: normalizedSignSlug,
      periodScope,
    }),
    purpose,
    sign_slug: normalizedSignSlug,
    period_scope: periodScope,
    keywords: deriveSeedMediaKeywords(tokens, signSlug),
    confidence: Math.max(0, Math.min(0.99, Number(confidence.toFixed(2)))),
    reasons,
  };
};

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

const asMediaAssetArray = (value: unknown): MediaAssetRecord[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is MediaAssetRecord =>
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

const extractFileNameForMapping = (
  file: UploadFileRecord,
): string | null => {
  const name = file.name?.trim();

  if (name) {
    return name;
  }

  const hash = file.hash?.trim();

  if (hash && IMAGE_FILE_EXTENSION_PATTERN.test(hash)) {
    return hash;
  }

  const urlPath = file.url?.split(/[?#]/)[0]?.trim();

  if (!urlPath) {
    return null;
  }

  const fileName = path.basename(urlPath);
  return fileName.length > 0 ? fileName : null;
};

const isImageUploadFile = (file: UploadFileRecord): boolean => {
  if (file.mime?.startsWith('image/')) {
    return true;
  }

  const fileName = extractFileNameForMapping(file);
  return fileName ? IMAGE_FILE_EXTENSION_PATTERN.test(fileName) : false;
};

const shouldDiscoverUploadFile = (file: UploadFileRecord): boolean => {
  if (!isImageUploadFile(file)) {
    return false;
  }

  if (!isR2UploadEnabled()) {
    return true;
  }

  return file.provider === 'aws-s3';
};

const isDiscoverableContentPurpose = (
  purpose: SeedMediaPurpose,
): boolean => DISCOVERABLE_CONTENT_PURPOSES.has(purpose);

const getDiscoveredAssetPriority = (purpose: SeedMediaPurpose): number => {
  if (purpose === 'zodiac_profile') {
    return 30;
  }

  if (purpose === 'horoscope_sign') {
    return 20;
  }

  if (purpose === 'blog_article') {
    return 10;
  }

  return 0;
};

const normalizeText = (value: string | null | undefined): string =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .toLowerCase()
    .trim();

const keywordsContain = (keywords: unknown, token: string): boolean =>
  Array.isArray(keywords) &&
  keywords.some(
    (entry) => typeof entry === 'string' && normalizeText(entry) === token,
  );

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
  const purpose = asset.purpose ?? 'daily_card';
  const data = {
    asset_key: asset.assetKey,
    label: `Karta Dnia: ${asset.label}`,
    purpose,
    sign_slug: asset.signSlug ?? null,
    period_scope: asset.periodScope ?? 'daily',
    priority: asset.priority ?? 10,
    active: true,
    cooldown_days: 3,
    keywords: asset.keywords ?? ['daily', 'card', 'tarot', asset.cardSlug],
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

const ensureBlogPlaceholderMediaAsset = async (
  strapi: Core.Strapi,
  file: UploadFileRecord,
): Promise<BlogPlaceholderMediaAssetResult> => {
  const query = strapi.db.query('plugin::ai-content-orchestrator.media-asset');
  const existing = await query.findOne({
    where: { asset_key: BLOG_PLACEHOLDER_ASSET_KEY },
  });
  const currentAssetId = extractRelationId(existing?.asset);
  const data = {
    asset_key: BLOG_PLACEHOLDER_ASSET_KEY,
    label: BLOG_PLACEHOLDER_LABEL,
    purpose: 'blog_article' as SeedMediaPurpose,
    sign_slug: null,
    period_scope: 'any' as SeedMediaPeriodScope,
    priority: -100,
    active: true,
    cooldown_days: 0,
    keywords: BLOG_PLACEHOLDER_KEYWORDS,
    mapping_source: 'seed' as const,
    mapping_confidence: 1,
    mapping_reasons: ['Default blog placeholder seed media'],
    notes:
      'Domyślna miniatura dla seeded artykułów blogowych bez dedykowanego obrazu.',
    asset: file.id,
    use_count: typeof existing?.use_count === 'number' ? existing.use_count : 0,
    last_used_at: existing?.last_used_at || null,
  };

  if (existing?.id) {
    if (currentAssetId === file.id) {
      return { changed: false, previousFileId: null };
    }

    await query.update({
      where: { id: existing.id },
      data,
    });
    return { changed: true, previousFileId: currentAssetId };
  }

  await query.create({ data });
  return { changed: true, previousFileId: null };
};

const findLinkedMediaAssets = async (
  strapi: Core.Strapi,
  purposes: SeedMediaPurpose[],
): Promise<LinkedMediaAsset[]> => {
  const rows = asMediaAssetArray(
    await strapi.db
      .query('plugin::ai-content-orchestrator.media-asset')
      .findMany({
        where: { active: true },
        populate: ['asset'],
        limit: 1000,
      }),
  );
  const purposeSet = new Set(purposes);

  return rows
    .filter((row) => row.purpose && purposeSet.has(row.purpose))
    .map((mediaAsset) => {
      const file = extractUploadFile(mediaAsset.asset);
      return file ? { mediaAsset, file } : null;
    })
    .filter((item): item is LinkedMediaAsset => Boolean(item))
    .sort((left, right) => {
      const leftPriority =
        typeof left.mediaAsset.priority === 'number'
          ? left.mediaAsset.priority
          : 0;
      const rightPriority =
        typeof right.mediaAsset.priority === 'number'
          ? right.mediaAsset.priority
          : 0;

      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }

      return left.mediaAsset.id - right.mediaAsset.id;
    });
};

const ensureDiscoveredUploadMediaAssets = async (
  strapi: Core.Strapi,
): Promise<number> => {
  const uploadFiles = asRecordArray(
    await strapi.db.query('plugin::upload.file').findMany({
      limit: 1000,
    }),
  );

  if (uploadFiles.length === 0) {
    return 0;
  }

  const query = strapi.db.query('plugin::ai-content-orchestrator.media-asset');
  const existingAssets = asMediaAssetArray(
    await query.findMany({
      populate: ['asset'],
      limit: 1000,
    }),
  );
  const existingAssetKeys = new Set(
    existingAssets
      .map((asset) => asset.asset_key?.trim())
      .filter((assetKey): assetKey is string => Boolean(assetKey)),
  );
  const mappedUploadFileIds = new Set(
    existingAssets
      .map((asset) => extractRelationId(asset.asset))
      .filter((id): id is number => typeof id === 'number'),
  );
  let created = 0;

  for (const file of uploadFiles) {
    if (mappedUploadFileIds.has(file.id) || !shouldDiscoverUploadFile(file)) {
      continue;
    }

    const fileName = extractFileNameForMapping(file);

    if (!fileName) {
      continue;
    }

    if (isBlogPlaceholderFileName(fileName)) {
      continue;
    }

    const suggestion = suggestSeedMediaMapping({
      fileName,
      existingAssetKeys,
    });

    if (!isDiscoverableContentPurpose(suggestion.purpose)) {
      continue;
    }

    await query.create({
      data: {
        asset_key: suggestion.asset_key,
        label: suggestion.label,
        purpose: suggestion.purpose,
        sign_slug: suggestion.sign_slug,
        period_scope: suggestion.period_scope,
        priority: getDiscoveredAssetPriority(suggestion.purpose),
        active: true,
        cooldown_days: 3,
        keywords: suggestion.keywords,
        mapping_source: 'seed',
        mapping_confidence: suggestion.confidence,
        mapping_reasons: [
          ...suggestion.reasons,
          'Istniejący plik Media Library rozpoznany podczas seedowania.',
        ],
        notes:
          'Istniejący upload zmapowany automatycznie przez bootstrap seed media.',
        asset: file.id,
        use_count: 0,
        last_used_at: null,
      },
    });
    mappedUploadFileIds.add(file.id);
    created += 1;
  }

  return created;
};

const matchesSign = (
  entry: LinkedMediaAsset,
  sign: ZodiacSignRecord,
): boolean => {
  const signSlug = normalizeText(sign.slug);
  const signName = normalizeText(sign.name);
  const assetKey = normalizeText(entry.mediaAsset.asset_key);
  const label = normalizeText(entry.mediaAsset.label);
  const fileName = normalizeText(entry.file.name);

  if (!signSlug) {
    return false;
  }

  if (normalizeText(entry.mediaAsset.sign_slug) === signSlug) {
    return true;
  }

  return (
    keywordsContain(entry.mediaAsset.keywords, signSlug) ||
    assetKey.includes(signSlug) ||
    label.includes(signSlug) ||
    fileName.includes(signSlug) ||
    (signName.length > 0 &&
      (label.includes(signName) || fileName.includes(signName)))
  );
};

const pickZodiacAsset = (
  candidates: LinkedMediaAsset[],
  sign: ZodiacSignRecord,
): LinkedMediaAsset | null => {
  const exactProfile = candidates.find(
    (entry) =>
      entry.mediaAsset.purpose === 'zodiac_profile' && matchesSign(entry, sign),
  );

  if (exactProfile) {
    return exactProfile;
  }

  return (
    candidates.find(
      (entry) =>
        entry.mediaAsset.purpose === 'horoscope_sign' &&
        matchesSign(entry, sign),
    ) ?? null
  );
};

const ensureZodiacSignImages = async (
  strapi: Core.Strapi,
): Promise<number> => {
  const candidates = await findLinkedMediaAssets(strapi, [
    'zodiac_profile',
    'horoscope_sign',
  ]);

  if (candidates.length === 0) {
    return 0;
  }

  const query = strapi.db.query('api::zodiac-sign.zodiac-sign');
  const signs = (await query.findMany({
    populate: ['image'],
    limit: 100,
  })) as ZodiacSignRecord[];
  let linked = 0;

  for (const sign of signs) {
    const candidate = pickZodiacAsset(candidates, sign);

    if (!candidate || !shouldLinkMedia(sign.image, candidate.file)) {
      continue;
    }

    await query.update({
      where: { id: sign.id },
      data: { image: candidate.file.id },
    });
    linked += 1;
  }

  return linked;
};

const scoreArticleAsset = (
  entry: LinkedMediaAsset,
  article: ArticleRecord,
): number => {
  const source = [
    article.title,
    article.slug,
    article.category?.name,
  ]
    .map((value) => normalizeText(value))
    .join(' ');
  const keywords = Array.isArray(entry.mediaAsset.keywords)
    ? entry.mediaAsset.keywords.filter(
        (item): item is string => typeof item === 'string',
      )
    : [];
  const label = normalizeText(entry.mediaAsset.label);
  const assetKey = normalizeText(entry.mediaAsset.asset_key);

  let score = 0;

  for (const keyword of keywords) {
    const normalized = normalizeText(keyword);

    if (normalized.length > 2 && source.includes(normalized)) {
      score += 4;
    }
  }

  if (article.category?.name) {
    const category = normalizeText(article.category.name);
    if (label.includes(category) || assetKey.includes(category)) {
      score += 8;
    }
  }

  return score;
};

const isBlogPlaceholderAsset = (entry: LinkedMediaAsset): boolean =>
  entry.mediaAsset.asset_key === BLOG_PLACEHOLDER_ASSET_KEY ||
  keywordsContain(entry.mediaAsset.keywords, 'placeholder') ||
  keywordsContain(entry.mediaAsset.keywords, 'fallback');

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

const pickArticleAsset = (
  candidates: LinkedMediaAsset[],
  article: ArticleRecord,
  index: number,
): LinkedMediaAsset | null => {
  if (candidates.length === 0) {
    return null;
  }

  const fallback =
    candidates.find(
      (candidate) =>
        candidate.mediaAsset.asset_key === BLOG_PLACEHOLDER_ASSET_KEY,
    ) ??
    candidates.find(isBlogPlaceholderAsset) ??
    null;
  const preferredCandidates = candidates.filter(
    (candidate) => !isBlogPlaceholderAsset(candidate),
  );

  if (preferredCandidates.length === 0) {
    return fallback;
  }

  const scored = preferredCandidates
    .map((candidate) => ({
      candidate,
      score: scoreArticleAsset(candidate, article),
    }))
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      const leftPriority =
        typeof left.candidate.mediaAsset.priority === 'number'
          ? left.candidate.mediaAsset.priority
          : 0;
      const rightPriority =
        typeof right.candidate.mediaAsset.priority === 'number'
          ? right.candidate.mediaAsset.priority
          : 0;

      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }

      return left.candidate.mediaAsset.id - right.candidate.mediaAsset.id;
    });

  return scored[0]?.score > 0
    ? scored[0].candidate
    : preferredCandidates[index % preferredCandidates.length];
};

const ensureArticleImages = async (
  strapi: Core.Strapi,
  articleSlugs: string[],
  knownPlaceholderFileIds: ReadonlySet<number> = new Set(),
): Promise<number> => {
  if (articleSlugs.length === 0) {
    return 0;
  }

  const candidates = await findLinkedMediaAssets(strapi, ['blog_article']);

  if (candidates.length === 0) {
    return 0;
  }

  const placeholderFileIds = new Set([
    ...knownPlaceholderFileIds,
    ...candidates
      .filter(isBlogPlaceholderAsset)
      .map((candidate) => candidate.file.id),
  ]);

  const query = strapi.db.query('api::article.article');
  const articles = (await query.findMany({
    where: { slug: { $in: articleSlugs } },
    populate: ['category', 'image'],
    limit: Math.max(articleSlugs.length, 1),
  })) as ArticleRecord[];
  const bySlug = new Map(
    articles
      .filter((article) => article.slug)
      .map((article) => [String(article.slug), article]),
  );
  let linked = 0;

  for (const [index, slug] of articleSlugs.entries()) {
    const article = bySlug.get(slug);

    if (!article) {
      continue;
    }

    const candidate = pickArticleAsset(candidates, article, index);
    const currentImageId = extractRelationId(article.image);
    const currentIsPlaceholder =
      (typeof currentImageId === 'number' &&
        placeholderFileIds.has(currentImageId)) ||
      isBlogPlaceholderUpload(article.image);

    if (
      !candidate ||
      (!currentIsPlaceholder && !shouldLinkMedia(article.image, candidate.file))
    ) {
      continue;
    }

    if (currentImageId === candidate.file.id) {
      continue;
    }

    await query.update({
      where: { id: article.id },
      data: { image: candidate.file.id },
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
    mediaAssets: 0,
    zodiacLinked: 0,
    articleLinked: 0,
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
      const placeholderAsset = await ensureBlogPlaceholderMediaAsset(
        strapi,
        placeholder.file,
      );

      if (placeholderAsset.previousFileId) {
        knownPlaceholderFileIds.add(placeholderAsset.previousFileId);
      }

      if (placeholderAsset.changed) {
        result.mediaAssets += 1;
      }
    } else {
      result.missingFiles.push(BLOG_PLACEHOLDER_FILE_NAME);
    }

    result.mediaAssets += await ensureDiscoveredUploadMediaAssets(strapi);
    result.zodiacLinked = await ensureZodiacSignImages(strapi);
    result.articleLinked = await ensureArticleImages(
      strapi,
      options.articleSlugs ?? [],
      knownPlaceholderFileIds,
    );

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
    result.mediaAssets > 0 ||
    result.zodiacLinked > 0 ||
    result.articleLinked > 0
  ) {
    strapi.log.info(
      `[seed-media] Seed assets: uploaded=${result.uploaded}, tarotLinked=${result.linked}, mediaAssets=${result.mediaAssets}, zodiacLinked=${result.zodiacLinked}, articleLinked=${result.articleLinked}`,
    );
  }

  return result;
};
