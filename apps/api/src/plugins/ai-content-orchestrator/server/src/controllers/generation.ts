import type { Context } from 'koa';

import type { Strapi } from '../types';
import { recordAdminAuditEvent } from '../utils/audit-trail';
import { toSafeErrorMessage } from '../utils/json';

const generationController = ({ strapi }: { strapi: Strapi }) => ({
  async listJobs(ctx: Context): Promise<void> {
    try {
      const jobs = await strapi.plugin('ai-content-orchestrator').service('generation-jobs').list({
        status: typeof ctx.query.status === 'string' ? ctx.query.status : undefined,
        jobType: typeof ctx.query.jobType === 'string' ? ctx.query.jobType : undefined,
        limit: Number(ctx.query.limit ?? 50),
      });
      ctx.body = { data: jobs };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },

  async retryJob(ctx: Context): Promise<void> {
    try {
      const id = Number(ctx.params.id);
      if (!Number.isFinite(id)) {
        ctx.badRequest('Niepoprawny identyfikator joba.');
        return;
      }
      const job = await strapi.plugin('ai-content-orchestrator').service('generation-jobs').retry(id);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'generation.job.retry',
        outcome: 'success',
        resourceId: job.id ?? id,
        metadata: {
          job_type: job.job_type,
          status: job.status,
        },
      });
      ctx.body = { data: job };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },

  async cancelJob(ctx: Context): Promise<void> {
    try {
      const id = Number(ctx.params.id);
      if (!Number.isFinite(id)) {
        ctx.badRequest('Niepoprawny identyfikator joba.');
        return;
      }
      const job = await strapi.plugin('ai-content-orchestrator').service('generation-jobs').cancel(id);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'generation.job.cancel',
        outcome: 'success',
        resourceId: job.id ?? id,
        metadata: {
          job_type: job.job_type,
          status: job.status,
        },
      });
      ctx.body = { data: job };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },
});

export default generationController;
