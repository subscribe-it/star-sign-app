import type { Context } from 'koa';

import { EDITOR_PERSONA_UID } from '../constants';
import type { Strapi } from '../types';
import { recordAdminAuditEvent } from '../utils/audit-trail';
import { getEntityService } from '../utils/entity-service';
import { toSafeErrorMessage } from '../utils/json';

const personasController = ({ strapi }: { strapi: Strapi }) => ({
  async find(ctx: Context): Promise<void> {
    const personas = await strapi.plugin('ai-content-orchestrator').service('personas').list();

    ctx.body = { data: personas };
  },

  async create(ctx: Context): Promise<void> {
    try {
      const body = (ctx.request.body ?? {}) as {
        name?: string;
        key?: string;
        byline?: string;
        bio?: string;
        specialization?: string;
        avatar?: number;
        temperament?: string;
        writing_style?: Record<string, unknown>;
        system_instruction?: string;
        prompt_prefix?: string;
        prompt_suffix?: string;
        llm_model?: string;
        temperature?: number;
        enabled_for?: string[];
        active?: boolean;
        priority?: number;
      };

      const created = await strapi
        .plugin('ai-content-orchestrator')
        .service('personas')
        .create({
          name: body.name ?? '',
          key: body.key,
          byline: body.byline,
          bio: body.bio,
          specialization: body.specialization,
          avatar: body.avatar,
          temperament: body.temperament,
          writing_style: body.writing_style,
          system_instruction: body.system_instruction,
          prompt_prefix: body.prompt_prefix,
          prompt_suffix: body.prompt_suffix,
          llm_model: body.llm_model,
          temperature: body.temperature,
          enabled_for: body.enabled_for,
          active: body.active,
          priority: body.priority,
        });

      await recordAdminAuditEvent(strapi, ctx, {
        action: 'persona.create',
        outcome: 'success',
        resourceUid: EDITOR_PERSONA_UID,
        resourceId: created.id,
        resourceLabel: created.name,
        metadata: {
          key: created.key,
          active: created.active,
        },
      });
      ctx.body = { data: created };
    } catch (error) {
      const message = toSafeErrorMessage(error);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'persona.create',
        outcome: 'failure',
        severity: 'error',
        resourceUid: EDITOR_PERSONA_UID,
        metadata: { error: message },
      });
      ctx.badRequest(message);
    }
  },

  async update(ctx: Context): Promise<void> {
    try {
      const id = Number(ctx.params.id);

      if (!Number.isFinite(id)) {
        ctx.badRequest('Niepoprawny identyfikator persony.');
        return;
      }

      const updated = await strapi
        .plugin('ai-content-orchestrator')
        .service('personas')
        .update(id, ctx.request.body ?? {});

      await recordAdminAuditEvent(strapi, ctx, {
        action: 'persona.update',
        outcome: 'success',
        resourceUid: EDITOR_PERSONA_UID,
        resourceId: id,
        resourceLabel: updated.name,
        metadata: {
          changedFields: Object.keys((ctx.request.body ?? {}) as Record<string, unknown>),
        },
      });
      ctx.body = { data: updated };
    } catch (error) {
      const message = toSafeErrorMessage(error);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'persona.update',
        outcome: 'failure',
        severity: 'error',
        resourceUid: EDITOR_PERSONA_UID,
        resourceId: ctx.params.id,
        metadata: { error: message },
      });
      ctx.badRequest(message);
    }
  },

  async delete(ctx: Context): Promise<void> {
    const id = Number(ctx.params.id);

    if (!Number.isFinite(id)) {
      ctx.badRequest('Niepoprawny identyfikator persony.');
      return;
    }

    try {
      await getEntityService(strapi).delete(EDITOR_PERSONA_UID, id);

      await recordAdminAuditEvent(strapi, ctx, {
        action: 'persona.delete',
        outcome: 'success',
        resourceUid: EDITOR_PERSONA_UID,
        resourceId: id,
        metadata: { deleted: true },
      });
      ctx.body = { data: { id } };
    } catch (error) {
      const message = toSafeErrorMessage(error);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'persona.delete',
        outcome: 'failure',
        severity: 'error',
        resourceUid: EDITOR_PERSONA_UID,
        resourceId: id,
        metadata: { error: message },
      });
      ctx.badRequest(message);
    }
  },
});

export default personasController;
