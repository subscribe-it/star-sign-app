/**
 * Pure, framework-agnostic helpers for building the dynamic sitemap.xml.
 *
 * This module intentionally has NO dependency on Express, Angular SSR or any
 * runtime globals, so it can be unit-tested in isolation (see sitemap.spec.ts).
 *
 * The Express route in `server.ts` is responsible for fetching the dynamic data
 * (articles, zodiac signs, optionally products) and for the network/timeout
 * concerns. This module only turns plain data into a valid sitemap document.
 */

/** A single `<url>` entry in the sitemap. */
export interface SitemapEntry {
  /** Site-relative path, e.g. `/artykuly/moj-artykul`. Must start with `/`. */
  path: string;
  /** Optional last-modified timestamp (ISO string or `YYYY-MM-DD`). */
  lastmod?: string | null;
}

/**
 * Public, statically-known pages that must ALWAYS appear in the sitemap, even
 * when the backend API is unreachable. Private/auth-only routes are
 * intentionally excluded (panel, logowanie, rejestracja, konto, checkout,
 * newsletter actions, etc.).
 *
 * Paths are taken from `app/app.routes.ts`. Parameterised routes
 * (`/znaki/:sign`, `/horoskopy/:type/:sign`, `/artykuly/:slug`, ...) are added
 * dynamically by the route handler and are not listed here.
 */
export const STATIC_SITEMAP_PATHS: readonly string[] = [
  '/',
  '/znaki',
  '/horoskopy',
  '/horoskopy/dzienny',
  '/horoskopy/tygodniowy',
  '/horoskopy/miesieczny',
  '/horoskopy/roczny',
  '/tarot',
  '/tarot/karta-dnia',
  '/artykuly',
  '/numerologia',
  '/kosmogram',
  '/premium',
  '/o-nas',
  '/kontakt',
  '/regulamin',
  '/polityka-prywatnosci',
  '/cookies',
  '/disclaimer',
];

/** Escape characters that are not valid inside XML text/attribute content. */
export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Normalise a raw domain (with or without scheme/trailing slash) into a clean
 * `https://host` origin with no trailing slash.
 */
export const normalizeOrigin = (domain: string): string => {
  const trimmed = (domain || '').trim();
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, '');
};

/**
 * Format a raw `updatedAt`/`publishedAt` value into a sitemap `<lastmod>`.
 * Returns `undefined` for missing/invalid values so the element is omitted.
 */
export const formatLastmod = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
};

/**
 * Merge the always-present static pages with dynamic entries into a single,
 * de-duplicated, ordered list. Static pages come first and win on conflicts
 * (no overwrite by a later dynamic entry sharing the same path).
 */
export const mergeSitemapEntries = (
  staticPaths: readonly string[],
  dynamicEntries: readonly SitemapEntry[],
): SitemapEntry[] => {
  const byPath = new Map<string, SitemapEntry>();
  for (const path of staticPaths) {
    if (!byPath.has(path)) {
      byPath.set(path, { path });
    }
  }
  for (const entry of dynamicEntries) {
    if (!entry?.path || byPath.has(entry.path)) {
      continue;
    }
    byPath.set(entry.path, entry);
  }
  return Array.from(byPath.values());
};

/**
 * Build a complete, valid sitemap XML document from entries.
 *
 * @param origin Absolute origin (e.g. `https://star-sign.pl`) prepended to each
 *               site-relative `path` to form an absolute `<loc>`.
 * @param entries URL entries to render.
 */
export const buildSitemapXml = (
  origin: string,
  entries: readonly SitemapEntry[],
): string => {
  const base = normalizeOrigin(origin);
  const urls = entries
    .filter((entry) => Boolean(entry?.path))
    .map((entry) => {
      const path = entry.path.startsWith('/') ? entry.path : `/${entry.path}`;
      const loc = escapeXml(`${base}${path}`);
      const lastmod = formatLastmod(entry.lastmod);
      const lastmodLine = lastmod
        ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>`
        : '';
      return `  <url>\n    <loc>${loc}</loc>${lastmodLine}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
};

/** Minimal shape of an article record returned by the backend. */
export interface ArticleLike {
  slug?: string | null;
  updatedAt?: string | null;
  publishedAt?: string | null;
}

/** Minimal shape of a zodiac sign record returned by the backend. */
export interface ZodiacSignLike {
  slug?: string | null;
  updatedAt?: string | null;
  publishedAt?: string | null;
}

/** Minimal shape of a shop product record returned by the backend. */
export interface ProductLike {
  documentId?: string | null;
  updatedAt?: string | null;
  publishedAt?: string | null;
}

/** Map article records to `/artykuly/:slug` entries. */
export const articlesToEntries = (
  articles: readonly ArticleLike[],
): SitemapEntry[] =>
  articles
    .filter((article): article is ArticleLike & { slug: string } =>
      Boolean(article?.slug),
    )
    .map((article) => ({
      path: `/artykuly/${article.slug}`,
      lastmod: article.updatedAt || article.publishedAt || null,
    }));

/**
 * Map zodiac sign records to all per-sign pages: the sign profile plus the four
 * horoscope periods for that sign.
 */
export const zodiacSignsToEntries = (
  signs: readonly ZodiacSignLike[],
): SitemapEntry[] =>
  signs
    .filter((sign): sign is ZodiacSignLike & { slug: string } =>
      Boolean(sign?.slug),
    )
    .flatMap((sign) => {
      const lastmod = sign.updatedAt || sign.publishedAt || null;
      return [
        `/znaki/${sign.slug}`,
        `/horoskopy/dzienny/${sign.slug}`,
        `/horoskopy/tygodniowy/${sign.slug}`,
        `/horoskopy/miesieczny/${sign.slug}`,
        `/horoskopy/roczny/${sign.slug}`,
      ].map((path) => ({ path, lastmod }));
    });

/** Map shop product records to `/sklep/produkt/:documentId` entries. */
export const productsToEntries = (
  products: readonly ProductLike[],
): SitemapEntry[] =>
  products
    .filter((product): product is ProductLike & { documentId: string } =>
      Boolean(product?.documentId),
    )
    .map((product) => ({
      path: `/sklep/produkt/${product.documentId}`,
      lastmod: product.updatedAt || product.publishedAt || null,
    }));
