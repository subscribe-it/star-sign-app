import type { Context } from 'koa';

import { MEDIA_ASSET_UID } from '../constants';
import type { MediaPeriodScope, MediaPurpose, Strapi } from '../types';
import { recordAdminAuditEvent } from '../utils/audit-trail';
import { getEntityService } from '../utils/entity-service';
import { toSafeErrorMessage } from '../utils/json';

const mediaAssetsController = ({ strapi }: { strapi: Strapi }) => ({
  async find(ctx: Context): Promise<void> {
    const rows = await strapi.plugin('ai-content-orchestrator').service('media-assets').list();
    const data = rows.map((item: Record<string, unknown>) =>
      strapi.plugin('ai-content-orchestrator').service('media-assets').serialize(item)
    );

    ctx.body = { data };
  },

  async create(ctx: Context): Promise<void> {
    try {
      const created = await strapi
        .plugin('ai-content-orchestrator')
        .service('media-assets')
        .create((ctx.request.body ?? {}) as Record<string, unknown>);

      const serialized = strapi
        .plugin('ai-content-orchestrator')
        .service('media-assets')
        .serialize(created);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'media-asset.create',
        outcome: 'success',
        resourceUid: MEDIA_ASSET_UID,
        resourceId: created.id,
        resourceLabel: created.title ?? created.key,
        metadata: {
          changedFields: Object.keys((ctx.request.body ?? {}) as Record<string, unknown>),
        },
      });
      ctx.body = { data: serialized };
    } catch (error) {
      const message = toSafeErrorMessage(error);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'media-asset.create',
        outcome: 'failure',
        severity: 'error',
        resourceUid: MEDIA_ASSET_UID,
        metadata: { error: message },
      });
      ctx.badRequest(message);
    }
  },

  async update(ctx: Context): Promise<void> {
    try {
      const id = Number(ctx.params.id);

      if (!Number.isFinite(id)) {
        ctx.badRequest('Niepoprawny identyfikator media-asset.');
        return;
      }

      const updated = await strapi
        .plugin('ai-content-orchestrator')
        .service('media-assets')
        .update(id, (ctx.request.body ?? {}) as Record<string, unknown>);

      const serialized = strapi
        .plugin('ai-content-orchestrator')
        .service('media-assets')
        .serialize(updated);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'media-asset.update',
        outcome: 'success',
        resourceUid: MEDIA_ASSET_UID,
        resourceId: id,
        resourceLabel: updated.title ?? updated.key,
        metadata: {
          changedFields: Object.keys((ctx.request.body ?? {}) as Record<string, unknown>),
        },
      });
      ctx.body = { data: serialized };
    } catch (error) {
      const message = toSafeErrorMessage(error);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'media-asset.update',
        outcome: 'failure',
        severity: 'error',
        resourceUid: MEDIA_ASSET_UID,
        resourceId: ctx.params.id,
        metadata: { error: message },
      });
      ctx.badRequest(message);
    }
  },

  async delete(ctx: Context): Promise<void> {
    const id = Number(ctx.params.id);

    if (!Number.isFinite(id)) {
      ctx.badRequest('Niepoprawny identyfikator media-asset.');
      return;
    }

    try {
      await getEntityService(strapi).delete(MEDIA_ASSET_UID, id);

      await recordAdminAuditEvent(strapi, ctx, {
        action: 'media-asset.delete',
        outcome: 'success',
        resourceUid: MEDIA_ASSET_UID,
        resourceId: id,
        metadata: { deleted: true },
      });
      ctx.body = { data: { id } };
    } catch (error) {
      const message = toSafeErrorMessage(error);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'media-asset.delete',
        outcome: 'failure',
        severity: 'error',
        resourceUid: MEDIA_ASSET_UID,
        resourceId: id,
        metadata: { error: message },
      });
      ctx.badRequest(message);
    }
  },

  async bulkUpsert(ctx: Context): Promise<void> {
    try {
      const body = (ctx.request.body ?? {}) as {
        items?: Array<Record<string, unknown>>;
        dryRun?: boolean;
        apply?: boolean;
      };

      const result = await strapi
        .plugin('ai-content-orchestrator')
        .service('media-assets')
        .bulkUpsert({
          items: Array.isArray(body.items) ? body.items : [],
          dryRun: body.dryRun,
          apply: body.apply,
        });

      await recordAdminAuditEvent(strapi, ctx, {
        action: 'media-asset.bulk-upsert',
        outcome: 'success',
        resourceUid: MEDIA_ASSET_UID,
        metadata: {
          count: Array.isArray(body.items) ? body.items.length : 0,
          dryRun: Boolean(body.dryRun),
          apply: Boolean(body.apply),
          result,
        },
      });
      ctx.body = { data: result };
    } catch (error) {
      const message = toSafeErrorMessage(error);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'media-asset.bulk-upsert',
        outcome: 'failure',
        severity: 'error',
        resourceUid: MEDIA_ASSET_UID,
        metadata: { error: message },
      });
      ctx.badRequest(message);
    }
  },

  async previewIdentity(ctx: Context): Promise<void> {
    try {
      const body = (ctx.request.body ?? {}) as Record<string, unknown>;
      const purpose =
        typeof body.purpose === 'string' ? (body.purpose as MediaPurpose) : 'blog_article';
      const periodScope =
        typeof body.period_scope === 'string' ? (body.period_scope as MediaPeriodScope) : 'any';
      const result = await strapi
        .plugin('ai-content-orchestrator')
        .service('media-assets')
        .previewIdentity({
          fileId: Number(body.fileId),
          purpose,
          sign_slug: typeof body.sign_slug === 'string' ? body.sign_slug : null,
          period_scope: periodScope,
          excludeId: typeof body.excludeId === 'number' ? body.excludeId : null,
        });

      ctx.body = { data: result };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },

  async validateCoverage(ctx: Context): Promise<void> {
    try {
      const body = (ctx.request.body ?? {}) as { applyWorkflowDisabling?: boolean };
      const result = await strapi
        .plugin('ai-content-orchestrator')
        .service('media-assets')
        .validateCoverage({
          applyWorkflowDisabling: Boolean(body.applyWorkflowDisabling),
        });

      await recordAdminAuditEvent(strapi, ctx, {
        action: 'media-asset.validate-coverage',
        outcome: 'success',
        resourceUid: MEDIA_ASSET_UID,
        metadata: {
          applyWorkflowDisabling: Boolean(body.applyWorkflowDisabling),
          result,
        },
      });
      ctx.body = { data: result };
    } catch (error) {
      const message = toSafeErrorMessage(error);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'media-asset.validate-coverage',
        outcome: 'failure',
        severity: 'error',
        resourceUid: MEDIA_ASSET_UID,
        metadata: { error: message },
      });
      ctx.badRequest(message);
    }
  },

  async backfillArticleImages(ctx: Context): Promise<void> {
    try {
      const result = await strapi
        .plugin('ai-content-orchestrator')
        .service('orchestrator')
        .reconcileArticleImages();

      await recordAdminAuditEvent(strapi, ctx, {
        action: 'media-asset.backfill-article-images',
        outcome: 'success',
        resourceUid: MEDIA_ASSET_UID,
        metadata: { result },
      });
      ctx.body = { data: result };
    } catch (error) {
      const message = toSafeErrorMessage(error);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'media-asset.backfill-article-images',
        outcome: 'failure',
        severity: 'error',
        resourceUid: MEDIA_ASSET_UID,
        metadata: { error: message },
      });
      ctx.internalServerError(message);
    }
  },

  async backfillTarotCardImages(ctx: Context): Promise<void> {
    try {
      const result = await strapi
        .plugin('ai-content-orchestrator')
        .service('orchestrator')
        .reconcileTarotCardImages();

      await recordAdminAuditEvent(strapi, ctx, {
        action: 'media-asset.backfill-tarot-card-images',
        outcome: 'success',
        resourceUid: MEDIA_ASSET_UID,
        metadata: { result },
      });
      ctx.body = { data: result };
    } catch (error) {
      const message = toSafeErrorMessage(error);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'media-asset.backfill-tarot-card-images',
        outcome: 'failure',
        severity: 'error',
        resourceUid: MEDIA_ASSET_UID,
        metadata: { error: message },
      });
      ctx.internalServerError(message);
    }
  },

  async backfillZodiacSignImages(ctx: Context): Promise<void> {
    try {
      const result = await strapi
        .plugin('ai-content-orchestrator')
        .service('orchestrator')
        .reconcileZodiacSignImagesBackfill();

      await recordAdminAuditEvent(strapi, ctx, {
        action: 'media-asset.backfill-zodiac-sign-images',
        outcome: 'success',
        resourceUid: MEDIA_ASSET_UID,
        metadata: { result },
      });
      ctx.body = { data: result };
    } catch (error) {
      const message = toSafeErrorMessage(error);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'media-asset.backfill-zodiac-sign-images',
        outcome: 'failure',
        severity: 'error',
        resourceUid: MEDIA_ASSET_UID,
        metadata: { error: message },
      });
      ctx.internalServerError(message);
    }
  },
});

export default mediaAssetsController;
