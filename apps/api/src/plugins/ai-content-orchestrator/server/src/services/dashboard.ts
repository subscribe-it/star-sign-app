import {
  CONTENT_PLAN_ITEM_UID,
  DEFAULT_TIMEZONE,
  PUBLICATION_TICKET_UID,
  RUN_LOG_UID,
  TOPIC_QUEUE_UID,
  USAGE_DAILY_UID,
  WORKFLOW_UID,
  WORKFLOW_STATUS,
  SOCIAL_POST_TICKET_UID,
} from '../constants';
import type {
  AutonomyMode,
  AutonomyPolicyRecord,
  RunLogRecord,
  Strapi,
  UsageDailyRecord,
} from '../types';
import { formatDateInZone, startOfDayInZoneIso } from '../utils/date-time';
import { getEntityService } from '../utils/entity-service';
import { getPluginService } from '../utils/plugin';
import { sanitizeRunRecordForAdmin } from '../utils/diagnostic-redaction';

type AutonomyPolicyCounts = {
  mediaJobsToday: number;
  llmRequestsToday: number;
  adsSpendTodayPln: number;
};

type AutonomyPolicyService = {
  getPolicy: () => Promise<AutonomyPolicyRecord>;
  getCounts: () => Promise<AutonomyPolicyCounts>;
};

// Today's spend/usage snapshot for the operator-facing "Budżet i zużycie (dziś)"
// card. Read-only and cheap: one count-bounded usage-daily query plus a reuse of
// the autonomy-policy service (single getPolicy + getCounts), no heavy scans.
type DashboardUsageSummary = {
  llm: { requests: number; tokens: number; requestsCap: number };
  media: { jobsToday: number; cap: number };
  ads: { spentPln: number; capPln: number };
};

// Tłumaczenie trybu autonomii na prosty, zrozumiały dla operatora opis.
const AUTONOMY_MODE_LABEL: Record<AutonomyMode, string> = {
  off: 'Wyłączony',
  draft_only: 'Tylko szkice',
  guarded: 'Pod nadzorem',
  full: 'Pełna autonomia',
};

type OperatorRecommendationTone = 'info' | 'warning' | 'danger' | 'success';

type OperatorRecommendation = {
  // Stabilny klucz (do React key / testów), tekst w prostej polszczyźnie.
  key: string;
  tone: OperatorRecommendationTone;
  message: string;
};

// Kompaktowy, "ludzki" obraz tego, co autopilot zrobił dzisiaj — przeznaczony
// dla NIETECHNICZNEGO właściciela (karta "Co zrobił autopilot"). Wszystkie pola
// degradują się do zer / wartości neutralnych, metoda nigdy nie rzuca wyjątkiem.
type OperatorSummary = {
  // Co powstało dziś (zliczenia run-logów typu "generate" wg statusu).
  generated: {
    total: number;
    successes: number;
    failures: number;
    running: number;
  };
  // Dzisiejszy wydatek/zużycie (reużyte z getTodayUsageSummary).
  spend: DashboardUsageSummary;
  // Co czeka w kolejce (lekka prognoza pracy autopilota).
  pipeline: {
    pendingTopics: number;
    plannedItems: number;
    scheduledPublications: number;
  };
  // Bieżący tryb działania silnika.
  autonomy: {
    mode: AutonomyMode;
    modeLabel: string;
    killSwitch: boolean;
    llmTokenConfigured: boolean;
  };
  // Krótka lista podpowiedzi "co dalej" w prostym języku.
  recommendations: OperatorRecommendation[];
};

// Token OpenRouter (silnik LLM) — sprawdzany z ENV, bez zapytań do bazy.
// Zgodne z provider-probe (AICO_OPENROUTER_TOKEN / OPENROUTER_API_KEY) oraz
// fallbackiem w orchestratorze (AICO_OPENROUTER_TOKEN).
const isOpenRouterTokenConfigured = (): boolean =>
  Boolean(
    (process.env.AICO_OPENROUTER_TOKEN ?? '').trim() ||
      (process.env.OPENROUTER_API_KEY ?? '').trim()
  );

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const dashboard = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  const getTodayUsageSummary = async (): Promise<DashboardUsageSummary> => {
    const autonomy = getPluginService<AutonomyPolicyService | undefined>(strapi, 'autonomy-policy');
    // Align with the workflow business day so LLM rows match the same `day` the
    // usage service writes (usage-daily stores the local business-day string).
    const businessDay = formatDateInZone(new Date(), DEFAULT_TIMEZONE);

    // Caps/counts come from the autonomy-policy service; degrade gracefully (zeros)
    // if it is unavailable so this read-only card never breaks the dashboard.
    const [policy, counts, usageRows] = await Promise.all([
      autonomy?.getPolicy ? autonomy.getPolicy() : Promise.resolve(null),
      autonomy?.getCounts ? autonomy.getCounts() : Promise.resolve(null),
      entityService.findMany<UsageDailyRecord>(USAGE_DAILY_UID, {
        filters: { day: businessDay },
        fields: ['request_count', 'total_tokens'],
        limit: 500,
      }),
    ]);

    // Tokens stay as the usage-daily sum (no paired cap, so a cross-workflow
    // total is fine here). Requests, however, MUST mirror the media/ads rows:
    // pair the numerator the autonomy-policy gate actually compares against the
    // cap (`counts.llmRequestsToday`) with `daily_llm_request_limit`, instead of
    // the unrelated usage-daily request_count sum.
    const llmTokens = usageRows.reduce((sum, row) => sum + toNumber(row.total_tokens), 0);

    return {
      llm: {
        requests: toNumber(counts?.llmRequestsToday),
        tokens: llmTokens,
        requestsCap: toNumber(policy?.daily_llm_request_limit),
      },
      media: {
        jobsToday: toNumber(counts?.mediaJobsToday),
        cap: toNumber(policy?.daily_media_job_limit),
      },
      ads: {
        spentPln: toNumber(counts?.adsSpendTodayPln),
        capPln: toNumber(policy?.daily_ads_budget_pln),
      },
    };
  };

  // Buduje listę podpowiedzi "co dalej" w prostym języku na podstawie zebranych
  // danych. Kolejność: najpierw blokery (czerwone), potem ostrzeżenia, na końcu
  // potwierdzenie poprawnej pracy. Czysta funkcja — łatwa do przetestowania.
  const buildOperatorRecommendations = (input: {
    generated: OperatorSummary['generated'];
    spend: DashboardUsageSummary;
    pipeline: OperatorSummary['pipeline'];
    autonomy: OperatorSummary['autonomy'];
  }): OperatorRecommendation[] => {
    const { generated, spend, pipeline, autonomy } = input;
    const recommendations: OperatorRecommendation[] = [];

    // 1) Blokery — autopilot nie może działać.
    if (autonomy.killSwitch) {
      recommendations.push({
        key: 'kill-switch-on',
        tone: 'danger',
        message: 'Wyłącznik awaryjny jest włączony — autopilot wstrzymany. Wyłącz go, aby wznowić pracę.',
      });
    }

    if (!autonomy.llmTokenConfigured) {
      recommendations.push({
        key: 'openrouter-token-missing',
        tone: 'danger',
        message: 'Token OpenRouter nie jest ustawiony — generowanie treści jest wstrzymane.',
      });
    }

    if (autonomy.mode === 'off') {
      recommendations.push({
        key: 'autonomy-off',
        tone: 'warning',
        message: 'Tryb autonomii jest wyłączony — autopilot nic nie zrobi, dopóki go nie włączysz.',
      });
    } else if (autonomy.mode === 'draft_only') {
      recommendations.push({
        key: 'autonomy-draft-only',
        tone: 'info',
        message:
          'Tryb „tylko szkice" — autopilot przygotowuje treści, ale nic nie publikuje. Przejrzyj szkice i włącz wyższy tryb, gdy nabierzesz zaufania.',
      });
    }

    // 2) Ostrzeżenia — coś wymaga uwagi.
    if (generated.failures > 0) {
      recommendations.push({
        key: 'generation-failures',
        tone: 'warning',
        message:
          generated.failures === 1
            ? '1 zadanie zakończyło się błędem — sprawdź zakładkę „Wykonania".'
            : `${generated.failures} zadań zakończyło się błędem — sprawdź zakładkę „Wykonania".`,
      });
    }

    const llmOverCap =
      spend.llm.requestsCap > 0 && spend.llm.requests >= spend.llm.requestsCap;
    const mediaOverCap = spend.media.cap > 0 && spend.media.jobsToday >= spend.media.cap;
    const adsOverCap = spend.ads.capPln > 0 && spend.ads.spentPln >= spend.ads.capPln;
    if (llmOverCap || mediaOverCap || adsOverCap) {
      recommendations.push({
        key: 'daily-cap-reached',
        tone: 'warning',
        message:
          'Osiągnięto dzienny limit zużycia — autopilot wstrzyma się do jutra. Zwiększ limity, jeśli chcesz robić więcej.',
      });
    }

    if (pipeline.pendingTopics > 0) {
      recommendations.push({
        key: 'topics-waiting',
        tone: 'info',
        message:
          pipeline.pendingTopics === 1
            ? '1 temat czeka w kolejce do opracowania.'
            : `${pipeline.pendingTopics} tematów czeka w kolejce do opracowania.`,
      });
    }

    if (generated.total === 0 && !autonomy.killSwitch && autonomy.llmTokenConfigured) {
      recommendations.push({
        key: 'no-output-today',
        tone: 'info',
        message:
          pipeline.pendingTopics === 0 && pipeline.plannedItems === 0
            ? 'Dziś nic jeszcze nie powstało, a kolejka jest pusta — dodaj tematy lub plan treści.'
            : 'Dziś nic jeszcze nie powstało — autopilot zabierze się za zaplanowaną pracę przy najbliższym uruchomieniu.',
      });
    }

    // 3) Wszystko gra — pozytywne potwierdzenie, gdy nie ma żadnych uwag.
    if (recommendations.length === 0) {
      recommendations.push({
        key: 'all-good',
        tone: 'success',
        message:
          generated.successes > 0
            ? 'Autopilot działa poprawnie — dzisiejsza praca przebiega bez problemów.'
            : 'Autopilot jest gotowy do pracy — wszystko skonfigurowane poprawnie.',
      });
    }

    return recommendations;
  };

  // Narracyjny, nietechniczny obraz dnia dla właściciela: co powstało, ile
  // kosztowało, co czeka w kolejce i co warto zrobić dalej. Wszystkie zapytania
  // są tanie (count z filtrem na dziś / limity) i degradują się do zer.
  const getOperatorSummary = async (): Promise<OperatorSummary> => {
    const now = new Date();
    const dayStart = startOfDayInZoneIso(now, DEFAULT_TIMEZONE);

    const safeCount = async (
      uid: string,
      filters: Record<string, unknown>
    ): Promise<number> => {
      try {
        return await entityService.count(uid, { filters });
      } catch (error) {
        strapi.log?.warn?.(
          `[aico] dashboard.getOperatorSummary count failed for ${uid}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`
        );
        return 0;
      }
    };

    const safeUsage = async (): Promise<DashboardUsageSummary> => {
      try {
        return await getTodayUsageSummary();
      } catch (error) {
        strapi.log?.warn?.(
          `[aico] dashboard.getOperatorSummary usage failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }`
        );
        return {
          llm: { requests: 0, tokens: 0, requestsCap: 0 },
          media: { jobsToday: 0, cap: 0 },
          ads: { spentPln: 0, capPln: 0 },
        };
      }
    };

    const safePolicy = async (): Promise<AutonomyPolicyRecord | null> => {
      try {
        const autonomy = getPluginService<{ getPolicy?: () => Promise<AutonomyPolicyRecord> } | undefined>(
          strapi,
          'autonomy-policy'
        );
        return autonomy?.getPolicy ? await autonomy.getPolicy() : null;
      } catch (error) {
        strapi.log?.warn?.(
          `[aico] dashboard.getOperatorSummary policy failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }`
        );
        return null;
      }
    };

    // Dziś = run-logi typu "generate" rozpoczęte od początku dnia biznesowego.
    const generatedFilter = { run_type: 'generate', started_at: { $gte: dayStart } };
    const [generatedTotal, generatedSuccesses, generatedFailures, generatedRunning] =
      await Promise.all([
        safeCount(RUN_LOG_UID, generatedFilter),
        safeCount(RUN_LOG_UID, { ...generatedFilter, status: 'success' }),
        safeCount(RUN_LOG_UID, { ...generatedFilter, status: 'failed' }),
        safeCount(RUN_LOG_UID, { ...generatedFilter, status: 'running' }),
      ]);

    const [spend, pendingTopics, plannedItems, scheduledPublications, policy] = await Promise.all([
      safeUsage(),
      safeCount(TOPIC_QUEUE_UID, { status: 'pending' }),
      safeCount(CONTENT_PLAN_ITEM_UID, { status: { $in: ['planned', 'approved', 'queued'] } }),
      safeCount(PUBLICATION_TICKET_UID, { status: 'scheduled' }),
      safePolicy(),
    ]);

    const mode: AutonomyMode = policy?.autonomy_mode ?? 'guarded';
    const autonomy: OperatorSummary['autonomy'] = {
      mode,
      modeLabel: AUTONOMY_MODE_LABEL[mode] ?? mode,
      killSwitch: Boolean(policy?.global_kill_switch),
      llmTokenConfigured: isOpenRouterTokenConfigured(),
    };

    const generated: OperatorSummary['generated'] = {
      total: generatedTotal,
      successes: generatedSuccesses,
      failures: generatedFailures,
      running: generatedRunning,
    };

    const pipeline: OperatorSummary['pipeline'] = {
      pendingTopics,
      plannedItems,
      scheduledPublications,
    };

    return {
      generated,
      spend,
      pipeline,
      autonomy,
      recommendations: buildOperatorRecommendations({ generated, spend, pipeline, autonomy }),
    };
  };

  return {
    getTodayUsageSummary,
    getOperatorSummary,

    async getSummary(): Promise<Record<string, unknown>> {
      const [
        workflowsTotal,
        workflowsEnabled,
        workflowsFailed,
        runsFailed,
        runsLast,
        topicsPending,
        topicsFailed,
        ticketsScheduled,
        ticketsFailed,
        socialScheduled,
        socialFailed,
        socialPublished,
        usage,
        operator,
      ] = await Promise.all([
        entityService.count(WORKFLOW_UID),
        entityService.count(WORKFLOW_UID, { filters: { enabled: true } }),
        entityService.count(WORKFLOW_UID, { filters: { status: WORKFLOW_STATUS.failed } }),
        entityService.count(RUN_LOG_UID, { filters: { status: 'failed' } }),
        entityService.findMany(RUN_LOG_UID, {
          sort: { started_at: 'desc' },
          limit: 10,
          populate: ['workflow'],
        }),
        entityService.count(TOPIC_QUEUE_UID, { filters: { status: 'pending' } }),
        entityService.count(TOPIC_QUEUE_UID, { filters: { status: 'failed' } }),
        entityService.count(PUBLICATION_TICKET_UID, { filters: { status: 'scheduled' } }),
        entityService.count(PUBLICATION_TICKET_UID, { filters: { status: 'failed' } }),
        entityService.count(SOCIAL_POST_TICKET_UID, { filters: { status: 'scheduled' } }),
        entityService.count(SOCIAL_POST_TICKET_UID, { filters: { status: 'failed' } }),
        entityService.count(SOCIAL_POST_TICKET_UID, { filters: { status: 'published' } }),
        getTodayUsageSummary(),
        getOperatorSummary(),
      ]);

      return {
        workflows: {
          total: workflowsTotal,
          enabled: workflowsEnabled,
          failed: workflowsFailed,
        },
        runs: {
          failed: runsFailed,
          latest: (runsLast as RunLogRecord[]).map((run) => sanitizeRunRecordForAdmin(run)),
        },
        topics: {
          pending: topicsPending,
          failed: topicsFailed,
        },
        publications: {
          scheduled: ticketsScheduled,
          failed: ticketsFailed,
        },
        social: {
          scheduled: socialScheduled,
          failed: socialFailed,
          published: socialPublished,
        },
        usage,
        operator,
      };
    },
  };
};

export default dashboard;
