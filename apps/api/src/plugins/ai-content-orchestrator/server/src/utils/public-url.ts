const FALLBACK_PUBLIC_FRONTEND_URL = 'https://star-sign.pl';

const firstNonEmpty = (values: Array<string | undefined>): string | null => {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
};

const normalizeHttpUrl = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
};

// Guards against SSRF: only allow http(s) URLs pointing at public hosts
// (rejects localhost, link-local, and RFC-1918 private ranges). Used before
// server-side fetches of URLs that originate from external providers.
export const isPublicHttpUrl = (value: string | null | undefined): boolean => {
  if (!value) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host)) {
    return false;
  }
  if (host.endsWith('.local')) {
    return false;
  }
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) {
    return false;
  }
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    return false;
  }

  return true;
};

export const getPublicFrontendUrl = (): string =>
  normalizeHttpUrl(
    firstNonEmpty([
      process.env.AICO_PUBLIC_FRONTEND_URL,
      process.env.FRONTEND_URL,
      process.env.PUBLIC_FRONTEND_URL,
    ])
  ) ?? FALLBACK_PUBLIC_FRONTEND_URL;

export const buildPublicFrontendUrl = (path = '/'): string => {
  const base = getPublicFrontendUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${base}${normalizedPath}`;
};

export const getSocialDefaultImageUrl = (): string => {
  const configured = normalizeHttpUrl(
    firstNonEmpty([process.env.AICO_SOCIAL_DEFAULT_IMAGE_URL])
  );

  if (configured) {
    return configured;
  }

  return buildPublicFrontendUrl('/assets/og-default.png');
};
