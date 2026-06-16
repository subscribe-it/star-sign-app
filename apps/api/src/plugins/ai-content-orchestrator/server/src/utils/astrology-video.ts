// Deterministic short-form (9:16) video script/storyboard builder for astrology
// content (zodiac, tarot, horoscope). Produces the structure that the video
// provider renders and that social tickets publish as Reels / Shorts / TikTok.
// Polish copy (operator + audience are Polish). No LLM dependency → cheap,
// deterministic and unit-testable; the actual video is rendered by the provider.

export type AstrologyVideoSubjectKind = 'zodiac' | 'tarot' | 'horoscope' | 'custom';

export type AstrologyVideoSubject = {
  kind: AstrologyVideoSubjectKind;
  title?: string;
  sign?: string;
  card?: string;
  period?: string;
  sourceText?: string;
};

export type VideoStoryboardScene = {
  index: number;
  startSeconds: number;
  durationSeconds: number;
  visual: string;
  voiceover: string;
};

export type AstrologyVideoScript = {
  title: string;
  subjectKind: AstrologyVideoSubjectKind;
  durationSeconds: number;
  script: string;
  storyboard: VideoStoryboardScene[];
  textOverlay: Array<{ atSeconds: number; text: string }>;
  subtitles: string;
  hashtags: string[];
  captionByPlatform: Record<'facebook' | 'instagram' | 'tiktok' | 'youtube_shorts', string>;
};

// Canonical Polish zodiac names keyed by common PL/EN aliases.
const ZODIAC_PL: Record<string, string> = {
  baran: 'Baran', aries: 'Baran',
  byk: 'Byk', taurus: 'Byk',
  bliznieta: 'Bliźnięta', 'bliźnięta': 'Bliźnięta', gemini: 'Bliźnięta',
  rak: 'Rak', cancer: 'Rak',
  lew: 'Lew', leo: 'Lew',
  panna: 'Panna', virgo: 'Panna',
  waga: 'Waga', libra: 'Waga',
  skorpion: 'Skorpion', scorpio: 'Skorpion',
  strzelec: 'Strzelec', sagittarius: 'Strzelec',
  koziorozec: 'Koziorożec', 'koziorożec': 'Koziorożec', capricorn: 'Koziorożec',
  wodnik: 'Wodnik', aquarius: 'Wodnik',
  ryby: 'Ryby', pisces: 'Ryby',
};

const ZODIAC_HASHTAG: Record<string, string> = {
  Baran: 'baran', Byk: 'byk', 'Bliźnięta': 'blizenta', Rak: 'rak', Lew: 'lew',
  Panna: 'panna', Waga: 'waga', Skorpion: 'skorpion', Strzelec: 'strzelec',
  'Koziorożec': 'koziorozec', Wodnik: 'wodnik', Ryby: 'ryby',
};

const normalizeSign = (value?: string): string | null => {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  return ZODIAC_PL[key] ?? (value.trim() ? value.trim() : null);
};

const clampDuration = (value: number | undefined): number =>
  Math.max(20, Math.min(45, Math.round(Number(value) || 30)));

const truncate = (text: string, max: number): string => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
};

const BASE_HASHTAGS = ['astrologia', 'horoskop', 'zodiak', 'tarot', 'znakizodiaku'];

const uniqueHashtags = (tags: string[]): string[] =>
  Array.from(new Set(tags.map((t) => t.replace(/[^a-z0-9]/gi, '').toLowerCase()).filter(Boolean)));

const buildScenes = (
  duration: number,
  hook: string,
  body: string,
  cta: string
): VideoStoryboardScene[] => {
  // Three beats: hook (≈20%), insight (≈55%), CTA (≈25%).
  const hookDur = Math.max(4, Math.round(duration * 0.2));
  const ctaDur = Math.max(4, Math.round(duration * 0.25));
  const bodyDur = Math.max(6, duration - hookDur - ctaDur);
  return [
    { index: 0, startSeconds: 0, durationSeconds: hookDur, visual: 'Kosmiczne tło, dynamiczne wejście tytułu', voiceover: hook },
    { index: 1, startSeconds: hookDur, durationSeconds: bodyDur, visual: 'Symbol znaku/karty, animowane gwiazdy, napisy', voiceover: body },
    { index: 2, startSeconds: hookDur + bodyDur, durationSeconds: ctaDur, visual: 'CTA, logo, zaproszenie do obserwacji', voiceover: cta },
  ];
};

export const buildAstrologyVideoScript = (
  subject: AstrologyVideoSubject,
  options: { durationSeconds?: number } = {}
): AstrologyVideoScript => {
  const duration = clampDuration(options.durationSeconds);
  const sign = normalizeSign(subject.sign);
  const source = (subject.sourceText ?? '').trim();

  let title: string;
  let hook: string;
  let body: string;
  let cta: string;
  const hashtags = [...BASE_HASHTAGS];

  if (subject.kind === 'zodiac' && sign) {
    title = subject.title?.trim() || `${sign} — co mówią gwiazdy`;
    hook = `${sign}! To musisz dziś wiedzieć ✨`;
    body = source || `Dziś energia sprzyja znakowi ${sign}. Zaufaj intuicji, postaw na to, co naprawdę ważne, i nie bój się zrobić pierwszego kroku.`;
    cta = `Jesteś spod znaku ${sign}? Zostaw ❤️ i obserwuj po więcej horoskopów!`;
    if (ZODIAC_HASHTAG[sign]) hashtags.push(ZODIAC_HASHTAG[sign]);
  } else if (subject.kind === 'tarot') {
    const card = subject.card?.trim() || 'Karta dnia';
    title = subject.title?.trim() || `Tarot: ${card}`;
    hook = `Karta dnia: ${card} 🔮`;
    body = source || `${card} przynosi dziś ważny przekaz. Wsłuchaj się w siebie — odpowiedź, której szukasz, jest bliżej niż myślisz.`;
    cta = 'Chcesz swoją kartę na jutro? Obserwuj i napisz w komentarzu swój znak!';
    hashtags.push('kartadnia', 'tarotpolska');
  } else if (subject.kind === 'horoscope') {
    const period = subject.period?.trim() || 'Dzienny';
    title = subject.title?.trim() || `Horoskop ${period}${sign ? ` — ${sign}` : ''}`;
    hook = `Horoskop ${period.toLowerCase()}${sign ? ` dla znaku ${sign}` : ''} 🌙`;
    body = source || `Sprawdź, co przygotowały dla Ciebie gwiazdy${sign ? ` w znaku ${sign}` : ''}. Dziś warto zwolnić i zaufać przeczuciom.`;
    cta = 'Obserwuj po codzienny horoskop i podaj dalej osobie, która musi to usłyszeć!';
    if (sign && ZODIAC_HASHTAG[sign]) hashtags.push(ZODIAC_HASHTAG[sign]);
    hashtags.push('horoskopdzienny');
  } else {
    title = subject.title?.trim() || 'Astrologia na dziś';
    hook = 'Gwiazdy mają dziś dla Ciebie wiadomość ✨';
    body = source || 'Zatrzymaj się na chwilę i poczuj energię dnia. To dobry moment na świadomą decyzję.';
    cta = 'Obserwuj po więcej astrologicznych inspiracji!';
  }

  const storyboard = buildScenes(duration, hook, body, cta);
  const script = `${hook}\n\n${body}\n\n${cta}`;
  const textOverlay = storyboard.map((scene) => ({
    atSeconds: scene.startSeconds,
    text: truncate(scene.voiceover, 60),
  }));
  const tags = uniqueHashtags(hashtags);
  const hashtagLine = tags.map((t) => `#${t}`).join(' ');

  const captionBase = `${title}\n\n${truncate(body, 180)}`;
  const captionByPlatform = {
    facebook: `${captionBase}\n\n${hashtagLine}`,
    instagram: `${truncate(body, 150)} ✨\n\n${hashtagLine}`,
    tiktok: `${truncate(hook, 80)} ${hashtagLine}`,
    youtube_shorts: `${title} #shorts ${hashtagLine}`,
  };

  return {
    title,
    subjectKind: subject.kind,
    durationSeconds: duration,
    script,
    storyboard,
    textOverlay,
    subtitles: script,
    hashtags: tags,
    captionByPlatform,
  };
};
