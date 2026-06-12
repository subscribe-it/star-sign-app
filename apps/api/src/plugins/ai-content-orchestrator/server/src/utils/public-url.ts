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
