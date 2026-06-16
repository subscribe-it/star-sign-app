/**
 * Per-admin-user rate limit for costly AICO operations (run-now, backfill,
 * tick run-now, plan generation, etc.). Prevents an authenticated admin from
 * hammering endpoints that burn LLM/media/ads budget.
 *
 * In-memory token window (per process). This is a first defense layer for the
 * single-instance deployment; a Redis-backed limiter would be required for
 * horizontal scaling (tracked as a follow-up).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5_000;

const pruneExpired = (now: number): void => {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

type MiddlewareContext = {
  state?: { user?: { id?: number | string } };
  request: { method: string; path: string };
  set: (field: string, value: string) => void;
  status: number;
  body: unknown;
};

type StrapiLike = { log?: { warn?: (message: string) => void } };

const costlyRateLimit = (_config: unknown, { strapi }: { strapi: StrapiLike }) => {
  return async (ctx: MiddlewareContext, next: () => Promise<void>): Promise<void> => {
    const limit = Number(process.env.AICO_ADMIN_RATE_LIMIT ?? 20);
    const windowMs = Number(process.env.AICO_ADMIN_RATE_LIMIT_WINDOW_MS ?? 60_000);

    if (!Number.isFinite(limit) || limit <= 0) {
      await next();
      return;
    }

    const now = Date.now();
    if (buckets.size > MAX_TRACKED_KEYS) {
      pruneExpired(now);
    }

    const userId = ctx.state?.user?.id ?? 'anonymous';
    // Normalize numeric path segments (e.g. /workflows/5/run-now → /workflows/:id/run-now)
    // so a single admin cannot bypass the cap by varying the resource id.
    const normalizedPath = ctx.request.path.replace(/\/\d+(?=\/|$)/g, '/:id');
    const key = `${userId}:${ctx.request.method}:${normalizedPath}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    if (bucket.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      ctx.set('Retry-After', String(retryAfter));
      ctx.status = 429;
      ctx.body = {
        error: {
          status: 429,
          name: 'TooManyRequests',
          message: 'Zbyt wiele kosztownych operacji w krótkim czasie. Spróbuj ponownie za chwilę.',
        },
      };
      strapi.log?.warn?.(`[aico] admin costly rate limit hit for ${key}`);
      return;
    }

    bucket.count += 1;
    await next();
  };
};

export default costlyRateLimit;
