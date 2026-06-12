import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { vi } from 'vitest';
import {
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_VERSION,
  CookieConsentService,
} from './cookie-consent.service';

describe('CookieConsentService', () => {
  let cookieServiceMock: { get: ReturnType<typeof vi.fn> };

  const createService = (platformId: 'browser' | 'server' = 'browser') => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        CookieConsentService,
        { provide: CookieService, useValue: cookieServiceMock },
        { provide: PLATFORM_ID, useValue: platformId },
      ],
    });
    return TestBed.inject(CookieConsentService);
  };

  beforeEach(() => {
    window.localStorage.clear();
    cookieServiceMock = {
      get: vi.fn().mockReturnValue(''),
    };
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should report no decision and hidden banner on first visit', () => {
    const service = createService();

    expect(service.hasDecision()).toBe(false);
    expect(service.analyticsAllowed()).toBe(false);
    expect(service.bannerVisible()).toBe(false);
  });

  it('should persist a versioned decision with timestamp in localStorage', () => {
    const service = createService();

    service.save({ analytics: true, marketing: false });

    const stored = JSON.parse(
      window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) ?? 'null',
    );
    expect(stored).toEqual({
      version: COOKIE_CONSENT_VERSION,
      timestamp: expect.any(String),
      analytics: true,
      marketing: false,
    });
    expect(service.hasDecision()).toBe(true);
    expect(service.analyticsAllowed()).toBe(true);
    expect(service.bannerVisible()).toBe(false);
  });

  it('should store analytics=false for necessary-only consent', () => {
    const service = createService();

    service.acceptNecessaryOnly();

    expect(service.hasDecision()).toBe(true);
    expect(service.analyticsAllowed()).toBe(false);
    expect(service.marketingAllowed()).toBe(false);
  });

  it('should restore a stored decision on startup', () => {
    window.localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: COOKIE_CONSENT_VERSION,
        timestamp: new Date().toISOString(),
        analytics: true,
        marketing: false,
      }),
    );

    const service = createService();

    expect(service.hasDecision()).toBe(true);
    expect(service.analyticsAllowed()).toBe(true);
  });

  it('should ignore stored decisions with an unknown version', () => {
    window.localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      JSON.stringify({ version: 999, analytics: true }),
    );

    const service = createService();

    expect(service.hasDecision()).toBe(false);
    expect(service.analyticsAllowed()).toBe(false);
  });

  it('should ignore malformed stored values', () => {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, 'not-json');

    const service = createService();

    expect(service.hasDecision()).toBe(false);
  });

  it('should migrate a legacy cookie decision without re-prompting', () => {
    cookieServiceMock.get.mockImplementation((name: string) =>
      name === 'cookie-consent-v2'
        ? JSON.stringify({ necessary: true, analytics: true, marketing: false })
        : '',
    );

    const service = createService();

    expect(service.hasDecision()).toBe(true);
    expect(service.analyticsAllowed()).toBe(true);
    expect(
      window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY),
    ).toBeTruthy();
  });

  it('should reopen and dismiss the banner', () => {
    const service = createService();

    service.reopen();
    expect(service.bannerVisible()).toBe(true);

    service.dismiss();
    expect(service.bannerVisible()).toBe(false);
  });

  it('should hide the banner after saving a decision', () => {
    const service = createService();
    service.reopen();

    service.acceptAll();

    expect(service.bannerVisible()).toBe(false);
    expect(service.analyticsAllowed()).toBe(true);
  });

  it('should not touch localStorage on the server platform', () => {
    const service = createService('server');

    service.save({ analytics: true, marketing: false });

    expect(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBeNull();
    // In-memory state still works so SSR rendering does not crash.
    expect(service.hasDecision()).toBe(true);
  });
});
