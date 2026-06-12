import {
  Component,
  ChangeDetectionStrategy,
  PLATFORM_ID,
  signal,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnalyticsService } from '../../services/analytics.service';
import {
  CookieConsentChoice,
  CookieConsentService,
} from '../../services/cookie-consent.service';
import { featureFlags } from '../../feature-flags';

export interface CookieConsent {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

@Component({
  selector: 'app-cookie-banner',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cookie-banner.html',
  styleUrl: './cookie-banner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CookieBanner implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly consentService = inject(CookieConsentService);

  public readonly isVisible = this.consentService.bannerVisible;
  public readonly showSettings = signal(false);
  public readonly adsEnabled = featureFlags.adsEnabled;

  public readonly consent = signal<CookieConsent>({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (!this.consentService.hasDecision()) {
      setTimeout(() => this.consentService.reopen(), 1500);
    }
  }

  public acceptAll(): void {
    this.saveConsent({ analytics: true, marketing: this.adsEnabled });
  }

  public acceptSelected(): void {
    const selected = this.consent();
    this.saveConsent({
      analytics: selected.analytics,
      marketing: selected.marketing,
    });
  }

  public declineAll(): void {
    this.saveConsent({ analytics: false, marketing: false });
  }

  public toggleSettings(): void {
    this.showSettings.update((v) => !v);
  }

  public updateOption(key: keyof CookieConsent, event: Event): void {
    if (key === 'marketing' && !this.adsEnabled) {
      return;
    }

    const checked = (event.target as HTMLInputElement).checked;
    this.consent.update((prev) => ({ ...prev, [key]: checked }));
  }

  private saveConsent(choice: CookieConsentChoice): void {
    const normalized: CookieConsentChoice = {
      analytics: choice.analytics,
      marketing: this.adsEnabled && choice.marketing,
    };

    this.consentService.save(normalized);
    this.showSettings.set(false);

    if (normalized.analytics) {
      this.analyticsService.onConsentGranted();
    } else {
      this.analyticsService.onConsentRevoked();
    }
  }
}
