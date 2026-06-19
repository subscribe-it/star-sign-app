import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroShare } from '@ng-icons/heroicons/outline';
import { TarotService } from '../../core/services/tarot.service';
import { TarotCard } from '@star-sign-monorepo/shared-types';
import { AuthService } from '../../core/services/auth.service';
import { AccountService } from '../../core/services/account.service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { map, of, switchMap } from 'rxjs';

import { AnalyticsService } from '../../core/services/analytics.service';
import { SeoService } from '../../core/services/seo.service';
import { PremiumPreviewBlock } from '../../shared/components/premium-preview-block/premium-preview-block';
import { SocialShare } from '../../shared/components/social-share';
import { NewsletterCtaComponent } from '../../shared/components/newsletter-cta/newsletter-cta';
import { StrapiImagePipe } from '../../core/pipes/strapi-image-pipe';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-tarot-result',
  imports: [
    RouterLink,
    NgIcon,
    PremiumPreviewBlock,
    SocialShare,
    NewsletterCtaComponent,
    StrapiImagePipe,
  ],
  viewProviders: [provideIcons({ heroShare })],
  templateUrl: './tarot-result.html',
  styleUrl: './tarot-result.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TarotResult implements OnInit {
  private readonly tarotService = inject(TarotService);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly authService = inject(AuthService);
  private readonly accountService = inject(AccountService);
  private readonly seoService = inject(SeoService);

  public readonly card = signal<TarotCard | null>(null);
  public readonly isLoading = signal(true);
  public readonly error = signal<string | null>(null);
  public readonly isPremium = toSignal(
    toObservable(this.authService.isLoggedIn).pipe(
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

  ngOnInit(): void {
    this.loadDailyCard();
  }

  private loadDailyCard(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.tarotService.getDailyCard().subscribe({
      next: (draw) => {
        if (draw.card) {
          this.card.set(draw.card);
          this.updateCardSeo(draw.card);
          this.analyticsService.trackFeatureUse('tarot_draw', {
            card_name: draw.card.name,
          });
          this.analyticsService.trackPremiumContentImpression({
            content_type: 'tarot_daily',
            content_id: draw.card.documentId,
            content_slug: draw.card.slug,
            premium_mode: 'open',
            access_state: 'open',
            ui_surface: 'tarot_daily_result',
            route: '/tarot/karta-dnia',
          });
          this.analyticsService.trackPremiumContentView({
            content_type: 'tarot_daily',
            content_id: draw.card.documentId,
            content_slug: draw.card.slug,
            premium_mode: 'open',
            access_state: 'open',
            ui_surface: 'tarot_daily_result',
            route: '/tarot/karta-dnia',
          });
        } else {
          this.error.set('Nie znaleziono karty na dziś.');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Nie udało się pobrać karty dnia.');
        this.isLoading.set(false);
        this.analyticsService.trackEvent('tarot_error', { error: err.message });
      },
    });
  }

  private cardImageUrl(card: TarotCard): string | undefined {
    const url = card.image?.url;
    if (!url) {
      return undefined;
    }

    return this.seoService.absoluteUrl(
      url.startsWith('http') ? url : `${environment.apiUrl}${url}`,
    );
  }

  private updateCardSeo(card: TarotCard): void {
    const canonicalUrl = this.seoService.absoluteUrl('/tarot/karta-dnia');
    const imageUrl = this.cardImageUrl(card);
    const description =
      card.description ||
      card.meaning_upright ||
      `Twoja Karta Dnia w Star Sign: ${card.name}.`;

    this.seoService.updateSeo(
      `Karta Dnia: ${card.name}`,
      description,
      {
        canonicalUrl,
        type: 'article',
        ...(imageUrl ? { imageUrl } : {}),
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: card.name,
          headline: `Karta Dnia: ${card.name}`,
          description,
          ...(imageUrl ? { image: imageUrl } : {}),
          ...(card.arcana ? { genre: card.arcana } : {}),
          ...(card.meaning_upright
            ? { keywords: card.meaning_upright }
            : {}),
          inLanguage: 'pl',
          url: canonicalUrl,
          mainEntityOfPage: canonicalUrl,
          isAccessibleForFree: true,
        },
      },
    );
  }

  public premiumTarotContent(card: TarotCard): string {
    return `Relacje: karta ${card.name} zaprasza do uważnego sprawdzenia, gdzie w relacji odpowiadasz automatycznie, a gdzie możesz wybrać dojrzalszy gest. Jeśli czekasz na wiadomość, rozmowę albo znak, nie oddawaj całej energii oczekiwaniu. Nazwij jedną potrzebę i jedną granicę. Potem wybierz zdanie, które można powiedzieć spokojnie, bez testowania drugiej osoby i bez udowadniania własnej racji.

Praca: znaczenie proste karty brzmi: ${card.meaning_upright}. W Premium przekładamy je na konkretny ruch. Wybierz jedno zadanie, które domyka dzień albo zmniejsza napięcie przed jutrem. Jeśli czujesz opór, rozbij je na pierwszy widoczny krok: mail, notatkę, telefon, decyzję lub uporządkowanie materiałów. Nie szukaj idealnego nastroju. Zrób działanie, które przywraca sprawczość.

Energia dnia: cień karty ${card.name} może pokazywać miejsce, w którym działasz z pośpiechu, lęku albo potrzeby kontroli. Zwróć uwagę na ciało: szczękę, barki, dłonie i tempo oddechu. Jeżeli pojawia się napięcie, zatrzymaj się na dziewięć oddechów i nazwij emocję bez oceniania. To nie ma zatrzymać działania, tylko oczyścić intencję, z której ruszasz dalej.

Rytuał: zapisz na kartce słowo "${card.meaning_upright}". Pod nim dopisz trzy krótkie zdania: co dziś widzę wyraźniej, czego nie chcę wzmacniać i jaki gest pokaże mi zaufanie do siebie. Złóż kartkę albo zostaw ją przy świecy, kubku z wodą lub innym prostym przedmiocie. Wieczorem wróć do niej i zaznacz jedno zdanie, które nadal brzmi prawdziwie.

Pytanie refleksyjne: jaki jeden krok pokaże mi dziś więcej zaufania do siebie, nawet jeśli nie rozwiąże całej sytuacji od razu?`;
  }

  public getCardShareUrl(): string {
    return this.seoService.absoluteUrl('/tarot/karta-dnia');
  }

  public getCardShareTitle(card: TarotCard): string {
    return `Moja Karta Dnia w Star Sign: ${card.name} ✦`;
  }

  public shareDailyCard(card: TarotCard): void {
    const text = `Moja Karta Dnia w Star Sign: ${card.name}`;
    this.analyticsService.trackEvent('tarot_share', { card_name: card.name });

    if (navigator.share) {
      void navigator
        .share({ title: text, text, url: window.location.href })
        .catch(() => undefined);
      return;
    }

    void navigator.clipboard?.writeText(`${text} ${window.location.href}`);
  }
}
