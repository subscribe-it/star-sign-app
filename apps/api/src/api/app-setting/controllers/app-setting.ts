import {
  getAppSettings,
  isPaidPremiumEnabled,
  premiumAccessPolicy,
} from '../../../utils/app-settings';

export default {
  async findPublic(ctx: { body?: unknown }) {
    const settings = await getAppSettings();

    ctx.body = {
      premiumMode: settings.premiumMode,
      premiumAccessPolicy: premiumAccessPolicy(settings),
      currency: settings.currency,
      monthlyPrice: settings.monthlyPrice,
      annualPrice: settings.annualPrice,
      stripeCheckoutEnabled: settings.stripeCheckoutEnabled,
      paidPremiumEnabled: isPaidPremiumEnabled(settings),
      trialDays: settings.trialDays,
      allowPromotionCodes: settings.allowPromotionCodes,
      maintenanceMode: settings.maintenanceMode,
    };

    // Diagnostyka produkcyjna bootstrapu mediów (tymczasowe, patrz seed-media).
    try {
      const diag = await strapi
        .store({ type: 'plugin', name: 'seed-media-diag', key: 'state' })
        .get();
      (ctx.body as Record<string, unknown>)['seedMediaDiag'] = diag;
    } catch {
      /* brak diag nie może psuć endpointu */
    }
  },
};
