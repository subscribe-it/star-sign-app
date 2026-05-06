const WARSAW_TIMEZONE = 'Europe/Warsaw';

const getWarsawDate = (date: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: WARSAW_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const toPublicPayload = (draw: any) => ({
  date: draw.draw_date,
  card: draw.card
    ? {
        id: draw.card.id,
        documentId: draw.card.documentId,
        name: draw.card.name,
        arcana: draw.card.arcana,
        meaning_upright: draw.card.meaning_upright,
        meaning_reversed: draw.card.meaning_reversed,
        description: draw.card.description,
        symbol: draw.card.symbol,
        slug: draw.card.slug,
        image: draw.card.image
          ? {
              id: draw.card.image.id,
              documentId: draw.card.image.documentId,
              name: draw.card.image.name,
              alternativeText: draw.card.image.alternativeText,
              caption: draw.card.image.caption,
              width: draw.card.image.width,
              height: draw.card.image.height,
              formats: draw.card.image.formats,
              url: draw.card.image.url,
            }
          : null,
      }
    : null,
  message: draw.message || undefined,
});

export default {
  async today(ctx: any) {
    const today = getWarsawDate();

    let draw = await strapi.db
      .query('api::daily-tarot-draw.daily-tarot-draw')
      .findOne({
        where: { draw_date: today },
        populate: { card: { populate: { image: true } } },
      });

    if (!draw) {
      const cards = await strapi.db
        .query('api::tarot-card.tarot-card')
        .findMany({
          where: { publishedAt: { $notNull: true } },
        });

      if (!cards.length) {
        return ctx.notFound('Brak dostępnych kart tarota.');
      }

      const randomIndex = Math.floor(Math.random() * cards.length);
      const selectedCard = cards[randomIndex];

      try {
        draw = await strapi.db
          .query('api::daily-tarot-draw.daily-tarot-draw')
          .create({
            data: {
              draw_date: today,
              card: selectedCard.id,
            },
            populate: { card: { populate: { image: true } } },
          });
      } catch (error: any) {
        // Handle race conditions when two requests try to create today's draw.
        draw = await strapi.db
          .query('api::daily-tarot-draw.daily-tarot-draw')
          .findOne({
            where: { draw_date: today },
            populate: { card: { populate: { image: true } } },
          });

        if (!draw) {
          strapi.log.error(
            'Nie udało się utworzyć ani pobrać dzisiejszej karty tarota.',
            error,
          );
          return ctx.internalServerError(
            'Nie udało się wygenerować dzisiejszej karty tarota.',
          );
        }
      }
    }

    ctx.body = toPublicPayload(draw);
  },
};
