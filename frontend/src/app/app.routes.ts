import { Routes } from '@angular/router';
import { authGuard, guestOnlyGuard } from './core/guards/auth.guard';
import { shopFeatureGuard } from './core/guards/feature.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'znaki/:sign',
    loadComponent: () =>
      import('./features/zodiac-profile/zodiac-profile').then(
        (m) => m.ZodiacProfile,
      ),
  },
  {
    path: 'horoskopy',
    loadComponent: () =>
      import('./features/horoscope/horoscope').then((m) => m.Horoscope),
  },
  {
    path: 'horoskopy/:type',
    loadComponent: () =>
      import('./features/horoscope-type/horoscope-type').then(
        (m) => m.HoroscopeType,
      ),
  },
  {
    path: 'horoskopy/:type/:sign',
    loadComponent: () =>
      import('./features/horoscope-reader/horoscope-reader').then(
        (m) => m.HoroscopeReader,
      ),
  },
  {
    path: 'tarot',
    loadComponent: () => import('./features/tarot/tarot').then((m) => m.Tarot),
  },
  {
    path: 'tarot/karta-dnia',
    loadComponent: () =>
      import('./features/tarot-result/tarot-result').then((m) => m.TarotResult),
  },
  {
    path: 'artykuly',
    loadComponent: () =>
      import('./features/blog-list/blog-list').then((m) => m.BlogList),
  },
  {
    path: 'artykuly/:slug',
    loadComponent: () =>
      import('./features/blog-detail/blog-detail').then((m) => m.BlogDetail),
  },
  {
    path: 'redakcja/:key',
    loadComponent: () =>
      import('./features/author/author').then((m) => m.Author),
  },
  {
    path: 'sklep',
    canMatch: [shopFeatureGuard],
    loadComponent: () =>
      import('./features/shop-home/shop-home').then((m) => m.ShopHome),
  },
  {
    path: 'numerologia',
    loadComponent: () =>
      import('./features/numerology/numerology').then((m) => m.Numerology),
  },
  {
    path: 'premium',
    loadComponent: () =>
      import('./features/premium/premium').then((m) => m.Premium),
    title: 'Dołącz do Magicznego Kręgu - Star Sign',
  },
  {
    path: 'kosmogram',
    loadComponent: () =>
      import('./features/natal-chart/natal-chart').then(
        (m) => m.NatalChartComponent,
      ),
    title: 'Twój Kosmogram - Star Sign',
  },
  {
    path: 'sklep/produkt/:id',
    canMatch: [shopFeatureGuard],
    loadComponent: () =>
      import('./features/product-detail/product-detail').then(
        (m) => m.ProductDetail,
      ),
  },
  {
    path: 'checkout/success',
    loadComponent: () =>
      import('./features/checkout-success/checkout-success').then(
        (m) => m.CheckoutSuccess,
      ),
  },
  {
    path: 'checkout/cancel',
    loadComponent: () =>
      import('./features/checkout-cancel/checkout-cancel').then(
        (m) => m.CheckoutCancel,
      ),
  },
  {
    path: 'logowanie',
    canActivate: [guestOnlyGuard],
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'rejestracja',
    canActivate: [guestOnlyGuard],
    loadComponent: () =>
      import('./features/auth/register/register').then((m) => m.Register),
  },
  {
    path: 'panel',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/panel/panel').then((m) => m.AccountPanel),
  },
  {
    path: 'panel/subskrypcja',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/panel/panel').then((m) => m.AccountPanel),
  },
  {
    path: 'regulamin',
    data: { page: 'terms' },
    loadComponent: () =>
      import('./features/legal/legal-page').then((m) => m.LegalPage),
  },
  {
    path: 'polityka-prywatnosci',
    data: { page: 'privacy' },
    loadComponent: () =>
      import('./features/legal/legal-page').then((m) => m.LegalPage),
  },
  {
    path: 'cookies',
    data: { page: 'cookies' },
    loadComponent: () =>
      import('./features/legal/legal-page').then((m) => m.LegalPage),
  },
  {
    path: 'disclaimer',
    data: { page: 'disclaimer' },
    loadComponent: () =>
      import('./features/legal/legal-page').then((m) => m.LegalPage),
  },
  {
    path: 'newsletter/potwierdz',
    data: { action: 'confirm' },
    loadComponent: () =>
      import('./features/newsletter-action/newsletter-action').then(
        (m) => m.NewsletterActionPage,
      ),
  },
  {
    path: 'newsletter/wypisz',
    data: { action: 'unsubscribe' },
    loadComponent: () =>
      import('./features/newsletter-action/newsletter-action').then(
        (m) => m.NewsletterActionPage,
      ),
  },
  {
    path: 'o-nas',
    loadComponent: () => import('./features/about/about').then((m) => m.About),
    title: 'O nas - Star Sign',
  },
  {
    path: 'kontakt',
    loadComponent: () =>
      import('./features/contact/contact').then((m) => m.Contact),
    title: 'Kontakt - Star Sign',
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found').then((m) => m.NotFound),
    title: 'Star Sign - 404',
  },
];
