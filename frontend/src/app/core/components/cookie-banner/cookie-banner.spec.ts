import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CookieBanner } from './cookie-banner';
import { CookieService } from 'ngx-cookie-service';
import { RouterTestingModule } from '@angular/router/testing';
import { AnalyticsService } from '../../services/analytics.service';
import {
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_VERSION,
  CookieConsentService,
} from '../../services/cookie-consent.service';
import { vi } from 'vitest';
import { featureFlags } from '../../feature-flags';

describe('CookieBanner', () => {
  let component: CookieBanner;
  let fixture: ComponentFixture<CookieBanner>;
  let consentService: CookieConsentService;
  let analyticsService: {
    onConsentGranted: ReturnType<typeof vi.fn>;
    onConsentRevoked: ReturnType<typeof vi.fn>;
  };

  const storedDecision = () =>
    JSON.parse(
      window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) ?? 'null',
    );

  const createComponent = async () => {
    await TestBed.configureTestingModule({
      imports: [CookieBanner, RouterTestingModule],
      providers: [
        CookieConsentService,
        { provide: CookieService, useValue: { get: vi.fn(() => '') } },
        { provide: AnalyticsService, useValue: analyticsService },
      ],
    }).compileComponents();

    consentService = TestBed.inject(CookieConsentService);
    fixture = TestBed.createComponent(CookieBanner);
    component = fixture.componentInstance;
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    window.localStorage.clear();
    featureFlags.adsEnabled = false;
    analyticsService = {
      onConsentGranted: vi.fn(),
      onConsentRevoked: vi.fn(),
    };

    await createComponent();
  });

  afterEach(() => {
    window.localStorage.clear();
    featureFlags.adsEnabled = false;
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be visible if no consent decision is stored', () => {
    component.ngOnInit();
    vi.advanceTimersByTime(1500);
    expect(component.isVisible()).toBe(true);
  });

  it('should NOT be visible if a consent decision exists', () => {
    window.localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: COOKIE_CONSENT_VERSION,
        timestamp: new Date().toISOString(),
        analytics: false,
        marketing: false,
      }),
    );
    TestBed.resetTestingModule();

    return (async () => {
      await createComponent();
      component.ngOnInit();
      vi.advanceTimersByTime(1500);
      expect(component.isVisible()).toBe(false);
    })();
  });

  it('should save consent in localStorage on acceptAll', () => {
    component.acceptAll();

    expect(storedDecision()).toEqual({
      version: COOKIE_CONSENT_VERSION,
      timestamp: expect.any(String),
      analytics: true,
      marketing: false,
    });
    expect(component.isVisible()).toBe(false);
    expect(analyticsService.onConsentGranted).toHaveBeenCalled();
  });

  it('should save minimal consent on declineAll and revoke analytics', () => {
    component.declineAll();

    expect(storedDecision()).toEqual({
      version: COOKIE_CONSENT_VERSION,
      timestamp: expect.any(String),
      analytics: false,
      marketing: false,
    });
    expect(component.isVisible()).toBe(false);
    expect(analyticsService.onConsentGranted).not.toHaveBeenCalled();
    expect(analyticsService.onConsentRevoked).toHaveBeenCalled();
  });

  it('should expose "Tylko niezbędne" on the first banner layer', () => {
    component.isVisible.set(true);
    fixture.detectChanges();

    const declineButton = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLButtonElement>('[data-test="cookie-decline-button"]');

    expect(declineButton?.textContent).toContain('Tylko niezbędne');
    declineButton?.click();

    expect(storedDecision()).toEqual(
      expect.objectContaining({ analytics: false, marketing: false }),
    );
  });

  it('should render "Akceptuję wszystkie" and a policy link to /cookies', () => {
    component.isVisible.set(true);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const acceptButton = host.querySelector<HTMLButtonElement>(
      '[data-test="cookie-accept-all-button"]',
    );
    const policyLink = host.querySelector<HTMLAnchorElement>(
      '[data-test="cookie-policy-link"]',
    );

    expect(acceptButton?.textContent).toContain('Akceptuję wszystkie');
    expect(policyLink?.getAttribute('href')).toBe('/cookies');
  });

  it('should expose dialog accessibility attributes', () => {
    component.isVisible.set(true);
    fixture.detectChanges();

    const shell = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-test="cookie-banner"]',
    );

    expect(shell?.getAttribute('role')).toBe('dialog');
    expect(shell?.getAttribute('aria-label')).toBe('Zgody na pliki cookie');
    expect(shell?.getAttribute('aria-live')).toBe('polite');
  });

  it('should reopen via the consent service after a decision', () => {
    component.acceptAll();
    expect(component.isVisible()).toBe(false);

    consentService.reopen();
    expect(component.isVisible()).toBe(true);
  });

  it('should leave optional consent disabled by default in settings', () => {
    expect(component.consent()).toEqual({
      necessary: true,
      analytics: false,
      marketing: false,
    });
  });

  it('should toggle settings and update selected options', () => {
    expect(component.showSettings()).toBe(false);
    component.toggleSettings();
    expect(component.showSettings()).toBe(true);

    component.updateOption('analytics', {
      target: { checked: false },
    } as unknown as Event);
    component.updateOption('marketing', {
      target: { checked: true },
    } as unknown as Event);

    expect(component.consent()).toEqual({
      necessary: true,
      analytics: false,
      marketing: false,
    });
  });

  it('should save selected consent without analytics callback when analytics is off', () => {
    component.updateOption('analytics', {
      target: { checked: false },
    } as unknown as Event);
    component.acceptSelected();

    expect(storedDecision()).toEqual(
      expect.objectContaining({ analytics: false, marketing: false }),
    );
    expect(analyticsService.onConsentGranted).not.toHaveBeenCalled();
  });

  it('should render marketing consent only when ads feature flag is enabled', () => {
    component.isVisible.set(true);
    component.toggleSettings();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Marketingowe',
    );

    featureFlags.adsEnabled = true;
    fixture = TestBed.createComponent(CookieBanner);
    component = fixture.componentInstance;
    component.isVisible.set(true);
    component.toggleSettings();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Marketingowe',
    );
  });

  it('should render action buttons and handle settings flow from DOM', () => {
    component.isVisible.set(true);
    fixture.detectChanges();

    const settingsButton = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLButtonElement>('[data-test="cookie-settings-button"]');
    settingsButton?.click();
    fixture.detectChanges();

    expect(component.showSettings()).toBe(true);
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const saveSelectedButton = buttons[buttons.length - 1] as HTMLButtonElement;
    saveSelectedButton.click();

    expect(storedDecision()).not.toBeNull();
  });
});
