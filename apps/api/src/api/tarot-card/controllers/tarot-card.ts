import { factories } from '@strapi/strapi';

// Domyślnie dociągamy `image`, ale tylko gdy klient nie podał własnego populate
// (merge-friendly — nie nadpisujemy intencji klienta).
const ensureDefaultPopulate = (ctx: { query?: Record<string, unknown> }): void => {
  if (!ctx.query) {
    ctx.query = {};
  }

  if (typeof ctx.query.populate === 'undefined') {
    ctx.query.populate = ['image'];
  }
};

export default factories.createCoreController('api::tarot-card.tarot-card', () => ({
  async find(ctx) {
    ensureDefaultPopulate(ctx);
    return super.find(ctx);
  },

  async findOne(ctx) {
    ensureDefaultPopulate(ctx);
    return super.findOne(ctx);
  },
}));
