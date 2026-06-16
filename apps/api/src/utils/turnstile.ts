type TurnstileFailureStatus = 'missing-token' | 'invalid-token' | 'unavailable';

export type TurnstileVerificationResult =
  | { ok: true }
  | {
      ok: false;
      status: TurnstileFailureStatus;
      errorCodes?: string[];
    };

type TurnstileSiteverifyResponse = {
  success?: boolean;
  'error-codes'?: string[];
};

type TurnstileContext = {
  badRequest: (message: string) => unknown;
  status?: number;
  body?: unknown;
};

const TURNSTILE_SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const isEnabledFlag = (
  value: string | undefined,
  defaultValue: boolean,
): boolean => {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

export const isTurnstileEnabled = (): boolean =>
  isEnabledFlag(process.env.TURNSTILE_ENABLED, false);

const isFailOpenEnabled = (): boolean =>
  isEnabledFlag(process.env.TURNSTILE_FAIL_OPEN, false);

const getTimeoutMs = (): number => {
  const parsed = Number(process.env.TURNSTILE_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5_000;
};

const failOrOpen = (): TurnstileVerificationResult => {
  if (isFailOpenEnabled()) {
    strapi.log.warn(
      'Turnstile validation unavailable; allowing request because TURNSTILE_FAIL_OPEN=true.',
    );
    return { ok: true };
  }

  return { ok: false, status: 'unavailable' };
};

export const verifyTurnstileToken = async (
  token: unknown,
  remoteIp?: string,
): Promise<TurnstileVerificationResult> => {
  if (!isTurnstileEnabled()) {
    return { ok: true };
  }

  const normalizedToken = typeof token === 'string' ? token.trim() : '';
  if (!normalizedToken) {
    return { ok: false, status: 'missing-token' };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    strapi.log.error(
      'TURNSTILE_ENABLED=true but TURNSTILE_SECRET_KEY is missing.',
    );
    return failOrOpen();
  }

  const body = new URLSearchParams({
    secret,
    response: normalizedToken,
  });

  if (remoteIp) {
    body.set('remoteip', remoteIp);
  }

  try {
    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      body,
      // Abort a hung Cloudflare request so it falls through to failOrOpen()
      // instead of blocking the protected endpoint indefinitely.
      signal: AbortSignal.timeout(getTimeoutMs()),
    });

    if (!response.ok) {
      strapi.log.warn(
        `Turnstile siteverify failed with HTTP ${response.status}.`,
      );
      return failOrOpen();
    }

    const payload = (await response.json()) as TurnstileSiteverifyResponse;
    if (payload.success === true) {
      return { ok: true };
    }

    return {
      ok: false,
      status: 'invalid-token',
      errorCodes: payload['error-codes'] ?? [],
    };
  } catch (error) {
    strapi.log.warn('Turnstile siteverify request failed.');
    strapi.log.debug(error);
    return failOrOpen();
  }
};

export const rejectTurnstileFailure = (
  ctx: TurnstileContext,
  result: Exclude<TurnstileVerificationResult, { ok: true }>,
): unknown => {
  if (result.status === 'unavailable') {
    ctx.status = 503;
    ctx.body = {
      error: {
        message:
          'Weryfikacja antybot jest chwilowo niedostępna. Spróbuj ponownie za chwilę.',
      },
    };
    return ctx.body;
  }

  return ctx.badRequest('Weryfikacja antybot nie powiodła się.');
};
