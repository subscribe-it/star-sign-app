import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { RuntimeConfigService } from './runtime-config.service';

describe('RuntimeConfigService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should load Turnstile config from runtime endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            turnstile: {
              enabled: true,
              siteKey: 'site-key',
            },
            analytics: {
              ga4MeasurementId: 'G-TEST123',
              gtmContainerId: 'GTM-ABC123',
            },
            sentry: {
              dsn: 'https://public@example.com/1',
              environment: 'production',
              release: 'star-sign@abc123',
              tracesSampleRate: 0.1,
            },
          }),
      }),
    );

    const service = TestBed.inject(RuntimeConfigService);
    const config = await service.load();

    expect(config.turnstile).toEqual({ enabled: true, siteKey: 'site-key' });
    expect(service.turnstileEnabled()).toBe(true);
    expect(config.analytics).toEqual({
      ga4MeasurementId: 'G-TEST123',
      gtmContainerId: 'GTM-ABC123',
    });
    expect(service.ga4MeasurementId()).toBe('G-TEST123');
    expect(service.gtmContainerId()).toBe('GTM-ABC123');
    expect(config.sentry).toEqual({
      dsn: 'https://public@example.com/1',
      environment: 'production',
      release: 'star-sign@abc123',
      tracesSampleRate: 0.1,
    });
  });

  it('should disable Turnstile when runtime payload has no site key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            turnstile: {
              enabled: true,
              siteKey: '   ',
            },
          }),
      }),
    );

    const service = TestBed.inject(RuntimeConfigService);
    const config = await service.load();

    expect(config.turnstile).toEqual({ enabled: false, siteKey: '' });
    expect(service.turnstileEnabled()).toBe(false);
  });

  it('should accept a valid AdSense client id from runtime payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ads: { adsenseClientId: 'ca-pub-1234567890123456' },
          }),
      }),
    );

    const service = TestBed.inject(RuntimeConfigService);
    const config = await service.load();

    expect(config.ads).toEqual({ adsenseClientId: 'ca-pub-1234567890123456' });
    expect(service.adsenseClientId()).toBe('ca-pub-1234567890123456');
  });

  it('should reject an invalid AdSense client id from runtime payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ ads: { adsenseClientId: 'not-a-client-id' } }),
      }),
    );

    const service = TestBed.inject(RuntimeConfigService);
    const config = await service.load();

    expect(config.ads).toEqual({ adsenseClientId: '' });
  });

  it('should keep default config when runtime endpoint fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    const service = TestBed.inject(RuntimeConfigService);
    const config = await service.load();

    expect(config.turnstile.enabled).toBe(false);
    expect(config.turnstile.siteKey).toBe('');
  });

  it('should keep default config when runtime request rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const service = TestBed.inject(RuntimeConfigService);
    const config = await service.load();

    expect(config.turnstile.enabled).toBe(false);
  });

  it('should ignore placeholder analytics IDs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            analytics: {
              ga4MeasurementId: 'G-XXXXXXXXXX',
              gtmContainerId: 'replace_me',
            },
          }),
      }),
    );

    const service = TestBed.inject(RuntimeConfigService);
    const config = await service.load();

    expect(config.analytics.ga4MeasurementId).toBe('');
    expect(config.analytics.gtmContainerId).toBe('');
    expect(service.ga4MeasurementId()).toBe('');
    expect(service.gtmContainerId()).toBe('');
  });
});
