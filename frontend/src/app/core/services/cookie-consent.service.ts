import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CookieService } from 'ngx-cookie-service';

export const COOKIE_CONSENT_STORAGE_KEY = 'cookie-consent';
export const COOKIE_CONSENT_VERSION = 1;

const LEGACY_CONSENT_COOKIE = 'cookie-consent-v2';

export interface CookieConsentDecision {
  version: number;
  timestamp: string;
  analytics: boolean;
  marketing: boolean;
}

export interface CookieConsentChoice {
  analytics: boolean;
  marketing: boolean;
}

/**
 * Holds the GDPR cookie consent state for the whole app.
 *
 * - Decision is persisted in localStorage (SSR-safe, browser only).
 * - `bannerVisible` drives the consent banner; `reopen()` lets the user
 *   change the decision later (e.g. via the footer link).
 */
@Injectable({
  providedIn: 'root',
})
export class CookieConsentService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cookieService = inject(CookieService);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly decisionSignal = signal<CookieConsentDecision | null>(
    this.readStoredDecision(),
  );

  public readonly decision = this.decisionSignal.asReadonly();
  public readonly hasDecision = computed(() => this.decisionSignal() !== null);
  public readonly analyticsAllowed = computed(
    () => this.decisionSignal()?.analytics === true,
  );
  public readonly marketingAllowed = computed(
    () => this.decisionSignal()?.marketing === true,
  );

  public readonly bannerVisible = signal(false);

  public acceptAll(marketingEnabled = false): void {
    this.save({ analytics: true, marketing: marketingEnabled });
  }

  public acceptNecessaryOnly(): void {
    this.save({ analytics: false, marketing: false });
  }

  public save(choice: CookieConsentChoice): void {
    const decision: CookieConsentDecision = {
      version: COOKIE_CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      analytics: choice.analytics,
      marketing: choice.marketing,
    };

    this.persist(decision);
    this.decisionSignal.set(decision);
    this.bannerVisible.set(false);
  }

  /** Re-opens the banner so the user can change the decision later. */
  public reopen(): void {
    this.bannerVisible.set(true);
  }

  public dismiss(): void {
    this.bannerVisible.set(false);
  }

  private persist(decision: CookieConsentDecision): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      window.localStorage.setItem(
        COOKIE_CONSENT_STORAGE_KEY,
        JSON.stringify(decision),
      );
    } catch {
      // Storage may be unavailable (private mode / quota) – fail silently.
    }
  }

  private readStoredDecision(): CookieConsentDecision | null {
    if (!this.isBrowser) {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CookieConsentDecision>;
        if (
          parsed &&
          parsed.version === COOKIE_CONSENT_VERSION &&
          typeof parsed.analytics === 'boolean'
        ) {
          return {
            version: COOKIE_CONSENT_VERSION,
            timestamp:
              typeof parsed.timestamp === 'string'
                ? parsed.timestamp
                : new Date(0).toISOString(),
            analytics: parsed.analytics,
            marketing: parsed.marketing === true,
          };
        }
        return null;
      }

      return this.migrateLegacyCookie();
    } catch {
      return null;
    }
  }

  /** Users who decided via the old cookie should not be asked again. */
  private migrateLegacyCookie(): CookieConsentDecision | null {
    const legacy = this.cookieService.get(LEGACY_CONSENT_COOKIE);
    if (!legacy) {
      return null;
    }

    try {
      const parsed = JSON.parse(legacy) as { analytics?: unknown; marketing?: unknown };
      const decision: CookieConsentDecision = {
        version: COOKIE_CONSENT_VERSION,
        timestamp: new Date().toISOString(),
        analytics: parsed.analytics === true,
        marketing: parsed.marketing === true,
      };
      this.persist(decision);
      return decision;
    } catch {
      return null;
    }
  }
}
