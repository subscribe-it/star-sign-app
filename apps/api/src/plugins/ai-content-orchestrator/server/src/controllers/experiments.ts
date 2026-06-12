import type { Context } from 'koa';

import type { Strapi } from '../types';
import { recordAdminAuditEvent } from '../utils/audit-trail';
import { toSafeErrorMessage } from '../utils/json';

const experimentsController = ({ strapi }: { strapi: Strapi }) => ({
  async list(ctx: Context): Promise<void> {
    try {
      const experiments = await strapi.plugin('ai-content-orchestrator').service('experiment-agent').list({
        status: typeof ctx.query.status === 'string' ? ctx.query.status : undefined,
        limit: Number(ctx.query.limit ?? 50),
      });
      ctx.body = { data: experiments };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },

  async chooseWinner(ctx: Context): Promise<void> {
    try {
      const id = Number(ctx.params.id);
      const body = (ctx.request.body ?? {}) as { winnerVariantKey?: string };
      if (!Number.isFinite(id) || !body.winnerVariantKey?.trim()) {
        ctx.badRequest('Wymagane pola: id i winnerVariantKey.');
        return;
      }

      const experiment = await strapi
        .plugin('ai-content-orchestrator')
        .service('experiment-agent')
        .chooseWinner(id, body.winnerVariantKey);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'experiment.choose-winner',
        outcome: 'success',
        resourceId: experiment.id ?? id,
        metadata: {
          experimentType: experiment.experiment_type,
          status: experiment.status,
          winnerVariantKey: body.winnerVariantKey,
        },
      });
      ctx.body = { data: experiment };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },
});

export default experimentsController;
