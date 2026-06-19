import {
  CONTENT_PERFORMANCE_SNAPSHOT_UID,
  CONTENT_UIDS,
  EDITORIAL_MEMORY_UID,
  RUN_LOG_UID,
  TRAFFIC_SNAPSHOT_UID,
} from '../constants';
import type {
  ContentPerformanceSnapshotRecord,
  EditorialMemoryRecord,
  OpenRouterUsage,
  RunLogRecord,
  Strapi,
  TrafficSnapshotRecord,
} from '../types';
import { recordSystemAuditEvent } from '../utils/audit-trail';
import { EDITORIAL_CONTEXT_MAX_CHARS } from '../utils/editorial-context';
import { getEntityService } from '../utils/entity-service';
import { isRecord, toSafeErrorMessage } from '../utils/json';
import { getPluginService } from '../utils/plugin';

export const PERFORMANCE_INSIGHT_MEMORY_KEY = 'insight:performance';
export const SYSTEM_HEALTH_MEMORY_KEY = 'insight:system-health';
export const EDITORIAL_RECOMMENDATION_MEMORY_KEY = 'insight:editorial-recommendation';

export const INSIGHTS_LOOKBACK_DAYS = 30;
export const INSIGHTS_EVENT_LOOKBACK_DAYS = 14;
export const HEALTH_LOOKBACK_DAYS = 7;
export const HEALTH_FAILURE_THRESHOLD = 3;
export const INSIGHT_VALIDITY_DAYS = 7;

type AutonomyPolicyService = {
  evaluate: (input: { action: 'llm.generate' }) => Promise<{ allowed: boolean; reason: string }>;
};

type OpenRouterService = {
  requestJson: (input: {
    model: string;
    apiToken: string;
    prompt: string;
    schemaDescription: string;
    temperature?: number;
    maxCompletionTokens?: number;
  }) => Promise<{ payload: unknown; usage?: OpenRouterUsage }>;
};

type ExperimentAgentService = {
  evaluate?: (input?: { now?: Date }) => Promise<unknown>;
};

type RuntimeLocksService = {
  withLock?: <T>(
    key: string,
    input: { ttlMs?: number; metadata?: Record<string, unknown> },
    runner: () => Promise<T>
  ) => Promise<T | undefined>;
};

type UsageService = {
  registerUsage?: (workflowId: number, day: string, usage: OpenRouterUsage) => Promise<unknown>;
};

export const INSIGHTS_DAILY_LOCK_KEY = 'insights.daily';
const INSIGHTS_LOCK_TTL_MS = 10 * 60_000;
// Sztuczny identyfikator "systemowego" workflowu dla zużycia LLM bez workflowu.
const SYSTEM_USAGE_WORKFLOW_ID = 0;

type AnalyticsEventTimeRecord = {
  id: number;
  event_type: string;
  occurred_at?: string | null;
};

export type ContentInsightEntry = {
  key: string;
  title: string;
  slug: string | null;
  totalScore: number;
  totalViews: number;
  daysObserved: number;
  scorePerDay: number;
  viewsGrowth: number;
};

export type ContentInsights = {
  topContent: ContentInsightEntry[];
  bottomContent: ContentInsightEntry[];
  trendingTopics: ContentInsightEntry[];
};

export type TrafficInsights = {
  organicViews: number;
  socialEngagements: number;
  adClicks: number;
  bestWeekdays: string[];
  channelRecommendation: 'invest_organic' | 'invest_social' | 'balanced';
};

export type HealthIssue = {
  step: string;
  failures: number;
};

const WEEKDAY_NAMES_PL = [
  'niedziela',
  'poniedziałek',
  'wtorek',
  'środa',
  'czwartek',
  'piątek',
  'sobota',
] as const;

const toDayString = (now: Date): string => now.toISOString().slice(0, 10);

const addDaysIso = (now: Date, days: number): string =>
  new Date(now.getTime() + days * 86_400_000).toISOString();

const round2 = (value: number): number => Math.round(value * 100) / 100;

export const isInsightsEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => {
  const raw = env.AICO_INSIGHTS_ENABLED?.trim().toLowerCase();
  if (raw === 'true' || raw === '1') {
    return true;
  }
  if (raw === 'false' || raw === '0') {
    return false;
  }

  // Domyślnie aktywne, gdy włączone są workflowy AICO.
  return env.AICO_ENABLE_WORKFLOWS === 'true';
};

export const computeContentInsights = (
  snapshots: ContentPerformanceSnapshotRecord[],
  input: { topN?: number } = {}
): ContentInsights => {
  const topN = Math.max(1, Math.min(20, Number(input.topN ?? 5)));

  const days = Array.from(
    new Set(snapshots.map((snapshot) => String(snapshot.snapshot_day ?? '')).filter(Boolean))
  ).sort();
  const midIndex = Math.floor(days.length / 2);
  const recentDays = new Set(days.slice(midIndex));

  const grouped = new Map<
    string,
    ContentInsightEntry & { earlyViews: number; recentViews: number }
  >();

  for (const snapshot of snapshots) {
    const day = String(snapshot.snapshot_day ?? '');
    const key =
      snapshot.content_slug?.trim() ||
      `${snapshot.content_uid ?? 'content'}:${snapshot.content_entry_id ?? snapshot.id}`;
    const current = grouped.get(key) ?? {
      key,
      title: String(snapshot.content_title ?? snapshot.content_slug ?? key),
      slug: snapshot.content_slug ?? null,
      totalScore: 0,
      totalViews: 0,
      daysObserved: 0,
      scorePerDay: 0,
      viewsGrowth: 0,
      earlyViews: 0,
      recentViews: 0,
    };

    const views = Number(snapshot.views ?? 0);
    current.totalScore += Number(snapshot.score ?? 0);
    current.totalViews += views;
    current.daysObserved += 1;
    if (recentDays.has(day)) {
      current.recentViews += views;
    } else {
      current.earlyViews += views;
    }

    grouped.set(key, current);
  }

  const entries = Array.from(grouped.values()).map((entry) => ({
    key: entry.key,
    title: entry.title,
    slug: entry.slug,
    totalScore: round2(entry.totalScore),
    totalViews: entry.totalViews,
    daysObserved: entry.daysObserved,
    scorePerDay: round2(entry.totalScore / Math.max(1, entry.daysObserved)),
    viewsGrowth: entry.recentViews - entry.earlyViews,
  }));

  const byScorePerDay = [...entries].sort((a, b) => b.scorePerDay - a.scorePerDay);
  const topContent = byScorePerDay.slice(0, topN);
  const bottomContent = byScorePerDay
    .filter((entry) => entry.daysObserved >= 2 && entry.scorePerDay <= 0.5)
    .sort((a, b) => a.scorePerDay - b.scorePerDay)
    .slice(0, topN);
  const trendingTopics = entries
    .filter((entry) => entry.viewsGrowth > 0)
    .sort((a, b) => b.viewsGrowth - a.viewsGrowth)
    .slice(0, topN);

  return { topContent, bottomContent, trendingTopics };
};

// Mediana listy liczb (do wykrywania outlierów ruchu organicznego).
const median = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

// Ile razy ponad medianę dzienny wiersz uznajemy za outlier (zaśmiecony pomiar).
export const TRAFFIC_OUTLIER_MULTIPLIER = 20;

export const computeTrafficInsights = (snapshots: TrafficSnapshotRecord[]): TrafficInsights => {
  let socialEngagements = 0;
  let adClicks = 0;
  const weekdayViews = new Map<number, number>();

  // Precedencja źródła ruchu organicznego per dzień: preferuj ga4, w przeciwnym
  // razie first_party. Bez tego ten sam dzień raportowany przez oba źródła byłby
  // policzony podwójnie (zawyżając "organic" i wypaczając channelRecommendation).
  const organicPerDay = new Map<string, { views: number; source: 'ga4' | 'first_party' }>();

  for (const snapshot of snapshots) {
    const views = Number(snapshot.views ?? 0);
    socialEngagements += Number(snapshot.social_engagements ?? 0);
    adClicks += Number(snapshot.ad_clicks ?? 0);

    if (snapshot.source === 'ga4' || snapshot.source === 'first_party') {
      const day = String(snapshot.snapshot_day ?? '');
      const existing = organicPerDay.get(day);
      // ga4 ma pierwszeństwo; first_party przyjmujemy tylko gdy brak wpisu dla dnia.
      if (!existing || (existing.source !== 'ga4' && snapshot.source === 'ga4')) {
        organicPerDay.set(day, { views, source: snapshot.source });
      }
    }
  }

  // Outlier guard: ignoruj dzienny wiersz, którego views > 20x mediany okna,
  // zanim wpłynie na sumę organic i rekomendację kanału.
  const organicEntries = Array.from(organicPerDay.entries());
  const medianViews = median(organicEntries.map(([, entry]) => entry.views));
  const outlierThreshold = medianViews > 0 ? medianViews * TRAFFIC_OUTLIER_MULTIPLIER : Infinity;

  let organicViews = 0;
  for (const [day, entry] of organicEntries) {
    if (entry.views > outlierThreshold) {
      continue;
    }
    organicViews += entry.views;

    const date = new Date(`${day}T12:00:00.000Z`);
    if (Number.isFinite(date.getTime())) {
      const weekday = date.getUTCDay();
      weekdayViews.set(weekday, (weekdayViews.get(weekday) ?? 0) + entry.views);
    }
  }

  const bestWeekdays = Array.from(weekdayViews.entries())
    .filter(([, views]) => views > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([weekday]) => WEEKDAY_NAMES_PL[weekday]);

  let channelRecommendation: TrafficInsights['channelRecommendation'] = 'balanced';
  if (organicViews > socialEngagements * 3) {
    channelRecommendation = 'invest_organic';
  } else if (socialEngagements > organicViews) {
    channelRecommendation = 'invest_social';
  }

  return { organicViews, socialEngagements, adClicks, bestWeekdays, channelRecommendation };
};

export const computeBestPublishHours = (
  events: AnalyticsEventTimeRecord[],
  fallbackHours: number[] = [8]
): number[] => {
  const histogram = new Map<number, number>();

  for (const event of events) {
    if (
      event.event_type !== 'view_item' &&
      event.event_type !== 'premium_content_view' &&
      event.event_type !== 'premium_content_impression'
    ) {
      continue;
    }

    const timestamp = new Date(String(event.occurred_at ?? ''));
    if (!Number.isFinite(timestamp.getTime())) {
      continue;
    }

    const hour = timestamp.getUTCHours();
    histogram.set(hour, (histogram.get(hour) ?? 0) + 1);
  }

  const hours = Array.from(histogram.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([hour]) => hour);

  return hours.length > 0 ? hours : fallbackHours;
};

// Maksymalna długość deterministycznej rekomendacji "jak pisać". Trzymana
// znacznie poniżej EDITORIAL_CONTEXT_MAX_CHARS (1500) z editorial-context.ts,
// bo to tylko JEDEN wpis z wielu, a prompt twórczy musi zmieścić też inne reguły.
export const EDITORIAL_RECOMMENDATION_MAX_CHARS = 700;

const titlesOf = (entries: ContentInsightEntry[], limit: number): string[] =>
  entries
    .slice(0, limit)
    .map((entry) => entry.title?.trim())
    .filter((title): title is string => Boolean(title));

/**
 * Buduje DETERMINISTYCZNĄ rekomendację "JAK pisać" (styl, struktura, długość,
 * ton, czego unikać) wyłącznie z sygnałów już policzonych w payloadzie insightów
 * (top vs bottom content, trending, kanał ruchu, najlepsze godziny).
 *
 * To domyka pętlę performance->QUALITY: insighty wpływają nie tylko na TO, CO
 * pisać (tematy), ale też na TO, JAK pisać (forma, która faktycznie działa).
 *
 * Zwraca null, gdy danych jest za mało, by udzielić rzetelnej wskazówki — wtedy
 * świadomie NIE zapisujemy żadnej (mylącej) rekomendacji.
 *
 * Wynik jest po polsku i przycięty do EDITORIAL_RECOMMENDATION_MAX_CHARS, bo
 * trafia wprost do promptu generacyjnego (przez editorial-context).
 */
export const buildEditorialRecommendation = (input: {
  topContent?: ContentInsightEntry[];
  bottomContent?: ContentInsightEntry[];
  trendingTopics?: ContentInsightEntry[];
  bestPublishHours?: number[];
  traffic?: Pick<TrafficInsights, 'organicViews' | 'socialEngagements' | 'channelRecommendation'>;
}): string | null => {
  const topTitles = titlesOf(input.topContent ?? [], 3);
  const trendingTitles = titlesOf(input.trendingTopics ?? [], 3);
  const weakTitles = titlesOf(input.bottomContent ?? [], 3);
  const channel = input.traffic?.channelRecommendation;
  const organic = Number(input.traffic?.organicViews ?? 0);
  const social = Number(input.traffic?.socialEngagements ?? 0);

  // Brak jakiegokolwiek sygnału jakościowego => nic nie zapisujemy.
  const hasSignal =
    topTitles.length > 0 ||
    trendingTitles.length > 0 ||
    weakTitles.length > 0 ||
    organic > 0 ||
    social > 0;
  if (!hasSignal) {
    return null;
  }

  const parts: string[] = [];

  // 1) Wzorzec do naśladowania: forma najlepszych/rosnących treści.
  const winners = trendingTitles.length > 0 ? trendingTitles : topTitles;
  if (winners.length > 0) {
    parts.push(
      `Naśladuj formę treści, które działają (${winners.join(', ')}): ten sam konkretny, ` +
        `rzeczowy ton i klarowną strukturę.`
    );
  }

  // 2) Struktura + długość zależnie od dominującego kanału dystrybucji.
  //    Sygnał kanału pochodzi z faktycznych danych ruchu (co realnie performuje).
  if (channel === 'invest_organic' || (channel === undefined && organic > social && organic > 0)) {
    parts.push(
      'Pisz pod ruch organiczny: dłuższe, wyczerpujące teksty (ok. 1000-1400 słów), ' +
        'podziel je na śródtytuły, dodawaj konkretne przykłady i odpowiadaj wprost na pytania ' +
        'czytelnika (format pod wyszukiwarkę).'
    );
  } else if (channel === 'invest_social' || (channel === undefined && social > organic && social > 0)) {
    parts.push(
      'Pisz pod dystrybucję w social: zwięźlej (ok. 600-900 słów), mocny hook w pierwszym akapicie, ' +
        'krótkie akapity, śródtytuły i jasna puenta nadająca się do udostępnienia.'
    );
  } else {
    parts.push(
      'Utrzymuj zbalansowaną formę: ok. 800-1100 słów, śródtytuły, konkretne przykłady ' +
        'i mocny pierwszy akapit.'
    );
  }

  // 3) Czego unikać: wzorce słabych treści (deprioryteryzowane).
  if (weakTitles.length > 0) {
    parts.push(
      `Unikaj wzorca słabych treści (${weakTitles.join(', ')}): ogólników, lania wody ` +
        'i tematów bez wyraźnego haka dla czytelnika.'
    );
  }

  const text = parts.join(' ').trim();
  if (!text) {
    return null;
  }

  if (text.length <= EDITORIAL_RECOMMENDATION_MAX_CHARS) {
    return text;
  }
  return `${text.slice(0, EDITORIAL_RECOMMENDATION_MAX_CHARS - 1).trimEnd()}…`;
};

export const detectRepeatedRunFailures = (
  runLogs: RunLogRecord[],
  threshold = HEALTH_FAILURE_THRESHOLD
): HealthIssue[] => {
  const failuresPerStep = new Map<string, number>();

  for (const runLog of runLogs) {
    const details = isRecord(runLog.details) ? runLog.details : {};
    const steps = Array.isArray(details.steps) ? details.steps : [];
    let stepFailureFound = false;

    for (const step of steps) {
      if (!isRecord(step)) {
        continue;
      }
      const id = String(step.id ?? '');
      const status = String(step.status ?? '');
      if (id && status === 'failed') {
        stepFailureFound = true;
        failuresPerStep.set(id, (failuresPerStep.get(id) ?? 0) + 1);
      }
    }

    if (!stepFailureFound && runLog.status === 'failed') {
      failuresPerStep.set('run', (failuresPerStep.get('run') ?? 0) + 1);
    }
  }

  return Array.from(failuresPerStep.entries())
    .filter(([, failures]) => failures >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([step, failures]) => ({ step, failures }));
};

const insightsEngine = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  return {
    isEnabled(): boolean {
      return isInsightsEnabled();
    },

    async getThrottleState(): Promise<{ last_run_day?: string }> {
      if (typeof strapi.store !== 'function') {
        return {};
      }

      const store = strapi.store({
        type: 'plugin',
        name: 'ai-content-orchestrator',
        key: 'insights-state',
      });

      return ((await store.get()) as { last_run_day?: string } | null) ?? {};
    },

    async markRun(day: string): Promise<void> {
      if (typeof strapi.store !== 'function') {
        return;
      }

      const store = strapi.store({
        type: 'plugin',
        name: 'ai-content-orchestrator',
        key: 'insights-state',
      });
      await store.set({ value: { last_run_day: day } });
    },

    async runDailyTick(input: { now?: Date } = {}): Promise<Record<string, unknown>> {
      const now = input.now ?? new Date();

      if (!this.isEnabled()) {
        return { skipped: true, reason: 'insights_disabled' };
      }

      const today = toDayString(now);
      const state = await this.getThrottleState();
      if (state.last_run_day === today) {
        return { skipped: true, reason: 'already_ran_today', day: today };
      }

      const runner = async (): Promise<Record<string, unknown>> => {
        // Powtórna kontrola pod lockiem — inna instancja mogła już dziś odpalić run.
        const lockedState = await this.getThrottleState();
        if (lockedState.last_run_day === today) {
          return { skipped: true, reason: 'already_ran_today', day: today };
        }

        // Oznacz przed startem, by błędny run nie zapętlał ticków co minutę.
        await this.markRun(today);

        const insights = await this.runInsights({ now });

        let experiments: unknown = { skipped: true, reason: 'experiment_agent_unavailable' };
        try {
          const experimentAgent = getPluginService<Partial<ExperimentAgentService>>(
            strapi,
            'experiment-agent'
          );
          if (typeof experimentAgent?.evaluate === 'function') {
            experiments = await experimentAgent.evaluate({ now });
          }
        } catch (error) {
          strapi.log.warn(`[AICO] Experiment evaluation failed: ${toSafeErrorMessage(error)}`);
          experiments = { failed: true, error: toSafeErrorMessage(error) };
        }

        return { skipped: false, day: today, insights, experiments };
      };

      // Lock runtime zapobiega podwójnemu runowi (i podwójnym kosztom OpenRouter)
      // przy równoległych instancjach; day-stamp w store zostaje jako druga linia obrony.
      let locks: Partial<RuntimeLocksService> | undefined;
      try {
        locks = getPluginService<Partial<RuntimeLocksService> | undefined>(strapi, 'runtime-locks');
      } catch {
        locks = undefined;
      }

      if (typeof locks?.withLock === 'function') {
        const lockedResult = await locks.withLock(
          INSIGHTS_DAILY_LOCK_KEY,
          { ttlMs: INSIGHTS_LOCK_TTL_MS, metadata: { day: today } },
          runner
        );
        if (lockedResult === undefined) {
          return { skipped: true, reason: 'lock_held', day: today };
        }
        return lockedResult;
      }

      return runner();
    },

    async runInsights(input: { now?: Date } = {}): Promise<Record<string, unknown>> {
      const now = input.now ?? new Date();
      const day = toDayString(now);
      const lookbackStartDay = toDayString(
        new Date(now.getTime() - INSIGHTS_LOOKBACK_DAYS * 86_400_000)
      );
      const eventsStartIso = addDaysIso(now, -INSIGHTS_EVENT_LOOKBACK_DAYS);
      const healthStartIso = addDaysIso(now, -HEALTH_LOOKBACK_DAYS);

      const [performanceSnapshots, trafficSnapshots, analyticsEvents, runLogs] = await Promise.all([
        entityService.findMany<ContentPerformanceSnapshotRecord>(
          CONTENT_PERFORMANCE_SNAPSHOT_UID,
          {
            filters: { snapshot_day: { $gte: lookbackStartDay } },
            sort: [{ snapshot_day: 'asc' }],
            limit: 2000,
          }
        ),
        entityService.findMany<TrafficSnapshotRecord>(TRAFFIC_SNAPSHOT_UID, {
          filters: { snapshot_day: { $gte: lookbackStartDay } },
          sort: [{ snapshot_day: 'asc' }],
          limit: 500,
        }),
        entityService.findMany<AnalyticsEventTimeRecord>(CONTENT_UIDS.analyticsEvent, {
          filters: { occurred_at: { $gte: eventsStartIso } },
          fields: ['id', 'event_type', 'occurred_at'],
          limit: 5000,
        }),
        entityService.findMany<RunLogRecord>(RUN_LOG_UID, {
          filters: { started_at: { $gte: healthStartIso } },
          fields: ['id', 'status', 'details'],
          limit: 1000,
        }),
      ]);

      const contentInsights = computeContentInsights(performanceSnapshots);
      const trafficInsights = computeTrafficInsights(trafficSnapshots);
      const bestPublishHours = computeBestPublishHours(analyticsEvents);
      const healthIssues = detectRepeatedRunFailures(runLogs);

      const payload = {
        kind: 'performance_insight',
        generatedAt: now.toISOString(),
        validUntil: addDaysIso(now, INSIGHT_VALIDITY_DAYS),
        lookbackDays: INSIGHTS_LOOKBACK_DAYS,
        topContent: contentInsights.topContent,
        bottomContent: contentInsights.bottomContent,
        trendingTopics: contentInsights.trendingTopics,
        bestPublishHours,
        traffic: trafficInsights,
      };

      await this.upsertMemory({
        key: PERFORMANCE_INSIGHT_MEMORY_KEY,
        label: 'Insight: skuteczność treści (auto)',
        content: this.buildPerformanceSummary(contentInsights, trafficInsights, bestPublishHours),
        active: true,
        priority: 80,
        metadata: payload,
      });

      await this.syncHealthMemory(healthIssues, now);

      const recommendation = await this.generateLlmRecommendation(payload, now);

      await recordSystemAuditEvent(strapi, {
        action: 'insights.run',
        outcome: 'success',
        metadata: {
          day,
          performanceSnapshots: performanceSnapshots.length,
          trafficSnapshots: trafficSnapshots.length,
          analyticsEvents: analyticsEvents.length,
          runLogs: runLogs.length,
          topContent: contentInsights.topContent.length,
          trendingTopics: contentInsights.trendingTopics.length,
          healthIssues: healthIssues.length,
          llmRecommendation: recommendation.status,
        },
      });

      return {
        day,
        topContent: contentInsights.topContent.length,
        bottomContent: contentInsights.bottomContent.length,
        trendingTopics: contentInsights.trendingTopics.length,
        bestPublishHours,
        healthIssues,
        llmRecommendation: recommendation.status,
      };
    },

    buildPerformanceSummary(
      content: ContentInsights,
      traffic: TrafficInsights,
      bestPublishHours: number[]
    ): string {
      const top = content.topContent[0]?.title ?? 'brak danych';
      const trending = content.trendingTopics
        .slice(0, 3)
        .map((entry) => entry.title)
        .join(', ');
      const weak = content.bottomContent
        .slice(0, 3)
        .map((entry) => entry.title)
        .join(', ');

      return [
        `Najlepsza treść: ${top}.`,
        trending ? `Rosnące tematy: ${trending}.` : 'Brak wyraźnie rosnących tematów.',
        weak ? `Słabe treści (deprioryteryzuj): ${weak}.` : 'Brak treści do deprioryteryzacji.',
        `Najlepsze godziny publikacji (UTC): ${bestPublishHours.join(', ')}.`,
        `Kanały: organiczne ${traffic.organicViews} vs social ${traffic.socialEngagements} (rekomendacja: ${traffic.channelRecommendation}).`,
      ].join(' ');
    },

    async syncHealthMemory(issues: HealthIssue[], now: Date): Promise<void> {
      const existing = await this.findMemoryByKey(SYSTEM_HEALTH_MEMORY_KEY);

      if (issues.length === 0) {
        if (existing?.active) {
          await entityService.update(EDITORIAL_MEMORY_UID, existing.id, {
            data: { active: false },
          });
        }
        return;
      }

      const summary = issues
        .map((issue) => `krok "${issue.step}" zawiódł ${issue.failures}x w ${HEALTH_LOOKBACK_DAYS} dni`)
        .join('; ');

      await this.upsertMemory({
        key: SYSTEM_HEALTH_MEMORY_KEY,
        label: 'Insight: zdrowie systemu (auto)',
        content: `Powtarzające się błędy pipeline'u: ${summary}. Sprawdź run-logi w panelu AICO.`,
        active: true,
        priority: 90,
        metadata: {
          kind: 'system_health',
          severity: 'warning',
          generatedAt: now.toISOString(),
          validUntil: addDaysIso(now, INSIGHT_VALIDITY_DAYS),
          issues,
        },
      });

      await recordSystemAuditEvent(strapi, {
        action: 'insights.health.warning',
        outcome: 'success',
        severity: 'warn',
        metadata: {
          issues,
          lookbackDays: HEALTH_LOOKBACK_DAYS,
          threshold: HEALTH_FAILURE_THRESHOLD,
        },
      });
    },

    async generateLlmRecommendation(
      payload: Record<string, unknown>,
      now: Date
    ): Promise<{ status: 'created' | 'skipped' | 'failed'; reason?: string }> {
      // Deterministyczna baza "JAK pisać" liczona z sygnałów performance.
      // Jeśli jest null, danych jest za mało, by udzielić rzetelnej wskazówki.
      const deterministic = buildEditorialRecommendation({
        topContent: payload.topContent as ContentInsightEntry[] | undefined,
        bottomContent: payload.bottomContent as ContentInsightEntry[] | undefined,
        trendingTopics: payload.trendingTopics as ContentInsightEntry[] | undefined,
        bestPublishHours: payload.bestPublishHours as number[] | undefined,
        traffic: payload.traffic as TrafficInsights | undefined,
      });

      // Łączy prozę LLM (jeśli jest) z konkretną, deterministyczną wskazówką
      // "jak pisać", twardo przycinając do limitu wstrzykiwanego do promptu.
      const composeContent = (llmText: string): string => {
        const combined = [llmText.trim(), deterministic?.trim()]
          .filter((part): part is string => Boolean(part && part.length > 0))
          .join(' ');
        if (combined.length <= EDITORIAL_CONTEXT_MAX_CHARS) {
          return combined;
        }
        return `${combined.slice(0, EDITORIAL_CONTEXT_MAX_CHARS - 1).trimEnd()}…`;
      };

      const apiToken = process.env.AICO_OPENROUTER_TOKEN?.trim();
      if (!apiToken) {
        // Bez LLM nadal domykamy pętlę deterministyczną wskazówką (o ile są dane).
        if (!deterministic) {
          return { status: 'skipped', reason: 'insufficient_data' };
        }
        await this.upsertMemory({
          key: EDITORIAL_RECOMMENDATION_MEMORY_KEY,
          label: 'Rekomendacja redakcyjna (auto)',
          content: deterministic,
          active: true,
          priority: 70,
          // Typ wstrzykiwany przez editorial-context — DOMYKA pętlę do promptu.
          memoryType: 'brand_voice',
          metadata: {
            kind: 'editorial_recommendation',
            source: 'deterministic',
            generatedAt: now.toISOString(),
            validUntil: addDaysIso(now, INSIGHT_VALIDITY_DAYS),
          },
        });
        return { status: 'created' };
      }

      try {
        const policy = getPluginService<Partial<AutonomyPolicyService>>(strapi, 'autonomy-policy');
        if (typeof policy?.evaluate === 'function') {
          const decision = await policy.evaluate({ action: 'llm.generate' });
          if (!decision.allowed) {
            return { status: 'skipped', reason: decision.reason };
          }
        }

        const model = process.env.AICO_OPENROUTER_MODEL?.trim() || 'openai/gpt-4.1-mini';
        const schema = '{"recommendation":"string (2-4 zdania po polsku)"}';
        const prompt = [
          'Jesteś strategiem redakcji portalu astrologicznego Star Sign.',
          'Na podstawie poniższych statystyk skuteczności treści napisz krótką rekomendację redakcyjną po polsku (2-4 zdania).',
          'Skup się na tym JAK pisać, by treść performowała: rekomendowana długość artykułu,',
          'struktura (śródtytuły, przykłady), ton oraz konkretne słabe wzorce, których należy unikać —',
          'wyprowadzone z różnicy między treściami top a bottom oraz z sygnałów ruchu (kanał, godziny).',
          'Zwróć wyłącznie valid JSON zgodny ze schematem.',
          `Statystyki: ${JSON.stringify({
            topContent: payload.topContent,
            bottomContent: payload.bottomContent,
            trendingTopics: payload.trendingTopics,
            bestPublishHours: payload.bestPublishHours,
            traffic: payload.traffic,
          })}`,
        ].join('\n');

        const response = await getPluginService<OpenRouterService>(strapi, 'open-router').requestJson(
          {
            model,
            apiToken,
            prompt,
            schemaDescription: schema,
            temperature: 0.3,
            maxCompletionTokens: 350,
          }
        );

        // Best-effort: zlicz zużycie tokenów w usage-daily (workflow systemowy = 0).
        if (response.usage) {
          try {
            const usageService = getPluginService<Partial<UsageService>>(strapi, 'usage');
            if (typeof usageService?.registerUsage === 'function') {
              await usageService.registerUsage(
                SYSTEM_USAGE_WORKFLOW_ID,
                toDayString(now),
                response.usage
              );
            }
          } catch (error) {
            strapi.log.warn(
              `[AICO] Insights usage accounting failed: ${toSafeErrorMessage(error)}`
            );
          }
        }

        const recommendation = isRecord(response.payload)
          ? String(response.payload.recommendation ?? '').trim()
          : '';
        if (!recommendation) {
          return { status: 'failed', reason: 'empty_recommendation' };
        }

        await this.upsertMemory({
          key: EDITORIAL_RECOMMENDATION_MEMORY_KEY,
          label: 'Rekomendacja redakcyjna (auto, LLM)',
          // Proza LLM + konkretna deterministyczna wskazówka "jak pisać".
          content: composeContent(recommendation),
          active: true,
          priority: 70,
          // Typ wstrzykiwany przez editorial-context — DOMYKA pętlę do promptu.
          memoryType: 'brand_voice',
          metadata: {
            kind: 'editorial_recommendation',
            source: deterministic ? 'llm+deterministic' : 'llm',
            generatedAt: now.toISOString(),
            validUntil: addDaysIso(now, INSIGHT_VALIDITY_DAYS),
            model,
          },
        });

        return { status: 'created' };
      } catch (error) {
        strapi.log.warn(
          `[AICO] Insights LLM recommendation failed: ${toSafeErrorMessage(error)}`
        );
        return { status: 'failed', reason: toSafeErrorMessage(error) };
      }
    },

    async findMemoryByKey(key: string): Promise<EditorialMemoryRecord | null> {
      const rows = await entityService.findMany<EditorialMemoryRecord>(EDITORIAL_MEMORY_UID, {
        filters: { key },
        limit: 1,
      });

      return rows[0] ?? null;
    },

    async upsertMemory(input: {
      key: string;
      label: string;
      content: string;
      active: boolean;
      priority: number;
      metadata: Record<string, unknown>;
      // Domyślnie 'custom' (insighty techniczne/wewnętrzne, NIE wstrzykiwane do
      // promptu twórczego). Rekomendacja redakcyjna nadpisuje to typem, który
      // editorial-context faktycznie wstrzykuje (np. 'brand_voice') — bez tego
      // pętla performance->jakość nie jest domknięta.
      memoryType?: EditorialMemoryRecord['memory_type'];
    }): Promise<EditorialMemoryRecord> {
      const data = {
        key: input.key,
        label: input.label,
        memory_type: input.memoryType ?? 'custom',
        content: input.content,
        active: input.active,
        priority: input.priority,
        metadata: input.metadata,
      };

      const existing = await this.findMemoryByKey(input.key);
      if (existing) {
        return entityService.update<EditorialMemoryRecord>(EDITORIAL_MEMORY_UID, existing.id, {
          data,
        });
      }

      return entityService.create<EditorialMemoryRecord>(EDITORIAL_MEMORY_UID, { data });
    },
  };
};

export default insightsEngine;
