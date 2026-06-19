import { TOPIC_QUEUE_UID, TOPIC_STATUS, WORKFLOW_UID } from '../constants';
import type { Strapi, TopicQueueItemRecord } from '../types';
import { getEntityService } from '../utils/entity-service';

type TopicCreatePayload = {
  title: string;
  brief?: string;
  image_asset_key?: string;
  scheduled_for?: string;
  workflow?: number;
  article_category?: number;
  editor_persona?: number | null;
  seo_intent?: string;
  target_persona?: string;
  priority_score?: number;
  plan_item?: number;
  metadata?: Record<string, unknown>;
};

type TopicUpdatePayload = Partial<TopicCreatePayload> & {
  status?: TopicQueueItemRecord['status'];
  error_message?: string;
};

const getId = (value: unknown): number | null => {
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

const topics = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);
  const mediaAssetsService = () => strapi.plugin('ai-content-orchestrator').service('media-assets');

  const getWorkflowType = async (workflowId: number | null): Promise<string | null> => {
    if (!workflowId) {
      return null;
    }

    const workflow = (await entityService.findOne(WORKFLOW_UID, workflowId, {
      fields: ['workflow_type'],
    })) as { workflow_type?: string } | null;

    return workflow?.workflow_type ?? null;
  };

  const validateArticleImageAsset = async (imageAssetKey: string | null): Promise<void> => {
    if (!imageAssetKey?.trim()) {
      return;
    }

    await mediaAssetsService().getActiveLinkedByAssetKey(imageAssetKey.trim());
  };

  return {
    async list(): Promise<TopicQueueItemRecord[]> {
      return (await entityService.findMany(TOPIC_QUEUE_UID, {
        sort: [{ status: 'asc' }, { createdAt: 'asc' }],
        populate: ['workflow', 'article_category', 'editor_persona', 'generated_article'],
      })) as TopicQueueItemRecord[];
    },

    async create(payload: TopicCreatePayload): Promise<TopicQueueItemRecord> {
      if (!payload.title?.trim()) {
        throw new Error('Temat musi mieć tytuł.');
      }

      const workflowType = await getWorkflowType(payload.workflow ?? null);
      const imageAssetKey = payload.image_asset_key?.trim() || null;

      if (workflowType === 'article') {
        await validateArticleImageAsset(imageAssetKey);
      }

      const created = (await entityService.create(TOPIC_QUEUE_UID, {
        data: {
          title: payload.title.trim(),
          brief: payload.brief?.trim(),
          image_asset_key: imageAssetKey,
          seo_intent: payload.seo_intent?.trim() || null,
          target_persona: payload.target_persona?.trim() || null,
          priority_score:
            typeof payload.priority_score === 'number'
              ? Math.max(0, Math.min(100, Math.floor(payload.priority_score)))
              : 50,
          scheduled_for: payload.scheduled_for,
          workflow: payload.workflow,
          article_category: payload.article_category,
          editor_persona: payload.editor_persona ?? null,
          plan_item: payload.plan_item,
          metadata: payload.metadata ?? {},
          status: TOPIC_STATUS.pending,
        },
        populate: ['workflow', 'article_category', 'editor_persona', 'generated_article'],
      })) as TopicQueueItemRecord;

      return created;
    },

    async update(id: number, payload: TopicUpdatePayload): Promise<TopicQueueItemRecord> {
      const current = (await entityService.findOne(TOPIC_QUEUE_UID, id, {
        populate: ['workflow'],
      })) as TopicQueueItemRecord | null;

      if (!current) {
        throw new Error(`Nie znaleziono tematu #${id}.`);
      }

      const workflowId =
        typeof payload.workflow !== 'undefined'
          ? (payload.workflow ?? null)
          : getId(current.workflow);
      const workflowType = await getWorkflowType(workflowId);
      const finalImageAssetKey =
        typeof payload.image_asset_key !== 'undefined'
          ? payload.image_asset_key?.trim() || null
          : current.image_asset_key?.trim() || null;

      if (workflowType === 'article') {
        await validateArticleImageAsset(finalImageAssetKey);
      }

      const data: Record<string, unknown> = {};

      if (typeof payload.title !== 'undefined') {
        if (!payload.title.trim()) {
          throw new Error('Temat musi mieć tytuł.');
        }
        data.title = payload.title.trim();
      }

      if (typeof payload.brief !== 'undefined') {
        data.brief = payload.brief?.trim() ?? null;
      }

      if (typeof payload.image_asset_key !== 'undefined') {
        data.image_asset_key = finalImageAssetKey;
      }

      if (typeof payload.scheduled_for !== 'undefined') {
        data.scheduled_for = payload.scheduled_for;
      }

      if (typeof payload.seo_intent !== 'undefined') {
        data.seo_intent = payload.seo_intent?.trim() || null;
      }

      if (typeof payload.target_persona !== 'undefined') {
        data.target_persona = payload.target_persona?.trim() || null;
      }

      if (typeof payload.priority_score !== 'undefined') {
        data.priority_score =
          typeof payload.priority_score === 'number'
            ? Math.max(0, Math.min(100, Math.floor(payload.priority_score)))
            : null;
      }

      if (typeof payload.workflow !== 'undefined') {
        data.workflow = payload.workflow;
      }

      if (typeof payload.article_category !== 'undefined') {
        data.article_category = payload.article_category;
      }

      if (typeof payload.editor_persona !== 'undefined') {
        data.editor_persona = payload.editor_persona ?? null;
      }

      if (typeof payload.plan_item !== 'undefined') {
        data.plan_item = payload.plan_item;
      }

      if (typeof payload.metadata !== 'undefined') {
        data.metadata = payload.metadata;
      }

      if (typeof payload.status !== 'undefined') {
        data.status = payload.status;
      }

      if (typeof payload.error_message !== 'undefined') {
        data.error_message = payload.error_message;
      }

      const updated = (await entityService.update(TOPIC_QUEUE_UID, id, {
        data,
        populate: ['workflow', 'article_category', 'editor_persona', 'generated_article'],
      })) as TopicQueueItemRecord;

      return updated;
    },

    async takeNextForWorkflow(workflowId: number, now: Date): Promise<TopicQueueItemRecord | null> {
      const workflow = (await entityService.findOne(WORKFLOW_UID, workflowId, {
        fields: ['topic_mode'],
      })) as { topic_mode?: 'manual' | 'mixed' } | null;
      const includeUnassigned = workflow?.topic_mode !== 'manual';

      const candidates = (await entityService.findMany(TOPIC_QUEUE_UID, {
        filters: {
          status: TOPIC_STATUS.pending,
          ...(includeUnassigned
            ? {
                $or: [{ workflow: workflowId }, { workflow: { $null: true } }],
              }
            : { workflow: workflowId }),
        },
        sort: [{ scheduled_for: 'asc' }, { createdAt: 'asc' }],
        populate: ['workflow', 'article_category', 'editor_persona'],
        limit: 20,
      })) as TopicQueueItemRecord[];

      const next = candidates.find((item) => {
        if (!item.scheduled_for) {
          return true;
        }

        return new Date(item.scheduled_for).getTime() <= now.getTime();
      });

      if (!next) {
        return null;
      }

      await entityService.update(TOPIC_QUEUE_UID, next.id, {
        data: {
          status: TOPIC_STATUS.processing,
          workflow: getId(next.workflow) ?? workflowId,
        },
      });

      const fresh = (await entityService.findOne(TOPIC_QUEUE_UID, next.id, {
        populate: ['workflow', 'article_category', 'editor_persona'],
      })) as TopicQueueItemRecord;

      return fresh;
    },

    async markDone(id: number, articleId: number): Promise<void> {
      await entityService.update(TOPIC_QUEUE_UID, id, {
        data: {
          status: TOPIC_STATUS.done,
          processed_at: new Date(),
          generated_article: articleId,
          error_message: null,
        },
      });
    },

    async markFailed(id: number, errorMessage: string): Promise<void> {
      await entityService.update(TOPIC_QUEUE_UID, id, {
        data: {
          status: TOPIC_STATUS.failed,
          processed_at: new Date(),
          error_message: errorMessage,
        },
      });
    },

    serialize(item: TopicQueueItemRecord): Record<string, unknown> {
      return {
        ...item,
        workflow: getId(item.workflow),
        article_category: getId(item.article_category),
        editor_persona: getId(item.editor_persona),
        generated_article: getId(item.generated_article),
        plan_item: getId(item.plan_item),
      };
    },
  };
};

export default topics;
