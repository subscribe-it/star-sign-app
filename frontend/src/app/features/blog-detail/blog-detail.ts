import {
  Component,
  ChangeDetectionStrategy,
  inject,
  effect,
  PLATFORM_ID,
} from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, map, of } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroChevronLeft,
  heroClock,
  heroUser,
  heroShare,
} from '@ng-icons/heroicons/outline';

import { ArticleService } from '../../core/services/article.service';
import { SeoService } from '../../core/services/seo.service';
import { AuthService } from '../../core/services/auth.service';
import { AccountService } from '../../core/services/account.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { Article } from '@star-sign-monorepo/shared-types';
import { featureFlags } from '../../core/feature-flags';
import { StrapiImagePipe } from '../../core/pipes/strapi-image-pipe';
import { StrapiSrcsetPipe } from '../../core/pipes/strapi-srcset-pipe';
import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { BreadcrumbsComponent } from '../../shared/components/breadcrumbs/breadcrumbs';
import { SocialShare } from '../../shared/components/social-share';
import { PremiumPreviewBlock } from '../../shared/components/premium-preview-block/premium-preview-block';

@Component({
  selector: 'app-blog-detail',
  imports: [
    RouterLink,
    NgIcon,
    DatePipe,
    StrapiImagePipe,
    StrapiSrcsetPipe,
    Skeleton,
    BreadcrumbsComponent,
    SocialShare,
    PremiumPreviewBlock,
  ],
  viewProviders: [
    provideIcons({ heroChevronLeft, heroClock, heroUser, heroShare }),
  ],
  templateUrl: './blog-detail.html',
  styleUrl: './blog-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly articleService = inject(ArticleService);
  private readonly seoService = inject(SeoService);
  private readonly authService = inject(AuthService);
  private readonly accountService = inject(AccountService);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private lastScrollTargetKey: string | null = null;

  public readonly isLoggedIn = this.authService.isLoggedIn;
  public readonly isPremiumUser = toSignal(
    toObservable(this.isLoggedIn).pipe(
      switchMap((isLoggedIn) =>
        isLoggedIn
          ? this.accountService
              .getMe()
              .pipe(
                map(
                  (me) =>
                    !!(
                      me?.subscription?.hasPremiumAccess ??
                      me?.subscription?.isPremium
                    ),
                ),
              )
          : of(false),
      ),
    ),
    { initialValue: false },
  );
  public readonly shopEnabled = featureFlags.shopEnabled;

  public readonly article = toSignal<Article | undefined>(
    this.route.paramMap.pipe(
      map((params) => params.get('slug')),
      switchMap((slug) => {
        if (!slug) return of(undefined);
        return this.articleService.getArticleBySlug(slug);
      }),
    ),
    { initialValue: undefined },
  );
  public readonly fragment = toSignal(this.route.fragment, {
    initialValue: null,
  });

  public readonly relatedArticles = toSignal(
    toObservable(this.article).pipe(
      switchMap((currentArticle) => {
        if (!currentArticle?.slug || !currentArticle?.category?.name) {
          return of([] as Article[]);
        }

        return this.articleService.getRelatedArticles(
          currentArticle.category.name,
          currentArticle.slug,
        );
      }),
    ),
    { initialValue: [] as Article[] },
  );

  constructor() {
    effect(() => {
      const article = this.article();
      if (article) {
        const canonicalUrl = this.seoService.absoluteUrl(
          `/artykuly/${article.slug}`,
        );
        this.seoService.updateSeo(
          article.title,
          article.excerpt || 'Czytaj więcej na blogu Star Sign.',
          {
            canonicalUrl,
            jsonLd: {
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: article.title,
              description: article.excerpt || '',
              datePublished: article.publishedAt,
              author: article.author
                ? { '@type': 'Person', name: article.author }
                : undefined,
              mainEntityOfPage: canonicalUrl,
            },
          },
        );

        // Track Article View
        this.analyticsService.trackEvent('article_view', {
          article_id: article.id,
          article_title: article.title,
          is_premium: this.hasPremiumExtension(article),
          category: article.category?.name,
        });
      }
    });

    effect(() => {
      const article = this.article();
      if (!article?.slug) {
        return;
      }

      this.scrollToArticleTarget(article.slug, this.fragment());
    });
  }

  public getSiteUrl(): string {
    return this.seoService.absoluteUrl('/').replace(/\/$/, '');
  }

  public shareArticle(): void {
    const article = this.article();
    if (!article) return;

    const url = this.seoService.absoluteUrl(`/artykuly/${article.slug}`);
    const title = article.title;

    this.analyticsService.trackEvent('article_share', {
      article_id: article.id,
      article_title: article.title,
    });

    if (navigator.share) {
      void navigator
        .share({
          title,
          text: article.excerpt,
          url,
        })
        .catch(() => undefined);
    } else {
      void navigator.clipboard?.writeText(url);
    }
  }

  public hasPremiumExtension(article: Article | undefined): boolean {
    return Boolean(
      article?.hasPremiumContent ||
      article?.premiumContent ||
      article?.isPremium,
    );
  }

  public canDisplayPremiumContent(article: Article | undefined): boolean {
    return this.isPremiumUser() || Boolean(article?.premiumContent?.trim());
  }

  public trackPremiumCta(article: Article | undefined): void {
    if (!article) {
      return;
    }

    this.analyticsService.trackPremiumCtaClick({
      content_type: 'article',
      content_id: article.documentId || String(article.id),
      content_slug: article.slug,
      premium_mode: 'open',
      access_state: this.canDisplayPremiumContent(article) ? 'open' : 'locked',
      ui_surface: 'article_detail',
      cta_location: 'article_premium_preview',
      funnel_step: 'cta_click',
      route: `/artykuly/${article.slug}`,
    });
  }

  private scrollToArticleTarget(slug: string, fragment: string | null): void {
    if (!this.isBrowser) {
      return;
    }

    const requestedTargetId = fragment?.replace(/^#/, '').trim() || null;
    const targetId = requestedTargetId || 'article-content';
    const scrollKey = `${slug}#${targetId}`;

    if (this.lastScrollTargetKey === scrollKey) {
      return;
    }

    this.lastScrollTargetKey = scrollKey;

    this.scrollToElementWhenReady(requestedTargetId, 0);
  }

  private scrollToElementWhenReady(
    requestedTargetId: string | null,
    attempt: number,
  ): void {
    window.setTimeout(
      () => {
        const requestedTarget = requestedTargetId
          ? document.getElementById(requestedTargetId)
          : null;
        const fallbackTarget = document.getElementById('article-content');
        const target =
          requestedTarget || (!requestedTargetId || attempt >= 5
            ? fallbackTarget
            : null);

        if (target && typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ block: 'start', behavior: 'auto' });
          return;
        }

        if (requestedTargetId && attempt < 5) {
          this.scrollToElementWhenReady(requestedTargetId, attempt + 1);
        }
      },
      attempt === 0 ? 0 : 80,
    );
  }
}
