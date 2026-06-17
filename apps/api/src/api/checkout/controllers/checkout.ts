import crypto from 'node:crypto';

import { isShopEnabled } from '../../../utils/features';
import { serializeCheckoutAnalyticsSummary } from '../utils/analytics-summary';

type CheckoutItemInput = {
  productDocumentId: string;
  quantity: number;
};

type CheckoutLine = {
  productId: number;
  productDocumentId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZERO_DECIMAL_CURRENCIES = new Set(['jpy', 'krw']);

const normalizeEmail = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const toMoneyNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toMinorUnits = (value: number, currency: string): number => {
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) {
    return Math.round(value);
  }
  return Math.round(value * 100);
};

// Window during which an identical cart re-submitted by the same customer reuses
// the existing open Stripe session instead of creating a duplicate order/session.
const CHECKOUT_REUSE_WINDOW_MS = 30 * 60 * 1000;

// Stable fingerprint of the checkout intent (cart contents + email + currency),
// independent of the per-request order id, so double-submits collide on it.
const computeCheckoutFingerprint = (
  items: CheckoutItemInput[],
  customerEmail: string,
  currency: string,
): string => {
  const normalizedItems = items
    .map((item) => `${item.productDocumentId}:${item.quantity}`)
    .sort()
    .join('|');
  return crypto
    .createHash('sha256')
    .update(`${normalizedItems}#${customerEmail}#${currency}`, 'utf8')
    .digest('hex');
};

const parseItems = (value: unknown): CheckoutItemInput[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const productDocumentId =
        typeof record.productDocumentId === 'string'
          ? record.productDocumentId.trim()
          : '';
      const quantity = Number(record.quantity);
      if (!productDocumentId || !Number.isInteger(quantity) || quantity <= 0)
        return null;
      return { productDocumentId, quantity };
    })
    .filter((item): item is CheckoutItemInput => item !== null);
};

async function createStripeCheckoutSession(input: {
  secretKey: string;
  currency: string;
  orderDocumentId: string;
  customerEmail?: string;
  frontendUrl: string;
  lineItems: CheckoutLine[];
}): Promise<{ id: string; url: string }> {
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set(
    'success_url',
    `${input.frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  );
  params.set('cancel_url', `${input.frontendUrl}/checkout/cancel`);
  params.set('client_reference_id', input.orderDocumentId);
  params.set('metadata[orderDocumentId]', input.orderDocumentId);

  if (input.customerEmail) {
    params.set('customer_email', input.customerEmail);
  }

  input.lineItems.forEach((line, index) => {
    params.set(`line_items[${index}][quantity]`, String(line.quantity));
    params.set(`line_items[${index}][price_data][currency]`, input.currency);
    params.set(
      `line_items[${index}][price_data][unit_amount]`,
      String(toMinorUnits(line.unitPrice, input.currency)),
    );
    params.set(
      `line_items[${index}][price_data][product_data][name]`,
      line.name,
    );
    if (line.description) {
      params.set(
        `line_items[${index}][price_data][product_data][description]`,
        line.description,
      );
    }
  });

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      // Idempotency keyed on the order: retries / double-submits for the same
      // order return the existing Stripe session instead of creating duplicates.
      'Idempotency-Key': `checkout:${input.orderDocumentId}`,
    },
    body: params.toString(),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const sessionId = typeof payload.id === 'string' ? payload.id : null;
  const sessionUrl = typeof payload.url === 'string' ? payload.url : null;

  if (!response.ok || !sessionId || !sessionUrl) {
    throw new Error(
      `Nie udało się utworzyć sesji Stripe Checkout. Kod: ${response.status}`,
    );
  }

  return {
    id: sessionId,
    url: sessionUrl,
  };
}

export default {
  async createSession(ctx: any) {
    if (!isShopEnabled()) {
      return ctx.notFound('Sklep jest tymczasowo wyłączony.');
    }

    const body = ctx.request.body || {};
    const payload =
      body.data && typeof body.data === 'object' ? body.data : body;

    const items = parseItems(payload.items);
    const customerEmail = normalizeEmail(payload.customerEmail);

    if (!items.length) {
      return ctx.badRequest('Koszyk nie może być pusty.');
    }

    if (customerEmail && !EMAIL_PATTERN.test(customerEmail)) {
      return ctx.badRequest('Nieprawidłowy adres e-mail klienta.');
    }

    const lineItems: CheckoutLine[] = [];
    let orderCurrency = '';
    let orderTotal = 0;

    for (const item of items) {
      const product = await strapi.db.query('api::product.product').findOne({
        where: { documentId: item.productDocumentId },
      });

      if (!product) {
        return ctx.badRequest(
          `Nie znaleziono produktu ${item.productDocumentId}.`,
        );
      }

      if (product.stock_status === 'out_of_stock') {
        return ctx.badRequest(`Produkt ${product.name} jest niedostępny.`);
      }

      const unitPrice = toMoneyNumber(product.price);
      if (unitPrice <= 0) {
        return ctx.badRequest(`Produkt ${product.name} ma nieprawidłową cenę.`);
      }

      const currency = String(product.currency || 'PLN').toLowerCase();
      if (!orderCurrency) {
        orderCurrency = currency;
      } else if (orderCurrency !== currency) {
        return ctx.badRequest(
          'Wszystkie produkty w koszyku muszą mieć tę samą walutę.',
        );
      }

      const lineTotal = unitPrice * item.quantity;
      orderTotal += lineTotal;

      lineItems.push({
        productId: product.id,
        productDocumentId: product.documentId,
        name: product.name,
        description: product.description || '',
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      });
    }

    // Double-submit / idempotency guard: if the same cart was just checked out and
    // an open Stripe session already exists, reuse it instead of creating a
    // duplicate order + session (the per-order Idempotency-Key alone cannot dedupe
    // because each request would otherwise mint a fresh order id).
    const checkoutFingerprint = computeCheckoutFingerprint(
      items,
      customerEmail,
      orderCurrency || 'pln',
    );
    const reuseSince = new Date(Date.now() - CHECKOUT_REUSE_WINDOW_MS).toISOString();
    const existingOrder = await strapi.db.query('api::order.order').findOne({
      where: {
        checkout_fingerprint: checkoutFingerprint,
        status: 'pending',
        stripe_session_url: { $notNull: true },
        createdAt: { $gte: reuseSince },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingOrder?.stripe_session_url && existingOrder?.stripe_session_id) {
      ctx.body = {
        checkoutUrl: existingOrder.stripe_session_url,
        sessionId: existingOrder.stripe_session_id,
      };
      return;
    }

    const order = await strapi.db.query('api::order.order').create({
      data: {
        customer_email: customerEmail || null,
        status: 'pending',
        payment_provider: 'stripe',
        currency: orderCurrency || 'pln',
        total_amount: orderTotal.toFixed(2),
        checkout_fingerprint: checkoutFingerprint,
      },
    });

    await Promise.all(
      lineItems.map((line) =>
        strapi.db.query('api::order-item.order-item').create({
          data: {
            order: order.id,
            product: line.productId,
            product_document_id: line.productDocumentId,
            product_name: line.name,
            quantity: line.quantity,
            unit_price: line.unitPrice.toFixed(2),
            line_total: line.lineTotal.toFixed(2),
          },
        }),
      ),
    );

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      await strapi.db.query('api::order.order').update({
        where: { id: order.id },
        data: { status: 'failed' },
      });
      ctx.status = 503;
      ctx.body = { error: 'Płatności nie są jeszcze skonfigurowane.' };
      return;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

    try {
      const session = await createStripeCheckoutSession({
        secretKey: stripeSecretKey,
        currency: orderCurrency || 'pln',
        customerEmail: customerEmail || undefined,
        orderDocumentId: order.documentId || String(order.id),
        frontendUrl,
        lineItems,
      });

      await strapi.db.query('api::order.order').update({
        where: { id: order.id },
        data: {
          stripe_session_id: session.id,
          stripe_session_url: session.url,
        },
      });

      ctx.body = {
        checkoutUrl: session.url,
        sessionId: session.id,
      };
    } catch (error) {
      strapi.log.error('Nie udało się utworzyć sesji Stripe Checkout.', error);
      await strapi.db.query('api::order.order').update({
        where: { id: order.id },
        data: { status: 'failed' },
      });
      ctx.status = 502;
      ctx.body = { error: 'Nie udało się utworzyć sesji płatności.' };
      return;
    }
  },

  async analyticsSummary(ctx: any) {
    if (!isShopEnabled()) {
      return ctx.notFound('Sklep jest tymczasowo wyłączony.');
    }

    const sessionId =
      typeof ctx.params?.sessionId === 'string'
        ? ctx.params.sessionId.trim()
        : '';
    if (!sessionId) {
      return ctx.badRequest('Brak identyfikatora sesji płatności.');
    }

    const order = await strapi.db.query('api::order.order').findOne({
      where: { stripe_session_id: sessionId },
    });

    if (!order) {
      return ctx.notFound('Nie znaleziono sesji płatności.');
    }

    const items = await strapi.db.query('api::order-item.order-item').findMany({
      where: { order: order.id },
      orderBy: { id: 'asc' },
    });

    ctx.set('Cache-Control', 'no-store');
    ctx.body = serializeCheckoutAnalyticsSummary(order, items);
  },
};
