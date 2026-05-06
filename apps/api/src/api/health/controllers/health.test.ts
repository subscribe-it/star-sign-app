import { afterEach, describe, expect, it, vi } from 'vitest';

type MockRedisInstance = {
  status: string;
  connect: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
};

const redisMockState = vi.hoisted(() => ({
  instances: [] as MockRedisInstance[],
}));

vi.mock('ioredis', () => {
  class MockRedis {
    public status = 'wait';

    public connect = vi.fn(async () => {
      this.status = 'ready';
    });

    public ping = vi.fn(async () => {
      if (this.status !== 'ready') {
        throw new Error(
          "Stream isn't writeable and enableOfflineQueue options is false",
        );
      }

      return 'PONG';
    });

    public on = vi.fn(() => this);
    public once = vi.fn(() => this);
    public off = vi.fn(() => this);

    public constructor() {
      redisMockState.instances.push(this);
    }
  }

  return { default: MockRedis };
});

const originalEnv = { ...process.env };

const loadHealthController = async () => {
  vi.resetModules();
  redisMockState.instances.length = 0;

  vi.stubGlobal('strapi', {
    db: {
      connection: {
        raw: vi.fn(async () => [{ ok: 1 }]),
      },
    },
    log: {
      error: vi.fn(),
    },
  });

  return (await import('./health')).default;
};

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...originalEnv };
  redisMockState.instances.length = 0;
});

describe('health controller', () => {
  it('connects lazy Redis client before ready ping', async () => {
    process.env.REDIS_URL = 'redis://redis:6379';
    process.env.RATE_LIMIT_ENABLED = 'true';
    process.env.HTTP_CACHE_ENABLED = 'true';

    const controller = await loadHealthController();
    const ctx = { status: 0, body: undefined };

    await controller.ready(ctx);

    const redis = redisMockState.instances[0];
    expect(redis.connect).toHaveBeenCalledTimes(1);
    expect(redis.ping).toHaveBeenCalledTimes(1);
    expect(ctx.status).toBe(200);
    expect(ctx.body).toMatchObject({
      status: 'ready',
      checks: {
        database: true,
        redis: true,
      },
    });
  });

  it('does not require Redis when cache and rate limit are disabled', async () => {
    process.env.RATE_LIMIT_ENABLED = 'false';
    process.env.HTTP_CACHE_ENABLED = 'false';
    delete process.env.REDIS_URL;

    const controller = await loadHealthController();
    const ctx = { status: 0, body: undefined };

    await controller.ready(ctx);

    expect(redisMockState.instances).toHaveLength(0);
    expect(ctx.status).toBe(200);
    expect(ctx.body).toMatchObject({
      status: 'ready',
      checks: {
        database: true,
        redis: true,
      },
    });
  });
});
