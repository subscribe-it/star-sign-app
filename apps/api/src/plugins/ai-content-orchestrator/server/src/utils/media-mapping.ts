import { slugify } from './slug';

type MediaPurpose =
  | 'horoscope_sign'
  | 'daily_card'
  | 'blog_article'
  | 'zodiac_profile'
  | 'fallback_general';
type MediaPeriodScope = 'any' | 'daily' | 'weekly' | 'monthly';

type MediaMappingSuggestion = {
  asset_key: string;
  label: string;
  purpose: MediaPurpose;
  sign_slug: string | null;
  period_scope: MediaPeriodScope;
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

const STOPWORDS = new Set([
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

const pad2 = (value: number): string => String(value).padStart(2, '0');

const stripExtension = (fileName: string): string => fileName.replace(/\.[a-z0-9]+$/i, '');

const purposeUsesSign = (purpose: MediaPurpose): boolean =>
  purpose === 'horoscope_sign' || purpose === 'zodiac_profile';

export const toTokens = (fileName: string): string[] => {
  const normalized = slugify(stripExtension(fileName)).replace(/-/g, '_');
  return normalized
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);
};

const detectSignSlug = (tokens: string[]): string | null => {
  for (const token of tokens) {
    if (SIGN_TOKEN_TO_PL_SLUG[token]) {
      return SIGN_TOKEN_TO_PL_SLUG[token];
    }
  }

  return null;
};

const detectPeriodScope = (tokens: string[]): MediaPeriodScope => {
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

const detectPurpose = (tokens: string[], signSlug: string | null): MediaPurpose => {
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

  if (signSlug && tokens.includes('tarot')) {
    return 'horoscope_sign';
  }

  if (tokens.includes('card') || tokens.includes('karta') || tokens.includes('tarot')) {
    return 'daily_card';
  }

  if (tokens.includes('horoscope') || tokens.includes('horoskop') || signSlug) {
    return 'horoscope_sign';
  }

  return 'fallback_general';
};

const extractNumericHints = (tokens: string[]): number[] => {
  return tokens
    .map((token) => token.match(/\d+/g) ?? [])
    .flat()
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 9999);
};

const nextOrdinalForPrefix = (existingAssetKeys: Set<string>, prefix: string): number => {
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

const ensureUniqueAssetKey = (existingAssetKeys: Set<string>, candidate: string): string => {
  if (!existingAssetKeys.has(candidate)) {
    return candidate;
  }

  let suffix = 2;
  while (existingAssetKeys.has(`${candidate}-${suffix}`)) {
    suffix += 1;
  }

  return `${candidate}-${suffix}`;
};

const deriveAssetKey = (input: {
  purpose: MediaPurpose;
  signSlug: string | null;
  periodScope: MediaPeriodScope;
  numericHints: number[];
  existingAssetKeys: Set<string>;
}): string => {
  const { purpose, signSlug, periodScope, numericHints, existingAssetKeys } = input;

  const useHintOrNext = (prefix: string): string => {
    const hinted = numericHints.find((item) => item > 0);
    const ordinal = hinted ?? nextOrdinalForPrefix(existingAssetKeys, prefix);
    return ensureUniqueAssetKey(existingAssetKeys, `${prefix}-${pad2(ordinal)}`);
  };

  if (purpose === 'blog_article') {
    return useHintOrNext('blog-astro');
  }

  if (purpose === 'daily_card') {
    return useHintOrNext('daily-card');
  }

  if (purpose === 'horoscope_sign' && signSlug) {
    const normalizedPeriod = periodScope === 'any' ? 'daily' : periodScope;
    return useHintOrNext(`horoscope-${signSlug}-${normalizedPeriod}`);
  }

  if (purpose === 'zodiac_profile' && signSlug) {
    return useHintOrNext(`zodiac-profile-${signSlug}`);
  }

  return useHintOrNext('fallback-general');
};

const deriveKeywords = (tokens: string[], signSlug: string | null): string[] => {
  const output = new Set<string>();

  for (const token of tokens) {
    if (STOPWORDS.has(token)) {
      continue;
    }

    if (/^\d+$/.test(token)) {
      continue;
    }

    if (token.length < 3) {
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

const toTitleCase = (value: string): string => {
  return value
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
};

const deriveLabel = (input: {
  fileName: string;
  purpose: MediaPurpose;
  signSlug: string | null;
  periodScope: MediaPeriodScope;
}): string => {
  const displayName = toTitleCase(
    stripExtension(input.fileName).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
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

type GenerateMediaAssetIdentityInput = {
  fileName: string;
  purpose: MediaPurpose;
  signSlug: string | null;
  periodScope: MediaPeriodScope;
  existingAssetKeys: Set<string>;
};

export const generateMediaAssetIdentity = (
  input: GenerateMediaAssetIdentityInput
): {
  asset_key: string;
  label: string;
} => {
  const tokens = toTokens(input.fileName);
  const numericHints = extractNumericHints(tokens);
  const normalizedSign = purposeUsesSign(input.purpose) ? input.signSlug : null;

  const assetKey = deriveAssetKey({
    purpose: input.purpose,
    signSlug: normalizedSign,
    periodScope: input.periodScope,
    numericHints,
    existingAssetKeys: input.existingAssetKeys,
  });

  input.existingAssetKeys.add(assetKey);

  return {
    asset_key: assetKey,
    label: deriveLabel({
      fileName: input.fileName,
      purpose: input.purpose,
      signSlug: normalizedSign,
      periodScope: input.periodScope,
    }),
  };
};

export const suggestMediaMapping = (input: {
  fileName: string;
  existingAssetKeys: Set<string>;
}): MediaMappingSuggestion => {
  const tokens = toTokens(input.fileName);
  const signSlug = detectSignSlug(tokens);
  const periodScope = detectPeriodScope(tokens);
  const purpose = detectPurpose(tokens, signSlug);
  const numericHints = extractNumericHints(tokens);
  const identity = generateMediaAssetIdentity({
    fileName: input.fileName,
    purpose,
    signSlug,
    periodScope,
    existingAssetKeys: input.existingAssetKeys,
  });

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

  const boundedConfidence = Math.max(0, Math.min(0.99, Number(confidence.toFixed(2))));

  return {
    asset_key: identity.asset_key,
    label: identity.label,
    purpose,
    sign_slug: purposeUsesSign(purpose) ? signSlug : null,
    period_scope: periodScope,
    keywords: deriveKeywords(tokens, signSlug),
    confidence: boundedConfidence,
    reasons,
  };
};

export type {
  GenerateMediaAssetIdentityInput,
  MediaMappingSuggestion,
  MediaPeriodScope,
  MediaPurpose,
};
