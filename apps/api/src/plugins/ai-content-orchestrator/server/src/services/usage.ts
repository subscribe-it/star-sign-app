import { RUN_STATUS, USAGE_DAILY_UID } from '../constants';
import type { OpenRouterUsage, Strapi, UsageDailyRecord } from '../types';
import { getEntityService } from '../utils/entity-service';

type BudgetCheckInput = {
  workflowId: number;
  day: string;
  requestLimit: number;
  tokenLimit: number;
};

const usage = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  return {
    async getOrCreate(workflowId: number, day: string): Promise<UsageDailyRecord> {
      const key = `${workflowId}:${day}`;

      const existing = (await entityService.findMany(USAGE_DAILY_UID, {
        filters: { unique_key: key },
        limit: 1,
      })) as UsageDailyRecord[];

      if (existing[0]) {
        return existing[0];
      }

      const created = (await entityService.create(USAGE_DAILY_UID, {
        data: {
          day,
          unique_key: key,
          // workflowId <= 0 oznacza zużycie "systemowe" (np. insights) bez relacji do workflowu.
          ...(workflowId > 0 ? { workflow: workflowId } : {}),
          status: 'ok',
          request_count: 0,
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      })) as UsageDailyRecord;

      return created;
    },

    async assertBudget(
      input: BudgetCheckInput
    ): Promise<{ blocked: boolean; usage: UsageDailyRecord }> {
      const usageRecord = await this.getOrCreate(input.workflowId, input.day);

      const requestCount = Number(usageRecord.request_count ?? 0);
      const totalTokens = Number(usageRecord.total_tokens ?? 0);

      const blocked = requestCount >= input.requestLimit || totalTokens >= input.tokenLimit;

      if (blocked && usageRecord.status !== RUN_STATUS.blockedBudget) {
        await entityService.update(USAGE_DAILY_UID, usageRecord.id, {
          data: {
            status: RUN_STATUS.blockedBudget,
          },
        });

        usageRecord.status = RUN_STATUS.blockedBudget;
      }

      return {
        blocked,
        usage: usageRecord,
      };
    },

    async registerUsage(
      workflowId: number,
      day: string,
      usageStats: OpenRouterUsage
    ): Promise<UsageDailyRecord> {
      const usageRecord = await this.getOrCreate(workflowId, day);

      const updated = (await entityService.update(USAGE_DAILY_UID, usageRecord.id, {
        data: {
          status: 'ok',
          request_count: Number(usageRecord.request_count ?? 0) + 1,
          prompt_tokens:
            Number(usageRecord.prompt_tokens ?? 0) + Number(usageStats.prompt_tokens ?? 0),
          completion_tokens:
            Number(usageRecord.completion_tokens ?? 0) + Number(usageStats.completion_tokens ?? 0),
          total_tokens:
            Number(usageRecord.total_tokens ?? 0) + Number(usageStats.total_tokens ?? 0),
        },
      })) as UsageDailyRecord;

      return updated;
    },
  };
};

export default usage;
