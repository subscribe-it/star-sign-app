import { randomUUID } from 'crypto';
import { hostname } from 'os';

import { RUNTIME_LOCK_UID } from '../constants';
import type { RuntimeLockRecord, Strapi } from '../types';
import { getEntityService } from '../utils/entity-service';
import { toSafeErrorMessage } from '../utils/json';

type AcquireLockInput = {
  key: string;
  ttlMs?: number;
  metadata?: Record<string, unknown>;
  now?: Date;
};

type LockResult =
  | { acquired: true; lock: RuntimeLockRecord }
  | { acquired: false; reason: 'disabled' | 'held'; lock?: RuntimeLockRecord };

const DEFAULT_LOCK_TTL_MS = 55_000;
const MAX_LOCK_TTL_MS = 6 * 60 * 60_000;
// Process identity prefix; a fresh unique owner token is minted per acquisition
// (see acquire) so the CAS takeover predicate strictly changes on every successful
// takeover — distinguishing two racers even within the same process.
const OWNER_PREFIX = `${hostname()}:${process.pid}`;
const RUNTIME_LOCK_TABLE = 'aico_runtime_locks';

type KnexLikeQuery = {
  where: (criteria: Record<string, unknown>) => KnexLikeQuery;
  update: (data: Record<string, unknown>) => Promise<number | unknown>;
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const getConnection = (strapi: Strapi): ((table: string) => KnexLikeQuery) | null => {
  const connection = (strapi as unknown as { db?: { connection?: unknown } }).db?.connection;
  return typeof connection === 'function' ? (connection as (table: string) => KnexLikeQuery) : null;
};

const isExpired = (lock: RuntimeLockRecord, now: Date): boolean => {
  const expiresAt = new Date(lock.expires_at);
  return !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime();
};

const runtimeLocks = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  return {
    async acquire(input: AcquireLockInput): Promise<LockResult> {
      if (process.env.AICO_RUNTIME_LOCKS_DISABLED === 'true') {
        return { acquired: false, reason: 'disabled' };
      }

      const now = input.now ?? new Date();
      const owner = `${OWNER_PREFIX}:${randomUUID()}`;
      const ttlMs = Math.max(5_000, Math.min(MAX_LOCK_TTL_MS, Number(input.ttlMs ?? DEFAULT_LOCK_TTL_MS)));
      const expiresAt = new Date(now.getTime() + ttlMs);
      const existing = (
        await entityService.findMany<RuntimeLockRecord>(RUNTIME_LOCK_UID, {
          filters: { lock_key: input.key },
          limit: 1,
        })
      )[0];

      if (!existing) {
        try {
          const lock = await entityService.create<RuntimeLockRecord>(RUNTIME_LOCK_UID, {
            data: {
              lock_key: input.key,
              owner_id: owner,
              status: 'active',
              acquired_at: now,
              expires_at: expiresAt,
              released_at: null,
              metadata: input.metadata ?? {},
            },
          });
          return { acquired: true, lock };
        } catch (error) {
          strapi.log.warn(
            `[aico] runtime lock create race for ${input.key}: ${toSafeErrorMessage(error)}`
          );
          return { acquired: false, reason: 'held' };
        }
      }

      if (existing.status === 'released' || isExpired(existing, now)) {
        const connection = getConnection(strapi);

        if (connection) {
          // Atomic compare-and-swap takeover: the UPDATE only matches if the row
          // still has the (owner_id, status) we just observed. The new owner token
          // is unique per acquisition, so once one runner takes over, every other
          // racer's WHERE matches 0 rows and backs off. Closes the read-then-update
          // race on expired/released locks.
          // NOTE: pass Date objects (not ISO strings) so knex/driver datetime
          // encoding matches Strapi exactly — ISO strings land in PG
          // `timestamp WITHOUT TIME ZONE` columns shifted by the process offset.
          // NOTE: do NOT add .returning() here — it would change the resolved value
          // from an affected-rows count to a row array and break the CAS check.
          const affected = await connection(RUNTIME_LOCK_TABLE)
            .where({ id: existing.id, owner_id: existing.owner_id, status: existing.status })
            .update({
              owner_id: owner,
              status: 'active',
              acquired_at: now,
              expires_at: expiresAt,
              released_at: null,
            });
          const changed = typeof affected === 'number' ? affected : Number(affected ?? 0);

          if (changed >= 1) {
            return {
              acquired: true,
              lock: {
                ...existing,
                owner_id: owner,
                status: 'active',
                acquired_at: now.toISOString(),
                expires_at: expiresAt.toISOString(),
                released_at: null,
              },
            };
          }

          return { acquired: false, reason: 'held', lock: existing };
        }

        // Fallback when no SQL connection is available (e.g. unit tests with a
        // mocked entity service). Not atomic, acceptable only in single-process tests.
        const lock = await entityService.update<RuntimeLockRecord>(RUNTIME_LOCK_UID, existing.id, {
          data: {
            owner_id: owner,
            status: 'active',
            acquired_at: now,
            expires_at: expiresAt,
            released_at: null,
            metadata: input.metadata ?? {},
          },
        });
        return { acquired: true, lock };
      }

      return { acquired: false, reason: 'held', lock: existing };
    },

    async release(lock: RuntimeLockRecord, releasedAt = new Date()): Promise<void> {
      // Match the exact owner token this acquisition minted; never release a lock
      // we no longer own (e.g. it expired and was taken over by another runner).
      if (!lock.owner_id || !lock.owner_id.startsWith(OWNER_PREFIX)) {
        return;
      }

      const current = (
        await entityService.findMany<RuntimeLockRecord>(RUNTIME_LOCK_UID, {
          filters: { lock_key: lock.lock_key, owner_id: lock.owner_id, status: 'active' },
          limit: 1,
        })
      )[0];

      if (!current || current.id !== lock.id) {
        return;
      }

      await entityService.update<RuntimeLockRecord>(RUNTIME_LOCK_UID, lock.id, {
        data: {
          status: 'released',
          released_at: releasedAt,
        },
      });
    },

    async withLock<T>(
      key: string,
      input: Omit<AcquireLockInput, 'key'>,
      runner: () => Promise<T>
    ): Promise<T | undefined> {
      const result = await this.acquire({ ...input, key });

      if (result.acquired === false) {
        strapi.log.info(`[aico] runtime lock skipped ${key}: ${result.reason}`);
        if (result.reason === 'disabled') {
          return runner();
        }

        return undefined;
      }

      try {
        return await runner();
      } finally {
        await this.release(result.lock);
      }
    },

    // Like withLock, but waits (bounded retries) for the lock instead of skipping,
    // and throws on contention timeout. Used to serialize critical sections such as
    // ads-budget reservation so concurrent runners cannot exceed the daily cap.
    async runExclusive<T>(
      key: string,
      input: Omit<AcquireLockInput, 'key'> & { retries?: number; retryDelayMs?: number },
      runner: () => Promise<T>
    ): Promise<T> {
      if (process.env.AICO_RUNTIME_LOCKS_DISABLED === 'true') {
        return runner();
      }

      const retries = Math.max(0, Number(input.retries ?? 50));
      const retryDelayMs = Math.max(10, Number(input.retryDelayMs ?? 100));
      const ttlMs = input.ttlMs ?? 15_000;

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        const result = await this.acquire({ key, ttlMs, metadata: input.metadata });
        if (result.acquired) {
          try {
            return await runner();
          } finally {
            await this.release(result.lock);
          }
        }
        await delay(retryDelayMs);
      }

      throw new Error(`[aico] runtime lock contention timeout for ${key}`);
    },
  };
};

export default runtimeLocks;
