import Redis from 'ioredis';

const startedAt = new Date();
let redisClient: Redis | null | undefined;

const checkDatabase = async (): Promise<boolean> => {
  try {
    await strapi.db.connection.raw('select 1 as ok');
    return true;
  } catch (error) {
    strapi.log.error('Healthcheck database probe failed.', error);
    return false;
  }
};

const isEnabled = (
  value: string | undefined,
  defaultValue: boolean,
): boolean => {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const redisRequired = (): boolean =>
  isEnabled(process.env.RATE_LIMIT_ENABLED, true) ||
  isEnabled(process.env.HTTP_CACHE_ENABLED, true);

const getRedisClient = (): Redis | null => {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const redisUrl =
    process.env.REDIS_URL ||
    process.env.RATE_LIMIT_REDIS_URL ||
    process.env.HTTP_CACHE_REDIS_URL ||
    '';

  if (!redisUrl) {
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis(redisUrl, {
    connectTimeout: 1000,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  redisClient.on('error', () => undefined);

  return redisClient;
};

const waitForRedisReady = async (
  redis: Redis,
  timeoutMs = 1_000,
): Promise<void> => {
  if (redis.status === 'ready') {
    return;
  }

  if (redis.status === 'wait' || redis.status === 'end') {
    await redis.connect();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Redis client did not become ready within ${timeoutMs}ms; status=${redis.status}`,
        ),
      );
    }, timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timeout);
      redis.off('ready', onReady);
      redis.off('error', onError);
      redis.off('end', onEnd);
    };

    const onReady = (): void => {
      cleanup();
      resolve();
    };

    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    const onEnd = (): void => {
      cleanup();
      reject(new Error('Redis connection ended before becoming ready.'));
    };

    redis.once('ready', onReady);
    redis.once('error', onError);
    redis.once('end', onEnd);
  });
};

const checkRedis = async (): Promise<boolean> => {
  if (!redisRequired()) {
    return true;
  }

  const redis = getRedisClient();

  if (!redis) {
    return false;
  }

  try {
    await waitForRedisReady(redis);
    return (await redis.ping()) === 'PONG';
  } catch (error) {
    if (redis.status === 'end') {
      redisClient = undefined;
    }
    strapi.log.error('Healthcheck Redis probe failed.', error);
    return false;
  }
};

export default {
  async live(ctx) {
    ctx.body = {
      status: 'ok',
      service: 'star-sign-api',
      startedAt: startedAt.toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  },

  async ready(ctx) {
    const [database, redis] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);
    const ready = database && redis;
    ctx.status = ready ? 200 : 503;
    ctx.body = {
      status: ready ? 'ready' : 'not_ready',
      service: 'star-sign-api',
      checks: {
        database,
        redis,
      },
    };
  },
};
