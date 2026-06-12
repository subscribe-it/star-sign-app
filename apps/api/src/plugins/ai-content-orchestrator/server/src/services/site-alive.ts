import {
  CONTENT_PERFORMANCE_SNAPSHOT_UID,
  CONTENT_UIDS,
  HOMEPAGE_RECOMMENDATION_UID,
} from '../constants';
import type {
  ContentPerformanceSnapshotRecord,
  HomepageRecommendationRecord,
  PublicHomepageRecommendation,
  Strapi,
} from '../types';
import { getEntityService } from '../utils/entity-service';

type RunRecommendationsInput = {
  ttlHours?: number;
  limit?: number;
};

type ArticleRecord = {
  id: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  premiumContent?: string | null;
  updatedAt?: string | null;
  publishedAt?: string | null;
};

const SLOTS: HomepageRecommendationRecord['slot'][] = [
  'today_in_stars',
  'weekly_focus',
  'recommended_for_you',
  'new_premium',
  'evergreen',
];

const toArticleUrl = (slug?: string | null): string | null => {
  if (!slug) {
    return null;
  }

  return `/artykuly/${slug}`;
};

const getSlotTitle = (
  slot: HomepageRecommendationRecord['slot'],
  article?: Pick<ArticleRecord, 'title'>
): string => {
  if (article?.title) {
    return article.title;
  }

  const fallback: Record<HomepageRecommendationRecord['slot'], string> = {
    today_in_stars: 'Dzisiaj w gwiazdach',
    weekly_focus: 'Najmocniejszy temat tygodnia',
    recommended_for_you: 'Polecane dla Ciebie',
    new_premium: 'Nowe premium',
    evergreen: 'Warto wrócić do tego tematu',
  };

  return fallback[slot];
};

const toPublicHomepageRecommendation = (
  recommendation: HomepageRecommendationRecord
): PublicHomepageRecommendation => ({
  slot: recommendation.slot,
  title: recommendation.title,
  subtitle: recommendation.subtitle ?? null,
  target_url: recommendation.target_url ?? null,
  content_slug: recommendation.content_slug ?? null,
  priority_score: recommendation.priority_score ?? null,
  starts_at: recommendation.starts_at ?? null,
  expires_at: recommendation.expires_at ?? null,
});

const siteAlive = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  return {
    async list(input?: {
      status?: HomepageRecommendationRecord['status'];
      limit?: number;
    }): Promise<HomepageRecommendationRecord[]> {
      const filters: Record<string, unknown> = {};
      if (input?.status) {
        filters.status = input.status;
      }

      return entityService.findMany<HomepageRecommendationRecord>(HOMEPAGE_RECOMMENDATION_UID, {
        filters,
        sort: [{ priority_score: 'desc' }, { starts_at: 'desc' }, { id: 'desc' }],
        populate: ['workflow', 'source_snapshot'],
        limit: Math.max(1, Math.min(100, Number(input?.limit ?? 20))),
      });
    },

    async listPublic(input?: {
      status?: HomepageRecommendationRecord['status'];
      limit?: number;
      now?: Date;
    }): Promise<PublicHomepageRecommendation[]> {
      const filters: Record<string, unknown> = {};
      if (input?.status) {
        filters.status = input.status;
      }
      const nowIso = (input?.now ?? new Date()).toISOString();
      filters.$and = [
        {
          $or: [{ starts_at: { $null: true } }, { starts_at: { $lte: nowIso } }],
        },
        {
          $or: [{ expires_at: { $null: true } }, { expires_at: { $gte: nowIso } }],
        },
      ];

      const recommendations = await entityService.findMany<HomepageRecommendationRecord>(
        HOMEPAGE_RECOMMENDATION_UID,
        {
          filters,
          fields: [
            'slot',
            'title',
            'subtitle',
            'target_url',
            'content_slug',
            'priority_score',
            'starts_at',
            'expires_at',
          ],
          sort: [{ priority_score: 'desc' }, { starts_at: 'desc' }, { id: 'desc' }],
          limit: Math.max(1, Math.min(24, Number(input?.limit ?? 12))),
        }
      );

      return recommendations.map(toPublicHomepageRecommendation);
    },

    async runRecommendations(input: RunRecommendationsInput = {}): Promise<{
      created: number;
      expired: number;
      recommendations: HomepageRecommendationRecord[];
    }> {
      const now = new Date();
      const ttlHours = Math.max(1, Math.min(168, Number(input.ttlHours ?? 48)));
      const limit = Math.max(1, Math.min(20, Number(input.limit ?? SLOTS.length)));
      const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
      const expired = await this.expireOldRecommendations(now);
      const sourceItems = await this.resolveSourceItems(limit);
      const recommendations: HomepageRecommendationRecord[] = [];

      for (let index = 0; index < Math.min(limit, SLOTS.length); index += 1) {
        const slot = SLOTS[index];
        const source = sourceItems[index % Math.max(1, sourceItems.length)];
        const article = source?.article ?? null;
        const snapshot = source?.snapshot ?? null;

        await this.archiveActiveSlot(slot);

        const recommendation = await entityService.create<HomepageRecommendationRecord>(
          HOMEPAGE_RECOMMENDATION_UID,
          {
            data: {
              slot,
              title: getSlotTitle(slot, article ?? undefined),
              subtitle:
                article?.excerpt ||
                (snapshot?.content_title
                  ? `Treść z wynikiem ${Math.round(Number(snapshot.score ?? 0))}.`
                  : 'Automatycznie wybrany blok redakcyjny Star Sign.'),
              target_url: toArticleUrl(article?.slug ?? snapshot?.content_slug),
              content_uid: article ? CONTENT_UIDS.article : snapshot?.content_uid ?? null,
              content_entry_id: article?.id ?? snapshot?.content_entry_id ?? null,
              content_slug: article?.slug ?? snapshot?.content_slug ?? null,
              priority_score: Math.max(1, Math.round(Number(snapshot?.score ?? 50) - index * 5)),
              starts_at: now,
              expires_at: expiresAt,
              status: 'active',
              rationale: snapshot
                ? 'Site Alive Agent wybrał treść na podstawie snapshotu performance.'
                : 'Site Alive Agent użył fallbacku z najnowszych artykułów.',
              metadata: {
                source: snapshot ? 'performance_snapshot' : 'latest_article',
                ttlHours,
              },
              source_snapshot: snapshot?.id ?? null,
            },
            populate: ['source_snapshot'],
          }
        );

        recommendations.push(recommendation);
      }

      return {
        created: recommendations.length,
        expired,
        recommendations,
      };
    },

    async expireOldRecommendations(now: Date): Promise<number> {
      const rows = await entityService.findMany<HomepageRecommendationRecord>(
        HOMEPAGE_RECOMMENDATION_UID,
        {
          filters: {
            status: 'active',
            expires_at: {
              $lte: now.toISOString(),
            },
          },
          fields: ['id'],
          limit: 100,
        }
      );

      for (const row of rows) {
        await entityService.update(HOMEPAGE_RECOMMENDATION_UID, row.id, {
          data: {
            status: 'expired',
          },
        });
      }

      return rows.length;
    },

    async archiveActiveSlot(slot: HomepageRecommendationRecord['slot']): Promise<void> {
      const active = await entityService.findMany<HomepageRecommendationRecord>(
        HOMEPAGE_RECOMMENDATION_UID,
        {
          filters: {
            slot,
            status: 'active',
          },
          fields: ['id'],
          limit: 20,
        }
      );

      for (const row of active) {
        await entityService.update(HOMEPAGE_RECOMMENDATION_UID, row.id, {
          data: {
            status: 'archived',
          },
        });
      }
    },

    async resolveSourceItems(limit: number): Promise<
      Array<{
        snapshot?: ContentPerformanceSnapshotRecord | null;
        article?: ArticleRecord | null;
      }>
    > {
      const snapshots = await entityService.findMany<ContentPerformanceSnapshotRecord>(
        CONTENT_PERFORMANCE_SNAPSHOT_UID,
        {
          filters: {
            content_uid: CONTENT_UIDS.article,
          },
          sort: [{ score: 'desc' }, { snapshot_day: 'desc' }],
          limit,
        }
      );

      const items: Array<{
        snapshot?: ContentPerformanceSnapshotRecord | null;
        article?: ArticleRecord | null;
      }> = [];

      for (const snapshot of snapshots) {
        const article = snapshot.content_entry_id
          ? await this.findArticle(snapshot.content_entry_id)
          : null;
        items.push({ snapshot, article });
      }

      if (items.length >= limit) {
        return items;
      }

      const articles = await entityService.findMany<ArticleRecord>(CONTENT_UIDS.article, {
        fields: ['id', 'title', 'slug', 'excerpt', 'premiumContent', 'updatedAt', 'publishedAt'],
        sort: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        limit,
      });

      for (const article of articles) {
        if (items.some((item) => item.article?.id === article.id)) {
          continue;
        }
        items.push({ article });
        if (items.length >= limit) {
          break;
        }
      }

      if (items.length === 0) {
        items.push({});
      }

      return items;
    },

    async findArticle(id: number): Promise<ArticleRecord | null> {
      try {
        return await entityService.findOne<ArticleRecord>(CONTENT_UIDS.article, id, {
          fields: ['id', 'title', 'slug', 'excerpt', 'premiumContent', 'updatedAt', 'publishedAt'],
        });
      } catch {
        strapi.log.warn(`[aico] Nie udało się pobrać artykułu #${id} dla homepage recommendations.`);
        return null;
      }
    },
  };
};

export default siteAlive;
