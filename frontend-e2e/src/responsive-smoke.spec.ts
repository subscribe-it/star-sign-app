import { test, expect, type Page } from '@playwright/test';
import { mockApi } from './support/mock-api';

type ViewportPreset = {
  name: string;
  width: number;
  height: number;
  cookieTitleMaxHeight: number;
};

type ResponsiveRoute = {
  path: string;
  name: string;
  requiresAuth?: boolean;
};

const authStorageKey = 'star-sign-auth-session';

const viewports: ViewportPreset[] = [
  { name: 'mobile', width: 390, height: 844, cookieTitleMaxHeight: 80 },
  { name: 'tablet', width: 768, height: 1024, cookieTitleMaxHeight: 64 },
  { name: 'desktop', width: 1440, height: 900, cookieTitleMaxHeight: 64 },
];

const routes: ResponsiveRoute[] = [
  { path: '/', name: 'home' },
  { path: '/horoskopy', name: 'horoscopes' },
  { path: '/horoskopy/dzienny/baran', name: 'horoscope reader' },
  { path: '/znaki/baran', name: 'zodiac profile' },
  { path: '/tarot', name: 'tarot hub' },
  { path: '/tarot/karta-dnia', name: 'daily tarot' },
  { path: '/numerologia', name: 'numerology' },
  { path: '/premium', name: 'premium' },
  { path: '/artykuly', name: 'blog list' },
  { path: '/artykuly/energia-wiosny', name: 'blog detail' },
  { path: '/kosmogram', name: 'natal chart', requiresAuth: true },
  { path: '/panel', name: 'account panel', requiresAuth: true },
  { path: '/logowanie', name: 'login' },
  { path: '/rejestracja', name: 'register' },
  { path: '/kontakt', name: 'contact' },
  { path: '/o-nas', name: 'about' },
  {
    path: '/checkout/success?session_id=cs_test_mock',
    name: 'checkout success',
  },
  { path: '/checkout/cancel', name: 'checkout cancel' },
];

const authSession = {
  jwt: 'e2e-token',
  user: {
    id: 1,
    username: 'E2E Tester',
    email: 'tester@example.com',
  },
};

const seedConsentCookie = async (
  page: Page,
  baseURL: string | undefined,
): Promise<void> => {
  await page.context().addCookies([
    {
      name: 'cookie-consent-v2',
      value: encodeURIComponent(
        JSON.stringify({ necessary: true, analytics: false, marketing: false }),
      ),
      url: baseURL || 'http://localhost:4300',
    },
  ]);
};

const seedAuthSession = async (page: Page): Promise<void> => {
  await page.addInitScript(
    ({ key, session }) => {
      window.localStorage.setItem(key, JSON.stringify(session));
    },
    { key: authStorageKey, session: authSession },
  );
};

const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return Math.max(root.scrollWidth, body.scrollWidth) - window.innerWidth;
  });

  expect(overflow).toBeLessThanOrEqual(1);
};

const expectNoTextControlsOutsideViewport = async (
  page: Page,
): Promise<void> => {
  const offenders = await page.evaluate(() => {
    const selector = [
      'a',
      'button',
      'input',
      'textarea',
      'select',
      'label',
      'h1',
      'h2',
      'h3',
      'p',
      'span',
      'nav',
    ].join(',');

    return Array.from(document.body.querySelectorAll(selector))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const text = (
          (element as HTMLElement).innerText ||
          element.getAttribute('aria-label') ||
          ''
        )
          .replace(/\s+/g, ' ')
          .trim();

        return {
          tag: element.tagName.toLowerCase(),
          text: text.slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          hidden:
            rect.width < 1 ||
            rect.height < 1 ||
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            Number(style.opacity) === 0 ||
            !text,
        };
      })
      .filter((item) => !item.hidden)
      .filter((item) => item.left < -1 || item.right > window.innerWidth + 1)
      .slice(0, 8);
  });

  expect(offenders).toEqual([]);
};

const expectElementCenterUncovered = async (
  page: Page,
  selector: string,
): Promise<void> => {
  const covered = await page.locator(selector).evaluate(
    (element, selector) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const topElement = document.elementFromPoint(centerX, centerY);

      return Boolean(
        topElement &&
          topElement !== element &&
          !element.contains(topElement) &&
          !topElement.closest(selector),
      );
    },
    selector,
  );

  expect(covered).toBe(false);
};

const expectHomeNewsletterLayout = async (
  page: Page,
  viewportWidth: number,
): Promise<void> => {
  const inputBox = await page
    .locator('[data-test="home-newsletter-input"]')
    .boundingBox();
  const buttonBox = await page
    .locator('[data-test="home-newsletter-submit"]')
    .boundingBox();

  expect(inputBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();

  if (!inputBox || !buttonBox || viewportWidth >= 1024) {
    return;
  }

  expect(Math.abs(inputBox.x - buttonBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(inputBox.width - buttonBox.width)).toBeLessThanOrEqual(1);
  expect(buttonBox.y).toBeGreaterThanOrEqual(inputBox.y + inputBox.height + 8);
};

test.describe('responsive layout smoke', () => {
  for (const viewport of viewports) {
    test.describe(`${viewport.name}`, () => {
      for (const route of routes) {
        test(`${route.name} does not overflow`, async ({ page, baseURL }) => {
          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height,
          });
          await mockApi(page);
          await seedConsentCookie(page, baseURL);

          if (route.requiresAuth) {
            await seedAuthSession(page);
          }

          await page.goto(route.path);

          await expect(page.locator('[data-test="navbar-logo"]')).toBeVisible();
          await expect(page.locator('h1').first()).toBeVisible();

          if (viewport.width < 1024) {
            await expect(
              page.locator('[data-test="navbar-mobile-toggle"]'),
            ).toBeVisible();
          } else {
            await expect(
              page
                .locator('[data-test="navbar-link-artykuly"]')
                .filter({ visible: true }),
            ).toBeVisible();
          }

          await expectNoHorizontalOverflow(page);
          await expectNoTextControlsOutsideViewport(page);

          if (route.path === '/') {
            await expectElementCenterUncovered(
              page,
              '[data-test="home-hero-start"]',
            );
            await expectElementCenterUncovered(
              page,
              '[data-test="home-hero-premium"]',
            );
            await expectHomeNewsletterLayout(page, viewport.width);
          }
        });
      }
    });
  }
});

test.describe('cookie banner responsive layout', () => {
  for (const viewport of viewports) {
    test(`does not cover primary CTA on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await mockApi(page);
      await page.goto('/');

      const banner = page.locator('[data-test="cookie-banner"]');
      const title = page.locator('[data-test="cookie-banner-title"]');
      await expect(banner).toBeVisible({ timeout: 4000 });
      await expect(title).toBeVisible();
      await expect(
        page.locator('[data-test="cookie-accept-all-button"]'),
      ).toBeVisible();

      const bannerBox = await banner.boundingBox();
      expect(bannerBox?.height ?? viewport.height).toBeLessThanOrEqual(
        viewport.height * (viewport.width < 640 ? 0.45 : 0.35),
      );

      const titleBox = await title.boundingBox();
      expect(titleBox?.height ?? viewport.height).toBeLessThanOrEqual(
        viewport.cookieTitleMaxHeight,
      );

      await expectElementCenterUncovered(page, '[data-test="home-hero-start"]');
      await expectElementCenterUncovered(
        page,
        '[data-test="home-hero-premium"]',
      );
      await expectNoHorizontalOverflow(page);
    });
  }
});
