import type { Core } from '@strapi/strapi';

const parseCsv = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

type StrapiEnv = Core.Config.Shared.ConfigParams['env'];

const defaultLocalCorsOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://localhost:4300',
  'http://127.0.0.1:4300',
];

const corsAllowedHeaders = [
  'Content-Type',
  'Authorization',
  'Origin',
  'Accept',
  'Cache-Control',
  'Pragma',
  'Sentry-Trace',
  'Baggage',
  'Stripe-Signature',
];

const unique = (values: string[]): string[] => Array.from(new Set(values));

const resolveCorsOrigins = (env: StrapiEnv): string[] => {
  const configuredOrigins = parseCsv(
    env('CORS_ORIGIN', defaultLocalCorsOrigins.join(',')),
  );

  if (env('NODE_ENV') === 'production') {
    return configuredOrigins;
  }

  return unique([...configuredOrigins, ...defaultLocalCorsOrigins]);
};

const config = ({
  env,
}: Core.Config.Shared.ConfigParams): Core.Config.Middlewares => {
  const origins = resolveCorsOrigins(env);
  const uploadAssetCspOrigins = parseCsv(env('UPLOAD_ASSET_CSP_ORIGINS', ''));

  return [
    'strapi::logger',
    'strapi::errors',
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            'connect-src': ["'self'", 'https:', ...uploadAssetCspOrigins],
            'img-src': [
              "'self'",
              'data:',
              'blob:',
              'https://market-assets.strapi.io',
              ...uploadAssetCspOrigins,
            ],
            'media-src': ["'self'", 'data:', 'blob:', ...uploadAssetCspOrigins],
            upgradeInsecureRequests: null,
          },
        },
        hsts: env.bool(
          'SECURITY_HSTS_ENABLED',
          env('NODE_ENV') === 'production',
        )
          ? {
              maxAge: env.int('SECURITY_HSTS_MAX_AGE', 31536000),
              includeSubDomains: true,
              preload: false,
            }
          : false,
      },
    },
    {
      name: 'strapi::cors',
      config: {
        origin: origins,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
        headers: corsAllowedHeaders,
        keepHeadersOnError: true,
      },
    },
    {
      name: 'global::rate-limit',
      config: {
        enabled: env.bool('RATE_LIMIT_ENABLED', true),
        windowMs: env.int('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
        max: env.int(
          'RATE_LIMIT_MAX',
          env('NODE_ENV') === 'production' ? 80 : 300,
        ),
        paths: parseCsv(env('RATE_LIMIT_PATHS', '')),
        redisUrl: env('RATE_LIMIT_REDIS_URL', env('REDIS_URL', '')),
        redisKeyPrefix: env('RATE_LIMIT_KEY_PREFIX', 'star-sign:rate-limit:'),
        failOpen: env.bool(
          'RATE_LIMIT_FAIL_OPEN',
          env('NODE_ENV') !== 'production',
        ),
        trustProxy: env.bool('RATE_LIMIT_TRUST_PROXY', false),
        trustedProxyHops: env.int('RATE_LIMIT_TRUSTED_PROXY_HOPS', 1),
      },
    },
    {
      name: 'global::http-cache',
      config: {
        enabled: env.bool('HTTP_CACHE_ENABLED', true),
        redisUrl: env('HTTP_CACHE_REDIS_URL', env('REDIS_URL', '')),
        keyPrefix: env('HTTP_CACHE_KEY_PREFIX', 'star-sign:http-cache:'),
        policies: {
          articles: {
            tag: 'articles',
            ttlSeconds: env.int('HTTP_CACHE_ARTICLES_TTL_SECONDS', 300),
            staleSeconds: env.int('HTTP_CACHE_ARTICLES_STALE_SECONDS', 86400),
          },
          horoscopes: {
            tag: 'horoscopes',
            ttlSeconds: env.int('HTTP_CACHE_HOROSCOPES_TTL_SECONDS', 900),
            staleSeconds: env.int('HTTP_CACHE_HOROSCOPES_STALE_SECONDS', 3600),
          },
          'zodiac-signs': {
            tag: 'zodiac-signs',
            ttlSeconds: env.int('HTTP_CACHE_ZODIAC_SIGNS_TTL_SECONDS', 86400),
            staleSeconds: env.int(
              'HTTP_CACHE_ZODIAC_SIGNS_STALE_SECONDS',
              604800,
            ),
          },
        },
      },
    },
    'strapi::poweredBy',
    'strapi::query',
    {
      name: 'strapi::body',
      config: {
        includeUnparsed: true,
        jsonLimit: env('BODY_JSON_LIMIT', '1mb'),
        formLimit: env('BODY_FORM_LIMIT', '1mb'),
        textLimit: env('BODY_TEXT_LIMIT', '1mb'),
        formidable: {
          maxFileSize: env.int('UPLOAD_MAX_FILE_SIZE', 10 * 1024 * 1024),
        },
      },
    },
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};

export default config;
