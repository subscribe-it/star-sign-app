import {
  CONTENT_PERFORMANCE_SNAPSHOT_UID,
  CONTENT_UIDS,
  RUN_LOG_UID,
  SOCIAL_POST_TICKET_UID,
} from '../constants';
import type { ContentPerformanceSnapshotRecord, Strapi } from '../types';
import { formatDateInZone } from '../utils/date-time';
import { getEntityService } from '../utils/entity-service';

type AnalyticsEventRecord = {
  id: number;
  event_type: string;
  content_id?: string | null;
  content_slug?: string | null;
  content_type?: string | null;
};

type ArticleRecord = {
  id: number;
  title: string;
  slug: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
};

type RunLogFeedbackRecord = {
  id: number;
  status?: string | null;
  details?: Record<string, unknown> | null;
};

type SocialTicketPerformanceRecord = {
  id: number;
  status?: string | null;
  related_content_id?: number | null;
};

type AggregateInput = {
  day?: string;
  limit?: number;
};

type EventStats = {
  views: number;
  premiumEvents: number;
  ctaClicks: number;
  checkoutEvents: number;
  newsletterSignups: number;
};

const toDateRange = (day: string): { start: string; end: string } => {
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

const scoreSnapshot = (input: {
  views: number;
  premiumEvents: number;
  ctaClicks: number;
  checkoutEvents: number;
  socialPublished: number;
  socialFailed: number;
  freshnessDays: number;
}): number => {
  const raw =
    input.views +
    input.premiumEvents * 2 +
    input.ctaClicks * 5 +
    input.checkoutEvents * 8 +
    input.socialPublished * 6 -
    input.socialFailed * 8 -
    Math.min(20, Math.max(0, input.freshnessDays - 30) / 3);

  return Math.max(0, Math.round(raw * 100) / 100);
};

const performanceFeedback = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  return {
    async list(input?: { limit?: number }): Promise<ContentPerformanceSnapshotRecord[]> {
      return entityService.findMany<ContentPerformanceSnapshotRecord>(
        CONTENT_PERFORMANCE_SNAPSHOT_UID,
        {
          sort: [{ snapshot_day: 'desc' }, { score: 'desc' }],
          limit: Math.max(1, Math.min(500, Number(input?.limit ?? 100))),
        }
      );
    },

    async aggregate(input: AggregateInput = {}): Promise<{
      day: string;
      processed: number;
      snapshots: ContentPerformanceSnapshotRecord[];
    }> {
      const day = input.day || formatDateInZone(new Date(), 'UTC');
      const limit = Math.max(1, Math.min(500, Number(input.limit ?? 100)));
      const range = toDateRange(day);

      const [articles, events, socialTickets, runLogs] = await Promise.all([
        entityService.findMany<ArticleRecord>(CONTENT_UIDS.article, {
          fields: ['id', 'title', 'slug', 'publishedAt', 'updatedAt'],
          sort: { updatedAt: 'desc' },
          limit,
        }),
        entityService.findMany<AnalyticsEventRecord>(CONTENT_UIDS.analyticsEvent, {
          filters: {
            occurred_at: {
              $gte: range.start,
              $lt: range.end,
            },
          },
          fields: ['id', 'event_type', 'content_id', 'content_slug', 'content_type'],
          limit: 5000,
        }),
        entityService.findMany<SocialTicketPerformanceRecord>(SOCIAL_POST_TICKET_UID, {
          filters: {
            related_content_uid: CONTENT_UIDS.article,
          },
          fields: ['id', 'status', 'related_content_id'],
          limit: 5000,
        }),
        entityService.findMany<RunLogFeedbackRecord>(RUN_LOG_UID, {
          filters: {
            started_at: {
              $gte: range.start,
              $lt: range.end,
            },
          },
          fields: ['id', 'status', 'details'],
          limit: 1000,
        }),
      ]);

      const eventMap = this.aggregateEvents(events);
      const socialMap = this.aggregateSocial(socialTickets);
      const runLogSummary = this.summarizeRunLogs(runLogs);
      const snapshots: ContentPerformanceSnapshotRecord[] = [];

      for (const article of articles) {
        const key = `${CONTENT_UIDS.article}:${article.id}:${day}`;
        const eventsForArticle =
          eventMap.get(String(article.id)) ?? eventMap.get(article.slug) ?? this.emptyEventStats();
        const socialForArticle = socialMap.get(article.id) ?? { published: 0, failed: 0 };
        const freshnessDays = this.computeFreshnessDays(article.publishedAt ?? article.updatedAt);
        const score = scoreSnapshot({
          views: eventsForArticle.views,
          premiumEvents: eventsForArticle.premiumEvents,
          ctaClicks: eventsForArticle.ctaClicks,
          checkoutEvents: eventsForArticle.checkoutEvents,
          socialPublished: socialForArticle.published,
          socialFailed: socialForArticle.failed,
          freshnessDays,
        });

        const data = {
          unique_key: key,
          snapshot_day: day,
          content_uid: CONTENT_UIDS.article,
          content_entry_id: article.id,
          content_slug: article.slug,
          content_title: article.title,
          views: eventsForArticle.views,
          premium_events: eventsForArticle.premiumEvents,
          cta_clicks: eventsForArticle.ctaClicks,
          checkout_events: eventsForArticle.checkoutEvents,
          // Best-effort: 0 dopóki inline CTA + per-content 'newsletter_signup'
          // event nie wylądują (patrz komentarz w aggregateEvents). Zapis pola
          // jest dodatkowy i wstecznie kompatybilny.
          newsletter_events: eventsForArticle.newsletterSignups,
          social_published: socialForArticle.published,
          social_failed: socialForArticle.failed,
          freshness_days: freshnessDays,
          score,
          recommendations: this.buildRecommendations({
            score,
            views: eventsForArticle.views,
            ctaClicks: eventsForArticle.ctaClicks,
            socialFailed: socialForArticle.failed,
            freshnessDays,
          }),
          metadata: {
            source: 'performance-feedback',
            range,
            runLogSummary,
          },
        };

        const existing = await this.findByUniqueKey(key);
        const snapshot = existing
          ? await entityService.update<ContentPerformanceSnapshotRecord>(
              CONTENT_PERFORMANCE_SNAPSHOT_UID,
              existing.id,
              { data }
            )
          : await entityService.create<ContentPerformanceSnapshotRecord>(
              CONTENT_PERFORMANCE_SNAPSHOT_UID,
              { data }
            );

        snapshots.push(snapshot);
      }

      return {
        day,
        processed: snapshots.length,
        snapshots,
      };
    },

    aggregateEvents(events: AnalyticsEventRecord[]): Map<string, EventStats> {
      const map = new Map<string, EventStats>();

      for (const event of events) {
        const keys = [event.content_id, event.content_slug].filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0
        );

        for (const key of keys) {
          const current = map.get(key) ?? this.emptyEventStats();

          if (
            event.event_type === 'view_item' ||
            event.event_type === 'premium_content_view' ||
            event.event_type === 'premium_content_impression'
          ) {
            current.views += 1;
          }

          if (
            event.event_type === 'premium_content_view' ||
            event.event_type === 'premium_content_impression'
          ) {
            current.premiumEvents += 1;
          }

          if (event.event_type === 'premium_cta_click') {
            current.ctaClicks += 1;
          }

          if (event.event_type === 'begin_checkout' || event.event_type === 'checkout_redirect') {
            current.checkoutEvents += 1;
          }

          // Newsletter sign-up to jedyny żywy kanał konwersji dopóki Premium jest
          // w trybie 'open', dlatego liczymy go jako pełnoprawną metrykę, którą
          // autopilot może optymalizować (experiment-agent -> 'newsletter_events').
          //
          // GAP ATRYBUCJI: dziś enum analytics-event.event_type NIE zawiera
          // 'newsletter_signup', a frontend (poza zakresem) wysyła ten event bez
          // przypięcia content_id/content_slug artykułu. Dopóki inline CTA w
          // artykule + per-content event nie wylądują, ta gałąź realnie zlicza 0
          // (best-effort, brak fałszywych dodatnich). Gdy event zacznie nieść
          // atrybucję contentu, wpadnie tu automatycznie bez kolejnej zmiany.
          if (event.event_type === 'newsletter_signup') {
            current.newsletterSignups += 1;
          }

          map.set(key, current);
        }
      }

      return map;
    },

    aggregateSocial(
      tickets: Array<{ status?: string; related_content_id?: number | null }>
    ): Map<number, { published: number; failed: number }> {
      const map = new Map<number, { published: number; failed: number }>();

      for (const ticket of tickets) {
        if (!ticket.related_content_id) {
          continue;
        }

        const current = map.get(ticket.related_content_id) ?? { published: 0, failed: 0 };
        if (ticket.status === 'published') {
          current.published += 1;
        }
        if (ticket.status === 'failed') {
          current.failed += 1;
        }
        map.set(ticket.related_content_id, current);
      }

      return map;
    },

    summarizeRunLogs(runLogs: RunLogFeedbackRecord[]): Record<string, unknown> {
      let failed = 0;
      let blockedBudget = 0;
      let seoGuardrailFailures = 0;
      let qualityFailures = 0;

      for (const runLog of runLogs) {
        if (runLog.status === 'failed') {
          failed += 1;
        }
        if (runLog.status === 'blocked_budget') {
          blockedBudget += 1;
        }

        const details = runLog.details ?? {};
        const steps = Array.isArray(details.steps) ? details.steps : [];
        for (const step of steps) {
          if (!step || typeof step !== 'object') {
            continue;
          }
          const id = String((step as { id?: unknown }).id ?? '');
          const status = String((step as { status?: unknown }).status ?? '');
          if (id === 'seo_guardrails' && status === 'failed') {
            seoGuardrailFailures += 1;
          }
          if (id === 'premium_quality' && status === 'failed') {
            qualityFailures += 1;
          }
        }
      }

      return {
        total: runLogs.length,
        failed,
        blockedBudget,
        seoGuardrailFailures,
        qualityFailures,
      };
    },

    emptyEventStats(): EventStats {
      return {
        views: 0,
        premiumEvents: 0,
        ctaClicks: 0,
        checkoutEvents: 0,
        newsletterSignups: 0,
      };
    },

    computeFreshnessDays(value?: string | null): number {
      if (!value) {
        return 999;
      }

      const timestamp = new Date(value).getTime();
      if (!Number.isFinite(timestamp)) {
        return 999;
      }

      return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
    },

    buildRecommendations(input: {
      score: number;
      views: number;
      ctaClicks: number;
      socialFailed: number;
      freshnessDays: number;
    }): Record<string, unknown> {
      const actions: string[] = [];

      if (input.score >= 20) {
        actions.push('promote_on_homepage');
      }
      if (input.views > 0 && input.ctaClicks === 0) {
        actions.push('improve_premium_cta');
      }
      if (input.socialFailed > 0) {
        actions.push('retry_or_rewrite_social');
      }
      if (input.freshnessDays > 60) {
        actions.push('refresh_content');
      }

      return {
        actions,
        summary:
          actions.length > 0
            ? 'Snapshot wskazuje konkretne działania wzrostowe.'
            : 'Brak pilnych działań.',
      };
    },

    async findByUniqueKey(key: string): Promise<ContentPerformanceSnapshotRecord | null> {
      const rows = await entityService.findMany<ContentPerformanceSnapshotRecord>(
        CONTENT_PERFORMANCE_SNAPSHOT_UID,
        {
          filters: { unique_key: key },
          limit: 1,
        }
      );

      return rows[0] ?? null;
    },
  };
};

export default performanceFeedback;
