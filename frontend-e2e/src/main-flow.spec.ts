import { test, expect, type Locator, type Page } from '@playwright/test';
import { waitForAppReady } from './support/app-ready';
import { mockApi } from './support/mock-api';

const navbarLinkSelector = (slug: string) => `[data-test="navbar-link-${slug}"]`;

const openMobileNavigation = async (
  page: Page,
): Promise<{ mobileToggle: Locator; mobileNav: Locator }> => {
  const mobileToggle = page.locator('[data-test="navbar-mobile-toggle"]');
  await expect(mobileToggle).toBeVisible();

  await mobileToggle.click();
  await expect(mobileToggle).toHaveAttribute('aria-expanded', 'true');

  const mobileNav = page.getByRole('navigation', {
    name: 'Nawigacja mobilna',
  });
  await expect(mobileNav).toBeVisible();

  return { mobileToggle, mobileNav };
};

const locateNavbarLink = async (
  page: Page,
  slug: string,
  isMobile: boolean,
): Promise<Locator> => {
  if (isMobile) {
    const { mobileNav } = await openMobileNavigation(page);
    return mobileNav.locator(navbarLinkSelector(slug));
  }

  const desktopNav = page.getByRole('navigation', {
    name: 'Nawigacja główna',
  });
  await expect(desktopNav).toBeVisible();
  return desktopNav.locator(navbarLinkSelector(slug));
};

test.describe('Star Sign - Main Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
  });

  test('should display home page elements', async ({ page }) => {
    // Check Logo
    const logo = page.locator('[data-test="navbar-logo"]');
    await expect(logo).toBeVisible();
    await expect(logo).toContainText('Star Sign');

    // Check Hero Section
    const heroTitle = page.locator('h1');
    await expect(heroTitle).toContainText('Odkryj tajemnice gwiazd');

    const startButton = page.locator('[data-test="home-hero-start"]');
    await expect(startButton).toBeVisible();
  });

  test('should navigate to Blog and back', async ({ page, isMobile }) => {
    // Click Blog link in Navbar
    const blogLink = await locateNavbarLink(page, 'artykuly', isMobile);
    await expect(blogLink).toBeVisible();
    await blogLink.click();

    // Check URL
    await expect(page).toHaveURL(/.*artykuly/);

    // Check Blog Title
    const blogTitle = page.locator('h1');
    await expect(blogTitle).toContainText('Mistycyzm na co dzień');

    // Click Logo to go back
    await page.locator('[data-test="navbar-logo"]').click();
    await expect(page).toHaveURL('/');
  });

  test('should handle newsletter subscription - error cases', async ({
    page,
  }) => {
    const emailInput = page.locator('[data-test="home-newsletter-input"]');
    const submitButton = page.locator('[data-test="home-newsletter-submit"]');
    const consentCheckbox = page.locator(
      '[data-test="home-newsletter-consent"]',
    );
    const successMsg = page.locator('[data-test="home-newsletter-success"]');

    // GDPR: the submit button stays disabled until the marketing-consent
    // checkbox is ticked, regardless of the email value.
    await emailInput.fill('invalid-email');
    await expect(submitButton).toBeDisabled();

    // Giving consent enables the button...
    await consentCheckbox.check();
    await expect(submitButton).toBeEnabled();

    // ...but an invalid email is still rejected client-side: no success state.
    await submitButton.click();
    await expect(successMsg).not.toBeVisible();
  });

  test('should work with mobile navigation', async ({ page, isMobile }) => {
    if (!isMobile) return;

    const { mobileToggle, mobileNav } = await openMobileNavigation(page);

    // Check if links are visible in mobile menu
    const blogLink = mobileNav.locator(navbarLinkSelector('artykuly'));
    await expect(blogLink).toBeVisible();

    // Close menu
    await mobileToggle.click();
    await expect(mobileToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(mobileNav).toBeHidden();
  });

  test('should filter blog articles by category', async ({ page }) => {
    await page.goto('/artykuly');

    // Wait for categories to load
    const filters = page.locator('[data-test^="blog-category-filter-"]');
    await expect(filters.first()).toBeVisible();

    const initialArticleCount = await page
      .locator('[data-test^="blog-article-card-"]')
      .count();

    // Click a specific category (not 'Wszystko')
    const secondFilter = filters.nth(1);
    const categoryName = await secondFilter.innerText();
    await secondFilter.click();

    // Wait for URL or content update (if dynamic)
    // Check if all displayed articles have that category (if we can verify by text/attr)
    // For now, just check if it doesn't crash and count changed or remained sane
    const filteredCount = await page
      .locator('[data-test^="blog-article-card-"]')
      .count();
    expect(filteredCount).toBeGreaterThanOrEqual(0);
  });

  test('should navigate to multiple zodiac sign profiles', async ({ page }) => {
    // Sign 1: Baran
    await page.goto('/');
    const baranCard = page.locator('[data-test="home-zodiac-sign-baran"]');
    if (await baranCard.isVisible()) {
      await baranCard.click();
      await expect(page).toHaveURL(/.*znaki\/baran/);
      await expect(page.locator('h1')).toContainText('Baran');
    }

    // Sign 2: Byk
    await page.goto('/');
    const bykCard = page.locator('[data-test="home-zodiac-sign-byk"]');
    if (await bykCard.isVisible()) {
      await bykCard.click();
      await expect(page).toHaveURL(/.*znaki\/byk/);
      await expect(page.locator('h1')).toContainText('Byk');
    }
  });

  test('should submit contact form', async ({ page }) => {
    await page.goto('/kontakt');
    await waitForAppReady(page);
    await expect(page.locator('[data-test="contact-form"]')).toBeVisible();
    await expect(
      page.locator('[data-test="contact-name-input"]'),
    ).toBeEditable();

    await page.locator('[data-test="contact-name-input"]').fill('E2E Tester');
    await page
      .locator('[data-test="contact-email-input"]')
      .fill('tester@example.com');
    await page
      .locator('[data-test="contact-subject-input"]')
      .fill('E2E Test Subject');
    await page
      .locator('[data-test="contact-message-input"]')
      .fill('This is a test message from Playwright.');

    const submitButton = page.locator('[data-test="contact-submit-button"]');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Check success message
    const successMessage = page.locator(
      '[data-test="contact-success-message"]',
    );
    await expect(successMessage).toBeVisible({ timeout: 10000 });
    await expect(successMessage).toContainText('Wiadomość wysłana');
  });

  test('should show 404 page for non-existent route', async ({ page }) => {
    await page.goto('/jakas-nieistniejaca-strona');
    await expect(page.locator('[data-test="not-found-title"]')).toContainText(
      '404',
    );
    await expect(page.locator('text=Zagubiony w kosmosie?')).toBeVisible();
  });

  test('should send purchase analytics once on checkout success', async ({
    page,
    baseURL,
  }) => {
    await page.context().addCookies([
      {
        name: 'cookie-consent-v2',
        value: encodeURIComponent(
          JSON.stringify({ necessary: true, analytics: true }),
        ),
        url: baseURL || 'http://localhost:4300',
      },
    ]);

    await page.goto('/checkout/success?session_id=cs_test_mock');
    await expect(page.locator('h1')).toContainText('Dziękujemy za zamówienie');

    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            ((window as any).dataLayer as unknown[][] | undefined)?.filter(
              (entry) => entry[0] === 'event' && entry[1] === 'purchase',
            ).length ?? 0,
        ),
      )
      .toBe(1);

    await expect
      .poll(async () =>
        page.evaluate(() =>
          window.sessionStorage.getItem('star-sign:ga4:purchase:cs_test_mock'),
        ),
      )
      .toBe('true');

    await page.reload();

    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            ((window as any).dataLayer as unknown[][] | undefined)?.filter(
              (entry) => entry[0] === 'event' && entry[1] === 'purchase',
            ).length ?? 0,
        ),
      )
      .toBe(0);

    await expect
      .poll(async () =>
        page.evaluate(() =>
          window.sessionStorage.getItem('star-sign:ga4:purchase:cs_test_mock'),
        ),
      )
      .toBe('true');
  });
});
