import { describe, expect, it, vi } from 'vitest';

const secret = (prefix = ''): string => `${prefix}${'a'.repeat(32)}`;

const productionEnv = (
  overrides: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv => ({
  NODE_ENV: 'production',
  FRONTEND_URL: 'https://star-sign.pl',
  API_PUBLIC_URL: 'https://api.star-sign.pl',
  SERVER_URL: 'https://api.star-sign.pl',
  CORS_ORIGIN: 'https://star-sign.pl',
  APP_KEYS: [
    secret('app_a_'),
    secret('app_b_'),
    secret('app_c_'),
    secret('app_d_'),
  ].join(','),
  API_TOKEN_SALT: secret('token_'),
  ADMIN_JWT_SECRET: secret('admin_'),
  TRANSFER_TOKEN_SALT: secret('transfer_'),
  JWT_SECRET: secret('jwt_'),
  ENCRYPTION_KEY: secret('encryption_'),
  DATABASE_CLIENT: 'postgres',
  DATABASE_HOST: 'postgres',
  DATABASE_NAME: 'star_sign',
  DATABASE_USERNAME: 'star_sign',
  DATABASE_PASSWORD: secret('db_'),
  REDIS_URL: 'redis://redis:6379',
  RATE_LIMIT_ENABLED: 'true',
  HTTP_CACHE_ENABLED: 'true',
  R2_UPLOAD_ENABLED: 'false',
  SHOP_ENABLED: 'false',
  STRIPE_REQUIRED: 'false',
  STRIPE_SECRET_KEY: secret(['sk', 'live', ''].join('_')),
  STRIPE_WEBHOOK_SECRET: secret(['whsec', ''].join('_')),
  STRIPE_PREMIUM_MONTHLY_PRICE_ID: 'price_monthly123',
  STRIPE_PREMIUM_ANNUAL_PRICE_ID: 'price_annual123',
  GA4_MEASUREMENT_ID: 'G-ABCD123456',
  TURNSTILE_ENABLED: 'true',
  TURNSTILE_SITE_KEY: secret('turnstile_site_'),
  TURNSTILE_SECRET_KEY: secret('turnstile_secret_'),
  TURNSTILE_FAIL_OPEN: 'false',
  ...overrides,
});

const validate = async (env: NodeJS.ProcessEnv): Promise<void> => {
  vi.resetModules();
  const { validateProductionEnv } = await import('../../config/env-validation');
  validateProductionEnv(env);
};

describe('production environment validation', () => {
  it('accepts soft-launch production configuration without Stripe', async () => {
    await expect(
      validate(
        productionEnv({
          STRIPE_SECRET_KEY: '',
          STRIPE_WEBHOOK_SECRET: '',
          STRIPE_PREMIUM_MONTHLY_PRICE_ID: '',
          STRIPE_PREMIUM_ANNUAL_PRICE_ID: '',
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it('requires Premium Stripe price IDs when Stripe is marked required', async () => {
    await expect(
      validate(
        productionEnv({
          STRIPE_REQUIRED: 'true',
          STRIPE_PREMIUM_MONTHLY_PRICE_ID: '',
        }),
      ),
    ).rejects.toThrow(/STRIPE_PREMIUM_MONTHLY_PRICE_ID/);
  });

  it('rejects Stripe test keys in production', async () => {
    await expect(
      validate(
        productionEnv({
          STRIPE_REQUIRED: 'true',
          STRIPE_SECRET_KEY: ['sk', 'test', 'replace', 'me'].join('_'),
        }),
      ),
    ).rejects.toThrow(/STRIPE_SECRET_KEY/);
  });

  it('requires a production frontend URL and GA4 measurement ID', async () => {
    await expect(
      validate(
        productionEnv({
          FRONTEND_URL: 'http://localhost:4200',
          GA4_MEASUREMENT_ID: '',
        }),
      ),
    ).rejects.toThrow(/FRONTEND_URL[\s\S]*GA4_MEASUREMENT_ID/);
  });

  it('blocks Turnstile fail-open mode in production', async () => {
    await expect(
      validate(
        productionEnv({
          TURNSTILE_FAIL_OPEN: 'true',
        }),
      ),
    ).rejects.toThrow(/TURNSTILE_FAIL_OPEN/);
  });
});
