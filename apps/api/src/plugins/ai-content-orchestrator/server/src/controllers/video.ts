import type { Context } from 'koa';

import type { Strapi } from '../types';
import { recordAdminAuditEvent } from '../utils/audit-trail';
import { toSafeErrorMessage } from '../utils/json';

const videoController = ({ strapi }: { strapi: Strapi }) => ({
  async assets(ctx: Context): Promise<void> {
    try {
      const assets = await strapi.plugin('ai-content-orchestrator').service('video-agent').list({
        status: typeof ctx.query.status === 'string' ? ctx.query.status : undefined,
        limit: Number(ctx.query.limit ?? 50),
      });
      ctx.body = { data: assets };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },

  async createJob(ctx: Context): Promise<void> {
    try {
      const body = (ctx.request.body ?? {}) as {
        title?: string;
        script?: string;
        workflowId?: number;
        idempotencyKey?: string;
        durationSeconds?: number;
        dryRun?: boolean;
      };

      if (!body.title?.trim()) {
        ctx.badRequest('Wymagane pole: title.');
        return;
      }

      const result = await strapi.plugin('ai-content-orchestrator').service('video-agent').createJob({
        title: body.title,
        script: body.script,
        workflowId: body.workflowId,
        idempotencyKey: body.idempotencyKey,
        durationSeconds: body.durationSeconds,
        dryRun: body.dryRun,
      });
      const generationJob = result.video?.generation_job;
      const generationJobId =
        typeof generationJob === 'number' ? generationJob : generationJob?.id ?? result.plan.generationJobId;
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'video.job.create',
        outcome: result.dryRun ? 'skipped' : 'success',
        resourceId: result.video?.id,
        metadata: {
          dryRun: result.dryRun,
          generationJobId,
          status: result.video?.status ?? 'planned',
          durationSeconds: result.plan.durationSeconds,
        },
      });
      ctx.body = { data: result };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },

  async render(ctx: Context): Promise<void> {
    try {
      const id = Number(ctx.params.id);
      if (!Number.isFinite(id)) {
        ctx.badRequest('Niepoprawny identyfikator video asset.');
        return;
      }

      const video = await strapi.plugin('ai-content-orchestrator').service('video-agent').render(id);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'video.asset.render',
        outcome: video.status === 'qc_passed' || video.status === 'uploaded' ? 'success' : 'skipped',
        resourceId: video.id ?? id,
        metadata: {
          status: video.status,
          provider: video.provider,
          blockedReason: video.blocked_reason,
        },
      });
      ctx.body = { data: video };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },
});

export default videoController;
