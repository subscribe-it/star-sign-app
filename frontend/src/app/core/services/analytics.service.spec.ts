import { TestBed } from '@angular/core/testing';
import { AnalyticsService } from './analytics.service';
import { CookieService } from 'ngx-cookie-service';
import { PLATFORM_ID } from '@angular/core';
import { RuntimeConfigService } from './runtime-config.service';
import { CookieConsentService } from './cookie-consent.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { EMPTY, of } from 'rxjs';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let cookieServiceMock: any;
  let httpClientMock: { post: ReturnType<typeof vi.fn> };
  let consentServiceMock: { analyticsAllowed: ReturnType<typeof vi.fn> };
  let runtimeConfigMock: {
    ga4MeasurementId: ReturnType<typeof vi.fn>;
    gtmContainerId: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    cookieServiceMock = {
      get: vi.fn().mockReturnValue(''),
      set: vi.fn(),
    };
    httpClientMock = {
      post: vi.fn(() => of({ accepted: true })),
    };
    consentServiceMock = {
      analyticsAllowed: vi.fn().mockReturnValue(false),
    };
    runtimeConfigMock = {
      ga4MeasurementId: vi.fn().mockReturnValue(''),
      gtmContainerId: vi.fn().mockReturnValue(''),
    };

    TestBed.configureTestingModule({
      providers: [
        AnalyticsService,
        { provide: CookieService, useValue: cookieServiceMock },
        { provide: HttpClient, useValue: httpClientMock },
        { provide: RuntimeConfigService, useValue: runtimeConfigMock },
        { provide: CookieConsentService, useValue: consentServiceMock },
        { provide: Router, useValue: { events: EMPTY, url: '/test' } },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(AnalyticsService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as any).gtag;
    delete (window as any).dataLayer;
    delete (window as any)['ga-disable-G-TEST'];
    const scripts = document.head.querySelectorAll(
      'script[src*="googletagmanager"]',
    );
    scripts.forEach((s) => s.remove());
    window.sessionStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should not load GA when no consent decision exists', () => {
    consentServiceMock.analyticsAllowed.mockReturnValue(false);
    const spy = vi.spyOn(document.head, 'appendChild');

    service.init();
    expect(spy).not.toHaveBeenCalled();
  });

  it('should not load GA if analytics consent is false', () => {
    consentServiceMock.analyticsAllowed.mockReturnValue(false);
    runtimeConfigMock.ga4MeasurementId.mockReturnValue('G-TEST');
    const spy = vi.spyOn(document.head, 'appendChild');

    service.init();
    expect(spy).not.toHaveBeenCalled();
  });

  it('should load GA if analytics consent is true and GA ID is set', () => {
    consentServiceMock.analyticsAllowed.mockReturnValue(true);
    runtimeConfigMock.ga4MeasurementId.mockReturnValue('G-TEST');

    const spy = vi.spyOn(document.head, 'appendChild');

    service.init();
    expect(spy).toHaveBeenCalled();
    const script = spy.mock.calls[0][0] as HTMLScriptElement;
    expect(script.src).toContain('googletagmanager.com/gtag/js?id=G-TEST');
  });

  it('should load GTM before GA when a GTM container is configured', () => {
    consentServiceMock.analyticsAllowed.mockReturnValue(true);
    runtimeConfigMock.ga4MeasurementId.mockReturnValue('G-TEST');
    runtimeConfigMock.gtmContainerId.mockReturnValue('GTM-ABC123');

    const spy = vi.spyOn(document.head, 'appendChild');

    service.init();
    service.trackEvent('premium_content_view', { content_id: 'h-1' });

    expect(spy).toHaveBeenCalled();
    const script = spy.mock.calls[0][0] as HTMLScriptElement;
    expect(script.src).toContain('googletagmanager.com/gtm.js?id=GTM-ABC123');
    expect((window as any).dataLayer).toContainEqual(
      expect.objectContaining({
        event: 'premium_content_view',
        content_id: 'h-1',
      }),
    );
  });

  it('should not init if not in browser', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AnalyticsService,
        { provide: CookieService, useValue: cookieServiceMock },
        { provide: HttpClient, useValue: httpClientMock },
        { provide: RuntimeConfigService, useValue: runtimeConfigMock },
        { provide: CookieConsentService, useValue: consentServiceMock },
        { provide: Router, useValue: { events: EMPTY, url: '/test' } },
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    const ssrService = TestBed.inject(AnalyticsService);
    const spy = vi.spyOn(document.head, 'appendChild');
    ssrService.init();
    expect(spy).not.toHaveBeenCalled();
  });

  it('should track events only with consent', () => {
    service.trackEvent('test_event');
    expect((window as any).dataLayer).toBeUndefined();

    consentServiceMock.analyticsAllowed.mockReturnValue(true);
    runtimeConfigMock.ga4MeasurementId.mockReturnValue('G-123');
    service.init();

    service.trackEvent('test_event', { foo: 'bar' });
    expect((window as any).dataLayer).toContainEqual(
      expect.arrayContaining([
        'event',
        'test_event',
        expect.objectContaining({ foo: 'bar' }),
      ]),
    );
  });

  it('should handle late consent', () => {
    service.setGaId('G-LATE');
    service.onConsentGranted();
    expect((window as any).gtag).toBeDefined();
  });

  it('should stop tracking after consent is revoked', () => {
    consentServiceMock.analyticsAllowed.mockReturnValue(true);
    runtimeConfigMock.ga4MeasurementId.mockReturnValue('G-TEST');
    service.init();

    service.onConsentRevoked();

    const before = ((window as any).dataLayer || []).length;
    service.trackEvent('after_revoke');
    expect(((window as any).dataLayer || []).length).toBe(before);
    expect((window as any)['ga-disable-G-TEST']).toBe(true);
  });

  it('should ignore placeholder GA IDs', () => {
    consentServiceMock.analyticsAllowed.mockReturnValue(true);
    runtimeConfigMock.ga4MeasurementId.mockReturnValue('G-XXXXXXXXXX');
    const spy = vi.spyOn(document.head, 'appendChild');

    service.init();

    expect(spy).not.toHaveBeenCalled();
  });

  it('should emit standard e-commerce events', () => {
    consentServiceMock.analyticsAllowed.mockReturnValue(true);
    runtimeConfigMock.ga4MeasurementId.mockReturnValue('G-TEST');
    service.init();

    service.trackAddToCart(
      {
        id: 1,
        documentId: 'product-1',
        name: 'Amulet',
        slug: 'amulet',
        description: 'Test',
        price: 25,
        currency: 'PLN',
        category: 'Talizmany',
      },
      2,
    );

    expect((window as any).dataLayer).toContainEqual(
      expect.arrayContaining([
        'event',
        'add_to_cart',
        expect.objectContaining({
          currency: 'PLN',
          value: 50,
          items: [
            expect.objectContaining({
              item_id: 'product-1',
              item_name: 'Amulet',
              quantity: 2,
            }),
          ],
        }),
      ]),
    );
  });

  it('should send first-party premium analytics without GA consent', () => {
    consentServiceMock.analyticsAllowed.mockReturnValue(false);

    service.trackDailyHoroscopeView({
      content_type: 'horoscope',
      content_id: 'horoscope-baran-dzienny',
      content_slug: 'dzienny-baran',
      sign_slug: 'baran',
      horoscope_period: 'dzienny',
      premium_mode: 'open',
      access_state: 'open',
    });

    expect(httpClientMock.post).toHaveBeenCalledWith(
      '/api/analytics/events',
      expect.objectContaining({
        event_type: 'daily_horoscope_view',
        visitor_id: expect.any(String),
        session_id: expect.any(String),
        content_id: 'horoscope-baran-dzienny',
        premium_access_policy: 'open_access',
        funnel_step: 'daily_horoscope_view',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Skip-Error-Notification': 'true',
          'X-Skip-Loading': 'true',
        }),
      }),
    );
    expect((window as any).dataLayer).toBeUndefined();
  });

  it('should enrich paid Premium analytics with paid access policy', () => {
    service.trackPremiumCtaClick({
      content_type: 'premium_page',
      premium_mode: 'paid',
      access_state: 'paid',
    });

    expect(httpClientMock.post).toHaveBeenCalledWith(
      '/api/analytics/events',
      expect.objectContaining({
        event_type: 'premium_cta_click',
        premium_mode: 'paid',
        premium_access_policy: 'paid_enforced',
        funnel_step: 'premium_cta_click',
      }),
      expect.any(Object),
    );
  });
});
