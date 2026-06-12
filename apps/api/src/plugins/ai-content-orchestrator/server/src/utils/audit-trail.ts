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

export const recordAdminAuditEvent = async (
  strapi: Strapi,
  ctx: Context,
  input: Parameters<AuditTrailService['recordFromContext']>[1]
): Promise<void> => {
  try {
    const service = getPluginService<Partial<AuditTrailService>>(strapi, 'audit-trail');
    if (typeof service?.recordFromContext === 'function') {
      await service.recordFromContext(ctx, input);
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
    if (typeof service?.record === 'function') {
      await service.record({
        ...input,
        actor: input.actor ?? { actorType: 'system' },
      });
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
