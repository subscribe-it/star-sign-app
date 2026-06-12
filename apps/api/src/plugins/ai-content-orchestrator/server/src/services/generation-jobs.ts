import { GENERATION_JOB_UID } from '../constants';
import type { GenerationJobRecord, GenerationJobType, Strapi } from '../types';
import { getEntityService } from '../utils/entity-service';

type ListJobsInput = {
  status?: string;
  jobType?: string;
  limit?: number;
};

type CreateJobInput = {
  jobType: GenerationJobType;
  inputSummary?: Record<string, unknown>;
  workflowId?: number;
  priorityScore?: number;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

const generationJobs = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  return {
    async list(input: ListJobsInput = {}): Promise<GenerationJobRecord[]> {
      const filters: Record<string, unknown> = {};
      if (input.status) filters.status = input.status;
      if (input.jobType) filters.job_type = input.jobType;

      return entityService.findMany<GenerationJobRecord>(GENERATION_JOB_UID, {
        filters,
        sort: [{ priority_score: 'desc' }, { createdAt: 'asc' }],
        populate: ['workflow', 'plan_item', 'source_run'],
        limit: Math.max(1, Math.min(200, Number(input.limit ?? 50))),
      });
    },

    async create(input: CreateJobInput): Promise<GenerationJobRecord> {
      if (input.idempotencyKey) {
        const existing = await entityService.findMany<GenerationJobRecord>(GENERATION_JOB_UID, {
          filters: { idempotency_key: input.idempotencyKey },
          limit: 1,
        });

        if (existing[0]) {
          return existing[0];
        }
      }

      return entityService.create<GenerationJobRecord>(GENERATION_JOB_UID, {
        data: {
          job_type: input.jobType,
          status: 'queued',
          priority_score: input.priorityScore ?? 0,
          input_summary: input.inputSummary ?? {},
          workflow: input.workflowId,
          idempotency_key: input.idempotencyKey,
          metadata: input.metadata ?? {},
        },
      });
    },

    async retry(id: number): Promise<GenerationJobRecord> {
      return entityService.update<GenerationJobRecord>(GENERATION_JOB_UID, id, {
        data: {
          status: 'queued',
          blocked_reason: null,
          last_error: null,
        },
      });
    },

    async cancel(id: number): Promise<GenerationJobRecord> {
      return entityService.update<GenerationJobRecord>(GENERATION_JOB_UID, id, {
        data: {
          status: 'canceled',
          finished_at: new Date().toISOString(),
        },
      });
    },
  };
};

export default generationJobs;
