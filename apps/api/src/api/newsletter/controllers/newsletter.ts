import crypto from 'node:crypto';

import {
  rejectTurnstileFailure,
  verifyTurnstileToken,
} from '../../../utils/turnstile';

type NewsletterPayload = Record<string, unknown>;
type NewsletterSubscription = NewsletterPayload & { id: number; email: string };
type NewsletterContext = {
  request: {
    body?: unknown;
    ip?: string;
  };
  ip?: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  get?: (header: string) => string;
  badRequest: (message: string) => unknown;
  forbidden: (message: string) => unknown;
  notFound: (message: string) => unknown;
  status?: number;
  body?: unknown;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NEWSLETTER_UID = 'api::newsletter-subscription.newsletter-subscription';
const BREVO_CONTACTS_URL = 'https://api.brevo.com/v3/contacts';

const normalizeEmail = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const normalizeToken = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const normalizeSource = (value: unknown): string =>
  typeof value === 'string' && value.trim().length > 0
    ? value.trim().slice(0, 80)
    : 'website';

const token = (): string => crypto.randomBytes(32).toString('hex');

const isDoubleOptInEnabled = (): boolean =>
  process.env.NEWSLETTER_DOUBLE_OPT_IN !== 'false';

const getFrontendUrl = (): string =>
  (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/$/, '');

const buildConfirmUrl = (confirmationToken: string): string => {
  const base =
    process.env.NEWSLETTER_CONFIRM_URL ||
    `${getFrontendUrl()}/newsletter/potwierdz`;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}token=${encodeURIComponent(confirmationToken)}`;
};

const buildUnsubscribeUrl = (unsubscribeToken: string): string => {
  const base =
    process.env.NEWSLETTER_UNSUBSCRIBE_URL ||
    `${getFrontendUrl()}/newsletter/wypisz`;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}token=${encodeURIComponent(unsubscribeToken)}`;
};

const getPayload = (ctx: NewsletterContext): NewsletterPayload => {
  const body = ctx.request.body;
  if (!body || typeof body !== 'object') {
    return {};
  }

  const record = body as Record<string, unknown>;
  if (record['data'] && typeof record['data'] === 'object') {
    return record['data'] as NewsletterPayload;
  }

  return record;
};

const findByEmail = (email: string): Promise<NewsletterSubscription | null> =>
  strapi.db.query(NEWSLETTER_UID).findOne({ where: { email } });

const findByToken = (
  field: 'confirmation_token' | 'unsubscribe_token',
  value: string,
): Promise<NewsletterSubscription | null> =>
  strapi.db.query(NEWSLETTER_UID).findOne({ where: { [field]: value } });

const updateSubscription = (
  id: number,
  data: NewsletterPayload,
): Promise<NewsletterSubscription> =>
  strapi.db.query(NEWSLETTER_UID).update({ where: { id }, data });

const createSubscription = (
  data: NewsletterPayload,
): Promise<NewsletterSubscription> =>
  strapi.db.query(NEWSLETTER_UID).create({ data });

const syncBrevoActiveContact = async (
  email: string,
  source: string,
): Promise<string | null> => {
  const apiKey = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_LIST_ID);

  if (!apiKey || !Number.isInteger(listId) || listId <= 0) {
    return null;
  }

  const response = await fetch(BREVO_CONTACTS_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      email,
      listIds: [listId],
      updateEnabled: true,
      attributes: {
        SOURCE: source,
        STATUS: 'active',
      },
    }),
  });

  if (!response.ok) {
    strapi.log.warn(
      `Synchronizacja aktywnego kontaktu Brevo nie powiodła się. Kod: ${response.status}`,
    );
    return null;
  }

  const payload = (await response
    .json()
    .catch(() => null)) as NewsletterPayload | null;
  return payload && typeof payload.id !== 'undefined'
    ? String(payload.id)
    : null;
};

const syncBrevoUnsubscribe = async (email: string): Promise<void> => {
  const apiKey = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_LIST_ID);

  if (!apiKey || !Number.isInteger(listId) || listId <= 0) {
    return;
  }

  const response = await fetch(
    `${BREVO_CONTACTS_URL}/${encodeURIComponent(email)}`,
    {
      method: 'PUT',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        unlinkListIds: [listId],
        attributes: {
          STATUS: 'unsubscribed',
        },
      }),
    },
  );

  if (!response.ok && response.status !== 404) {
    strapi.log.warn(
      `Wypisanie kontaktu Brevo nie powiodło się. Kod: ${response.status}`,
    );
  }
};

const sendConfirmationEmail = async (
  email: string,
  confirmationToken: string,
  unsubscribeToken: string,
): Promise<void> => {
  const emailService = strapi.plugin('email')?.service('email');
  if (!emailService?.send) {
    strapi.log.warn(
      'Plugin email nie jest dostępny; pomijam mail double opt-in.',
    );
    return;
  }

  const confirmUrl = buildConfirmUrl(confirmationToken);
  const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken);

  await emailService.send({
    to: email,
    subject: 'Potwierdź zapis do newslettera Star Sign',
    text: `Potwierdź zapis do newslettera Star Sign: ${confirmUrl}\n\nWypisanie: ${unsubscribeUrl}`,
    html: `
      <p>Dziękujemy za zapis do newslettera Star Sign.</p>
      <p><a href="${confirmUrl}">Potwierdź zapis</a></p>
      <p style="font-size:12px;color:#666">Jeśli to nie Ty, zignoruj tę wiadomość albo kliknij <a href="${unsubscribeUrl}">wypisz</a>.</p>
    `,
  });
};

const markActive = async (
  subscription: NewsletterSubscription,
  source: string,
): Promise<NewsletterSubscription> => {
  const now = new Date().toISOString();
  const brevoContactId = await syncBrevoActiveContact(
    subscription.email,
    source,
  ).catch((error: unknown) => {
    strapi.log.warn(
      'Synchronizacja z Brevo po potwierdzeniu nie powiodła się.',
    );
    strapi.log.debug(error);
    return null;
  });

  return updateSubscription(subscription.id, {
    marketing_consent: true,
    source,
    status: 'active',
    confirmation_token: null,
    confirmed_at: now,
    subscribed_at: subscription.subscribed_at || now,
    unsubscribed_at: null,
    ...(brevoContactId ? { brevo_contact_id: brevoContactId } : {}),
  });
};

// Constant-time string comparison (compares fixed-length SHA-256 digests so it
// neither short-circuits nor leaks length) to avoid timing attacks on the secret.
const timingSafeEqualStrings = (a: string, b: string): boolean => {
  const digestA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(digestA, digestB);
};

const verifyWebhookSecret = (ctx: NewsletterContext): boolean => {
  const expected =
    process.env.BREVO_WEBHOOK_SECRET || process.env.NEWSLETTER_WEBHOOK_SECRET;
  if (!expected) {
    // Outside production a missing secret is allowed for local webhook testing;
    // in production an unset secret must fail closed.
    return process.env.NODE_ENV !== 'production';
  }

  const authorization =
    typeof ctx.get === 'function' ? ctx.get('authorization') : '';
  const headerSecret =
    typeof ctx.get === 'function' ? ctx.get('x-newsletter-webhook-secret') : '';
  return (
    timingSafeEqualStrings(headerSecret, expected) ||
    timingSafeEqualStrings(authorization, `Bearer ${expected}`)
  );
};

const normalizeBrevoEvents = (payload: unknown): NewsletterPayload[] => {
  if (Array.isArray(payload)) {
    return payload.filter(
      (item): item is NewsletterPayload => item && typeof item === 'object',
    );
  }

  if (payload && typeof payload === 'object') {
    return [payload as NewsletterPayload];
  }

  return [];
};

export default {
  async subscribe(ctx: NewsletterContext) {
    const payload = getPayload(ctx);
    const email = normalizeEmail(payload.email);
    const marketingConsent = payload.marketingConsent === true;
    const source = normalizeSource(payload.source);

    if (!EMAIL_PATTERN.test(email)) {
      return ctx.badRequest('Wymagany jest poprawny adres e-mail.');
    }

    if (!marketingConsent) {
      return ctx.badRequest('Wymagana jest zgoda marketingowa.');
    }

    const turnstileResult = await verifyTurnstileToken(
      payload.turnstileToken,
      ctx.ip || ctx.request.ip,
    );
    if (turnstileResult.ok === false) {
      return rejectTurnstileFailure(ctx, turnstileResult);
    }

    const now = new Date().toISOString();
    const existing = await findByEmail(email);
    const confirmationToken = token();
    const unsubscribeToken =
      normalizeToken(existing?.unsubscribe_token) || token();
    const doubleOptIn = isDoubleOptInEnabled();

    const subscription = existing
      ? await updateSubscription(existing.id, {
          marketing_consent: true,
          source,
          status: doubleOptIn ? 'pending' : 'active',
          confirmation_token: doubleOptIn ? confirmationToken : null,
          unsubscribe_token: unsubscribeToken,
          subscribed_at: doubleOptIn ? existing.subscribed_at || null : now,
          confirmed_at: doubleOptIn ? null : now,
          unsubscribed_at: null,
        })
      : await createSubscription({
          email,
          marketing_consent: true,
          source,
          status: doubleOptIn ? 'pending' : 'active',
          confirmation_token: doubleOptIn ? confirmationToken : null,
          unsubscribe_token: unsubscribeToken,
          subscribed_at: doubleOptIn ? null : now,
          confirmed_at: doubleOptIn ? null : now,
        });

    if (doubleOptIn) {
      await sendConfirmationEmail(
        email,
        confirmationToken,
        unsubscribeToken,
      ).catch((error: unknown) => {
        strapi.log.warn(
          'Nie udało się wysłać maila potwierdzającego newsletter.',
        );
        strapi.log.debug(error);
      });
    } else {
      await markActive(subscription, source);
    }

    ctx.status = 202;
    ctx.body = {
      accepted: true,
      confirmationRequired: doubleOptIn,
    };
  },

  async confirm(ctx: NewsletterContext) {
    const confirmationToken = normalizeToken(
      ctx.params?.token || ctx.query?.token,
    );

    if (!confirmationToken) {
      return ctx.badRequest('Brakuje tokena potwierdzenia.');
    }

    const subscription = await findByToken(
      'confirmation_token',
      confirmationToken,
    );
    if (!subscription) {
      return ctx.notFound(
        'Token potwierdzenia jest nieprawidłowy albo został już użyty.',
      );
    }

    await markActive(subscription, normalizeSource(subscription.source));

    ctx.body = { confirmed: true };
  },

  async unsubscribe(ctx: NewsletterContext) {
    const payload = getPayload(ctx);
    const unsubscribeToken = normalizeToken(
      ctx.params?.token || ctx.query?.token || payload.token,
    );
    const email = normalizeEmail(payload.email);

    const subscription = unsubscribeToken
      ? await findByToken('unsubscribe_token', unsubscribeToken)
      : email
        ? await findByEmail(email)
        : null;

    if (!subscription) {
      return ctx.notFound('Nie znaleziono aktywnej subskrypcji newslettera.');
    }

    const now = new Date().toISOString();
    await updateSubscription(subscription.id, {
      status: 'unsubscribed',
      confirmation_token: null,
      unsubscribed_at: now,
      last_event_at: now,
      last_event_type: 'manual_unsubscribe',
    });
    await syncBrevoUnsubscribe(subscription.email);

    ctx.body = { unsubscribed: true };
  },

  async brevoWebhook(ctx: NewsletterContext) {
    if (!verifyWebhookSecret(ctx)) {
      return ctx.forbidden('Webhook secret jest nieprawidłowy.');
    }

    const events = normalizeBrevoEvents(ctx.request.body);
    const now = new Date().toISOString();

    for (const event of events) {
      const email = normalizeEmail(event.email || event.recipient);
      if (!email) {
        continue;
      }

      const eventType =
        typeof event.event === 'string'
          ? event.event
          : typeof event.type === 'string'
            ? event.type
            : 'unknown';
      const subscription = await findByEmail(email);
      if (!subscription) {
        continue;
      }

      const lower = eventType.toLowerCase();
      const status =
        lower.includes('spam') || lower.includes('complaint')
          ? 'complained'
          : lower.includes('bounce') || lower.includes('blocked')
            ? 'bounced'
            : lower.includes('unsubscribe')
              ? 'unsubscribed'
              : null;

      if (!status) {
        await updateSubscription(subscription.id, {
          last_event_at: now,
          last_event_type: eventType,
        });
        continue;
      }

      await updateSubscription(subscription.id, {
        status,
        confirmation_token: null,
        unsubscribed_at:
          status === 'unsubscribed'
            ? now
            : subscription.unsubscribed_at || null,
        last_event_at: now,
        last_event_type: eventType,
        bounce_reason: typeof event.reason === 'string' ? event.reason : null,
      });
    }

    ctx.status = 202;
    ctx.body = { accepted: true, events: events.length };
  },
};
