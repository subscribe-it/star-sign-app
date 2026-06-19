import type { Context } from 'koa';

import type { Strapi } from '../types';

const dashboardController = ({ strapi }: { strapi: Strapi }) => ({
  // Zwraca pełne podsumowanie pulpitu. `getSummary()` zawiera teraz również pole
  // `operator` (narracyjny, nietechniczny obraz dnia: co zrobił autopilot, ile
  // wydał, co czeka w kolejce i podpowiedzi „co dalej") zasilające kartę
  // „Co zrobił autopilot". Brak osobnej trasy/kontrolera — celowo jeden zapis.
  async index(ctx: Context): Promise<void> {
    const summary = await strapi
      .plugin('ai-content-orchestrator')
      .service('dashboard')
      .getSummary();
    ctx.body = { data: summary };
  },
});

export default dashboardController;
