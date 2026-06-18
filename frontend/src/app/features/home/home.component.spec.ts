import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HomeComponent } from './home.component';
import { ZodiacService } from '../../core/services/zodiac.service';
import { ArticleService } from '../../core/services/article.service';
import { NewsletterService } from '../../core/services/newsletter.service';
import { NotificationService } from '../../core/services/notification';
import { ProductService } from '../../core/services/product.service';
import { SeoService } from '../../core/services/seo.service';
import { of, Subject, throwError } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { provideIcons } from '@ng-icons/core';
import {
  simpleInstagram,
  simpleTiktok,
  simplePinterest,
} from '@ng-icons/simple-icons';
import { vi } from 'vitest';
import { featureFlags } from '../../core/feature-flags';
import { RuntimeConfigService } from '../../core/services/runtime-config.service';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let zodiacService: any;
  let articleService: any;
  let newsletterService: any;
  let productService: any;
  let turnstileEnabled: ReturnType<typeof signal<boolean>>;
  let turnstileConfig: ReturnType<
    typeof signal<{ enabled: boolean; siteKey: string }>
  >;

  beforeEach(async () => {
    featureFlags.shopEnabled = false;
    featureFlags.adsEnabled = false;
    zodiacService = {
      getZodiacSigns: vi.fn().mockReturnValue(of([])),
    };
    articleService = {
      getRecentArticles: vi.fn().mockReturnValue(of([])),
    };
    newsletterService = {
      subscribe: vi.fn(),
    };
    productService = {
      getProducts: vi.fn().mockReturnValue(of([])),
    };
    turnstileEnabled = signal(false);
    turnstileConfig = signal({ enabled: false, siteKey: '' });

    await TestBed.configureTestingModule({
      imports: [HomeComponent, RouterTestingModule],
      providers: [
        { provide: ZodiacService, useValue: zodiacService },
        { provide: ArticleService, useValue: articleService },
        { provide: NewsletterService, useValue: newsletterService },
        { provide: ProductService, useValue: productService },
        {
          provide: RuntimeConfigService,
          useValue: {
            turnstileEnabled,
            turnstile: turnstileConfig,
          },
        },
        NotificationService,
        SeoService,
        provideIcons({ simpleInstagram, simpleTiktok, simplePinterest }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    featureFlags.shopEnabled = false;
    featureFlags.adsEnabled = false;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load zodiac signs on init', () => {
    expect(zodiacService.getZodiacSigns).toHaveBeenCalled();
  });

  it('should handle newsletter subscription success', () => {
    newsletterService.subscribe.mockReturnValue(of({ accepted: true }));
    const emailInput = document.createElement('input');
    emailInput.value = 'test@example.com';
    component.newsletterConsent.set(true);

    component.onSubmitNewsletter(new Event('submit'), emailInput);

    expect(newsletterService.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com',
        marketingConsent: true,
      }),
    );
    expect(component.newsletterSent()).toBe(true);
  });

  it('should require marketing consent before subscribing to newsletter', () => {
    const emailInput = document.createElement('input');
    emailInput.value = 'test@example.com';
    component.newsletterConsent.set(false);

    component.onSubmitNewsletter(new Event('submit'), emailInput);

    expect(component.newsletterError()).toBe(
      'Zaznacz zgodę na otrzymywanie newslettera, aby kontynuować.',
    );
    expect(newsletterService.subscribe).not.toHaveBeenCalled();
  });

  it('should update SEO on init', () => {
    const seoService = TestBed.inject(SeoService);
    const spy = vi.spyOn(seoService, 'updateSeo');
    // Test constructor call
    TestBed.createComponent(HomeComponent);
    expect(spy).toHaveBeenCalled();
  });

  it('should handle signs loading error', () => {
    zodiacService.getZodiacSigns.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.signsError()).toBe('Nie udało się pobrać znaków zodiaku.');
  });

  it('should handle articles loading error', () => {
    articleService.getRecentArticles.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.articlesError()).toBe(
      'Nie udało się pobrać najnowszych artykułów.',
    );
  });

  it('should show error for empty email in newsletter', () => {
    const emailInput = document.createElement('input');
    emailInput.value = '';
    component.onSubmitNewsletter(new Event('submit'), emailInput);
    expect(component.newsletterError()).toBe('Podaj adres e-mail.');
  });

  it('should render zodiac signs and recent articles in the DOM', () => {
    zodiacService.getZodiacSigns.mockReturnValue(
      of([
        {
          id: 1,
          name: 'Baran',
          slug: 'baran',
          date_range: '21.03 - 19.04',
          element: 'Ogień',
        },
      ]),
    );
    articleService.getRecentArticles.mockReturnValue(
      of([
        {
          id: 10,
          title: 'Kosmiczny poradnik',
          slug: 'kosmiczny-poradnik',
          excerpt: 'Krótki opis',
          read_time_minutes: 4,
          category: { name: 'Astrologia' },
          isPremium: true,
        },
      ]),
    );

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(
      host.querySelector('[data-test="home-zodiac-sign-baran"]')?.textContent,
    ).toContain('Baran');
    expect(
      host.querySelector('[data-test="home-article-card-10"]')?.textContent,
    ).toContain('Kosmiczny poradnik');
    expect(
      host
        .querySelector<HTMLAnchorElement>('[data-test="home-article-card-10"]')
        ?.getAttribute('href'),
    ).toBe('/artykuly/kosmiczny-poradnik');
  });

  it('should separate newsletter copy from premium circle copy', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Codzienny horoskop na e-mail');
    expect(host.textContent).toContain('Zapisz mnie');
    expect(host.textContent).not.toContain('Dołącz do Magicznego Kręgu');
    expect(
      host
        .querySelector<HTMLAnchorElement>('[data-test="home-hero-premium"]')
        ?.getAttribute('href'),
    ).toBe('/premium');
  });

  it('should render special horoscope type cards as links', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(
      host
        .querySelector<HTMLAnchorElement>(
          '[data-test="home-horoscope-type-chinski"]',
        )
        ?.getAttribute('href'),
    ).toBe('/horoskopy/chinski');
    expect(
      host
        .querySelector<HTMLAnchorElement>(
          '[data-test="home-horoscope-type-celtycki"]',
        )
        ?.getAttribute('href'),
    ).toBe('/horoskopy/celtycki');
    expect(
      host
        .querySelector<HTMLAnchorElement>(
          '[data-test="home-horoscope-type-egipski"]',
        )
        ?.getAttribute('href'),
    ).toBe('/horoskopy/egipski');
  });

  it('should hide advertisement slots when ads feature flag is disabled', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(component.adsEnabled).toBe(false);
    expect(host.textContent).not.toContain('REKLAMA');
    expect(host.textContent).not.toContain('Odkryj Magiczne Amulety');
  });

  it('should render advertisement slots when ads feature flag is enabled', () => {
    featureFlags.adsEnabled = true;

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(component.adsEnabled).toBe(true);
    expect(host.textContent).toContain('REKLAMA');
    expect(host.textContent).toContain('Odkryj Magiczne Amulety');
  });

  it('should load and render shop teaser products when shop is enabled', () => {
    featureFlags.shopEnabled = true;
    productService.getProducts.mockReturnValue(
      of([
        {
          id: 1,
          documentId: 'p1',
          name: 'Amulet',
          slug: 'amulet',
          description: 'A',
          price: 50,
          category: 'Talizmany',
        },
        {
          id: 2,
          documentId: 'p2',
          name: 'Kryształ',
          slug: 'krysztal',
          description: 'B',
          price: 80,
          category: 'Kamienie',
        },
        {
          id: 3,
          documentId: 'p3',
          name: 'Świeca',
          slug: 'swieca',
          description: 'C',
          price: 30,
          category: 'Rytuały',
        },
        {
          id: 4,
          documentId: 'p4',
          name: 'Kadzidło',
          slug: 'kadzidlo',
          description: 'D',
          price: 20,
          category: 'Rytuały',
        },
      ]),
    );

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(productService.getProducts).toHaveBeenCalled();
    expect(component.shopItems().map((product) => product.name)).toEqual([
      'Amulet',
      'Kryształ',
      'Świeca',
    ]);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Magiczny Sklep');
    expect(
      host
        .querySelector<HTMLAnchorElement>('[data-test="home-shop-product-p1"]')
        ?.getAttribute('href'),
    ).toBe('/sklep/produkt/p1');
  });

  it('should not render placeholder social links', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(component.socials).toEqual([]);
    expect(host.querySelector('a[href="#"]')).toBeNull();
  });

  it('should show shop teaser empty state on product loading error', () => {
    featureFlags.shopEnabled = true;
    productService.getProducts.mockReturnValue(
      throwError(() => new Error('products failed')),
    );

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.shopItemsError()).toBe('Nie udało się pobrać produktów.');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Nie udało się pobrać produktów.',
    );
  });

  it('should reject invalid newsletter email', () => {
    const emailInput = document.createElement('input');
    emailInput.value = 'not-an-email';

    component.onSubmitNewsletter(new Event('submit'), emailInput);

    expect(component.newsletterError()).toBe('Podaj poprawny adres e-mail.');
    expect(newsletterService.subscribe).not.toHaveBeenCalled();
  });

  it('should block duplicate newsletter submits while request is pending', () => {
    const pendingSubscribe = new Subject<unknown>();
    newsletterService.subscribe.mockReturnValue(pendingSubscribe);
    const emailInput = document.createElement('input');
    emailInput.value = 'test@example.com';
    component.newsletterConsent.set(true);

    component.onSubmitNewsletter(new Event('submit'), emailInput);
    component.onSubmitNewsletter(new Event('submit'), emailInput);

    expect(newsletterService.subscribe).toHaveBeenCalledTimes(1);
    expect(component.newsletterLoading()).toBe(true);

    pendingSubscribe.next({ accepted: true });
    pendingSubscribe.complete();

    expect(component.newsletterSent()).toBe(true);
  });

  it('should require and include Turnstile token when runtime config enables it', () => {
    turnstileEnabled.set(true);
    turnstileConfig.set({ enabled: true, siteKey: 'site-key' });
    newsletterService.subscribe.mockReturnValue(of({ accepted: true }));
    const emailInput = document.createElement('input');
    emailInput.value = 'test@example.com';
    component.newsletterConsent.set(true);

    component.onSubmitNewsletter(new Event('submit'), emailInput);

    expect(component.newsletterError()).toBe('Potwierdź, że nie jesteś botem.');
    expect(newsletterService.subscribe).not.toHaveBeenCalled();

    component.handleNewsletterTurnstileToken('token-123');
    component.onSubmitNewsletter(new Event('submit'), emailInput);

    expect(newsletterService.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ turnstileToken: 'token-123' }),
    );
  });

  it('should reset newsletter Turnstile token after subscribe error', () => {
    turnstileEnabled.set(true);
    turnstileConfig.set({ enabled: true, siteKey: 'site-key' });
    newsletterService.subscribe.mockReturnValue(
      throwError(() => new Error('subscribe failed')),
    );
    const emailInput = document.createElement('input');
    emailInput.value = 'test@example.com';
    component.newsletterConsent.set(true);

    component.handleNewsletterTurnstileToken('token-123');
    component.onSubmitNewsletter(new Event('submit'), emailInput);

    expect(component.newsletterTurnstileToken()).toBe('');
    expect(component.newsletterError()).toBe(
      'Nie udało się zapisać. Spróbuj ponownie za chwilę.',
    );
  });
});
