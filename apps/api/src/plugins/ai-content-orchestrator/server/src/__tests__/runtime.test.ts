import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PLUGIN_ID,
  PUBLICATION_TICKET_UID,
  RUN_LOG_UID,
  RUN_STATUS,
  TICKET_STATUS,
  TOPIC_QUEUE_UID,
  WORKFLOW_UID,
  WORKFLOW_STATUS,
  HOROSCOPE_PERIODS,
  CONTENT_PLAN_ITEM_UID,
  CONTENT_PERFORMANCE_SNAPSHOT_UID,
  CONTENT_UIDS,
  SOCIAL_POST_TICKET_UID,
  AUDIT_EVENT_UID,
  RUNTIME_LOCK_UID,
  AUTONOMY_POLICY_UID,
  AD_CAMPAIGN_PLAN_UID,
  GENERATION_JOB_UID,
  VIDEO_ASSET_UID,
  PROVIDER_CREDENTIAL_STATUS_UID,
  TRAFFIC_SNAPSHOT_UID,
} from '../constants';
import orchestrator from '../services/orchestrator';
import adsAgent from '../services/ads-agent';
import adsProviderAdapter from '../services/ads-provider-adapter';
import auditTrail from '../services/audit-trail';
import autopilot from '../services/autopilot';
import autonomyPolicy from '../services/autonomy-policy';
import performanceFeedback from '../services/performance-feedback';
import runtimeLocks from '../services/runtime-locks';
import runsService from '../services/runs';
import mediaAssets from '../services/media-assets';
import generationJobs from '../services/generation-jobs';
import videoAgent from '../services/video-agent';
import seoGuardrails from '../services/seo-guardrails';
import siteAlive from '../services/site-alive';
import socialPublisher from '../services/social-publisher';
import strategyPlanner from '../services/strategy-planner';
import trafficIngestor from '../services/traffic-ingestor';
import topics from '../services/topics';
import videoProviderAdapter from '../services/video-provider-adapter';
import workflows from '../services/workflows';
import audit from '../services/audit';
import dashboard from '../services/dashboard';
import type { Strapi } from '../types';
import socialPostTicketSchema from '../content-types/social-post-ticket/schema.json';
import adCampaignPlanSchema from '../content-types/ad-campaign-plan/schema.json';
import providerCredentialStatusSchema from '../content-types/provider-credential-status/schema.json';
import { formatDateInZone } from '../utils/date-time';
import {
  redactProviderPayload,
  sanitizeLlmTraceForStorage,
} from '../utils/diagnostic-redaction';
import { suggestMediaMapping } from '../utils/media-mapping';
import { PREMIUM_CONTENT_RETRY_MAX } from '../utils/premium-quality';
import {
  getAicoPromptTemplate,
  resolveAicoContentContractPath,
} from '../utils/aico-contract';
import { evaluatePolishContentQuality } from '../utils/polish-content-quality';
import {
  buildPublicFrontendUrl,
  getPublicFrontendUrl,
  getSocialDefaultImageUrl,
} from '../utils/public-url';
import { slugify } from '../utils/slug';
import adminRoutesFactory from '../routes/admin';
import settingsController from '../controllers/settings';
import topicsController from '../controllers/topics';
import strategyController from '../controllers/strategy';
import mediaAssetsController from '../controllers/media-assets';
import runsController from '../controllers/runs';
import homepageController from '../controllers/homepage';
import adsController from '../controllers/ads';
import autonomyController from '../controllers/autonomy';
import trafficController from '../controllers/traffic';
import providersController from '../controllers/providers';
import openRouter from '../services/open-router';
import providerProbe from '../services/provider-probe';
import providerStatus from '../services/provider-status';
import productionReadiness from '../services/production-readiness';
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
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves the runtime AICO contract independently from current working directory', () => {
    const originalCwd = process.cwd();
    const directory = mkdtempSync(join(tmpdir(), 'aico-runtime-contract-cwd-'));

    try {
      process.chdir(directory);

      const contractPath = resolveAicoContentContractPath();

      expect(contractPath).toMatch(/apps\/api\/src\/bootstrap\/aico-content-contract\.json$/);
      expect(getAicoPromptTemplate('socialTeaser')).toContain('valid JSON');
    } finally {
      process.chdir(originalCwd);
      rmSync(directory, { recursive: true, force: true });
    }
  });

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

  it('builds canonical production social URLs by default', () => {
    vi.stubEnv('AICO_PUBLIC_FRONTEND_URL', '');
    vi.stubEnv('FRONTEND_URL', '');
    vi.stubEnv('PUBLIC_FRONTEND_URL', '');
    vi.stubEnv('AICO_SOCIAL_DEFAULT_IMAGE_URL', '');

    expect(getPublicFrontendUrl()).toBe('https://star-sign.pl');
    expect(buildPublicFrontendUrl('/horoskopy')).toBe('https://star-sign.pl/horoskopy');
    expect(getSocialDefaultImageUrl()).toBe('https://star-sign.pl/assets/og-default.png');
  });

  it('uses explicit public frontend and social image URL overrides', () => {
    vi.stubEnv('FRONTEND_URL', 'https://example.com/');
    vi.stubEnv('AICO_SOCIAL_DEFAULT_IMAGE_URL', 'https://cdn.example.com/og.jpg');

    expect(getPublicFrontendUrl()).toBe('https://example.com');
    expect(buildPublicFrontendUrl('artykuly/test')).toBe('https://example.com/artykuly/test');
    expect(getSocialDefaultImageUrl()).toBe('https://cdn.example.com/og.jpg');
  });

  it('prefers AICO public frontend URL and falls back from invalid values', () => {
    vi.stubEnv('AICO_PUBLIC_FRONTEND_URL', 'https://star-sign.pl/');
    vi.stubEnv('FRONTEND_URL', 'https://example.com');

    expect(getPublicFrontendUrl()).toBe('https://star-sign.pl');

    vi.stubEnv('AICO_PUBLIC_FRONTEND_URL', 'ftp://invalid.example.com');
    vi.stubEnv('FRONTEND_URL', '');
    vi.stubEnv('PUBLIC_FRONTEND_URL', '');

    expect(getPublicFrontendUrl()).toBe('https://star-sign.pl');
    expect(buildPublicFrontendUrl('/horoskopy')).not.toContain('star-sign.app');
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
    const now = new Date('2026-05-05T12:00:00.000Z');

    const result = await service.listPublic({ status: 'active', limit: 50, now });

    expect(entityService.findMany).toHaveBeenCalledWith(
      'plugin::ai-content-orchestrator.homepage-recommendation',
      expect.objectContaining({
        filters: {
          status: 'active',
          $and: [
            {
              $or: [
                { starts_at: { $null: true } },
                { starts_at: { $lte: now.toISOString() } },
              ],
            },
            {
              $or: [
                { expires_at: { $null: true } },
                { expires_at: { $gte: now.toISOString() } },
              ],
            },
          ],
        },
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

  it('admin traffic import and provider probe routes require write/probe permissions', () => {
    const routes = adminRoutesFactory().routes;
    const trafficSnapshots = routes.find((route) => route.method === 'GET' && route.path === '/traffic/snapshots');
    const trafficImport = routes.find((route) => route.method === 'POST' && route.path === '/traffic/import');
    const providerStatus = routes.find((route) => route.method === 'GET' && route.path === '/providers/status');
    const providerProbeRoute = routes.find(
      (route) => route.method === 'POST' && route.path === '/providers/test-readiness'
    );
    const videoRenderRoute = routes.find(
      (route) => route.method === 'POST' && route.path === '/video/assets/:id/render'
    );
    const adsActivateRoute = routes.find(
      (route) => route.method === 'POST' && route.path === '/ads/campaign-plans/:id/activate'
    );
    const adsStopLossRoute = routes.find(
      (route) => route.method === 'POST' && route.path === '/ads/campaign-plans/stop-loss'
    );
    const adsPauseRoute = routes.find(
      (route) => route.method === 'POST' && route.path === '/ads/campaign-plans/:id/pause'
    );

    expect(trafficSnapshots?.config?.policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          config: { actions: ['plugin::ai-content-orchestrator.view-traffic'] },
        }),
      ])
    );
    expect(trafficImport?.config?.policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          config: { actions: ['plugin::ai-content-orchestrator.import-traffic'] },
        }),
      ])
    );
    expect(providerStatus?.config?.policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          config: { actions: ['plugin::ai-content-orchestrator.view-provider-status'] },
        }),
      ])
    );
    expect(providerProbeRoute?.config?.policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          config: { actions: ['plugin::ai-content-orchestrator.test-provider-readiness'] },
        }),
      ])
    );
    expect(videoRenderRoute?.config?.policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          config: { actions: ['plugin::ai-content-orchestrator.render-video'] },
        }),
      ])
    );
    expect(adsActivateRoute?.config?.policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          config: { actions: ['plugin::ai-content-orchestrator.activate-ads'] },
        }),
      ])
    );
    expect(adsPauseRoute?.config?.policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          config: { actions: ['plugin::ai-content-orchestrator.pause-ads'] },
        }),
      ])
    );
    expect(adsStopLossRoute?.config?.policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          config: { actions: ['plugin::ai-content-orchestrator.pause-ads'] },
        }),
      ])
    );
  });

  it('hides ads plans and provider readiness records from direct Content Manager editing', () => {
    expect(adCampaignPlanSchema.pluginOptions).toMatchObject({
      'content-manager': { visible: false },
      'content-type-builder': { visible: false },
    });
    expect(providerCredentialStatusSchema.pluginOptions).toMatchObject({
      'content-manager': { visible: false },
      'content-type-builder': { visible: false },
    });
  });

  it('manual ads stop-loss controller requires confirmation and audits the sweep', async () => {
    const pauseActiveForKillSwitch = vi.fn(async () => ({
      reason: 'manual_admin_stop_loss',
      attempted: 2,
      paused: 1,
      blocked: 1,
      failed: 0,
      results: [],
    }));
    const auditService = { recordFromContext: vi.fn(async () => ({ id: 1 })) };
    const service = adsController({
      strapi: createStrapi(
        {
          'ads-agent': { pauseActiveForKillSwitch },
          'audit-trail': auditService,
        },
        {}
      ),
    });

    const blockedCtx = createCtx({ body: { confirmation: 'WRONG' } });
    await service.pauseActive(blockedCtx);

    expect(blockedCtx.badRequest).toHaveBeenCalledWith('Wymagane potwierdzenie PAUSE_ACTIVE_ADS.');
    expect(pauseActiveForKillSwitch).not.toHaveBeenCalled();
    expect(auditService.recordFromContext).toHaveBeenCalledWith(
      blockedCtx,
      expect.objectContaining({
        action: 'ads.campaign-plan.stop-loss',
        outcome: 'skipped',
        severity: 'warn',
        metadata: expect.objectContaining({
          reason: 'confirmation_required',
          requiredConfirmation: 'PAUSE_ACTIVE_ADS',
        }),
      })
    );

    const confirmedCtx = createCtx({ body: { confirmation: 'PAUSE_ACTIVE_ADS' } });
    await service.pauseActive(confirmedCtx);

    expect(pauseActiveForKillSwitch).toHaveBeenCalledWith({
      reason: 'manual_admin_stop_loss',
    });
    expect(confirmedCtx.body.data).toMatchObject({
      reason: 'manual_admin_stop_loss',
      attempted: 2,
      paused: 1,
      blocked: 1,
      failed: 0,
    });
    expect(auditService.recordFromContext).toHaveBeenCalledWith(
      confirmedCtx,
      expect.objectContaining({
        action: 'ads.campaign-plan.stop-loss',
        outcome: 'skipped',
        severity: 'warn',
        metadata: expect.objectContaining({
          reason: 'manual_admin_stop_loss',
          attempted: 2,
          paused: 1,
          blocked: 1,
          failed: 0,
        }),
      })
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

  it('blocks content publication through autonomy policy before mutating the target entry', async () => {
    const now = new Date('2026-04-28T10:00:00.000Z');
    const updates: Array<{ uid: string; id: number; payload: unknown }> = [];
    const setStatus = vi.fn();
    const entityService = {
      findOne: vi.fn(async () => ({
        id: 404,
        publishedAt: null,
      })),
      update: vi.fn(async (uid: string, id: number, payload: unknown) => {
        updates.push({ uid, id, payload });
        return {};
      }),
    };
    const policy = {
      evaluate: vi.fn(async () => ({
        allowed: false,
        reason: 'auto_publish_daily_cap_reached',
      })),
    };
    const auditRecord = vi.fn(async () => ({ id: 1 }));
    const strapi = createStrapi(
      {
        workflows: {
          getById: vi.fn(async () => ({ id: 7, retry_max: 3, retry_backoff_seconds: 15 })),
          markPublishSlot: vi.fn(),
          setStatus,
        },
        'autonomy-policy': policy,
        'audit-trail': { record: auditRecord },
      },
      entityService
    );

    const result = await orchestrator({ strapi }).publishTicket(
      {
        id: 1,
        status: 'scheduled',
        business_key: 'article:404:publish',
        content_uid: 'api::article.article',
        content_entry_id: 404,
        target_publish_at: now.toISOString(),
        retries: 0,
        workflow: { id: 7 },
      },
      now
    );

    expect(result).toBe('failed');
    expect(policy.evaluate).toHaveBeenCalledWith({
      action: 'content.publish',
      requiresBrandSafety: true,
      requiresLegalDisclaimer: true,
    });
    expect(auditRecord).toHaveBeenCalledWith({
      action: 'content.publish.skipped',
      outcome: 'skipped',
      severity: 'warn',
      actor: { actorType: 'system' },
      resourceUid: 'api::article.article',
      resourceId: 404,
      metadata: {
        reason: 'auto_publish_daily_cap_reached',
        ticketId: 1,
        workflowId: 7,
      },
    });
    expect(entityService.findOne).not.toHaveBeenCalled();
    expect(updates).toEqual([
      {
        uid: PUBLICATION_TICKET_UID,
        id: 1,
        payload: {
          data: {
            retries: 1,
            status: TICKET_STATUS.failed,
            last_error:
              'Autonomy policy blocked content publish: auto_publish_daily_cap_reached',
          },
        },
      },
    ]);
    expect(setStatus).toHaveBeenCalledWith(
      7,
      WORKFLOW_STATUS.failed,
      'Autonomy policy blocked content publish: auto_publish_daily_cap_reached'
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

  it('orchestrator tick stops generation, publication and social when global autonomy kill switch is enabled', async () => {
    const calls: string[] = [];
    const runAutopilot = vi.fn(async () => {
      calls.push('strategy');
    });
    const publishPending = vi.fn(async () => {
      calls.push('social');
    });
    const pauseActiveForKillSwitch = vi.fn(async () => ({
      attempted: 2,
      paused: 2,
      blocked: 0,
      failed: 0,
    }));
    const strapi = createStrapi(
      {
        'autonomy-policy': {
          getPolicy: vi.fn(async () => ({
            autonomy_mode: 'full',
            global_kill_switch: true,
          })),
        },
        'ads-agent': { pauseActiveForKillSwitch },
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

    expect(calls).toEqual([]);
    expect(pauseActiveForKillSwitch).toHaveBeenCalledWith({ reason: 'global_kill_switch' });
    expect(runAutopilot).not.toHaveBeenCalled();
    expect(publishPending).not.toHaveBeenCalled();
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

  it('blocks all autonomy actions when the global kill switch is enabled', async () => {
    const entityService = {
      findMany: vi.fn(async (uid: string) => {
        if (uid === AUTONOMY_POLICY_UID) {
          return [
            {
              id: 1,
              policy_key: 'global',
              autonomy_mode: 'full',
              global_kill_switch: true,
              daily_ads_budget_pln: 25,
            },
          ];
        }
        return [];
      }),
      count: vi.fn(async () => 0),
      create: vi.fn(),
    };

    const service = autonomyPolicy({ strapi: createStrapi({}, entityService) });
    const decision = await service.evaluate({
      action: 'ads.mutate',
      platform: 'meta',
      estimatedCostPln: 10,
      requiresBrandSafety: true,
      requiresLegalDisclaimer: true,
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: 'global_kill_switch_or_off_mode',
      mode: 'full',
    });
  });

  it('blocks ad campaign plans that would exceed the 25 PLN daily cap', async () => {
    const entityService = {
      findMany: vi.fn(async (uid: string) => {
        if (uid === AUTONOMY_POLICY_UID) {
          return [
            {
              id: 1,
              policy_key: 'global',
              autonomy_mode: 'full',
              global_kill_switch: false,
              daily_ads_budget_pln: 25,
              daily_meta_ads_budget_pln: 15,
              daily_google_ads_budget_pln: 10,
              max_ads_mutations_per_day: 10,
            },
          ];
        }
        if (uid === AD_CAMPAIGN_PLAN_UID) {
          return [{ daily_budget_pln: 20 }];
        }
        return [];
      }),
      count: vi.fn(async () => 0),
      create: vi.fn(),
    };
    const strapi = createStrapi({}, entityService);
    const policy = autonomyPolicy({ strapi });

    const result = await adsAgent({
      strapi: createStrapi({ 'autonomy-policy': policy }, entityService),
    }).createPlan({
      name: 'Meta test',
      platform: 'meta',
      targetUrl: 'https://star-sign.pl/premium',
      dailyBudgetPln: 15,
    });

    expect(result).toMatchObject({
      allowed: false,
      reason: 'ads_budget_cap_exceeded',
    });
    expect(entityService.create).not.toHaveBeenCalledWith(
      AD_CAMPAIGN_PLAN_UID,
      expect.anything()
    );
  });

  it('enforces declared daily autonomy limits for llm, media, video and auto-publish actions', async () => {
    const entityService = {
      findMany: vi.fn(async (uid: string) => {
        if (uid === AUTONOMY_POLICY_UID) {
          return [
            {
              id: 1,
              policy_key: 'global',
              autonomy_mode: 'full',
              global_kill_switch: false,
              daily_llm_request_limit: 2,
              daily_media_job_limit: 1,
              daily_video_job_limit: 1,
              max_auto_publish_per_day: 1,
            },
          ];
        }
        return [];
      }),
      count: vi.fn(async (uid: string, query?: { filters?: Record<string, unknown> }) => {
        if (uid === GENERATION_JOB_UID) {
          const jobType = query?.filters?.job_type;
          if (typeof jobType === 'object' && jobType && '$in' in jobType) return 2;
          if (jobType === 'image') return 1;
          if (jobType === 'video') return 1;
          return 4;
        }
        if (uid === PUBLICATION_TICKET_UID) return 1;
        return 0;
      }),
      create: vi.fn(),
    };
    const service = autonomyPolicy({ strapi: createStrapi({}, entityService) });

    await expect(
      service.evaluate({
        action: 'llm.generate',
        requiresBrandSafety: true,
        requiresLegalDisclaimer: true,
      })
    ).resolves.toMatchObject({ allowed: false, reason: 'llm_daily_cap_reached' });
    await expect(
      service.evaluate({ action: 'media.generate', requiresBrandSafety: true })
    ).resolves.toMatchObject({ allowed: false, reason: 'media_daily_cap_reached' });
    await expect(
      service.evaluate({
        action: 'video.generate',
        requiresBrandSafety: true,
        requiresLegalDisclaimer: true,
      })
    ).resolves.toMatchObject({ allowed: false, reason: 'video_daily_cap_reached' });
    await expect(
      service.evaluate({
        action: 'content.publish',
        requiresBrandSafety: true,
        requiresLegalDisclaimer: true,
      })
    ).resolves.toMatchObject({ allowed: false, reason: 'auto_publish_daily_cap_reached' });
  });

  it('records a redacted admin audit event when creating an ad campaign plan', async () => {
    const entityService = {
      findMany: vi.fn(async (uid: string) => {
        if (uid === AUTONOMY_POLICY_UID) {
          return [
            {
              id: 1,
              policy_key: 'global',
              autonomy_mode: 'full',
              global_kill_switch: false,
              daily_ads_budget_pln: 25,
              daily_meta_ads_budget_pln: 15,
              max_ads_mutations_per_day: 10,
            },
          ];
        }
        return [];
      }),
      count: vi.fn(async () => 0),
      create: vi.fn(async (uid: string, input: { data: Record<string, unknown> }) => {
        if (uid === AD_CAMPAIGN_PLAN_UID) {
          return {
            id: 77,
            ...input.data,
          };
        }
        return { id: 1, ...input.data };
      }),
    };
    const strapi = createStrapi({}, entityService);
    const policy = autonomyPolicy({ strapi });
    const auditService = { recordFromContext: vi.fn(async () => ({ id: 1 })) };
    const ctx = createCtx({
      body: {
        name: 'Meta smoke',
        platform: 'meta',
        targetUrl: 'https://star-sign.pl/premium?utm_source=aico-test',
        dailyBudgetPln: 10,
      },
    });

    await adsController({
      strapi: createStrapi(
        {
          'ads-agent': adsAgent({
            strapi: createStrapi({ 'autonomy-policy': policy }, entityService),
          }),
          'audit-trail': auditService,
        },
        entityService
      ),
    }).createCampaignPlan(ctx);

    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.body.data.plan.id).toBe(77);
    expect(auditService.recordFromContext).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        action: 'ads.campaign-plan.create',
        outcome: 'success',
        resourceId: 77,
        metadata: expect.objectContaining({
          platform: 'meta',
          requestedBudgetPln: 10,
          allowed: true,
        }),
      })
    );
    const auditCalls = auditService.recordFromContext.mock.calls as unknown as Array<
      [unknown, { metadata?: Record<string, unknown> }]
    >;
    const auditInput = auditCalls[0]?.[1];
    expect(auditInput).toBeDefined();
    expect(JSON.stringify(auditInput?.metadata)).not.toContain('secret-provider-token');
  });

  it('exposes provider readiness in autonomy status and blocks dry-run steps for missing providers', async () => {
    const recentProviderTestedAt = new Date().toISOString();
    const entityService = {
      findMany: vi.fn(async (uid: string) => {
        if (uid === AUTONOMY_POLICY_UID) {
          return [
            {
              id: 1,
              policy_key: 'global',
              autonomy_mode: 'full',
              global_kill_switch: false,
              daily_ads_budget_pln: 25,
              daily_meta_ads_budget_pln: 15,
              daily_google_ads_budget_pln: 10,
            },
          ];
        }
        if (uid === PROVIDER_CREDENTIAL_STATUS_UID) {
          return [
            {
              id: 11,
              provider: 'meta_ads',
              status: 'failed',
              has_credentials: true,
              blocked_reason: 'policy_review_required',
              last_error: 'Bearer secret-provider-token was rejected',
              last_tested_at: recentProviderTestedAt,
              scopes: ['ads_management'],
            },
            {
              id: 10,
              provider: 'openrouter',
              status: 'ready',
              has_credentials: true,
              last_tested_at: recentProviderTestedAt,
              scopes: ['chat.completions'],
            },
          ];
        }
        return [];
      }),
      count: vi.fn(async () => 0),
      create: vi.fn(),
    };
    const strapi = createStrapi({}, entityService);
    const providers = providerStatus({ strapi });
    const policy = autonomyPolicy({ strapi });
    const traffic = trafficIngestor({ strapi });
    const auditService = { record: vi.fn() };
    const services = {
      'autonomy-policy': policy,
      'traffic-ingestor': traffic,
      'strategy-planner': {},
      'provider-status': providers,
      'audit-trail': auditService,
    };
    const ctx = createCtx();

    await autonomyController({
      strapi: createStrapi(
        {
          ...services,
          autopilot: autopilot({ strapi: createStrapi(services, entityService) }),
        },
        entityService
      ),
    }).status(ctx);

    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.body.data.providerReadiness).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'openrouter', ready: true }),
        expect.objectContaining({
          provider: 'replicate',
          ready: false,
          status: 'missing_credentials',
        }),
        expect.objectContaining({
          provider: 'meta_ads',
          ready: false,
          blockedReason: 'policy_review_required',
          lastError: expect.objectContaining({ lastError: '[REDACTED]' }),
        }),
      ])
    );

    const creativeStep = ctx.body.data.dryRunPreview.steps.find(
      (step: { id: string }) => step.id === 'creative-agent'
    );
    const metaAdsStep = ctx.body.data.dryRunPreview.steps.find(
      (step: { id: string }) => step.id === 'ads-agent-meta'
    );

    expect(creativeStep).toMatchObject({
      status: 'blocked',
      reason: 'provider_readiness_blocked',
      output: {
        requiredProviders: ['replicate'],
        blockedProviders: [expect.objectContaining({ provider: 'replicate' })],
      },
    });
    expect(metaAdsStep).toMatchObject({
      status: 'blocked',
      reason: 'provider_readiness_blocked',
      output: {
        requiredProviders: ['meta_ads'],
        blockedProviders: [expect.objectContaining({ provider: 'meta_ads' })],
      },
    });
    expect(JSON.stringify(ctx.body)).not.toContain('secret-provider-token');
  });

  it('blocks provider readiness for stale tests or missing scopes and maps ad platforms', async () => {
    vi.stubEnv('AICO_PROVIDER_READINESS_MAX_AGE_HOURS', '1');
    const recentProviderTestedAt = new Date().toISOString();
    const staleProviderTestedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const entityService = {
      findMany: vi.fn(async (uid: string) => {
        if (uid !== PROVIDER_CREDENTIAL_STATUS_UID) return [];

        return [
          {
            id: 1,
            provider: 'openrouter',
            status: 'ready',
            has_credentials: true,
            last_tested_at: recentProviderTestedAt,
            scopes: [],
          },
          {
            id: 2,
            provider: 'facebook',
            status: 'ready',
            has_credentials: true,
            last_tested_at: staleProviderTestedAt,
            scopes: ['pages_manage_posts'],
          },
          {
            id: 3,
            provider: 'meta_ads',
            status: 'ready',
            has_credentials: true,
            last_tested_at: recentProviderTestedAt,
            scopes: ['ads_management'],
          },
        ];
      }),
    };
    const service = providerStatus({ strapi: createStrapi({}, entityService) });

    const matrix = await service.getReadinessMatrix();
    expect(matrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'openrouter',
          ready: false,
          missingScopes: ['chat.completions'],
          blockedReason: 'missing_provider_scopes',
        }),
        expect.objectContaining({
          provider: 'facebook',
          ready: false,
          stale: true,
          blockedReason: 'provider_readiness_stale',
        }),
      ])
    );
    await expect(service.checkProviders({ action: 'ads.mutate', platform: 'meta' })).resolves.toMatchObject({
      ready: true,
      requiredProviders: ['meta_ads'],
      blockedProviders: [],
    });
    await expect(service.checkProviders({ action: 'ads.mutate', platform: 'google' })).resolves.toMatchObject({
      ready: false,
      requiredProviders: ['google_ads'],
      blockedProviders: [expect.objectContaining({ provider: 'google_ads' })],
    });
  });

  it('runs provider preflight probes and upserts readiness without exposing secrets', async () => {
    vi.stubEnv('AICO_OPENROUTER_TOKEN', 'secret-openrouter-token');
    const upsert = vi.fn(async (input: Record<string, unknown>) => ({ id: 1, ...input }));
    const service = providerProbe({
      strapi: createStrapi(
        {
          'provider-status': { upsert },
        },
        {}
      ),
    });

    const result = await service.testProviders({
      providers: ['openrouter', 'google_ads'],
      includeConnectivity: false,
    });

    expect(result).toMatchObject({
      includeConnectivity: false,
      liveEffects: false,
      results: [
        {
          provider: 'openrouter',
          status: 'blocked',
          hasCredentials: true,
          scopes: ['chat.completions'],
          blockedReason: 'connectivity_probe_required',
          connectivity: 'skipped',
          liveEffects: false,
        },
        {
          provider: 'google_ads',
          status: 'missing_credentials',
          hasCredentials: false,
          scopes: [],
          blockedReason: 'missing_credentials',
          connectivity: 'skipped',
          liveEffects: false,
        },
      ],
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openrouter',
        status: 'blocked',
        hasCredentials: true,
        scopes: ['chat.completions'],
        blockedReason: 'connectivity_probe_required',
      })
    );
    expect(JSON.stringify(result)).not.toContain('secret-openrouter-token');
    expect(JSON.stringify(upsert.mock.calls)).not.toContain('secret-openrouter-token');
  });

  it('marks configured ad providers ready only for controlled no-spend preflight', async () => {
    vi.stubEnv('AICO_META_ADS_ACCESS_TOKEN', 'secret-meta-ads-token');
    vi.stubEnv('AICO_META_AD_ACCOUNT_ID', 'act_123456789');
    vi.stubEnv('AICO_GOOGLE_ADS_DEVELOPER_TOKEN', 'secret-google-developer-token');
    vi.stubEnv('AICO_GOOGLE_ADS_CLIENT_ID', 'secret-google-client-id');
    vi.stubEnv('AICO_GOOGLE_ADS_CLIENT_SECRET', 'secret-google-client-secret');
    vi.stubEnv('AICO_GOOGLE_ADS_REFRESH_TOKEN', 'secret-google-refresh-token');
    vi.stubEnv('AICO_GOOGLE_ADS_CUSTOMER_ID', '1234567890');
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'controlled');
    vi.stubEnv('AICO_CONTROLLED_LIVE_ENABLED', 'true');
    const upsert = vi.fn(async (input: Record<string, unknown>) => ({ id: 1, ...input }));
    const service = providerProbe({
      strapi: createStrapi(
        {
          'provider-status': { upsert },
        },
        {}
      ),
    });

    const result = await service.testProviders({
      providers: ['meta_ads', 'google_ads'],
      includeConnectivity: false,
    });

    expect(result).toMatchObject({
      includeConnectivity: false,
      liveEffects: false,
      results: [
        {
          provider: 'meta_ads',
          status: 'ready',
          hasCredentials: true,
          scopes: ['ads_management'],
          connectivity: 'skipped',
          liveEffects: false,
          metadata: {
            providerMode: 'controlled',
            controlledLiveEnabled: true,
            controlledExternalMutation: false,
            liveSpendEnabled: false,
            liveEffects: false,
          },
        },
        {
          provider: 'google_ads',
          status: 'ready',
          hasCredentials: true,
          scopes: ['adwords'],
          connectivity: 'skipped',
          liveEffects: false,
          metadata: {
            providerMode: 'controlled',
            controlledLiveEnabled: true,
            controlledExternalMutation: false,
            liveSpendEnabled: false,
            liveEffects: false,
          },
        },
      ],
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'meta_ads',
        status: 'ready',
        blockedReason: undefined,
        metadata: expect.objectContaining({
          providerMode: 'controlled',
          controlledExternalMutation: false,
          liveSpendEnabled: false,
        }),
      })
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google_ads',
        status: 'ready',
        blockedReason: undefined,
        metadata: expect.objectContaining({
          providerMode: 'controlled',
          controlledExternalMutation: false,
          liveSpendEnabled: false,
        }),
      })
    );
    expect(JSON.stringify(result)).not.toContain('secret-meta-ads-token');
    expect(JSON.stringify(upsert.mock.calls)).not.toContain('secret-google-refresh-token');

    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'live');
    const liveResult = await service.testProvider('meta_ads', { includeConnectivity: false });

    expect(liveResult).toMatchObject({
      provider: 'meta_ads',
      status: 'blocked',
      hasCredentials: true,
      scopes: ['ads_management'],
      blockedReason: 'meta_ads_sandbox_or_live_smoke_required',
      connectivity: 'skipped',
      liveEffects: false,
    });
  });

  it('recognizes GA4 credential modes consistently in provider readiness probes', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', '123456');
    vi.stubEnv(
      'GA4_SERVICE_ACCOUNT_JSON',
      '{"client_email":"ga4-reader@example.iam.gserviceaccount.com","private_key":"secret-private-key"}'
    );
    const upsert = vi.fn(async (input: Record<string, unknown>) => ({ id: 1, ...input }));

    const result = await providerProbe({
      strapi: createStrapi(
        {
          'provider-status': { upsert },
        },
        {}
      ),
    }).testProvider('ga4', { includeConnectivity: false });

    expect(result).toMatchObject({
      provider: 'ga4',
      status: 'blocked',
      hasCredentials: true,
      scopes: ['analytics.readonly'],
      blockedReason: 'ga4_data_api_probe_required',
      connectivity: 'skipped',
      liveEffects: false,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'ga4',
        status: 'blocked',
        hasCredentials: true,
        scopes: ['analytics.readonly'],
      })
    );
    expect(JSON.stringify(result)).not.toContain('secret-private-key');
    expect(JSON.stringify(upsert.mock.calls)).not.toContain('secret-private-key');
  });

  it('marks read-only provider connectivity probes as ready only after a successful response', async () => {
    vi.stubEnv('AICO_OPENROUTER_TOKEN', 'secret-openrouter-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
      }))
    );
    const upsert = vi.fn(async (input: Record<string, unknown>) => ({ id: 1, ...input }));

    try {
      const result = await providerProbe({
        strapi: createStrapi(
          {
            'provider-status': { upsert },
          },
          {}
        ),
      }).testProvider('openrouter', { includeConnectivity: true });

      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-openrouter-token',
          }),
        })
      );
      expect(result).toMatchObject({
        provider: 'openrouter',
        status: 'ready',
        hasCredentials: true,
        scopes: ['chat.completions'],
        connectivity: 'passed',
        liveEffects: false,
      });
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openrouter',
          status: 'ready',
          blockedReason: undefined,
          lastError: undefined,
        })
      );
      expect(JSON.stringify(result)).not.toContain('secret-openrouter-token');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('imports GA4 traffic in dry-run mode without database writes or secret exposure', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', '123456');
    vi.stubEnv('AICO_GA4_ACCESS_TOKEN', 'secret-ga4-access-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          rowCount: 1,
          totals: [
            {
              metricValues: [
                { value: '42' },
                { value: '21' },
                { value: '90' },
                { value: '3' },
                { value: '12.5' },
              ],
            },
          ],
          rows: [
            {
              dimensionValues: [{ value: '/horoskop/dzienny' }],
              metricValues: [
                { value: '30' },
                { value: '15' },
                { value: '60' },
                { value: '2' },
                { value: '10' },
              ],
            },
          ],
        }),
      }))
    );
    const upsert = vi.fn(async (input: Record<string, unknown>) => ({ id: 1, ...input }));
    const entityService = {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    };

    try {
      const result = await trafficIngestor({
        strapi: createStrapi({ 'provider-status': { upsert } }, entityService),
      }).importGa4({ day: '2026-06-06', dryRun: true });

      expect(fetch).toHaveBeenCalledWith(
        'https://analyticsdata.googleapis.com/v1beta/properties/123456:runReport',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-ga4-access-token',
          }),
          body: expect.stringContaining('screenPageViews'),
        })
      );
      expect(result).toMatchObject({
        dryRun: true,
        uniqueKey: 'ga4:123456:2026-06-06',
        metrics: {
          views: 42,
          sessions: 21,
          ad_conversions: 3,
          revenue_or_value: 12.5,
        },
        provider: {
          source: 'ga4',
          propertyId: '123456',
          credentialType: 'access_token',
          liveEffects: false,
        },
      });
      expect(result.topContent).toMatchObject({
        source: 'ga4',
        rows: [expect.objectContaining({ path: '/horoskop/dzienny', views: 30 })],
      });
      expect(entityService.create).not.toHaveBeenCalled();
      expect(entityService.update).not.toHaveBeenCalled();
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'ga4',
          status: 'ready',
          hasCredentials: true,
          scopes: ['analytics.readonly'],
        })
      );
      expect(JSON.stringify(result)).not.toContain('secret-ga4-access-token');
      expect(JSON.stringify(upsert.mock.calls)).not.toContain('secret-ga4-access-token');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('persists GA4 traffic snapshots with top content and idempotent unique keys', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', '123456');
    vi.stubEnv('AICO_GA4_ACCESS_TOKEN', 'secret-ga4-access-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          rows: [
            {
              dimensionValues: [{ value: '/blog/merkury' }],
              metricValues: [
                { value: '8' },
                { value: '4' },
                { value: '12' },
                { value: '1' },
                { value: '0' },
              ],
            },
          ],
        }),
      }))
    );
    const upsert = vi.fn(async (input: Record<string, unknown>) => ({ id: 1, ...input }));
    const entityService = {
      findMany: vi.fn(async () => []),
      create: vi.fn(async (_uid: string, input: { data: Record<string, unknown> }) => ({
        id: 50,
        ...input.data,
      })),
    };

    try {
      const result = await trafficIngestor({
        strapi: createStrapi({ 'provider-status': { upsert } }, entityService),
      }).importGa4({ day: '2026-06-06' });

      expect(result.dryRun).toBe(false);
      expect(entityService.findMany).toHaveBeenCalledWith(
        TRAFFIC_SNAPSHOT_UID,
        expect.objectContaining({
          filters: { unique_key: 'ga4:123456:2026-06-06' },
        })
      );
      expect(entityService.create).toHaveBeenCalledWith(
        TRAFFIC_SNAPSHOT_UID,
        expect.objectContaining({
          data: expect.objectContaining({
            unique_key: 'ga4:123456:2026-06-06',
            snapshot_day: '2026-06-06',
            source: 'ga4',
            views: 8,
            sessions: 4,
            ad_conversions: 1,
            top_content: expect.objectContaining({
              rows: [expect.objectContaining({ path: '/blog/merkury' })],
            }),
            metadata: expect.objectContaining({
              importedBy: 'traffic-ingestor',
              provider: expect.objectContaining({
                credentialType: 'access_token',
                liveEffects: false,
              }),
            }),
          }),
        })
      );
      expect(JSON.stringify(result)).not.toContain('secret-ga4-access-token');
      expect(JSON.stringify(entityService.create.mock.calls)).not.toContain('secret-ga4-access-token');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('updates existing GA4 traffic snapshots instead of creating duplicates', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', '123456');
    vi.stubEnv('AICO_GA4_ACCESS_TOKEN', 'secret-ga4-access-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          totals: [
            {
              metricValues: [
                { value: '9' },
                { value: '5' },
                { value: '20' },
                { value: '2' },
                { value: '1.5' },
              ],
            },
          ],
          rows: [
            {
              dimensionValues: [{ value: '/weekly' }],
              metricValues: [
                { value: '9' },
                { value: '5' },
                { value: '20' },
                { value: '2' },
                { value: '1.5' },
              ],
            },
          ],
        }),
      }))
    );
    const upsert = vi.fn(async (input: Record<string, unknown>) => ({ id: 1, ...input }));
    const entityService = {
      findMany: vi.fn(async () => [{ id: 77, unique_key: 'ga4:123456:2026-06-06' }]),
      update: vi.fn(async (_uid: string, id: number, input: { data: Record<string, unknown> }) => ({
        id,
        ...input.data,
      })),
      create: vi.fn(),
    };

    try {
      const result = await trafficIngestor({
        strapi: createStrapi({ 'provider-status': { upsert } }, entityService),
      }).importGa4({ day: '2026-06-06' });

      expect(entityService.update).toHaveBeenCalledWith(
        TRAFFIC_SNAPSHOT_UID,
        77,
        expect.objectContaining({
          data: expect.objectContaining({
            unique_key: 'ga4:123456:2026-06-06',
            views: 9,
            sessions: 5,
            ad_conversions: 2,
            top_content: expect.objectContaining({
              rows: [expect.objectContaining({ path: '/weekly', views: 9 })],
            }),
          }),
        })
      );
      expect(entityService.create).not.toHaveBeenCalled();
      expect(result.snapshot).toMatchObject({ id: 77, views: 9 });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('marks GA4 readiness as missing credentials when import cannot authenticate', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', '123456');
    const upsert = vi.fn(async (input: Record<string, unknown>) => ({ id: 1, ...input }));

    await expect(
      trafficIngestor({
        strapi: createStrapi({ 'provider-status': { upsert } }, {}),
      }).importGa4({ day: '2026-06-06', dryRun: true })
    ).rejects.toThrow('ga4_missing_credentials');

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'ga4',
        status: 'missing_credentials',
        hasCredentials: false,
        blockedReason: 'ga4_missing_credentials',
        lastError: 'ga4_missing_credentials',
      })
    );
  });

  it('marks GA4 readiness as missing credentials when property id is absent', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const upsert = vi.fn(async (input: Record<string, unknown>) => ({ id: 1, ...input }));

    try {
      await expect(
        trafficIngestor({
          strapi: createStrapi({ 'provider-status': { upsert } }, {}),
        }).importGa4({ day: '2026-06-06', dryRun: true })
      ).rejects.toThrow('ga4_missing_property_id');

      expect(fetch).not.toHaveBeenCalled();
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'ga4',
          status: 'missing_credentials',
          hasCredentials: false,
          blockedReason: 'ga4_missing_property_id',
          lastError: 'ga4_missing_property_id',
        })
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects invalid GA4 property ids and snapshot days before external calls', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', 'properties/123456');
    vi.stubEnv('AICO_GA4_ACCESS_TOKEN', 'secret-ga4-access-token');
    vi.stubGlobal('fetch', vi.fn());

    try {
      await expect(
        trafficIngestor({
          strapi: createStrapi({ 'provider-status': { upsert: vi.fn() } }, {}),
        }).importGa4({ day: '2026-06-06', dryRun: true })
      ).rejects.toThrow('ga4_invalid_property_id');
      expect(fetch).not.toHaveBeenCalled();

      vi.stubEnv('GA4_PROPERTY_ID', '123456');
      await expect(
        trafficIngestor({
          strapi: createStrapi({ 'provider-status': { upsert: vi.fn() } }, {}),
        }).importGa4({ day: 'not-a-day', dryRun: true })
      ).rejects.toThrow('invalid_traffic_snapshot_day');
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('marks GA4 readiness as failed when the Data API rejects the report request', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', '123456');
    vi.stubEnv('AICO_GA4_ACCESS_TOKEN', 'secret-ga4-access-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: { status: 'PERMISSION_DENIED' } }),
      }))
    );
    const upsert = vi.fn(async (input: Record<string, unknown>) => ({ id: 1, ...input }));
    const entityService = {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };

    try {
      await expect(
        trafficIngestor({
          strapi: createStrapi({ 'provider-status': { upsert } }, entityService),
        }).importGa4({ day: '2026-06-06' })
      ).rejects.toThrow('ga4_run_report_http_403');

      expect(entityService.findMany).not.toHaveBeenCalled();
      expect(entityService.create).not.toHaveBeenCalled();
      expect(entityService.update).not.toHaveBeenCalled();
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'ga4',
          status: 'failed',
          hasCredentials: true,
          blockedReason: 'ga4_run_report_http_403',
          lastError: 'ga4_run_report_http_403',
        })
      );
      expect(JSON.stringify(upsert.mock.calls)).not.toContain('secret-ga4-access-token');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('routes traffic import controller to GA4 when requested', async () => {
    const auditService = { recordFromContext: vi.fn(async () => ({ id: 1 })) };
    const importGa4 = vi.fn(async () => ({
      dryRun: true,
      uniqueKey: 'ga4:123456:2026-06-06',
      operation: 'dry_run',
      metrics: { views: 1 },
      topContent: { rows: [] },
      provider: { source: 'ga4', propertyId: '123456', credentialType: 'access_token', liveEffects: false },
    }));
    const importFirstParty = vi.fn();
    const ctx = createCtx({
      body: {
        source: 'ga4',
        day: '2026-06-06',
        dryRun: true,
      },
    });

    await trafficController({
      strapi: createStrapi(
        {
          'traffic-ingestor': { importGa4, importFirstParty },
          'audit-trail': auditService,
        },
        {}
      ),
    }).import(ctx);

    expect(importGa4).toHaveBeenCalledWith({ day: '2026-06-06', dryRun: true });
    expect(importFirstParty).not.toHaveBeenCalled();
    expect(ctx.body.data).toMatchObject({ uniqueKey: 'ga4:123456:2026-06-06' });
    expect(auditService.recordFromContext).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        action: 'traffic.import',
        outcome: 'skipped',
        metadata: expect.objectContaining({
          source: 'ga4',
          day: '2026-06-06',
          dryRun: true,
          operation: 'dry_run',
        }),
      })
    );
  });

  it('audits provider readiness probes because they update provider status', async () => {
    const auditService = { recordFromContext: vi.fn(async () => ({ id: 1 })) };
    const testProviders = vi.fn(async () => ({
      includeConnectivity: false,
      liveEffects: false,
      results: [{ provider: 'ga4', status: 'blocked' }],
    }));
    const ctx = createCtx({
      body: {
        providers: ['ga4'],
        includeConnectivity: false,
      },
    });

    await providersController({
      strapi: createStrapi(
        {
          'provider-probe': { testProviders },
          'audit-trail': auditService,
        },
        {}
      ),
    }).testReadiness(ctx);

    expect(testProviders).toHaveBeenCalledWith({
      providers: ['ga4'],
      includeConnectivity: false,
    });
    expect(ctx.body.data).toMatchObject({ liveEffects: false });
    expect(auditService.recordFromContext).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        action: 'providers.test-readiness',
        outcome: 'success',
        metadata: expect.objectContaining({
          providers: ['ga4'],
          includeConnectivity: false,
          liveEffects: false,
          resultCount: 1,
        }),
      })
    );
  });

  it('includes strict audit by default in admin production readiness when full autonomy is required', async () => {
    vi.stubEnv('AICO_FULL_AUTONOMY_REQUIRED', 'true');
    vi.stubEnv('AICO_STRICT_AUDIT_REQUIRED', 'false');
    const evaluate = vi.fn(async (input: { includeStrictAudit?: boolean }) => ({
      decision: 'GO',
      includeStrictAudit: input.includeStrictAudit,
    }));
    const ctx = createCtx();

    await autonomyController({
      strapi: createStrapi(
        {
          'production-readiness': { evaluate },
        },
        {}
      ),
    }).productionReadiness(ctx);

    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(evaluate).toHaveBeenCalledWith({ includeStrictAudit: true });
    expect(ctx.body.data).toMatchObject({ includeStrictAudit: true });
  });

  it('returns a production NO-GO report when policy or provider readiness blocks full autonomy', async () => {
    vi.stubEnv('AICO_FULL_AUTONOMY_REQUIRED', 'true');
    vi.stubEnv('AICO_STRICT_AUDIT_REQUIRED', 'true');
    vi.stubEnv('AICO_AUDIT_TRAIL_STRICT', 'true');
    const service = productionReadiness({
      strapi: createStrapi(
        {
          'autonomy-policy': {
            getPolicy: vi.fn(async () => ({
              id: 1,
              autonomy_mode: 'guarded',
              global_kill_switch: true,
              daily_ads_budget_pln: 25,
              brand_safety_required: true,
              legal_disclaimer_required: true,
              no_sensitive_targeting: true,
            })),
          },
          'provider-status': {
            getReadinessMatrix: vi.fn(async () => [
              { provider: 'openrouter', ready: true, status: 'ready' },
              { provider: 'replicate', ready: false, status: 'missing_credentials', blockedReason: 'missing_credentials' },
              { provider: 'facebook', ready: true, status: 'ready' },
              { provider: 'instagram', ready: true, status: 'ready' },
              { provider: 'twitter', ready: true, status: 'ready' },
              { provider: 'meta_ads', ready: false, status: 'blocked', blockedReason: 'sandbox_required' },
              { provider: 'google_ads', ready: false, status: 'blocked', blockedReason: 'sandbox_required' },
              { provider: 'ga4', ready: false, status: 'missing_credentials', blockedReason: 'missing_credentials' },
            ]),
          },
        },
        {}
      ),
    });

    const result = await service.evaluate();

    expect(result.decision).toBe('NO_GO');
    expect(result.liveEffectsAllowed).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'policy.mode' }),
        expect.objectContaining({ id: 'policy.kill-switch' }),
        expect.objectContaining({ id: 'providers.required-ready' }),
      ])
    );
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('keeps production NO-GO for live video mode while accepting live ads mode after controlled smoke', async () => {
    vi.stubEnv('AICO_FULL_AUTONOMY_REQUIRED', 'true');
    vi.stubEnv('AICO_STRICT_AUDIT_REQUIRED', 'true');
    vi.stubEnv('AICO_AUDIT_TRAIL_STRICT', 'true');
    vi.stubEnv('AICO_CONTROLLED_LIVE_ENABLED', 'true');
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'live');
    vi.stubEnv('AICO_VIDEO_PROVIDER_MODE', 'live');
    vi.stubEnv('AICO_RUNTIME_LOCKS_DISABLED', 'false');
    vi.stubEnv('AICO_SOCIAL_CONTENT_SAFETY_DISABLED', 'false');
    const readyProviders = [
      'openrouter',
      'replicate',
      'facebook',
      'instagram',
      'twitter',
      'meta_ads',
      'google_ads',
      'ga4',
    ].map((provider) => ({ provider, ready: true, status: 'ready' }));
    const service = productionReadiness({
      strapi: createStrapi(
        {
          'autonomy-policy': {
            getPolicy: vi.fn(async () => ({
              id: 1,
              autonomy_mode: 'full',
              global_kill_switch: false,
              daily_ads_budget_pln: 25,
              brand_safety_required: true,
              legal_disclaimer_required: true,
              no_sensitive_targeting: true,
            })),
          },
          'provider-status': {
            getReadinessMatrix: vi.fn(async () => readyProviders),
          },
          audit: {
            preflight: vi.fn(async () => ({ decision: 'GO', strict: true, summary: {} })),
          },
        },
        {}
      ),
    });

    const result = await service.evaluate({ includeStrictAudit: true });

    expect(result.decision).toBe('NO_GO');
    expect(result.liveEffectsAllowed).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'live.video-adapter' }),
      ])
    );
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'audit.strict-go', status: 'pass' }),
        expect.objectContaining({ id: 'providers.required-ready', status: 'pass' }),
        expect.objectContaining({ id: 'live.ads-adapter', status: 'pass' }),
      ])
    );
  });

  it('returns production GO for a fully green controlled autonomy profile', async () => {
    vi.stubEnv('AICO_FULL_AUTONOMY_REQUIRED', 'true');
    vi.stubEnv('AICO_STRICT_AUDIT_REQUIRED', 'true');
    vi.stubEnv('AICO_AUDIT_TRAIL_STRICT', 'true');
    vi.stubEnv('AICO_CONTROLLED_LIVE_ENABLED', 'true');
    vi.stubEnv('AICO_ADMIN_RUN_NOW_ENABLED', 'true');
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'controlled');
    vi.stubEnv('AICO_VIDEO_PROVIDER_MODE', 'replicate');
    vi.stubEnv('AICO_RUNTIME_LOCKS_DISABLED', 'false');
    vi.stubEnv('AICO_SOCIAL_CONTENT_SAFETY_DISABLED', 'false');
    const readyProviders = [
      'openrouter',
      'replicate',
      'facebook',
      'instagram',
      'twitter',
      'meta_ads',
      'google_ads',
      'ga4',
    ].map((provider) => ({ provider, ready: true, status: 'ready' }));
    const service = productionReadiness({
      strapi: createStrapi(
        {
          'autonomy-policy': {
            getPolicy: vi.fn(async () => ({
              id: 1,
              autonomy_mode: 'full',
              global_kill_switch: false,
              daily_ads_budget_pln: 25,
              brand_safety_required: true,
              legal_disclaimer_required: true,
              no_sensitive_targeting: true,
            })),
          },
          'provider-status': {
            getReadinessMatrix: vi.fn(async () => readyProviders),
          },
          audit: {
            preflight: vi.fn(async () => ({ decision: 'GO', strict: true, summary: {} })),
          },
        },
        {}
      ),
    });

    const result = await service.evaluate({ includeStrictAudit: true });

    expect(result.decision).toBe('GO');
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.liveEffectsAllowed).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'audit.strict-go', status: 'pass' }),
        expect.objectContaining({ id: 'providers.required-ready', status: 'pass' }),
        expect.objectContaining({ id: 'live.ads-adapter', status: 'pass' }),
        expect.objectContaining({ id: 'live.video-adapter', status: 'pass' }),
        expect.objectContaining({ id: 'live.controlled-live-enabled', status: 'pass' }),
        expect.objectContaining({ id: 'runtime.admin-run-now-enabled', status: 'pass' }),
      ])
    );
  });

  it('allows controlled ad provider probe statuses to satisfy production readiness', async () => {
    vi.stubEnv('AICO_FULL_AUTONOMY_REQUIRED', 'true');
    vi.stubEnv('AICO_STRICT_AUDIT_REQUIRED', 'true');
    vi.stubEnv('AICO_AUDIT_TRAIL_STRICT', 'true');
    vi.stubEnv('AICO_CONTROLLED_LIVE_ENABLED', 'true');
    vi.stubEnv('AICO_ADMIN_RUN_NOW_ENABLED', 'true');
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'controlled');
    vi.stubEnv('AICO_VIDEO_PROVIDER_MODE', 'replicate');
    vi.stubEnv('AICO_RUNTIME_LOCKS_DISABLED', 'false');
    vi.stubEnv('AICO_SOCIAL_CONTENT_SAFETY_DISABLED', 'false');
    vi.stubEnv('AICO_META_ADS_ACCESS_TOKEN', 'secret-meta-ads-token');
    vi.stubEnv('AICO_META_AD_ACCOUNT_ID', 'act_123456789');
    vi.stubEnv('AICO_GOOGLE_ADS_DEVELOPER_TOKEN', 'secret-google-developer-token');
    vi.stubEnv('AICO_GOOGLE_ADS_CLIENT_ID', 'secret-google-client-id');
    vi.stubEnv('AICO_GOOGLE_ADS_CLIENT_SECRET', 'secret-google-client-secret');
    vi.stubEnv('AICO_GOOGLE_ADS_REFRESH_TOKEN', 'secret-google-refresh-token');
    vi.stubEnv('AICO_GOOGLE_ADS_CUSTOMER_ID', '1234567890');
    type ProviderStatusTestRecord = Record<string, unknown> & {
      id: number;
      provider?: string;
      workflow?: number;
    };
    const providerRecords: ProviderStatusTestRecord[] = [];
    const entityService = {
      findMany: vi.fn(
        async (
          uid: string,
          params: { filters?: { provider?: string; workflow?: number } } = {}
        ) => {
          if (uid !== PROVIDER_CREDENTIAL_STATUS_UID) return [];
          const filters = params.filters ?? {};

          return providerRecords.filter(
            (record) =>
              (!filters.provider || record.provider === filters.provider) &&
              (!Object.prototype.hasOwnProperty.call(filters, 'workflow') ||
                record.workflow === filters.workflow)
          );
        }
      ),
      create: vi.fn(async (uid: string, input: { data: Record<string, unknown> }) => {
        if (uid !== PROVIDER_CREDENTIAL_STATUS_UID) throw new Error(`Unexpected uid ${uid}`);
        const record: ProviderStatusTestRecord = {
          id: providerRecords.length + 1,
          updatedAt: new Date().toISOString(),
          ...input.data,
        };
        providerRecords.unshift(record);

        return record;
      }),
      update: vi.fn(
        async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
          if (uid !== PROVIDER_CREDENTIAL_STATUS_UID) throw new Error(`Unexpected uid ${uid}`);
          const index = providerRecords.findIndex((record) => record.id === id);
          const record: ProviderStatusTestRecord = {
            ...(providerRecords[index] ?? { id }),
            updatedAt: new Date().toISOString(),
            ...input.data,
          };
          providerRecords[index] = record;

          return record;
        }
      ),
    };
    const statusService = providerStatus({ strapi: createStrapi({}, entityService) });
    const services = {
      'provider-status': statusService,
      'autonomy-policy': {
        getPolicy: vi.fn(async () => ({
          id: 1,
          autonomy_mode: 'full',
          global_kill_switch: false,
          daily_ads_budget_pln: 25,
          brand_safety_required: true,
          legal_disclaimer_required: true,
          no_sensitive_targeting: true,
        })),
      },
      audit: {
        preflight: vi.fn(async () => ({ decision: 'GO', strict: true, summary: {} })),
      },
    };

    for (const seed of [
      { provider: 'openrouter', scopes: ['chat.completions'] },
      { provider: 'replicate', scopes: ['predictions.write'] },
      { provider: 'facebook', scopes: ['pages_manage_posts'] },
      { provider: 'instagram', scopes: ['instagram_content_publish'] },
      { provider: 'twitter', scopes: ['tweet.write'] },
      { provider: 'ga4', scopes: ['analytics.readonly'] },
    ] as const) {
      await statusService.upsert({
        provider: seed.provider,
        status: 'ready',
        hasCredentials: true,
        scopes: [...seed.scopes],
      });
    }

    const adsProbeResult = await providerProbe({
      strapi: createStrapi(services, entityService),
    }).testProviders({ providers: ['meta_ads', 'google_ads'], includeConnectivity: false });

    const result = await productionReadiness({
      strapi: createStrapi(services, entityService),
    }).evaluate({ includeStrictAudit: true });

    expect(adsProbeResult.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'meta_ads',
          status: 'ready',
          metadata: expect.objectContaining({
            providerMode: 'controlled',
            controlledExternalMutation: false,
            liveSpendEnabled: false,
          }),
        }),
        expect.objectContaining({
          provider: 'google_ads',
          status: 'ready',
          metadata: expect.objectContaining({
            providerMode: 'controlled',
            controlledExternalMutation: false,
            liveSpendEnabled: false,
          }),
        }),
      ])
    );
    expect(result.decision).toBe('GO');
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'providers.required-ready', status: 'pass' }),
        expect.objectContaining({ id: 'live.controlled-live-enabled', status: 'pass' }),
      ])
    );
    expect(result.liveEffectsAllowed).toBe(false);
    expect(JSON.stringify(providerRecords)).not.toContain('secret-google-refresh-token');
  });

  it('checks social readiness only for configured runtime channels in autopilot dry-run', async () => {
    vi.stubEnv('AICO_SOCIAL_CHANNELS', 'facebook,instagram,twitter');
    const recentProviderTestedAt = new Date().toISOString();
    const entityService = {
      findMany: vi.fn(async (uid: string) => {
        if (uid === AUTONOMY_POLICY_UID) {
          return [
            {
              id: 1,
              policy_key: 'global',
              autonomy_mode: 'full',
              global_kill_switch: false,
              daily_ads_budget_pln: 25,
              daily_meta_ads_budget_pln: 15,
              daily_google_ads_budget_pln: 10,
            },
          ];
        }
        if (uid === PROVIDER_CREDENTIAL_STATUS_UID) {
          return [
            {
              id: 10,
              provider: 'openrouter',
              status: 'ready',
              has_credentials: true,
              last_tested_at: recentProviderTestedAt,
              scopes: ['chat.completions'],
            },
            {
              id: 11,
              provider: 'facebook',
              status: 'ready',
              has_credentials: true,
              last_tested_at: recentProviderTestedAt,
              scopes: ['pages_manage_posts'],
            },
            {
              id: 12,
              provider: 'instagram',
              status: 'ready',
              has_credentials: true,
              last_tested_at: recentProviderTestedAt,
              scopes: ['instagram_content_publish'],
            },
            {
              id: 13,
              provider: 'twitter',
              status: 'ready',
              has_credentials: true,
              last_tested_at: recentProviderTestedAt,
              scopes: ['tweet.write'],
            },
          ];
        }
        return [];
      }),
      count: vi.fn(async () => 0),
    };
    const strapi = createStrapi({}, entityService);
    const policy = autonomyPolicy({ strapi });
    const traffic = trafficIngestor({ strapi });
    const providers = providerStatus({ strapi });
    const result = await autopilot({
      strapi: createStrapi(
        {
          'autonomy-policy': policy,
          'traffic-ingestor': traffic,
          'strategy-planner': {},
          'provider-status': providers,
          'audit-trail': { record: vi.fn() },
        },
        entityService
      ),
    }).dryRunTick();

    const socialStep = result.steps.find((step) => step.id === 'social-agent');
    expect(socialStep).toMatchObject({
      status: 'allowed',
      output: {
        requiredProviders: ['facebook', 'instagram', 'twitter'],
        blockedProviders: [],
      },
    });
    expect(JSON.stringify(socialStep)).not.toContain('tiktok');
    expect(JSON.stringify(socialStep)).not.toContain('youtube');
  });

  it('reuses existing generation and video jobs for the same idempotency key', async () => {
    const existingGenerationJob = {
      id: 501,
      job_type: 'video',
      status: 'queued',
      idempotency_key: 'video:daily-aries',
    };
    const existingVideo = {
      id: 601,
      title: 'Baran short',
      status: 'queued',
      generation_job: { id: 501 },
    };
    const entityService = {
      findMany: vi.fn(async (uid: string) => {
        if (uid === GENERATION_JOB_UID) return [existingGenerationJob];
        if (uid === VIDEO_ASSET_UID) return [existingVideo];
        return [];
      }),
      create: vi.fn(),
      update: vi.fn(),
    };

    const generationResult = await generationJobs({
      strapi: createStrapi({}, entityService),
    }).create({
      jobType: 'video',
      idempotencyKey: 'video:daily-aries',
      inputSummary: { title: 'Baran short' },
    });
    const videoResult = await videoAgent({
      strapi: createStrapi(
        {
          'autonomy-policy': {
            evaluate: vi.fn(async () => ({ allowed: true, reason: 'allowed' })),
          },
        },
        entityService
      ),
    }).createJob({
      title: 'Baran short',
      idempotencyKey: 'video:daily-aries',
    });

    expect(generationResult).toMatchObject({ id: 501 });
    expect(videoResult.video).toMatchObject({ id: 601 });
    expect(entityService.create).not.toHaveBeenCalled();
  });

  it('blocks unsafe ad campaign input before policy evaluation or persistence', async () => {
    const entityService = {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      create: vi.fn(),
    };
    const policy = {
      evaluate: vi.fn(async () => ({ allowed: true, reason: 'allowed', budgetImpactPln: 1 })),
    };
    const service = adsAgent({
      strapi: createStrapi({ 'autonomy-policy': policy }, entityService),
    });

    await expect(
      service.createPlan({
        name: 'Bad budget',
        platform: 'meta',
        targetUrl: 'https://star-sign.pl/premium',
        dailyBudgetPln: 0,
      })
    ).resolves.toMatchObject({ allowed: false, reason: 'invalid_ads_budget' });
    await expect(
      service.createPlan({
        name: 'Bad target',
        platform: 'google',
        targetUrl: 'http://localhost:1337/admin',
        dailyBudgetPln: 1,
      })
    ).resolves.toMatchObject({ allowed: false, reason: 'target_url_must_be_https' });
    await expect(
      service.createPlan({
        name: 'External target',
        platform: 'meta',
        targetUrl: 'https://evil.example/premium',
        dailyBudgetPln: 1,
      })
    ).resolves.toMatchObject({ allowed: false, reason: 'target_url_not_allowed' });
    await expect(
      service.createPlan({
        name: 'Sensitive query target',
        platform: 'meta',
        targetUrl: 'https://star-sign.pl/premium?token=secret',
        dailyBudgetPln: 1,
      })
    ).resolves.toMatchObject({ allowed: false, reason: 'target_url_sensitive_query_not_allowed' });
    await expect(
      service.createPlan({
        name: 'Bad path target',
        platform: 'meta',
        targetUrl: 'https://star-sign.pl/admin',
        dailyBudgetPln: 1,
      })
    ).resolves.toMatchObject({ allowed: false, reason: 'target_url_path_not_allowed' });
    await expect(
      service.createPlan({
        name: 'Gwarantowany zysk i pewna przyszłość',
        platform: 'google',
        targetUrl: 'https://star-sign.pl/premium',
        dailyBudgetPln: 1,
      })
    ).resolves.toMatchObject({ allowed: false, reason: 'unsafe_ad_claims' });
    await expect(
      service.createPlan({
        name: 'Sensitive targeting',
        platform: 'meta',
        targetUrl: 'https://star-sign.pl/premium',
        dailyBudgetPln: 1,
        targetingPayload: { custom_audiences: ['audience-1'] },
      })
    ).resolves.toMatchObject({ allowed: false, reason: 'unsafe_ads_targeting' });
    await expect(
      service.createPlan({
        name: 'Unsafe creative',
        platform: 'google',
        targetUrl: 'https://star-sign.pl/premium',
        dailyBudgetPln: 1,
        creativePayload: { headline: 'Ten rytuał wyleczy każdy problem' },
      })
    ).resolves.toMatchObject({ allowed: false, reason: 'unsafe_ad_claims' });

    expect(policy.evaluate).not.toHaveBeenCalled();
    expect(entityService.create).not.toHaveBeenCalled();
  });

  it('activates ad campaign plans only through sandbox adapter without live spend', async () => {
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'sandbox');
    const updates: Array<{ uid: string; id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      findOne: vi.fn(async () => ({
        id: 33,
        name: 'Sandbox Meta',
        platform: 'meta',
        status: 'ready',
        target_url: 'https://star-sign.pl/premium',
        daily_budget_pln: 10,
      })),
      findMany: vi.fn(async (uid: string) => {
        if (uid === AUTONOMY_POLICY_UID) {
          return [
            {
              id: 1,
              policy_key: 'global',
              autonomy_mode: 'full',
              daily_ads_budget_pln: 25,
              daily_meta_ads_budget_pln: 15,
              max_ads_mutations_per_day: 10,
            },
          ];
        }
        return [];
      }),
      count: vi.fn(async () => 0),
      update: vi.fn(async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: input.data });
        return { id, ...input.data };
      }),
    };
    const strapi = createStrapi({}, entityService);
    const policy = autonomyPolicy({ strapi });
    const adsBudgetLedgerService = {
      reserveActivation: vi.fn(async () => ({
        allowed: true,
        reason: 'reserved',
        ledger: { id: 77 },
        totals: { requestedPln: 10 },
      })),
      markApplied: vi.fn(async () => ({ id: 77, status: 'applied' })),
      release: vi.fn(),
    };
    const service = adsAgent({
      strapi: createStrapi(
        {
          'autonomy-policy': policy,
          'ads-provider-adapter': adsProviderAdapter({ strapi }),
          'ads-budget-ledger': adsBudgetLedgerService,
        },
        entityService
      ),
    });

    const result = await service.activate(33);

    expect(result).toMatchObject({
      status: 'active',
      provider_campaign_id: 'sandbox_campaign_meta_33',
      provider_adset_id: 'sandbox_adset_meta_33',
      provider_ad_id: 'sandbox_creative_meta_33',
    });
    expect(updates[0]).toMatchObject({
      uid: AD_CAMPAIGN_PLAN_UID,
      id: 33,
      data: {
        status: 'active',
        blocked_reason: null,
        stop_loss_state: expect.objectContaining({
          providerMode: 'sandbox',
          liveSpendEnabled: false,
          sandbox: true,
          adsLedger: expect.objectContaining({ ledgerId: 77 }),
        }),
      },
    });
    expect(adsBudgetLedgerService.reserveActivation).toHaveBeenCalledWith({
      plan: expect.objectContaining({ id: 33, platform: 'meta' }),
      providerMode: 'sandbox',
    });
    expect(adsBudgetLedgerService.markApplied).toHaveBeenCalledWith(
      expect.objectContaining({ id: 77 }),
      expect.objectContaining({
        providerDecision: 'sandbox_campaign_created',
        providerCampaignId: 'sandbox_campaign_meta_33',
      })
    );
  });

  it('passes controlled ads preflight without live spend when provider readiness and target URL are green', async () => {
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'controlled');
    vi.stubEnv('AICO_CONTROLLED_LIVE_ENABLED', 'true');
    vi.stubEnv('AICO_ADS_TARGET_URL_PREFLIGHT_REQUIRED', 'true');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
      }))
    );
    const updates: Array<{ uid: string; id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      findOne: vi.fn(async () => ({
        id: 34,
        name: 'Controlled Meta',
        platform: 'meta',
        status: 'ready',
        target_url: 'https://star-sign.pl/premium',
        daily_budget_pln: 10,
      })),
      update: vi.fn(async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: input.data });
        return { id, ...input.data };
      }),
    };
    const policy = {
      evaluate: vi.fn(async () => ({ allowed: true, reason: 'allowed', budgetImpactPln: 10 })),
    };
    const providerStatusService = {
      checkProviders: vi.fn(async () => ({
        ready: true,
        requiredProviders: ['meta_ads'],
        blockedProviders: [],
      })),
    };
    const adsBudgetLedgerService = {
      reserveActivation: vi.fn(async () => ({
        allowed: true,
        reason: 'reserved',
        ledger: { id: 78 },
        totals: { requestedPln: 10 },
      })),
      markApplied: vi.fn(async () => ({ id: 78, status: 'applied' })),
      release: vi.fn(),
    };
    const strapi = createStrapi({}, entityService);

    try {
      const result = await adsAgent({
        strapi: createStrapi(
          {
            'autonomy-policy': policy,
            'provider-status': providerStatusService,
            'ads-provider-adapter': adsProviderAdapter({ strapi }),
            'ads-budget-ledger': adsBudgetLedgerService,
          },
          entityService
        ),
      }).activate(34);

      expect(providerStatusService.checkProviders).toHaveBeenCalledWith({
        action: 'ads.mutate',
        platform: 'meta',
      });
      expect(fetch).toHaveBeenCalledWith('https://star-sign.pl/premium', {
        method: 'HEAD',
        redirect: 'manual',
      });
      expect(result).toMatchObject({
        status: 'ready',
        blocked_reason: null,
        provider_campaign_id: 'controlled_meta_campaign_34',
      });
      expect(updates[0]).toMatchObject({
        uid: AD_CAMPAIGN_PLAN_UID,
        id: 34,
        data: {
          status: 'ready',
          blocked_reason: null,
          stop_loss_state: expect.objectContaining({
            providerMode: 'controlled',
            providerCallsEnabled: false,
            liveSpendEnabled: false,
            plannedProviderStatus: 'PAUSED',
            noSensitiveTargeting: true,
            adsLedger: expect.objectContaining({ ledgerId: 78 }),
          }),
        },
      });
      expect(adsBudgetLedgerService.reserveActivation).toHaveBeenCalledWith({
        plan: expect.objectContaining({ id: 34, platform: 'meta' }),
        providerMode: 'controlled',
      });
      expect(adsBudgetLedgerService.markApplied).toHaveBeenCalledWith(
        expect.objectContaining({ id: 78 }),
        expect.objectContaining({
          providerDecision: 'controlled_ads_preflight_passed',
          providerCampaignId: 'controlled_meta_campaign_34',
        })
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('blocks ads activation before provider adapter when budget ledger reservation fails', async () => {
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'sandbox');
    const updates: Array<{ uid: string; id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      findOne: vi.fn(async () => ({
        id: 35,
        name: 'Over budget Meta',
        platform: 'meta',
        status: 'ready',
        target_url: 'https://star-sign.pl/premium',
        daily_budget_pln: 20,
      })),
      update: vi.fn(async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: input.data });
        return { id, ...input.data };
      }),
    };
    const providerAdapterService = {
      createOrUpdateCampaign: vi.fn(),
    };

    const result = await adsAgent({
      strapi: createStrapi(
        {
          'autonomy-policy': {
            evaluate: vi.fn(async () => ({ allowed: true, reason: 'allowed', budgetImpactPln: 20 })),
          },
          'ads-provider-adapter': providerAdapterService,
          'ads-budget-ledger': {
            reserveActivation: vi.fn(async () => ({
              allowed: false,
              reason: 'ads_ledger_budget_cap_exceeded',
              totals: { globalReservedPln: 10, requestedPln: 20, globalCapPln: 25 },
            })),
          },
        },
        entityService
      ),
    }).activate(35);

    expect(result).toMatchObject({
      status: 'blocked',
      blocked_reason: 'ads_ledger_budget_cap_exceeded',
    });
    expect(providerAdapterService.createOrUpdateCampaign).not.toHaveBeenCalled();
    expect(updates[0]).toMatchObject({
      uid: AD_CAMPAIGN_PLAN_UID,
      id: 35,
      data: {
        status: 'blocked',
        blocked_reason: 'ads_ledger_budget_cap_exceeded',
        stop_loss_state: expect.objectContaining({
          providerMode: 'sandbox',
          adsLedger: expect.objectContaining({
            reason: 'ads_ledger_budget_cap_exceeded',
          }),
        }),
      },
    });
  });

  it('blocks controlled ads activation when target URL preflight redirects', async () => {
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'controlled');
    vi.stubEnv('AICO_CONTROLLED_LIVE_ENABLED', 'true');
    vi.stubEnv('AICO_ADS_TARGET_URL_PREFLIGHT_REQUIRED', 'true');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 302,
      }))
    );
    const updates: Array<{ uid: string; id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      findOne: vi.fn(async () => ({
        id: 35,
        name: 'Redirecting Meta',
        platform: 'meta',
        status: 'ready',
        target_url: 'https://star-sign.pl/premium',
        daily_budget_pln: 10,
      })),
      update: vi.fn(async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: input.data });
        return { id, ...input.data };
      }),
    };
    const policy = {
      evaluate: vi.fn(async () => ({ allowed: true, reason: 'allowed', budgetImpactPln: 10 })),
    };
    const providerStatusService = {
      checkProviders: vi.fn(async () => ({
        ready: true,
        requiredProviders: ['meta_ads'],
        blockedProviders: [],
      })),
    };
    const strapi = createStrapi({}, entityService);

    try {
      const result = await adsAgent({
        strapi: createStrapi(
          {
            'autonomy-policy': policy,
            'provider-status': providerStatusService,
            'ads-provider-adapter': adsProviderAdapter({ strapi }),
          },
          entityService
        ),
      }).activate(35);

      expect(result).toMatchObject({
        status: 'blocked',
        blocked_reason: 'target_url_preflight_http_302',
      });
      expect(updates[0]).toMatchObject({
        uid: AD_CAMPAIGN_PLAN_UID,
        id: 35,
        data: {
          status: 'blocked',
          blocked_reason: 'target_url_preflight_http_302',
        },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('blocks controlled ads activation before provider calls when readiness is not ready', async () => {
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'controlled');
    vi.stubEnv('AICO_CONTROLLED_LIVE_ENABLED', 'true');
    vi.stubGlobal('fetch', vi.fn());
    const updates: Array<{ uid: string; id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      findOne: vi.fn(async () => ({
        id: 35,
        name: 'Blocked Google',
        platform: 'google',
        status: 'ready',
        target_url: 'https://star-sign.pl/premium',
        daily_budget_pln: 10,
      })),
      update: vi.fn(async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: input.data });
        return { id, ...input.data };
      }),
    };

    try {
      const result = await adsAgent({
        strapi: createStrapi(
          {
            'autonomy-policy': {
              evaluate: vi.fn(async () => ({ allowed: true, reason: 'allowed', budgetImpactPln: 10 })),
            },
            'provider-status': {
              checkProviders: vi.fn(async () => ({
                ready: false,
                requiredProviders: ['google_ads'],
                blockedProviders: [{ provider: 'google_ads', blockedReason: 'missing_credentials' }],
              })),
            },
            'ads-provider-adapter': adsProviderAdapter({ strapi: createStrapi({}, {}) }),
          },
          entityService
        ),
      }).activate(35);

      expect(result).toMatchObject({
        status: 'blocked',
        blocked_reason: 'provider_readiness_blocked',
      });
      expect(fetch).not.toHaveBeenCalled();
      expect(updates[0]).toMatchObject({
        uid: AD_CAMPAIGN_PLAN_UID,
        id: 35,
        data: {
          status: 'blocked',
          blocked_reason: 'provider_readiness_blocked',
          stop_loss_state: expect.objectContaining({
            providerReadiness: expect.objectContaining({
              requiredProviders: ['google_ads'],
            }),
          }),
        },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('blocks controlled ads adapter mode when controlled live gate is not enabled', async () => {
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'controlled');
    const result = await adsProviderAdapter({ strapi: createStrapi({}, {}) }).createOrUpdateCampaign({
      id: 36,
      name: 'Controlled blocked',
      platform: 'meta',
      status: 'ready',
      target_url: 'https://star-sign.pl/premium',
      daily_budget_pln: 5,
    });

    expect(result).toMatchObject({
      ok: false,
      mode: 'controlled',
      status: 'blocked',
      reason: 'controlled_live_not_enabled',
    });
  });

  it('blocks live ads adapter mode when the controlled live gate is not enabled', async () => {
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'live');
    vi.stubEnv('AICO_CONTROLLED_LIVE_ENABLED', '');
    const result = await adsProviderAdapter({ strapi: createStrapi({}, {}) }).createOrUpdateCampaign({
      id: 44,
      name: 'Live blocked',
      platform: 'google',
      status: 'ready',
      target_url: 'https://star-sign.pl/premium',
      daily_budget_pln: 5,
    });

    expect(result).toMatchObject({
      ok: false,
      mode: 'live',
      status: 'blocked',
      reason: 'live_gate_not_enabled',
    });
  });

  it('blocks ads activation through the service when adapter mode is disabled or live', async () => {
    const updates: Array<{ uid: string; id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      findOne: vi.fn(async () => ({
        id: 45,
        name: 'Blocked Meta',
        platform: 'meta',
        status: 'ready',
        target_url: 'https://star-sign.pl/premium',
        daily_budget_pln: 10,
      })),
      update: vi.fn(async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: input.data });
        return { id, ...input.data };
      }),
    };
    const policy = {
      evaluate: vi.fn(async () => ({ allowed: true, reason: 'allowed', budgetImpactPln: 10 })),
    };
    const strapi = createStrapi({}, entityService);
    const service = adsAgent({
      strapi: createStrapi(
        {
          'autonomy-policy': policy,
          'ads-provider-adapter': adsProviderAdapter({ strapi }),
        },
        entityService
      ),
    });

    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'disabled');
    await expect(service.activate(45)).resolves.toMatchObject({
      status: 'blocked',
      blocked_reason: 'provider_adapter_not_enabled',
      provider_campaign_id: undefined,
    });
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'live');
    await expect(service.activate(45)).resolves.toMatchObject({
      status: 'blocked',
      blocked_reason: 'provider_readiness_service_missing',
    });

    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'blocked',
            stop_loss_state: expect.objectContaining({
              providerMode: 'disabled',
              providerCallsEnabled: false,
              liveSpendEnabled: false,
            }),
          }),
        }),
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'blocked',
            blocked_reason: 'provider_readiness_service_missing',
          }),
        }),
      ])
    );
  });

  it('pauses controlled ads through provider adapter and records pause ledger', async () => {
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'controlled');
    const updates: Array<{ uid: string; id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      findOne: vi.fn(async () => ({
        id: 46,
        name: 'Controlled Meta',
        platform: 'meta',
        status: 'ready',
        target_url: 'https://star-sign.pl/premium',
        daily_budget_pln: 10,
        provider_campaign_id: 'controlled_meta_campaign_46',
        provider_adset_id: 'controlled_meta_adset_46',
        provider_ad_id: 'controlled_meta_creative_46',
      })),
      update: vi.fn(async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: input.data });
        return { id, ...input.data };
      }),
    };
    const strapi = createStrapi({}, entityService);
    const adsBudgetLedgerService = {
      recordPause: vi.fn(async () => ({ id: 88, status: 'applied' })),
    };

    const result = await adsAgent({
      strapi: createStrapi(
        {
          'ads-provider-adapter': adsProviderAdapter({ strapi }),
          'ads-budget-ledger': adsBudgetLedgerService,
        },
        entityService
      ),
    }).pause(46);

    expect(result).toMatchObject({
      status: 'paused',
      blocked_reason: null,
      provider_campaign_id: 'controlled_meta_campaign_46',
      provider_adset_id: 'controlled_meta_adset_46',
      provider_ad_id: 'controlled_meta_creative_46',
    });
    expect(adsBudgetLedgerService.recordPause).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 46,
        provider_campaign_id: 'controlled_meta_campaign_46',
        provider_ad_id: 'controlled_meta_creative_46',
      }),
      {
        providerMode: 'controlled',
        providerDecision: 'controlled_ads_pause_noop',
        ok: true,
      }
    );
    expect(updates[0]).toMatchObject({
      uid: AD_CAMPAIGN_PLAN_UID,
      id: 46,
      data: {
        status: 'paused',
        blocked_reason: null,
        stop_loss_state: expect.objectContaining({
          providerMode: 'controlled',
          providerDecision: 'controlled_ads_pause_noop',
          providerPaused: true,
          liveSpendEnabled: false,
          adsLedger: expect.objectContaining({
            operation: 'pause',
            ledgerId: 88,
          }),
        }),
      },
    });
  });

  it('does not mark live ads paused when live credentials are missing', async () => {
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'live');
    vi.stubEnv('AICO_META_ADS_ACCESS_TOKEN', '');
    vi.stubEnv('AICO_META_AD_ACCOUNT_ID', '');
    const updates: Array<{ uid: string; id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      findOne: vi.fn(async () => ({
        id: 47,
        name: 'Live Meta',
        platform: 'meta',
        status: 'active',
        target_url: 'https://star-sign.pl/premium',
        daily_budget_pln: 10,
        provider_campaign_id: 'live-campaign-47',
        provider_adset_id: 'live-adset-47',
        provider_ad_id: 'live-creative-47',
      })),
      update: vi.fn(async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: input.data });
        return { id, ...input.data };
      }),
    };
    const strapi = createStrapi({}, entityService);
    const adsBudgetLedgerService = {
      recordPause: vi.fn(async () => ({ id: 89, status: 'failed' })),
    };

    const result = await adsAgent({
      strapi: createStrapi(
        {
          'ads-provider-adapter': adsProviderAdapter({ strapi }),
          'ads-budget-ledger': adsBudgetLedgerService,
        },
        entityService
      ),
    }).pause(47);

    expect(result).toMatchObject({
      status: 'blocked',
      blocked_reason: 'meta_ads_credentials_missing',
      provider_campaign_id: 'live-campaign-47',
      provider_adset_id: 'live-adset-47',
      provider_ad_id: 'live-creative-47',
    });
    expect(adsBudgetLedgerService.recordPause).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 47,
        provider_campaign_id: 'live-campaign-47',
        provider_ad_id: 'live-creative-47',
      }),
      {
        providerMode: 'live',
        providerDecision: 'meta_ads_credentials_missing',
        ok: false,
      }
    );
    expect(updates[0]).toMatchObject({
      uid: AD_CAMPAIGN_PLAN_UID,
      id: 47,
      data: {
        status: 'blocked',
        blocked_reason: 'meta_ads_credentials_missing',
        stop_loss_state: expect.objectContaining({
          providerMode: 'live',
          providerDecision: 'meta_ads_credentials_missing',
          providerPaused: false,
          liveSpendEnabled: false,
          adsLedger: expect.objectContaining({
            operation: 'pause',
            ledgerId: 89,
            status: 'failed',
          }),
        }),
      },
    });
  });

  it('pause sweep for global kill switch pauses ready and active ads through provider path', async () => {
    vi.stubEnv('AICO_ADS_PROVIDER_MODE', 'controlled');
    const updates: Array<{ uid: string; id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      findMany: vi.fn(async (uid: string) => {
        if (uid === AD_CAMPAIGN_PLAN_UID) {
          return [{ id: 48 }, { id: 49 }];
        }
        return [];
      }),
      findOne: vi.fn(async (_uid: string, id: number) => ({
        id,
        name: `Controlled ${id}`,
        platform: id === 48 ? 'meta' : 'google',
        status: id === 48 ? 'active' : 'ready',
        target_url: 'https://star-sign.pl/premium',
        daily_budget_pln: 10,
        provider_campaign_id: `controlled_campaign_${id}`,
        provider_adset_id: `controlled_adset_${id}`,
        provider_ad_id: `controlled_creative_${id}`,
      })),
      update: vi.fn(async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: input.data });
        return { id, ...input.data };
      }),
    };
    const strapi = createStrapi({}, entityService);
    const adsBudgetLedgerService = {
      recordPause: vi.fn(async (plan: { id: number }, input: { ok: boolean }) => ({
        id: 900 + plan.id,
        status: input.ok ? 'applied' : 'failed',
      })),
    };

    const result = await adsAgent({
      strapi: createStrapi(
        {
          'ads-provider-adapter': adsProviderAdapter({ strapi }),
          'ads-budget-ledger': adsBudgetLedgerService,
        },
        entityService
      ),
    }).pauseActiveForKillSwitch({ reason: 'global_kill_switch' });

    expect(entityService.findMany).toHaveBeenCalledWith(
      AD_CAMPAIGN_PLAN_UID,
      expect.objectContaining({
        filters: { status: { $in: ['ready', 'active'] } },
        fields: ['id'],
      })
    );
    expect(result).toMatchObject({
      reason: 'global_kill_switch',
      attempted: 2,
      paused: 2,
      blocked: 0,
      failed: 0,
    });
    expect(adsBudgetLedgerService.recordPause).toHaveBeenCalledTimes(2);
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 48,
          data: expect.objectContaining({
            status: 'paused',
            provider_ad_id: 'controlled_creative_48',
            stop_loss_state: expect.objectContaining({
              providerDecision: 'controlled_ads_pause_noop',
              adsLedger: expect.objectContaining({ ledgerId: 948 }),
            }),
          }),
        }),
        expect.objectContaining({
          id: 49,
          data: expect.objectContaining({
            status: 'paused',
            provider_ad_id: 'controlled_creative_49',
            stop_loss_state: expect.objectContaining({
              providerDecision: 'controlled_ads_pause_noop',
              adsLedger: expect.objectContaining({ ledgerId: 949 }),
            }),
          }),
        }),
      ])
    );
  });

  it('renders video assets through sandbox adapter without live provider calls', async () => {
    vi.stubEnv('AICO_VIDEO_PROVIDER_MODE', 'sandbox');
    const updates: Array<{ uid: string; id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      findOne: vi.fn(async () => ({
        id: 88,
        title: 'Sandbox video',
        status: 'queued',
        aspect_ratio: '9:16',
        duration_seconds: 30,
        metadata: {},
      })),
      findMany: vi.fn(async (uid: string) => {
        if (uid === AUTONOMY_POLICY_UID) {
          return [
            {
              id: 1,
              policy_key: 'global',
              autonomy_mode: 'full',
              daily_video_job_limit: 10,
            },
          ];
        }
        return [];
      }),
      count: vi.fn(async () => 0),
      update: vi.fn(async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: input.data });
        return { id, ...input.data };
      }),
    };
    const strapi = createStrapi({}, entityService);
    const policy = autonomyPolicy({ strapi });
    const result = await videoAgent({
      strapi: createStrapi(
        {
          'autonomy-policy': policy,
          'video-provider-adapter': videoProviderAdapter({ strapi }),
        },
        entityService
      ),
    }).render(88);

    expect(result).toMatchObject({
      status: 'qc_passed',
      provider: 'sandbox-video-provider',
      provider_job_id: 'sandbox_video_88',
    });
    expect(updates[0]).toMatchObject({
      uid: VIDEO_ASSET_UID,
      id: 88,
      data: {
        status: 'qc_passed',
        blocked_reason: null,
        metadata: expect.objectContaining({
          providerMode: 'sandbox',
          liveProviderCalls: false,
          sandbox: true,
        }),
      },
    });
  });

  it('starts Replicate-compatible video predictions as controlled external render jobs', async () => {
    vi.stubEnv('AICO_VIDEO_PROVIDER_MODE', 'replicate');
    vi.stubEnv('AICO_CONTROLLED_LIVE_ENABLED', 'true');
    vi.stubEnv('AICO_VIDEO_GEN_TOKEN', 'secret-video-token');
    vi.stubEnv('AICO_VIDEO_GEN_MODEL', 'owner/video-model:1234567890abcdef');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'pred_video_123',
          status: 'starting',
          created_at: '2026-06-07T18:00:00.000Z',
          urls: {
            get: 'https://api.replicate.com/v1/predictions/pred_video_123',
          },
        }),
      }))
    );
    const upsert = vi.fn(async (input: Record<string, unknown>) => ({ id: 1, ...input }));

    try {
      const result = await videoProviderAdapter({
        strapi: createStrapi({ 'provider-status': { upsert } }, {}),
      }).render({
        id: 90,
        title: 'Replicate video',
        status: 'queued',
        script: 'Astrologiczny short 9:16 o energii dnia.',
        aspect_ratio: '9:16',
        duration_seconds: 30,
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.replicate.com/v1/predictions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-video-token',
            'Cancel-After': '15m',
          }),
          body: expect.stringContaining('Astrologiczny short 9:16'),
        })
      );
      expect(result).toMatchObject({
        ok: true,
        mode: 'replicate',
        status: 'rendering',
        reason: 'replicate_video_prediction_created',
        provider: 'replicate',
        providerJobId: 'pred_video_123',
        providerPayload: expect.objectContaining({
          providerCallsEnabled: true,
          liveRenderEnabled: true,
          liveSocialPublishEnabled: false,
          controlledExternalRender: true,
          asyncJobOnly: true,
        }),
      });
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'replicate',
          status: 'ready',
          hasCredentials: true,
          scopes: ['predictions.write'],
        })
      );
      expect(JSON.stringify(result)).not.toContain('secret-video-token');
      expect(JSON.stringify(result)).not.toContain('owner/video-model');
      expect(JSON.stringify(result)).not.toContain('https://api.replicate.com/v1/predictions/pred_video_123');
      expect(JSON.stringify(upsert.mock.calls)).not.toContain('secret-video-token');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('renders video assets through Replicate mode when provider readiness is green', async () => {
    vi.stubEnv('AICO_VIDEO_PROVIDER_MODE', 'replicate');
    vi.stubEnv('AICO_CONTROLLED_LIVE_ENABLED', 'true');
    vi.stubEnv('AICO_VIDEO_GEN_TOKEN', 'secret-video-token');
    vi.stubEnv('AICO_VIDEO_GEN_MODEL', 'owner/video-model:1234567890abcdef');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'pred_video_456',
          status: 'processing',
          urls: {
            get: 'https://api.replicate.com/v1/predictions/pred_video_456',
          },
        }),
      }))
    );
    const updates: Array<{ uid: string; id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      findOne: vi.fn(async () => ({
        id: 91,
        title: 'Replicate render',
        status: 'queued',
        script: 'Horoskop video',
        aspect_ratio: '9:16',
        duration_seconds: 30,
        metadata: {},
      })),
      update: vi.fn(async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: input.data });
        return { id, ...input.data };
      }),
    };
    const policy = {
      evaluate: vi.fn(async () => ({ allowed: true, reason: 'allowed' })),
    };
    const providerStatusService = {
      checkProviders: vi.fn(async () => ({
        ready: true,
        requiredProviders: ['replicate'],
        blockedProviders: [],
      })),
      upsert: vi.fn(async (input: Record<string, unknown>) => ({ id: 1, ...input })),
    };
    const strapi = createStrapi({ 'provider-status': providerStatusService }, entityService);

    try {
      const result = await videoAgent({
        strapi: createStrapi(
          {
            'autonomy-policy': policy,
            'provider-status': providerStatusService,
            'video-provider-adapter': videoProviderAdapter({ strapi }),
          },
          entityService
        ),
      }).render(91);

      expect(providerStatusService.checkProviders).toHaveBeenCalledWith({ action: 'video.generate' });
      expect(result).toMatchObject({
        status: 'rendering',
        provider: 'replicate',
        provider_job_id: 'pred_video_456',
      });
      expect(updates[0]).toMatchObject({
        uid: VIDEO_ASSET_UID,
        id: 91,
        data: {
          status: 'rendering',
          blocked_reason: null,
          metadata: expect.objectContaining({
            providerMode: 'replicate',
            liveProviderCalls: true,
            liveSocialPublishEnabled: false,
            controlledExternalRender: true,
          }),
        },
      });
      expect(JSON.stringify(result)).not.toContain('secret-video-token');
      expect(JSON.stringify(result)).not.toContain('owner/video-model');
      expect(JSON.stringify(updates)).not.toContain('https://api.replicate.com/v1/predictions/pred_video_456');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('blocks Replicate video rendering when the controlled live gate is not enabled', async () => {
    vi.stubEnv('AICO_VIDEO_PROVIDER_MODE', 'replicate');
    vi.stubEnv('AICO_VIDEO_GEN_TOKEN', 'secret-video-token');
    vi.stubEnv('AICO_VIDEO_GEN_MODEL', 'owner/video-model:1234567890abcdef');
    vi.stubGlobal('fetch', vi.fn());

    try {
      const result = await videoProviderAdapter({
        strapi: createStrapi({ 'provider-status': { upsert: vi.fn() } }, {}),
      }).render({
        id: 93,
        title: 'Controlled live disabled',
        status: 'queued',
      });

      expect(result).toMatchObject({
        ok: false,
        mode: 'replicate',
        status: 'failed',
        reason: 'controlled_live_not_enabled',
      });
      expect(fetch).not.toHaveBeenCalled();
      expect(JSON.stringify(result)).not.toContain('secret-video-token');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('blocks video rendering before provider calls when Replicate readiness is not ready', async () => {
    vi.stubEnv('AICO_VIDEO_PROVIDER_MODE', 'replicate');
    vi.stubGlobal('fetch', vi.fn());
    const updates: Array<{ uid: string; id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      findOne: vi.fn(async () => ({
        id: 92,
        title: 'Readiness blocked render',
        status: 'queued',
        metadata: {},
      })),
      update: vi.fn(async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: input.data });
        return { id, ...input.data };
      }),
    };

    try {
      const result = await videoAgent({
        strapi: createStrapi(
          {
            'autonomy-policy': { evaluate: vi.fn(async () => ({ allowed: true, reason: 'allowed' })) },
            'provider-status': {
              checkProviders: vi.fn(async () => ({
                ready: false,
                requiredProviders: ['replicate'],
                blockedProviders: [{ provider: 'replicate', blockedReason: 'missing_credentials' }],
              })),
            },
            'video-provider-adapter': videoProviderAdapter({ strapi: createStrapi({}, {}) }),
          },
          entityService
        ),
      }).render(92);

      expect(result).toMatchObject({
        status: 'failed',
        blocked_reason: 'provider_readiness_blocked',
      });
      expect(fetch).not.toHaveBeenCalled();
      expect(updates[0]).toMatchObject({
        uid: VIDEO_ASSET_UID,
        id: 92,
        data: {
          status: 'failed',
          blocked_reason: 'provider_readiness_blocked',
          metadata: expect.objectContaining({
            providerReadiness: expect.objectContaining({
              requiredProviders: ['replicate'],
            }),
          }),
        },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('fails closed for Replicate video rendering when provider readiness service is unavailable', async () => {
    vi.stubEnv('AICO_VIDEO_PROVIDER_MODE', 'replicate');
    vi.stubEnv('AICO_CONTROLLED_LIVE_ENABLED', 'true');
    vi.stubGlobal('fetch', vi.fn());
    const updates: Array<{ uid: string; id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      findOne: vi.fn(async () => ({
        id: 94,
        title: 'Missing readiness service',
        status: 'queued',
        metadata: {},
      })),
      update: vi.fn(async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: input.data });
        return { id, ...input.data };
      }),
    };

    try {
      const result = await videoAgent({
        strapi: createStrapi(
          {
            'autonomy-policy': { evaluate: vi.fn(async () => ({ allowed: true, reason: 'allowed' })) },
            'video-provider-adapter': videoProviderAdapter({ strapi: createStrapi({}, {}) }),
          },
          entityService
        ),
      }).render(94);

      expect(result).toMatchObject({
        status: 'failed',
        blocked_reason: 'provider_readiness_service_missing',
      });
      expect(fetch).not.toHaveBeenCalled();
      expect(updates[0]).toMatchObject({
        uid: VIDEO_ASSET_UID,
        id: 94,
        data: {
          status: 'failed',
          blocked_reason: 'provider_readiness_service_missing',
        },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('blocks video rendering through the service when adapter mode is disabled or live', async () => {
    const updates: Array<{ uid: string; id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      findOne: vi.fn(async () => ({
        id: 89,
        title: 'Blocked video',
        status: 'queued',
        aspect_ratio: '9:16',
        duration_seconds: 30,
        metadata: {},
      })),
      update: vi.fn(async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: input.data });
        return { id, ...input.data };
      }),
    };
    const policy = {
      evaluate: vi.fn(async () => ({ allowed: true, reason: 'allowed' })),
    };
    const strapi = createStrapi({}, entityService);
    const service = videoAgent({
      strapi: createStrapi(
        {
          'autonomy-policy': policy,
          'video-provider-adapter': videoProviderAdapter({ strapi }),
        },
        entityService
      ),
    });

    vi.stubEnv('AICO_VIDEO_PROVIDER_MODE', 'disabled');
    await expect(service.render(89)).resolves.toMatchObject({
      status: 'failed',
      blocked_reason: 'provider_adapter_not_enabled',
      provider_job_id: undefined,
    });
    vi.stubEnv('AICO_VIDEO_PROVIDER_MODE', 'live');
    await expect(service.render(89)).resolves.toMatchObject({
      status: 'failed',
      blocked_reason: 'provider_adapter_live_not_implemented',
      provider_job_id: undefined,
    });

    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
            metadata: expect.objectContaining({
              providerMode: 'disabled',
              liveProviderCalls: false,
            }),
          }),
        }),
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
            metadata: expect.objectContaining({
              providerMode: 'live',
              liveProviderCalls: false,
            }),
          }),
        }),
      ])
    );
  });

  it('blocks live video adapter mode until a real provider adapter exists', async () => {
    vi.stubEnv('AICO_VIDEO_PROVIDER_MODE', 'live');
    const result = await videoProviderAdapter({ strapi: createStrapi({}, {}) }).render({
      id: 99,
      title: 'Live blocked',
      status: 'queued',
      aspect_ratio: '9:16',
      duration_seconds: 30,
    });

    expect(result).toMatchObject({
      ok: false,
      mode: 'live',
      status: 'failed',
      reason: 'provider_adapter_live_not_implemented',
    });
  });

  it('blocks real social publishing when provider readiness is not ready', async () => {
    const updates: Array<{ uid: string; id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      update: vi.fn(async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: input.data });
        return { id, ...input.data };
      }),
    };
    const policy = {
      evaluate: vi.fn(async () => ({ allowed: true, reason: 'allowed' })),
    };
    const providers = {
      checkProviders: vi.fn(async () => ({
        ready: false,
        requiredProviders: ['facebook'],
        blockedProviders: [
          {
            provider: 'facebook',
            status: 'missing_credentials',
            blockedReason: 'missing_credentials',
          },
        ],
      })),
    };
    const api = socialPublisher({
      strapi: createStrapi(
        {
          'autonomy-policy': policy,
          'provider-status': providers,
        },
        entityService
      ),
    }) as any;
    api.publishToProvider = vi.fn(async () => ({ providerPostId: 'should-not-run' }));

    const result = await api.publishTicket(
      {
        id: 101,
        platform: 'facebook',
        status: 'scheduled',
        caption: 'Horoskop dnia',
        media_url: 'https://star-sign.pl/assets/og-default.png',
        target_url: 'https://star-sign.pl/horoskopy',
        scheduled_at: '2026-06-07T10:00:00.000Z',
      } as any,
      new Date('2026-06-07T10:00:00.000Z'),
      {
        id: 1,
        enabled_channels: ['facebook'],
        retry_max: 1,
      } as any
    );

    expect(result).toBe('failed');
    expect(providers.checkProviders).toHaveBeenCalledWith({
      action: 'social.publish',
      providers: ['facebook'],
    });
    expect(api.publishToProvider).not.toHaveBeenCalled();
    expect(updates[0]).toMatchObject({
      uid: SOCIAL_POST_TICKET_UID,
      id: 101,
      data: {
        status: 'failed',
        blocked_reason: 'provider_readiness_blocked',
      },
    });
  });

  it('records social test-connection results into provider readiness status', async () => {
    const upsert = vi.fn(async () => ({ id: 1 }));
    const api = socialPublisher({
      strapi: createStrapi(
        {
          'provider-status': { upsert },
        },
        {}
      ),
    }) as any;

    await api.recordProviderConnectionStatus('facebook', 7, {
      platform: 'facebook',
      status: 'ready',
      message: 'Połączenie Facebook OK.',
    });
    await api.recordProviderConnectionStatus('instagram', 7, {
      platform: 'instagram',
      status: 'needs_action',
      message: 'Brak ig_user_id lub tokena Instagram.',
    });

    expect(upsert).toHaveBeenCalledWith({
      provider: 'facebook',
      status: 'ready',
      hasCredentials: true,
      scopes: ['pages_manage_posts'],
      blockedReason: undefined,
      workflowId: 7,
    });
    expect(upsert).toHaveBeenCalledWith({
      provider: 'instagram',
      status: 'missing_credentials',
      hasCredentials: false,
      scopes: [],
      blockedReason: 'Brak ig_user_id lub tokena Instagram.',
      workflowId: 7,
    });
  });

  it('blocks real social publishing on autonomy policy deny before provider or platform calls', async () => {
    const updates: Array<{ uid: string; id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      update: vi.fn(async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: input.data });
        return { id, ...input.data };
      }),
    };
    const policy = {
      evaluate: vi.fn(async () => ({ allowed: false, reason: 'daily_social_post_limit_exceeded' })),
    };
    const providers = {
      checkProviders: vi.fn(async () => ({ ready: true, requiredProviders: [], blockedProviders: [] })),
    };
    const api = socialPublisher({
      strapi: createStrapi(
        {
          'autonomy-policy': policy,
          'provider-status': providers,
        },
        entityService
      ),
    }) as any;
    api.publishToProvider = vi.fn(async () => ({ providerPostId: 'should-not-run' }));

    const result = await api.publishTicket(
      {
        id: 102,
        platform: 'facebook',
        status: 'scheduled',
        caption: 'Horoskop dnia',
        media_url: 'https://star-sign.pl/assets/og-default.png',
        target_url: 'https://star-sign.pl/horoskopy',
        scheduled_at: '2026-06-07T10:00:00.000Z',
      } as any,
      new Date('2026-06-07T10:00:00.000Z'),
      {
        id: 1,
        enabled_channels: ['facebook'],
        retry_max: 1,
      } as any
    );

    expect(result).toBe('failed');
    expect(providers.checkProviders).not.toHaveBeenCalled();
    expect(api.publishToProvider).not.toHaveBeenCalled();
    expect(updates[0]).toMatchObject({
      uid: SOCIAL_POST_TICKET_UID,
      id: 102,
      data: {
        status: 'failed',
        blocked_reason: 'daily_social_post_limit_exceeded',
      },
    });
  });

  it('fails closed when full autonomy requires provider readiness but the service is unavailable', async () => {
    vi.stubEnv('AICO_FULL_AUTONOMY_REQUIRED', 'true');
    const updates: Array<{ uid: string; id: number; data: Record<string, unknown> }> = [];
    const entityService = {
      update: vi.fn(async (uid: string, id: number, input: { data: Record<string, unknown> }) => {
        updates.push({ uid, id, data: input.data });
        return { id, ...input.data };
      }),
    };
    const policy = {
      evaluate: vi.fn(async () => ({ allowed: true, reason: 'allowed' })),
    };
    const api = socialPublisher({
      strapi: createStrapi({ 'autonomy-policy': policy }, entityService),
    }) as any;
    api.publishToProvider = vi.fn(async () => ({ providerPostId: 'should-not-run' }));

    const result = await api.publishTicket(
      {
        id: 103,
        platform: 'facebook',
        status: 'scheduled',
        caption: 'Horoskop dnia',
        media_url: 'https://star-sign.pl/assets/og-default.png',
        target_url: 'https://star-sign.pl/horoskopy',
        scheduled_at: '2026-06-07T10:00:00.000Z',
      } as any,
      new Date('2026-06-07T10:00:00.000Z'),
      {
        id: 1,
        enabled_channels: ['facebook'],
        retry_max: 1,
      } as any
    );

    expect(result).toBe('failed');
    expect(api.publishToProvider).not.toHaveBeenCalled();
    expect(updates[0]).toMatchObject({
      uid: SOCIAL_POST_TICKET_UID,
      id: 103,
      data: {
        status: 'failed',
        blocked_reason: 'provider_readiness_service_missing',
      },
    });
  });

  it('keeps autonomy run-now in controlled dry-run mode and audits the skipped live tick', async () => {
    const auditService = { recordFromContext: vi.fn(async () => ({ id: 1 })) };
    const readiness = { evaluate: vi.fn() };
    const orchestratorTick = vi.fn();
    const ctx = createCtx();

    await autonomyController({
      strapi: createStrapi(
        {
          autopilot: {
            dryRunTick: vi.fn(async () => ({
              dryRun: true,
              liveEffects: false,
              steps: [],
            })),
          },
          'production-readiness': readiness,
          orchestrator: { tick: orchestratorTick },
          'audit-trail': auditService,
        },
        {}
      ),
    }).runNow(ctx);

    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.body.data).toMatchObject({
      dryRun: true,
      liveEffects: false,
      runNowMode: 'dry_run_only',
    });
    expect(auditService.recordFromContext).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        action: 'autonomy.tick.run-now',
        outcome: 'skipped',
        metadata: expect.objectContaining({
          reason: 'live_confirmation_required',
          requiredConfirmation: 'RUN_AICO_CONTROLLED_TICK',
          dryRun: true,
        }),
      })
    );
    expect(readiness.evaluate).not.toHaveBeenCalled();
    expect(orchestratorTick).not.toHaveBeenCalled();
  });

  it('runs controlled live admin run-now only after production readiness GO and confirmation', async () => {
    vi.stubEnv('AICO_ADMIN_RUN_NOW_ENABLED', 'true');
    const auditService = { recordFromContext: vi.fn(async () => ({ id: 1 })) };
    const readinessReport = { decision: 'GO', blockers: [], warnings: [] };
    const readiness = { evaluate: vi.fn(async () => readinessReport) };
    const orchestratorTick = vi.fn(async () => undefined);
    const autopilotDryRun = vi.fn();
    const ctx = createCtx({
      body: {
        live: true,
        confirmation: 'RUN_AICO_CONTROLLED_TICK',
      },
    });

    await autonomyController({
      strapi: createStrapi(
        {
          autopilot: { dryRunTick: autopilotDryRun },
          'production-readiness': readiness,
          orchestrator: { tick: orchestratorTick },
          'audit-trail': auditService,
        },
        {}
      ),
    }).runNow(ctx);

    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(autopilotDryRun).not.toHaveBeenCalled();
    expect(readiness.evaluate).toHaveBeenCalledWith({ includeStrictAudit: true });
    expect(orchestratorTick).toHaveBeenCalledTimes(1);
    expect(ctx.body.data).toMatchObject({
      dryRun: false,
      liveEffects: true,
      runNowMode: 'controlled_live',
      readiness: readinessReport,
    });
    expect(auditService.recordFromContext).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        action: 'autonomy.tick.run-now.attempt',
        outcome: 'success',
        metadata: expect.objectContaining({
          mode: 'controlled_live',
          readinessDecision: 'GO',
          confirmationAccepted: true,
        }),
      })
    );
    expect(auditService.recordFromContext).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        action: 'autonomy.tick.run-now',
        outcome: 'success',
        metadata: expect.objectContaining({
          mode: 'controlled_live',
          readinessDecision: 'GO',
          liveEffects: true,
        }),
      })
    );
  });

  it('blocks controlled live admin run-now when production readiness is not GO', async () => {
    vi.stubEnv('AICO_ADMIN_RUN_NOW_ENABLED', 'true');
    const auditService = { recordFromContext: vi.fn(async () => ({ id: 1 })) };
    const readiness = {
      evaluate: vi.fn(async () => ({
        decision: 'GO_WITH_WARNINGS',
        blockers: [],
        warnings: [{ id: 'audit.strict-go' }],
      })),
    };
    const orchestratorTick = vi.fn();
    const ctx = createCtx({
      body: {
        mode: 'controlled_live',
        confirmation: 'RUN_AICO_CONTROLLED_TICK',
      },
    });

    await autonomyController({
      strapi: createStrapi(
        {
          'production-readiness': readiness,
          orchestrator: { tick: orchestratorTick },
          'audit-trail': auditService,
        },
        {}
      ),
    }).runNow(ctx);

    expect(readiness.evaluate).toHaveBeenCalledWith({ includeStrictAudit: true });
    expect(orchestratorTick).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(
      'Production readiness is GO_WITH_WARNINGS; live run-now blocked.'
    );
    expect(auditService.recordFromContext).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        action: 'autonomy.tick.run-now',
        outcome: 'skipped',
        severity: 'warn',
        metadata: expect.objectContaining({
          reason: 'production_readiness_not_go',
          decision: 'GO_WITH_WARNINGS',
          warnings: 1,
          dryRun: true,
        }),
      })
    );
  });

  it('returns an autopilot dry-run tick without creating live jobs or ad plans', async () => {
    const entityService = {
      findMany: vi.fn(async (uid: string) => {
        if (uid === AUTONOMY_POLICY_UID) {
          return [
            {
              id: 1,
              policy_key: 'global',
              autonomy_mode: 'full',
              global_kill_switch: false,
              daily_ads_budget_pln: 25,
              daily_meta_ads_budget_pln: 15,
              daily_google_ads_budget_pln: 10,
            },
          ];
        }
        return [];
      }),
      count: vi.fn(async () => 0),
      create: vi.fn(),
    };
    const strapi = createStrapi({}, entityService);
    const policy = autonomyPolicy({ strapi });
    const traffic = trafficIngestor({ strapi });
    const auditService = { record: vi.fn() };
    const api = autopilot({
      strapi: createStrapi(
        {
          'autonomy-policy': policy,
          'traffic-ingestor': traffic,
          'strategy-planner': {},
          'audit-trail': auditService,
        },
        entityService
      ),
    });

    const result = await api.dryRunTick();

    expect(result).toMatchObject({
      dryRun: true,
      liveEffects: false,
      policy: {
        dailyAdsBudgetPln: 25,
        mode: 'full',
      },
    });
    expect(result.steps.map((step) => step.id)).toContain('ads-agent-meta');
    expect(entityService.create).not.toHaveBeenCalledWith(
      GENERATION_JOB_UID,
      expect.anything()
    );
    expect(entityService.create).not.toHaveBeenCalledWith(
      AD_CAMPAIGN_PLAN_UID,
      expect.anything()
    );
  });
});
