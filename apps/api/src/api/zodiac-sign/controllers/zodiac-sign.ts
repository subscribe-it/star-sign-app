import { factories } from '@strapi/strapi';

// Domyślnie dociągamy `image` oraz `symbol`, ale tylko gdy klient nie podał
// własnego populate (merge-friendly — nie nadpisujemy intencji klienta).
const ensureDefaultPopulate = (ctx: { query?: Record<string, unknown> }): void => {
  if (!ctx.query) {
    ctx.query = {};
  }

  if (typeof ctx.query.populate === 'undefined') {
    ctx.query.populate = ['image', 'symbol'];
  }
};

export default factories.createCoreController('api::zodiac-sign.zodiac-sign', () => ({
  async find(ctx) {
    ensureDefaultPopulate(ctx);
    return super.find(ctx);
  },

  async findOne(ctx) {
    ensureDefaultPopulate(ctx);
    return super.findOne(ctx);
  },
}));
