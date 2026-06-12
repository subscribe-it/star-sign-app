import { GROWTH_EXPERIMENT_UID } from '../constants';
import type { GrowthExperimentRecord, Strapi } from '../types';
import { getEntityService } from '../utils/entity-service';

const experimentAgent = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  return {
    async list(input: { status?: string; limit?: number } = {}): Promise<GrowthExperimentRecord[]> {
      const filters: Record<string, unknown> = {};
      if (input.status) filters.status = input.status;

      return entityService.findMany<GrowthExperimentRecord>(GROWTH_EXPERIMENT_UID, {
        filters,
        sort: [{ updatedAt: 'desc' }],
        populate: ['workflow'],
        limit: Math.max(1, Math.min(200, Number(input.limit ?? 50))),
      });
    },

    async chooseWinner(id: number, winnerVariantKey: string): Promise<GrowthExperimentRecord> {
      return entityService.update<GrowthExperimentRecord>(GROWTH_EXPERIMENT_UID, id, {
        data: {
          status: 'completed',
          ended_at: new Date().toISOString(),
          winner_variant_key: winnerVariantKey,
          decision: {
            chosenBy: 'experiment-agent',
            reason: 'manual_or_policy_decision',
          },
        },
      });
    },
  };
};

export default experimentAgent;
