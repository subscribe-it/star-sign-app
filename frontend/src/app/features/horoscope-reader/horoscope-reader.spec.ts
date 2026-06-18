import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HoroscopeReader } from './horoscope-reader';
import { ZodiacService } from '../../core/services/zodiac.service';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { vi } from 'vitest';
import { featureFlags } from '../../core/feature-flags';
import { signal, type WritableSignal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { AccountService } from '../../core/services/account.service';
import { SeoService } from '../../core/services/seo.service';
import { AnalyticsService } from '../../core/services/analytics.service';

describe('HoroscopeReader', () => {
  let component: HoroscopeReader;
  let fixture: ComponentFixture<HoroscopeReader>;
  let zodiacService: any;
  let loggedIn: WritableSignal<boolean>;
  let accountMe$: Subject<any>;
  let accountService: any;

  beforeEach(async () => {
    featureFlags.adsEnabled = false;
    loggedIn = signal(false);
    accountMe$ = new Subject<any>();
    accountService = {
      getMe: vi.fn(() => accountMe$.asObservable()),
    };
    zodiacService = {
      getHoroscope: vi.fn().mockReturnValue(of({ content: 'Luck is coming' })),
    };

    await TestBed.configureTestingModule({
      imports: [HoroscopeReader, RouterTestingModule],
      providers: [
        { provide: ZodiacService, useValue: zodiacService },
        { provide: AuthService, useValue: { isLoggedIn: loggedIn } },
        { provide: AccountService, useValue: accountService },
        {
          provide: SeoService,
          useValue: {
            updateSeo: vi.fn(),
            absoluteUrl: (p: string) => `https://star-sign.pl${p}`,
            setBreadcrumbsJsonLd: vi.fn(),
          },
        },
        {
          provide: AnalyticsService,
          useValue: {
            trackEvent: vi.fn(),
            trackDailyHoroscopeView: vi.fn(),
            trackPremiumContentImpression: vi.fn(),
            trackPremiumContentView: vi.fn(),
            trackPremiumCtaClick: vi.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ type: 'dzienny', sign: 'baran' })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HoroscopeReader);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    featureFlags.adsEnabled = false;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load horoscope based on route', () => {
    expect(zodiacService.getHoroscope).toHaveBeenCalledWith('dzienny', 'baran');
    expect(component.data()?.horoscope?.content).toBe('Luck is coming');
  });

  it('should reload horoscope when premium access is confirmed', async () => {
    fixture.destroy();
    zodiacService.getHoroscope.mockClear();
    loggedIn.set(true);

    fixture = TestBed.createComponent(HoroscopeReader);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(zodiacService.getHoroscope).toHaveBeenCalledTimes(1);

    accountMe$.next({ subscription: { isPremium: true } });
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(zodiacService.getHoroscope).toHaveBeenCalledTimes(2);
  });

  it('should handle error', () => {
    zodiacService.getHoroscope.mockReturnValue(
      throwError(() => new Error('API Fail')),
    );
    // Trigger reload
    fixture = TestBed.createComponent(HoroscopeReader);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.error()).toBe('Nie udało się pobrać tego horoskopu.');
  });

  it('should resolve UI labels for special horoscope types', () => {
    expect(component.getTypeLabel('chinski')).toBe('Chiński');
    expect(component.getTypeLabel('celtycki')).toBe('Celtycki');
    expect(component.getTypeLabel('egipski')).toBe('Egipski');
  });

  it('should hide ad banner when ads feature flag is disabled', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(component.adsEnabled).toBe(false);
    expect(host.textContent).not.toContain('Miejsce na Twoją Reklamę');
  });

  it('should show free horoscope content and premium teaser for non-premium users', () => {
    zodiacService.getHoroscope.mockReturnValue(
      of({
        content: 'Public horoscope content',
        hasPremiumContent: true,
      }),
    );

    fixture = TestBed.createComponent(HoroscopeReader);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('Public horoscope content');
    expect(text).toContain('Pełna interpretacja Premium');
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector('[data-test="horoscope-premium-preview"] a')
        ?.getAttribute('href'),
    ).toBe('/premium');
  });

  it('should show ad banner when ads feature flag is enabled', () => {
    featureFlags.adsEnabled = true;

    fixture = TestBed.createComponent(HoroscopeReader);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.adsEnabled).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Miejsce na Twoją Reklamę',
    );
  });
});
