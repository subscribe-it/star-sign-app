import type { Context } from 'koa';

import type { Strapi } from '../types';
import { recordAdminAuditEvent } from '../utils/audit-trail';
import { toSafeErrorMessage } from '../utils/json';

const ADS_STOP_LOSS_CONFIRMATION = 'PAUSE_ACTIVE_ADS';

const adsController = ({ strapi }: { strapi: Strapi }) => ({
  async campaignPlans(ctx: Context): Promise<void> {
    try {
      const plans = await strapi.plugin('ai-content-orchestrator').service('ads-agent').list({
        status: typeof ctx.query.status === 'string' ? ctx.query.status : undefined,
        platform: typeof ctx.query.platform === 'string' ? ctx.query.platform : undefined,
        limit: Number(ctx.query.limit ?? 50),
      });
      ctx.body = { data: plans };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },

  async createCampaignPlan(ctx: Context): Promise<void> {
    try {
      const body = (ctx.request.body ?? {}) as {
        name?: string;
        platform?: 'meta' | 'google';
        targetUrl?: string;
        dailyBudgetPln?: number;
        objective?: string;
        creativePayload?: Record<string, unknown>;
        targetingPayload?: Record<string, unknown>;
        dryRun?: boolean;
      };

      if (!body.name?.trim() || !body.targetUrl?.trim() || !body.platform) {
        ctx.badRequest('Wymagane pola: name, platform, targetUrl.');
        return;
      }

      const result = await strapi.plugin('ai-content-orchestrator').service('ads-agent').createPlan({
        name: body.name,
        platform: body.platform,
        targetUrl: body.targetUrl,
        dailyBudgetPln: body.dailyBudgetPln,
        objective: body.objective,
        creativePayload: body.creativePayload,
        targetingPayload: body.targetingPayload,
        dryRun: body.dryRun,
      });
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'ads.campaign-plan.create',
        outcome: result.dryRun || !result.allowed ? 'skipped' : 'success',
        resourceId: result.plan?.id,
        metadata: {
          platform: body.platform,
          allowed: result.allowed,
          reason: result.reason,
          dryRun: result.dryRun,
          requestedBudgetPln: result.budget.requestedPln,
        },
      });
      ctx.body = { data: result };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },

  async activate(ctx: Context): Promise<void> {
    try {
      const id = Number(ctx.params.id);
      if (!Number.isFinite(id)) {
        ctx.badRequest('Niepoprawny identyfikator planu kampanii.');
        return;
      }
      const plan = await strapi.plugin('ai-content-orchestrator').service('ads-agent').activate(id);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'ads.campaign-plan.activate',
        outcome: plan.status === 'active' ? 'success' : 'skipped',
        resourceId: plan.id ?? id,
        metadata: {
          platform: plan.platform,
          status: plan.status,
          blockedReason: plan.blocked_reason,
          dailyBudgetPln: plan.daily_budget_pln,
        },
      });
      ctx.body = { data: plan };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },

  async pause(ctx: Context): Promise<void> {
    try {
      const id = Number(ctx.params.id);
      if (!Number.isFinite(id)) {
        ctx.badRequest('Niepoprawny identyfikator planu kampanii.');
        return;
      }
      const plan = await strapi.plugin('ai-content-orchestrator').service('ads-agent').pause(id);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'ads.campaign-plan.pause',
        outcome: plan.status === 'paused' ? 'success' : 'skipped',
        resourceId: plan.id ?? id,
        metadata: {
          platform: plan.platform,
          status: plan.status,
          blockedReason: plan.blocked_reason,
          dailyBudgetPln: plan.daily_budget_pln,
        },
      });
      ctx.body = { data: plan };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },

  async pauseActive(ctx: Context): Promise<void> {
    try {
      const body = (ctx.request.body ?? {}) as {
        confirmation?: string;
      };

      if (body.confirmation !== ADS_STOP_LOSS_CONFIRMATION) {
        await recordAdminAuditEvent(strapi, ctx, {
          action: 'ads.campaign-plan.stop-loss',
          outcome: 'skipped',
          severity: 'warn',
          metadata: {
            reason: 'confirmation_required',
            requiredConfirmation: ADS_STOP_LOSS_CONFIRMATION,
          },
        });
        ctx.badRequest(`Wymagane potwierdzenie ${ADS_STOP_LOSS_CONFIRMATION}.`);
        return;
      }

      const result = await strapi.plugin('ai-content-orchestrator').service('ads-agent').pauseActiveForKillSwitch({
        reason: 'manual_admin_stop_loss',
      });
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'ads.campaign-plan.stop-loss',
        outcome: result.failed > 0 || result.blocked > 0 ? 'skipped' : 'success',
        severity: result.failed > 0 || result.blocked > 0 ? 'warn' : 'info',
        metadata: {
          reason: result.reason,
          attempted: result.attempted,
          paused: result.paused,
          blocked: result.blocked,
          failed: result.failed,
        },
      });
      ctx.body = { data: result };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },
});

export default adsController;
