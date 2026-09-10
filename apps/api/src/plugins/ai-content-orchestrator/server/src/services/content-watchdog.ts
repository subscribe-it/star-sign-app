/**
 * AICO content watchdog - realne powiadomienia o awariach pipeline'u
 * treści dla strony autonomicznej. Uruchamiany przez minutowy cron tick
 * (z wewnętrznym throttlingiem godzinowym). Wysyła strapi.log.error
 * (lopadotykane przez Sentry plugin), gdy:
 *  - workflow horoskopów dziennych jest wlaczony, ale dzisiejszy
 *    horoskop nie istnieje po godzinie publikacji (sytuacja "ciszy"),
 *  - tickety social sa w stanie failed powyzej progu.
 * Cel: wlasciciel wkleja tokeny, a kazde pozniejsze "ciche upadki"
 * (wygasy token, zmiana API, bug promptu) generuja alert w Sentry
 * zamiast aby strona cichcem pustoszala.
 */
import type { Strapi } from '../types';

const UID_HOROSCOPE = 'api::horoscope.horoscope';
const UID_SOCIAL_TICKET = 'plugin::ai-content-orchestrator.social-post-ticket';
const UID_WORKFLOW = 'plugin::ai-content-orchestrator.workflow';

/** Co ile minut watchdog realnie sprawdza stan treści. */
const WATCHDOG_INTERVAL_MINUTES = 60;

/** Po ktorej godzinie dnia brak dziennego horoskopu to awaria (godziny lokalne PL). */
const DAILY_HOROSCOPE_ALARM_HOUR = 6;

/** Ile utknionych biletow failed social uznajemy za awarie. */
const SOCIAL_FAILED_ALERT_THRESHOLD = 3;

type WatchdogFinding = {
  area: 'daily_horoscope' | 'social_failed_tickets';
  message: string;
  severity: 'critical' | 'warning';
};

const nowEuropeWarsaw = (): Date =>
  new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));

const startOfWarsawDay = (): Date => {
  const now = nowEuropeWarsaw();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const toIso = (value: Date): string => value.toISOString();

/** Zwraca findingu z checkow albo null, gdy wszystko w normie. */
const runChecks = async (strapi: Strapi): Promise<WatchdogFinding[]> => {
  const findings: WatchdogFinding[] = [];
  const warsawNow = nowEuropeWarsaw();

  const dailyWorkflows = (await strapi.db.query(UID_WORKFLOW).findMany({
    where: {
      workflow_type: 'horoscope',
      enabled: true,
      horoscope_period: 'daily',
    },
  })) as Array<{ id: number; name: string }>;

  if (dailyWorkflows.length > 0 && warsawNow.getHours() >= DAILY_HOROSCOPE_ALARM_HOUR) {
    const dayStart = startOfWarsawDay();
    const todaysHoroscopes = await strapi.db
      .query(UID_HOROSCOPE)
      .count({ where: { publishedAt: { $gte: toIso(dayStart) } } });

    if (todaysHoroscopes === 0) {
      findings.push({
        area: 'daily_horoscope',
        severity: 'critical',
        message: `[aico watchdog] BRAK dziennego horoskopu na ${warsawNow.toISOString().slice(0, 10)} mimo ${dailyWorkflows.length} wlaczonych workflow horoskopow. Najczestsze przyczyny: wygasl token LLM, blad OpenRouter, wylaczony workflow po bledzie. Sprawdz run-logi AICO i GET /social/test-connection.`,
      });
    }
  }

  const failedTickets = await strapi.db
    .query(UID_SOCIAL_TICKET)
    .count({ where: { status: 'failed' } });

  if (failedTickets >= SOCIAL_FAILED_ALERT_THRESHOLD) {
    findings.push({
      area: 'social_failed_tickets',
      severity: 'warning',
      message: `[aico watchdog] ${failedTickets} biletow social w stanie failed (prog ${SOCIAL_FAILED_ALERT_THRESHOLD}). Autopublish moze byc zablokowany przez wygasly token FB/IG/X. Sprawdz admin GET /social/tickets i POST /social/test-connection.`,
    });
  }

  return findings;
};

let lastRunAt: number | null = null;

/**
 * Wywolywany z minutowego ticku orchestratora; realnie sprawdza nie
 * czesciej niz co WATCHDOG_INTERVAL_MINUTES. Zwraca liste findigow,
 * ktore zalogowal (przydatne dla testow i telemetrii).
 */
const contentWatchdog = async (
  strapi: Strapi,
  now: () => number = Date.now,
): Promise<WatchdogFinding[]> => {
  const timestamp = now();
  if (lastRunAt !== null && timestamp - lastRunAt < WATCHDOG_INTERVAL_MINUTES * 60_000) {
    return [];
  }
  lastRunAt = timestamp;

  try {
    const findings = await runChecks(strapi);

    for (const finding of findings) {
      if (finding.severity === 'critical') {
        strapi.log.error(finding.message);
      } else {
        strapi.log.warn(finding.message);
      }
    }

    return findings;
  } catch (error) {
    strapi.log.warn(`[aico watchdog] check failed: ${String(error)}`);
    return [];
  }
};

/** Reset throttling (uzywane w testach i przez dedykowany admin trigger). */
const resetContentWatchdog = (): void => {
  lastRunAt = null;
};

export {
  contentWatchdog,
  resetContentWatchdog,
  WATCHDOG_INTERVAL_MINUTES,
  DAILY_HOROSCOPE_ALARM_HOUR,
  SOCIAL_FAILED_ALERT_THRESHOLD,
};
