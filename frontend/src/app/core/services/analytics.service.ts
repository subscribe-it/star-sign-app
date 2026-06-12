import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { filter } from 'rxjs/operators';
import {
  CartItem,
  CheckoutAnalyticsSummary,
  Ga4Item,
  Product,
} from '@star-sign-monorepo/shared-types';
import { RuntimeConfigService } from './runtime-config.service';
import { CookieConsentService } from './cookie-consent.service';

type GtagFunction = (...args: [command: string, ...params: unknown[]]) => void;
type AnalyticsParams = Record<string, unknown>;
type DataLayerEntry = unknown[] | Record<string, unknown>;
type FirstPartyEventName =
  | 'daily_horoscope_view'
  | 'premium_content_impression'
  | 'premium_content_view'
  | 'premium_cta_click'
  | 'premium_pricing_view'
  | 'begin_checkout'
  | 'checkout_redirect'
  | 'purchase'
  | 'premium_subscription_conversion';
declare global {
  interface Window {
    dataLayer?: DataLayerEntry[];
    gtag?: GtagFunction;
  }
}

const VISITOR_COOKIE_NAME = 'star-sign-visitor-id';
const SESSION_STORAGE_KEY = 'star-sign-analytics-session';

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cookieService = inject(CookieService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly runtimeConfig = inject(RuntimeConfigService);
  private readonly consentService = inject(CookieConsentService);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private gaId = '';
  private gtmId = '';
  private hasConsent = signal(false);

  public init(): void {
    if (!this.isBrowser) return;

    this.setGaId(this.runtimeConfig.ga4MeasurementId());
    this.setGtmId(this.runtimeConfig.gtmContainerId());
    this.checkConsent();
    this.setupRouteTracking();
  }

  private checkConsent(): void {
    if (this.consentService.analyticsAllowed()) {
      this.hasConsent.set(true);
      this.loadGoogleAnalytics();
    }
  }

  private setupRouteTracking(): void {
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
      )
      .subscribe((event) => {
        this.trackPageView(event.urlAfterRedirects);
      });
  }

  private loadGoogleAnalytics(): void {
    if (!this.isBrowser) return;

    if (this.gtmId) {
      this.loadGoogleTagManager();
      return;
    }

    if (!this.gaId) return;
    if (window.gtag) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.gaId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    const gtag: GtagFunction = (...args) => {
      window.dataLayer?.push(args);
    };
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', this.gaId, {
      anonymize_ip: true,
      send_page_view: false,
    });
  }

  private loadGoogleTagManager(): void {
    if (!this.gtmId || !this.isBrowser) return;
    if (document.getElementById('star-sign-gtm-script')) return;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'gtm.js',
      'gtm.start': new Date().getTime(),
    });

    const script = document.createElement('script');
    script.id = 'star-sign-gtm-script';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${this.gtmId}`;
    document.head.appendChild(script);
  }

  public trackPageView(url: string): void {
    if (!this.isBrowser || !this.hasConsent()) return;

    this.pushGoogleEvent('page_view', {
      page_path: url,
      page_location: window.location.href,
      page_title: document.title,
    });
  }

  public trackEvent(eventName: string, params: AnalyticsParams = {}): void {
    if (!this.isBrowser || !this.hasConsent()) {
      return;
    }

    this.pushGoogleEvent(eventName, params);
  }

  public trackProductEvent(
    eventName: FirstPartyEventName,
    params: AnalyticsParams = {},
  ): void {
    const enrichedParams = this.enrichPremiumParams(eventName, params);
    this.trackFirstPartyEvent(eventName, enrichedParams);
    this.trackEvent(eventName, enrichedParams);
  }

  public trackDailyHoroscopeView(params: AnalyticsParams = {}): void {
    this.trackProductEvent('daily_horoscope_view', params);
  }

  public trackPremiumContentImpression(params: AnalyticsParams = {}): void {
    this.trackProductEvent('premium_content_impression', params);
  }

  public trackPremiumContentView(params: AnalyticsParams = {}): void {
    this.trackProductEvent('premium_content_view', params);
  }

  public trackPremiumCtaClick(params: AnalyticsParams = {}): void {
    this.trackProductEvent('premium_cta_click', params);
  }

  public trackPremiumPricingView(params: AnalyticsParams = {}): void {
    this.trackProductEvent('premium_pricing_view', params);
  }

  public trackCheckoutRedirect(params: AnalyticsParams = {}): void {
    this.trackProductEvent('checkout_redirect', params);
  }

  public trackPremiumSubscriptionConversion(
    params: AnalyticsParams = {},
  ): void {
    this.trackProductEvent('premium_subscription_conversion', params);
  }

  private pushGoogleEvent(
    eventName: string,
    params: AnalyticsParams = {},
  ): void {
    const payload = {
      ...params,
      timestamp: new Date().toISOString(),
    };

    if (this.gtmId) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: eventName,
        ...payload,
      });
    }

    const gtag = window.gtag;
    if (gtag) {
      gtag('event', eventName, payload);
    }
  }

  private enrichPremiumParams(
    eventName: FirstPartyEventName,
    params: AnalyticsParams,
  ): AnalyticsParams {
    const premiumMode = params['premium_mode'];
    const premiumAccessPolicy =
      params['premium_access_policy'] ||
      (premiumMode === 'open'
        ? 'open_access'
        : premiumMode === 'paid'
          ? 'paid_enforced'
          : undefined);

    return {
      premium_access_policy: premiumAccessPolicy,
      funnel_step: params['funnel_step'] || eventName,
      ...params,
    };
  }

  public trackFeatureUse(
    featureName: string,
    details: AnalyticsParams = {},
  ): void {
    this.trackEvent('feature_use', {
      feature_name: featureName,
      ...details,
    });
  }

  public trackViewItem(product: Product): void {
    const item = this.toGa4Item(product);
    this.trackEvent('view_item', {
      currency: product.currency || 'PLN',
      value: product.price,
      items: [item],
    });
  }

  public trackAddToCart(product: Product, quantity = 1): void {
    const item = this.toGa4Item(product, quantity);
    this.trackEvent('add_to_cart', {
      currency: product.currency || 'PLN',
      value: product.price * quantity,
      items: [item],
    });
  }

  public trackBeginCheckout(
    items: ReadonlyArray<CartItem | Ga4Item>,
    context: AnalyticsParams = {},
  ): void {
    const ga4Items = items.map((item) => this.toGa4Item(item));
    const firstCurrency = this.resolveCurrency(items[0]);
    const computedValue = ga4Items.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
      0,
    );

    this.trackProductEvent('begin_checkout', {
      currency: context['currency'] || firstCurrency || 'PLN',
      value: context['value'] ?? computedValue,
      items: ga4Items,
      ...context,
    });
  }

  public trackPurchase(summary: CheckoutAnalyticsSummary): void {
    if (summary.status !== 'paid') {
      return;
    }

    this.trackProductEvent('purchase', {
      transaction_id: summary.orderDocumentId,
      currency: summary.currency,
      value: summary.total,
      items: summary.items.map(
        (item) =>
          ({
            item_id: item.productDocumentId,
            item_name: item.productName,
            price: item.unitPrice,
            quantity: item.quantity,
          }) satisfies Ga4Item,
      ),
    });
  }

  public setGaId(id: string): void {
    this.gaId = this.normalizeGaId(id);
    if (this.hasConsent()) {
      this.loadGoogleAnalytics();
    }
  }

  public setGtmId(id: string): void {
    this.gtmId = this.normalizeGtmId(id);
    if (this.hasConsent()) {
      this.loadGoogleAnalytics();
    }
  }

  /**
   * Called when user accepts cookies after initial load
   */
  public onConsentGranted(): void {
    if (!this.hasConsent()) {
      this.hasConsent.set(true);
      this.loadGoogleAnalytics();
      this.trackPageView(this.router.url);
    }

    if (this.isBrowser && this.gaId) {
      (window as unknown as Record<string, unknown>)[
        `ga-disable-${this.gaId}`
      ] = false;
    }
  }

  /**
   * Called when the user withdraws analytics consent
   * (e.g. reopened the banner via "Zarządzaj zgodami" and declined).
   */
  public onConsentRevoked(): void {
    if (!this.hasConsent()) {
      return;
    }

    this.hasConsent.set(false);

    if (this.isBrowser && this.gaId) {
      (window as unknown as Record<string, unknown>)[
        `ga-disable-${this.gaId}`
      ] = true;
    }
  }

  private normalizeGaId(id: string): string {
    const trimmed = id.trim();
    if (
      !trimmed ||
      /^(replace_me.*|changeme|change_me|your_.+|G-X+)$/i.test(trimmed)
    ) {
      return '';
    }

    return /^G-[A-Z0-9]+$/i.test(trimmed) ? trimmed : '';
  }

  private normalizeGtmId(id: string): string {
    const trimmed = id.trim();
    if (
      !trimmed ||
      /^(replace_me.*|changeme|change_me|your_.+|GTM-X+)$/i.test(trimmed)
    ) {
      return '';
    }

    return /^GTM-[A-Z0-9]+$/i.test(trimmed) ? trimmed : '';
  }

  private trackFirstPartyEvent(
    eventName: FirstPartyEventName,
    params: AnalyticsParams,
  ): void {
    if (!this.isBrowser) {
      return;
    }

    const payload = {
      ...params,
      ...this.getUtmParams(),
      event_type: eventName,
      occurred_at: new Date().toISOString(),
      visitor_id: this.getVisitorId(),
      session_id: this.getSessionId(),
      route:
        typeof params['route'] === 'string' && params['route'].trim()
          ? params['route']
          : this.router.url,
      referrer:
        typeof params['referrer'] === 'string'
          ? params['referrer']
          : document.referrer,
      metadata: this.buildMetadata(params),
    };

    this.http
      .post('/api/analytics/events', payload, {
        headers: {
          'X-Skip-Error-Notification': 'true',
          'X-Skip-Loading': 'true',
        },
      })
      .subscribe({
        error: () => undefined,
      });
  }

  private getVisitorId(): string {
    const existing = this.cookieService.get(VISITOR_COOKIE_NAME);
    if (existing) {
      return existing;
    }

    const visitorId = this.createId();
    this.cookieService.set(VISITOR_COOKIE_NAME, visitorId, {
      expires: 365,
      path: '/',
      sameSite: 'Lax',
    });
    return visitorId;
  }

  private getSessionId(): string {
    try {
      const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (existing) {
        return existing;
      }

      const sessionId = this.createId();
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      return sessionId;
    } catch {
      return this.createId();
    }
  }

  private createId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  private getUtmParams(): AnalyticsParams {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      utm_source: searchParams.get('utm_source') || undefined,
      utm_medium: searchParams.get('utm_medium') || undefined,
      utm_campaign: searchParams.get('utm_campaign') || undefined,
    };
  }

  private buildMetadata(params: AnalyticsParams): AnalyticsParams {
    return {
      checkout_type: params['checkout_type'],
      premium_access_policy: params['premium_access_policy'],
      funnel_step: params['funnel_step'],
      cta_location: params['cta_location'],
      ui_surface: params['ui_surface'],
      transaction_id: params['transaction_id'],
      items: params['items'],
    };
  }

  private toGa4Item(
    input: Product | CartItem | Ga4Item,
    quantity = 1,
  ): Ga4Item {
    if ('product' in input) {
      return this.toGa4Item(input.product, input.quantity);
    }

    if ('item_id' in input) {
      return input;
    }

    return {
      item_id: input.sku || input.documentId,
      item_name: input.name,
      item_brand: 'Star Sign',
      item_category: input.category,
      price: input.price,
      quantity,
    };
  }

  private resolveCurrency(
    input: CartItem | Ga4Item | undefined,
  ): string | undefined {
    if (!input || !('product' in input)) {
      return undefined;
    }

    return input.product.currency;
  }
}
