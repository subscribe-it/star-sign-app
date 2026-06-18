import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  simpleInstagram,
  simpleTiktok,
  simplePinterest,
} from '@ng-icons/simple-icons';

import { ZodiacService } from '../../core/services/zodiac.service';
import { ArticleService } from '../../core/services/article.service';
import { SeoService } from '../../core/services/seo.service';
import { StrapiImagePipe } from '../../core/pipes/strapi-image-pipe';
import { NewsletterService } from '../../core/services/newsletter.service';
import { NotificationService } from '../../core/services/notification';
import { AnalyticsService } from '../../core/services/analytics.service';
import { ZodiacSign } from '@star-sign-monorepo/shared-types';
import { Article } from '@star-sign-monorepo/shared-types';
import { ProductService } from '../../core/services/product.service';
import { Product } from '@star-sign-monorepo/shared-types';
import { featureFlags } from '../../core/feature-flags';
import { RuntimeConfigService } from '../../core/services/runtime-config.service';
import { TurnstileWidget } from '../../shared/components/turnstile/turnstile-widget';
import { SPECIAL_HOROSCOPE_TYPES } from '../../core/horoscope-type-definitions';

@Component({
  selector: 'app-home',
  imports: [RouterLink, NgIcon, StrapiImagePipe, TurnstileWidget],
  viewProviders: [
    provideIcons({ simpleInstagram, simpleTiktok, simplePinterest }),
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private readonly zodiacService = inject(ZodiacService);
  private readonly articleService = inject(ArticleService);
  private readonly seoService = inject(SeoService);
  private readonly productService = inject(ProductService);
  private readonly newsletterService = inject(NewsletterService);
  private readonly notificationService = inject(NotificationService);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly runtimeConfig = inject(RuntimeConfigService);
  private readonly newsletterTurnstileWidget = viewChild(TurnstileWidget);

  constructor() {
    this.seoService.updateSeo(
      'Twoja Droga Przez Gwiazdy',
      'Odkryj magię astrologii, horoskopy, tarot i unikalne talizmany w Star Sign.',
      {
        jsonLd: {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              name: 'Star Sign',
              url: 'https://star-sign.pl',
              logo: 'https://star-sign.pl/assets/icons/icon-512.png',
            },
            {
              '@type': 'WebSite',
              name: 'Star Sign',
              url: 'https://star-sign.pl',
              inLanguage: 'pl-PL',
            },
          ],
        },
      },
    );
  }

  public readonly signsLoading = signal(true);
  public readonly signsError = signal<string | null>(null);
  public readonly articlesLoading = signal(true);
  public readonly articlesError = signal<string | null>(null);
  public readonly shopItemsLoading = signal(featureFlags.shopEnabled);
  public readonly shopItemsError = signal<string | null>(null);

  public readonly signs = toSignal(
    this.zodiacService.getZodiacSigns().pipe(
      catchError(() => {
        this.signsError.set('Nie udało się pobrać znaków zodiaku.');
        return of([] as ZodiacSign[]);
      }),
      finalize(() => this.signsLoading.set(false)),
    ),
    { initialValue: [] as ZodiacSign[] },
  );
  public readonly articles = toSignal(
    this.articleService.getRecentArticles(3).pipe(
      catchError(() => {
        this.articlesError.set('Nie udało się pobrać najnowszych artykułów.');
        return of([] as Article[]);
      }),
      finalize(() => this.articlesLoading.set(false)),
    ),
    { initialValue: [] as Article[] },
  );
  public readonly shopEnabled = featureFlags.shopEnabled;
  public readonly adsEnabled = featureFlags.adsEnabled;
  public readonly shopItems = toSignal(
    this.shopEnabled
      ? this.productService.getProducts().pipe(
          map((products) => products.slice(0, 3)),
          catchError(() => {
            this.shopItemsError.set('Nie udało się pobrać produktów.');
            return of([] as Product[]);
          }),
          finalize(() => this.shopItemsLoading.set(false)),
        )
      : of([] as Product[]),
    { initialValue: [] as Product[] },
  );

  public readonly newsletterSent = signal(false);
  public readonly newsletterError = signal<string | null>(null);
  public readonly newsletterLoading = signal(false);
  public readonly newsletterConsent = signal(false);
  public readonly newsletterTurnstileToken = signal('');
  public readonly newsletterTurnstileRequired = computed(() =>
    this.runtimeConfig.turnstileEnabled(),
  );

  public onSubmitNewsletter(event: Event, emailInput: HTMLInputElement): void {
    event.preventDefault();
    if (this.newsletterLoading()) {
      return;
    }

    const email = emailInput.value.trim();
    if (!email) {
      this.newsletterError.set('Podaj adres e-mail.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.newsletterError.set('Podaj poprawny adres e-mail.');
      return;
    }

    if (!this.newsletterConsent()) {
      this.newsletterError.set(
        'Zaznacz zgodę na otrzymywanie newslettera, aby kontynuować.',
      );
      return;
    }

    if (
      this.newsletterTurnstileRequired() &&
      !this.newsletterTurnstileToken()
    ) {
      this.newsletterError.set('Potwierdź, że nie jesteś botem.');
      return;
    }

    this.newsletterLoading.set(true);
    this.newsletterError.set(null);

    this.newsletterService
      .subscribe({
        email,
        marketingConsent: this.newsletterConsent(),
        source: 'home-newsletter',
        turnstileToken: this.newsletterTurnstileToken() || undefined,
      })
      .subscribe({
        next: () => {
          this.newsletterSent.set(true);
          this.newsletterLoading.set(false);
          this.analyticsService.trackEvent('newsletter_signup', {
            source: 'home',
          });
          this.notificationService.success(
            'Dziękujemy za zapis! Sprawdź swoją skrzynkę e-mail, aby potwierdzić subskrypcję. ✦',
          );
          emailInput.value = '';
          this.newsletterConsent.set(false);
          this.resetNewsletterTurnstile();
        },
        error: (error) => {
          this.newsletterError.set(
            'Nie udało się zapisać. Spróbuj ponownie za chwilę.',
          );
          this.analyticsService.trackEvent('newsletter_error', {
            source: 'home',
            error: error.message,
          });
          this.notificationService.error(
            'Coś poszło nie tak. Spróbuj ponownie za chwilę.',
          );
          this.newsletterLoading.set(false);
          this.resetNewsletterTurnstile();
        },
      });
  }

  public handleNewsletterTurnstileToken(token: string): void {
    this.newsletterTurnstileToken.set(token);
  }

  private resetNewsletterTurnstile(): void {
    this.newsletterTurnstileToken.set('');
    this.newsletterTurnstileWidget()?.reset();
  }

  public readonly horoscopeTypes = SPECIAL_HOROSCOPE_TYPES;

  public readonly socials: { label: string; icon: string; href: string }[] = [];
}
