import { test, expect } from '@playwright/test';
import { mockApi } from './support/mock-api';

test.describe('Soft premium flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test('routes home premium CTA to the Premium page', async ({ page }) => {
    await page.goto('/');

    await page.locator('[data-test="home-hero-premium"]').click();

    await expect(page).toHaveURL(/\/premium$/);
    await expect(
      page.getByRole('heading', { name: /Magiczny Krąg/ }),
    ).toBeVisible();
  });

  test('shows free horoscope content and open premium content', async ({
    page,
  }) => {
    await page.goto('/horoskopy/dzienny/baran');

    await expect(
      page.getByText(
        'Darmowy horoskop dla Barana: dzień sprzyja spokojnym decyzjom.',
      ),
    ).toBeVisible();
    await expect(
      page.locator('[data-test="horoscope-premium-preview"]'),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-test="horoscope-premium-preview"]')
        .getByText('Relacje: wybierz jedną szczerą rozmowę.'),
    ).toBeVisible();
  });

  test('tracks daily horoscope and premium content views first-party', async ({
    page,
  }) => {
    await page.unroute('**/api/analytics/events');
    const analyticsEvents: unknown[] = [];
    await page.route('**/api/analytics/events', (route) => {
      analyticsEvents.push(route.request().postDataJSON());
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ accepted: true, uniqueDaily: true }),
      });
    });

    await page.goto('/horoskopy/dzienny/baran');

    await expect
      .poll(() =>
        analyticsEvents.some(
          (event) =>
            (event as Record<string, unknown>)['event_type'] ===
            'daily_horoscope_view',
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        analyticsEvents.some(
          (event) =>
            (event as Record<string, unknown>)['event_type'] ===
              'premium_content_view' &&
            (event as Record<string, unknown>)['content_id'] ===
              'horoscope-baran-dzienny',
        ),
      )
      .toBe(true);
  });

  test('shows public article content and a soft premium add-on', async ({
    page,
  }) => {
    await page.goto('/artykuly/energia-wiosny');

    await expect(
      page.getByText(
        'Publiczny fragment artykułu o energii wiosny jest dostępny bez konta.',
      ),
    ).toBeVisible();
    await expect(
      page.locator('[data-test="article-premium-preview"]'),
    ).toBeVisible();
    await expect(
      page.locator(
        '[data-test="newsletter-cta"][data-test-source="blog-detail"]',
      ),
    ).toBeVisible();
  });

  test('keeps daily tarot readable and adds the premium analysis teaser', async ({
    page,
  }) => {
    await page.goto('/tarot/karta-dnia');

    await expect(
      page.getByRole('heading', { level: 1, name: /^(Gwiazda|The Star)$/ }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Darmowe przesłanie karty dnia pokazuje kierunek bez blokady kontem.',
      ),
    ).toBeVisible();
    await expect(
      page.locator('[data-test="tarot-premium-preview"]'),
    ).toBeVisible();
  });

  test('presents the Premium page as a free-vs-premium upgrade', async ({
    page,
  }) => {
    await page.goto('/premium');

    await expect(
      page.getByRole('heading', { name: /Magiczny Krąg/ }),
    ).toBeVisible();
    await expect(page.getByText('Darmowa ścieżka')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Pełniejsza praca z treścią' }),
    ).toBeVisible();
  });
});
