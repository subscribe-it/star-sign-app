import {
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
  AutonomyPolicyRecord,
  RunLogRecord,
  Strapi,
  UsageDailyRecord,
} from '../types';
import { formatDateInZone } from '../utils/date-time';
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

  return {
    getTodayUsageSummary,

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
      };
    },
  };
};

export default dashboard;
