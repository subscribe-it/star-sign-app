import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import {
  STATIC_SITEMAP_PATHS,
  articlesToEntries,
  buildSitemapXml,
  mergeSitemapEntries,
  normalizeOrigin,
  productsToEntries,
  zodiacSignsToEntries,
  type SitemapEntry,
} from './sitemap';

const browserDistFolder = join(import.meta.dirname, '../browser');
/**
 * Canonical production origin used for absolute <loc> values in sitemap.xml.
 * Prefer an explicit env var; fall back to the production domain.
 */
const sitemapOrigin = normalizeOrigin(
  process.env['PRODUCTION_DOMAIN'] ||
    process.env['FRONTEND_DOMAIN'] ||
    'star-sign.pl',
);
const strapiApiUrl = process.env['API_URL'] || 'http://localhost:1337/api';
const strapiApiBaseUrl = strapiApiUrl.endsWith('/')
  ? strapiApiUrl.slice(0, -1)
  : strapiApiUrl;
const useE2eMockApi = process.env['E2E_MOCK_API'] === 'true';
const e2eApiLogEnabled = process.env['E2E_MOCK_API_LOG'] === 'true';
const shopEnabled =
  process.env['SHOP_ENABLED'] === 'true' ||
  process.env['FRONTEND_SHOP_ENABLED'] === 'true';
const turnstileSiteKey = process.env['TURNSTILE_SITE_KEY'] || '';
const turnstileEnabled =
  process.env['TURNSTILE_ENABLED'] === 'true' && turnstileSiteKey.length > 0;
const ga4MeasurementId = process.env['GA4_MEASUREMENT_ID'] || '';
const gtmContainerId = process.env['GTM_CONTAINER_ID'] || '';
const frontendSentryDsn = process.env['FRONTEND_SENTRY_DSN'] || '';
const sentryEnvironment =
  process.env['SENTRY_ENVIRONMENT'] || process.env['NODE_ENV'] || 'production';
const sentryRelease = process.env['SENTRY_RELEASE'] || '';
const sentryTracesSampleRate = Number(
  process.env['SENTRY_TRACES_SAMPLE_RATE'] || '0',
);

const app = express();
const angularApp = new AngularNodeAppEngine();

type StrapiCollectionResponse<T> = {
  data: T[];
  meta?: {
    pagination?: {
      page: number;
      pageCount: number;
    };
  };
};

const fetchAll = async <T>(
  resource: string,
  options: { signal?: AbortSignal; pageSize?: number; maxPages?: number } = {},
): Promise<T[]> => {
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;
  let page = 1;
  let pageCount = 1;
  const results: T[] = [];

  do {
    const separator = resource.includes('?') ? '&' : '?';
    const url = `${strapiApiUrl}/${resource}${separator}pagination[page]=${page}&pagination[pageSize]=${pageSize}`;
    const response = await fetch(url, { signal: options.signal });
    if (!response.ok) {
      break;
    }

    const payload = (await response.json()) as StrapiCollectionResponse<T>;
    results.push(...payload.data);
    pageCount = payload.meta?.pagination?.pageCount ?? 1;
    page += 1;
  } while (page <= pageCount && page <= maxPages);

  return results;
};

const readRequestBody = async (req: express.Request): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    req.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const createCollection = <T>(data: T[]) => ({
  data,
  meta: {
    pagination: {
      page: 1,
      pageSize: data.length,
      pageCount: 1,
      total: data.length,
    },
  },
});

const mockJwt = 'mock-jwt-token';
const mockUser = {
  id: 1,
  username: 'gwiezdny_rytual',
  email: 'demo@starsign.local',
};

let mockProfile = {
  id: 1,
  email: mockUser.email,
  username: mockUser.username,
  birthDate: null as string | null,
  birthTime: null as string | null,
  birthPlace: null as string | null,
  marketingConsent: false,
  zodiacSign: null as {
    id: number;
    name: string;
    slug: string;
    documentId: string;
  } | null,
};

let mockSubscription = {
  status: 'inactive',
  plan: null as 'monthly' | 'annual' | null,
  isPremium: false,
  hasPremiumAccess: true,
  accessMode: 'open' as 'open' | 'paid',
  trialEndsAt: null as string | null,
  currentPeriodEnd: null as string | null,
  cancelAtPeriodEnd: false,
};

let mockReadings: Array<{
  id: number;
  documentId: string;
  readingType: 'horoscope' | 'tarot';
  title: string;
  summary: string;
  content: string | null;
  period: string | null;
  signSlug: string | null;
  readingDate: string | null;
  isPremium: boolean;
  source: string | null;
  createdAt: string;
}> = [];

let readingIdSeed = 1;

if (useE2eMockApi) {
  app.use('/api', express.json(), (req, res) => {
    if (e2eApiLogEnabled) {
      console.log(`[mock-api] ${req.method} ${req.path}`);
    }

    const signs = [
      {
        id: 1,
        name: 'Baran',
        slug: 'baran',
        date_range: '21.03 - 19.04',
        element: 'Ogień',
      },
      {
        id: 2,
        name: 'Byk',
        slug: 'byk',
        date_range: '20.04 - 20.05',
        element: 'Ziemia',
      },
      {
        id: 3,
        name: 'Bliźnięta',
        slug: 'bliznieta',
        date_range: '21.05 - 20.06',
        element: 'Powietrze',
      },
      {
        id: 4,
        name: 'Rak',
        slug: 'rak',
        date_range: '21.06 - 22.07',
        element: 'Woda',
      },
    ];

    const articles = [
      {
        id: 1,
        slug: 'energia-wiosny',
        title: 'Energia Wiosny i Twój Znak',
        excerpt: 'Sprawdź, jak nowy sezon wpływa na Twoją energię i decyzje.',
        content:
          'Publiczny fragment artykułu o energii wiosny jest dostępny bez konta.',
        hasPremiumContent: true,
        publishedAt: new Date().toISOString(),
        read_time_minutes: 4,
        category: { id: 1, name: 'Astrologia' },
      },
      {
        id: 2,
        slug: 'retrogradacja-merkurego',
        title: 'Retrogradacja Merkurego bez chaosu',
        excerpt:
          'Praktyczne wskazówki, jak przejść przez retrogradację spokojniej.',
        content: 'Publiczny przewodnik po retrogradacji Merkurego.',
        publishedAt: new Date().toISOString(),
        read_time_minutes: 6,
        category: { id: 2, name: 'Poradnik' },
      },
    ];

    const products = [
      {
        id: 1,
        documentId: 'prod-amulet-1',
        name: 'Amulet Harmonii',
        slug: 'amulet-harmonii',
        description: 'Delikatny talizman wspierający codzienną równowagę.',
        price: 129,
        category: 'Talizmany',
        symbol: '✦',
        currency: 'PLN',
        sku: 'AMU-HAR-001',
        stock_status: 'in_stock',
      },
      {
        id: 2,
        documentId: 'prod-krysztal-1',
        name: 'Kryształ Intencji',
        slug: 'krysztal-intencji',
        description: 'Kryształ do pracy z intencją i medytacją.',
        price: 89,
        category: 'Kryształy',
        symbol: '✧',
        currency: 'PLN',
        sku: 'KRY-INT-001',
        stock_status: 'in_stock',
      },
    ];

    const normalizedPath = req.path.replace(/\/$/, '') || '/';
    const authHeader = req.headers.authorization || '';
    const isAuthorized = authHeader === `Bearer ${mockJwt}`;

    const today = new Date().toISOString().slice(0, 10);

    const dailyPayload = {
      date: today,
      sign: mockProfile.zodiacSign
        ? {
            name: mockProfile.zodiacSign.name,
            slug: mockProfile.zodiacSign.slug,
          }
        : null,
      horoscope: {
        date: today,
        period: 'dzienny',
        teaser: 'Krótki, darmowy wgląd astrologiczny na dzisiaj.',
        premiumContent: mockSubscription.hasPremiumAccess
          ? 'Pełna interpretacja premium z dodatkowymi wskazówkami i kontekstem osobistym.'
          : null,
        isPremiumLocked: !mockSubscription.hasPremiumAccess,
      },
      tarot: {
        cardName: 'The Star',
        cardSlug: 'the-star',
        teaserMessage: 'Karta dnia zachęca do spokoju i wiary w proces.',
        premiumMessage: mockSubscription.hasPremiumAccess
          ? 'Wersja premium: pogłębiona interpretacja karty dla relacji, pracy i energii tygodnia.'
          : null,
        isPremiumLocked: !mockSubscription.hasPremiumAccess,
      },
      teaser: 'Darmowy rytuał dnia działa od razu po zalogowaniu.',
      disclaimer:
        'Treści mają charakter refleksyjno-rozrywkowy i nie stanowią porady medycznej, prawnej ani finansowej.',
    };

    if (req.method === 'POST' && normalizedPath === '/auth/local') {
      res.json({
        jwt: mockJwt,
        user: mockUser,
      });
      return;
    }

    if (req.method === 'POST' && normalizedPath === '/auth/local/register') {
      const payload = (req.body || {}) as { email?: string; username?: string };
      if (typeof payload.email === 'string' && payload.email.trim()) {
        mockUser.email = payload.email.trim().toLowerCase();
      }
      if (typeof payload.username === 'string' && payload.username.trim()) {
        mockUser.username = payload.username.trim();
      }
      mockProfile = {
        ...mockProfile,
        email: mockUser.email,
        username: mockUser.username,
      };
      res.json({
        jwt: mockJwt,
        user: mockUser,
      });
      return;
    }

    if (req.method === 'GET' && normalizedPath === '/zodiac-signs') {
      res.json(createCollection(signs));
      return;
    }

    if (req.method === 'GET' && normalizedPath === '/articles') {
      const slug =
        typeof req.query['filters[slug][$eq]'] === 'string'
          ? req.query['filters[slug][$eq]']
          : undefined;
      const payload = slug
        ? articles.filter((article) => article.slug === slug)
        : articles;
      res.json(createCollection(payload));
      return;
    }

    if (req.method === 'GET' && normalizedPath === '/products') {
      if (!shopEnabled) {
        res.status(404).json({ error: 'Shop disabled' });
        return;
      }

      const documentId =
        typeof req.query['filters[documentId][$eq]'] === 'string'
          ? req.query['filters[documentId][$eq]']
          : undefined;
      const category =
        typeof req.query['filters[category][$eq]'] === 'string'
          ? req.query['filters[category][$eq]']
          : undefined;
      let payload = products;
      if (documentId) {
        payload = payload.filter(
          (product) => product.documentId === documentId,
        );
      }
      if (category) {
        payload = payload.filter((product) => product.category === category);
      }
      res.json(createCollection(payload));
      return;
    }

    if (req.method === 'GET' && normalizedPath.startsWith('/products/')) {
      if (!shopEnabled) {
        res.status(404).json({ error: 'Shop disabled' });
        return;
      }

      const documentId = normalizedPath.replace('/products/', '');
      const product = products.find((item) => item.documentId === documentId);
      res.json({ data: product || null });
      return;
    }

    if (req.method === 'GET' && normalizedPath === '/daily-tarot/today') {
      res.json({
        date: new Date().toISOString().slice(0, 10),
        card: {
          id: 1,
          name: 'The Star',
          slug: 'the-star',
          arcana: 'Wielkie Arkana',
          symbol: '✦',
          meaning_upright: 'Nadzieja, spokój i odnowa energii.',
          description:
            'Darmowe przesłanie karty dnia pokazuje kierunek bez blokady kontem.',
        },
        message: 'To dobry dzień na spokojne decyzje.',
      });
      return;
    }

    if (req.method === 'POST' && normalizedPath === '/newsletter/subscribe') {
      res.status(202).json({ accepted: true });
      return;
    }

    if (req.method === 'POST' && normalizedPath === '/contact') {
      res.status(202).json({
        success: true,
        message: 'Wiadomość wysłana',
      });
      return;
    }

    if (req.method === 'POST' && normalizedPath === '/checkout/session') {
      if (!shopEnabled) {
        res.status(404).json({ error: 'Shop disabled' });
        return;
      }

      res.json({
        checkoutUrl: 'https://star-sign.pl/checkout/mock-session',
        sessionId: 'cs_test_mock',
      });
      return;
    }

    if (
      req.method === 'GET' &&
      normalizedPath === '/checkout/session/cs_test_mock/analytics-summary'
    ) {
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        sessionId: 'cs_test_mock',
        orderDocumentId: 'order-mock',
        status: 'paid',
        currency: 'PLN',
        total: 79,
        items: [
          {
            productDocumentId: 'mock-product',
            productName: 'Mock Produkt Star Sign',
            quantity: 1,
            unitPrice: 79,
            lineTotal: 79,
          },
        ],
      });
      return;
    }

    if (!isAuthorized && normalizedPath.startsWith('/account/')) {
      res.status(401).json({
        error: {
          status: 401,
          name: 'UnauthorizedError',
          message: 'Brak autoryzacji.',
        },
      });
      return;
    }

    if (req.method === 'GET' && normalizedPath === '/account/me') {
      res.json({
        profile: mockProfile,
        subscription: mockSubscription,
      });
      return;
    }

    if (req.method === 'PUT' && normalizedPath === '/account/profile') {
      const payload = (req.body || {}) as {
        birthDate?: string | null;
        birthTime?: string | null;
        birthPlace?: string | null;
        zodiacSignSlug?: string | null;
        marketingConsent?: boolean;
      };
      const matchedSign = payload.zodiacSignSlug
        ? signs.find((sign) => sign.slug === payload.zodiacSignSlug)
        : null;
      mockProfile = {
        ...mockProfile,
        birthDate: payload.birthDate || null,
        birthTime: payload.birthTime || null,
        birthPlace: payload.birthPlace || null,
        marketingConsent: Boolean(payload.marketingConsent),
        zodiacSign: matchedSign
          ? {
              id: matchedSign.id,
              name: matchedSign.name,
              slug: matchedSign.slug,
              documentId: `zodiac-${matchedSign.slug}`,
            }
          : null,
      };
      res.json({
        profile: mockProfile,
        subscription: mockSubscription,
      });
      return;
    }

    if (req.method === 'GET' && normalizedPath === '/account/dashboard') {
      res.json({
        profile: mockProfile,
        subscription: mockSubscription,
        daily: dailyPayload,
      });
      return;
    }

    if (req.method === 'GET' && normalizedPath === '/account/readings') {
      res.json({ data: mockReadings });
      return;
    }

    if (
      req.method === 'POST' &&
      normalizedPath === '/account/readings/save-today'
    ) {
      const payload = (req.body || {}) as {
        readingType?: 'horoscope' | 'tarot';
      };
      const readingType: 'horoscope' | 'tarot' =
        payload.readingType === 'tarot' ? 'tarot' : 'horoscope';
      const existing = mockReadings.find(
        (item) =>
          item.readingType === readingType && item.readingDate === today,
      );

      if (existing) {
        res.json({ saved: false, reading: existing });
        return;
      }

      const reading: (typeof mockReadings)[number] = {
        id: readingIdSeed++,
        documentId: `reading-${readingIdSeed}`,
        readingType,
        title: readingType === 'tarot' ? 'Karta dnia' : 'Horoskop dnia',
        summary:
          readingType === 'tarot'
            ? dailyPayload.tarot.teaserMessage
            : dailyPayload.horoscope.teaser,
        content:
          readingType === 'tarot'
            ? dailyPayload.tarot.premiumMessage ||
              dailyPayload.tarot.teaserMessage
            : dailyPayload.horoscope.premiumContent ||
              dailyPayload.horoscope.teaser,
        period: readingType === 'horoscope' ? 'dzienny' : null,
        signSlug: dailyPayload.sign?.slug || null,
        readingDate: today,
        isPremium: mockSubscription.hasPremiumAccess,
        source: 'daily-ritual',
        createdAt: new Date().toISOString(),
      };

      mockReadings = [reading, ...mockReadings];
      res.json({ saved: true, reading });
      return;
    }

    if (
      req.method === 'POST' &&
      normalizedPath === '/analytics/events'
    ) {
      res.status(202).json({ accepted: true, uniqueDaily: true });
      return;
    }

    if (
      req.method === 'POST' &&
      normalizedPath === '/account/subscription/checkout'
    ) {
      const payload = (req.body || {}) as { plan?: 'monthly' | 'annual' };
      const plan = payload.plan === 'annual' ? 'annual' : 'monthly';
      mockSubscription = {
        status: 'trialing',
        plan,
        isPremium: true,
        hasPremiumAccess: true,
        accessMode: 'paid',
        trialEndsAt: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        currentPeriodEnd: new Date(
          Date.now() + (plan === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000,
        ).toISOString(),
        cancelAtPeriodEnd: false,
      };
      res.json({
        checkoutUrl: 'https://star-sign.pl/checkout/mock-premium',
        sessionId: 'cs_test_mock_premium',
      });
      return;
    }

    if (
      req.method === 'POST' &&
      normalizedPath === '/account/subscription/portal'
    ) {
      res.json({
        url: 'https://billing.stripe.com/mock-portal',
      });
      return;
    }

    res.status(404).json({
      error: {
        status: 404,
        name: 'NotFoundError',
        message: `No mock handler for ${req.method} ${req.path}`,
      },
    });
  });
} else {
  app.use('/api', async (req, res, next) => {
    try {
      const method = req.method.toUpperCase();
      const targetUrl = `${strapiApiBaseUrl}${req.url}`;
      const headers = new Headers();

      for (const [key, value] of Object.entries(req.headers)) {
        if (key.toLowerCase() === 'host' || value === undefined) {
          continue;
        }

        if (Array.isArray(value)) {
          value.forEach((item) => headers.append(key, item));
        } else {
          headers.set(key, value);
        }
      }

      const shouldForwardBody = method !== 'GET' && method !== 'HEAD';
      const requestBody = shouldForwardBody
        ? await readRequestBody(req)
        : undefined;
      const requestInit: RequestInit = {
        method,
        headers,
      };

      if (requestBody) {
        requestInit.body = requestBody as unknown as BodyInit;
      }

      const response = await fetch(targetUrl, requestInit);

      res.status(response.status);

      const setCookieHeader = response.headers.getSetCookie?.();
      if (setCookieHeader && setCookieHeader.length > 0) {
        res.setHeader('set-cookie', setCookieHeader);
      }

      response.headers.forEach((value, key) => {
        if (key === 'set-cookie') {
          return;
        }
        res.setHeader(key, value);
      });

      const payload = Buffer.from(await response.arrayBuffer());
      res.send(payload);
    } catch (error) {
      next(error);
    }
  });
}

app.get('/runtime-config.json', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    turnstile: {
      enabled: turnstileEnabled,
      siteKey: turnstileSiteKey,
    },
    analytics: {
      ga4MeasurementId,
      gtmContainerId,
    },
    sentry: {
      dsn: frontendSentryDsn,
      environment: sentryEnvironment,
      release: sentryRelease,
      tracesSampleRate: Number.isFinite(sentryTracesSampleRate)
        ? sentryTracesSampleRate
        : 0,
    },
  });
});

app.get('/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'star-sign-frontend',
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nSitemap: ${sitemapOrigin}/sitemap.xml\n`);
});

/**
 * Dynamic sitemap. Always returns 200 with at least the static public pages,
 * even when the backend API is slow, down, or returns errors. Dynamic slugs
 * (articles, zodiac signs, optionally shop products) are fetched with a short
 * timeout and a capped page count so this route can never hang the SSR server.
 */
const SITEMAP_FETCH_TIMEOUT_MS = 4000;
const SITEMAP_MAX_PAGES = 50;

const fetchDynamicSitemapEntries = async (
  signal: AbortSignal,
): Promise<SitemapEntry[]> => {
  const fetchOptions = {
    signal,
    pageSize: 100,
    maxPages: SITEMAP_MAX_PAGES,
  };

  const [articles, signs, products] = await Promise.all([
    fetchAll<{ slug?: string; updatedAt?: string; publishedAt?: string }>(
      'articles?fields[0]=slug&fields[1]=updatedAt&fields[2]=publishedAt',
      fetchOptions,
    ),
    fetchAll<{ slug?: string; updatedAt?: string; publishedAt?: string }>(
      'zodiac-signs?fields[0]=slug&fields[1]=updatedAt&fields[2]=publishedAt',
      fetchOptions,
    ),
    shopEnabled
      ? fetchAll<{
          documentId?: string;
          updatedAt?: string;
          publishedAt?: string;
        }>(
          'products?fields[0]=documentId&fields[1]=updatedAt&fields[2]=publishedAt',
          fetchOptions,
        )
      : Promise.resolve([]),
  ]);

  return [
    ...articlesToEntries(articles),
    ...zodiacSignsToEntries(signs),
    ...productsToEntries(products),
  ];
};

app.get('/sitemap.xml', async (_req, res) => {
  const staticPaths = [
    ...STATIC_SITEMAP_PATHS,
    ...(shopEnabled ? ['/sklep'] : []),
  ];

  let dynamicEntries: SitemapEntry[] = [];
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    SITEMAP_FETCH_TIMEOUT_MS,
  );

  try {
    dynamicEntries = await fetchDynamicSitemapEntries(controller.signal);
  } catch (error) {
    // Never fail the sitemap: degrade gracefully to the static pages only.
    console.warn(
      '[sitemap] dynamic fetch failed, serving static pages only:',
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    clearTimeout(timeout);
  }

  const entries = mergeSitemapEntries(staticPaths, dynamicEntries);
  const xml = buildSitemapXml(sitemapOrigin, entries);

  res.status(200);
  res.type('application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(/\.map$/, (_req, res) => {
  res.sendStatus(404);
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  if (e2eApiLogEnabled && req.path === '/') {
    console.log('[ssr] handling /');
  }

  angularApp
    .handle(req)
    .then((response) => {
      if (e2eApiLogEnabled && req.path === '/') {
        console.log(`[ssr] completed / (${response ? 'response' : 'next'})`);
      }
      return response ? writeResponseToNodeResponse(response, res) : next();
    })
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
