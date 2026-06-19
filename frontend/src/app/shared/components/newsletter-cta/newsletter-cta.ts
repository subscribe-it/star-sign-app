import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { NewsletterService } from '../../../core/services/newsletter.service';
import { NotificationService } from '../../../core/services/notification';
import { AnalyticsService } from '../../../core/services/analytics.service';
import { RuntimeConfigService } from '../../../core/services/runtime-config.service';
import { TurnstileWidget } from '../turnstile/turnstile-widget';

/**
 * Inline newsletter call-to-action for content pages (blog detail, horoscope
 * reader, tarot result). Mirrors the GDPR-correct flow of the home hero
 * newsletter form: e-mail input + REQUIRED marketing-consent checkbox, optional
 * Cloudflare Turnstile when enabled at runtime, double-opt-in messaging and a
 * 'newsletter_signup' analytics event. The submit button stays disabled until a
 * valid e-mail is entered and consent is granted.
 *
 * It reuses (not forks) the existing NewsletterService and consent pattern, so
 * subscriptions land in the same plumbing as the home form. The `source` input
 * is forwarded to the backend payload and to analytics so signups can be
 * attributed to the surface they came from (e.g. 'blog-detail', 'horoscope',
 * 'tarot').
 *
 * Self-contained, calm, on-brand card panel that reads well on both the light
 * mystic backgrounds (blog / horoscope) and the dark tarot result background.
 * SSR-safe: no direct window/document access; all browser-only work lives in
 * the analytics/turnstile services which already guard the platform.
 */
@Component({
  selector: 'app-newsletter-cta',
  standalone: true,
  imports: [RouterLink, TurnstileWidget],
  templateUrl: './newsletter-cta.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsletterCtaComponent {
  private readonly newsletterService = inject(NewsletterService);
  private readonly notificationService = inject(NotificationService);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly runtimeConfig = inject(RuntimeConfigService);
  private readonly turnstileWidget = viewChild(TurnstileWidget);

  /**
   * Attribution source forwarded to the subscribe payload and the
   * 'newsletter_signup' analytics event (e.g. 'blog-detail', 'horoscope',
   * 'tarot'). Keep it stable and meaningful so signups can be attributed.
   */
  public readonly source = input.required<string>();

  /** Optional heading override; defaults to the home newsletter wording. */
  public readonly heading = input('Codzienny horoskop na e-mail');

  /** Optional supporting copy override. */
  public readonly description = input(
    'Spodobało Ci się? Zapisz się, jeśli chcesz wracać po krótką codzienną wskazówkę.',
  );

  public readonly sent = signal(false);
  public readonly errorMessage = signal<string | null>(null);
  public readonly loading = signal(false);
  public readonly consent = signal(false);
  public readonly email = signal('');

  private readonly turnstileToken = signal('');
  public readonly turnstileRequired = computed(() =>
    this.runtimeConfig.turnstileEnabled(),
  );

  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  public readonly emailValid = computed(() =>
    this.emailRegex.test(this.email().trim()),
  );

  public readonly submitDisabled = computed(
    () =>
      this.loading() ||
      !this.emailValid() ||
      !this.consent() ||
      (this.turnstileRequired() && !this.turnstileToken()),
  );

  public onSubmit(event: Event): void {
    event.preventDefault();
    if (this.loading()) {
      return;
    }

    const email = this.email().trim();
    if (!email) {
      this.errorMessage.set('Podaj adres e-mail.');
      return;
    }

    if (!this.emailRegex.test(email)) {
      this.errorMessage.set('Podaj poprawny adres e-mail.');
      return;
    }

    if (!this.consent()) {
      this.errorMessage.set(
        'Zaznacz zgodę na otrzymywanie newslettera, aby kontynuować.',
      );
      return;
    }

    if (this.turnstileRequired() && !this.turnstileToken()) {
      this.errorMessage.set('Potwierdź, że nie jesteś botem.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const source = this.source();

    this.newsletterService
      .subscribe({
        email,
        marketingConsent: this.consent(),
        source: `${source}-cta`,
        turnstileToken: this.turnstileToken() || undefined,
      })
      .subscribe({
        next: () => {
          this.sent.set(true);
          this.loading.set(false);
          this.analyticsService.trackEvent('newsletter_signup', { source });
          this.notificationService.success(
            'Dziękujemy za zapis! Sprawdź swoją skrzynkę e-mail, aby potwierdzić subskrypcję. ✦',
          );
          this.email.set('');
          this.consent.set(false);
          this.resetTurnstile();
        },
        error: (error) => {
          this.errorMessage.set(
            'Nie udało się zapisać. Spróbuj ponownie za chwilę.',
          );
          this.analyticsService.trackEvent('newsletter_error', {
            source,
            error: error?.message,
          });
          this.notificationService.error(
            'Coś poszło nie tak. Spróbuj ponownie za chwilę.',
          );
          this.loading.set(false);
          this.resetTurnstile();
        },
      });
  }

  public onEmailInput(value: string): void {
    this.email.set(value);
    if (this.errorMessage()) {
      this.errorMessage.set(null);
    }
  }

  public handleTurnstileToken(token: string): void {
    this.turnstileToken.set(token);
  }

  private resetTurnstile(): void {
    this.turnstileToken.set('');
    this.turnstileWidget()?.reset();
  }
}
