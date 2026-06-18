import type { Context } from 'koa';

import { TOPIC_QUEUE_UID } from '../constants';
import type { Strapi } from '../types';
import { recordAdminAuditEvent } from '../utils/audit-trail';
import { getEntityService } from '../utils/entity-service';
import { toSafeErrorMessage } from '../utils/json';

const topicsController = ({ strapi }: { strapi: Strapi }) => ({
  async find(ctx: Context): Promise<void> {
    const topics = await strapi.plugin('ai-content-orchestrator').service('topics').list();
    const serialized = topics.map((item: Record<string, unknown>) =>
      strapi.plugin('ai-content-orchestrator').service('topics').serialize(item)
    );

    ctx.body = { data: serialized };
  },

  async create(ctx: Context): Promise<void> {
    try {
      const body = (ctx.request.body ?? {}) as {
        title?: string;
        brief?: string;
        image_asset_key?: string;
        scheduled_for?: string;
        workflow?: number;
        article_category?: number;
        seo_intent?: string;
        target_persona?: string;
        priority_score?: number;
        plan_item?: number;
        metadata?: Record<string, unknown>;
      };

      const created = await strapi
        .plugin('ai-content-orchestrator')
        .service('topics')
        .create({
          title: body.title ?? '',
          brief: body.brief,
          image_asset_key: body.image_asset_key,
          scheduled_for: body.scheduled_for,
          workflow: body.workflow,
          article_category: body.article_category,
          seo_intent: body.seo_intent,
          target_persona: body.target_persona,
          priority_score: body.priority_score,
          plan_item: body.plan_item,
          metadata: body.metadata,
        });

      const serialized = strapi
        .plugin('ai-content-orchestrator')
        .service('topics')
        .serialize(created);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'topic.create',
        outcome: 'success',
        resourceUid: TOPIC_QUEUE_UID,
        resourceId: created.id,
        resourceLabel: created.title,
        metadata: {
          workflow: body.workflow,
          articleCategory: body.article_category,
          scheduledFor: body.scheduled_for,
        },
      });
      ctx.body = { data: serialized };
    } catch (error) {
      const message = toSafeErrorMessage(error);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'topic.create',
        outcome: 'failure',
        severity: 'error',
        resourceUid: TOPIC_QUEUE_UID,
        metadata: { error: message },
      });
      ctx.badRequest(message);
    }
  },

  async update(ctx: Context): Promise<void> {
    try {
      const id = Number(ctx.params.id);

      if (!Number.isFinite(id)) {
        ctx.badRequest('Niepoprawny identyfikator tematu.');
        return;
      }

      const updated = await strapi
        .plugin('ai-content-orchestrator')
        .service('topics')
        .update(id, ctx.request.body ?? {});

      const serialized = strapi
        .plugin('ai-content-orchestrator')
        .service('topics')
        .serialize(updated);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'topic.update',
        outcome: 'success',
        resourceUid: TOPIC_QUEUE_UID,
        resourceId: id,
        resourceLabel: updated.title,
        metadata: {
          changedFields: Object.keys((ctx.request.body ?? {}) as Record<string, unknown>),
        },
      });
      ctx.body = { data: serialized };
    } catch (error) {
      const message = toSafeErrorMessage(error);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'topic.update',
        outcome: 'failure',
        severity: 'error',
        resourceUid: TOPIC_QUEUE_UID,
        resourceId: ctx.params.id,
        metadata: { error: message },
      });
      ctx.badRequest(message);
    }
  },

  async delete(ctx: Context): Promise<void> {
    const id = Number(ctx.params.id);

    if (!Number.isFinite(id)) {
      ctx.badRequest('Niepoprawny identyfikator tematu.');
      return;
    }

    try {
      await getEntityService(strapi).delete(TOPIC_QUEUE_UID, id);

      await recordAdminAuditEvent(strapi, ctx, {
        action: 'topic.delete',
        outcome: 'success',
        resourceUid: TOPIC_QUEUE_UID,
        resourceId: id,
        metadata: { deleted: true },
      });
      ctx.body = { data: { id } };
    } catch (error) {
      const message = toSafeErrorMessage(error);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'topic.delete',
        outcome: 'failure',
        severity: 'error',
        resourceUid: TOPIC_QUEUE_UID,
        resourceId: id,
        metadata: { error: message },
      });
      ctx.badRequest(message);
    }
  },
});

export default topicsController;
