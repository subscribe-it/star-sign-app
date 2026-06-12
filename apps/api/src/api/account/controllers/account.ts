import {
  getAppSettings,
  getPremiumMode,
  isPaidPremiumEnabled,
} from '../../../utils/app-settings';

type SubscriptionStatus =
  | 'inactive'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid';
type SubscriptionPlan = 'monthly' | 'annual';
type ReadingType = 'horoscope' | 'tarot';

const PREMIUM_ACCESS_STATUSES = new Set<SubscriptionStatus>([
  'trialing',
  'active',
  'past_due',
]);
const WARSAW_TIMEZONE = 'Europe/Warsaw';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type ZodiacSignSlug =
  | 'baran'
  | 'byk'
  | 'bliznieta'
  | 'rak'
  | 'lew'
  | 'panna'
  | 'waga'
  | 'skorpion'
  | 'strzelec'
  | 'koziorozec'
  | 'wodnik'
  | 'ryby';

export const resolveZodiacSignSlugFromBirthDate = (
  birthDate: string | null,
): ZodiacSignSlug | null => {
  if (!birthDate) {
    return null;
  }

  const [year, month, day] = birthDate.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);

  if (
    !year ||
    !month ||
    !day ||
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return null;
  }

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'baran';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'byk';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
    return 'bliznieta';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'rak';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'lew';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'panna';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'waga';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
    return 'skorpion';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
    return 'strzelec';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
    return 'koziorozec';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'wodnik';
  return 'ryby';
};

const getWarsawDate = (date: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: WARSAW_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const shortenText = (value: string, limit = 280): string => {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}…`;
};

const toNullableString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const toBool = (value: unknown): boolean => value === true || value === 'true';

const toSubscriptionStatus = (value: unknown): SubscriptionStatus => {
  if (
    value === 'trialing' ||
    value === 'active' ||
    value === 'past_due' ||
    value === 'canceled' ||
    value === 'unpaid'
  ) {
    return value;
  }
  return 'inactive';
};

const toSubscriptionPlan = (value: unknown): SubscriptionPlan | null => {
  if (value === 'monthly' || value === 'annual') {
    return value;
  }
  return null;
};

const getPayload = (ctx: any): Record<string, unknown> => {
  const body = ctx.request.body || {};
  if (body.data && typeof body.data === 'object') {
    return body.data;
  }
  if (typeof body === 'object') {
    return body;
  }
  return {};
};

const hasPayloadKey = (
  payload: Record<string, unknown>,
  key: string,
): boolean => Object.prototype.hasOwnProperty.call(payload, key);

const resolveProfileZodiacSignSlug = (
  payload: Record<string, unknown>,
  birthDate: string | null,
  zodiacSignSlug: string | null,
): string | null => {
  if (birthDate) {
    return resolveZodiacSignSlugFromBirthDate(birthDate);
  }

  if (hasPayloadKey(payload, 'birthDate')) {
    return null;
  }

  return zodiacSignSlug;
};

const getUsersPermissionsJwtService = (): any => {
  try {
    return strapi.plugin('users-permissions').service('jwt');
  } catch {
    return null;
  }
};

const getAuthenticatedUser = async (ctx: any): Promise<any | null> => {
  if (ctx.state?.user?.id) {
    return ctx.state.user;
  }

  const authHeader =
    typeof ctx.request.header?.authorization === 'string'
      ? ctx.request.header.authorization
      : typeof ctx.get === 'function'
        ? ctx.get('authorization')
        : '';

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return null;
  }

  const jwtService = getUsersPermissionsJwtService();
  if (!jwtService?.verify) {
    return null;
  }

  try {
    const payload = await jwtService.verify(token);
    const userId = Number(payload?.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return null;
    }

    return strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
    });
  } catch {
    return null;
  }
};

const ensureUserProfile = async (userId: number): Promise<any> => {
  let profile = await strapi.db
    .query('api::user-profile.user-profile')
    .findOne({
      where: { user: userId },
      populate: { zodiac_sign: true },
    });

  if (profile) {
    return profile;
  }

  profile = await strapi.db.query('api::user-profile.user-profile').create({
    data: {
      user: userId,
      marketing_consent: false,
      subscription_status: 'inactive',
    },
    populate: { zodiac_sign: true },
  });

  return profile;
};

const getSubscriptionPayload = async (profile: any) => {
  const status = toSubscriptionStatus(profile?.subscription_status);
  const plan = toSubscriptionPlan(profile?.subscription_plan);
  const accessMode = await getPremiumMode();
  const isPremium = PREMIUM_ACCESS_STATUSES.has(status);

  return {
    status,
    plan,
    isPremium,
    hasPremiumAccess: accessMode === 'open' || isPremium,
    accessMode,
    trialEndsAt: profile?.trial_ends_at || null,
    currentPeriodEnd: profile?.current_period_end || null,
    cancelAtPeriodEnd: Boolean(profile?.cancel_at_period_end),
  };
};

const toProfilePayload = (user: any, profile: any) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  birthDate: profile?.birth_date || null,
  birthTime: profile?.birth_time || null,
  birthPlace: profile?.birth_place || null,
  marketingConsent: Boolean(profile?.marketing_consent),
  zodiacSign: profile?.zodiac_sign
    ? {
        id: profile.zodiac_sign.id,
        documentId: profile.zodiac_sign.documentId,
        name: profile.zodiac_sign.name,
        slug: profile.zodiac_sign.slug,
      }
    : null,
});

const composePremiumHoroscope = (baseText: string, profile: any): string => {
  const birthTime = profile?.birth_time
    ? ` Około ${profile.birth_time} zaplanuj krótką pauzę na sprawdzenie intencji.`
    : '';
  const birthPlace = profile?.birth_place
    ? ` Miejsce ${profile.birth_place} potraktuj jako symbol korzeni, do których możesz wrócić po spokój.`
    : '';

  return `Relacje: dzisiejszy horoskop warto przełożyć na jedną konkretną rozmowę. Sprawdź, gdzie próbujesz być zrozumiana bez wypowiedzenia potrzeby wprost. Zamiast czekać na idealny moment, wybierz krótkie zdanie, które pokazuje prawdę i nie oskarża. Jeżeli relacja jest napięta, zacznij od faktu, potem nazwij uczucie, a dopiero na końcu prośbę. To pozwala budować bliskość bez presji.

Praca: darmowa wskazówka dnia brzmi: ${baseText} W Premium zamieniamy ją w działanie. Wybierz jedno zadanie, które ma największy wpływ na Twój spokój albo poczucie sprawczości. Zapisz minimalny rezultat, jaki uznasz za wystarczający, i odetnij rozpraszacze na pierwszy blok pracy. Nie szukaj perfekcji. Szukaj zakończenia, które otworzy miejsce na kolejny świadomy krok.

Energia dnia: Twoja energia potrzebuje rytmu, a nie kolejnego impulsu. Zadbaj o wodę, prosty posiłek, kilka głębokich oddechów i krótką przerwę bez telefonu.${birthTime}${birthPlace} Jeśli poczujesz pośpiech, sprawdź ciało: barki, szczękę i dłonie. Tam najszybciej pojawia się sygnał, że działasz z napięcia zamiast z intuicji.

Rytuał: weź kartkę i zapisz trzy zdania. Pierwsze zaczyna się od "Dziś wybieram". Drugie od "Nie muszę już wzmacniać". Trzecie od "Mój najbliższy spokojny krok to". Po zapisaniu połóż dłoń na sercu i przez dziewięć oddechów wracaj do ostatniego zdania. Następnie wykonaj ten krok od razu, nawet jeśli zajmie tylko dwie minuty.

Pytanie refleksyjne: gdybym zaufała temu, co już wiem, zamiast czekać na stuprocentową pewność, jaki wybór byłby dziś najuczciwszy wobec mnie?`;
};

const composePremiumTarot = (baseText: string, profile: any): string => {
  const preface = profile?.zodiac_sign?.name
    ? `Dla znaku ${profile.zodiac_sign.name} ta karta sugeruje skupienie na jednym priorytecie i świadome domykanie rozpoczętych wątków.`
    : 'Ta karta zachęca do prostoty działań i spokojnego domykania otwartych tematów.';

  return `Relacje: ${preface} W relacjach karta dnia prosi, aby odróżnić intuicję od lęku. Jeżeli chcesz coś powiedzieć, zacznij od krótkiego komunikatu i nie dopisuj w myślach odpowiedzi drugiej osoby. Jeśli milczysz, sprawdź, czy robisz to z wyboru, czy z obawy przed reakcją. Największą wartością Premium jest tu praktyka spokojnego kontaktu, nie perfekcyjnej rozmowy.

Praca: podstawowe znaczenie karty brzmi: ${baseText} W wersji Premium przełóż je na jedno działanie. Wybierz zadanie, które najlepiej domyka energię dnia, i zrób je przed sprawami pobocznymi. Jeżeli karta pokazuje napięcie, nie forsuj tempa. Zapisz, co jest naprawdę pilne, co może poczekać i komu trzeba jasno odpowiedzieć.

Energia dnia: obserwuj, czy karta wzmacnia w Tobie ciekawość, opór czy potrzebę kontroli. Każda z tych reakcji jest wskazówką. Ciało może dziś potrzebować prostego rytmu: wody, oddechu, ruchu ramion i chwili ciszy. Zanim podejmiesz ważną decyzję, zrób trzy spokojne oddechy i nazwij emocję, która najmocniej prowadzi Twój wybór.

Rytuał: zapisz nazwę karty na środku kartki. Po lewej stronie dopisz, czego chcesz dziś nie powtarzać. Po prawej stronie dopisz zachowanie, które byłoby dojrzalszą odpowiedzią. Następnie wybierz jeden symbol karty i potraktuj go jak kotwicę na dzień: słowo, kolor, gest albo krótką intencję. Wróć do niej wieczorem.

Pytanie refleksyjne: jaka część mnie próbuje dziś działać z pośpiechu, a jaka część zna już prostszy, spokojniejszy krok?`;
};

const getDailyTarotDraw = async (): Promise<any | null> => {
  const today = getWarsawDate();

  let draw = await strapi.db
    .query('api::daily-tarot-draw.daily-tarot-draw')
    .findOne({
      where: { draw_date: today },
      populate: { card: true },
    });

  if (draw) {
    return draw;
  }

  const cards = await strapi.db.query('api::tarot-card.tarot-card').findMany({
    where: { publishedAt: { $notNull: true } },
  });

  if (!cards.length) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * cards.length);
  const selectedCard = cards[randomIndex];

  try {
    draw = await strapi.db
      .query('api::daily-tarot-draw.daily-tarot-draw')
      .create({
        data: {
          draw_date: today,
          card: selectedCard.id,
        },
        populate: { card: true },
      });
  } catch (error) {
    strapi.log.warn(
      'Wykryto równoległe tworzenie dzisiejszej karty tarota.',
      error,
    );
    draw = await strapi.db
      .query('api::daily-tarot-draw.daily-tarot-draw')
      .findOne({
        where: { draw_date: today },
        populate: { card: true },
      });
  }

  return draw;
};

const getLatestHoroscopeForSign = async (
  signId: number | null,
): Promise<any | null> => {
  if (!signId) {
    return null;
  }

  const items = await strapi.db.query('api::horoscope.horoscope').findMany({
    where: {
      period: 'Dzienny',
      zodiac_sign: signId,
      publishedAt: { $notNull: true },
    },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    limit: 1,
  });

  return items?.[0] || null;
};

const buildDailyPayload = async (profile: any) => {
  const subscription = await getSubscriptionPayload(profile);
  const hasPremiumAccess = subscription.hasPremiumAccess;
  const today = getWarsawDate();

  const sign = profile?.zodiac_sign || null;
  const horoscope = await getLatestHoroscopeForSign(sign?.id || null);
  const draw = await getDailyTarotDraw();

  const horoscopeContent =
    typeof horoscope?.content === 'string' && horoscope.content.trim().length
      ? horoscope.content.trim()
      : 'Dzisiejsza energia zachęca do spokoju i zauważenia małych sygnałów, które prowadzą Cię do dobrych decyzji.';

  const tarotBaseMessage =
    toNullableString(draw?.message) ||
    toNullableString(draw?.card?.meaning_upright) ||
    'Karta dnia podpowiada, aby działać cierpliwie i zostawić przestrzeń na intuicję.';

  const teaser = [
    sign?.name
      ? `Dziś szczególnie wspiera Cię energia znaku ${sign.name}.`
      : 'Dziś postaw na rytuał małych kroków.',
    'W darmowej wersji dostajesz skrócony wgląd i najważniejszą wskazówkę dnia.',
  ].join(' ');

  return {
    date: today,
    sign: sign
      ? {
          name: sign.name,
          slug: sign.slug,
        }
      : null,
    horoscope: {
      date: horoscope?.date || today,
      period: 'dzienny',
      teaser: shortenText(horoscopeContent, 320),
      premiumContent: hasPremiumAccess
        ? composePremiumHoroscope(horoscopeContent, profile)
        : null,
      isPremiumLocked: !hasPremiumAccess,
    },
    tarot: {
      cardName: draw?.card?.name || null,
      cardSlug: draw?.card?.slug || null,
      teaserMessage: shortenText(tarotBaseMessage, 220),
      premiumMessage: hasPremiumAccess
        ? composePremiumTarot(tarotBaseMessage, profile)
        : null,
      isPremiumLocked: !hasPremiumAccess,
    },
    teaser,
    disclaimer:
      'Treści astrologiczne i tarotowe mają charakter refleksyjno-rozrywkowy i nie stanowią porady medycznej, prawnej ani finansowej.',
  };
};

const formatReading = (reading: any) => ({
  id: reading.id,
  documentId: reading.documentId,
  readingType: reading.reading_type,
  title: reading.title,
  summary: reading.summary,
  content: reading.content || null,
  period: reading.period || null,
  signSlug: reading.sign_slug || null,
  readingDate: reading.reading_date || null,
  isPremium: Boolean(reading.is_premium),
  source: reading.source || null,
  createdAt: reading.createdAt,
});

const createStripeSubscriptionCheckoutSession = async (input: {
  secretKey: string;
  priceId: string;
  plan: SubscriptionPlan;
  userId: number;
  customerEmail: string;
  customerId?: string | null;
  frontendUrl: string;
  trialDays: number;
  allowPromotionCodes: boolean;
}): Promise<{ id: string; url: string; customerId: string | null }> => {
  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('line_items[0][price]', input.priceId);
  params.set('line_items[0][quantity]', '1');
  if (input.trialDays > 0) {
    params.set('subscription_data[trial_period_days]', String(input.trialDays));
  }
  params.set('client_reference_id', String(input.userId));
  params.set(
    'allow_promotion_codes',
    input.allowPromotionCodes ? 'true' : 'false',
  );
  params.set('metadata[userId]', String(input.userId));
  params.set('metadata[plan]', input.plan);
  params.set('subscription_data[metadata][userId]', String(input.userId));
  params.set('subscription_data[metadata][plan]', input.plan);
  params.set(
    'success_url',
    `${input.frontendUrl}/panel?subscription=success&plan=${input.plan}&session_id={CHECKOUT_SESSION_ID}`,
  );
  params.set('cancel_url', `${input.frontendUrl}/panel?subscription=cancel`);

  if (input.customerId) {
    params.set('customer', input.customerId);
  } else if (EMAIL_PATTERN.test(input.customerEmail)) {
    params.set('customer_email', input.customerEmail);
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const sessionId = typeof payload.id === 'string' ? payload.id : null;
  const sessionUrl = typeof payload.url === 'string' ? payload.url : null;
  const customerId =
    typeof payload.customer === 'string' ? payload.customer : null;

  if (!response.ok || !sessionId || !sessionUrl) {
    throw new Error(
      `Nie udało się utworzyć sesji subskrypcyjnej Stripe Checkout. Kod: ${response.status}`,
    );
  }

  return {
    id: sessionId,
    url: sessionUrl,
    customerId,
  };
};

const createStripeCustomerPortalSession = async (input: {
  secretKey: string;
  customerId: string;
  returnUrl: string;
}): Promise<string> => {
  const params = new URLSearchParams();
  params.set('customer', input.customerId);
  params.set('return_url', input.returnUrl);

  const response = await fetch(
    'https://api.stripe.com/v1/billing_portal/sessions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
  );

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const portalUrl = typeof payload.url === 'string' ? payload.url : null;
  if (!response.ok || !portalUrl) {
    throw new Error(
      `Nie udało się utworzyć sesji portalu klienta Stripe. Kod: ${response.status}`,
    );
  }
  return portalUrl;
};

const cancelStripeSubscription = async (input: {
  secretKey: string;
  subscriptionId: string;
}): Promise<void> => {
  const response = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(
      input.subscriptionId,
    )}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${input.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  // Stripe zwraca 404 dla subskrypcji już anulowanej/nieistniejącej — to bezpieczne,
  // bo billing i tak jest zatrzymany. Każdy inny błąd traktujemy jako twardy.
  if (!response.ok && response.status !== 404) {
    throw new Error(
      `Nie udało się anulować subskrypcji Stripe. Kod: ${response.status}`,
    );
  }

  void payload;
};

const saveReadingForType = async (input: {
  userId: number;
  readingType: ReadingType;
  daily: any;
  isPremium: boolean;
}) => {
  const today = input.daily?.date || getWarsawDate();

  const existing = await strapi.db
    .query('api::user-reading.user-reading')
    .findOne({
      where: {
        user: input.userId,
        reading_type: input.readingType,
        reading_date: today,
      },
      orderBy: [{ createdAt: 'desc' }],
    });

  if (existing) {
    return {
      saved: false,
      reading: formatReading(existing),
    };
  }

  if (input.readingType === 'horoscope') {
    const created = await strapi.db
      .query('api::user-reading.user-reading')
      .create({
        data: {
          user: input.userId,
          reading_type: 'horoscope',
          title: `Horoskop dnia ${today}`,
          summary: input.daily.horoscope.teaser,
          content: input.isPremium
            ? input.daily.horoscope.premiumContent
            : input.daily.horoscope.teaser,
          period: 'dzienny',
          sign_slug: input.daily.sign?.slug || null,
          reading_date: today,
          is_premium: input.isPremium,
          source: 'daily-ritual',
        },
      });

    return {
      saved: true,
      reading: formatReading(created),
    };
  }

  const created = await strapi.db
    .query('api::user-reading.user-reading')
    .create({
      data: {
        user: input.userId,
        reading_type: 'tarot',
        title: input.daily.tarot.cardName
          ? `Karta dnia: ${input.daily.tarot.cardName}`
          : `Tarot dnia ${today}`,
        summary: input.daily.tarot.teaserMessage,
        content: input.isPremium
          ? input.daily.tarot.premiumMessage
          : input.daily.tarot.teaserMessage,
        sign_slug: input.daily.sign?.slug || null,
        reading_date: today,
        is_premium: input.isPremium,
        source: 'daily-ritual',
        metadata: {
          cardSlug: input.daily.tarot.cardSlug,
        },
      },
    });

  return {
    saved: true,
    reading: formatReading(created),
  };
};

export default {
  async me(ctx: any) {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return ctx.unauthorized('Musisz się zalogować.');
    }

    const profile = await ensureUserProfile(user.id);
    ctx.body = {
      profile: toProfilePayload(user, profile),
      subscription: await getSubscriptionPayload(profile),
    };
  },

  async updateProfile(ctx: any) {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return ctx.unauthorized('Musisz się zalogować.');
    }

    const payload = getPayload(ctx);
    const zodiacSignSlug = toNullableString(payload.zodiacSignSlug);
    const birthDate = toNullableString(payload.birthDate);
    const birthTime = toNullableString(payload.birthTime);
    const birthPlace = toNullableString(payload.birthPlace);
    const marketingConsent = toBool(payload.marketingConsent);

    const profile = await ensureUserProfile(user.id);

    let zodiacSignId: number | null = null;
    const resolvedZodiacSignSlug = resolveProfileZodiacSignSlug(
      payload,
      birthDate,
      zodiacSignSlug,
    );

    if (resolvedZodiacSignSlug) {
      const sign = await strapi.db
        .query('api::zodiac-sign.zodiac-sign')
        .findOne({
          where: { slug: resolvedZodiacSignSlug },
        });
      if (!sign) {
        return ctx.badRequest('Nie znaleziono wskazanego znaku zodiaku.');
      }
      zodiacSignId = sign.id;
    }

    const updated = await strapi.db
      .query('api::user-profile.user-profile')
      .update({
        where: { id: profile.id },
        data: {
          birth_date: birthDate,
          birth_time: birthTime,
          birth_place: birthPlace,
          marketing_consent: marketingConsent,
          zodiac_sign: zodiacSignId,
        },
        populate: { zodiac_sign: true },
      });

    ctx.body = {
      profile: toProfilePayload(user, updated),
      subscription: await getSubscriptionPayload(updated),
    };
  },

  async dashboard(ctx: any) {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return ctx.unauthorized('Musisz się zalogować.');
    }

    const profile = await ensureUserProfile(user.id);
    const daily = await buildDailyPayload(profile);

    ctx.body = {
      profile: toProfilePayload(user, profile),
      subscription: await getSubscriptionPayload(profile),
      daily,
    };
  },

  async readings(ctx: any) {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return ctx.unauthorized('Musisz się zalogować.');
    }

    const limitRaw = Number(ctx.query?.limit);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20;

    const items = await strapi.db
      .query('api::user-reading.user-reading')
      .findMany({
        where: { user: user.id },
        orderBy: [{ reading_date: 'desc' }, { createdAt: 'desc' }],
        limit,
      });

    ctx.body = {
      data: items.map(formatReading),
    };
  },

  async saveTodayReading(ctx: any) {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return ctx.unauthorized('Musisz się zalogować.');
    }

    const payload = getPayload(ctx);
    const readingType = payload.readingType === 'tarot' ? 'tarot' : 'horoscope';

    const profile = await ensureUserProfile(user.id);
    const subscription = await getSubscriptionPayload(profile);
    const daily = await buildDailyPayload(profile);

    const result = await saveReadingForType({
      userId: user.id,
      readingType,
      daily,
      isPremium: subscription.hasPremiumAccess,
    });

    ctx.body = result;
  },

  async subscriptionCheckout(ctx: any) {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return ctx.unauthorized('Musisz się zalogować.');
    }

    const payload = getPayload(ctx);
    const plan = payload.plan === 'annual' ? 'annual' : 'monthly';

    const settings = await getAppSettings();
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const monthlyPriceId =
      settings.stripeMonthlyPriceId ||
      process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID;
    const annualPriceId =
      settings.stripeAnnualPriceId ||
      process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

    if (
      !isPaidPremiumEnabled(settings) ||
      !stripeSecretKey ||
      !monthlyPriceId ||
      !annualPriceId
    ) {
      ctx.status = 503;
      ctx.body = { error: 'Subskrypcje nie są jeszcze skonfigurowane.' };
      return;
    }

    const profile = await ensureUserProfile(user.id);
    const priceId = plan === 'annual' ? annualPriceId : monthlyPriceId;

    try {
      const session = await createStripeSubscriptionCheckoutSession({
        secretKey: stripeSecretKey,
        plan,
        priceId,
        userId: user.id,
        customerEmail: user.email || '',
        customerId: toNullableString(profile?.stripe_customer_id),
        frontendUrl,
        trialDays: settings.trialDays,
        allowPromotionCodes: settings.allowPromotionCodes,
      });

      const patch: Record<string, unknown> = {};
      if (session.customerId && !profile?.stripe_customer_id) {
        patch.stripe_customer_id = session.customerId;
      }
      patch.subscription_plan = plan;

      await strapi.db.query('api::user-profile.user-profile').update({
        where: { id: profile.id },
        data: patch,
      });

      ctx.body = {
        checkoutUrl: session.url,
        sessionId: session.id,
      };
    } catch (error) {
      strapi.log.error(
        'Nie udało się zainicjalizować sesji subskrypcji Stripe Checkout.',
        error,
      );
      ctx.status = 502;
      ctx.body = { error: 'Nie udało się zainicjalizować subskrypcji.' };
    }
  },

  async subscriptionPortal(ctx: any) {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return ctx.unauthorized('Musisz się zalogować.');
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      ctx.status = 503;
      ctx.body = {
        error: 'Panel subskrypcji nie jest jeszcze skonfigurowany.',
      };
      return;
    }

    const profile = await ensureUserProfile(user.id);
    const customerId = toNullableString(profile?.stripe_customer_id);
    if (!customerId) {
      return ctx.badRequest('Brak aktywnego klienta Stripe dla tego konta.');
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

    try {
      const url = await createStripeCustomerPortalSession({
        secretKey: stripeSecretKey,
        customerId,
        returnUrl: `${frontendUrl}/panel/subskrypcja`,
      });

      ctx.body = { url };
    } catch (error) {
      strapi.log.error(
        'Nie udało się utworzyć sesji panelu klienta Stripe.',
        error,
      );
      ctx.status = 502;
      ctx.body = { error: 'Nie udało się otworzyć panelu subskrypcji.' };
    }
  },

  async deleteAccount(ctx: any) {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return ctx.unauthorized('Musisz się zalogować.');
    }

    const payload = getPayload(ctx);
    if (payload.confirmation !== 'USUWAM KONTO') {
      return ctx.badRequest(
        'Aby usunąć konto, wyślij potwierdzenie: { "confirmation": "USUWAM KONTO" }.',
      );
    }

    const userId = user.id;
    const email = typeof user.email === 'string' ? user.email : null;

    // Najpierw odczytaj profil, aby poznać identyfikatory Stripe ZANIM go usuniemy.
    const profile = await strapi.db
      .query('api::user-profile.user-profile')
      .findOne({ where: { user: userId } });

    const subscriptionId = toNullableString(profile?.stripe_subscription_id);
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    // KROK 1 (zewnętrzny, nieodwracalny): anuluj aktywną subskrypcję Stripe,
    // żeby po usunięciu konta nie było dalszych obciążeń. Fail closed: jeśli
    // anulowanie się nie powiedzie, NIE usuwamy danych lokalnych.
    if (subscriptionId && stripeSecretKey) {
      try {
        await cancelStripeSubscription({
          secretKey: stripeSecretKey,
          subscriptionId,
        });
      } catch (error) {
        strapi.log.error(
          `Nie udało się anulować subskrypcji Stripe przy usuwaniu konta ${userId}.`,
          error,
        );
        ctx.status = 502;
        ctx.body = {
          error:
            'Nie udało się anulować subskrypcji w Stripe. Konto nie zostało usunięte. Spróbuj ponownie później.',
        };
        return;
      }
    }

    // KROK 2 (lokalny, transakcyjny): usunięcie danych w jednej transakcji,
    // aby częściowy błąd nie zostawił niespójnego stanu.
    try {
      await strapi.db.transaction(async () => {
        await strapi.db
          .query('api::user-reading.user-reading')
          .deleteMany({ where: { user: userId } });

        await strapi.db
          .query('api::user-profile.user-profile')
          .deleteMany({ where: { user: userId } });

        // Zdarzenia analityczne zostają (statystyki), ale bez powiązania z osobą.
        const analyticsEvents = await strapi.db
          .query('api::analytics-event.analytics-event')
          .findMany({ where: { user: userId }, select: ['id'] });
        for (const event of analyticsEvents) {
          await strapi.db
            .query('api::analytics-event.analytics-event')
            .update({ where: { id: event.id }, data: { user: null } });
        }

        if (email) {
          await strapi.db
            .query('api::newsletter-subscription.newsletter-subscription')
            .deleteMany({ where: { email } });
        }

        // Zamówienia pozostają bez zmian — obowiązek przechowywania dokumentów
        // rozliczeniowych (podstawa prawna niezależna od zgody użytkownika).

        await strapi.db
          .query('plugin::users-permissions.user')
          .delete({ where: { id: userId } });
      });

      strapi.log.info(`Konto użytkownika ${userId} usunięte na żądanie (RODO).`);
      ctx.body = { deleted: true };
    } catch (error) {
      strapi.log.error(`Nie udało się usunąć konta użytkownika ${userId}.`, error);
      ctx.status = 500;
      ctx.body = { error: 'Nie udało się usunąć konta. Spróbuj ponownie.' };
    }
  },
};
