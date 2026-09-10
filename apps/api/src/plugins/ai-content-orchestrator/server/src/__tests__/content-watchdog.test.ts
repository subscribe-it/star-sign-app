import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  contentWatchdog,
  DAILY_HOROSCOPE_ALARM_HOUR,
  resetContentWatchdog,
  SOCIAL_FAILED_ALERT_THRESHOLD,
  WATCHDOG_INTERVAL_MINUTES,
} from '../services/content-watchdog';

type CountFn = (args: unknown) => Promise<number>;
type FindManyFn = (args: unknown) => Promise<unknown[]>;

const createStrapiMock = (options: {
  warsawHour: number;
  dailyEnabledWorkflows: number;
  todaysHoroscopeCount: number;
  failedSocialTickets: number;
}) => {
  const logs: Array<{ level: string; message: string }> = [];
  const countImpl: Record<string, CountFn> = {
    'api::horoscope.horoscope': vi.fn(async () => options.todaysHoroscopeCount),
    'plugin::ai-content-orchestrator.social-post-ticket': vi.fn(
      async () => options.failedSocialTickets,
    ),
  };
  const findManyImpl: Record<string, FindManyFn> = {
    'plugin::ai-content-orchestrator.workflow': vi.fn(async () =>
      Array.from({ length: options.dailyEnabledWorkflows }, (_, index) => ({
        id: index + 1,
        name: `Horoskop #${index + 1}`,
      })),
    ),
  };

  const strapi = {
    log: {
      error: (message: string) => logs.push({ level: 'error', message }),
      warn: (message: string) => logs.push({ level: 'warn', message }),
    },
    db: {
      query: (uid: string) => ({
        count: countImpl[uid] ?? vi.fn(async () => 0),
        findMany: findManyImpl[uid] ?? vi.fn(async () => []),
      }),
    },
  };

  return { strapi, logs };
};

/**
 * Mock godziny warszawskiej: do podanego timestampu UTC dobieramy taki
 * offset, by toLocaleString('Europe/Warsaw') zwrocilo zadana godzine.
 * Prosciej: generujemy realny UTC dla zadanego czasu warszawskiego
 * (CEST = UTC+2 dla wrzesnia).
 */
const warsawUtcTimestamp = (hour: number): number =>
  Date.UTC(2026, 8, 10, hour - 2, 0, 0);

const stubWarsawHour = (hour: number) => {
  const timestamp = warsawUtcTimestamp(hour);
  const real = Date;
  vi.stubGlobal(
    'Date',
    class extends real {
      constructor(...args: ConstructorParameters<typeof real>) {
        if (args.length > 0) {
          super(...(args as never[]));
          return;
        }
        super(timestamp);
      }
      static now() {
        return timestamp;
      }
    } as unknown as DateConstructor,
  );
};

describe('contentWatchdog', () => {
  beforeEach(() => {
    resetContentWatchdog();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('alarmuje critical gdy brak dziennego horoskopu po godzinie alarmu', async () => {
    stubWarsawHour(DAILY_HOROSCOPE_ALARM_HOUR + 2);
    const { strapi, logs } = createStrapiMock({
      warsawHour: DAILY_HOROSCOPE_ALARM_HOUR + 2,
      dailyEnabledWorkflows: 4,
      todaysHoroscopeCount: 0,
      failedSocialTickets: 0,
    });

    const findings = await contentWatchdog(strapi as never, () => 1_000);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ area: 'daily_horoscope', severity: 'critical' });
    expect(logs.some((log) => log.level === 'error' && /BRAK dziennego horoskopu/.test(log.message))).toBe(true);
  });

  it('nie alarmuje gdy horoskop dnia istnieje', async () => {
    stubWarsawHour(DAILY_HOROSCOPE_ALARM_HOUR + 2);
    const { strapi, logs } = createStrapiMock({
      warsawHour: DAILY_HOROSCOPE_ALARM_HOUR + 2,
      dailyEnabledWorkflows: 4,
      todaysHoroscopeCount: 12,
      failedSocialTickets: 0,
    });

    const findings = await contentWatchdog(strapi as never, () => 1_000);

    expect(findings).toHaveLength(0);
    expect(logs).toHaveLength(0);
  });

  it('nie alarmuje przed godzina alarmu mimo braku horoskopu', async () => {
    stubWarsawHour(DAILY_HOROSCOPE_ALARM_HOUR - 2);
    const { strapi } = createStrapiMock({
      warsawHour: DAILY_HOROSCOPE_ALARM_HOUR - 2,
      dailyEnabledWorkflows: 4,
      todaysHoroscopeCount: 0,
      failedSocialTickets: 0,
    });

    const findings = await contentWatchdog(strapi as never, () => 1_000);
    expect(findings).toHaveLength(0);
  });

  it('nie sprawdza horoskopow gdy workflowy wylaczone (brak tokenow LLM)', async () => {
    stubWarsawHour(DAILY_HOROSCOPE_ALARM_HOUR + 2);
    const { strapi } = createStrapiMock({
      warsawHour: DAILY_HOROSCOPE_ALARM_HOUR + 2,
      dailyEnabledWorkflows: 0,
      todaysHoroscopeCount: 0,
      failedSocialTickets: 0,
    });

    const findings = await contentWatchdog(strapi as never, () => 1_000);
    expect(findings).toHaveLength(0);
  });

  it('alarmuje warning przy prog liczby failed social tickets', async () => {
    stubWarsawHour(DAILY_HOROSCOPE_ALARM_HOUR + 2);
    const { strapi, logs } = createStrapiMock({
      warsawHour: DAILY_HOROSCOPE_ALARM_HOUR + 2,
      dailyEnabledWorkflows: 4,
      todaysHoroscopeCount: 12,
      failedSocialTickets: SOCIAL_FAILED_ALERT_THRESHOLD,
    });

    const findings = await contentWatchdog(strapi as never, () => 1_000);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ area: 'social_failed_tickets', severity: 'warning' });
    expect(logs.some((log) => log.level === 'warn' && /social w stanie failed/.test(log.message))).toBe(true);
  });

  it('throttling: drugi tick w oknie godzinnym nie powtarza checkow', async () => {
    stubWarsawHour(DAILY_HOROSCOPE_ALARM_HOUR + 2);
    const { strapi } = createStrapiMock({
      warsawHour: DAILY_HOROSCOPE_ALARM_HOUR + 2,
      dailyEnabledWorkflows: 4,
      todaysHoroscopeCount: 0,
      failedSocialTickets: 0,
    });

    let clock = 1_000;
    const first = await contentWatchdog(strapi as never, () => clock);
    clock += (WATCHDOG_INTERVAL_MINUTES - 1) * 60_000;
    const second = await contentWatchdog(strapi as never, () => clock);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });

  it('throttling znika po pelnym oknie', async () => {
    stubWarsawHour(DAILY_HOROSCOPE_ALARM_HOUR + 2);
    const { strapi } = createStrapiMock({
      warsawHour: DAILY_HOROSCOPE_ALARM_HOUR + 2,
      dailyEnabledWorkflows: 4,
      todaysHoroscopeCount: 0,
      failedSocialTickets: 0,
    });

    let clock = 1_000;
    const first = await contentWatchdog(strapi as never, () => clock);
    clock += WATCHDOG_INTERVAL_MINUTES * 60_000 + 1_000;
    const second = await contentWatchdog(strapi as never, () => clock);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });
});
