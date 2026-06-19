import { describe, expect, it, vi } from 'vitest';

import { CONTENT_UIDS, PLUGIN_ID } from '../constants';
import orchestrator from '../services/orchestrator';
import { getAicoPromptTemplate } from '../utils/aico-contract';
import { hasAstrologyDisclaimer } from '../utils/premium-quality';
import type { NormalizedWorkflowConfig, Strapi } from '../types';

const createStrapi = (
  services: Record<string, unknown>,
  entityService: Record<string, unknown> = {}
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

const baseConfig = (overrides: Partial<NormalizedWorkflowConfig> = {}): NormalizedWorkflowConfig =>
  ({
    id: 7,
    llmModel: 'run/model',
    temperature: 0.4,
    workflowType: 'article',
    defaultEditorPersonaId: null,
    articleCategoryId: 3,
    autoPublish: false,
    forceRegenerate: false,
    promptTemplate: 'Napisz artykuł o {{topicTitle}}.',
    locale: 'pl',
    timezone: 'Europe/Warsaw',
    imageGenModel: 'test-image-model',
    maxCompletionTokens: 1800,
    dailyRequestLimit: 220,
    dailyTokenLimit: 500_000,
    ...overrides,
  }) as NormalizedWorkflowConfig;

// Premium content satisfying assertPremiumContentQuality (all 5 sections,
// >= 350 words, not a copy of the free content) + an explicit disclaimer.
const buildPremiumContent = (): string => {
  const filler = Array.from({ length: 360 }, (_, index) => `slowo${index}`).join(' ');
  return [
    'Relacje: rozwijaj bliskie więzi.',
    'Praca: realizuj plany zawodowe.',
    'Energia dnia: zadbaj o równowagę.',
    'Rytuał: zapal świecę i wycisz myśli.',
    'Pytanie refleksyjne: co dziś odpuścić?',
    filler,
  ].join('\n\n');
};

const articleDraft = (overrides: Record<string, unknown> = {}) => ({
  title: 'Astrologiczny przewodnik',
  excerpt: 'Krótki wstęp do tematu na dziś, zachęcający do lektury.',
  content:
    'Publiczna treść artykułu, pełnowartościowa i konkretna. Treści Star Sign mają charakter inspiracyjny i rozrywkowy i nie zastępują porady specjalisty.',
  premiumContent: buildPremiumContent(),
  isPremium: true,
  ...overrides,
});

// Builds a strapi instance wired for generateArticleFromQueue, where the
// open-router requestJson resolves from a queue of scripted responses (one per
// LLM call, in order).
const buildArticleStrapi = (
  responses: Array<{ payload: unknown; usage?: any }>,
  options: { usageGetOrCreate?: any; autonomyEvaluate?: any } = {}
) => {
  const requestJsonCalls: any[] = [];
  let createdArticle: any = null;
  let callIndex = 0;

  const entityService = {
    findMany: vi.fn(async () => []),
    findOne: vi.fn(async () => null),
    create: vi.fn(async (uid: string, payload: any) => {
      if (uid === CONTENT_UIDS.article) {
        createdArticle = { id: 91, ...payload.data };
        return createdArticle;
      }
      return { id: 1, ...payload.data };
    }),
    update: vi.fn(async (_uid: string, id: number, payload: any) => ({ id, ...payload.data })),
  };

  const usageService: Record<string, unknown> = {
    assertBudget: vi.fn(async () => ({ blocked: false, usage: { request_count: 0, total_tokens: 0 } })),
    registerUsage: vi.fn(async () => undefined),
  };
  if (options.usageGetOrCreate) {
    usageService.getOrCreate = options.usageGetOrCreate;
  }

  const services: Record<string, unknown> = {
    personas: { resolveForTopic: vi.fn(async () => null) },
    usage: usageService,
    'open-router': {
      requestJson: vi.fn(async (input: any) => {
        requestJsonCalls.push(input);
        const response = responses[Math.min(callIndex, responses.length - 1)];
        callIndex += 1;
        return {
          payload: response.payload,
          usage: response.usage ?? { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
          trace: { request: {}, response: {} },
        };
      }),
    },
    topics: {
      takeNextForWorkflow: vi.fn(async () => ({
        id: 5,
        title: 'Temat testowy',
        brief: 'Brief testowy',
        article_category: 3,
        editor_persona: null,
      })),
      markDone: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    },
    workflows: {
      decryptTokenForRuntime: vi.fn(async () => 'token'),
      decryptImageTokenForRuntime: vi.fn(async () => null),
    },
    'media-selector': {
      resolveForArticle: vi.fn(async () => ({
        mediaAssetId: 9,
        mediaAssetKey: 'asset-key',
        uploadFileId: 10,
      })),
      registerUsage: vi.fn(async () => ({})),
    },
    'seo-guardrails': {
      evaluateArticleDraft: vi.fn(async () => ({ decision: 'pass', score: 100, checks: [] })),
    },
    'social-publisher': { generateTeaser: vi.fn(async () => undefined) },
  };

  if (options.autonomyEvaluate) {
    services['autonomy-policy'] = { evaluate: options.autonomyEvaluate };
  }

  const strapi = createStrapi(services, entityService);
  (strapi as any).store = vi.fn(() => ({
    get: vi.fn(async () => ({ aico_auto_publish_enabled: false })),
  }));

  return { strapi, requestJsonCalls, getCreatedArticle: () => createdArticle, services };
};

// Stubs the editor + polish stages so tests focus on multi-pass draft selection.
// The editor pass echoes its input draft back; polish is a no-op.
const stubEditorAndPolish = (api: any) => {
  api.ensurePolishContentQuality = vi.fn(async ({ payload }: any) => ({
    payload,
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    repaired: false,
  }));
};

describe('orchestrator article multi-pass critique winner selection', () => {
  it('contract exposes the articleCritique prompt', () => {
    expect(() => getAicoPromptTemplate('articleCritique')).not.toThrow();
    expect(getAicoPromptTemplate('articleCritique')).toContain('winnerIndex');
  });

  it('resolveCritiqueWinnerIndex picks the highest score from the scores array', () => {
    const { strapi } = buildArticleStrapi([{ payload: articleDraft() }]);
    const api = orchestrator({ strapi });

    const index = api.resolveCritiqueWinnerIndex(
      {
        scores: [
          { index: 0, score: 41 },
          { index: 1, score: 88 },
          { index: 2, score: 12 },
        ],
      },
      3
    );
    expect(index).toBe(1);
  });

  it('resolveCritiqueWinnerIndex trusts a valid winnerIndex and clamps out-of-range', () => {
    const { strapi } = buildArticleStrapi([{ payload: articleDraft() }]);
    const api = orchestrator({ strapi });

    expect(api.resolveCritiqueWinnerIndex({ winnerIndex: 2 }, 3)).toBe(2);
    // Out-of-range winnerIndex with no usable scores falls back to 0.
    expect(api.resolveCritiqueWinnerIndex({ winnerIndex: 9 }, 3)).toBe(0);
    // Garbage payload falls back to 0 (deterministic).
    expect(api.resolveCritiqueWinnerIndex(null, 3)).toBe(0);
  });

  it('selects the critique-winning draft as the base draft for the editor pass', async () => {
    // Draft 0 = weak, Draft 1 = strong; critique picks index 1; editor echoes it.
    const drafts = [
      articleDraft({ title: 'Szkic slabszy' }),
      articleDraft({ title: 'Szkic mocniejszy' }),
    ];
    const responses = [
      { payload: drafts[0] }, // writer draft 0
      { payload: drafts[1] }, // writer draft 1
      {
        payload: {
          winnerIndex: 1,
          reason: 'mocniejszy kandydat',
          scores: [
            { index: 0, score: 40 },
            { index: 1, score: 92 },
          ],
        },
      }, // critique
      { payload: drafts[1] }, // editor pass on winner
    ];

    const { strapi, requestJsonCalls, getCreatedArticle } = buildArticleStrapi(responses);
    const api = orchestrator({ strapi });
    stubEditorAndPolish(api);

    const result = await api.generateArticleFromQueue(
      1,
      { id: 7, workflow_type: 'article' } as any,
      baseConfig(),
      'token',
      new Date('2026-05-04T08:00:00.000Z'),
      new Date('2026-05-04T08:00:00.000Z'),
      ''
    );

    expect(result.created).toBe(1);
    // 2 writer drafts + 1 critique + 1 editor pass = 4 LLM calls (polish stubbed).
    expect(requestJsonCalls.length).toBe(4);
    // The persisted article title comes from the critique-winning draft.
    expect(getCreatedArticle().title).toBe('Szkic mocniejszy');
  });
});

describe('orchestrator article multi-pass budget fallback', () => {
  it('falls back to single-shot (no extra draft, no critique) when the token budget is tight', async () => {
    // Daily usage already near the token limit: no headroom for a second call.
    const usageGetOrCreate = vi.fn(async () => ({
      request_count: 1,
      total_tokens: 499_900, // limit 500_000, headroom needed = 1800 + 1500
    }));

    const responses = [{ payload: articleDraft({ title: 'Jedyny szkic' }) }];
    const { strapi, requestJsonCalls, getCreatedArticle } = buildArticleStrapi(responses, {
      usageGetOrCreate,
    });
    const api = orchestrator({ strapi });
    stubEditorAndPolish(api);

    const result = await api.generateArticleFromQueue(
      1,
      { id: 7, workflow_type: 'article' } as any,
      baseConfig(),
      'token',
      new Date('2026-05-04T08:00:00.000Z'),
      new Date('2026-05-04T08:00:00.000Z'),
      ''
    );

    expect(result.created).toBe(1);
    // Only the first writer draft + the editor pass run; NO second draft, NO critique.
    expect(requestJsonCalls.length).toBe(2);
    expect(getCreatedArticle().title).toBe('Jedyny szkic');
  });

  it('falls back to single-shot when the per-workflow daily request limit is exhausted', async () => {
    const usageGetOrCreate = vi.fn(async () => ({
      request_count: 220, // == dailyRequestLimit
      total_tokens: 0,
    }));

    const responses = [{ payload: articleDraft({ title: 'Szkic przy wyczerpanym limicie' }) }];
    const { strapi, requestJsonCalls } = buildArticleStrapi(responses, { usageGetOrCreate });
    const api = orchestrator({ strapi });
    stubEditorAndPolish(api);

    await api.generateArticleFromQueue(
      1,
      { id: 7, workflow_type: 'article' } as any,
      baseConfig(),
      'token',
      new Date('2026-05-04T08:00:00.000Z'),
      new Date('2026-05-04T08:00:00.000Z'),
      ''
    );

    // 1 writer draft + 1 editor pass, no extra multi-pass calls.
    expect(requestJsonCalls.length).toBe(2);
  });

  it('honours N=1 (env): single draft, no critique, behaves like the legacy single-shot path', async () => {
    vi.stubEnv('AICO_ARTICLE_MULTIPASS_DRAFTS', '1');
    try {
      const responses = [{ payload: articleDraft({ title: 'Single shot N=1' }) }];
      const { strapi, requestJsonCalls } = buildArticleStrapi(responses);
      const api = orchestrator({ strapi });
      stubEditorAndPolish(api);

      await api.generateArticleFromQueue(
        1,
        { id: 7, workflow_type: 'article' } as any,
        baseConfig(),
        'token',
        new Date('2026-05-04T08:00:00.000Z'),
        new Date('2026-05-04T08:00:00.000Z'),
        ''
      );

      // N=1 => exactly 1 writer draft + 1 editor pass; no critique.
      expect(requestJsonCalls.length).toBe(2);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('respects the hard ceiling of 3 drafts even when env requests more', () => {
    vi.stubEnv('AICO_ARTICLE_MULTIPASS_DRAFTS', '9');
    try {
      const { strapi } = buildArticleStrapi([{ payload: articleDraft() }]);
      const api = orchestrator({ strapi });
      expect(api.resolveArticleMultiPassDrafts()).toBe(3);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('article prompt + disclaimer', () => {
  it('the article prompt contract carries the disclaimer instruction', () => {
    const template = getAicoPromptTemplate('article');
    expect(template).toContain('nie zastępuje porady');
    expect(template).toMatch(/inspiracyjn|rozrywkow/i);
  });

  it('horoscope and tarot prompts also carry the disclaimer instruction', () => {
    expect(getAicoPromptTemplate('dailyHoroscope')).toContain('nie zastępuje porady');
    expect(getAicoPromptTemplate('periodicHoroscope')).toContain('nie zastępuje porady');
    expect(getAicoPromptTemplate('dailyCard')).toContain('nie zastępuje porady');
  });

  it('hasAstrologyDisclaimer detects the disclaimer spirit and warns when absent', () => {
    expect(
      hasAstrologyDisclaimer({
        content: 'Treść ma charakter inspiracyjny i nie zastępuje porady specjalisty.',
      })
    ).toBe(true);
    expect(hasAstrologyDisclaimer({ content: 'Zwykła treść bez żadnej noty.' })).toBe(false);
  });
});
