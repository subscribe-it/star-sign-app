import parser from 'cron-parser';

import {
  CONTENT_UIDS,
  DEFAULT_RETRY_BACKOFF_SECONDS,
  DEFAULT_RETRY_MAX,
  MAX_BACKFILL_DAYS,
  PUBLICATION_TICKET_UID,
  RUN_STATUS,
  TICKET_STATUS,
  WORKFLOW_STATUS,
  WORKFLOW_UID,
  ZODIAC_SIGNS_PL,
} from '../constants';
import type {
  ArticlePayload,
  DailyCardPayload,
  HoroscopePayload,
  LlmTraceLog,
  NormalizedWorkflowConfig,
  OpenRouterUsage,
  OpenRouterTrace,
  PublicationTicketRecord,
  RunLogRecord,
  RunStepLog,
  RunStepStatus,
  Strapi,
  TopicQueueItemRecord,
  WorkflowRecord,
} from '../types';
import { getNextOccurrence, isCronDue } from '../utils/cron';
import {
  addDaysToDateString,
  diffDays,
  formatDateInZone,
  getIsoWeekStartDateString,
  getMonthStartDateString,
  toMinuteSlot,
} from '../utils/date-time';
import { getOptionalString, getString, isRecord, toSafeErrorMessage } from '../utils/json';
import {
  assertPremiumContentQuality,
  PREMIUM_CONTENT_RETRY_MAX,
  type PremiumContentKind,
} from '../utils/premium-quality';
import {
  evaluatePolishContentQuality,
  formatPolishContentQualityIssues,
  POLISH_STYLE_REPAIR_MAX_ATTEMPTS,
  type PolishContentKind,
} from '../utils/polish-content-quality';
import { getAicoPromptTemplate, renderAicoPromptTemplate } from '../utils/aico-contract';
import { recordSystemAuditEvent } from '../utils/audit-trail';
import {
  sanitizeLlmTraceForStorage,
  shouldStoreRawLlmTrace,
} from '../utils/diagnostic-redaction';
import { getPluginService } from '../utils/plugin';
import { buildPublicFrontendUrl } from '../utils/public-url';
import { slugify } from '../utils/slug';
import type { SeoGuardrailReport } from './seo-guardrails';

type WorkflowService = {
  getByIdOrThrow: (id: number) => Promise<WorkflowRecord>;
  getById: (id: number) => Promise<WorkflowRecord | null>;
  list: () => Promise<Array<Record<string, unknown>>>;
  normalizeRuntime: (record: WorkflowRecord) => NormalizedWorkflowConfig;
  decryptTokenForRuntime: (record: WorkflowRecord) => Promise<string>;
  decryptImageTokenForRuntime: (record: WorkflowRecord) => Promise<string | null>;
  setStatus: (
    id: number,
    status: WorkflowRecord['status'],
    lastError?: string | null
  ) => Promise<void>;
  markGenerationSlot: (id: number, slot: string, generatedAt: Date) => Promise<void>;
  markPublishSlot: (id: number, slot: string, publishedAt: Date) => Promise<void>;
};

type RunsService = {
  create: (input: {
    workflowId?: number;
    runType: 'generate' | 'publish' | 'manual' | 'backfill';
    status: 'running' | 'success' | 'failed' | 'blocked_budget';
    startedAt: Date;
    attempts?: number;
    details?: Record<string, unknown>;
    errorMessage?: string;
  }) => Promise<RunLogRecord>;
  complete: (input: {
    runId: number;
    status: 'running' | 'success' | 'failed' | 'blocked_budget';
    errorMessage?: string;
    details?: Record<string, unknown>;
    usage?: OpenRouterUsage;
  }) => Promise<void>;
  updateDetails: (runId: number, details: Record<string, unknown>) => Promise<void>;
};

type TopicsService = {
  takeNextForWorkflow: (workflowId: number, now: Date) => Promise<TopicQueueItemRecord | null>;
  markDone: (id: number, articleId: number) => Promise<void>;
  markFailed: (id: number, errorMessage: string) => Promise<void>;
};

type UsageService = {
  assertBudget: (input: {
    workflowId: number;
    day: string;
    requestLimit: number;
    tokenLimit: number;
  }) => Promise<{ blocked: boolean; usage: { request_count: number; total_tokens: number } }>;
  registerUsage: (workflowId: number, day: string, usage: OpenRouterUsage) => Promise<void>;
};

type OpenRouterService = {
  requestJson: (input: {
    model: string;
    apiToken: string;
    prompt: string;
    schemaDescription: string;
    temperature?: number;
    maxCompletionTokens?: number;
    signal?: AbortSignal;
  }) => Promise<{ payload: unknown; usage: OpenRouterUsage; trace: OpenRouterTrace }>;
};

type LlmTraceLogger = (
  trace: OpenRouterTrace,
  meta: { label: string; workflowType: WorkflowRecord['workflow_type'] }
) => Promise<void>;

type MediaSelectorService = {
  resolveForArticle: (input: {
    workflowType: 'article' | 'daily_card';
    imageAssetKey?: string | null;
    requiredSignSlug?: string | null;
    contextKey: string;
    now: Date;
    targetDate?: string;
    title?: string;
    content?: string;
    categoryName?: string;
    apiToken?: string;
    llmModel?: string;
    imageGenModel?: string;
    imageGenToken?: string;
    workflowId?: number;
    onStep?: (
      stepId: string,
      status: RunStepStatus,
      message?: string,
      output?: any
    ) => Promise<void>;
  }) => Promise<{ mediaAssetId: number; mediaAssetKey: string; uploadFileId: number }>;
  resolveForZodiacSign: (input: {
    signSlug: string;
  }) => Promise<{ mediaAssetId: number; mediaAssetKey?: string; uploadFileId: number } | null>;
  registerUsage: (input: {
    mediaAssetId: number;
    workflowId?: number;
    contentUid: string;
    contentEntryId: number;
    contextKey: string;
    targetDate?: string;
  }) => Promise<void>;
};

type SeoGuardrailsService = {
  evaluateArticleDraft: (input: {
    payload: ArticlePayload | DailyCardPayload;
    slug: string;
    categoryId: number | null;
    currentId?: number;
    autoPublish?: boolean;
    guardrails?: Record<string, unknown>;
  }) => Promise<SeoGuardrailReport>;
};

type RuntimeLocksService = {
  withLock: <T>(
    key: string,
    input: { ttlMs?: number; metadata?: Record<string, unknown>; now?: Date },
    runner: () => Promise<T>
  ) => Promise<T | undefined>;
};

type AutonomyPolicyRuntimeService = {
  getPolicy: () => Promise<{ autonomy_mode?: string; global_kill_switch?: boolean }>;
  evaluate: (input: {
    action: 'content.publish';
    requiresBrandSafety?: boolean;
    requiresLegalDisclaimer?: boolean;
  }) => Promise<{ allowed: boolean; reason: string }>;
};

type GlobalAutonomyRuntimeBlock =
  | { blocked: false }
  | {
      blocked: true;
      reason: 'global_kill_switch' | 'autonomy_off' | 'policy_unavailable';
    };

type AdsAgentRuntimeService = {
  pauseActiveForKillSwitch: (input: { reason: string; limit?: number }) => Promise<{
    attempted: number;
    paused: number;
    blocked: number;
    failed: number;
    results?: Array<Record<string, unknown>>;
  }>;
};

type PolishRepairValidator<TPayload> = (payload: unknown) => TPayload;

const DEFAULT_WORKFLOW_LOCK_TTL_MS = 30 * 60_000;
const MAX_WORKFLOW_LOCK_TTL_MS = 6 * 60 * 60_000;

const emptyUsage = (): OpenRouterUsage => ({
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 0,
});

const resolveWorkflowLockTtlMs = (): number => {
  const configured = Number(process.env.AICO_WORKFLOW_LOCK_TTL_MS);
  const ttlMs = Number.isFinite(configured) ? configured : DEFAULT_WORKFLOW_LOCK_TTL_MS;

  return Math.max(60_000, Math.min(MAX_WORKFLOW_LOCK_TTL_MS, ttlMs));
};

const addUsage = (target: OpenRouterUsage, usage: OpenRouterUsage): void => {
  target.prompt_tokens += usage.prompt_tokens;
  target.completion_tokens += usage.completion_tokens;
  target.total_tokens += usage.total_tokens;
};

const sleep = async (ms: number, signal?: AbortSignal): Promise<void> => {
  assertNotAborted(signal);
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        resolve(undefined);
      },
      { once: true }
    );
  });
  assertNotAborted(signal);
};

const createGenerationSteps = (): RunStepLog[] => [
  { id: 'queued', label: 'Accepted', status: 'success' },
  { id: 'config', label: 'Load runtime config', status: 'pending' },
  { id: 'budget', label: 'Check daily budget', status: 'pending' },
  { id: 'token', label: 'Decrypt model token', status: 'pending' },
  { id: 'generate', label: 'Generate content', status: 'pending' },
  { id: 'usage', label: 'Register usage', status: 'pending' },
  { id: 'finalize', label: 'Finalize workflow', status: 'pending' },
];

const updateStep = (
  steps: RunStepLog[],
  id: string,
  status: RunStepStatus,
  message?: string | null,
  output?: unknown
): RunStepLog[] => {
  const timestamp = new Date().toISOString();
  let found = false;

  const nextSteps = steps.map((step) => {
    if (step.id !== id) {
      return step;
    }

    found = true;
    return {
      ...step,
      status,
      message: message ?? step.message,
      timestamp,
      ...(typeof output === 'undefined' ? {} : { output }),
    };
  });

  if (found) {
    return nextSteps;
  }

  return [
    ...nextSteps,
    {
      id,
      label: id
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
      status,
      message: message ?? null,
      timestamp,
      ...(typeof output === 'undefined' ? {} : { output }),
    },
  ];
};

const normalizeName = (value: string): string => {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const parseDateString = (value: string): { year: number; month: number; day: number } => {
  const [year, month, day] = value.split('-').map((v) => Number(v));

  if (!year || !month || !day) {
    throw new Error(`Niepoprawny format daty: ${value}. Oczekiwano YYYY-MM-DD.`);
  }

  return { year, month, day };
};

const resolveId = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return value;
  }

  if (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    typeof (value as { id: unknown }).id === 'number'
  ) {
    return (value as { id: number }).id;
  }

  return null;
};

const assertNotAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new Error('Workflow zatrzymany ręcznie.');
  }
};

const orchestrator = ({ strapi }: { strapi: Strapi }) => {
  const inProgress = new Set<number>();
  const abortControllers = new Map<number, AbortController>();
  const entityService = strapi.entityService as any;

  const workflowsService = (): WorkflowService =>
    getPluginService<WorkflowService>(strapi, 'workflows');
  const runsService = (): RunsService => getPluginService<RunsService>(strapi, 'runs');
  const topicsService = (): TopicsService => getPluginService<TopicsService>(strapi, 'topics');
  const usageService = (): UsageService => getPluginService<UsageService>(strapi, 'usage');
  const llmService = (): OpenRouterService =>
    getPluginService<OpenRouterService>(strapi, 'open-router');
  const mediaSelectorService = (): MediaSelectorService =>
    getPluginService<MediaSelectorService>(strapi, 'media-selector');
  const socialPublisherService = (): any => getPluginService<any>(strapi, 'social-publisher');
  const strategyPlannerService = (): any => getPluginService<any>(strapi, 'strategy-planner');
  const runtimeLocksService = (): Partial<RuntimeLocksService> | undefined =>
    getPluginService<Partial<RuntimeLocksService> | undefined>(strapi, 'runtime-locks');
  const autonomyPolicyService = (): Partial<AutonomyPolicyRuntimeService> | undefined =>
    getPluginService<Partial<AutonomyPolicyRuntimeService> | undefined>(strapi, 'autonomy-policy');
  const adsAgentService = (): Partial<AdsAgentRuntimeService> | undefined =>
    getPluginService<Partial<AdsAgentRuntimeService> | undefined>(strapi, 'ads-agent');
  const seoGuardrailsService = (): SeoGuardrailsService =>
    getPluginService<SeoGuardrailsService>(strapi, 'seo-guardrails');

  const api = {
    async tick(): Promise<void> {
      const now = new Date();
      const executeTick = async (): Promise<void> => {
        const runtimeBlock = await this.getGlobalAutonomyRuntimeBlock();
        if (runtimeBlock.blocked) {
          if (runtimeBlock.reason !== 'policy_unavailable') {
            await this.enforceAdsStopLossForRuntimeBlock(runtimeBlock.reason);
          }
          return;
        }
        await this.processStrategyAutomationTick(now);
        await this.processInsightsTick(now);
        await this.processGenerationTick(now);
        await this.processPublicationTick(now);
        if (await this.isAutoPublishGloballyEnabled()) {
          await socialPublisherService().publishPending(now);
        }
      };
      const locks = runtimeLocksService();

      if (typeof locks?.withLock === 'function') {
        await locks.withLock(
          'orchestrator.tick',
          {
            ttlMs: 55_000,
            metadata: { source: 'cron', tickStartedAt: now.toISOString() },
            now,
          },
          executeTick
        );
        return;
      }

      await executeTick();
    },

    async isGlobalAutonomyRuntimeBlocked(): Promise<boolean> {
      return (await this.getGlobalAutonomyRuntimeBlock()).blocked;
    },

    async getGlobalAutonomyRuntimeBlock(): Promise<GlobalAutonomyRuntimeBlock> {
      const service = autonomyPolicyService();
      if (typeof service?.getPolicy !== 'function') {
        return { blocked: false };
      }

      try {
        const policy = await service.getPolicy();
        if (policy.global_kill_switch) {
          strapi.log.warn('[AICO] Global autonomy policy blocked orchestrator tick.');
          return { blocked: true, reason: 'global_kill_switch' };
        }
        if (policy.autonomy_mode === 'off') {
          strapi.log.warn('[AICO] Autonomy mode=off blocked orchestrator tick.');
          return { blocked: true, reason: 'autonomy_off' };
        }
        return { blocked: false };
      } catch (error) {
        strapi.log.warn(
          `[AICO] Global autonomy policy unavailable; blocking orchestrator tick: ${toSafeErrorMessage(error)}`
        );
        return { blocked: true, reason: 'policy_unavailable' };
      }
    },

    async enforceAdsStopLossForRuntimeBlock(
      reason: 'global_kill_switch' | 'autonomy_off'
    ): Promise<void> {
      const ads = adsAgentService();
      if (typeof ads?.pauseActiveForKillSwitch !== 'function') {
        await recordSystemAuditEvent(strapi, {
          action: 'ads.stop-loss-sweep.skipped',
          outcome: 'skipped',
          severity: 'warn',
          metadata: {
            reason,
            blockedReason: 'ads_agent_stop_loss_sweep_missing',
          },
        });
        return;
      }

      const result = await ads.pauseActiveForKillSwitch({ reason });
      await recordSystemAuditEvent(strapi, {
        action: 'ads.stop-loss-sweep.runtime-block',
        outcome: result.failed > 0 || result.blocked > 0 ? 'skipped' : 'success',
        severity: result.failed > 0 || result.blocked > 0 ? 'warn' : 'info',
        metadata: {
          reason,
          attempted: result.attempted,
          paused: result.paused,
          blocked: result.blocked,
          failed: result.failed,
        },
      });
    },

    async processStrategyAutomationTick(now: Date): Promise<void> {
      try {
        if (!(await this.isStrategyAutopilotGloballyEnabled())) {
          return;
        }

        const planner = strategyPlannerService();
        if (planner && typeof planner.runAutopilot === 'function') {
          await planner.runAutopilot({ now });
        }
      } catch (error) {
        strapi.log.warn(`[AICO] Strategy autopilot failed: ${toSafeErrorMessage(error)}`);
      }
    },

    async processInsightsTick(now: Date): Promise<void> {
      try {
        const insights = getPluginService<
          { runDailyTick?: (input: { now: Date }) => Promise<unknown> } | undefined
        >(strapi, 'insights-engine');
        if (insights && typeof insights.runDailyTick === 'function') {
          await insights.runDailyTick({ now });
        }
      } catch (error) {
        strapi.log.warn(`[AICO] Insights tick failed: ${toSafeErrorMessage(error)}`);
      }
    },

    async isAutoPublishGloballyEnabled(): Promise<boolean> {
      if (typeof strapi.store !== 'function') {
        return true;
      }

      const store = strapi.store({
        type: 'plugin',
        name: 'ai-content-orchestrator',
        key: 'settings',
      });
      const saved = ((await store.get()) as Record<string, unknown> | null) ?? {};
      return saved.aico_auto_publish_enabled !== false;
    },

    async isStrategyAutopilotGloballyEnabled(): Promise<boolean> {
      if (typeof strapi.store !== 'function') {
        return false;
      }

      const store = strapi.store({
        type: 'plugin',
        name: 'ai-content-orchestrator',
        key: 'settings',
      });
      const saved = ((await store.get()) as Record<string, unknown> | null) ?? {};
      return saved.aico_strategy_autopilot_enabled === true;
    },

    async shouldSchedulePublication(config: NormalizedWorkflowConfig): Promise<boolean> {
      if (!config.autoPublish) {
        return false;
      }

      return this.isAutoPublishGloballyEnabled();
    },

    async evaluateArticleSeo(input: {
      payload: ArticlePayload | DailyCardPayload;
      slug: string;
      categoryId: number | null;
      currentId?: number;
      config: NormalizedWorkflowConfig;
      onStep?: (
        stepId: string,
        status: 'running' | 'success' | 'failed',
        message?: string,
        output?: any
      ) => Promise<void>;
    }): Promise<SeoGuardrailReport> {
      const report = await seoGuardrailsService().evaluateArticleDraft({
        payload: input.payload,
        slug: input.slug,
        categoryId: input.categoryId,
        currentId: input.currentId,
        autoPublish: input.config.autoPublish,
        guardrails: input.config.autoPublishGuardrails,
      });

      await input.onStep?.(
        'seo_guardrails',
        report.decision === 'fail' ? 'failed' : 'success',
        `SEO guardrails: ${report.decision}, score ${report.score}`,
        report
      );

      return report;
    },

    async ensurePolishContentQuality<TPayload>(input: {
      payload: TPayload;
      kind: PolishContentKind;
      schemaDescription: string;
      apiToken: string;
      llmModel: string;
      workflowType: WorkflowRecord['workflow_type'];
      label: string;
      validate: PolishRepairValidator<TPayload>;
      maxCompletionTokens?: number;
      abortSignal?: AbortSignal;
      onLlmTrace?: LlmTraceLogger;
      onStep?: (
        stepId: string,
        status: RunStepStatus,
        message?: string,
        output?: unknown
      ) => Promise<void>;
    }): Promise<{ payload: TPayload; usage: OpenRouterUsage; repaired: boolean }> {
      const usage = emptyUsage();
      let currentPayload = input.payload;
      let report = evaluatePolishContentQuality({
        kind: input.kind,
        payload: currentPayload,
      });

      if (report.valid) {
        return { payload: currentPayload, usage, repaired: false };
      }

      let lastIssueSummary = formatPolishContentQualityIssues(report.issues);
      let lastErrorMessage: string | null = null;

      await input.onStep?.(
        'polish_quality',
        'running',
        `Korekta polszczyzny: ${input.label}`,
        { issues: lastIssueSummary }
      );

      for (let attempt = 1; attempt <= POLISH_STYLE_REPAIR_MAX_ATTEMPTS; attempt += 1) {
        assertNotAborted(input.abortSignal);

        try {
          const repairPrompt = renderAicoPromptTemplate(getAicoPromptTemplate('polishStyleRepair'), {
            payloadKind: input.kind,
            schemaDescription: input.schemaDescription,
            payloadJson: JSON.stringify(currentPayload),
            qualityIssues: lastIssueSummary,
          });
          const response = await llmService().requestJson({
            model: input.llmModel,
            apiToken: input.apiToken,
            prompt: repairPrompt,
            schemaDescription: input.schemaDescription,
            temperature: 0.25,
            maxCompletionTokens: input.maxCompletionTokens,
            signal: input.abortSignal,
          });

          addUsage(usage, response.usage);
          await input.onLlmTrace?.(response.trace, {
            label: `${input.label} / Polish repair ${attempt}`,
            workflowType: input.workflowType,
          });

          currentPayload = input.validate(response.payload);
          report = evaluatePolishContentQuality({
            kind: input.kind,
            payload: currentPayload,
          });

          if (report.valid) {
            await input.onStep?.(
              'polish_quality',
              'success',
              `Korekta polszczyzny zakończona: ${input.label}`,
              { attempts: attempt }
            );
            return { payload: currentPayload, usage, repaired: true };
          }

          lastIssueSummary = formatPolishContentQualityIssues(report.issues);
          lastErrorMessage = null;
        } catch (error) {
          if (input.abortSignal?.aborted) {
            throw error;
          }

          lastErrorMessage = toSafeErrorMessage(error);
        }
      }

      await input.onStep?.(
        'polish_quality',
        'failed',
        `Korekta polszczyzny nie powiodła się: ${input.label}`,
        { issues: lastIssueSummary }
      );

      throw new Error(
        `quality_failed_polish_style ${input.kind} (${lastErrorMessage ?? lastIssueSummary})`
      );
    },

    async runNow(workflowId: number, reason = 'manual'): Promise<Record<string, unknown>> {
      const workflow = await workflowsService().getByIdOrThrow(workflowId);

      const result = await this.executeGeneration(workflow, {
        runType: 'manual',
        reason,
        now: new Date(),
      });

      return result;
    },

    async stop(workflowId: number): Promise<Record<string, unknown>> {
      const controller = abortControllers.get(workflowId);

      if (!inProgress.has(workflowId) || !controller) {
        return {
          workflowId,
          stopped: false,
          reason: 'Workflow nie jest aktualnie uruchomiony',
        };
      }

      controller.abort();
      await workflowsService().setStatus(workflowId, WORKFLOW_STATUS.idle, 'Zatrzymano ręcznie.');

      return {
        workflowId,
        stopped: true,
      };
    },

    async backfill(
      workflowId: number,
      payload: { startDate: string; endDate: string; dryRun?: boolean },
      options: { skipBackfillLock?: boolean } = {}
    ): Promise<Record<string, unknown>> {
      const workflow = await workflowsService().getByIdOrThrow(workflowId);
      const normalized = await workflowsService().normalizeRuntime(workflow);

      const start = payload.startDate;
      const end = payload.endDate;
      const rangeDays = diffDays(start, end);

      if (rangeDays < 0) {
        throw new Error('Data końca backfillu musi być >= daty startu.');
      }

      if (rangeDays + 1 > MAX_BACKFILL_DAYS) {
        throw new Error(`Zakres backfillu jest zbyt duży. Maksymalnie ${MAX_BACKFILL_DAYS} dni.`);
      }

      const summary = {
        workflowId,
        timezone: normalized.timezone,
        startDate: start,
        endDate: end,
        processed: 0,
        succeeded: 0,
        skipped: 0,
        failed: 0,
        dryRun: Boolean(payload.dryRun),
        errors: [] as string[],
      };

      if (!payload.dryRun && !options.skipBackfillLock) {
        const locks = runtimeLocksService();

        if (typeof locks?.withLock === 'function') {
          const lockKey = `orchestrator.backfill.workflow.${workflowId}`;
          const lockedResult = await locks.withLock(
            lockKey,
            {
              ttlMs: resolveWorkflowLockTtlMs(),
              metadata: {
                source: 'backfill',
                workflowId,
                startDate: start,
                endDate: end,
              },
              now: new Date(),
            },
            () => this.backfill(workflowId, payload, { skipBackfillLock: true })
          );

          if (lockedResult) {
            return lockedResult;
          }

          return {
            ...summary,
            processed: rangeDays + 1,
            skipped: rangeDays + 1,
            reason: 'runtime_lock_held',
            lockKey,
          };
        }
      }

      let cursor = start;

      for (let i = 0; i <= rangeDays; i += 1) {
        const publishDate = this.getPublishDateForLocalDay(
          normalized.publishCron,
          cursor,
          normalized.timezone
        );

        if (payload.dryRun) {
          summary.processed += 1;
          summary.succeeded += 1;
          cursor = addDaysToDateString(cursor, 1);
          continue;
        }

        try {
          const result = await this.executeGeneration(workflow, {
            runType: 'backfill',
            reason: `backfill:${cursor}`,
            now: new Date(),
            forcedPublishAt: publishDate,
            skipSlotMutation: true,
          });
          summary.processed += 1;
          if (result.skipped === true) {
            summary.skipped += 1;
          } else {
            summary.succeeded += 1;
          }
        } catch (error) {
          summary.processed += 1;
          summary.failed += 1;
          summary.errors.push(`${cursor}: ${toSafeErrorMessage(error)}`);
        }

        cursor = addDaysToDateString(cursor, 1);
      }

      return summary;
    },

    async processGenerationTick(now: Date): Promise<void> {
      const workflows = (await entityService.findMany(WORKFLOW_UID, {
        filters: { enabled: true },
        sort: { id: 'asc' },
        populate: ['article_category'],
      })) as WorkflowRecord[];

      for (const workflow of workflows) {
        try {
          const config = await workflowsService().normalizeRuntime(workflow);

          const due = isCronDue(
            config.generateCron,
            config.timezone,
            now,
            workflow.last_generation_slot ?? config.lastGenerationSlot
          );

          if (!due.due) {
            continue;
          }

          await this.executeGeneration(workflow, {
            runType: 'generate',
            reason: 'cron-generate',
            now,
            generationSlotKey: due.slotKey,
          });
        } catch (error) {
          strapi.log.error(
            `[aico] generation tick failed for workflow #${workflow.id}: ${toSafeErrorMessage(error)}`
          );
        }
      }
    },

    async processPublicationTick(now: Date): Promise<void> {
      if (!(await this.isAutoPublishGloballyEnabled())) {
        return;
      }

      const dueTickets = (await entityService.findMany(PUBLICATION_TICKET_UID, {
        filters: {
          status: TICKET_STATUS.scheduled,
          target_publish_at: { $lte: now.toISOString() },
        },
        populate: ['workflow'],
        sort: { target_publish_at: 'asc' },
        limit: 100,
      })) as PublicationTicketRecord[];

      if (dueTickets.length === 0) {
        return;
      }

      const run = await runsService().create({
        workflowId: resolveId(dueTickets[0]?.workflow) ?? undefined,
        runType: 'publish',
        status: RUN_STATUS.running,
        startedAt: now,
        details: {
          tickets: dueTickets.length,
        },
      });

      let publishedCount = 0;
      let rescheduledCount = 0;
      let failedCount = 0;

      for (const ticket of dueTickets) {
        try {
          const result = await this.publishTicket(ticket, now);
          if (result === 'published') {
            publishedCount += 1;
          } else if (result === 'rescheduled') {
            rescheduledCount += 1;
          } else {
            failedCount += 1;
          }
        } catch (error) {
          failedCount += 1;
          strapi.log.error(
            `[aico] publish ticket #${ticket.id} failed: ${toSafeErrorMessage(error)}`
          );
        }
      }

      const notPublishedCount = rescheduledCount + failedCount;

      await runsService().complete({
        runId: run.id,
        status: notPublishedCount === 0 ? RUN_STATUS.success : RUN_STATUS.failed,
        details: {
          published: publishedCount,
          rescheduled: rescheduledCount,
          failed: failedCount,
          tickets: dueTickets.length,
        },
        errorMessage:
          notPublishedCount === 0
            ? undefined
            : `${rescheduledCount} ticket(s) rescheduled, ${failedCount} ticket(s) failed`,
      });
    },

    async publishTicket(
      ticket: PublicationTicketRecord,
      now: Date
    ): Promise<'published' | 'rescheduled' | 'failed'> {
      const workflowId = resolveId(ticket.workflow);
      const workflow = workflowId ? await workflowsService().getById(workflowId) : null;
      const retryMax = Math.max(1, Math.min(10, Number(workflow?.retry_max ?? DEFAULT_RETRY_MAX)));
      const backoff = Math.max(
        15,
        Math.min(3600, Number(workflow?.retry_backoff_seconds ?? DEFAULT_RETRY_BACKOFF_SECONDS))
      );

      try {
        const policy = autonomyPolicyService();
        if (typeof policy?.evaluate === 'function') {
          const decision = await policy.evaluate({
            action: 'content.publish',
            requiresBrandSafety: true,
            requiresLegalDisclaimer: true,
          });

          if (!decision.allowed) {
            const message = `Autonomy policy blocked content publish: ${decision.reason}`;
            await recordSystemAuditEvent(strapi, {
              action: 'content.publish.skipped',
              outcome: 'skipped',
              severity: 'warn',
              resourceUid: ticket.content_uid,
              resourceId: ticket.content_entry_id,
              metadata: {
                reason: decision.reason,
                ticketId: ticket.id,
                workflowId,
              },
            });
            await entityService.update(PUBLICATION_TICKET_UID, ticket.id, {
              data: {
                retries: Number(ticket.retries ?? 0) + 1,
                status: TICKET_STATUS.failed,
                last_error: message,
              },
            });

            if (workflow) {
              await workflowsService().setStatus(workflow.id, WORKFLOW_STATUS.failed, message);
            }

            return 'failed';
          }
        } else if (process.env.AICO_FULL_AUTONOMY_REQUIRED === 'true') {
          const message = 'Autonomy policy service missing for content publish.';
          await recordSystemAuditEvent(strapi, {
            action: 'content.publish.skipped',
            outcome: 'skipped',
            severity: 'error',
            resourceUid: ticket.content_uid,
            resourceId: ticket.content_entry_id,
            metadata: {
              reason: 'autonomy_policy_service_missing',
              ticketId: ticket.id,
              workflowId,
            },
          });
          await entityService.update(PUBLICATION_TICKET_UID, ticket.id, {
            data: {
              retries: Number(ticket.retries ?? 0) + 1,
              status: TICKET_STATUS.failed,
              last_error: message,
            },
          });

          if (workflow) {
            await workflowsService().setStatus(
              workflow.id,
              WORKFLOW_STATUS.failed,
              'autonomy_policy_service_missing'
            );
          }

          return 'failed';
        }

        await recordSystemAuditEvent(strapi, {
          action: 'content.publish.attempt',
          outcome: 'success',
          resourceUid: ticket.content_uid,
          resourceId: ticket.content_entry_id,
          metadata: {
            ticketId: ticket.id,
            workflowId,
          },
        });
        const entry = await entityService.findOne(ticket.content_uid, ticket.content_entry_id);

        if (!entry) {
          throw new Error(`Brak wpisu docelowego ${ticket.content_uid}#${ticket.content_entry_id}`);
        }

        const publishedAt = (entry as { publishedAt?: string | null }).publishedAt;

        if (!publishedAt) {
          await entityService.update(ticket.content_uid, ticket.content_entry_id, {
            data: {
              publishedAt: now,
            },
          });
        }

        await entityService.update(PUBLICATION_TICKET_UID, ticket.id, {
          data: {
            status: TICKET_STATUS.published,
            published_on: now,
            last_error: null,
          },
        });

        if (workflow) {
          await workflowsService().markPublishSlot(workflow.id, toMinuteSlot(now), now);
        }

        return 'published';
      } catch (error) {
        const retries = Number(ticket.retries ?? 0);
        const message = toSafeErrorMessage(error);

        if (retries + 1 < retryMax) {
          const delayMs = backoff * 1000 * Math.pow(2, retries);
          const retryAt = new Date(now.getTime() + delayMs);

          await entityService.update(PUBLICATION_TICKET_UID, ticket.id, {
            data: {
              retries: retries + 1,
              target_publish_at: retryAt,
              status: TICKET_STATUS.scheduled,
              last_error: message,
            },
          });

          return 'rescheduled';
        }

        await entityService.update(PUBLICATION_TICKET_UID, ticket.id, {
          data: {
            retries: retries + 1,
            status: TICKET_STATUS.failed,
            last_error: message,
          },
        });

        if (workflow) {
          await workflowsService().setStatus(workflow.id, WORKFLOW_STATUS.failed, message);
        }

        return 'failed';
      }
    },

    async executeGeneration(
      workflow: WorkflowRecord,
      options: {
        runType: 'generate' | 'manual' | 'backfill';
        reason: string;
        now: Date;
        generationSlotKey?: string;
        forcedPublishAt?: Date;
        skipSlotMutation?: boolean;
        skipWorkflowLock?: boolean;
      }
    ): Promise<Record<string, unknown>> {
      const workflowId = workflow.id;

      if (!options.skipWorkflowLock) {
        const locks = runtimeLocksService();

        if (typeof locks?.withLock === 'function') {
          const lockKey = `orchestrator.generation.workflow.${workflowId}`;
          const lockedResult = await locks.withLock(
            lockKey,
            {
              ttlMs: resolveWorkflowLockTtlMs(),
              metadata: {
                source: 'generation',
                workflowId,
                runType: options.runType,
                reason: options.reason,
              },
              now: options.now,
            },
            () =>
              this.executeGeneration(workflow, {
                ...options,
                skipWorkflowLock: true,
              })
          );

          if (lockedResult) {
            return lockedResult;
          }

          return {
            workflowId,
            skipped: true,
            reason: 'runtime_lock_held',
            lockKey,
          };
        }
      }

      if (inProgress.has(workflowId)) {
        return {
          workflowId,
          skipped: true,
          reason: 'Workflow już jest wykonywany',
        };
      }

      inProgress.add(workflowId);
      const abortController = new AbortController();
      abortControllers.set(workflowId, abortController);

      const startedAt = new Date();
      const runDetailsBase: Record<string, unknown> = {
        reason: options.reason,
        generationSlot: options.generationSlotKey,
        forcedPublishAt: options.forcedPublishAt?.toISOString(),
      };
      let steps = updateStep(createGenerationSteps(), 'queued', 'success', 'Run request accepted');
      let llmTraces: LlmTraceLog[] = [];
      let activeStepId = 'queued';
      const run = await runsService().create({
        workflowId,
        runType: options.runType,
        status: RUN_STATUS.running,
        startedAt,
        details: {
          ...runDetailsBase,
          steps,
          llmTraces,
        },
      });

      const runId = run.id;

      const setRunStep = async (
        stepId: string,
        status: RunStepStatus,
        message?: string | null,
        output?: unknown
      ): Promise<void> => {
        activeStepId = stepId;
        steps = updateStep(steps, stepId, status, message, output);
        await runsService().updateDetails(run.id, {
          ...runDetailsBase,
          steps,
        });
      };

      const logLlmTrace: LlmTraceLogger = async (trace, meta) => {
        const storageTrace = sanitizeLlmTraceForStorage(trace, {
          storeRaw: shouldStoreRawLlmTrace(),
        });
        const nextTrace: LlmTraceLog = {
          ...storageTrace,
          id: `${run.id}-${llmTraces.length + 1}`,
          label: meta.label,
          workflowType: meta.workflowType,
          createdAt: new Date().toISOString(),
        };

        llmTraces = [...llmTraces, nextTrace];
        await runsService().updateDetails(run.id, {
          ...runDetailsBase,
          steps,
          llmTraces,
        });
      };

      try {
        assertNotAborted(abortController.signal);
        await setRunStep('config', 'running', 'Loading workflow runtime');
        const config = await workflowsService().normalizeRuntime(workflow);
        await setRunStep('config', 'success', `Runtime ready for ${config.workflowType}`, {
          timezone: config.timezone,
          locale: config.locale,
          publishCron: config.publishCron,
        });

        await workflowsService().setStatus(workflowId, WORKFLOW_STATUS.running, null);

        assertNotAborted(abortController.signal);
        const localDay = formatDateInZone(options.now, config.timezone);
        await setRunStep('budget', 'running', `Checking limits for ${localDay}`);
        const budgetState = await usageService().assertBudget({
          workflowId,
          day: localDay,
          requestLimit: config.dailyRequestLimit,
          tokenLimit: config.dailyTokenLimit,
        });

        assertNotAborted(abortController.signal);
        if (budgetState.blocked) {
          await workflowsService().setStatus(
            workflowId,
            WORKFLOW_STATUS.blockedBudget,
            'Przekroczony budżet dzienny'
          );
          await setRunStep('budget', 'failed', 'Daily request/token budget exceeded', {
            localDay,
            requestCount: budgetState.usage.request_count,
            totalTokens: budgetState.usage.total_tokens,
          });
          await setRunStep('finalize', 'failed', 'Workflow stopped on budget guard');

          await runsService().complete({
            runId: run.id,
            status: RUN_STATUS.blockedBudget,
            errorMessage: 'Przekroczony budżet dzienny (request/token limit).',
            details: {
              ...runDetailsBase,
              steps,
              llmTraces,
              localDay,
              requestCount: budgetState.usage.request_count,
              totalTokens: budgetState.usage.total_tokens,
            },
          });

          return {
            workflowId,
            blocked: true,
            reason: 'budget',
          };
        }

        await setRunStep('budget', 'success', 'Budget available', {
          localDay,
          requestCount: budgetState.usage.request_count,
          totalTokens: budgetState.usage.total_tokens,
        });
        assertNotAborted(abortController.signal);
        await setRunStep('token', 'running', 'Decrypting model API token');
        const apiToken = await workflowsService().decryptTokenForRuntime(workflow);
        await setRunStep('token', 'success', 'Model API token ready');

        const publishAt =
          options.forcedPublishAt ??
          getNextOccurrence(
            config.publishCron,
            new Date(options.now.getTime() + 1_000),
            config.timezone
          );

        await setRunStep('generate', 'running', `Generating ${config.workflowType} content`, {
          publishAt: publishAt.toISOString(),
        });
        const runResult = await this.generateWithRetries({
          runId,
          workflow,
          config,
          apiToken,
          publishAt,
          targetDate: localDay,
          now: options.now,
          onLlmTrace: logLlmTrace,
          abortSignal: abortController.signal,
          onStep: setRunStep,
        });
        assertNotAborted(abortController.signal);
        await setRunStep('generate', 'success', 'Content generated', {
          created: runResult.created,
          updated: runResult.updated,
          skipped: runResult.skipped,
          publishAt: publishAt.toISOString(),
        });

        if (!options.skipSlotMutation && options.generationSlotKey) {
          await workflowsService().markGenerationSlot(
            workflowId,
            options.generationSlotKey,
            options.now
          );
        }

        await setRunStep('usage', 'running', 'Registering token usage');
        await usageService().registerUsage(workflowId, localDay, runResult.usage);
        await setRunStep('usage', 'success', 'Usage registered', runResult.usage);

        await workflowsService().setStatus(workflowId, WORKFLOW_STATUS.idle, null);
        await setRunStep('finalize', 'success', 'Workflow returned to idle');

        await runsService().complete({
          runId: run.id,
          status: RUN_STATUS.success,
          usage: runResult.usage,
          details: {
            ...runDetailsBase,
            steps,
            llmTraces,
            publishAt: publishAt.toISOString(),
            created: runResult.created,
            updated: runResult.updated,
            skipped: runResult.skipped,
            workflowType: config.workflowType,
          },
        });

        return {
          workflowId,
          publishAt: publishAt.toISOString(),
          ...runResult,
        };
      } catch (error) {
        const wasStopped = abortController.signal.aborted;
        const message = wasStopped ? 'Workflow zatrzymany ręcznie.' : toSafeErrorMessage(error);

        await workflowsService().setStatus(
          workflowId,
          wasStopped ? WORKFLOW_STATUS.idle : WORKFLOW_STATUS.failed,
          message
        );
        steps = updateStep(steps, activeStepId, 'failed', message);
        steps = updateStep(
          steps,
          'finalize',
          'failed',
          wasStopped ? 'Workflow stopped manually' : 'Workflow failed'
        );
        await runsService().updateDetails(run.id, {
          ...runDetailsBase,
          steps,
          llmTraces,
        });

        await runsService().complete({
          runId: run.id,
          status: RUN_STATUS.failed,
          errorMessage: message,
          details: {
            ...runDetailsBase,
            steps,
            llmTraces,
            stopped: wasStopped,
          },
        });

        throw error;
      } finally {
        inProgress.delete(workflowId);
        abortControllers.delete(workflowId);
      }
    },

    async generateWithRetries(input: {
      runId: number;
      workflow: WorkflowRecord;
      config: NormalizedWorkflowConfig;
      apiToken: string;
      publishAt: Date;
      targetDate: string;
      now: Date;
      onLlmTrace?: LlmTraceLogger;
      abortSignal?: AbortSignal;
      onStep?: (
        stepId: string,
        status: 'running' | 'success' | 'failed',
        message?: string,
        output?: any
      ) => Promise<void>;
    }): Promise<{ created: number; updated: number; skipped: number; usage: OpenRouterUsage }> {
      let lastError: Error | null = null;
      const maxAttempts = PREMIUM_CONTENT_RETRY_MAX;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          assertNotAborted(input.abortSignal);
          if (input.config.workflowType === 'horoscope') {
            return await this.generateHoroscopeBatch(
              input.runId,
              input.workflow,
              input.config,
              input.apiToken,
              input.publishAt,
              input.onLlmTrace,
              input.onStep,
              input.abortSignal
            );
          }

          if (input.config.workflowType === 'daily_card') {
            return await this.generateDailyCard(
              input.runId,
              input.workflow,
              input.config,
              input.apiToken,
              input.publishAt,
              input.onLlmTrace,
              input.onStep,
              input.abortSignal
            );
          }

          if (input.config.workflowType === 'article') {
            return await this.generateArticleFromQueue(
              input.runId,
              input.workflow,
              input.config,
              input.apiToken,
              input.publishAt,
              input.now,
              input.onLlmTrace,
              input.onStep,
              input.abortSignal
            );
          }

          throw new Error(`Nieobsługiwany workflow type: ${input.config.workflowType}`);
        } catch (error) {
          if (input.abortSignal?.aborted) {
            throw new Error('Workflow zatrzymany ręcznie.');
          }

          lastError = error instanceof Error ? error : new Error(String(error));

          if (
            lastError.message.includes('quality_failed_final') ||
            lastError.message.includes('quality_failed_polish_style')
          ) {
            break;
          }

          if (attempt >= maxAttempts) {
            break;
          }

          const backoffMs = input.config.retryBackoffSeconds * 1000 * Math.pow(2, attempt - 1);
          assertNotAborted(input.abortSignal);
          await sleep(backoffMs, input.abortSignal);
        }
      }

      throw lastError ?? new Error('Generacja nie powiodła się.');
    },

    async generateHoroscopeBatch(
      runId: number,
      workflow: WorkflowRecord,
      config: NormalizedWorkflowConfig,
      apiToken: string,
      publishAt: Date,
      onLlmTrace?: LlmTraceLogger,
      onStep?: (
        stepId: string,
        status: RunStepStatus,
        message?: string,
        output?: any
      ) => Promise<void>,
      abortSignal?: AbortSignal
    ): Promise<{ created: number; updated: number; skipped: number; usage: OpenRouterUsage }> {
      const signs = await this.fetchZodiacSigns();

      if (signs.length === 0) {
        throw new Error('Brak znaków zodiaku w bazie.');
      }

      const targetDate = this.resolveHoroscopeDateAnchor(
        config.horoscopePeriod,
        publishAt,
        config.timezone
      );
      const usageAcc = {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const horoscopeType of config.horoscopeTypeValues) {
        const context = {
          targetDate,
          period: config.horoscopePeriod,
          type: horoscopeType,
          signList: signs.map((sign) => sign.name).join(', '),
          locale: config.locale,
          category: '',
          topicBrief: '',
        };

        const prompt = this.renderPrompt(config.promptTemplate, context);

        const schema =
          '{"items":[{"sign":"string","content":"string","premiumContent":"string wymagany","type":"string opcjonalny"}]}';

        const llmResponse = await llmService().requestJson({
          model: config.llmModel,
          apiToken,
          prompt,
          schemaDescription: schema,
          temperature: config.temperature,
          maxCompletionTokens: config.maxCompletionTokens,
          signal: abortSignal,
        });
        assertNotAborted(abortSignal);

        usageAcc.prompt_tokens += llmResponse.usage.prompt_tokens;
        usageAcc.completion_tokens += llmResponse.usage.completion_tokens;
        usageAcc.total_tokens += llmResponse.usage.total_tokens;

        await onLlmTrace?.(llmResponse.trace, {
          label: `Horoscope ${config.horoscopePeriod} / ${horoscopeType}`,
          workflowType: config.workflowType,
        });

        const repairResult = await this.ensurePolishContentQuality({
          payload: this.validateHoroscopePayload(llmResponse.payload, horoscopeType),
          kind: 'horoscope',
          schemaDescription: schema,
          apiToken,
          llmModel: config.llmModel,
          workflowType: config.workflowType,
          label: `Horoscope ${config.horoscopePeriod} / ${horoscopeType}`,
          validate: (candidate) => this.validateHoroscopePayload(candidate, horoscopeType),
          maxCompletionTokens: config.maxCompletionTokens,
          abortSignal,
          onLlmTrace,
          onStep,
        });
        addUsage(usageAcc, repairResult.usage);
        const payload = repairResult.payload;
        const premiumKind: PremiumContentKind =
          config.horoscopePeriod === 'Dzienny' ? 'horoscope-daily' : 'horoscope-periodic';

        for (const item of payload.items) {
          assertPremiumContentQuality({
            label: `Horoscope ${config.horoscopePeriod} / ${horoscopeType} / ${item.sign}`,
            content: item.content,
            premiumContent: item.premiumContent,
            kind: premiumKind,
          });
        }

        for (const item of payload.items) {
          const normalizedSign = normalizeName(item.sign);
          const sign = signs.find((candidate) => normalizeName(candidate.name) === normalizedSign);

          if (!sign) {
            skipped += 1;
            continue;
          }

          const businessKey = `horoscope:${config.horoscopePeriod}:${horoscopeType}:${targetDate}:${sign.id}`;

          const result = await this.upsertHoroscope({
            workflow,
            config,
            signId: sign.id,
            content: item.content,
            premiumContent: item.premiumContent ?? null,
            targetDate,
            horoscopeType,
            businessKey,
            publishAt,
          });

          created += result.created;
          updated += result.updated;
          skipped += result.skipped;
        }
      }

      if (created > 0 || updated > 0) {
        await socialPublisherService().generateTeaser({
          workflowId: workflow.id,
          runId,
          contentUid: CONTENT_UIDS.horoscope,
          contentId: workflow.id,
          contentTitle: `Nowe horoskopy ${config.horoscopePeriod.toLowerCase()}e są już dostępne! ✦`,
          contentExcerpt: `Zajrzyj w gwiazdy i dowiedz się, co przyniesie najbliższy czas. Horoskopy ${config.horoscopePeriod.toLowerCase()}e dla wszystkich znaków zodiaku już na Star Sign.`,
          targetUrl: buildPublicFrontendUrl('/horoskopy'),
          publishAt,
        });
      }

      return {
        created,
        updated,
        skipped,
        usage: usageAcc,
      };
    },

    async generateDailyCard(
      runId: number,
      workflow: WorkflowRecord,
      config: NormalizedWorkflowConfig,
      apiToken: string,
      publishAt: Date,
      onLlmTrace?: LlmTraceLogger,
      onStep?: (
        stepId: string,
        status: RunStepStatus,
        message?: string,
        output?: any
      ) => Promise<void>,
      abortSignal?: AbortSignal
    ): Promise<{ created: number; updated: number; skipped: number; usage: OpenRouterUsage }> {
      const cards = await this.fetchTarotCards();

      if (cards.length === 0) {
        throw new Error('Brak kart tarota w bazie.');
      }

      const card = cards[Math.floor(Math.random() * cards.length)];
      const targetDate = formatDateInZone(publishAt, config.timezone);

      const context = {
        targetDate,
        period: 'Dzienny',
        type: 'Karta dnia',
        signList: '',
        locale: config.locale,
        category: '',
        topicBrief: '',
        cardName: card.name,
        cardDescription: card.description ?? '',
        cardMeaningUpright: card.meaning_upright ?? '',
        cardMeaningReversed: card.meaning_reversed ?? '',
      };

      const prompt = this.renderPrompt(config.promptTemplate, context);
      const schema =
        '{"title":"string","excerpt":"string","content":"string","premiumContent":"string","isPremium":true,"draw_message":"string","slug":"string opcjonalny"}';

      const llmResponse = await llmService().requestJson({
        model: config.llmModel,
        apiToken,
        prompt,
        schemaDescription: schema,
        temperature: config.temperature,
        maxCompletionTokens: config.maxCompletionTokens,
        signal: abortSignal,
      });
      assertNotAborted(abortSignal);

      await onLlmTrace?.(llmResponse.trace, {
        label: `Daily card / ${targetDate}`,
        workflowType: config.workflowType,
      });

      const repairResult = await this.ensurePolishContentQuality({
        payload: this.validateDailyCardPayload(llmResponse.payload),
        kind: 'daily_card',
        schemaDescription: schema,
        apiToken,
        llmModel: config.llmModel,
        workflowType: config.workflowType,
        label: `Daily card / ${targetDate}`,
        validate: (candidate) => this.validateDailyCardPayload(candidate),
        maxCompletionTokens: config.maxCompletionTokens,
        abortSignal,
        onLlmTrace,
        onStep,
      });
      const payload = repairResult.payload;
      assertPremiumContentQuality({
        label: `Daily card / ${targetDate}`,
        content: payload.content,
        premiumContent: payload.premiumContent,
        kind: 'tarot',
      });

      await this.upsertDailyDraw(targetDate, card.id, payload.draw_message);

      const articleBusinessKey = `daily-card:article:${targetDate}`;

      // KROK 3: Dobór obrazu z pełnym kontekstem Karty Dnia
      const selectionResult = await mediaSelectorService().resolveForArticle({
        workflowType: 'daily_card',
        contextKey: `daily-card:${targetDate}`,
        now: new Date(),
        targetDate,
        title: payload.title,
        content: payload.content,
        categoryName: 'Karta Dnia',
        apiToken,
        llmModel: config.llmModel,
        imageGenModel: config.imageGenModel,
        imageGenToken: await workflowsService().decryptImageTokenForRuntime(workflow),
        workflowId: workflow.id,
        onStep: onStep,
      });

      const upsertResult = await this.upsertArticleDraft({
        workflow,
        config,
        payload,
        workflowType: 'daily_card',
        publishAt,
        businessKey: articleBusinessKey,
        explicitSlug: payload.slug || `karta-dnia-${targetDate}`,
        categoryId: config.articleCategoryId,
        imageAssetKey: selectionResult.mediaAssetKey,
        imageContextKey: `daily-card:${workflow.id}`,
        targetDate,
        onStep: onStep,
      });

      if (upsertResult.articleId) {
        await socialPublisherService().generateTeaser({
          workflowId: workflow.id,
          runId,
          contentUid: CONTENT_UIDS.article,
          contentId: upsertResult.articleId,
          contentTitle: payload.title,
          contentExcerpt: payload.excerpt,
          targetUrl: buildPublicFrontendUrl(
            `/artykuly/${payload.slug || `karta-dnia-${targetDate}`}`
          ),
          publishAt,
        });
      }

      return {
        created: upsertResult.created,
        updated: upsertResult.updated,
        skipped: upsertResult.skipped,
        usage: {
          prompt_tokens: llmResponse.usage.prompt_tokens + repairResult.usage.prompt_tokens,
          completion_tokens:
            llmResponse.usage.completion_tokens + repairResult.usage.completion_tokens,
          total_tokens: llmResponse.usage.total_tokens + repairResult.usage.total_tokens,
        },
      };
    },

    async generateArticleFromQueue(
      runId: number,
      workflow: WorkflowRecord,
      config: NormalizedWorkflowConfig,
      apiToken: string,
      publishAt: Date,
      now: Date,
      onLlmTrace?: LlmTraceLogger,
      onStep?: (
        stepId: string,
        status: RunStepStatus,
        message?: string,
        output?: any
      ) => Promise<void>,
      abortSignal?: AbortSignal
    ): Promise<{ created: number; updated: number; skipped: number; usage: OpenRouterUsage }> {
      const topic = await topicsService().takeNextForWorkflow(workflow.id, now);

      if (!topic) {
        return {
          created: 0,
          updated: 0,
          skipped: 1,
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        };
      }

      try {
        const targetDate = formatDateInZone(publishAt, config.timezone);
        const categoryId = resolveId(topic.article_category) ?? config.articleCategoryId;

        if (!categoryId) {
          throw new Error('Workflow article wymaga kategorii (workflow lub topic item).');
        }

        const context = {
          targetDate,
          period: 'Dzienny',
          type: 'Artykuł blogowy',
          signList: ZODIAC_SIGNS_PL.join(', '),
          locale: config.locale,
          category: String(categoryId),
          topicBrief: topic.brief ?? topic.title,
          topicTitle: topic.title,
        };

        const prompt = this.renderPrompt(config.promptTemplate, context);
        const schema =
          '{"title":"string","excerpt":"string","content":"string","premiumContent":"string wymagany","isPremium":true,"author":"string opcjonalny","read_time_minutes":"number opcjonalny","slug":"string opcjonalny"}';

        const workflowService = () => getPluginService<any>(strapi, 'workflows');
        const apiToken = await workflowService().decryptTokenForRuntime(workflow);
        const imageGenToken = await workflowService().decryptImageTokenForRuntime(workflow);

        const finalUsage = {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        };
        let payload: ArticlePayload | null = null;
        let lastQualityError: Error | null = null;

        for (let attempt = 1; attempt <= PREMIUM_CONTENT_RETRY_MAX; attempt += 1) {
          try {
            // KROK 1: Inicjowanie wizji redakcyjnej (Writer)
            await onStep?.(
              'article_draft',
              'running',
              `Inicjowanie wizji redakcyjnej i generowanie szkicu treści (${attempt}/${PREMIUM_CONTENT_RETRY_MAX})...`
            );
            const llmResponse = await llmService().requestJson({
              model: config.llmModel,
              apiToken,
              prompt,
              schemaDescription: schema,
              temperature: config.temperature,
              maxCompletionTokens: config.maxCompletionTokens,
              signal: abortSignal,
            });
            assertNotAborted(abortSignal);

            const draftPayload = this.validateArticlePayload(llmResponse.payload);
            finalUsage.prompt_tokens += llmResponse.usage.prompt_tokens;
            finalUsage.completion_tokens += llmResponse.usage.completion_tokens;
            finalUsage.total_tokens += llmResponse.usage.total_tokens;
            await onStep?.('article_draft', 'success', `Wygenerowano szkic: ${draftPayload.title}`);

            // KROK 2: Redakcja i optymalizacja (Editor)
            await onStep?.(
              'article_review',
              'running',
              'Analiza redakcyjna, optymalizacja stylu i korekta SEO...'
            );

            const editorPrompt = renderAicoPromptTemplate(
              getAicoPromptTemplate('articleQualityRepair'),
              {
                title: draftPayload.title,
                excerpt: draftPayload.excerpt,
                content: draftPayload.content,
                premiumContent: draftPayload.premiumContent ?? '',
                qualityIssues: lastQualityError?.message ?? 'initial_editor_pass',
              }
            );

            const editorResponse = await llmService().requestJson({
              model: config.llmModel,
              apiToken,
              prompt: editorPrompt,
              schemaDescription: schema,
              temperature: 0.5,
              signal: abortSignal,
            });
            assertNotAborted(abortSignal);

            const candidatePayload = this.validateArticlePayload(editorResponse.payload);
            finalUsage.prompt_tokens += editorResponse.usage.prompt_tokens;
            finalUsage.completion_tokens += editorResponse.usage.completion_tokens;
            finalUsage.total_tokens += editorResponse.usage.total_tokens;

            await onLlmTrace?.(editorResponse.trace, {
              label: `Article Polish #${topic.id} / ${topic.title}`,
              workflowType: config.workflowType,
            });

            const polishRepair = await this.ensurePolishContentQuality({
              payload: candidatePayload,
              kind: 'article',
              schemaDescription: schema,
              apiToken,
              llmModel: config.llmModel,
              workflowType: config.workflowType,
              label: `Article topic #${topic.id} / ${topic.title}`,
              validate: (candidate) => this.validateArticlePayload(candidate),
              maxCompletionTokens: config.maxCompletionTokens,
              abortSignal,
              onLlmTrace,
              onStep,
            });
            addUsage(finalUsage, polishRepair.usage);
            const polishedPayload = polishRepair.payload;

            assertPremiumContentQuality({
              label: `Article topic #${topic.id} / ${topic.title}`,
              content: polishedPayload.content,
              premiumContent: polishedPayload.premiumContent,
              kind: 'article',
            });

            polishedPayload.isPremium = true;
            payload = polishedPayload;
            lastQualityError = null;
            await onStep?.(
              'article_review',
              'success',
              'Treść została pomyślnie zredagowana, zoptymalizowana i przeszła kontrolę Premium.'
            );
            break;
          } catch (error) {
            if (abortSignal?.aborted) {
              throw error;
            }

            lastQualityError = error instanceof Error ? error : new Error(String(error));
            await onStep?.(
              'premium_quality',
              attempt >= PREMIUM_CONTENT_RETRY_MAX ? 'failed' : 'running',
              `Kontrola Premium nie przeszła próby ${attempt}/${PREMIUM_CONTENT_RETRY_MAX}: ${lastQualityError.message}`
            );

            if (lastQualityError.message.includes('quality_failed_polish_style')) {
              break;
            }
          }
        }

        if (!payload) {
          if (lastQualityError?.message.includes('quality_failed_polish_style')) {
            throw lastQualityError;
          }

          throw new Error(
            `quality_failed_final premiumContent after ${PREMIUM_CONTENT_RETRY_MAX} attempts: ${
              lastQualityError?.message ?? 'unknown quality error'
            }`
          );
        }

        const businessKey = `article:topic:${topic.id}:${targetDate}`;

        // KROK 3: Strategia wizualna i dobór mediów
        await onStep?.(
          'image_selection',
          'running',
          'Analiza kontekstowa treści i dobór idealnej oprawy wizualnej...'
        );
        const selectionResult = await mediaSelectorService().resolveForArticle({
          workflowType: 'article',
          contextKey: `topic-queue:${topic.id}`,
          now: new Date(),
          targetDate,
          title: payload.title,
          content: payload.content,
          categoryName: isRecord(topic.article_category)
            ? (topic.article_category as any).name
            : undefined,
          apiToken,
          llmModel: config.llmModel,
          imageGenModel: config.imageGenModel,
          imageGenToken,
          workflowId: workflow.id,
          onStep: onStep,
        });
        await onStep?.(
          'image_selection',
          'success',
          `Dopasowano asset: ${selectionResult.mediaAssetKey}`
        );

        // KROK 4: Finalizacja i rejestracja publikacji
        await onStep?.(
          'persistence',
          'running',
          'Finalizacja artykułu i planowanie publikacji w kalendarzu...'
        );
        const upsertResult = await this.upsertArticleDraft({
          workflow,
          config,
          payload,
          workflowType: 'article',
          publishAt,
          businessKey,
          explicitSlug: payload.slug,
          categoryId,
          imageAssetKey: selectionResult.mediaAssetKey,
          imageContextKey: `article:${workflow.id}:category:${categoryId}`,
          targetDate,
          title: payload.title,
          categoryName: isRecord(topic.article_category)
            ? (topic.article_category as any).name
            : undefined,
          onStep: onStep,
        });

        if (upsertResult.articleId) {
          await topicsService().markDone(topic.id, upsertResult.articleId);

          await onStep?.(
            'social_teaser',
            'running',
            'Generowanie zapowiedzi do mediów społecznościowych...'
          );
          await socialPublisherService().generateTeaser({
            workflowId: workflow.id,
            runId,
            contentUid: CONTENT_UIDS.article,
            contentId: upsertResult.articleId,
            contentTitle: payload.title,
            contentExcerpt: payload.excerpt,
            targetUrl: buildPublicFrontendUrl(`/artykuly/${payload.slug}`),
            publishAt,
          });
          await onStep?.('social_teaser', 'success', 'Zapowiedź social media gotowa.');
        }

        await onStep?.(
          'persistence',
          'success',
          `Artykuł gotowy do publikacji (${publishAt.toLocaleString()})`
        );

        return {
          created: upsertResult.created,
          updated: upsertResult.updated,
          skipped: upsertResult.skipped,
          usage: finalUsage,
        };
      } catch (error) {
        await topicsService().markFailed(topic.id, toSafeErrorMessage(error));
        throw error;
      }
    },

    async upsertHoroscope(input: {
      workflow: WorkflowRecord;
      config: NormalizedWorkflowConfig;
      signId: number;
      content: string;
      premiumContent?: string | null;
      targetDate: string;
      horoscopeType: string;
      businessKey: string;
      publishAt: Date;
    }): Promise<{ created: number; updated: number; skipped: number }> {
      const existingTicket = await this.findTicketByBusinessKey(input.businessKey);

      let existingId = existingTicket?.content_entry_id ?? null;

      if (!existingId) {
        const existing = (await entityService.findMany(CONTENT_UIDS.horoscope, {
          filters: {
            period: input.config.horoscopePeriod,
            type: input.horoscopeType,
            date: input.targetDate,
            zodiac_sign: input.signId,
          },
          limit: 1,
        })) as Array<{ id: number; publishedAt?: string | null }>;

        existingId = existing[0]?.id ?? null;
      }

      if (existingId) {
        const existingEntry = (await entityService.findOne(CONTENT_UIDS.horoscope, existingId)) as {
          id: number;
          publishedAt?: string | null;
        } | null;

        if (!existingEntry) {
          existingId = null;
        } else if (existingEntry.publishedAt && !input.config.forceRegenerate) {
          return { created: 0, updated: 0, skipped: 1 };
        } else {
          await entityService.update(CONTENT_UIDS.horoscope, existingId, {
            data: {
              period: input.config.horoscopePeriod,
              type: input.horoscopeType,
              date: input.targetDate,
              content: input.content,
              premiumContent: input.premiumContent ?? null,
              zodiac_sign: input.signId,
            },
          });

          if ((await this.shouldSchedulePublication(input.config)) && !existingEntry.publishedAt) {
            await this.upsertPublicationTicket({
              businessKey: input.businessKey,
              workflowId: input.workflow.id,
              contentUid: CONTENT_UIDS.horoscope,
              contentEntryId: existingId,
              targetPublishAt: input.publishAt,
            });
          }

          return { created: 0, updated: 1, skipped: 0 };
        }
      }

      const created = (await entityService.create(CONTENT_UIDS.horoscope, {
        data: {
          period: input.config.horoscopePeriod,
          type: input.horoscopeType,
          date: input.targetDate,
          content: input.content,
          premiumContent: input.premiumContent ?? null,
          zodiac_sign: input.signId,
        },
      })) as { id: number };

      if (await this.shouldSchedulePublication(input.config)) {
        await this.upsertPublicationTicket({
          businessKey: input.businessKey,
          workflowId: input.workflow.id,
          contentUid: CONTENT_UIDS.horoscope,
          contentEntryId: created.id,
          targetPublishAt: input.publishAt,
        });
      }

      return { created: 1, updated: 0, skipped: 0 };
    },

    async reconcileArticleImages(): Promise<{ updated: number }> {
      const articles = (await entityService.findMany(CONTENT_UIDS.article, {
        filters: {
          image: { $null: true },
        },
        populate: ['category'],
        limit: 50,
      })) as any[];

      if (articles.length === 0) return { updated: 0 };

      // Pobieramy token z dowolnego aktywnego workflow, aby mieć "paliwo" do generacji
      const workflows = await entityService.findMany(WORKFLOW_UID, {
        filters: { enabled: true },
        limit: 1,
      });
      const workflow = workflows[0];
      const apiToken = workflow ? await workflowsService().decryptTokenForRuntime(workflow) : null;
      const imageGenToken = workflow
        ? await workflowsService().decryptImageTokenForRuntime(workflow)
        : null;
      const config = workflow ? await workflowsService().normalizeRuntime(workflow) : null;

      let updatedCount = 0;

      for (const article of articles) {
        try {
          const selection = await mediaSelectorService().resolveForArticle({
            workflowType: 'article',
            contextKey: 'reconciliation',
            now: new Date(),
            title: article.title,
            categoryName: article.category?.name,
            apiToken,
            llmModel: config?.llmModel,
            imageGenModel: config?.imageGenModel,
            imageGenToken,
            workflowId: workflow?.id,
          });

          if (selection.uploadFileId) {
            await entityService.update(CONTENT_UIDS.article, article.id, {
              data: {
                image: selection.uploadFileId,
              },
            });

            await mediaSelectorService().registerUsage({
              mediaAssetId: selection.mediaAssetId,
              contentUid: CONTENT_UIDS.article,
              contentEntryId: article.id,
              contextKey: 'reconciliation',
            });

            updatedCount++;
          }
        } catch {
          // ignore failures
        }
      }

      return { updated: updatedCount };
    },

    async upsertArticleDraft(input: {
      workflow: WorkflowRecord;
      config: NormalizedWorkflowConfig;
      payload: ArticlePayload | DailyCardPayload;
      workflowType: 'article' | 'daily_card';
      publishAt: Date;
      businessKey: string;
      explicitSlug?: string;
      categoryId: number | null;
      imageAssetKey?: string | null;
      imageContextKey: string;
      targetDate: string;
      requiredSignSlug?: string | null;
      title?: string;
      categoryName?: string;
      onStep?: (
        stepId: string,
        status: 'running' | 'success' | 'failed',
        message?: string,
        output?: any
      ) => Promise<void>;
    }): Promise<{ created: number; updated: number; skipped: number; articleId?: number }> {
      if (!input.categoryId) {
        throw new Error('Brak kategorii artykułu.');
      }

      const existingTicket = await this.findTicketByBusinessKey(input.businessKey);
      let existingId = existingTicket?.content_entry_id ?? null;

      if (!existingId && input.explicitSlug) {
        const sameSlug = (await entityService.findMany(CONTENT_UIDS.article, {
          filters: {
            slug: slugify(input.explicitSlug),
          },
          limit: 1,
        })) as Array<{ id: number }>;

        existingId = sameSlug[0]?.id ?? null;
      }

      if (existingId) {
        const existing = (await entityService.findOne(CONTENT_UIDS.article, existingId)) as {
          id: number;
          publishedAt?: string | null;
        } | null;

        if (!existing) {
          existingId = null;
        } else if (existing.publishedAt && !input.config.forceRegenerate) {
          return { created: 0, updated: 0, skipped: 1, articleId: existing.id };
        } else {
          const workflowService = () => getPluginService<any>(strapi, 'workflows');
          const apiToken = await workflowService().decryptTokenForRuntime(input.workflow);
          const imageGenToken = await workflowService().decryptImageTokenForRuntime(input.workflow);

          const imageSelection = await mediaSelectorService().resolveForArticle({
            workflowType: input.workflowType,
            imageAssetKey: input.imageAssetKey,
            requiredSignSlug: input.requiredSignSlug ?? null,
            contextKey: input.imageContextKey,
            now: new Date(),
            targetDate: input.targetDate,
            title: input.title,
            categoryName: input.categoryName,
            apiToken,
            llmModel: input.config.llmModel,
            imageGenModel: input.config.imageGenModel,
            imageGenToken,
            workflowId: input.workflow.id,
            onStep: input.onStep,
          });

          const slug = await this.ensureUniqueArticleSlug(
            input.explicitSlug || input.payload.slug || slugify(input.payload.title),
            existing.id
          );
          const seoReport = await this.evaluateArticleSeo({
            payload: input.payload,
            slug,
            categoryId: input.categoryId,
            currentId: existing.id,
            config: input.config,
            onStep: input.onStep,
          });
          const canSchedulePublication =
            (await this.shouldSchedulePublication(input.config)) && seoReport.decision !== 'fail';

          await entityService.update(CONTENT_UIDS.article, existing.id, {
            data: {
              title: input.payload.title,
              excerpt: input.payload.excerpt,
              content: input.payload.content,
              premiumContent:
                'premiumContent' in input.payload ? (input.payload.premiumContent ?? null) : null,
              isPremium:
                'isPremium' in input.payload
                  ? Boolean(input.payload.isPremium)
                  : Boolean('premiumContent' in input.payload && input.payload.premiumContent),
              slug,
              category: input.categoryId,
              image: imageSelection.uploadFileId,
              author: input.payload.author ?? 'Zespół Star Sign',
              read_time_minutes:
                typeof input.payload.read_time_minutes === 'number'
                  ? Math.max(1, Math.min(60, Math.floor(input.payload.read_time_minutes)))
                  : 4,
            },
          });

          await mediaSelectorService().registerUsage({
            mediaAssetId: imageSelection.mediaAssetId,
            workflowId: input.workflow.id,
            contentUid: CONTENT_UIDS.article,
            contentEntryId: existing.id,
            contextKey: input.imageContextKey,
            targetDate: input.targetDate,
          });

          if (canSchedulePublication && !existing.publishedAt) {
            await this.upsertPublicationTicket({
              businessKey: input.businessKey,
              workflowId: input.workflow.id,
              contentUid: CONTENT_UIDS.article,
              contentEntryId: existing.id,
              targetPublishAt: input.publishAt,
            });
          }

          return { created: 0, updated: 1, skipped: 0, articleId: existing.id };
        }
      }

      const slug = await this.ensureUniqueArticleSlug(
        input.explicitSlug || input.payload.slug || slugify(input.payload.title)
      );
      const seoReport = await this.evaluateArticleSeo({
        payload: input.payload,
        slug,
        categoryId: input.categoryId,
        config: input.config,
        onStep: input.onStep,
      });
      const canSchedulePublication =
        (await this.shouldSchedulePublication(input.config)) && seoReport.decision !== 'fail';
      const workflowService = () => getPluginService<any>(strapi, 'workflows');
      const apiToken = await workflowService().decryptTokenForRuntime(input.workflow);
      const imageGenToken = await workflowService().decryptImageTokenForRuntime(input.workflow);

      const imageSelection = await mediaSelectorService().resolveForArticle({
        workflowType: input.workflowType,
        imageAssetKey: input.imageAssetKey,
        requiredSignSlug: input.requiredSignSlug ?? null,
        contextKey: input.imageContextKey,
        now: new Date(),
        targetDate: input.targetDate,
        title: input.title,
        categoryName: input.categoryName,
        apiToken,
        llmModel: input.config.llmModel,
        imageGenModel: input.config.imageGenModel,
        imageGenToken,
        workflowId: input.workflow.id,
        onStep: input.onStep,
      });

      const created = (await entityService.create(CONTENT_UIDS.article, {
        data: {
          title: input.payload.title,
          excerpt: input.payload.excerpt,
          content: input.payload.content,
          premiumContent:
            'premiumContent' in input.payload ? (input.payload.premiumContent ?? null) : null,
          isPremium:
            'isPremium' in input.payload
              ? Boolean(input.payload.isPremium)
              : Boolean('premiumContent' in input.payload && input.payload.premiumContent),
          slug,
          category: input.categoryId,
          image: imageSelection.uploadFileId,
          author: input.payload.author ?? 'Zespół Star Sign',
          read_time_minutes:
            typeof input.payload.read_time_minutes === 'number'
              ? Math.max(1, Math.min(60, Math.floor(input.payload.read_time_minutes)))
              : 4,
        },
      })) as { id: number };

      await mediaSelectorService().registerUsage({
        mediaAssetId: imageSelection.mediaAssetId,
        workflowId: input.workflow.id,
        contentUid: CONTENT_UIDS.article,
        contentEntryId: created.id,
        contextKey: input.imageContextKey,
        targetDate: input.targetDate,
      });

      if (canSchedulePublication) {
        await this.upsertPublicationTicket({
          businessKey: input.businessKey,
          workflowId: input.workflow.id,
          contentUid: CONTENT_UIDS.article,
          contentEntryId: created.id,
          targetPublishAt: input.publishAt,
        });
      }

      return { created: 1, updated: 0, skipped: 0, articleId: created.id };
    },

    async ensureUniqueArticleSlug(base: string, currentId?: number): Promise<string> {
      const normalizedBase = slugify(base);

      const isAvailable = async (slug: string): Promise<boolean> => {
        const existing = (await entityService.findMany(CONTENT_UIDS.article, {
          filters: { slug },
          limit: 1,
        })) as Array<{ id: number }>;

        if (!existing[0]) {
          return true;
        }

        return Boolean(currentId && existing[0].id === currentId);
      };

      if (await isAvailable(normalizedBase)) {
        return normalizedBase;
      }

      for (let i = 2; i < 500; i += 1) {
        const candidate = `${normalizedBase}-${i}`;
        if (await isAvailable(candidate)) {
          return candidate;
        }
      }

      return `${normalizedBase}-${Date.now()}`;
    },

    async upsertDailyDraw(targetDate: string, cardId: number, message: string): Promise<void> {
      const existing = (await entityService.findMany(CONTENT_UIDS.dailyTarotDraw, {
        filters: {
          draw_date: targetDate,
        },
        limit: 1,
      })) as Array<{ id: number }>;

      if (existing[0]) {
        await entityService.update(CONTENT_UIDS.dailyTarotDraw, existing[0].id, {
          data: {
            draw_date: targetDate,
            card: cardId,
            message,
          },
        });

        return;
      }

      await entityService.create(CONTENT_UIDS.dailyTarotDraw, {
        data: {
          draw_date: targetDate,
          card: cardId,
          message,
        },
      });
    },

    async upsertPublicationTicket(input: {
      businessKey: string;
      workflowId: number;
      contentUid: string;
      contentEntryId: number;
      targetPublishAt: Date;
    }): Promise<void> {
      const existing = await this.findTicketByBusinessKey(input.businessKey);

      if (existing) {
        await entityService.update(PUBLICATION_TICKET_UID, existing.id, {
          data: {
            workflow: input.workflowId,
            content_uid: input.contentUid,
            content_entry_id: input.contentEntryId,
            target_publish_at: input.targetPublishAt,
            status: TICKET_STATUS.scheduled,
            last_error: null,
          },
        });

        return;
      }

      await entityService.create(PUBLICATION_TICKET_UID, {
        data: {
          workflow: input.workflowId,
          business_key: input.businessKey,
          content_uid: input.contentUid,
          content_entry_id: input.contentEntryId,
          target_publish_at: input.targetPublishAt,
          status: TICKET_STATUS.scheduled,
          retries: 0,
        },
      });
    },

    async findTicketByBusinessKey(businessKey: string): Promise<PublicationTicketRecord | null> {
      const rows = (await entityService.findMany(PUBLICATION_TICKET_UID, {
        filters: {
          business_key: businessKey,
        },
        limit: 1,
      })) as PublicationTicketRecord[];

      return rows[0] ?? null;
    },

    resolveHoroscopeDateAnchor(
      period: NormalizedWorkflowConfig['horoscopePeriod'],
      publishAt: Date,
      timezone: string
    ): string {
      if (period === 'Dzienny') {
        return formatDateInZone(publishAt, timezone);
      }

      if (period === 'Tygodniowy') {
        return getIsoWeekStartDateString(publishAt, timezone);
      }

      return getMonthStartDateString(publishAt, timezone);
    },

    renderPrompt(template: string, context: Record<string, string>): string {
      return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => {
        return context[key] ?? '';
      });
    },

    validateHoroscopePayload(payload: unknown, fallbackType: string): HoroscopePayload {
      if (!isRecord(payload) || !Array.isArray(payload.items)) {
        throw new Error('Horoscope payload musi mieć format { items: [...] }.');
      }

      const items = payload.items
        .map((item) => {
          if (!isRecord(item)) {
            return null;
          }

          const sign = getString(item.sign, 'items[].sign');
          const content = getString(item.content, 'items[].content');
          const premiumContent = getString(item.premiumContent, 'items[].premiumContent');
          const type = getOptionalString(item.type) ?? fallbackType;

          return {
            sign,
            content,
            premiumContent,
            type,
          };
        })
        .filter(
          (
            item
          ): item is {
            sign: string;
            content: string;
            premiumContent: string;
            type: string;
          } => item !== null
        );

      if (items.length === 0) {
        throw new Error('Horoscope payload nie zawiera elementów.');
      }

      return { items };
    },

    validateArticlePayload(payload: unknown): ArticlePayload {
      if (!isRecord(payload)) {
        throw new Error('Article payload musi być obiektem JSON.');
      }

      return {
        title: getString(payload.title, 'title'),
        excerpt: getString(payload.excerpt, 'excerpt'),
        content: getString(payload.content, 'content'),
        premiumContent: getString(payload.premiumContent, 'premiumContent'),
        isPremium: payload.isPremium === true || payload.isPremium === 'true',
        slug: getOptionalString(payload.slug),
        author: getOptionalString(payload.author),
        read_time_minutes:
          typeof payload.read_time_minutes === 'number'
            ? Math.max(1, Math.min(60, Math.floor(payload.read_time_minutes)))
            : undefined,
      };
    },

    validateDailyCardPayload(payload: unknown): DailyCardPayload {
      if (!isRecord(payload)) {
        throw new Error('Daily card payload musi być obiektem JSON.');
      }

      return {
        title: getString(payload.title, 'title'),
        excerpt: getString(payload.excerpt, 'excerpt'),
        content: getString(payload.content, 'content'),
        premiumContent: getString(payload.premiumContent, 'premiumContent'),
        isPremium: payload.isPremium === true || payload.isPremium === 'true',
        draw_message: getString(payload.draw_message, 'draw_message'),
        slug: getOptionalString(payload.slug),
      };
    },

    async fetchZodiacSigns(): Promise<
      Array<{ id: number; name: string; slug: string; image?: any }>
    > {
      const rows = (await entityService.findMany(CONTENT_UIDS.zodiacSign, {
        fields: ['id', 'name', 'slug'],
        populate: ['image'],
        sort: { id: 'asc' },
        limit: 100,
      })) as Array<{ id: number; name: string; slug: string; image?: any }>;

      await this.reconcileZodiacSignImages(rows);

      return rows;
    },

    async reconcileZodiacSignImages(
      signs: Array<{ id: number; slug: string; image?: any }>
    ): Promise<void> {
      for (const sign of signs) {
        if (!sign.image) {
          const selection = await mediaSelectorService().resolveForZodiacSign({
            signSlug: sign.slug,
          });
          if (selection) {
            await entityService.update(CONTENT_UIDS.zodiacSign, sign.id, {
              data: {
                image: selection.uploadFileId,
              },
            });
            // Update local object to reflect change in current run
            sign.image = { id: selection.uploadFileId };
          }
        }
      }
    },

    async fetchTarotCards(): Promise<
      Array<{
        id: number;
        name: string;
        arcana?: string | null;
        description?: string | null;
        meaning_upright?: string | null;
        meaning_reversed?: string | null;
      }>
    > {
      const rows = (await entityService.findMany(CONTENT_UIDS.tarotCard, {
        fields: ['id', 'name', 'arcana', 'description', 'meaning_upright', 'meaning_reversed'],
        limit: 200,
        sort: { id: 'asc' },
      })) as Array<{
        id: number;
        name: string;
        arcana?: string | null;
        description?: string | null;
        meaning_upright?: string | null;
        meaning_reversed?: string | null;
      }>;

      return rows;
    },

    getPublishDateForLocalDay(cronExpression: string, localDate: string, timezone: string): Date {
      const { year, month, day } = parseDateString(localDate);
      const localNoonUtc = Date.UTC(year, month - 1, day, 12, 0, 0);
      const start = new Date(localNoonUtc - 48 * 60 * 60 * 1000);
      const end = new Date(localNoonUtc + 48 * 60 * 60 * 1000);

      const interval = parser.parseExpression(cronExpression, {
        currentDate: start,
        endDate: end,
        tz: timezone,
      });

      try {
        for (let i = 0; i < 100; i += 1) {
          const candidate = interval.next().toDate();
          if (formatDateInZone(candidate, timezone) === localDate) {
            return candidate;
          }
        }
      } catch {
        // Fall through to the clearer domain error below.
      }

      throw new Error(
        `Cron publish nie ma wystąpienia dla lokalnej daty ${localDate} (${timezone}).`
      );
    },
  };

  return api;
};

export default orchestrator;
