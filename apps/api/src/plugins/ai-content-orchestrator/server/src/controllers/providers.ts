import type { Context } from 'koa';

import type { ProviderKey, Strapi } from '../types';
import { recordAdminAuditEvent } from '../utils/audit-trail';
import { toSafeErrorMessage } from '../utils/json';

const providersController = ({ strapi }: { strapi: Strapi }) => ({
  async status(ctx: Context): Promise<void> {
    try {
      const statuses = await strapi.plugin('ai-content-orchestrator').service('provider-status').list({
        provider: typeof ctx.query.provider === 'string' ? ctx.query.provider : undefined,
        limit: Number(ctx.query.limit ?? 100),
      });
      ctx.body = { data: statuses };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },

  async testReadiness(ctx: Context): Promise<void> {
    try {
      const body = (ctx.request.body ?? {}) as {
        providers?: ProviderKey[];
        includeConnectivity?: boolean;
      };
      const result = await strapi
        .plugin('ai-content-orchestrator')
        .service('provider-probe')
        .testProviders({
          providers: Array.isArray(body.providers) ? body.providers : undefined,
          includeConnectivity: body.includeConnectivity === true,
        });

      await recordAdminAuditEvent(strapi, ctx, {
        action: 'providers.test-readiness',
        outcome: 'success',
        metadata: {
          providers: Array.isArray(body.providers) ? body.providers : undefined,
          includeConnectivity: body.includeConnectivity === true,
          liveEffects: false,
          resultCount: result.results.length,
        },
      });
      ctx.body = { data: result };
    } catch (error) {
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'providers.test-readiness',
        outcome: 'failure',
        severity: 'warn',
        metadata: {
          reason: toSafeErrorMessage(error),
        },
      });
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },
});

export default providersController;
