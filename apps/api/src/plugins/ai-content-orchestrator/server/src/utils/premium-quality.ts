export type PremiumContentKind =
  | 'horoscope-daily'
  | 'horoscope-periodic'
  | 'article'
  | 'tarot'
  | 'panel'
  | 'generic';

export type PremiumContentQualityInput = {
  content?: unknown;
  premiumContent?: unknown;
  kind?: PremiumContentKind;
  label?: string;
};

export const PREMIUM_CONTENT_RETRY_MAX = 5;

const REQUIRED_PREMIUM_SECTIONS = [
  'Relacje',
  'Praca',
  'Energia dnia',
  'Rytuał',
  'Pytanie refleksyjne',
] as const;

const MINIMUM_PREMIUM_WORDS: Record<PremiumContentKind, number> = {
  'horoscope-daily': 180,
  'horoscope-periodic': 300,
  article: 350,
  tarot: 180,
  panel: 180,
  generic: 180,
};

const toText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const stripMarkup = (value: unknown): string =>
  toText(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[`*_>#\-[\](){}|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const countWords = (value: unknown): number => {
  const text = stripMarkup(value);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
};

const normalizeForComparison = (value: unknown): string =>
  stripMarkup(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ąćęłńóśźż]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const hasRequiredSections = (premiumContent: unknown): boolean => {
  const normalized = normalizeForComparison(premiumContent);
  return REQUIRED_PREMIUM_SECTIONS.every((section) =>
    normalized.includes(normalizeForComparison(section))
  );
};

const isCopyOfFreeContent = (content: unknown, premiumContent: unknown): boolean => {
  const normalizedContent = normalizeForComparison(content);
  const normalizedPremium = normalizeForComparison(premiumContent);

  if (!normalizedContent || !normalizedPremium) {
    return false;
  }

  if (normalizedContent === normalizedPremium) {
    return true;
  }

  return normalizedContent.length > 80 && normalizedPremium.includes(normalizedContent);
};

export const evaluatePremiumContentQuality = (input: PremiumContentQualityInput) => {
  const kind = input.kind ?? 'generic';
  const contentWords = countWords(input.content);
  const premiumWords = countWords(input.premiumContent);
  const minimumWords = Math.max(contentWords, MINIMUM_PREMIUM_WORDS[kind]);
  const issues: string[] = [];

  if (!toText(input.premiumContent)) {
    issues.push('missing_premium_content');
  }

  if (premiumWords < minimumWords) {
    issues.push(`premium_too_short:${premiumWords}/${minimumWords}`);
  }

  if (!hasRequiredSections(input.premiumContent)) {
    issues.push('missing_required_sections');
  }

  if (isCopyOfFreeContent(input.content, input.premiumContent)) {
    issues.push('premium_copies_free_content');
  }

  return {
    valid: issues.length === 0,
    issues,
    contentWords,
    premiumWords,
    minimumWords,
  };
};

export const assertPremiumContentQuality = (input: PremiumContentQualityInput): void => {
  const result = evaluatePremiumContentQuality(input);

  if (!result.valid) {
    const label = input.label ? `${input.label}: ` : '';
    throw new Error(`${label}quality_failed premiumContent (${result.issues.join(', ')})`);
  }
};

// Sygnały, że treść niesie ze sobą zgodny z prawem disclaimer (charakter
// rozrywkowy/inspiracyjny, brak porady medycznej/prawnej/finansowej). Sprawdzamy
// w formie miękkiej (warn), bez wymuszania konkretnego brzmienia — żeby nie
// blokować generacji, a jedynie wykryć brak ducha disclaimera.
const DISCLAIMER_SPIRIT_PATTERNS: RegExp[] = [
  /nie\s+zast[ęe]puj[ąa]?\s+porad/i,
  /charakter\s+(inspiracyjn|rozrywkow|edukacyjn)/i,
  /(w\s+celach|dla\s+)?\s*rozrywk/i,
  /nie\s+stanowi\s+porad/i,
];

// True, gdy w przekazanym tekście widać ducha disclaimera. Łączy content i
// (opcjonalnie) premiumContent w jeden korpus, bo disclaimer może wystąpić w
// dowolnym z widocznych pól.
export const hasAstrologyDisclaimer = (input: {
  content?: unknown;
  premiumContent?: unknown;
}): boolean => {
  const corpus = `${toText(input.content)}\n${toText(input.premiumContent)}`;
  if (!corpus.trim()) {
    return false;
  }
  return DISCLAIMER_SPIRIT_PATTERNS.some((pattern) => pattern.test(corpus));
};
