import type { Context } from 'koa';

import type { Strapi } from '../types';
import { recordAdminAuditEvent } from '../utils/audit-trail';
import { toSafeErrorMessage } from '../utils/json';

const trafficController = ({ strapi }: { strapi: Strapi }) => ({
  async snapshots(ctx: Context): Promise<void> {
    try {
      const snapshots = await strapi.plugin('ai-content-orchestrator').service('traffic-ingestor').list({
        source: typeof ctx.query.source === 'string' ? ctx.query.source : undefined,
        limit: Number(ctx.query.limit ?? 50),
      });
      ctx.body = { data: snapshots };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },

  async import(ctx: Context): Promise<void> {
    try {
      const body = (ctx.request.body ?? {}) as { day?: string; dryRun?: boolean; source?: string };
      const source = body.source === 'ga4' ? 'ga4' : 'first_party';
      const ingestor = strapi.plugin('ai-content-orchestrator').service('traffic-ingestor');
      const result =
        source === 'ga4'
          ? await ingestor.importGa4({ day: body.day, dryRun: body.dryRun })
          : await ingestor.importFirstParty({ day: body.day, dryRun: body.dryRun });

      await recordAdminAuditEvent(strapi, ctx, {
        action: 'traffic.import',
        outcome: body.dryRun ? 'skipped' : 'success',
        metadata: {
          source,
          day: body.day,
          dryRun: Boolean(body.dryRun),
          operation: result.operation,
        },
      });
      ctx.body = { data: result };
    } catch (error) {
      const body = (ctx.request.body ?? {}) as { day?: string; dryRun?: boolean; source?: string };
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'traffic.import',
        outcome: 'failure',
        severity: 'warn',
        metadata: {
          source: body.source === 'ga4' ? 'ga4' : 'first_party',
          day: body.day,
          dryRun: Boolean(body.dryRun),
          reason: toSafeErrorMessage(error),
        },
      });
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },
});

export default trafficController;
