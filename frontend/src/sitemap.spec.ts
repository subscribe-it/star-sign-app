import {
  STATIC_SITEMAP_PATHS,
  articlesToEntries,
  buildSitemapXml,
  escapeXml,
  formatLastmod,
  mergeSitemapEntries,
  normalizeOrigin,
  productsToEntries,
  zodiacSignsToEntries,
  type SitemapEntry,
} from './sitemap';

const ORIGIN = 'https://star-sign.pl';

describe('sitemap helpers', () => {
  describe('escapeXml', () => {
    it('escapes XML special characters', () => {
      expect(escapeXml(`a&b<c>d"e'f`)).toBe(
        'a&amp;b&lt;c&gt;d&quot;e&apos;f',
      );
    });

    it('leaves safe strings untouched', () => {
      expect(escapeXml('/artykuly/moj-artykul')).toBe('/artykuly/moj-artykul');
    });
  });

  describe('normalizeOrigin', () => {
    it('prefixes https when scheme missing', () => {
      expect(normalizeOrigin('star-sign.pl')).toBe('https://star-sign.pl');
    });

    it('strips trailing slashes', () => {
      expect(normalizeOrigin('https://star-sign.pl/')).toBe(
        'https://star-sign.pl',
      );
    });

    it('keeps an existing http scheme', () => {
      expect(normalizeOrigin('http://localhost:4200')).toBe(
        'http://localhost:4200',
      );
    });
  });

  describe('formatLastmod', () => {
    it('returns undefined for empty/invalid input', () => {
      expect(formatLastmod(undefined)).toBeUndefined();
      expect(formatLastmod(null)).toBeUndefined();
      expect(formatLastmod('')).toBeUndefined();
      expect(formatLastmod('not-a-date')).toBeUndefined();
    });

    it('normalizes a valid date to ISO', () => {
      expect(formatLastmod('2026-04-29')).toBe('2026-04-29T00:00:00.000Z');
    });

    it('normalizes a full ISO timestamp', () => {
      expect(formatLastmod('2026-04-29T12:34:56.000Z')).toBe(
        '2026-04-29T12:34:56.000Z',
      );
    });
  });

  describe('mergeSitemapEntries', () => {
    it('always includes static pages even with empty dynamic input', () => {
      const merged = mergeSitemapEntries(STATIC_SITEMAP_PATHS, []);
      const paths = merged.map((entry) => entry.path);
      for (const staticPath of STATIC_SITEMAP_PATHS) {
        expect(paths).toContain(staticPath);
      }
      expect(merged.length).toBe(STATIC_SITEMAP_PATHS.length);
    });

    it('appends dynamic entries after static ones', () => {
      const merged = mergeSitemapEntries(
        ['/', '/artykuly'],
        [{ path: '/artykuly/x' }, { path: '/znaki/baran' }],
      );
      expect(merged.map((e) => e.path)).toEqual([
        '/',
        '/artykuly',
        '/artykuly/x',
        '/znaki/baran',
      ]);
    });

    it('de-duplicates and does not let dynamic overwrite a static path', () => {
      const merged = mergeSitemapEntries(
        ['/artykuly'],
        [{ path: '/artykuly', lastmod: '2026-01-01' }, { path: '/artykuly/x' }],
      );
      const artykuly = merged.find((e) => e.path === '/artykuly');
      expect(artykuly?.lastmod).toBeUndefined();
      expect(merged.filter((e) => e.path === '/artykuly')).toHaveLength(1);
    });

    it('drops entries with no path', () => {
      const merged = mergeSitemapEntries(
        [],
        [{ path: '' }, { path: '/ok' }] as SitemapEntry[],
      );
      expect(merged.map((e) => e.path)).toEqual(['/ok']);
    });
  });

  describe('buildSitemapXml', () => {
    it('produces a valid sitemap document with static pages only', () => {
      const xml = buildSitemapXml(
        ORIGIN,
        mergeSitemapEntries(STATIC_SITEMAP_PATHS, []),
      );
      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(
        true,
      );
      expect(xml).toContain(
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      );
      expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);

      // Every static path becomes an absolute <loc>.
      for (const staticPath of STATIC_SITEMAP_PATHS) {
        expect(xml).toContain(`<loc>${ORIGIN}${staticPath}</loc>`);
      }

      // <url> count matches entry count.
      const urlCount = (xml.match(/<url>/g) || []).length;
      expect(urlCount).toBe(STATIC_SITEMAP_PATHS.length);
    });

    it('renders absolute loc values from the origin', () => {
      const xml = buildSitemapXml(ORIGIN, [{ path: '/znaki/baran' }]);
      expect(xml).toContain('<loc>https://star-sign.pl/znaki/baran</loc>');
    });

    it('normalizes a bare domain origin to https', () => {
      const xml = buildSitemapXml('star-sign.pl', [{ path: '/' }]);
      expect(xml).toContain('<loc>https://star-sign.pl/</loc>');
    });

    it('includes <lastmod> when provided and omits it otherwise', () => {
      const xml = buildSitemapXml(ORIGIN, [
        { path: '/a', lastmod: '2026-04-29' },
        { path: '/b' },
      ]);
      expect(xml).toContain('<lastmod>2026-04-29T00:00:00.000Z</lastmod>');
      const bBlock = xml
        .split('<url>')
        .find((chunk) => chunk.includes('/b</loc>'));
      expect(bBlock).toBeDefined();
      expect(bBlock).not.toContain('<lastmod>');
    });

    it('escapes special characters inside loc URLs', () => {
      const xml = buildSitemapXml(ORIGIN, [
        { path: '/artykuly/a&b<c>"d' },
      ]);
      expect(xml).toContain(
        '<loc>https://star-sign.pl/artykuly/a&amp;b&lt;c&gt;&quot;d</loc>',
      );
      expect(xml).not.toContain('a&b<c>"d');
    });

    it('prefixes a leading slash when a relative path lacks one', () => {
      const xml = buildSitemapXml(ORIGIN, [{ path: 'tarot' }]);
      expect(xml).toContain('<loc>https://star-sign.pl/tarot</loc>');
    });
  });

  describe('articlesToEntries', () => {
    it('maps slugs to /artykuly/:slug and prefers updatedAt', () => {
      const entries = articlesToEntries([
        { slug: 'energia-wiosny', updatedAt: '2026-05-01', publishedAt: '2026-04-01' },
        { slug: 'retrogradacja', publishedAt: '2026-03-01' },
      ]);
      expect(entries).toEqual([
        { path: '/artykuly/energia-wiosny', lastmod: '2026-05-01' },
        { path: '/artykuly/retrogradacja', lastmod: '2026-03-01' },
      ]);
    });

    it('skips records without a slug', () => {
      expect(
        articlesToEntries([{ updatedAt: '2026-01-01' }, { slug: 'ok' }]),
      ).toEqual([{ path: '/artykuly/ok', lastmod: null }]);
    });
  });

  describe('zodiacSignsToEntries', () => {
    it('emits the profile plus four horoscope periods per sign', () => {
      const entries = zodiacSignsToEntries([
        { slug: 'baran', updatedAt: '2026-02-02' },
      ]);
      expect(entries.map((e) => e.path)).toEqual([
        '/znaki/baran',
        '/horoskopy/dzienny/baran',
        '/horoskopy/tygodniowy/baran',
        '/horoskopy/miesieczny/baran',
        '/horoskopy/roczny/baran',
      ]);
      expect(entries.every((e) => e.lastmod === '2026-02-02')).toBe(true);
    });
  });

  describe('productsToEntries', () => {
    it('maps documentId to /sklep/produkt/:documentId', () => {
      expect(
        productsToEntries([
          { documentId: 'prod-1', publishedAt: '2026-01-10' },
          { updatedAt: '2026-01-01' },
        ]),
      ).toEqual([{ path: '/sklep/produkt/prod-1', lastmod: '2026-01-10' }]);
    });
  });
});
