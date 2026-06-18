import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

export type SeoOptions = {
  canonicalUrl?: string;
  imageUrl?: string;
  robots?: 'index,follow' | 'noindex,nofollow';
  type?: 'website' | 'article';
  jsonLd?: Record<string, unknown>;
};

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  public updateSeo(
    title: string,
    description: string,
    options: SeoOptions = {},
  ): void {
    const fullTitle = title.endsWith('| Star Sign')
      ? title
      : `${title} | Star Sign`;
    this.title.setTitle(fullTitle);

    const imageUrl = this.absoluteUrl(
      options.imageUrl || environment.seo.defaultImageUrl,
    );
    const type = options.type || 'website';
    const robots = options.robots || 'index,follow';

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'robots', content: robots });

    // Open Graph
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:image', content: imageUrl });
    this.meta.updateTag({ property: 'og:type', content: type });
    this.meta.updateTag({ property: 'og:site_name', content: 'Star Sign' });

    // Twitter
    this.meta.updateTag({
      name: 'twitter:card',
      content: 'summary_large_image',
    });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: imageUrl });
    this.meta.updateTag({ name: 'twitter:site', content: '@StarSignApp' });

    if (options.canonicalUrl) {
      const canonicalUrl = this.absoluteUrl(options.canonicalUrl);
      this.meta.updateTag({
        property: 'og:url',
        content: canonicalUrl,
      });
      this.setCanonical(canonicalUrl);
    }

    if (options.jsonLd) {
      this.setJsonLd(options.jsonLd);
    } else {
      this.clearJsonLd();
    }
  }

  public absoluteUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) {
      return pathOrUrl;
    }

    return new URL(pathOrUrl, environment.siteUrl).toString();
  }

  /**
   * Emits a dedicated schema.org BreadcrumbList JSON-LD payload.
   *
   * Uses a separate <script> id from the page-level JSON-LD so a breadcrumb
   * trail and an Article/WebPage payload can coexist on the same page without
   * clobbering each other. SSR-safe (uses the injected DOCUMENT). Pass an empty
   * array to remove the breadcrumb JSON-LD.
   */
  public setBreadcrumbsJsonLd(
    items: ReadonlyArray<{ name: string; url: string }>,
  ): void {
    const scriptId = 'star-sign-breadcrumbs-json-ld';

    if (!items.length) {
      this.document.getElementById(scriptId)?.remove();
      return;
    }

    const payload = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: this.absoluteUrl(item.url),
      })),
    };

    const existing = this.document.getElementById(scriptId);
    if (existing) {
      existing.textContent = JSON.stringify(payload);
      return;
    }

    const script = this.document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    script.text = JSON.stringify(payload);
    this.document.head.appendChild(script);
  }

  private setCanonical(url: string): void {
    const existing = this.document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (existing) {
      existing.href = url;
      return;
    }

    const link = this.document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', url);
    this.document.head.appendChild(link);
  }

  private setJsonLd(payload: Record<string, unknown>): void {
    const scriptId = 'star-sign-json-ld';
    const existing = this.document.getElementById(scriptId);
    if (existing) {
      existing.textContent = JSON.stringify(payload);
      return;
    }

    const script = this.document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    script.text = JSON.stringify(payload);
    this.document.head.appendChild(script);
  }

  private clearJsonLd(): void {
    this.document.getElementById('star-sign-json-ld')?.remove();
  }
}
