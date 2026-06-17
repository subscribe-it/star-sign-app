import type { Context } from 'koa';

import type { AuditEventRecord, Strapi } from '../types';
import { toSafeErrorMessage } from './json';
import { getPluginService } from './plugin';

type AuditTrailService = {
  record: (input: {
    action: string;
    outcome: AuditEventRecord['outcome'];
    severity?: AuditEventRecord['severity'];
    actor?: {
      actorType: 'admin' | 'system' | 'unknown';
      actorId?: string;
      requestId?: string;
      ipHash?: string;
    };
    resourceUid?: string;
    resourceId?: string | number;
    resourceLabel?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<AuditEventRecord | null>;
  recordFromContext: (
    ctx: Context,
    input: {
      action: string;
      outcome: AuditEventRecord['outcome'];
      severity?: AuditEventRecord['severity'];
      resourceUid?: string;
      resourceId?: string | number;
      resourceLabel?: string;
      metadata?: Record<string, unknown>;
    }
  ) => Promise<AuditEventRecord | null>;
};

// Bounded retry with backoff so a transient DB hiccup does not silently drop an
// audit event. Strict mode still rethrows after retries are exhausted.
const AUDIT_RETRY_DELAYS_MS = [100, 300];

const withAuditRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= AUDIT_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const wait = AUDIT_RETRY_DELAYS_MS[attempt];
      if (wait !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
  }
  throw lastError;
};

export const recordAdminAuditEvent = async (
  strapi: Strapi,
  ctx: Context,
  input: Parameters<AuditTrailService['recordFromContext']>[1]
): Promise<void> => {
  try {
    const service = getPluginService<Partial<AuditTrailService>>(strapi, 'audit-trail');
    const recordFromContext = service?.recordFromContext;
    if (typeof recordFromContext === 'function') {
      await withAuditRetry(() => recordFromContext.call(service, ctx, input));
    }
  } catch (error) {
    strapi.log.warn(`[aico] admin audit event skipped: ${toSafeErrorMessage(error)}`);
  }
};

export const recordSystemAuditEvent = async (
  strapi: Strapi,
  input: Parameters<AuditTrailService['record']>[0]
): Promise<void> => {
  try {
    const service = getPluginService<Partial<AuditTrailService>>(strapi, 'audit-trail');
    const record = service?.record;
    if (typeof record === 'function') {
      await withAuditRetry(() =>
        record.call(service, {
          ...input,
          actor: input.actor ?? { actorType: 'system' },
        })
      );
      return;
    }

    if (process.env.AICO_AUDIT_TRAIL_STRICT === 'true') {
      throw new Error('audit_trail_service_missing');
    }
  } catch (error) {
    if (process.env.AICO_AUDIT_TRAIL_STRICT === 'true') {
      throw error;
    }

    strapi.log.warn(`[aico] system audit event skipped: ${toSafeErrorMessage(error)}`);
  }
};
