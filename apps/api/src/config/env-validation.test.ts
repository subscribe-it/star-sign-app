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

const fullAutonomyEnv = (
  overrides: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv =>
  productionEnv({
    AICO_OPENROUTER_TOKEN: secret('openrouter_'),
    AICO_ENABLE_WORKFLOWS: 'true',
    AICO_AUDIT_TRAIL_STRICT: 'true',
    AICO_AUDIT_IP_HASH_SALT: secret('audit_salt_'),
    AICO_RUNTIME_LOCKS_DISABLED: 'false',
    AICO_SOCIAL_CONTENT_SAFETY_DISABLED: 'false',
    AICO_STRICT_AUDIT_REQUIRED: 'true',
    AICO_ADS_PROVIDER_MODE: 'controlled',
    AICO_ADS_TARGET_URL_PREFLIGHT_REQUIRED: 'true',
    AICO_VIDEO_PROVIDER_MODE: 'replicate',
    AICO_VIDEO_GEN_TOKEN: secret('video_'),
    AICO_VIDEO_GEN_MODEL: 'owner/video-model:abcdef',
    AICO_CONTROLLED_LIVE_ENABLED: 'true',
    AICO_ADMIN_RUN_NOW_ENABLED: 'true',
    AICO_FULL_AUTONOMY_REQUIRED: 'true',
    AICO_AUTO_PUBLISH_ENABLED: 'true',
    AICO_IMAGE_GEN_TOKEN: secret('image_'),
    AICO_IMAGE_GEN_MODEL: 'openai/gpt-image-2',
    AICO_MEDIA_GEN_REQUIRED: 'true',
    AICO_PUBLIC_FRONTEND_URL: 'https://star-sign.pl',
    AICO_SOCIAL_DEFAULT_IMAGE_URL: 'https://star-sign.pl/assets/og-default.png',
    AICO_SOCIAL_PUBLISH_REQUIRED: 'true',
    AICO_STRATEGY_AUTOPILOT_ENABLED: 'true',
    AICO_STRATEGY_AUTO_APPROVE_PLAN: 'true',
    AICO_FACEBOOK_PAGE_ID: '123456789',
    AICO_FACEBOOK_ACCESS_TOKEN: secret('facebook_'),
    AICO_INSTAGRAM_USER_ID: '987654321',
    AICO_INSTAGRAM_ACCESS_TOKEN: secret('instagram_'),
    AICO_X_API_KEY: 'x-api-key',
    AICO_X_API_SECRET: secret('x_secret_'),
    AICO_X_ACCESS_TOKEN: secret('x_access_'),
    AICO_X_ACCESS_TOKEN_SECRET: secret('x_access_secret_'),
    AICO_META_ADS_ACCESS_TOKEN: secret('meta_ads_'),
    AICO_META_AD_ACCOUNT_ID: 'act_123456789',
    AICO_GOOGLE_ADS_DEVELOPER_TOKEN: secret('google_ads_dev_'),
    AICO_GOOGLE_ADS_CLIENT_ID: 'google-ads-client-id',
    AICO_GOOGLE_ADS_CLIENT_SECRET: secret('google_ads_client_'),
    AICO_GOOGLE_ADS_REFRESH_TOKEN: secret('google_ads_refresh_'),
    AICO_GOOGLE_ADS_CUSTOMER_ID: '1234567890',
    GA4_PROPERTY_ID: '123456789',
    AICO_GA4_ACCESS_TOKEN: secret('ga4_'),
    ...overrides,
  });

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

  it('accepts the controlled AICO full-autonomy production profile', async () => {
    await expect(validate(fullAutonomyEnv())).resolves.toBeUndefined();
  });

  it('rejects production when AICO missing-token fallback is enabled', async () => {
    await expect(
      validate(
        productionEnv({
          AICO_ALLOW_MISSING_TOKEN: 'true',
        }),
      ),
    ).rejects.toThrow(/AICO_ALLOW_MISSING_TOKEN/);
  });

  it('rejects AICO full autonomy without controlled live gates and required provider modes', async () => {
    await expect(
      validate(
        fullAutonomyEnv({
          AICO_CONTROLLED_LIVE_ENABLED: 'false',
          AICO_ADMIN_RUN_NOW_ENABLED: 'false',
          AICO_ADS_PROVIDER_MODE: 'disabled',
          AICO_VIDEO_PROVIDER_MODE: 'live',
        }),
      ),
    ).rejects.toThrow(
      /AICO_CONTROLLED_LIVE_ENABLED[\s\S]*AICO_ADMIN_RUN_NOW_ENABLED[\s\S]*AICO_ADS_PROVIDER_MODE[\s\S]*AICO_VIDEO_PROVIDER_MODE/,
    );
  });

  it('rejects AICO controlled ads without Meta and Google Ads credentials', async () => {
    await expect(
      validate(
        fullAutonomyEnv({
          AICO_META_ADS_ACCESS_TOKEN: '',
          AICO_META_AD_ACCOUNT_ID: '',
          AICO_GOOGLE_ADS_DEVELOPER_TOKEN: '',
          AICO_GOOGLE_ADS_CLIENT_ID: '',
          AICO_GOOGLE_ADS_CLIENT_SECRET: '',
          AICO_GOOGLE_ADS_REFRESH_TOKEN: '',
          AICO_GOOGLE_ADS_CUSTOMER_ID: '',
        }),
      ),
    ).rejects.toThrow(
      /AICO_META_ADS_ACCESS_TOKEN[\s\S]*AICO_META_AD_ACCOUNT_ID[\s\S]*AICO_GOOGLE_ADS_DEVELOPER_TOKEN[\s\S]*AICO_GOOGLE_ADS_CLIENT_ID[\s\S]*AICO_GOOGLE_ADS_CLIENT_SECRET[\s\S]*AICO_GOOGLE_ADS_REFRESH_TOKEN[\s\S]*AICO_GOOGLE_ADS_CUSTOMER_ID/,
    );
  });
});
