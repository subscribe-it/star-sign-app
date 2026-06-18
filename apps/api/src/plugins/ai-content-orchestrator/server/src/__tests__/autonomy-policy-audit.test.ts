import { describe, expect, it, vi } from 'vitest';

import { AUTONOMY_POLICY_UID, PLUGIN_ID } from '../constants';
import autonomyController from '../controllers/autonomy';
import type { Strapi } from '../types';

// Minimal Strapi stub mirroring the createStrapi helper in runtime.test.ts:
// resolves named services for the AICO plugin only.
const createStrapi = (services: Record<string, unknown>): Strapi =>
  ({
    plugin: (id: string) => {
      if (id !== PLUGIN_ID) {
        throw new Error(`Unexpected plugin ${id}`);
      }
      return { service: (name: string) => services[name] };
    },
    log: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  }) as unknown as Strapi;

const createCtx = (body: Record<string, unknown>) =>
  ({
    request: { body, headers: {} },
    params: {},
    query: {},
    state: { user: { id: 42 } },
    ip: '203.0.113.10',
    get: vi.fn(() => ''),
    badRequest: vi.fn(),
  }) as any;

describe('autonomy.updatePolicy — governance audit trail', () => {
  it('records a warning-severity audit event with only the changed fields', async () => {
    const previousPolicy = {
      id: 1,
      policy_key: 'global',
      autonomy_mode: 'guarded',
      global_kill_switch: false,
      daily_ads_budget_pln: 25,
      max_social_posts_per_day: 10,
    };
    const updatedPolicy = {
      ...previousPolicy,
      autonomy_mode: 'full',
      daily_ads_budget_pln: 100,
    };

    const recordFromContext = vi.fn(async () => null);
    const getPolicy = vi.fn(async () => previousPolicy);
    const updatePolicy = vi.fn(async () => updatedPolicy);
    const strapi = createStrapi({
      'audit-trail': { recordFromContext },
      'autonomy-policy': { getPolicy, updatePolicy },
    });

    const ctx = createCtx({ autonomy_mode: 'full', daily_ads_budget_pln: 100 });
    await autonomyController({ strapi }).updatePolicy(ctx);

    // Success response shape is preserved.
    expect(ctx.body).toEqual({ data: updatedPolicy });
    expect(ctx.badRequest).not.toHaveBeenCalled();
    // Reads the current policy before applying the update (for the diff).
    expect(getPolicy).toHaveBeenCalledTimes(1);
    expect(updatePolicy).toHaveBeenCalledWith({
      autonomy_mode: 'full',
      daily_ads_budget_pln: 100,
    });

    expect(recordFromContext).toHaveBeenCalledTimes(1);
    const [auditCtx, auditInput] = recordFromContext.mock.calls[0] as unknown as [
      unknown,
      Record<string, any>,
    ];
    expect(auditCtx).toBe(ctx);
    expect(auditInput).toMatchObject({
      action: 'autonomy.policy.update',
      outcome: 'success',
      severity: 'warn',
      resourceUid: AUTONOMY_POLICY_UID,
      resourceId: 1,
    });
    // Only changed keys appear in the diff, each with from/to.
    expect(auditInput.metadata.changed).toEqual({
      autonomy_mode: { from: 'guarded', to: 'full' },
      daily_ads_budget_pln: { from: 25, to: 100 },
    });
    expect(auditInput.metadata.changedKeys).toEqual(
      expect.arrayContaining(['autonomy_mode', 'daily_ads_budget_pln'])
    );
    // Unchanged fields are never recorded.
    expect(auditInput.metadata.changed).not.toHaveProperty('max_social_posts_per_day');
    expect(auditInput.metadata.changed).not.toHaveProperty('global_kill_switch');
  });

  it('records a failure audit event and preserves badRequest on error', async () => {
    const recordFromContext = vi.fn(async () => null);
    const getPolicy = vi.fn(async () => ({ id: 1, policy_key: 'global', autonomy_mode: 'guarded' }));
    const updatePolicy = vi.fn(async () => {
      throw new Error('policy_update_failed');
    });
    const strapi = createStrapi({
      'audit-trail': { recordFromContext },
      'autonomy-policy': { getPolicy, updatePolicy },
    });

    const ctx = createCtx({ autonomy_mode: 'full' });
    await autonomyController({ strapi }).updatePolicy(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('policy_update_failed');
    expect(ctx.body).toBeUndefined();

    const calls = recordFromContext.mock.calls as unknown as Array<
      [unknown, Record<string, unknown>]
    >;
    const failureCall = calls.find((call) => call[1].outcome === 'failure');
    expect(failureCall).toBeDefined();
    expect(failureCall?.[1]).toMatchObject({
      action: 'autonomy.policy.update',
      outcome: 'failure',
      severity: 'error',
      resourceUid: AUTONOMY_POLICY_UID,
      metadata: { error: 'policy_update_failed' },
    });
  });
});
