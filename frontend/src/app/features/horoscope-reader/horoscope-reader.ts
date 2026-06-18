import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, map, combineLatest, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroSparkles,
  heroCalendar,
  heroArrowLeft,
} from '@ng-icons/heroicons/outline';

import {
  HoroscopeEntry,
  ZodiacService,
} from '../../core/services/zodiac.service';
import { SeoService } from '../../core/services/seo.service';
import { AuthService } from '../../core/services/auth.service';
import { AccountService } from '../../core/services/account.service';
import { effect } from '@angular/core';

import { Skeleton } from '../../shared/components/skeleton/skeleton';
import { BreadcrumbsComponent } from '../../shared/components/breadcrumbs/breadcrumbs';
import { PremiumPreviewBlock } from '../../shared/components/premium-preview-block/premium-preview-block';
import { SocialShare } from '../../shared/components/social-share';

import { AnalyticsService } from '../../core/services/analytics.service';
import { featureFlags } from '../../core/feature-flags';

type HoroscopeReaderState = {
  horoscope: HoroscopeEntry;
  type: string;
  sign: string;
};

@Component({
  selector: 'app-horoscope-reader',
  standalone: true,
  imports: [
    RouterLink,
    NgIcon,
    Skeleton,
    TitleCasePipe,
    BreadcrumbsComponent,
    PremiumPreviewBlock,
    SocialShare,
  ],
  viewProviders: [provideIcons({ heroSparkles, heroCalendar, heroArrowLeft })],
  templateUrl: './horoscope-reader.html',
  styleUrl: './horoscope-reader.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HoroscopeReader {
  private readonly route = inject(ActivatedRoute);
  private readonly zodiacService = inject(ZodiacService);
  private readonly seoService = inject(SeoService);
  private readonly authService = inject(AuthService);
  private readonly accountService = inject(AccountService);
  private readonly analyticsService = inject(AnalyticsService);

  public readonly isLoggedIn = this.authService.isLoggedIn;
  public readonly isPremium = toSignal(
    toObservable(this.isLoggedIn).pipe(
      switchMap((loggedIn) =>
        loggedIn
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

  public readonly loading = signal(true);
  public readonly error = signal<string | null>(null);
  public readonly adsEnabled = featureFlags.adsEnabled;
  private readonly trackedAnalytics = new Set<string>();

  constructor() {
    effect(() => {
      const state = this.data();
      if (state?.horoscope) {
        const signName =
          state.sign.charAt(0).toUpperCase() + state.sign.slice(1);
        const typeLabel = this.getTypeLabel(state.type);
        const title = `Horoskop ${typeLabel.toLowerCase()} ${signName}`;
        const description = `Sprawdź swój horoskop ${state.type} dla znaku ${signName}. Poznaj wskazówki gwiazd na dziś.`;
        const canonicalUrl = this.seoService.absoluteUrl(
          `/horoskopy/${state.type}/${state.sign}`,
        );

        this.seoService.updateSeo(title, description, {
          canonicalUrl,
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: title,
            description: description,
            datePublished: new Date().toISOString(),
            mainEntityOfPage: canonicalUrl,
          },
        });

        // Track Horoscope View
        this.analyticsService.trackEvent('horoscope_view', {
          sign: state.sign,
          type: state.type,
          is_premium: this.hasPremiumExtension(state.horoscope),
        });
        this.trackHoroscopeProductAnalytics(state);
      }
    });
  }

  public readonly data = toSignal<HoroscopeReaderState | undefined>(
    combineLatest([
      this.route.paramMap.pipe(map((params) => params.get('type'))),
      this.route.paramMap.pipe(map((params) => params.get('sign'))),
      toObservable(this.isPremium),
    ]).pipe(
      switchMap(([type, sign]) => {
        this.loading.set(true);
        this.error.set(null);
        if (!type || !sign) {
          this.loading.set(false);
          return of(undefined);
        }
        return this.zodiacService.getHoroscope(type, sign).pipe(
          map((horoscope) =>
            horoscope ? { horoscope, type, sign } : undefined,
          ),
          catchError(() => {
            this.error.set('Nie udało się pobrać tego horoskopu.');
            return of(undefined);
          }),
          finalize(() => this.loading.set(false)),
        );
      }),
    ),
    { initialValue: undefined },
  );

  public getTypeLabel(type: string | undefined): string {
    if (!type) {
      return 'Astrologiczny';
    }
    switch (type) {
      case 'dzienny':
        return 'Dzienny';
      case 'tygodniowy':
        return 'Tygodniowy';
      case 'miesieczny':
        return 'Miesięczny';
      case 'roczny':
        return 'Roczny';
      case 'chinski':
        return 'Chiński';
      case 'celtycki':
        return 'Celtycki';
      case 'egipski':
        return 'Egipski';
      default:
        return 'Astrologiczny';
    }
  }

  private readonly horoscopeTypes: ReadonlyArray<{
    type: string;
    label: string;
    description: string;
  }> = [
    {
      type: 'dzienny',
      label: 'Dzienny',
      description: 'Co przyniesie dzisiejszy dzień.',
    },
    {
      type: 'tygodniowy',
      label: 'Tygodniowy',
      description: 'Spojrzenie na nadchodzące dni.',
    },
    {
      type: 'miesieczny',
      label: 'Miesięczny',
      description: 'Prognoza na cały miesiąc.',
    },
    {
      type: 'roczny',
      label: 'Roczny',
      description: 'Szeroki obraz całego roku.',
    },
  ];

  public readonly relatedHoroscopes = computed(() => {
    const state = this.data();
    if (!state?.sign) {
      return [];
    }

    return this.horoscopeTypes
      .filter((entry) => entry.type !== state.type)
      .map((entry) => ({
        ...entry,
        sign: state.sign,
      }));
  });

  public getSiteUrl(): string {
    return this.seoService.absoluteUrl('/').replace(/\/$/, '');
  }

  public hasPremiumExtension(horoscope: HoroscopeEntry | undefined): boolean {
    return Boolean(horoscope?.hasPremiumContent || horoscope?.premiumContent);
  }

  public canDisplayPremiumContent(
    horoscope: HoroscopeEntry | undefined,
  ): boolean {
    return this.isPremium() || Boolean(horoscope?.premiumContent?.trim());
  }

  public trackPremiumCta(state: HoroscopeReaderState | undefined): void {
    if (!state?.horoscope) {
      return;
    }

    this.analyticsService.trackPremiumCtaClick(
      {
        ...this.toAnalyticsParams(state, 'open'),
        cta_location: 'horoscope_premium_preview',
        funnel_step: 'cta_click',
      },
    );
  }

  private trackHoroscopeProductAnalytics(state: HoroscopeReaderState): void {
    const baseParams = this.toAnalyticsParams(
      state,
      this.canDisplayPremiumContent(state.horoscope) ? 'open' : 'locked',
    );

    if (state.type === 'dzienny') {
      this.trackOnce(`daily:${state.horoscope.documentId}`, () => {
        this.analyticsService.trackDailyHoroscopeView(baseParams);
      });
    }

    if (this.hasPremiumExtension(state.horoscope)) {
      this.trackOnce(`premium-impression:${state.horoscope.documentId}`, () => {
        this.analyticsService.trackPremiumContentImpression(baseParams);
      });
    }

    if (this.canDisplayPremiumContent(state.horoscope)) {
      this.trackOnce(`premium-view:${state.horoscope.documentId}`, () => {
        this.analyticsService.trackPremiumContentView(baseParams);
      });
    }
  }

  private trackOnce(key: string, callback: () => void): void {
    if (this.trackedAnalytics.has(key)) {
      return;
    }

    this.trackedAnalytics.add(key);
    callback();
  }

  private toAnalyticsParams(
    state: HoroscopeReaderState,
    accessState: 'open' | 'locked',
  ): Record<string, unknown> {
    return {
      content_type: 'horoscope',
      content_id: state.horoscope.documentId,
      content_slug: `${state.type}-${state.sign}`,
      sign_slug: state.sign,
      horoscope_period: state.type,
      premium_mode: 'open',
      access_state: accessState,
      ui_surface: 'horoscope_reader',
      route: `/horoskopy/${state.type}/${state.sign}`,
    };
  }
}
