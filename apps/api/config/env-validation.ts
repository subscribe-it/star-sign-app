import { z } from 'zod';

type Issue = {
  key: string;
  message: string;
};

const placeholderPattern =
  /^(|replace_me.*|changeme|change_me|your_.+|example.*)$/i;
const placeholderFragmentPattern =
  /(replace_me|changeme|change_me|your_|example)/i;
const ga4MeasurementIdPattern = /^G-[A-Z0-9]+$/i;
const ga4PlaceholderPattern = /^G-(X+|TEST)$/i;
const stripeLiveSecretKeyPattern = /^sk_live_[A-Za-z0-9]+$/;
const stripeWebhookSecretPattern = /^whsec_[A-Za-z0-9]+$/;
const stripePriceIdPattern = /^price_[A-Za-z0-9]+$/;

const productionEnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  FRONTEND_URL: z.string().optional(),
  API_PUBLIC_URL: z.string().optional(),
  SERVER_URL: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  DATABASE_CLIENT: z.string().optional(),
  RATE_LIMIT_ENABLED: z.string().optional(),
  RATE_LIMIT_REDIS_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  HTTP_CACHE_ENABLED: z.string().optional(),
  HTTP_CACHE_REDIS_URL: z.string().optional(),
  R2_UPLOAD_ENABLED: z.string().optional(),
  SHOP_ENABLED: z.string().optional(),
  STRIPE_REQUIRED: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PREMIUM_MONTHLY_PRICE_ID: z.string().optional(),
  STRIPE_PREMIUM_ANNUAL_PRICE_ID: z.string().optional(),
  GA4_MEASUREMENT_ID: z.string().optional(),
  GTM_CONTAINER_ID: z.string().optional(),
  SENTRY_REQUIRED: z.string().optional(),
  TURNSTILE_ENABLED: z.string().optional(),
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  TURNSTILE_FAIL_OPEN: z.string().optional(),
});

let hasValidated = false;

const splitCsv = (value?: string): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const isEnabled = (
  value: string | undefined,
  defaultValue: boolean,
): boolean => {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const isMissingOrPlaceholder = (value?: string): boolean => {
  const trimmed = value?.trim() ?? '';
  return (
    !trimmed ||
    placeholderPattern.test(trimmed) ||
    placeholderFragmentPattern.test(trimmed)
  );
};

const looksLikeSecret = (value?: string, minLength = 16): boolean =>
  Boolean(
    value && value.trim().length >= minLength && !isMissingOrPlaceholder(value),
  );

const requireSecret = (
  issues: Issue[],
  env: NodeJS.ProcessEnv,
  key: string,
  minLength = 16,
): void => {
  if (!looksLikeSecret(env[key], minLength)) {
    issues.push({
      key,
      message: `Missing production-grade secret for ${key}.`,
    });
  }
};

const requireValue = (
  issues: Issue[],
  env: NodeJS.ProcessEnv,
  key: string,
): void => {
  const value = env[key];

  if (isMissingOrPlaceholder(value)) {
    issues.push({
      key,
      message: `Missing production value for ${key}.`,
    });
  }
};

const hasLocalhost = (value?: string): boolean =>
  Boolean(value && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value));

const validateProductionUrl = (
  issues: Issue[],
  env: NodeJS.ProcessEnv,
  key: string,
  required: boolean,
): void => {
  const value = env[key]?.trim();

  if (!value) {
    if (required) {
      issues.push({
        key,
        message: `${key} must be set to a production HTTPS URL.`,
      });
    }
    return;
  }

  if (isMissingOrPlaceholder(value)) {
    issues.push({
      key,
      message: `${key} must not contain a placeholder in production.`,
    });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    issues.push({
      key,
      message: `${key} must be a valid production HTTPS URL.`,
    });
    return;
  }

  if (parsed.protocol !== 'https:') {
    issues.push({
      key,
      message: `${key} must use HTTPS in production.`,
    });
  }

  if (hasLocalhost(value)) {
    issues.push({
      key,
      message: `${key} must not point to localhost in production.`,
    });
  }
};

const validatePublicUrls = (issues: Issue[], env: NodeJS.ProcessEnv): void => {
  validateProductionUrl(issues, env, 'FRONTEND_URL', true);
  validateProductionUrl(issues, env, 'API_PUBLIC_URL', false);
  validateProductionUrl(issues, env, 'SERVER_URL', false);
};

const validateCors = (issues: Issue[], env: NodeJS.ProcessEnv): void => {
  const origins = splitCsv(env.CORS_ORIGIN);

  if (origins.length === 0) {
    issues.push({
      key: 'CORS_ORIGIN',
      message: 'CORS_ORIGIN must contain at least one production origin.',
    });
    return;
  }

  if (origins.some(hasLocalhost)) {
    issues.push({
      key: 'CORS_ORIGIN',
      message: 'CORS_ORIGIN must not include localhost in production.',
    });
  }
};

const validateDatabase = (issues: Issue[], env: NodeJS.ProcessEnv): void => {
  const client = env.DATABASE_CLIENT;

  if (!client || client === 'sqlite') {
    issues.push({
      key: 'DATABASE_CLIENT',
      message: 'Production database must be PostgreSQL or MySQL, not SQLite.',
    });
  }

  [
    'DATABASE_HOST',
    'DATABASE_NAME',
    'DATABASE_USERNAME',
    'DATABASE_PASSWORD',
  ].forEach((key) => requireValue(issues, env, key));
};

const validateSecrets = (issues: Issue[], env: NodeJS.ProcessEnv): void => {
  const appKeys = splitCsv(env.APP_KEYS);

  if (appKeys.length < 4 || appKeys.some((key) => !looksLikeSecret(key, 16))) {
    issues.push({
      key: 'APP_KEYS',
      message:
        'APP_KEYS must contain at least four non-placeholder production secrets.',
    });
  }

  requireSecret(issues, env, 'API_TOKEN_SALT');
  requireSecret(issues, env, 'ADMIN_JWT_SECRET');
  requireSecret(issues, env, 'TRANSFER_TOKEN_SALT');
  requireSecret(issues, env, 'JWT_SECRET');
  requireSecret(issues, env, 'ENCRYPTION_KEY', 32);
};

const validateRateLimit = (issues: Issue[], env: NodeJS.ProcessEnv): void => {
  const enabled = isEnabled(env.RATE_LIMIT_ENABLED, true);

  if (!enabled) {
    issues.push({
      key: 'RATE_LIMIT_ENABLED',
      message: 'RATE_LIMIT_ENABLED must stay enabled in production.',
    });
  }

  if (enabled && !env.RATE_LIMIT_REDIS_URL && !env.REDIS_URL) {
    issues.push({
      key: 'RATE_LIMIT_REDIS_URL',
      message: 'Redis URL is required for shared production rate limiting.',
    });
  }
};

const validateHttpCache = (issues: Issue[], env: NodeJS.ProcessEnv): void => {
  const enabled = isEnabled(env.HTTP_CACHE_ENABLED, true);

  if (enabled && !env.HTTP_CACHE_REDIS_URL && !env.REDIS_URL) {
    issues.push({
      key: 'HTTP_CACHE_REDIS_URL',
      message: 'Redis URL is required for shared production HTTP cache.',
    });
  }
};

const validateR2 = (issues: Issue[], env: NodeJS.ProcessEnv): void => {
  if (!isEnabled(env.R2_UPLOAD_ENABLED, false)) {
    return;
  }

  [
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_S3_ENDPOINT',
    'R2_BUCKET',
    'R2_PUBLIC_BASE_URL',
  ].forEach((key) => requireValue(issues, env, key));
};

const validateStripe = (issues: Issue[], env: NodeJS.ProcessEnv): void => {
  requireSecret(issues, env, 'STRIPE_SECRET_KEY');
  requireSecret(issues, env, 'STRIPE_WEBHOOK_SECRET');

  const stripeSecretKey = env.STRIPE_SECRET_KEY?.trim();
  if (stripeSecretKey && !stripeLiveSecretKeyPattern.test(stripeSecretKey)) {
    issues.push({
      key: 'STRIPE_SECRET_KEY',
      message: 'STRIPE_SECRET_KEY must be a live Stripe secret key.',
    });
  }

  const stripeWebhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
  if (
    stripeWebhookSecret &&
    !stripeWebhookSecretPattern.test(stripeWebhookSecret)
  ) {
    issues.push({
      key: 'STRIPE_WEBHOOK_SECRET',
      message: 'STRIPE_WEBHOOK_SECRET must be a signed Stripe webhook secret.',
    });
  }

  for (const key of [
    'STRIPE_PREMIUM_MONTHLY_PRICE_ID',
    'STRIPE_PREMIUM_ANNUAL_PRICE_ID',
  ]) {
    requireValue(issues, env, key);

    const value = env[key]?.trim();
    if (
      value &&
      !isMissingOrPlaceholder(value) &&
      !stripePriceIdPattern.test(value)
    ) {
      issues.push({
        key,
        message: `${key} must be a Stripe price ID.`,
      });
    }
  }
};

const validateGa4 = (issues: Issue[], env: NodeJS.ProcessEnv): void => {
  const measurementId = env.GA4_MEASUREMENT_ID?.trim();

  if (isMissingOrPlaceholder(measurementId)) {
    issues.push({
      key: 'GA4_MEASUREMENT_ID',
      message: 'GA4_MEASUREMENT_ID must be set for production analytics.',
    });
    return;
  }

  if (
    !ga4MeasurementIdPattern.test(measurementId) ||
    ga4PlaceholderPattern.test(measurementId)
  ) {
    issues.push({
      key: 'GA4_MEASUREMENT_ID',
      message: 'GA4_MEASUREMENT_ID must be a real GA4 measurement ID.',
    });
  }
};

const validateSentry = (issues: Issue[], env: NodeJS.ProcessEnv): void => {
  if (isEnabled(env.SENTRY_REQUIRED, false) && !env.SENTRY_DSN) {
    issues.push({
      key: 'SENTRY_DSN',
      message: 'SENTRY_DSN is required when SENTRY_REQUIRED=true.',
    });
  }
};

const validateTurnstile = (issues: Issue[], env: NodeJS.ProcessEnv): void => {
  if (!isEnabled(env.TURNSTILE_ENABLED, false)) {
    return;
  }

  requireValue(issues, env, 'TURNSTILE_SITE_KEY');
  requireSecret(issues, env, 'TURNSTILE_SECRET_KEY');

  if (isEnabled(env.TURNSTILE_FAIL_OPEN, false)) {
    issues.push({
      key: 'TURNSTILE_FAIL_OPEN',
      message: 'TURNSTILE_FAIL_OPEN must remain false in production.',
    });
  }
};

export const validateProductionEnv = (rawEnv: NodeJS.ProcessEnv): void => {
  if (hasValidated || rawEnv.NODE_ENV !== 'production') {
    return;
  }

  hasValidated = true;

  const parsed = productionEnvSchema.safeParse(rawEnv);

  if (!parsed.success) {
    throw new Error(`Invalid production env shape: ${parsed.error.message}`);
  }

  const issues: Issue[] = [];

  validateSecrets(issues, rawEnv);
  validateDatabase(issues, rawEnv);
  validateCors(issues, rawEnv);
  validatePublicUrls(issues, rawEnv);
  validateRateLimit(issues, rawEnv);
  validateHttpCache(issues, rawEnv);
  validateR2(issues, rawEnv);
  if (isEnabled(rawEnv.STRIPE_REQUIRED, false)) {
    validateStripe(issues, rawEnv);
  }
  validateGa4(issues, rawEnv);
  validateSentry(issues, rawEnv);
  validateTurnstile(issues, rawEnv);

  if (issues.length > 0) {
    const details = issues
      .map((issue) => `- ${issue.key}: ${issue.message}`)
      .join('\n');
    throw new Error(`Production environment validation failed:\n${details}`);
  }
};
