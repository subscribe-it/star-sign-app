import Redis from 'ioredis';

type RateLimitConfig = {
  enabled?: boolean;
  windowMs?: number;
  max?: number;
  paths?: string[];
  redisUrl?: string;
  redisKeyPrefix?: string;
  failOpen?: boolean;
  trustProxy?: boolean;
  trustedProxyHops?: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitContext = {
  path?: string;
  ip?: string;
  request?: {
    ip?: string;
  };
  get?: (name: string) => string;
  set: (name: string, value: string) => void;
  status: number;
  body: unknown;
};

type Next = () => Promise<void>;

const memoryBuckets = new Map<string, Bucket>();
const defaultLimitedPaths = [
  '/api/auth/local',
  '/api/auth/local/register',
  '/api/contact',
  '/api/newsletter',
  '/api/checkout/session',
  '/api/account',
  '/api/account/subscription',
  '/api/analytics/events',
];

const normalizePaths = (paths?: string[]): string[] =>
  Array.isArray(paths) && paths.length > 0 ? paths : defaultLimitedPaths;

const sanitizeKeySegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9:._-]/g, '_');

// With `hops` trusted reverse proxies in front, the real client IP is the entry
// appended by the OUTERMOST trusted proxy = `parts.length - hops` from the left.
// Taking the leftmost entry (previous behavior) is spoofable: a client can send a
// forged X-Forwarded-For and the trusted proxy only appends to the right of it.
const getForwardedIp = (
  ctx: RateLimitContext,
  hops: number,
): string | undefined => {
  const forwardedFor =
    typeof ctx.get === 'function' ? ctx.get('x-forwarded-for') : '';
  const parts = forwardedFor
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) {
    return undefined;
  }
  const index = Math.max(0, parts.length - Math.max(1, hops));
  return parts[index] || undefined;
};

const getClientKey = (
  ctx: RateLimitContext,
  trustProxy: boolean,
  hops: number,
): string =>
  (trustProxy ? getForwardedIp(ctx, hops) : undefined) ||
  ctx.ip ||
  ctx.request?.ip ||
  'unknown';

const shouldLimitPath = (path: string, paths: string[]): boolean =>
  paths.some(
    (candidate) => path === candidate || path.startsWith(`${candidate}/`),
  );

// Throttled logging so a flapping Redis connection cannot spam logs, while still
// surfacing the degradation (previous behavior silently swallowed all errors).
let lastRedisErrorLogAt = 0;
const logRedisIssue = (context: string, error: unknown): void => {
  const now = Date.now();
  if (now - lastRedisErrorLogAt < 60_000) {
    return;
  }
  lastRedisErrorLogAt = now;
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.warn(`[rate-limit] Redis ${context}: ${message}`);
};

const createRedisClient = (redisUrl?: string): Redis | undefined => {
  if (!redisUrl) {
    return undefined;
  }

  const client = new Redis(redisUrl, {
    connectTimeout: 2_000,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });

  client.on('error', (error) => logRedisIssue('connection error', error));

  return client;
};

const incrementRedisBucket = async (
  redis: Redis,
  key: string,
  windowMs: number,
): Promise<Bucket> => {
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.pexpire(key, windowMs);
  }

  const ttl = await redis.pttl(key);
  const resetAt = Date.now() + Math.max(ttl, 0);

  return { count, resetAt };
};

const incrementMemoryBucket = (key: string, windowMs: number): Bucket => {
  const now = Date.now();
  const current = memoryBuckets.get(key);

  if (!current || current.resetAt <= now) {
    const freshBucket = { count: 1, resetAt: now + windowMs };
    memoryBuckets.set(key, freshBucket);
    return freshBucket;
  }

  current.count += 1;
  return current;
};

const setRateLimitHeaders = (
  ctx: RateLimitContext,
  max: number,
  bucket: Bucket,
): void => {
  const remaining = Math.max(0, max - bucket.count);

  ctx.set('X-RateLimit-Limit', String(max));
  ctx.set('X-RateLimit-Remaining', String(remaining));
  ctx.set('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
};

const rejectTooManyRequests = (
  ctx: RateLimitContext,
  retryAfter: number,
): void => {
  ctx.set('Retry-After', String(retryAfter));
  ctx.status = 429;
  ctx.body = {
    data: null,
    error: {
      status: 429,
      name: 'RateLimitError',
      message: 'Za dużo żądań. Spróbuj ponownie za chwilę.',
      details: { retryAfter },
    },
  };
};

const rejectRateLimitUnavailable = (ctx: RateLimitContext): void => {
  ctx.status = 503;
  ctx.body = {
    data: null,
    error: {
      status: 503,
      name: 'RateLimitUnavailableError',
      message:
        'Limit żądań jest chwilowo niedostępny. Spróbuj ponownie za chwilę.',
      details: {},
    },
  };
};

export default (config: RateLimitConfig = {}) => {
  const enabled = config.enabled !== false;
  const windowMs = config.windowMs ?? 15 * 60 * 1000;
  const max = config.max ?? 60;
  const paths = normalizePaths(config.paths);
  const redis = createRedisClient(config.redisUrl);
  const redisKeyPrefix = config.redisKeyPrefix ?? 'star-sign:rate-limit:';
  const failOpen = config.failOpen === true;
  const trustProxy = config.trustProxy === true;
  const trustedProxyHops = Math.max(1, Number(config.trustedProxyHops ?? 1));

  return async (ctx: RateLimitContext, next: Next): Promise<void> => {
    const path = ctx.path || '';

    if (!enabled || !shouldLimitPath(path, paths)) {
      await next();
      return;
    }

    const clientKey = sanitizeKeySegment(getClientKey(ctx, trustProxy, trustedProxyHops));
    const pathKey = sanitizeKeySegment(path);
    const key = `${redisKeyPrefix}${clientKey}:${pathKey}`;
    let bucket: Bucket;

    try {
      bucket = redis
        ? await incrementRedisBucket(redis, key, windowMs)
        : incrementMemoryBucket(key, windowMs);
    } catch (error) {
      logRedisIssue('operation failed', error);
      if (failOpen) {
        await next();
        return;
      }

      rejectRateLimitUnavailable(ctx);
      return;
    }

    setRateLimitHeaders(ctx, max, bucket);

    if (bucket.count > max) {
      const retryAfter = Math.max(
        1,
        Math.ceil((bucket.resetAt - Date.now()) / 1000),
      );
      rejectTooManyRequests(ctx, retryAfter);
      return;
    }

    await next();
  };
};
