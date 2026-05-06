import { describe, expect, it, vi } from 'vitest';

import {
  PLUGIN_ID,
  PUBLICATION_TICKET_UID,
  RUN_LOG_UID,
  RUN_STATUS,
  TOPIC_QUEUE_UID,
  WORKFLOW_UID,
  HOROSCOPE_PERIODS,
  CONTENT_PLAN_ITEM_UID,
  CONTENT_PERFORMANCE_SNAPSHOT_UID,
  CONTENT_UIDS,
  SOCIAL_POST_TICKET_UID,
  AUDIT_EVENT_UID,
  RUNTIME_LOCK_UID,
} from '../constants';
import orchestrator from '../services/orchestrator';
import auditTrail from '../services/audit-trail';
import performanceFeedback from '../services/performance-feedback';
import runtimeLocks from '../services/runtime-locks';
import runsService from '../services/runs';
import mediaAssets from '../services/media-assets';
import seoGuardrails from '../services/seo-guardrails';
import siteAlive from '../services/site-alive';
import socialPublisher from '../services/social-publisher';
import strategyPlanner from '../services/strategy-planner';
import topics from '../services/topics';
import workflows from '../services/workflows';
import audit from '../services/audit';
import dashboard from '../services/dashboard';
import type { Strapi } from '../types';
import socialPostTicketSchema from '../content-types/social-post-ticket/schema.json';
import { formatDateInZone } from '../utils/date-time';
import {
  redactProviderPayload,
  sanitizeLlmTraceForStorage,
} from '../utils/diagnostic-redaction';
import { suggestMediaMapping } from '../utils/media-mapping';
import { PREMIUM_CONTENT_RETRY_MAX } from '../utils/premium-quality';
import { getAicoPromptTemplate } from '../utils/aico-contract';
import { evaluatePolishContentQuality } from '../utils/polish-content-quality';
import { slugify } from '../utils/slug';
import adminRoutesFactory from '../routes/admin';
import settingsController from '../controllers/settings';
import topicsController from '../controllers/topics';
import strategyController from '../controllers/strategy';
import mediaAssetsController from '../controllers/media-assets';
import runsController from '../controllers/runs';
import homepageController from '../controllers/homepage';
import openRouter from '../services/open-router';
import bootstrap, { resolveEditorRolePermissionActions, syncEditorRolePermissions } from '../bootstrap';

const createStrapi = (
  services: Record<string, unknown>,
  entityService: Record<string, unknown>
): Strapi =>
  ({
    entityService,
    plugin: (id: string) => {
      if (id !== PLUGIN_ID) {
        throw new Error(`Unexpected plugin ${id}`);
      }

      return {
        service: (name: string) => services[name],
      };
    },
    log: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  }) as unknown as Strapi;

const llmUsage = () => ({
  prompt_tokens: 10,
  completion_tokens: 20,
  total_tokens: 30,
});

const rawLlmTrace = () => ({
  id: 'trace-1',
  label: 'Article generation',
  workflowType: 'article',
  createdAt: '2026-05-05T10:00:00.000Z',
  request: {
    model: 'openai/test',
    temperature: 0.4,
    maxCompletionTokens: 1200,
    prompt: 'secret prompt with sk-test-secret',
    schemaDescription: 'secret schema',
    messages: [
      { role: 'system', content: 'system secret prompt' },
      { role: 'user', content: 'user secret prompt' },
    ],
  },
  response: {
    content: '{"premiumContent":"raw response secret"}',
    payload: { premiumContent: 'raw parsed secret' },
    usage: llmUsage(),
  },
});

const createCtx = (input: {
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
} = {}) =>
  ({
    request: { body: input.body ?? {}, headers: {} },
    params: input.params ?? {},
    query: input.query ?? {},
    state: { user: { id: 42 } },
    ip: '203.0.113.10',
    get: vi.fn(() => ''),
    badRequest: vi.fn(),
  }) as any;

describe('ai-content-orchestrator runtime', () => {
  it('uses the shared AICO contract for yearly horoscope and helper prompts', () => {
    expect(HOROSCOPE_PERIODS).toContain('Roczny');
    expect(getAicoPromptTemplate('socialTeaser')).toContain('valid JSON');
    expect(getAicoPromptTemplate('imageDesigner')).toContain('valid JSON');
  });

  it('requires Polish style rules in user-facing AICO prompts', () => {
    for (const key of [
      'dailyHoroscope',
      'periodicHoroscope',
      'dailyCard',
      'article',
      'articleQualityRepair',
      'socialTeaser',
    ]) {
      const prompt = getAicoPromptTemplate(key);

      expect(prompt).toContain('JAKOŚĆ POLSZCZYZNY');
      expect(prompt).toMatch(/ortograf|składni|interpunkc/i);
      expect(prompt).toMatch(/naturaln|ludz/i);
      expect(prompt).toMatch(/myślnik|półpauz|pauz/i);
    }

    const repairPrompt = getAicoPromptTemplate('polishStyleRepair');
    expect(repairPrompt).toContain('valid JSON');
    expect(repairPrompt).toContain('Zachowaj wszystkie klucze JSON');
  });

  it('detects Polish prose quality issues only in user-facing fields', () => {
    const report = evaluatePolishContentQuality({
      kind: 'article',
      payload: {
        title: 'Tytuł - z problemem',
        excerpt: 'Jako AI , opisuję temat',
        content: 'Pierwsze  zdanie.',
        premiumContent: '- punkt markdown',
        slug: 'tytul-z-problemem',
        author: 'Luna-Mystica',
        type: 'SEO-test',
      },
    });

    expect(report.valid).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        { path: 'title', code: 'dash_in_user_text' },
        { path: 'excerpt', code: 'space_before_punctuation' },
        { path: 'excerpt', code: 'ai_phrase' },
        { path: 'content', code: 'double_space' },
        { path: 'premiumContent', code: 'markdown_bullet' },
      ])
    );
    expect(JSON.stringify(report)).not.toContain('Tytuł');
    expect(JSON.stringify(report)).not.toContain('Luna-Mystica');
  });

  it('allows technical dashes and URL dashes outside user prose checks', () => {
    const report = evaluatePolishContentQuality({
      kind: 'social_teaser',
      payload: {
        slug: 'karta-dnia-2026',
        author: 'Luna-Mystica',
        platform: 'twitter',
        sign: 'Baran',
        type: 'daily-card',
        caption: 'Zobacz więcej https://star-sign.app/artykuly/karta-dnia-2026',
      },
    });

    expect(report).toEqual({ valid: true, issues: [] });
  });

  it('repairs article payloads before the Polish style gate fails the run', async () => {
    const requestJson = vi.fn(async () => ({
      payload: {
        title: 'Naturalny tytuł',
        excerpt: 'Krótki wstęp.',
        content: 'Publiczna treść po korekcie.',
        premiumContent: 'Relacje: spokojna rozmowa. Praca: konkretny plan. Energia dnia: jasność. Rytuał: oddech. Pytanie refleksyjne: czego potrzebujesz?',
        isPremium: true,
        slug: 'naturalny-tytul',
      },
      usage: llmUsage(),
      trace: {} as any,
    }));
    const api = orchestrator({ strapi: createStrapi({ 'open-router': { requestJson } }, {}) });

    const result = await api.ensurePolishContentQuality({
      payload: api.validateArticlePayload({
        title: 'Tytuł - roboczy',
        excerpt: 'Wstęp poprawny.',
        content: 'Publiczna treść.',
        premiumContent: 'Relacje: treść premium.',
        isPremium: true,
        slug: 'tytul-roboczy',
      }),
      kind: 'article',
      schemaDescription: '{"title":"string","excerpt":"string","content":"string","premiumContent":"string"}',
      apiToken: 'token',
      llmModel: 'openai/test',
      workflowType: 'article',
      label: 'Article test',
      validate: (candidate) => api.validateArticlePayload(candidate),
    });

    expect(result.repaired).toBe(true);
    expect(result.payload.title).toBe('Naturalny tytuł');
    expect(requestJson).toHaveBeenCalledTimes(1);
  });

  it('repairs horoscope and daily card user-facing fields with the same Polish style gate', async () => {
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        payload: {
          items: [
            {
              sign: 'Baran',
              content: 'Spokojny tekst po korekcie.',
              premiumContent: 'Relacje: rozmowa. Praca: plan. Energia dnia: jasność. Rytuał: oddech. Pytanie refleksyjne: czego potrzebujesz?',
              type: 'Ogólny',
            },
          ],
        },
        usage: llmUsage(),
        trace: {} as any,
      })
      .mockResolvedValueOnce({
        payload: {
          title: 'Karta dnia',
          excerpt: 'Krótki wstęp.',
          content: 'Publiczna treść po korekcie.',
          premiumContent: 'Relacje: rozmowa. Praca: plan. Energia dnia: jasność. Rytuał: oddech. Pytanie refleksyjne: czego potrzebujesz?',
          isPremium: true,
          draw_message: 'Dziś wybierz spokojny rytm.',
          slug: 'karta-dnia-2026',
        },
        usage: llmUsage(),
        trace: {} as any,
      });
    const api = orchestrator({ strapi: createStrapi({ 'open-router': { requestJson } }, {}) });

    const horoscope = await api.ensurePolishContentQuality({
      payload: api.validateHoroscopePayload(
        {
          items: [
            {
              sign: 'Baran',
              content: 'Spokojny tekst - do korekty.',
              premiumContent: 'Relacje: rozmowa.',
              type: 'Ogólny',
            },
          ],
        },
        'Ogólny'
      ),
      kind: 'horoscope',
      schemaDescription: '{"items":[{"sign":"string","content":"string","premiumContent":"string"}]}',
      apiToken: 'token',
      llmModel: 'openai/test',
      workflowType: 'horoscope',
      label: 'Horoscope test',
      validate: (candidate) => api.validateHoroscopePayload(candidate, 'Ogólny'),
    });
    const dailyCard = await api.ensurePolishContentQuality({
      payload: api.validateDailyCardPayload({
        title: 'Karta dnia',
        excerpt: 'Krótki wstęp.',
        content: 'Publiczna treść.',
        premiumContent: 'Relacje: rozmowa.',
        isPremium: true,
        draw_message: 'Dziś - wybierz spokój.',
        slug: 'karta-dnia-2026',
      }),
      kind: 'daily_card',
      schemaDescription: '{"title":"string","excerpt":"string","content":"string","premiumContent":"string","draw_message":"string"}',
      apiToken: 'token',
      llmModel: 'openai/test',
      workflowType: 'daily_card',
      label: 'Daily card test',
      validate: (candidate) => api.validateDailyCardPayload(candidate),
    });

    expect(horoscope.payload.items[0].content).not.toContain('-');
    expect(dailyCard.payload.draw_message).not.toContain('-');
    expect(requestJson).toHaveBeenCalledTimes(2);
  });

  it('fails Polish style repair after three unsuccessful attempts', async () => {
    const requestJson = vi.fn(async () => ({
      payload: {
        title: 'Tytuł - nadal błędny',
        excerpt: 'Krótki wstęp.',
        content: 'Publiczna treść.',
        premiumContent: 'Relacje: treść premium.',
        isPremium: true,
      },
      usage: llmUsage(),
      trace: {} as any,
    }));
    const api = orchestrator({ strapi: createStrapi({ 'open-router': { requestJson } }, {}) });

    await expect(
      api.ensurePolishContentQuality({
        payload: api.validateArticlePayload({
          title: 'Tytuł - roboczy',
          excerpt: 'Wstęp poprawny.',
          content: 'Publiczna treść.',
          premiumContent: 'Relacje: treść premium.',
          isPremium: true,
        }),
        kind: 'article',
        schemaDescription: '{"title":"string","excerpt":"string","content":"string","premiumContent":"string"}',
        apiToken: 'token',
        llmModel: 'openai/test',
        workflowType: 'article',
        label: 'Article test',
        validate: (candidate) => api.validateArticlePayload(candidate),
      })
    ).rejects.toThrow('quality_failed_polish_style');

    expect(requestJson).toHaveBeenCalledTimes(3);
  });

  it('retries premium quality generation up to five attempts', async () => {
    const strapi = createStrapi({}, {});
    const api = orchestrator({ strapi });
    const generateHoroscopeBatch = vi.fn(async () => {
      throw new Error('quality_failed premiumContent');
    });

    api.generateHoroscopeBatch = generateHoroscopeBatch;

    await expect(
      api.generateWithRetries({
        runId: 1,
        workflow: { id: 7, workflow_type: 'horoscope' } as any,
        config: {
          workflowType: 'horoscope',
          retryMax: 1,
          retryBackoffSeconds: 0,
        } as any,
        apiToken: 'token',
        publishAt: new Date('2026-05-02T00:00:00.000Z'),
        targetDate: '2026-05-02',
        now: new Date('2026-05-02T00:00:00.000Z'),
      })
    ).rejects.toThrow('quality_failed premiumContent');

    expect(generateHoroscopeBatch).toHaveBeenCalledTimes(PREMIUM_CONTENT_RETRY_MAX);
  });

  it('requires premiumContent in horoscope payloads generated by AICO', () => {
    const api = orchestrator({ strapi: createStrapi({}, {}) });

    expect(() =>
      api.validateHoroscopePayload(
        { items: [{ sign: 'Baran', content: 'Darmowy horoskop' }] },
        'Ogólny'
      )
    ).toThrow('items[].premiumContent');
  });

  it('requires premiumContent in article and daily card payloads generated by AICO', () => {
    const api = orchestrator({ strapi: createStrapi({}, {}) });

    expect(() =>
      api.validateArticlePayload({
        title: 'Artykuł',
        excerpt: 'Wstęp',
        content: 'Publiczna treść',
      })
    ).toThrow('premiumContent');

    expect(() =>
      api.validateDailyCardPayload({
        title: 'Karta dnia',
        excerpt: 'Wstęp',
        content: 'Publiczna treść',
        draw_message: 'Wiadomość',
      })
    ).toThrow('premiumContent');
  });

  it('returns a safe public homepage recommendation DTO without operational relations', async () => {
    const entityService = {
      findMany: vi.fn(async () => [
        {
          id: 123,
          slot: 'today_in_stars',
          title: 'Dzisiaj w gwiazdach',
          subtitle: 'Krótki opis',
          target_url: '/artykuly/dzisiaj',
          content_uid: CONTENT_UIDS.article,
          content_entry_id: 77,
          content_slug: 'dzisiaj',
          priority_score: 91,
          starts_at: '2026-05-05T08:00:00.000Z',
          expires_at: '2026-05-06T08:00:00.000Z',
          status: 'active',
          rationale: 'internal rationale',
          metadata: {
            source: 'performance_snapshot',
            prompt: 'internal prompt',
          },
          workflow: {
            id: 9,
            llm_api_token_encrypted: 'encrypted-token',
            prompt_template: 'internal prompt template',
          },
          source_snapshot: {
            id: 22,
            recommendations: { private: true },
          },
        },
      ]),
    };
    const service = siteAlive({ strapi: createStrapi({}, entityService) });

    const result = await service.listPublic({ status: 'active', limit: 50 });

    expect(entityService.findMany).toHaveBeenCalledWith(
      'plugin::ai-content-orchestrator.homepage-recommendation',
      expect.objectContaining({
        filters: { status: 'active' },
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
        limit: 24,
      })
    );
    expect(entityService.findMany).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({
        populate: expect.anything(),
      })
    );
    expect(result).toEqual([
      {
        slot: 'today_in_stars',
        title: 'Dzisiaj w gwiazdach',
        subtitle: 'Krótki opis',
        target_url: '/artykuly/dzisiaj',
        content_slug: 'dzisiaj',
        priority_score: 91,
        starts_at: '2026-05-05T08:00:00.000Z',
        expires_at: '2026-05-06T08:00:00.000Z',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('workflow');
    expect(JSON.stringify(result)).not.toContain('source_snapshot');
    expect(JSON.stringify(result)).not.toContain('rationale');
    expect(JSON.stringify(result)).not.toContain('encrypted-token');
    expect(JSON.stringify(result)).not.toContain('internal prompt');
  });

  it('resolves editor RBAC auto-grant as opt-in allowlist', () => {
    expect(resolveEditorRolePermissionActions({})).toEqual([]);
    expect(
      resolveEditorRolePermissionActions({
        AICO_SYNC_EDITOR_ROLE_PERMISSIONS: 'true',
        AICO_EDITOR_PERMISSION_ACTIONS:
          'plugin::ai-content-orchestrator.read,plugin::ai-content-orchestrator.manage-social,unknown',
      })
    ).toEqual([
      'plugin::ai-content-orchestrator.read',
      'plugin::ai-content-orchestrator.manage-social',
    ]);
  });

  it('bootstrap registers actions but does not auto-grant editor permissions by default', async () => {
    const registerMany = vi.fn(async () => undefined);
    const createMany = vi.fn(async () => undefined);
    const strapi = {
      service: vi.fn(() => ({
        actionProvider: { registerMany },
        createMany,
      })),
      db: {
        query: vi.fn(() => ({
          findMany: vi.fn(async () => [{ id: 1, name: 'Editor' }]),
        })),
      },
      cron: { add: vi.fn() },
      plugin: vi.fn(() => ({ service: vi.fn() })),
      log: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    };

    await bootstrap({ strapi: strapi as any });

    expect(registerMany).toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
    expect(strapi.cron.add).toHaveBeenCalled();
  });

  it('editor RBAC sync grants only explicit allowlisted permissions', async () => {
    const createMany = vi.fn(async () => undefined);
    const roleQuery = { findMany: vi.fn(async () => [{ id: 1, name: 'Editor' }]) };
    const permissionQuery = {
      findMany: vi.fn(async () => [
        { action: 'plugin::ai-content-orchestrator.read' },
      ]),
    };
    const strapi = {
      service: vi.fn(() => ({ createMany })),
      db: {
        query: vi.fn((uid: string) => (uid === 'admin::role' ? roleQuery : permissionQuery)),
      },
      log: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    };

    await syncEditorRolePermissions(strapi as any, [
      'plugin::ai-content-orchestrator.read',
      'plugin::ai-content-orchestrator.view-runs',
    ]);

    expect(createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        action: 'plugin::ai-content-orchestrator.view-runs',
        role: 1,
      }),
    ]);
    expect(JSON.stringify(createMany.mock.calls)).not.toContain('manage-social');
    expect(JSON.stringify(createMany.mock.calls)).not.toContain('manage-workflows');
  });

  it('admin audit preflight routes require runAudit permission', () => {
    const routes = adminRoutesFactory().routes;
    const auditRoutes = routes.filter((route) => route.path === '/audit/preflight');

    expect(auditRoutes).toHaveLength(2);
    for (const route of auditRoutes) {
      expect(route.config?.policies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            config: {
              actions: ['plugin::ai-content-orchestrator.run-audit'],
            },
          }),
        ])
      );
    }
  });

  it('admin enterprise routes use dedicated performance and audit trail permissions', () => {
    const routes = adminRoutesFactory().routes;
    const performanceAggregate = routes.find((route) => route.path === '/performance/aggregate');
    const auditEvents = routes.find((route) => route.path === '/audit/events');

    expect(performanceAggregate?.config?.policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          config: {
            actions: ['plugin::ai-content-orchestrator.manage-performance'],
          },
        }),
      ])
    );
    expect(auditEvents?.config?.policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          config: {
            actions: ['plugin::ai-content-orchestrator.view-audit-trail'],
          },
        }),
      ])
    );
  });

  it('audit trail records actor context and redacts sensitive metadata', async () => {
    const created: any[] = [];
    const entityService = {
      create: vi.fn(async (uid: string, payload: any) => {
        expect(uid).toBe(AUDIT_EVENT_UID);
        const record = { id: 1, ...payload.data };
        created.push(record);
        return record;
      }),
    };
    const strapi = createStrapi({}, entityService);
    const service = auditTrail({ strapi });
    const ctx = {
      state: { user: { id: 42, email: 'operator@example.com' } },
      get: vi.fn((name: string) => (name.toLowerCase() === 'x-request-id' ? 'req-123' : '')),
      ip: '203.0.113.10',
      request: { headers: {} },
    } as any;

    await service.recordFromContext(ctx, {
      action: 'workflow.update',
      outcome: 'success',
      resourceUid: WORKFLOW_UID,
      resourceId: 7,
      metadata: {
        changedFields: ['name', 'apiToken'],
        apiToken: 'secret-token',
        nested: {
          prompt: 'internal prompt',
          visible: 'ok',
        },
      },
    });

    expect(created[0]).toMatchObject({
      action: 'workflow.update',
      outcome: 'success',
      actor_type: 'admin',
      actor_id: '42',
      request_id: 'req-123',
      resource_uid: WORKFLOW_UID,
      resource_id: '7',
    });
    expect(created[0].ip_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(created[0].metadata).toMatchObject({
      apiToken: '[REDACTED]',
      nested: {
        prompt: '[REDACTED]',
        visible: 'ok',
      },
    });
    expect(JSON.stringify(created[0])).not.toContain('secret-token');
    expect(JSON.stringify(created[0])).not.toContain('internal prompt');
    expect(JSON.stringify(created[0])).not.toContain('operator@example.com');
  });

  it('records admin audit events for P1 mutating controllers', async () => {
    const recordFromContext = vi.fn(async () => null);
    const services = {
      'audit-trail': { recordFromContext },
      topics: {
        create: vi.fn(async (input: any) => ({ id: 11, title: input.title, status: 'pending' })),
        update: vi.fn(async (id: number, input: any) => ({ id, title: input.title ?? 'Topic' })),
        serialize: vi.fn((item: any) => item),
      },
      'strategy-planner': {
        generatePlan: vi.fn(async () => ({ created: 1, queued: 0 })),
        approvePlan: vi.fn(async () => ({ approved: 2 })),
      },
      'media-assets': {
        create: vi.fn(async () => ({ id: 21, title: 'Hero asset', key: 'hero' })),
        update: vi.fn(async (id: number) => ({ id, title: 'Hero asset', key: 'hero' })),
        bulkUpsert: vi.fn(async () => ({ created: 1, updated: 0 })),
        validateCoverage: vi.fn(async () => ({ ok: true })),
        serialize: vi.fn((item: any) => item),
      },
      runs: {
        retry: vi.fn(async () => ({ workflowId: 7, queued: true })),
      },
      'site-alive': {
        runRecommendations: vi.fn(async () => ({ created: 3, expired: 1 })),
      },
    };
    const strapi = createStrapi(services, {});

    await topicsController({ strapi }).create(createCtx({ body: { title: 'Topic', workflow: 7 } }));
    await topicsController({ strapi }).update(
      createCtx({ params: { id: 11 }, body: { title: 'Topic updated' } })
    );
    await strategyController({ strapi }).generatePlan(
      createCtx({ body: { weekStart: '2026-05-04', workflowId: 7 } })
    );
    await strategyController({ strapi }).approvePlan(createCtx({ body: { ids: [1, 2] } }));
    await mediaAssetsController({ strapi }).create(createCtx({ body: { title: 'Hero asset' } }));
    await mediaAssetsController({ strapi }).update(
      createCtx({ params: { id: 21 }, body: { title: 'Hero asset' } })
    );
    await mediaAssetsController({ strapi }).bulkUpsert(
      createCtx({ body: { items: [{ key: 'hero' }], apply: true } })
    );
    await mediaAssetsController({ strapi }).validateCoverage(
      createCtx({ body: { applyWorkflowDisabling: true } })
    );
    await runsController({ strapi }).retry(createCtx({ params: { id: 31 } }));
    await homepageController({ strapi }).runRecommendations(
      createCtx({ body: { ttlHours: 24, limit: 4 } })
    );

    const auditCalls = recordFromContext.mock.calls as unknown as Array<
      [unknown, { action: string }]
    >;
    const actions = auditCalls.map((call) => call[1].action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'topic.create',
        'topic.update',
        'strategy.generate-plan',
        'strategy.approve-plan',
        'media-asset.create',
        'media-asset.update',
        'media-asset.bulk-upsert',
        'media-asset.validate-coverage',
        'run.retry',
        'homepage.recommendations.run',
      ])
    );
    expect(recordFromContext).toHaveBeenCalledTimes(10);
    expect(JSON.stringify(recordFromContext.mock.calls)).not.toContain('secret');
  });

  it('redacts LLM traces before storage and when legacy run records are listed', async () => {
    const trace = rawLlmTrace();
    const sanitizedTrace = sanitizeLlmTraceForStorage(trace as any);

    expect(sanitizedTrace.redacted).toBe(true);
    expect(sanitizedTrace.request.model).toBe('openai/test');
    expect(sanitizedTrace.response.usage).toEqual(llmUsage());
    expect(JSON.stringify(sanitizedTrace)).not.toContain('secret prompt');
    expect(JSON.stringify(sanitizedTrace)).not.toContain('raw response secret');
    expect(JSON.stringify(sanitizedTrace)).not.toContain('raw parsed secret');

    const writes: any[] = [];
    const entityService = {
      create: vi.fn(async (_uid: string, payload: any) => {
        writes.push(payload.data);
        return { id: 1, ...payload.data };
      }),
      update: vi.fn(async (_uid: string, id: number, payload: any) => {
        writes.push(payload.data);
        return { id, ...payload.data };
      }),
      findOne: vi.fn(async () => ({ id: 1, details: {} })),
      findMany: vi.fn(async () => [
        {
          id: 1,
          run_type: 'manual',
          status: 'success',
          started_at: '2026-05-05T10:00:00.000Z',
          details: { llmTraces: [rawLlmTrace()] },
        },
      ]),
      count: vi.fn(async () => 0),
    };
    const strapi = createStrapi({}, entityService);
    const api = runsService({ strapi });

    await api.create({
      workflowId: 7,
      runType: 'manual',
      status: 'running',
      startedAt: new Date('2026-05-05T10:00:00.000Z'),
      details: { reason: 'test', llmTraces: [rawLlmTrace()] },
    });
    await api.updateDetails(1, { llmTraces: [rawLlmTrace()] });

    expect(JSON.stringify(writes)).not.toContain('secret prompt');
    expect(JSON.stringify(writes)).not.toContain('raw response secret');
    expect(JSON.stringify(writes)).not.toContain('raw parsed secret');

    const listed = await api.list();
    expect(JSON.stringify(listed)).not.toContain('secret prompt');
    expect(JSON.stringify(listed)).not.toContain('raw response secret');
    expect((listed[0].details?.llmTraces as any[])[0].redacted).toBe(true);

    const summary = await dashboard({ strapi }).getSummary();
    expect(JSON.stringify(summary)).not.toContain('secret prompt');
    expect(JSON.stringify(summary)).not.toContain('raw response secret');
  });

  it('redacts OpenRouter error bodies and provider payload diagnostics', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        text: vi.fn(async () => 'provider body with secret prompt and sk-test-secret'),
      }))
    );

    try {
      const api = openRouter({ strapi: createStrapi({}, {}) });

      let message = '';
      try {
        await api.requestJson({
          model: 'openai/test',
          apiToken: 'token',
          prompt: 'secret prompt',
          schemaDescription: '{"secret":"schema"}',
        });
      } catch (error) {
        message = String((error as Error).message);
      }

      expect(message).toContain('response body redacted');
      expect(message).not.toContain('sk-test-secret');
    } finally {
      vi.unstubAllGlobals();
    }

    const redacted = redactProviderPayload({
      status: 400,
      data: {
        access_token: 'provider-access-token',
        message: 'Bearer provider-secret-token',
        visibleCode: 'bad_request',
        raw: { prompt: 'provider raw secret' },
      },
    });

    expect(redacted).toMatchObject({
      status: 400,
      data: {
        access_token: '[REDACTED]',
        message: '[REDACTED]',
        visibleCode: 'bad_request',
        raw: '[REDACTED]',
      },
    });
    expect(JSON.stringify(redacted)).not.toContain('provider-access-token');
    expect(JSON.stringify(redacted)).not.toContain('provider-secret-token');
    expect(socialPostTicketSchema.attributes.provider_payload.private).toBe(true);
  });

  it('does not expose provider_payload through social ticket admin service responses', async () => {
    const entityService = {
      findMany: vi.fn(async () => [
        {
          id: 1,
          platform: 'facebook',
          status: 'scheduled',
          caption: 'Caption',
          scheduled_at: '2026-05-05T10:00:00.000Z',
          provider_payload: { access_token: 'provider-secret-token' },
        },
      ]),
      findOne: vi.fn(async () => ({
        id: 1,
        platform: 'facebook',
        status: 'scheduled',
        caption: 'Caption',
        scheduled_at: '2026-05-05T10:00:00.000Z',
        provider_payload: { access_token: 'provider-secret-token' },
      })),
      update: vi.fn(async (_uid: string, id: number, payload: any) => ({
        id,
        platform: 'facebook',
        status: payload.data.status,
        caption: 'Caption',
        scheduled_at: '2026-05-05T10:00:00.000Z',
        provider_payload: { access_token: 'provider-secret-token' },
      })),
    };
    const api = socialPublisher({ strapi: createStrapi({}, entityService) });

    const tickets = await api.listTickets();
    const retried = await api.retryTicket(1);
    const canceled = await api.cancelTicket(1);

    expect(tickets[0].provider_payload).toBeUndefined();
    expect(retried.provider_payload).toBeUndefined();
    expect(canceled.provider_payload).toBeUndefined();
    expect(JSON.stringify({ tickets, retried, canceled })).not.toContain('provider-secret-token');
  });

  it('runtime locks run a critical section once and release the lock', async () => {
    const rows: any[] = [];
    const entityService = {
      findMany: vi.fn(async (_uid: string, query?: any) =>
        rows.filter((item) => item.lock_key === query?.filters?.lock_key)
      ),
      create: vi.fn(async (uid: string, payload: any) => {
        expect(uid).toBe(RUNTIME_LOCK_UID);
        const record = { id: rows.length + 1, ...payload.data };
        rows.push(record);
        return record;
      }),
      update: vi.fn(async (uid: string, id: number, payload: any) => {
        expect(uid).toBe(RUNTIME_LOCK_UID);
        const index = rows.findIndex((item) => item.id === id);
        rows[index] = { ...rows[index], ...payload.data };
        return rows[index];
      }),
    };
    const api = runtimeLocks({ strapi: createStrapi({}, entityService) });
    const runner = vi.fn(async () => 'executed');

    const result = await api.withLock(
      'orchestrator.tick',
      { now: new Date('2026-05-05T10:00:00.000Z') },
      runner
    );

    expect(result).toBe('executed');
    expect(runner).toHaveBeenCalledTimes(1);
    expect(rows[0]).toMatchObject({ lock_key: 'orchestrator.tick', status: 'released' });
  });

  it('runtime locks skip a held non-expired lock', async () => {
    const rows = [
      {
        id: 1,
        lock_key: 'orchestrator.tick',
        owner_id: 'other',
        status: 'active',
        acquired_at: '2026-05-05T09:59:00.000Z',
        expires_at: '2026-05-05T10:01:00.000Z',
      },
    ];
    const entityService = {
      findMany: vi.fn(async () => rows),
      create: vi.fn(),
      update: vi.fn(),
    };
    const api = runtimeLocks({ strapi: createStrapi({}, entityService) });
    const runner = vi.fn(async () => 'blocked');

    const result = await api.withLock(
      'orchestrator.tick',
      { now: new Date('2026-05-05T10:00:00.000Z') },
      runner
    );

    expect(result).toBeUndefined();
    expect(runner).not.toHaveBeenCalled();
  });

  it('runtime locks release after a critical section throws', async () => {
    const rows: any[] = [];
    const entityService = {
      findMany: vi.fn(async (_uid: string, query?: any) =>
        rows.filter((item) => item.lock_key === query?.filters?.lock_key)
      ),
      create: vi.fn(async (_uid: string, payload: any) => {
        const record = { id: rows.length + 1, ...payload.data };
        rows.push(record);
        return record;
      }),
      update: vi.fn(async (_uid: string, id: number, payload: any) => {
        const index = rows.findIndex((item) => item.id === id);
        rows[index] = { ...rows[index], ...payload.data };
        return rows[index];
      }),
    };
    const api = runtimeLocks({ strapi: createStrapi({}, entityService) });

    await expect(
      api.withLock('orchestrator.tick', {}, async () => {
        throw new Error('runner failed');
      })
    ).rejects.toThrow('runner failed');

    expect(rows[0]).toMatchObject({ lock_key: 'orchestrator.tick', status: 'released' });
  });

  it('settings expose strategy autopilot as disabled by default and persist explicit opt-in', async () => {
    let saved: Record<string, unknown> | null = null;
    const store = {
      get: vi.fn(async () => saved),
      set: vi.fn(async ({ value }: { value: Record<string, unknown> }) => {
        saved = value;
      }),
    };
    const strapi = {
      store: vi.fn(() => store),
      plugin: vi.fn(() => ({
        service: vi.fn(() => ({
          encrypt: vi.fn((value: string) => `encrypted:${value}`),
        })),
      })),
    };
    const controller = settingsController({ strapi: strapi as any });
    const findCtx = { body: null } as any;

    await controller.find(findCtx);
    expect(findCtx.body.data).toMatchObject({
      aico_auto_publish_enabled: true,
      aico_strategy_autopilot_enabled: false,
    });

    const updateCtx = {
      request: { body: { aico_strategy_autopilot_enabled: true } },
      body: null,
      badRequest: vi.fn(),
    } as any;

    await controller.update(updateCtx);

    expect(store.set).toHaveBeenCalledWith({
      value: expect.objectContaining({ aico_strategy_autopilot_enabled: true }),
    });
    expect(updateCtx.body.data).toMatchObject({ aico_strategy_autopilot_enabled: true });
  });

  it('preflight audit is offline by default and redacts run details', async () => {
    const testConnection = vi.fn(async () => ({ overall: 'ready', channels: [] }));
    const workflow = {
      id: 7,
      name: 'Article strategy',
      enabled: true,
      auto_publish: false,
      enabled_channels: ['tiktok'],
      auto_publish_guardrails: { strategy: { min_topic_backlog: 2 } },
    };
    const entityService = {
      findMany: vi.fn(async (uid: string, query?: Record<string, unknown>) => {
        if (uid === WORKFLOW_UID) {
          return [workflow];
        }

        if (uid === RUN_LOG_UID && (query?.filters as any)?.status === 'running') {
          return [
            {
              id: 22,
              run_type: 'generate',
              status: 'running',
              started_at: '2026-05-05T01:00:00.000Z',
              details: { llmTraces: [{ prompt: 'secret prompt' }] },
            },
          ];
        }

        if (uid === RUN_LOG_UID) {
          return [
            {
              id: 21,
              run_type: 'generate',
              status: 'success',
              started_at: new Date().toISOString(),
              details: {
                llmTraces: [{ prompt: 'secret prompt', messages: [], response: 'raw response' }],
              },
            },
          ];
        }

        return [];
      }),
      count: vi.fn(async () => 0),
    };
    const strapi = createStrapi(
      {
        workflows: {
          list: vi.fn(async () => [{ id: 7, name: 'Article strategy' }]),
        },
        'social-publisher': { testConnection },
      },
      entityService
    );
    (strapi as any).store = vi.fn(() => ({
      get: vi.fn(async () => ({ aico_auto_publish_enabled: false })),
    }));
    (strapi as any).config = {
      get: vi.fn(() => 'https://api.star-sign.pl'),
    };

    const result = await audit({ strapi }).preflight({ strict: true });

    expect(testConnection).not.toHaveBeenCalled();
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'social.connectivity',
          status: 'warn',
          details: expect.objectContaining({ skipped: true, reason: 'offline_default' }),
        }),
      ])
    );
    expect(JSON.stringify(result)).not.toContain('llmTraces');
    expect(JSON.stringify(result)).not.toContain('secret prompt');
    expect(JSON.stringify(result)).not.toContain('raw response');
  });

  it('counts rescheduled publication tickets as an unsuccessful publish run', async () => {
    const now = new Date('2026-04-28T10:00:00.000Z');
    const complete = vi.fn();
    const updates: Array<{ uid: string; id: number; payload: unknown }> = [];
    const entityService = {
      findMany: vi.fn(async (uid: string) => {
        if (uid === PUBLICATION_TICKET_UID) {
          return [
            {
              id: 1,
              status: 'scheduled',
              retries: 0,
              workflow: { id: 7 },
              content_uid: 'api::article.article',
              content_entry_id: 404,
            },
          ];
        }

        return [];
      }),
      findOne: vi.fn(async () => null),
      update: vi.fn(async (uid: string, id: number, payload: unknown) => {
        updates.push({ uid, id, payload });
        return {};
      }),
    };
    const strapi = createStrapi(
      {
        workflows: {
          getById: vi.fn(async () => ({ id: 7, retry_max: 3, retry_backoff_seconds: 15 })),
          markPublishSlot: vi.fn(),
          setStatus: vi.fn(),
        },
        runs: {
          create: vi.fn(async () => ({ id: 99 })),
          complete,
        },
      },
      entityService
    );

    await orchestrator({ strapi }).processPublicationTick(now);

    expect(updates[0]).toMatchObject({ uid: PUBLICATION_TICKET_UID, id: 1 });
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 99,
        status: RUN_STATUS.failed,
        details: expect.objectContaining({ published: 0, rescheduled: 1, failed: 0, tickets: 1 }),
      })
    );
  });

  it('repairs social teaser captions before creating social-post tickets', async () => {
    const workflow = {
      id: 7,
      enabled_channels: ['twitter'],
    };
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        payload: {
          teasers: [{ platform: 'twitter', caption: 'Dzisiaj - sprawdź intuicję' }],
        },
      })
      .mockResolvedValueOnce({
        payload: { caption: 'Dzisiaj sprawdź intuicję.' },
      });
    const entityService = {
      findMany: vi.fn(async () => []),
      create: vi.fn(async (_uid: string, payload: any) => ({ id: 1, ...payload.data })),
    };
    const api = socialPublisher({
      strapi: createStrapi(
        {
          workflows: {
            getById: vi.fn(async () => workflow),
            normalizeRuntime: vi.fn(async () => ({
              enabledChannels: ['twitter'],
              llmModel: 'openai/test',
              retryMax: 3,
              retryBackoffSeconds: 15,
            })),
            decryptTokenForRuntime: vi.fn(async () => 'token'),
          },
          'open-router': { requestJson },
        },
        entityService
      ),
    });

    const result = await api.generateTeaser({
      workflowId: 7,
      runId: 99,
      contentUid: CONTENT_UIDS.article,
      contentId: 123,
      contentTitle: 'Karta dnia',
      contentExcerpt: 'Krótki opis',
      targetUrl: 'https://star-sign.app/artykuly/karta-dnia-2026',
      publishAt: new Date('2026-05-05T10:00:00.000Z'),
    });

    expect(result).toEqual({ created: 1, skipped: 0, channels: ['twitter'] });
    expect(requestJson).toHaveBeenCalledTimes(2);
    expect(entityService.create).toHaveBeenCalledWith(
      SOCIAL_POST_TICKET_UID,
      expect.objectContaining({
        data: expect.objectContaining({
          caption: expect.stringContaining('Dzisiaj sprawdź intuicję.'),
          provider_payload: expect.objectContaining({
            polishQualityRepaired: true,
          }),
        }),
      })
    );
    expect(entityService.create.mock.calls[0][1].data.caption).toContain(
      'https://star-sign.app/artykuly/karta-dnia-2026'
    );
    expect(entityService.create.mock.calls[0][1].data.caption).not.toContain(' - ');
  });

  it('skips social teaser ticket creation when Polish caption repair keeps failing', async () => {
    const workflow = {
      id: 7,
      enabled_channels: ['twitter'],
    };
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        payload: {
          teasers: [{ platform: 'twitter', caption: 'Dzisiaj - sprawdź intuicję' }],
        },
      })
      .mockResolvedValue({
        payload: { caption: 'Dzisiaj - nadal błędnie' },
      });
    const entityService = {
      findMany: vi.fn(async () => []),
      create: vi.fn(async (_uid: string, payload: any) => ({ id: 1, ...payload.data })),
    };
    const api = socialPublisher({
      strapi: createStrapi(
        {
          workflows: {
            getById: vi.fn(async () => workflow),
            normalizeRuntime: vi.fn(async () => ({
              enabledChannels: ['twitter'],
              llmModel: 'openai/test',
              retryMax: 3,
              retryBackoffSeconds: 15,
            })),
            decryptTokenForRuntime: vi.fn(async () => 'token'),
          },
          'open-router': { requestJson },
        },
        entityService
      ),
    });

    const result = await api.generateTeaser({
      workflowId: 7,
      runId: 99,
      contentUid: CONTENT_UIDS.article,
      contentId: 123,
      contentTitle: 'Karta dnia',
      contentExcerpt: 'Krótki opis',
      targetUrl: 'https://star-sign.app/artykuly/karta-dnia-2026',
      publishAt: new Date('2026-05-05T10:00:00.000Z'),
    });

    expect(result).toEqual({ created: 0, skipped: 1, channels: ['twitter'] });
    expect(requestJson).toHaveBeenCalledTimes(4);
    expect(entityService.create).not.toHaveBeenCalled();
  });

  it('autonomous social publish agent publishes due tickets when policy allows', async () => {
    const now = new Date('2026-05-05T10:00:00.000Z');
    const workflow = {
      id: 7,
      enabled: true,
      auto_publish: true,
      enabled_channels: ['twitter'],
      retry_max: 3,
      retry_backoff_seconds: 15,
      auto_publish_guardrails: {
        social: {
          max_posts_per_run: 4,
          max_posts_per_platform_per_day: { twitter: 4 },
          cooldown_minutes: { twitter: 0 },
        },
      },
    };
    const ticket = {
      id: 21,
      platform: 'twitter',
      status: 'scheduled',
      caption: 'Nowy horoskop na dziś',
      media_url: 'https://star-sign.app/assets/og-default.jpg',
      target_url: 'https://star-sign.app/horoskopy',
      scheduled_at: now.toISOString(),
      attempt_count: 0,
      workflow,
      provider_payload: { source: 'test' },
    };
    const entityService = {
      findMany: vi.fn(async (uid: string, options?: any) => {
        if (uid !== SOCIAL_POST_TICKET_UID) {
          return [];
        }

        const filters = options?.filters ?? {};
        if (filters.status?.$in) {
          return [ticket];
        }

        if (filters.status === 'published') {
          return [];
        }

        return [];
      }),
      update: vi.fn(async () => ({})),
    };
    const api = socialPublisher({ strapi: createStrapi({}, entityService) });
    api.publishToProvider = vi.fn(async () => ({
      providerPostId: 'x-post-1',
      providerPayload: { postId: 'x-post-1' },
    }));

    const result = await api.publishPending(now);

    expect(result).toEqual({ processed: 1, published: 1, failed: 0, rescheduled: 0 });
    expect(api.publishToProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'twitter',
        caption: expect.stringContaining('Nowy horoskop na dziś'),
      })
    );
    expect(entityService.update).toHaveBeenCalledWith(
      SOCIAL_POST_TICKET_UID,
      21,
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'published',
          provider_post_id: 'x-post-1',
          blocked_reason: null,
        }),
      })
    );
  });

  it('autonomous social publish agent blocks unsafe captions before provider calls', async () => {
    const now = new Date('2026-05-05T10:00:00.000Z');
    const workflow = {
      id: 7,
      enabled: true,
      auto_publish: true,
      enabled_channels: ['twitter'],
      retry_max: 1,
      retry_backoff_seconds: 15,
      auto_publish_guardrails: {
        social: {
          max_posts_per_run: 4,
          max_posts_per_platform_per_day: { twitter: 4 },
          cooldown_minutes: { twitter: 0 },
          content_safety: {
            enabled: true,
            blocked_phrases: ['sekretny rytuał sprzedażowy'],
          },
        },
      },
    };
    const ticket = {
      id: 31,
      platform: 'twitter',
      status: 'scheduled',
      caption: 'To jest gwarantowany zysk dla każdego znaku',
      media_url: 'https://star-sign.app/assets/og-default.jpg',
      target_url: 'https://star-sign.app/horoskopy',
      scheduled_at: now.toISOString(),
      attempt_count: 0,
      workflow,
      provider_payload: { source: 'test' },
    };
    const entityService = {
      findMany: vi.fn(async (uid: string, options?: any) => {
        if (uid !== SOCIAL_POST_TICKET_UID) {
          return [];
        }

        const filters = options?.filters ?? {};
        if (filters.status?.$in) {
          return [ticket];
        }

        if (filters.status === 'published') {
          return [];
        }

        return [];
      }),
      update: vi.fn(async () => ({})),
    };
    const api = socialPublisher({ strapi: createStrapi({}, entityService) });
    api.publishToProvider = vi.fn(async () => ({
      providerPostId: 'x-post-unsafe',
    }));

    const result = await api.publishPending(now);

    expect(result).toEqual({ processed: 1, published: 0, failed: 1, rescheduled: 0 });
    expect(api.publishToProvider).not.toHaveBeenCalled();
    expect(entityService.update).toHaveBeenCalledWith(
      SOCIAL_POST_TICKET_UID,
      31,
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          blocked_reason: 'content_safety_blocked_phrase',
          provider_payload: expect.objectContaining({
            contentSafety: expect.objectContaining({
              decision: 'blocked',
              reason: 'blocked_phrase',
              phraseHash: expect.any(String),
            }),
          }),
        }),
      })
    );
    expect(JSON.stringify(entityService.update.mock.calls)).not.toContain('gwarantowany zysk');
  });

  it('autonomous social publish agent reschedules tickets when daily cap is reached', async () => {
    const now = new Date('2026-05-05T10:00:00.000Z');
    const workflow = {
      id: 7,
      enabled: true,
      auto_publish: true,
      enabled_channels: ['twitter'],
      auto_publish_guardrails: {
        social: {
          max_posts_per_platform_per_day: { twitter: 1 },
          cooldown_minutes: { twitter: 0 },
        },
      },
    };
    const ticket = {
      id: 22,
      platform: 'twitter',
      status: 'scheduled',
      caption: 'Kolejny horoskop',
      media_url: 'https://star-sign.app/assets/og-default.jpg',
      target_url: 'https://star-sign.app/horoskopy',
      scheduled_at: now.toISOString(),
      attempt_count: 0,
      workflow,
      provider_payload: { source: 'test' },
    };
    const entityService = {
      findMany: vi.fn(async (uid: string, options?: any) => {
        if (uid !== SOCIAL_POST_TICKET_UID) {
          return [];
        }

        const filters = options?.filters ?? {};
        if (filters.status?.$in) {
          return [ticket];
        }

        if (filters.status === 'published' && filters.published_on?.$gte) {
          return [{ id: 99 }];
        }

        return [];
      }),
      update: vi.fn(async () => ({})),
    };
    const api = socialPublisher({ strapi: createStrapi({}, entityService) });
    api.publishToProvider = vi.fn(async () => ({
      providerPostId: 'x-post-2',
    }));

    const result = await api.publishPending(now);

    expect(result).toEqual({ processed: 1, published: 0, failed: 0, rescheduled: 1 });
    expect(api.publishToProvider).not.toHaveBeenCalled();
    expect(entityService.update).toHaveBeenCalledWith(
      SOCIAL_POST_TICKET_UID,
      22,
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'scheduled',
          blocked_reason: 'autonomous_daily_cap',
          provider_payload: expect.objectContaining({
            autonomousAgent: expect.objectContaining({
              decision: 'rescheduled',
              reason: 'autonomous_daily_cap',
            }),
          }),
        }),
      })
    );
  });

  it('autonomous social publish agent caps provider calls per run', async () => {
    const now = new Date('2026-05-05T10:00:00.000Z');
    const workflow = {
      id: 7,
      enabled: true,
      auto_publish: true,
      enabled_channels: ['twitter'],
      retry_max: 3,
      retry_backoff_seconds: 15,
      auto_publish_guardrails: {
        social: {
          max_posts_per_run: 1,
          max_posts_per_platform_per_day: { twitter: 10 },
          cooldown_minutes: { twitter: 0 },
        },
      },
    };
    const tickets = [21, 22].map((id) => ({
      id,
      platform: 'twitter',
      status: 'scheduled',
      caption: `Horoskop ${id}`,
      media_url: 'https://star-sign.app/assets/og-default.jpg',
      target_url: 'https://star-sign.app/horoskopy',
      scheduled_at: now.toISOString(),
      attempt_count: 0,
      workflow,
      provider_payload: { source: 'test' },
    }));
    const entityService = {
      findMany: vi.fn(async (uid: string, options?: any) => {
        if (uid !== SOCIAL_POST_TICKET_UID) {
          return [];
        }

        const filters = options?.filters ?? {};
        if (filters.status?.$in) {
          return tickets;
        }

        if (filters.status === 'published') {
          return [];
        }

        return [];
      }),
      update: vi.fn(async () => ({})),
    };
    const api = socialPublisher({ strapi: createStrapi({}, entityService) });
    api.publishToProvider = vi.fn(async () => ({
      providerPostId: 'x-post',
    }));

    const result = await api.publishPending(now);

    expect(result).toEqual({ processed: 2, published: 1, failed: 0, rescheduled: 1 });
    expect(api.publishToProvider).toHaveBeenCalledTimes(1);
    expect(entityService.update).toHaveBeenCalledWith(
      SOCIAL_POST_TICKET_UID,
      22,
      expect.objectContaining({
        data: expect.objectContaining({
          blocked_reason: 'autonomous_run_cap',
          provider_payload: expect.objectContaining({
            autonomousAgent: expect.objectContaining({
              reason: 'autonomous_run_cap',
            }),
          }),
        }),
      })
    );
  });

  it('finds a publish cron occurrence by local day in the workflow timezone', () => {
    const strapi = createStrapi({}, {});
    const api = orchestrator({ strapi });
    const publishAt = api.getPublishDateForLocalDay('0 0 * * *', '2026-04-28', 'Europe/Warsaw');

    expect(formatDateInZone(publishAt, 'Europe/Warsaw')).toBe('2026-04-28');
    expect(publishAt.toISOString()).toBe('2026-04-27T22:00:00.000Z');
  });

  it('allows disabled workflow drafts without a token but blocks enabled workflows without one', () => {
    const strapi = createStrapi({}, {});
    const service = workflows({ strapi });

    expect(() =>
      service.validateInput(
        {
          enabled: false,
          workflow_type: 'horoscope',
          generate_cron: '0 23 * * *',
          publish_cron: '0 0 * * *',
        },
        true
      )
    ).not.toThrow();

    expect(() =>
      service.validateInput(
        {
          enabled: true,
          workflow_type: 'horoscope',
          generate_cron: '0 23 * * *',
          publish_cron: '0 0 * * *',
        },
        true
      )
    ).toThrow('wyłączony draft');
  });

  it('requires a category for daily card workflows', () => {
    const strapi = createStrapi({}, {});
    const service = workflows({ strapi });

    expect(() =>
      service.validateInput(
        {
          enabled: true,
          apiToken: 'test-token',
          workflow_type: 'daily_card',
          generate_cron: '0 23 * * *',
          publish_cron: '0 0 * * *',
        },
        true
      )
    ).toThrow('article/daily_card');
  });

  it('lets mixed topic workflows claim unassigned pending topics', async () => {
    const update = vi.fn(async () => ({}));
    const entityService = {
      findOne: vi.fn(async (uid: string) => {
        if (uid === WORKFLOW_UID) {
          return { topic_mode: 'mixed' };
        }

        return { id: 12, title: 'Unassigned topic', workflow: { id: 5 } };
      }),
      findMany: vi.fn(async (uid: string, query: Record<string, unknown>) => {
        expect(uid).toBe(TOPIC_QUEUE_UID);
        expect(query.filters).toMatchObject({
          status: 'pending',
          $or: [{ workflow: 5 }, { workflow: { $null: true } }],
        });

        return [{ id: 12, title: 'Unassigned topic', status: 'pending', workflow: null }];
      }),
      update,
    };
    const strapi = createStrapi({}, entityService);

    const next = await topics({ strapi }).takeNextForWorkflow(
      5,
      new Date('2026-04-28T10:00:00.000Z')
    );

    expect(next?.id).toBe(12);
    expect(update).toHaveBeenCalledWith(
      TOPIC_QUEUE_UID,
      12,
      expect.objectContaining({
        data: expect.objectContaining({ status: 'processing', workflow: 5 }),
      })
    );
  });

  it('strategy planner skips duplicate plan candidates and queues the new topic', async () => {
    const weekStart = '2026-05-04';
    const firstTitle = `Astrologia: astrologiczny przewodnik na ${weekStart}`;
    const duplicateKey = slugify(`moon:${firstTitle}`);
    const createdPlans: any[] = [];
    const topicsCreate = vi.fn(async (input: Record<string, unknown>) => ({
      id: 501,
      title: input.title,
      status: 'pending',
      workflow: input.workflow,
      article_category: input.article_category,
      metadata: input.metadata,
    }));
    const update = vi.fn(async () => ({}));
    const entityService = {
      findMany: vi.fn(async (uid: string, query?: Record<string, unknown>) => {
        if (uid === WORKFLOW_UID) {
          return [
            {
              id: 7,
              workflow_type: 'article',
              enabled: true,
              strategy_enabled: true,
              content_cluster: 'moon',
              article_category: { id: 3 },
            },
          ];
        }

        if (uid === CONTENT_UIDS.category) {
          return [{ id: 3, name: 'Astrologia', slug: 'astrologia' }];
        }

        if (uid === CONTENT_PERFORMANCE_SNAPSHOT_UID) {
          return [];
        }

        if (uid === CONTENT_PLAN_ITEM_UID && query?.fields) {
          return [{ id: 99, title: firstTitle, dedupe_key: duplicateKey }];
        }

        if (uid === CONTENT_PLAN_ITEM_UID) {
          return createdPlans;
        }

        if (uid === TOPIC_QUEUE_UID && query?.fields) {
          return [];
        }

        if (uid === TOPIC_QUEUE_UID) {
          return [];
        }

        return [];
      }),
      create: vi.fn(async (uid: string, payload: any) => {
        if (uid === CONTENT_PLAN_ITEM_UID) {
          const record = { id: 100 + createdPlans.length, ...payload.data };
          createdPlans.push(record);
          return record;
        }

        return { id: 1, ...payload.data };
      }),
      update,
    };
    const strapi = createStrapi({ topics: { create: topicsCreate } }, entityService);
    const planner = strategyPlanner({ strapi });

    const plan = await planner.generatePlan({ weekStart, limit: 2 });
    const approved = await planner.approvePlan({ limit: 10 });

    expect(plan).toMatchObject({ created: 2, skipped: 1, weekStart });
    expect(createdPlans.map((item) => item.title)).not.toContain(firstTitle);
    expect(topicsCreate).toHaveBeenCalledTimes(2);
    expect(topicsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: createdPlans[0].title,
        workflow: 7,
        article_category: 3,
        metadata: expect.objectContaining({ source: 'strategy_agent', planItemId: 100 }),
      })
    );
    expect(update).toHaveBeenCalledWith(
      CONTENT_PLAN_ITEM_UID,
      100,
      expect.objectContaining({
        data: expect.objectContaining({ status: 'queued', generated_topic: 501 }),
      })
    );
    expect(approved).toMatchObject({ queued: 2, skipped: 0 });
  });

  it('strategy autopilot fills a low topic backlog', async () => {
    const createdPlans: any[] = [];
    const createdTopics: any[] = [];
    const topicsCreate = vi.fn(async (input: Record<string, unknown>) => {
      const record = { id: 900 + createdTopics.length, status: 'pending', ...input };
      createdTopics.push(record);
      return record;
    });
    const update = vi.fn(async () => ({}));
    const entityService = {
      findMany: vi.fn(async (uid: string, query?: Record<string, unknown>) => {
        if (uid === WORKFLOW_UID) {
          return [
            {
              id: 7,
              workflow_type: 'article',
              enabled: true,
              strategy_enabled: true,
              content_cluster: 'moon',
              article_category: { id: 3 },
              auto_publish_guardrails: {
                strategy: {
                  min_topic_backlog: 2,
                  max_plan_items_per_tick: 2,
                  auto_approve_plan: true,
                },
              },
            },
          ];
        }

        if (uid === TOPIC_QUEUE_UID && (query?.filters as any)?.status?.$in) {
          return [];
        }

        if (uid === CONTENT_UIDS.category) {
          return [{ id: 3, name: 'Astrologia', slug: 'astrologia' }];
        }

        if (uid === CONTENT_PERFORMANCE_SNAPSHOT_UID) {
          return [];
        }

        if (uid === CONTENT_PLAN_ITEM_UID && query?.fields) {
          return [];
        }

        if (uid === TOPIC_QUEUE_UID && query?.fields) {
          return [];
        }

        if (uid === CONTENT_PLAN_ITEM_UID) {
          return createdPlans;
        }

        if (uid === TOPIC_QUEUE_UID) {
          return [];
        }

        return [];
      }),
      create: vi.fn(async (uid: string, payload: any) => {
        if (uid === CONTENT_PLAN_ITEM_UID) {
          const record = { id: 100 + createdPlans.length, ...payload.data };
          createdPlans.push(record);
          return record;
        }

        return { id: 1, ...payload.data };
      }),
      update,
    };
    const strapi = createStrapi({ topics: { create: topicsCreate } }, entityService);

    const result = await strategyPlanner({ strapi }).runAutopilot({
      now: new Date('2026-05-05T08:30:00.000Z'),
    });

    expect(result).toMatchObject({
      workflows: 1,
      generated: 2,
      queued: 2,
      skipped: 0,
      details: [
        expect.objectContaining({
          workflowId: 7,
          backlog: 0,
          reason: 'queued',
        }),
      ],
    });
    expect(createdPlans).toHaveLength(2);
    expect(topicsCreate).toHaveBeenCalledTimes(2);
    expect(topicsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow: 7,
        article_category: 3,
        metadata: expect.objectContaining({
          trigger: 'strategy_autopilot',
          strategyMetadata: expect.objectContaining({ trigger: 'strategy_autopilot' }),
        }),
      })
    );
    expect(update).toHaveBeenCalledWith(
      CONTENT_PLAN_ITEM_UID,
      100,
      expect.objectContaining({
        data: expect.objectContaining({ status: 'queued', generated_topic: 900 }),
      })
    );
  });

  it('strategy autopilot creates planned items by default without queueing topics', async () => {
    const createdPlans: any[] = [];
    const topicsCreate = vi.fn();
    const entityService = {
      findMany: vi.fn(async (uid: string, query?: Record<string, unknown>) => {
        if (uid === WORKFLOW_UID) {
          return [
            {
              id: 7,
              workflow_type: 'article',
              enabled: true,
              strategy_enabled: true,
              content_cluster: 'moon',
              article_category: { id: 3 },
              auto_publish_guardrails: {
                strategy: {
                  min_topic_backlog: 1,
                  max_plan_items_per_tick: 1,
                },
              },
            },
          ];
        }

        if (uid === TOPIC_QUEUE_UID && (query?.filters as any)?.status?.$in) {
          return [];
        }

        if (uid === CONTENT_PLAN_ITEM_UID && (query?.filters as any)?.status?.$in) {
          return [];
        }

        if (uid === CONTENT_UIDS.category) {
          return [{ id: 3, name: 'Astrologia', slug: 'astrologia' }];
        }

        if (uid === CONTENT_PERFORMANCE_SNAPSHOT_UID) {
          return [];
        }

        if (uid === CONTENT_PLAN_ITEM_UID && query?.fields) {
          return [];
        }

        if (uid === TOPIC_QUEUE_UID && query?.fields) {
          return [];
        }

        return [];
      }),
      create: vi.fn(async (uid: string, payload: any) => {
        if (uid === CONTENT_PLAN_ITEM_UID) {
          const record = { id: 100 + createdPlans.length, ...payload.data };
          createdPlans.push(record);
          return record;
        }

        return { id: 1, ...payload.data };
      }),
      update: vi.fn(),
    };
    const strapi = createStrapi({ topics: { create: topicsCreate } }, entityService);

    const result = await strategyPlanner({ strapi }).runAutopilot({
      now: new Date('2026-05-05T08:30:00.000Z'),
    });

    expect(result).toMatchObject({
      workflows: 1,
      generated: 1,
      queued: 0,
      details: [expect.objectContaining({ reason: 'planned_only' })],
    });
    expect(createdPlans).toHaveLength(1);
    expect(createdPlans[0]).toMatchObject({
      status: 'planned',
      metadata: expect.objectContaining({ trigger: 'strategy_autopilot' }),
    });
    expect(topicsCreate).not.toHaveBeenCalled();
  });

  it('strategy autopilot skips workflows with healthy topic backlog', async () => {
    const create = vi.fn();
    const entityService = {
      findMany: vi.fn(async (uid: string, query?: Record<string, unknown>) => {
        if (uid === WORKFLOW_UID) {
          return [
            {
              id: 7,
              workflow_type: 'article',
              enabled: true,
              strategy_enabled: true,
              auto_publish_guardrails: {
                strategy: {
                  min_topic_backlog: 2,
                  max_plan_items_per_tick: 2,
                },
              },
            },
          ];
        }

        if (uid === TOPIC_QUEUE_UID && (query?.filters as any)?.status?.$in) {
          return [
            { id: 1, status: 'pending' },
            { id: 2, status: 'pending' },
          ];
        }

        return [];
      }),
      create,
      update: vi.fn(),
    };
    const strapi = createStrapi({ topics: { create: vi.fn() } }, entityService);

    const result = await strategyPlanner({ strapi }).runAutopilot({
      now: new Date('2026-05-05T08:30:00.000Z'),
    });

    expect(result).toMatchObject({
      workflows: 1,
      generated: 0,
      queued: 0,
      skipped: 0,
      details: [
        expect.objectContaining({
          workflowId: 7,
          backlog: 2,
          reason: 'backlog_healthy',
        }),
      ],
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('orchestrator tick skips strategy autopilot without global opt-in', async () => {
    const calls: string[] = [];
    const runAutopilot = vi.fn(async () => {
      calls.push('strategy');
    });
    const publishPending = vi.fn(async () => {
      calls.push('social');
    });
    const strapi = createStrapi(
      {
        'strategy-planner': { runAutopilot },
        'social-publisher': { publishPending },
      },
      {}
    );
    (strapi as any).store = vi.fn(() => ({
      get: vi.fn(async () => ({ aico_auto_publish_enabled: true })),
    }));

    const api = orchestrator({ strapi });
    api.processGenerationTick = vi.fn(async () => {
      calls.push('generation');
    });
    api.processPublicationTick = vi.fn(async () => {
      calls.push('publication');
    });

    await api.tick();

    expect(calls).toEqual(['generation', 'publication', 'social']);
    expect(runAutopilot).not.toHaveBeenCalled();
  });

  it('orchestrator tick uses runtime lock when the service is available', async () => {
    const calls: string[] = [];
    const withLock = vi.fn(async (_key: string, _input: unknown, runner: () => Promise<void>) => {
      calls.push('lock');
      await runner();
    });
    const strapi = createStrapi(
      {
        'runtime-locks': { withLock },
        'strategy-planner': { runAutopilot: vi.fn() },
        'social-publisher': {
          publishPending: vi.fn(async () => {
            calls.push('social');
          }),
        },
      },
      {}
    );
    (strapi as any).store = vi.fn(() => ({
      get: vi.fn(async () => ({ aico_auto_publish_enabled: true })),
    }));
    const api = orchestrator({ strapi });
    api.processGenerationTick = vi.fn(async () => {
      calls.push('generation');
    });
    api.processPublicationTick = vi.fn(async () => {
      calls.push('publication');
    });

    await api.tick();

    expect(withLock).toHaveBeenCalledWith(
      'orchestrator.tick',
      expect.objectContaining({ ttlMs: 55000 }),
      expect.any(Function)
    );
    expect(calls).toEqual(['lock', 'generation', 'publication', 'social']);
  });

  it('orchestrator runNow skips manual generation when workflow runtime lock is held', async () => {
    const withLock = vi.fn(async () => undefined);
    const strapi = createStrapi(
      {
        'runtime-locks': { withLock },
        workflows: {
          getByIdOrThrow: vi.fn(async () => ({ id: 7, workflow_type: 'article' })),
        },
      },
      {}
    );
    const api = orchestrator({ strapi });

    const result = await api.runNow(7, 'manual-button');

    expect(withLock).toHaveBeenCalledWith(
      'orchestrator.generation.workflow.7',
      expect.objectContaining({
        metadata: expect.objectContaining({
          workflowId: 7,
          runType: 'manual',
          reason: 'manual-button',
        }),
      }),
      expect.any(Function)
    );
    expect(result).toMatchObject({
      workflowId: 7,
      skipped: true,
      reason: 'runtime_lock_held',
      lockKey: 'orchestrator.generation.workflow.7',
    });
  });

  it('orchestrator backfill uses a workflow-scoped lock for the whole date range', async () => {
    const withLock = vi.fn(async () => undefined);
    const strapi = createStrapi(
      {
        'runtime-locks': { withLock },
        workflows: {
          getByIdOrThrow: vi.fn(async () => ({ id: 7, workflow_type: 'article' })),
          normalizeRuntime: vi.fn(() => ({
            timezone: 'Europe/Warsaw',
            publishCron: '0 8 * * *',
          })),
        },
      },
      {}
    );
    const api = orchestrator({ strapi });

    const result = await api.backfill(7, {
      startDate: '2026-05-01',
      endDate: '2026-05-02',
    });

    expect(withLock).toHaveBeenCalledWith(
      'orchestrator.backfill.workflow.7',
      expect.objectContaining({
        metadata: expect.objectContaining({
          source: 'backfill',
          workflowId: 7,
          startDate: '2026-05-01',
          endDate: '2026-05-02',
        }),
      }),
      expect.any(Function)
    );
    expect(result).toMatchObject({
      workflowId: 7,
      processed: 2,
      skipped: 2,
      succeeded: 0,
      failed: 0,
      reason: 'runtime_lock_held',
      lockKey: 'orchestrator.backfill.workflow.7',
    });
  });

  it('orchestrator tick runs strategy autopilot before generation when globally enabled', async () => {
    const calls: string[] = [];
    const runAutopilot = vi.fn(async () => {
      calls.push('strategy');
    });
    const publishPending = vi.fn(async () => {
      calls.push('social');
    });
    const strapi = createStrapi(
      {
        'strategy-planner': { runAutopilot },
        'social-publisher': { publishPending },
      },
      {}
    );
    (strapi as any).store = vi.fn(() => ({
      get: vi.fn(async () => ({
        aico_auto_publish_enabled: true,
        aico_strategy_autopilot_enabled: true,
      })),
    }));

    const api = orchestrator({ strapi });
    api.processGenerationTick = vi.fn(async () => {
      calls.push('generation');
    });
    api.processPublicationTick = vi.fn(async () => {
      calls.push('publication');
    });

    await api.tick();

    expect(calls).toEqual(['strategy', 'generation', 'publication', 'social']);
    expect(runAutopilot).toHaveBeenCalledWith({ now: expect.any(Date) });
  });

  it('SEO guardrail blocks slug/title conflicts and missing article category', async () => {
    const entityService = {
      findMany: vi.fn(async (uid: string) => {
        expect(uid).toBe(CONTENT_UIDS.article);
        return [{ id: 42, title: 'Pełnia księżyca i rytuały', slug: 'pelnia-ksiezyca' }];
      }),
    };
    const api = seoGuardrails({ strapi: createStrapi({}, entityService) });
    const repeatedText = Array.from({ length: 90 }, (_, index) => `słowo${index}`).join(' ');
    const repeatedPremium = Array.from({ length: 45 }, (_, index) => `premium${index}`).join(' ');

    const report = await api.evaluateArticleDraft({
      payload: {
        title: 'Pełnia księżyca i rytuały',
        excerpt: 'Praktyczny przewodnik po pracy z energią pełni księżyca.',
        content: `${repeatedText} <a href="/artykuly">Czytaj dalej</a>`,
        premiumContent: repeatedPremium,
      },
      slug: 'pelnia-ksiezyca',
      categoryId: null,
      autoPublish: true,
    });

    expect(report.decision).toBe('fail');
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'category.present', status: 'fail' }),
        expect.objectContaining({
          id: 'duplicate.slug-title',
          status: 'fail',
          details: expect.objectContaining({ id: 42, slug: 'pelnia-ksiezyca' }),
        }),
      ])
    );
  });

  it('performance feedback aggregates analytics and social signals into a snapshot', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-04T12:00:00.000Z'));

    const createdSnapshots: any[] = [];
    const entityService = {
      findMany: vi.fn(async (uid: string, query?: Record<string, unknown>) => {
        if (uid === CONTENT_UIDS.article) {
          return [
            {
              id: 12,
              title: 'Rytuał nowiu',
              slug: 'rytual-nowiu',
              publishedAt: '2026-05-01T00:00:00.000Z',
            },
          ];
        }

        if (uid === CONTENT_UIDS.analyticsEvent) {
          expect(query?.filters).toMatchObject({
            occurred_at: {
              $gte: '2026-05-03T00:00:00.000Z',
              $lt: '2026-05-04T00:00:00.000Z',
            },
          });
          return [
            { id: 1, event_type: 'view_item', content_id: '12', content_slug: 'rytual-nowiu' },
            {
              id: 2,
              event_type: 'premium_content_view',
              content_id: '12',
              content_slug: 'rytual-nowiu',
            },
            {
              id: 3,
              event_type: 'premium_cta_click',
              content_id: '12',
              content_slug: 'rytual-nowiu',
            },
            {
              id: 4,
              event_type: 'begin_checkout',
              content_id: '12',
              content_slug: 'rytual-nowiu',
            },
          ];
        }

        if (uid === SOCIAL_POST_TICKET_UID) {
          return [
            { id: 21, status: 'published', related_content_id: 12 },
            { id: 23, status: 'published', related_content_id: 12 },
            { id: 22, status: 'failed', related_content_id: 12 },
          ];
        }

        if (uid === CONTENT_PERFORMANCE_SNAPSHOT_UID) {
          return [];
        }

        return [];
      }),
      create: vi.fn(async (uid: string, payload: any) => {
        expect(uid).toBe(CONTENT_PERFORMANCE_SNAPSHOT_UID);
        const record = { id: 701, ...payload.data };
        createdSnapshots.push(record);
        return record;
      }),
      update: vi.fn(),
    };
    const api = performanceFeedback({ strapi: createStrapi({}, entityService) });

    const result = await api.aggregate({ day: '2026-05-03', limit: 10 });

    expect(result).toMatchObject({ day: '2026-05-03', processed: 1 });
    expect(createdSnapshots[0]).toMatchObject({
      unique_key: `${CONTENT_UIDS.article}:12:2026-05-03`,
      snapshot_day: '2026-05-03',
      content_entry_id: 12,
      views: 2,
      premium_events: 1,
      cta_clicks: 1,
      checkout_events: 1,
      social_published: 2,
      social_failed: 1,
      freshness_days: 3,
      metadata: expect.objectContaining({ source: 'performance-feedback' }),
    });
    expect(createdSnapshots[0].recommendations).toEqual(
      expect.objectContaining({
        actions: expect.arrayContaining(['promote_on_homepage', 'retry_or_rewrite_social']),
      })
    );

    vi.useRealTimers();
  });

  it('global auto-publish kill switch blocks publication ticket creation for article drafts', async () => {
    const create = vi.fn(async (uid: string, payload: any) => {
      if (uid === CONTENT_UIDS.article) {
        return { id: 77, ...payload.data };
      }

      return { id: 1, ...payload.data };
    });
    const entityService = {
      findMany: vi.fn(async () => []),
      create,
      update: vi.fn(),
    };
    const mediaSelector = {
      resolveForArticle: vi.fn(async () => ({ mediaAssetId: 9, uploadFileId: 10 })),
      registerUsage: vi.fn(async () => ({})),
    };
    const strapi = createStrapi(
      {
        workflows: {
          decryptTokenForRuntime: vi.fn(async () => 'token'),
          decryptImageTokenForRuntime: vi.fn(async () => null),
        },
        'media-selector': mediaSelector,
        'seo-guardrails': {
          evaluateArticleDraft: vi.fn(async () => ({ decision: 'pass', score: 100, checks: [] })),
        },
      },
      entityService
    );
    (strapi as any).store = vi.fn(() => ({
      get: vi.fn(async () => ({ aico_auto_publish_enabled: false })),
    }));

    const result = await orchestrator({ strapi }).upsertArticleDraft({
      workflow: { id: 7, workflow_type: 'article' } as any,
      config: {
        autoPublish: true,
        forceRegenerate: false,
        llmModel: 'test-model',
        imageGenModel: 'test-image-model',
      } as any,
      payload: {
        title: 'Astrologiczny przewodnik nowiu',
        excerpt: 'Praktyczne wskazówki dla czytelników Star Sign.',
        content: 'Publiczna część artykułu z linkiem /artykuly.',
        premiumContent: 'Rozszerzona część premium pozostaje otwarta.',
      },
      workflowType: 'article',
      publishAt: new Date('2026-05-04T08:00:00.000Z'),
      businessKey: 'article:2026-05-04:nów',
      categoryId: 3,
      imageContextKey: 'article:2026-05-04:nów',
      targetDate: '2026-05-04',
    });

    expect(result).toMatchObject({ created: 1, updated: 0, skipped: 0, articleId: 77 });
    expect(mediaSelector.registerUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        contentUid: CONTENT_UIDS.article,
        contentEntryId: 77,
      })
    );
    expect(create).not.toHaveBeenCalledWith(
      PUBLICATION_TICKET_UID,
      expect.objectContaining({ data: expect.any(Object) })
    );
  });

  it('maps Polish horoscope filenames to horoscope media suggestions', () => {
    const suggestion = suggestMediaMapping({
      fileName: 'horoskop-baran-dzienny-01.webp',
      existingAssetKeys: new Set(),
    });

    expect(suggestion).toMatchObject({
      purpose: 'horoscope_sign',
      sign_slug: 'baran',
      period_scope: 'daily',
      asset_key: 'horoscope-baran-daily-01',
    });
  });

  it('maps tarot sign filenames to horoscope media suggestions', () => {
    const suggestion = suggestMediaMapping({
      fileName: 'tarot_baran.webp',
      existingAssetKeys: new Set(),
    });

    expect(suggestion).toMatchObject({
      purpose: 'horoscope_sign',
      sign_slug: 'baran',
      asset_key: 'horoscope-baran-daily-01',
    });
  });

  it('keeps sign slug for zodiac profile media suggestions', () => {
    const suggestion = suggestMediaMapping({
      fileName: 'zodiac-baran-profile-01.webp',
      existingAssetKeys: new Set(),
    });

    expect(suggestion).toMatchObject({
      purpose: 'zodiac_profile',
      sign_slug: 'baran',
      asset_key: 'zodiac-profile-baran-01',
    });
  });

  it('keeps sign slug when previewing zodiac profile media asset identity', async () => {
    const entityService = {
      findOne: vi.fn(async () => ({
        id: 14,
        name: 'zodiac-baran-profile-01.webp',
      })),
      findMany: vi.fn(async () => []),
    };
    const strapi = createStrapi({}, entityService);

    const result = await mediaAssets({ strapi }).previewIdentity({
      fileId: 14,
      purpose: 'zodiac_profile',
      sign_slug: 'baran',
      period_scope: 'any',
    });

    expect(result).toMatchObject({
      fileId: 14,
      purpose: 'zodiac_profile',
      sign_slug: 'baran',
      asset_key: 'zodiac-profile-baran-01',
    });
  });
});
