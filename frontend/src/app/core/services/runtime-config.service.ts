import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';

import { environment } from '../../../environments/environment';

export type TurnstileRuntimeConfig = {
  enabled: boolean;
  siteKey: string;
};

export type AnalyticsRuntimeConfig = {
  ga4MeasurementId: string;
  gtmContainerId: string;
};

export type SentryRuntimeConfig = {
  dsn: string;
  environment: string;
  release: string;
  tracesSampleRate: number;
};

export type AdsRuntimeConfig = {
  adsenseClientId: string;
};

export type RuntimeConfig = {
  turnstile: TurnstileRuntimeConfig;
  analytics: AnalyticsRuntimeConfig;
  sentry: SentryRuntimeConfig;
  ads: AdsRuntimeConfig;
};

const normalizeAdsenseClientId = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  const clientId = value.trim();
  return /^ca-pub-\d{10,}$/.test(clientId) ? clientId : '';
};

const placeholderPattern = /^(|replace_me.*|changeme|change_me|your_.+|G-X+)$/i;

const normalizeGa4MeasurementId = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  const measurementId = value.trim();
  if (!measurementId || placeholderPattern.test(measurementId)) {
    return '';
  }

  return /^G-[A-Z0-9]+$/i.test(measurementId) ? measurementId : '';
};

const normalizeGtmContainerId = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  const containerId = value.trim();
  if (!containerId || placeholderPattern.test(containerId)) {
    return '';
  }

  return /^GTM-[A-Z0-9]+$/i.test(containerId) ? containerId : '';
};

const normalizeString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const normalizeNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const defaultRuntimeConfig = (): RuntimeConfig => ({
  turnstile: {
    enabled: Boolean(
      environment.turnstile.enabled && environment.turnstile.siteKey,
    ),
    siteKey: environment.turnstile.siteKey,
  },
  analytics: {
    ga4MeasurementId: normalizeGa4MeasurementId(
      environment.analytics.ga4MeasurementId,
    ),
    gtmContainerId: normalizeGtmContainerId(
      environment.analytics.gtmContainerId,
    ),
  },
  sentry: {
    dsn: normalizeString(environment.sentry.dsn),
    environment:
      normalizeString(environment.sentry.environment) || 'production',
    release: normalizeString(environment.sentry.release),
    tracesSampleRate: normalizeNumber(environment.sentry.tracesSampleRate, 0),
  },
  ads: {
    adsenseClientId: normalizeAdsenseClientId(
      (environment as { ads?: { adsenseClientId?: string } }).ads
        ?.adsenseClientId,
    ),
  },
});

@Injectable({
  providedIn: 'root',
})
export class RuntimeConfigService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly configState = signal<RuntimeConfig>(defaultRuntimeConfig());
  private loadPromise?: Promise<RuntimeConfig>;

  public readonly config = this.configState.asReadonly();
  public readonly turnstile = computed(() => this.config().turnstile);
  public readonly analytics = computed(() => this.config().analytics);
  public readonly ads = computed(() => this.config().ads);
  public readonly adsenseClientId = computed(
    () => this.ads().adsenseClientId,
  );
  public readonly sentry = computed(() => this.config().sentry);
  public readonly ga4MeasurementId = computed(
    () => this.analytics().ga4MeasurementId,
  );
  public readonly gtmContainerId = computed(
    () => this.analytics().gtmContainerId,
  );
  public readonly turnstileEnabled = computed(() => {
    const turnstile = this.turnstile();
    return turnstile.enabled && turnstile.siteKey.length > 0;
  });

  public load(): Promise<RuntimeConfig> {
    if (!this.isBrowser) {
      return Promise.resolve(this.configState());
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = fetch('/runtime-config.json', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) {
          return this.configState();
        }

        const config = this.normalizeConfig((await response.json()) as unknown);
        this.configState.set(config);
        return config;
      })
      .catch(() => this.configState());

    return this.loadPromise;
  }

  private normalizeConfig(value: unknown): RuntimeConfig {
    if (!value || typeof value !== 'object') {
      return defaultRuntimeConfig();
    }

    const record = value as Record<string, unknown>;
    const rawTurnstile =
      record['turnstile'] && typeof record['turnstile'] === 'object'
        ? (record['turnstile'] as Record<string, unknown>)
        : {};
    const siteKey =
      typeof rawTurnstile['siteKey'] === 'string'
        ? rawTurnstile['siteKey'].trim()
        : '';
    const enabled = rawTurnstile['enabled'] === true && siteKey.length > 0;
    const rawAnalytics =
      record['analytics'] && typeof record['analytics'] === 'object'
        ? (record['analytics'] as Record<string, unknown>)
        : {};
    const rawSentry =
      record['sentry'] && typeof record['sentry'] === 'object'
        ? (record['sentry'] as Record<string, unknown>)
        : {};
    const rawAds =
      record['ads'] && typeof record['ads'] === 'object'
        ? (record['ads'] as Record<string, unknown>)
        : {};
    const defaults = defaultRuntimeConfig();

    return {
      turnstile: {
        enabled,
        siteKey,
      },
      analytics: {
        ga4MeasurementId: normalizeGa4MeasurementId(
          rawAnalytics['ga4MeasurementId'],
        ),
        gtmContainerId: normalizeGtmContainerId(
          rawAnalytics['gtmContainerId'],
        ),
      },
      sentry: {
        dsn: normalizeString(rawSentry['dsn']) || defaults.sentry.dsn,
        environment:
          normalizeString(rawSentry['environment']) ||
          defaults.sentry.environment,
        release:
          normalizeString(rawSentry['release']) || defaults.sentry.release,
        tracesSampleRate: normalizeNumber(
          rawSentry['tracesSampleRate'],
          defaults.sentry.tracesSampleRate,
        ),
      },
      ads: {
        adsenseClientId: normalizeAdsenseClientId(rawAds['adsenseClientId']),
      },
    };
  }
}
