import { factories } from '@strapi/strapi';
import {
  canReadPremiumContent,
  sanitizePremiumResponse,
} from '../../../utils/premium-content';

export default factories.createCoreController('api::article.article', () => ({
  async find(ctx) {
    const response = await super.find(ctx);
    return sanitizePremiumResponse(response, await canReadPremiumContent(ctx));
  },

  async findOne(ctx) {
    const response = await super.findOne(ctx);
    return sanitizePremiumResponse(response, await canReadPremiumContent(ctx));
  },
}));
