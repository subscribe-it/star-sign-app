import { TestBed } from '@angular/core/testing';
import { SeoService } from './seo.service';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

describe('SeoService', () => {
  let service: SeoService;
  let titleService: Title;
  let metaService: Meta;
  let document: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [Title, Meta],
    });
    service = TestBed.inject(SeoService);
    titleService = TestBed.inject(Title);
    metaService = TestBed.inject(Meta);
    document = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    document.querySelector('link[rel="canonical"]')?.remove();
    document.getElementById('star-sign-json-ld')?.remove();
    document.getElementById('star-sign-site-json-ld')?.remove();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should update title and basic meta tags', () => {
    const titleSpy = vi.spyOn(titleService, 'setTitle');
    const metaSpy = vi.spyOn(metaService, 'updateTag');

    service.updateSeo('Test Title', 'Test Desc');

    expect(titleSpy).toHaveBeenCalledWith('Test Title | Star Sign');
    expect(metaSpy).toHaveBeenCalledWith({
      name: 'description',
      content: 'Test Desc',
    });
    expect(metaSpy).toHaveBeenCalledWith({
      name: 'robots',
      content: 'index,follow',
    });
    expect(metaSpy).toHaveBeenCalledWith({
      property: 'og:image',
      content: 'http://localhost:4200/assets/og-default.png',
    });
  });

  it('should set canonical URL', () => {
    service.updateSeo('T', 'D', { canonicalUrl: 'https://test.com' });
    const link = document.querySelector(
      'link[rel="canonical"]',
    ) as HTMLLinkElement;
    expect(link).toBeTruthy();
    expect(link.href).toBe('https://test.com/');
  });

  it('should set JSON-LD', () => {
    const payload = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Test',
    };
    service.updateSeo('T', 'D', { jsonLd: payload });
    const script = document.getElementById('star-sign-json-ld');
    expect(script).toBeTruthy();
    expect(script?.textContent).toBe(JSON.stringify(payload));
  });

  it('should remove stale JSON-LD when next page has no structured data', () => {
    service.updateSeo('T', 'D', {
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
      },
    });
    expect(document.getElementById('star-sign-json-ld')).toBeTruthy();

    service.updateSeo('Next', 'Page');

    expect(document.getElementById('star-sign-json-ld')).toBeNull();
  });

  it('should set noindex robots for private pages', () => {
    service.updateSeo('Panel', 'Private', { robots: 'noindex,nofollow' });
    const tag = document.querySelector(
      'meta[name="robots"]',
    ) as HTMLMetaElement;
    expect(tag.content).toBe('noindex,nofollow');
  });

  it('should emit sitewide Organization + WebSite JSON-LD under a dedicated id', () => {
    service.setSiteJsonLd();

    const script = document.getElementById('star-sign-site-json-ld');
    expect(script).toBeTruthy();
    expect(script?.getAttribute('type')).toBe('application/ld+json');

    const payload = JSON.parse(script?.textContent ?? '{}');
    expect(payload['@context']).toBe('https://schema.org');

    const types = (payload['@graph'] as { '@type': string }[]).map(
      (node) => node['@type'],
    );
    expect(types).toContain('Organization');
    expect(types).toContain('WebSite');

    // No site search route exists, so WebSite must not advertise a SearchAction.
    expect(script?.textContent).not.toContain('SearchAction');
  });

  it('should refresh the sitewide JSON-LD in place without duplicating it', () => {
    service.setSiteJsonLd();
    service.setSiteJsonLd();

    const scripts = document.querySelectorAll('#star-sign-site-json-ld');
    expect(scripts.length).toBe(1);
  });

  it('should keep sitewide JSON-LD separate from page-level JSON-LD', () => {
    service.setSiteJsonLd();
    service.updateSeo('T', 'D', {
      jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage' },
    });

    expect(document.getElementById('star-sign-site-json-ld')).toBeTruthy();
    expect(document.getElementById('star-sign-json-ld')).toBeTruthy();
  });

  it('should resolve absolute URLs from site URL', () => {
    expect(service.absoluteUrl('/panel')).toBe('http://localhost:4200/panel');
    expect(service.absoluteUrl('https://example.com/x')).toBe(
      'https://example.com/x',
    );
  });
});
