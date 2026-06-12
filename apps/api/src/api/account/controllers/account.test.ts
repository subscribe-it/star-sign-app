import { describe, expect, it, vi, afterEach } from 'vitest';

import accountController, {
  resolveZodiacSignSlugFromBirthDate,
} from './account';

const zodiacSigns = {
  baran: { id: 1, documentId: 'zodiac-baran', name: 'Baran', slug: 'baran' },
  koziorozec: {
    id: 10,
    documentId: 'zodiac-koziorozec',
    name: 'Koziorożec',
    slug: 'koziorozec',
  },
};

const createCtx = (body: Record<string, unknown>) => ({
  state: {
    user: {
      id: 123,
      email: 'test@example.com',
      username: 'test',
    },
  },
  request: {
    body,
    header: {},
  },
  status: undefined as number | undefined,
  body: undefined as unknown,
  unauthorized: vi.fn(),
  badRequest: vi.fn(),
});

const createStrapiMock = (
  appSettings: Record<string, unknown> | null = null,
) => {
  const userProfileQuery = {
    findOne: vi.fn().mockResolvedValue({
      id: 7,
      subscription_status: 'inactive',
    }),
    update: vi.fn().mockImplementation(async (input) => ({
      id: input.where.id,
      birth_date: input.data.birth_date,
      birth_time: input.data.birth_time,
      birth_place: input.data.birth_place,
      marketing_consent: input.data.marketing_consent,
      subscription_status: 'inactive',
      zodiac_sign: input.data.zodiac_sign
        ? Object.values(zodiacSigns).find(
            (sign) => sign.id === input.data.zodiac_sign,
          )
        : null,
    })),
  };
  const zodiacSignQuery = {
    findOne: vi.fn().mockImplementation(async ({ where }) => {
      const slug = where?.slug as keyof typeof zodiacSigns;
      return zodiacSigns[slug] || null;
    }),
  };
  const appSettingQuery = {
    findOne: vi.fn().mockResolvedValue(appSettings),
  };

  const strapiMock = {
    db: {
      query: vi.fn((uid: string) => {
        if (uid === 'api::user-profile.user-profile') {
          return userProfileQuery;
        }
        if (uid === 'api::zodiac-sign.zodiac-sign') {
          return zodiacSignQuery;
        }
        if (uid === 'api::app-setting.app-setting') {
          return appSettingQuery;
        }
        throw new Error(`Unexpected query uid: ${uid}`);
      }),
    },
    log: {
      error: vi.fn(),
    },
  };

  vi.stubGlobal('strapi', strapiMock);

  return { appSettingQuery, userProfileQuery, zodiacSignQuery };
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('account zodiac profile resolution', () => {
  it('resolves western zodiac sign slugs from birth dates', () => {
    expect(resolveZodiacSignSlugFromBirthDate('1990-01-01')).toBe('koziorozec');
    expect(resolveZodiacSignSlugFromBirthDate('2020-03-20')).toBe('ryby');
    expect(resolveZodiacSignSlugFromBirthDate('2020-03-21')).toBe('baran');
    expect(resolveZodiacSignSlugFromBirthDate('2020-04-19')).toBe('baran');
    expect(resolveZodiacSignSlugFromBirthDate('2020-04-20')).toBe('byk');
    expect(resolveZodiacSignSlugFromBirthDate('2020-05-21')).toBe('bliznieta');
    expect(resolveZodiacSignSlugFromBirthDate('2020-06-21')).toBe('rak');
    expect(resolveZodiacSignSlugFromBirthDate('2020-07-23')).toBe('lew');
    expect(resolveZodiacSignSlugFromBirthDate('2020-08-23')).toBe('panna');
    expect(resolveZodiacSignSlugFromBirthDate('2020-09-23')).toBe('waga');
    expect(resolveZodiacSignSlugFromBirthDate('2020-10-23')).toBe('skorpion');
    expect(resolveZodiacSignSlugFromBirthDate('2020-11-22')).toBe('strzelec');
    expect(resolveZodiacSignSlugFromBirthDate('2020-12-22')).toBe('koziorozec');
    expect(resolveZodiacSignSlugFromBirthDate('2020-01-20')).toBe('wodnik');
    expect(resolveZodiacSignSlugFromBirthDate('2020-02-19')).toBe('ryby');
  });

  it('sets zodiac_sign from birthDate when profile is updated', async () => {
    const { userProfileQuery, zodiacSignQuery } = createStrapiMock();
    const ctx = createCtx({
      birthDate: '1990-01-01',
      birthTime: '12:00',
      birthPlace: 'Warszawa',
      zodiacSignSlug: 'baran',
      marketingConsent: true,
    });

    await accountController.updateProfile(ctx);

    expect(zodiacSignQuery.findOne).toHaveBeenCalledWith({
      where: { slug: 'koziorozec' },
    });
    expect(userProfileQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          birth_date: '1990-01-01',
          birth_time: '12:00',
          birth_place: 'Warszawa',
          marketing_consent: true,
          zodiac_sign: zodiacSigns.koziorozec.id,
        }),
      }),
    );
  });

  it('clears zodiac_sign when birthDate is cleared', async () => {
    const { userProfileQuery, zodiacSignQuery } = createStrapiMock();
    const ctx = createCtx({
      birthDate: '',
      zodiacSignSlug: 'baran',
      marketingConsent: false,
    });

    await accountController.updateProfile(ctx);

    expect(zodiacSignQuery.findOne).not.toHaveBeenCalled();
    expect(userProfileQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          birth_date: null,
          zodiac_sign: null,
        }),
      }),
    );
  });

  it('keeps zodiacSignSlug as a legacy fallback when birthDate is omitted', async () => {
    const { userProfileQuery, zodiacSignQuery } = createStrapiMock();
    const ctx = createCtx({
      zodiacSignSlug: 'baran',
      marketingConsent: true,
    });

    await accountController.updateProfile(ctx);

    expect(zodiacSignQuery.findOne).toHaveBeenCalledWith({
      where: { slug: 'baran' },
    });
    expect(userProfileQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          zodiac_sign: zodiacSigns.baran.id,
        }),
      }),
    );
  });
});

describe('account subscription checkout settings gate', () => {
  it('does not start Stripe checkout while Premium remains open', async () => {
    createStrapiMock({
      premium_mode: 'open',
      stripe_checkout_enabled: true,
      stripe_monthly_price_id: 'price_monthly123',
      stripe_annual_price_id: 'price_annual123',
    });
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_checkout');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const ctx = createCtx({ plan: 'monthly' });

    await accountController.subscriptionCheckout(ctx);

    expect(ctx.status).toBe(503);
    expect(ctx.body).toEqual({
      error: 'Subskrypcje nie są jeszcze skonfigurowane.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('starts Stripe checkout only when paid Premium and checkout flag are enabled', async () => {
    const { userProfileQuery } = createStrapiMock({
      premium_mode: 'paid',
      stripe_checkout_enabled: true,
      stripe_monthly_price_id: 'price_monthly123',
      stripe_annual_price_id: 'price_annual123',
      trial_days: 14,
      allow_promotion_codes: false,
    });
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_checkout');
    vi.stubEnv('FRONTEND_URL', 'https://star-sign.test');
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'cs_test_123',
        url: 'https://stripe.com/checkout/session',
        customer: 'cus_123',
      }),
      init,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const ctx = createCtx({ plan: 'annual' });

    await accountController.subscriptionCheckout(ctx);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.stripe.com/v1/checkout/sessions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk_test_checkout',
        }),
      }),
    );
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(String(requestInit.body));
    expect(body.get('line_items[0][price]')).toBe('price_annual123');
    expect(body.get('subscription_data[trial_period_days]')).toBe('14');
    expect(body.get('allow_promotion_codes')).toBe('false');
    expect(userProfileQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stripe_customer_id: 'cus_123',
          subscription_plan: 'annual',
        }),
      }),
    );
    expect(ctx.body).toEqual({
      checkoutUrl: 'https://stripe.com/checkout/session',
      sessionId: 'cs_test_123',
    });
  });
});

describe('account deletion (RODO)', () => {
  const createDeleteStrapiMock = () => {
    const userReadingQuery = { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) };
    const userProfileQuery = { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) };
    const analyticsEventQuery = {
      findMany: vi.fn().mockResolvedValue([{ id: 11 }, { id: 12 }]),
      update: vi.fn().mockResolvedValue({}),
    };
    const newsletterQuery = { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) };
    const userQuery = { delete: vi.fn().mockResolvedValue({}) };

    const strapiMock = {
      db: {
        query: vi.fn((uid: string) => {
          if (uid === 'api::user-reading.user-reading') return userReadingQuery;
          if (uid === 'api::user-profile.user-profile') return userProfileQuery;
          if (uid === 'api::analytics-event.analytics-event')
            return analyticsEventQuery;
          if (uid === 'api::newsletter-subscription.newsletter-subscription')
            return newsletterQuery;
          if (uid === 'plugin::users-permissions.user') return userQuery;
          throw new Error(`Unexpected query uid: ${uid}`);
        }),
      },
      log: { error: vi.fn(), info: vi.fn() },
    };

    vi.stubGlobal('strapi', strapiMock);

    return {
      userReadingQuery,
      userProfileQuery,
      analyticsEventQuery,
      newsletterQuery,
      userQuery,
    };
  };

  it('requires authentication', async () => {
    createDeleteStrapiMock();
    const ctx = createCtx({ confirmation: 'USUWAM KONTO' });
    ctx.state.user = undefined as never;

    await accountController.deleteAccount(ctx);

    expect(ctx.unauthorized).toHaveBeenCalled();
  });

  it('requires explicit confirmation phrase', async () => {
    createDeleteStrapiMock();
    const ctx = createCtx({ confirmation: 'nie' });

    await accountController.deleteAccount(ctx);

    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('deletes profile, readings, newsletter and user, anonymizes analytics', async () => {
    const mocks = createDeleteStrapiMock();
    const ctx = createCtx({ confirmation: 'USUWAM KONTO' });

    await accountController.deleteAccount(ctx);

    expect(mocks.userReadingQuery.deleteMany).toHaveBeenCalledWith({
      where: { user: 123 },
    });
    expect(mocks.userProfileQuery.deleteMany).toHaveBeenCalledWith({
      where: { user: 123 },
    });
    expect(mocks.analyticsEventQuery.update).toHaveBeenCalledTimes(2);
    expect(mocks.newsletterQuery.deleteMany).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
    });
    expect(mocks.userQuery.delete).toHaveBeenCalledWith({
      where: { id: 123 },
    });
    expect(ctx.body).toEqual({ deleted: true });
  });
});
