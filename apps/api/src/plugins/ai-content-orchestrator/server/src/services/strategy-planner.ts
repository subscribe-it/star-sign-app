import {
  CONTENT_PLAN_ITEM_UID,
  CONTENT_UIDS,
  DEFAULT_TIMEZONE,
  EDITORIAL_MEMORY_UID,
  TOPIC_QUEUE_UID,
  WORKFLOW_UID,
} from '../constants';
import type {
  ContentPlanItemRecord,
  EditorialMemoryRecord,
  Strapi,
  TopicQueueItemRecord,
  WorkflowRecord,
} from '../types';
import { addDaysToDateString, formatDateInZone } from '../utils/date-time';
import { getEntityService } from '../utils/entity-service';
import { isRecord } from '../utils/json';
import { getPluginService } from '../utils/plugin';
import { slugify } from '../utils/slug';

type GeneratePlanInput = {
  weekStart?: string;
  limit?: number;
  workflowId?: number;
  autoApprove?: boolean;
  trigger?: string;
};

type ApprovePlanInput = {
  ids?: number[];
  limit?: number;
};

type RunAutopilotInput = {
  now?: Date;
  workflowId?: number;
};

type StrategyAutopilotPolicy = {
  enabled: boolean;
  minTopicBacklog: number;
  maxPlanItemsPerTick: number;
  autoApprovePlan: boolean;
};

type StrategyAutopilotWorkflowResult = {
  workflowId: number;
  backlog: number;
  generated: number;
  queued: number;
  skipped: number;
  reason: 'queued' | 'planned_only' | 'backlog_healthy' | 'policy_disabled' | 'no_candidates';
  policy: StrategyAutopilotPolicy;
};

type CategoryRecord = {
  id: number;
  name: string;
  slug?: string | null;
};

type TopicsService = {
  create: (payload: Record<string, unknown>) => Promise<TopicQueueItemRecord>;
};

type PerformanceHintSnapshot = {
  content_title?: string | null;
  content_slug?: string | null;
};

export type InsightBias = {
  trendingTitles: string[];
  underperforming: string[];
  bestHours: number[];
};

export const EMPTY_INSIGHT_BIAS: InsightBias = {
  trendingTitles: [],
  underperforming: [],
  bestHours: [],
};

const toStringArray = (value: unknown, field: 'title' | 'key'): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) =>
      isRecord(entry) ? String(entry[field] ?? entry.title ?? '').trim() : String(entry ?? '').trim()
    )
    .filter(Boolean);
};

const toHourArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => Number(entry))
    .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23);
};

const getId = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return value;
  }

  if (isRecord(value) && typeof value.id === 'number') {
    return value.id;
  }

  return null;
};

const toIsoDateTime = (dateString: string, hour = 8): string => {
  return new Date(`${dateString}T${String(hour).padStart(2, '0')}:00:00.000Z`).toISOString();
};

const clampLimit = (value: unknown): number => {
  const parsed = Number(value ?? 7);
  if (!Number.isFinite(parsed)) {
    return 7;
  }
  return Math.max(1, Math.min(30, Math.floor(parsed)));
};

const readPositiveInteger = (value: unknown, fallback: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(parsed)));
};

const readBoolean = (value: unknown, fallback: boolean): boolean => {
  return typeof value === 'boolean' ? value : fallback;
};

const strategyPlanner = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  return {
    async listPlan(input?: { status?: string; limit?: number }): Promise<ContentPlanItemRecord[]> {
      const filters: Record<string, unknown> = {};
      if (input?.status) {
        filters.status = input.status;
      }

      return entityService.findMany<ContentPlanItemRecord>(CONTENT_PLAN_ITEM_UID, {
        filters,
        sort: [{ target_publish_at: 'asc' }, { priority_score: 'desc' }, { id: 'asc' }],
        populate: ['workflow', 'article_category', 'generated_topic'],
        limit: Math.max(1, Math.min(200, Number(input?.limit ?? 100))),
      });
    },

    async generatePlan(input: GeneratePlanInput = {}): Promise<{
      created: number;
      skipped: number;
      items: ContentPlanItemRecord[];
      weekStart: string;
    }> {
      const now = new Date();
      const weekStart = input.weekStart || formatDateInZone(now, DEFAULT_TIMEZONE);
      const limit = clampLimit(input.limit);

      const workflows = await this.resolveArticleWorkflows(input.workflowId);
      const categories = await this.resolveCategories();
      const existingKeys = await this.resolveExistingDedupeKeys();
      const performanceHints = await this.resolvePerformanceHints();
      const insightBias = await this.resolveInsightBias(now);

      const candidates = this.buildCandidates({
        workflows,
        categories,
        weekStart,
        limit,
        performanceHints,
        insightBias,
        trigger: input.trigger,
      });

      const created: ContentPlanItemRecord[] = [];
      let skipped = 0;

      for (const candidate of candidates) {
        if (created.length >= limit) {
          break;
        }

        if (existingKeys.has(candidate.dedupe_key)) {
          skipped += 1;
          continue;
        }

        const record = await entityService.create<ContentPlanItemRecord>(CONTENT_PLAN_ITEM_UID, {
          data: {
            ...candidate,
            status: input.autoApprove ? 'approved' : 'planned',
          },
          populate: ['workflow', 'article_category'],
        });

        existingKeys.add(candidate.dedupe_key);
        created.push(record);
      }

      return {
        created: created.length,
        skipped,
        items: created,
        weekStart,
      };
    },

    async approvePlan(input: ApprovePlanInput = {}): Promise<{
      queued: number;
      skipped: number;
      topics: TopicQueueItemRecord[];
    }> {
      const ids = Array.isArray(input.ids) ? input.ids.filter((id) => Number.isFinite(id)) : [];
      const filters =
        ids.length > 0
          ? { id: { $in: ids } }
          : {
              status: {
                $in: ['planned', 'approved'],
              },
            };

      const items = await entityService.findMany<ContentPlanItemRecord>(CONTENT_PLAN_ITEM_UID, {
        filters,
        sort: [{ priority_score: 'desc' }, { target_publish_at: 'asc' }, { id: 'asc' }],
        populate: ['workflow', 'article_category', 'generated_topic'],
        limit: Math.max(1, Math.min(100, Number(input.limit ?? 30))),
      });

      const topicsService = getPluginService<TopicsService>(strapi, 'topics');
      const topics: TopicQueueItemRecord[] = [];
      let skipped = 0;

      for (const item of items) {
        if (getId(item.generated_topic)) {
          skipped += 1;
          continue;
        }

        const duplicateTopic = await this.findDuplicateTopic(item.title);
        if (duplicateTopic) {
          await entityService.update(CONTENT_PLAN_ITEM_UID, item.id, {
            data: {
              status: 'queued',
              generated_topic: duplicateTopic.id,
            },
          });
          topics.push(duplicateTopic);
          skipped += 1;
          continue;
        }

        const topic = (await topicsService.create({
          title: item.title,
          brief: item.brief ?? item.agent_rationale ?? '',
          scheduled_for: item.target_publish_at ?? undefined,
          workflow: getId(item.workflow) ?? undefined,
          article_category: getId(item.article_category) ?? undefined,
          seo_intent: item.seo_intent ?? undefined,
          target_persona: item.target_persona ?? undefined,
          priority_score: item.priority_score ?? 50,
          plan_item: item.id,
          metadata: {
            source: 'strategy_agent',
            planItemId: item.id,
            seoCluster: item.seo_cluster,
            channels: item.channels ?? [],
            trigger: isRecord(item.metadata) ? item.metadata.trigger : undefined,
            strategyMetadata: item.metadata ?? null,
          },
        })) as TopicQueueItemRecord;

        await entityService.update(CONTENT_PLAN_ITEM_UID, item.id, {
          data: {
            status: 'queued',
            generated_topic: topic.id,
          },
        });

        topics.push(topic);
      }

      return {
        queued: topics.length,
        skipped,
        topics,
      };
    },

    async resolveArticleWorkflows(workflowId?: number): Promise<WorkflowRecord[]> {
      const filters: Record<string, unknown> = {
        workflow_type: 'article',
      };

      if (workflowId) {
        filters.id = workflowId;
      } else {
        filters.$or = [{ strategy_enabled: true }, { enabled: true }];
      }

      const workflows = await entityService.findMany<WorkflowRecord>(WORKFLOW_UID, {
        filters,
        populate: ['article_category'],
        sort: [{ strategy_enabled: 'desc' }, { id: 'asc' }],
        limit: 20,
      });

      return workflows;
    },

    async resolveStrategyWorkflows(workflowId?: number): Promise<WorkflowRecord[]> {
      const filters: Record<string, unknown> = {
        workflow_type: 'article',
        enabled: true,
        strategy_enabled: true,
      };

      if (workflowId) {
        filters.id = workflowId;
      }

      return entityService.findMany<WorkflowRecord>(WORKFLOW_UID, {
        filters,
        populate: ['article_category'],
        sort: [{ id: 'asc' }],
        limit: 20,
      });
    },

    async resolveCategories(): Promise<CategoryRecord[]> {
      const categories = await entityService.findMany<CategoryRecord>(CONTENT_UIDS.category, {
        fields: ['id', 'name', 'slug'],
        sort: { name: 'asc' },
        limit: 100,
      });

      return categories.length > 0 ? categories : [{ id: 0, name: 'Astrologia', slug: 'astrologia' }];
    },

    async resolveExistingDedupeKeys(): Promise<Set<string>> {
      const [plans, topics] = await Promise.all([
        entityService.findMany<ContentPlanItemRecord>(CONTENT_PLAN_ITEM_UID, {
          fields: ['dedupe_key', 'title'],
          limit: 1000,
        }),
        entityService.findMany<TopicQueueItemRecord>(TOPIC_QUEUE_UID, {
          fields: ['title'],
          limit: 1000,
        }),
      ]);

      const keys = new Set<string>();
      for (const plan of plans) {
        if (plan.dedupe_key) {
          keys.add(plan.dedupe_key);
        }
        keys.add(slugify(plan.title));
      }
      for (const topic of topics) {
        keys.add(slugify(topic.title));
      }

      return keys;
    },

    /**
     * Czyta świeże insighty z editorial-memory (zapisane przez insights-engine)
     * i zamienia je na deterministyczny "bias" planowania treści.
     * Brak insightów = pusty bias = dotychczasowe zachowanie planera.
     */
    async resolveInsightBias(now: Date = new Date()): Promise<InsightBias> {
      try {
        const rows = await entityService.findMany<EditorialMemoryRecord>(EDITORIAL_MEMORY_UID, {
          filters: { key: 'insight:performance', active: true },
          limit: 1,
        });

        const memory = rows[0];
        const metadata = memory && isRecord(memory.metadata) ? memory.metadata : null;
        if (!metadata || metadata.kind !== 'performance_insight') {
          return EMPTY_INSIGHT_BIAS;
        }

        // Brak lub nieparsowalne validUntil = traktuj insight jako przeterminowany.
        const validUntil = new Date(String(metadata.validUntil ?? ''));
        if (!Number.isFinite(validUntil.getTime()) || validUntil.getTime() < now.getTime()) {
          return EMPTY_INSIGHT_BIAS;
        }

        return {
          trendingTitles: toStringArray(metadata.trendingTopics, 'title'),
          underperforming: toStringArray(metadata.bottomContent, 'title'),
          bestHours: toHourArray(metadata.bestPublishHours),
        };
      } catch {
        return EMPTY_INSIGHT_BIAS;
      }
    },

    async resolvePerformanceHints(): Promise<string[]> {
      const snapshots = await entityService.findMany<PerformanceHintSnapshot>(
        'plugin::ai-content-orchestrator.content-performance-snapshot',
        {
          sort: [{ score: 'desc' }, { snapshot_day: 'desc' }],
          limit: 5,
        }
      );

      return snapshots
        .map((snapshot) => String(snapshot.content_title ?? snapshot.content_slug ?? '').trim())
        .filter(Boolean);
    },

    buildCandidates(input: {
      workflows: WorkflowRecord[];
      categories: CategoryRecord[];
      weekStart: string;
      limit: number;
      performanceHints: string[];
      insightBias?: InsightBias;
      trigger?: string;
    }): Array<Record<string, unknown> & { dedupe_key: string }> {
      const workflows = input.workflows.length > 0 ? input.workflows : [null];
      const categoryPool = input.categories.length > 0 ? input.categories : [{ id: 0, name: 'Astrologia' }];
      const candidates: Array<Record<string, unknown> & { dedupe_key: string }> = [];
      const bias = input.insightBias ?? EMPTY_INSIGHT_BIAS;
      const underperforming = new Set(bias.underperforming.map((value) => slugify(value)));

      // Tematy rosnące mają pierwszeństwo przed zwykłymi hintami;
      // hinty pokrywające się z najsłabszymi treściami są pomijane.
      const hintPool = [
        ...bias.trendingTitles,
        ...input.performanceHints.filter((hint) => !underperforming.has(slugify(hint))),
      ].filter((hint, index, all) => all.indexOf(hint) === index);

      for (let index = 0; index < input.limit * 2; index += 1) {
        const workflow = workflows[index % workflows.length];
        const category = categoryPool[index % categoryPool.length];
        const hint = hintPool[index % Math.max(1, hintPool.length)];
        const isTrendingHint = Boolean(hint && bias.trendingTitles.includes(hint));
        const day = addDaysToDateString(input.weekStart, index);
        const publishHour =
          bias.bestHours.length > 0 ? bias.bestHours[index % bias.bestHours.length] : 8;
        const cluster = workflow?.content_cluster || slugify(category.name || 'astrologia');
        const title = hint
          ? `Co dalej po temacie: ${hint}`
          : `${category.name}: astrologiczny przewodnik na ${day}`;
        const dedupeKey = slugify(`${cluster}:${title}`);

        candidates.push({
          title,
          brief: [
            `Przygotuj praktyczny artykuł SEO dla Star Sign na dzień ${day}.`,
            `Uwzględnij kontekst premium open access i zachęć do dalszego odkrywania treści.`,
            hint ? `Inspiracja z wyników: ${hint}.` : '',
          ]
            .filter(Boolean)
            .join(' '),
          seo_intent: 'informational',
          seo_cluster: cluster,
          priority_score: Math.min(100, Math.max(30, 90 - index * 3) + (isTrendingHint ? 10 : 0)),
          target_persona: 'czytelnik astrologii i rozwoju osobistego',
          target_publish_at: toIsoDateTime(day, publishHour),
          channels: ['facebook', 'instagram', 'twitter'],
          agent_rationale: isTrendingHint
            ? 'Plan podąża za rosnącym tematem z insightów performance (insights-engine).'
            : hint
              ? 'Plan bazuje na treści z dobrym wynikiem i tworzy naturalną kontynuację.'
              : 'Plan uzupełnia regularny kalendarz SEO/blog dla Star Sign.',
          source: hint ? 'performance_feedback' : 'strategy_agent',
          dedupe_key: dedupeKey,
          metadata: {
            weekStart: input.weekStart,
            categoryName: category.name,
            performanceHint: hint || null,
            insightTrendingHint: isTrendingHint,
            insightPublishHour: bias.bestHours.length > 0 ? publishHour : null,
            trigger: input.trigger ?? 'manual',
          },
          workflow: workflow?.id ?? null,
          article_category: category.id || getId(workflow?.article_category) || null,
        });
      }

      return candidates;
    },

    async findDuplicateTopic(title: string): Promise<TopicQueueItemRecord | null> {
      const rows = await entityService.findMany<TopicQueueItemRecord>(TOPIC_QUEUE_UID, {
        filters: {
          title,
        },
        limit: 1,
      });

      return rows[0] ?? null;
    },

    resolveAutopilotPolicy(workflow: WorkflowRecord): StrategyAutopilotPolicy {
      const guardrails = isRecord(workflow.auto_publish_guardrails)
        ? workflow.auto_publish_guardrails
        : {};
      const strategyGuardrails = isRecord(guardrails.strategy) ? guardrails.strategy : guardrails;

      return {
        enabled:
          readBoolean(strategyGuardrails.enabled, true) &&
          readBoolean(strategyGuardrails.autopilot_enabled, true),
        minTopicBacklog: readPositiveInteger(
          strategyGuardrails.min_topic_backlog ?? strategyGuardrails.minTopicBacklog,
          3,
          30
        ),
        maxPlanItemsPerTick: readPositiveInteger(
          strategyGuardrails.max_plan_items_per_tick ?? strategyGuardrails.maxPlanItemsPerTick,
          2,
          10
        ),
        autoApprovePlan: readBoolean(
          strategyGuardrails.auto_approve_plan ?? strategyGuardrails.autoApprovePlan,
          false
        ),
      };
    },

    async countTopicBacklog(workflow: WorkflowRecord, policy: StrategyAutopilotPolicy): Promise<number> {
      const includeUnassigned = workflow.topic_mode !== 'manual';
      const rows = await entityService.findMany<TopicQueueItemRecord>(TOPIC_QUEUE_UID, {
        filters: {
          status: {
            $in: ['pending', 'processing'],
          },
          ...(includeUnassigned
            ? {
                $or: [{ workflow: workflow.id }, { workflow: { $null: true } }],
              }
            : { workflow: workflow.id }),
        },
        fields: ['id'],
        limit: Math.max(policy.minTopicBacklog, policy.maxPlanItemsPerTick),
      });

      return rows.length;
    },

    async countPlanBacklog(workflow: WorkflowRecord, policy: StrategyAutopilotPolicy): Promise<number> {
      const rows = await entityService.findMany<ContentPlanItemRecord>(CONTENT_PLAN_ITEM_UID, {
        filters: {
          workflow: workflow.id,
          status: {
            $in: ['planned', 'approved', 'queued'],
          },
        },
        fields: ['id'],
        limit: Math.max(policy.minTopicBacklog, policy.maxPlanItemsPerTick),
      });

      return rows.length;
    },

    async runAutopilot(input: RunAutopilotInput = {}): Promise<{
      workflows: number;
      generated: number;
      queued: number;
      skipped: number;
      details: StrategyAutopilotWorkflowResult[];
    }> {
      const now = input.now ?? new Date();
      const workflows = await this.resolveStrategyWorkflows(input.workflowId);
      const details: StrategyAutopilotWorkflowResult[] = [];
      let generated = 0;
      let queued = 0;
      let skipped = 0;

      for (const workflow of workflows) {
        const policy = this.resolveAutopilotPolicy(workflow);
        const topicBacklog = await this.countTopicBacklog(workflow, policy);
        const planBacklog = await this.countPlanBacklog(workflow, policy);
        const backlog = topicBacklog + planBacklog;

        if (!policy.enabled) {
          details.push({
            workflowId: workflow.id,
            backlog,
            generated: 0,
            queued: 0,
            skipped: 0,
            reason: 'policy_disabled',
            policy,
          });
          continue;
        }

        if (backlog >= policy.minTopicBacklog) {
          details.push({
            workflowId: workflow.id,
            backlog,
            generated: 0,
            queued: 0,
            skipped: 0,
            reason: 'backlog_healthy',
            policy,
          });
          continue;
        }

        const limit = Math.min(policy.maxPlanItemsPerTick, policy.minTopicBacklog - backlog);
        const plan = await this.generatePlan({
          weekStart: formatDateInZone(now, DEFAULT_TIMEZONE),
          limit,
          workflowId: workflow.id,
          autoApprove: policy.autoApprovePlan,
          trigger: 'strategy_autopilot',
        });

        let queuedForWorkflow = 0;
        let skippedForWorkflow = plan.skipped;

        if (policy.autoApprovePlan && plan.items.length > 0) {
          const approved = await this.approvePlan({
            ids: plan.items.map((item) => item.id),
            limit,
          });
          queuedForWorkflow = approved.queued;
          skippedForWorkflow += approved.skipped;
        }

        generated += plan.created;
        queued += queuedForWorkflow;
        skipped += skippedForWorkflow;
        details.push({
          workflowId: workflow.id,
          backlog,
          generated: plan.created,
          queued: queuedForWorkflow,
          skipped: skippedForWorkflow,
          reason:
            queuedForWorkflow > 0
              ? 'queued'
              : plan.created > 0
                ? 'planned_only'
                : 'no_candidates',
          policy,
        });
      }

      return {
        workflows: workflows.length,
        generated,
        queued,
        skipped,
        details,
      };
    },
  };
};

export default strategyPlanner;
