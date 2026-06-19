import type { Context } from 'koa';

import type { EditorPersonaRecord, Strapi } from '../types';
import { toSafeErrorMessage } from '../utils/json';

/**
 * Public, read-only view of an editor persona for the public website (E-E-A-T
 * authorship). Exposes ONLY safe, audience-facing fields. It MUST NEVER leak LLM
 * internals (system_instruction, prompt_prefix, prompt_suffix, llm_model,
 * temperature, writing_style, enabled_for, temperament, etc.).
 */
type PublicPersona = {
  key: string;
  byline: string | null;
  bio: string | null;
  specialization: string | null;
  avatar: {
    url: string;
    alternativeText: string | null;
  } | null;
};

const toPublicAvatar = (
  avatar: EditorPersonaRecord['avatar'],
): PublicPersona['avatar'] => {
  if (!avatar || typeof avatar !== 'object') {
    return null;
  }

  const url = typeof avatar.url === 'string' ? avatar.url : null;

  if (!url) {
    return null;
  }

  const alternativeText =
    'alternativeText' in avatar &&
    typeof (avatar as { alternativeText?: unknown }).alternativeText === 'string'
      ? ((avatar as { alternativeText?: string }).alternativeText ?? null)
      : null;

  return { url, alternativeText };
};

const toPublicPersona = (persona: EditorPersonaRecord): PublicPersona => ({
  key: persona.key,
  byline: persona.byline ?? null,
  bio: persona.bio ?? null,
  specialization: persona.specialization ?? null,
  avatar: toPublicAvatar(persona.avatar),
});

const personasPublicController = ({ strapi }: { strapi: Strapi }) => ({
  /**
   * GET /editor-personas — public list of ACTIVE editor personas (safe fields).
   */
  async find(ctx: Context): Promise<void> {
    try {
      const personas = (await strapi
        .plugin('ai-content-orchestrator')
        .service('personas')
        .list({ activeOnly: true })) as EditorPersonaRecord[];

      ctx.body = { data: personas.map(toPublicPersona) };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },

  /**
   * GET /editor-personas/:key — public single persona by key (safe fields).
   * Returns 404 when the persona is missing or inactive.
   */
  async findByKey(ctx: Context): Promise<void> {
    try {
      const key =
        typeof ctx.params.key === 'string' ? ctx.params.key.trim() : '';

      if (!key) {
        ctx.notFound('Nie znaleziono autora.');
        return;
      }

      const persona = (await strapi
        .plugin('ai-content-orchestrator')
        .service('personas')
        .getByKey(key)) as EditorPersonaRecord | null;

      if (!persona || persona.active === false) {
        ctx.notFound('Nie znaleziono autora.');
        return;
      }

      ctx.body = { data: toPublicPersona(persona) };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },
});

export default personasPublicController;
