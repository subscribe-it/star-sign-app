import { factories } from '@strapi/strapi';
import {
  canReadPremiumContent,
  sanitizePremiumResponse,
} from '../../../utils/premium-content';

/**
 * Public, audience-facing fields of the linked editor persona (E-E-A-T
 * authorship). We force this populate on the public article endpoints so the
 * byline + author page can render a real, named author. We deliberately select
 * ONLY safe fields here — the LLM internals (system_instruction, prompt_prefix,
 * prompt_suffix, llm_model, temperature, writing_style, ...) MUST NEVER reach
 * the public API, regardless of what the client requests via ?populate.
 */
const SAFE_PERSONA_POPULATE = {
  fields: ['key', 'byline', 'bio', 'specialization'],
  populate: {
    avatar: {
      fields: ['url', 'alternativeText'],
    },
  },
} as const;

/**
 * Forces the safe editor_persona populate onto the request, overriding any
 * client-supplied editor_persona populate so internal persona fields can't be
 * requested through the public API. Leaves existing populate (category, image,
 * ...) untouched.
 */
const withSafePersonaPopulate = (ctx: { query?: Record<string, unknown> }) => {
  const query = (ctx.query ?? {}) as Record<string, unknown>;
  const rawPopulate = query.populate;

  let populate: Record<string, unknown>;

  if (rawPopulate && typeof rawPopulate === 'object' && !Array.isArray(rawPopulate)) {
    populate = { ...(rawPopulate as Record<string, unknown>) };
  } else if (Array.isArray(rawPopulate)) {
    populate = rawPopulate.reduce<Record<string, unknown>>((acc, key) => {
      if (typeof key === 'string') {
        acc[key] = true;
      }
      return acc;
    }, {});
  } else if (typeof rawPopulate === 'string') {
    populate = { [rawPopulate]: true };
  } else {
    populate = {};
  }

  populate.editor_persona = SAFE_PERSONA_POPULATE;
  ctx.query = { ...query, populate };
};

export default factories.createCoreController('api::article.article', () => ({
  async find(ctx) {
    withSafePersonaPopulate(ctx);
    const response = await super.find(ctx);
    return sanitizePremiumResponse(response, await canReadPremiumContent(ctx));
  },

  async findOne(ctx) {
    withSafePersonaPopulate(ctx);
    const response = await super.findOne(ctx);
    return sanitizePremiumResponse(response, await canReadPremiumContent(ctx));
  },
}));
