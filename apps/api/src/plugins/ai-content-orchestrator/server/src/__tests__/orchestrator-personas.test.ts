import { describe, expect, it, vi } from 'vitest';

import { CONTENT_UIDS, PLUGIN_ID } from '../constants';
import orchestrator from '../services/orchestrator';
import type { EditorPersonaRecord, NormalizedWorkflowConfig, Strapi } from '../types';

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

const persona = (overrides: Partial<EditorPersonaRecord> = {}): EditorPersonaRecord =>
  ({
    id: 1,
    name: 'Luna Mistyczna',
    key: 'luna-mistyczna',
    byline: 'Luna Mistyczna',
    system_instruction: 'Piszesz jako Luna Mistyczna. Ton ciepły i empatyczny.',
    prompt_prefix: 'PREFIKS PERSONY',
    prompt_suffix: 'SUFIKS PERSONY',
    llm_model: 'persona/model',
    temperature: 0.9,
    active: true,
    ...overrides,
  }) as EditorPersonaRecord;

const baseConfig = (overrides: Partial<NormalizedWorkflowConfig> = {}): NormalizedWorkflowConfig =>
  ({
    llmModel: 'run/model',
    temperature: 0.4,
    defaultEditorPersonaId: null,
    ...overrides,
  }) as NormalizedWorkflowConfig;

describe('orchestrator persona resolution precedence', () => {
  it('prefers the topic persona over the workflow default', async () => {
    const topicPersona = persona({ id: 11, name: 'Topic Persona', key: 'topic' });
    const workflowPersona = persona({ id: 22, name: 'Workflow Persona', key: 'workflow' });

    const personas = {
      resolveForTopic: vi.fn(async (ref: string | number) =>
        ref === 11 ? topicPersona : workflowPersona
      ),
    };
    const api = orchestrator({ strapi: createStrapi({ personas }) });

    const resolved = await api.resolveEditorPersona(
      baseConfig({ defaultEditorPersonaId: 22 }),
      { id: 5, editor_persona: 11 } as any
    );

    expect(resolved?.id).toBe(11);
    expect(personas.resolveForTopic).toHaveBeenCalledWith(11);
  });

  it('falls back to the workflow default when the topic has no persona', async () => {
    const workflowPersona = persona({ id: 22, name: 'Workflow Persona', key: 'workflow' });
    const personas = {
      resolveForTopic: vi.fn(async () => workflowPersona),
    };
    const api = orchestrator({ strapi: createStrapi({ personas }) });

    const resolved = await api.resolveEditorPersona(
      baseConfig({ defaultEditorPersonaId: 22 }),
      { id: 5, editor_persona: null } as any
    );

    expect(resolved?.id).toBe(22);
    expect(personas.resolveForTopic).toHaveBeenCalledWith(22);
  });

  it('returns null when neither topic nor workflow assign a persona', async () => {
    const personas = { resolveForTopic: vi.fn(async () => null) };
    const api = orchestrator({ strapi: createStrapi({ personas }) });

    const resolved = await api.resolveEditorPersona(baseConfig(), { id: 5 } as any);

    expect(resolved).toBeNull();
    expect(personas.resolveForTopic).not.toHaveBeenCalled();
  });
});

describe('orchestrator editorial composition helpers', () => {
  it('joins persona system_instruction and editorial context into the system preamble', async () => {
    const personas = { resolveForTopic: vi.fn(async () => persona()) };
    const api = orchestrator({ strapi: createStrapi({ personas }) });

    const { persona: resolved, systemPreamble } = await api.composeEditorialContext(
      baseConfig({ defaultEditorPersonaId: 1 }),
      'Zasady redakcyjne: pisz po polsku.',
      null
    );

    expect(resolved?.id).toBe(1);
    expect(systemPreamble).toContain('Piszesz jako Luna Mistyczna.');
    expect(systemPreamble).toContain('Zasady redakcyjne: pisz po polsku.');
    // system_instruction first, editorial context second.
    expect(systemPreamble.indexOf('Piszesz jako Luna')).toBeLessThan(
      systemPreamble.indexOf('Zasady redakcyjne')
    );
  });

  it('produces an empty preamble when no persona and no editorial context (no-op)', async () => {
    const personas = { resolveForTopic: vi.fn(async () => null) };
    const api = orchestrator({ strapi: createStrapi({ personas }) });

    const { persona: resolved, systemPreamble } = await api.composeEditorialContext(
      baseConfig(),
      '',
      null
    );

    expect(resolved).toBeNull();
    expect(systemPreamble).toBe('');
  });

  it('overrides model and temperature from the persona only when set', () => {
    const api = orchestrator({ strapi: createStrapi({}) });

    const withPersona = api.resolvePersonaModelOverrides(baseConfig(), persona());
    expect(withPersona).toEqual({ model: 'persona/model', temperature: 0.9 });

    const noPersona = api.resolvePersonaModelOverrides(baseConfig(), null);
    expect(noPersona).toEqual({ model: 'run/model', temperature: 0.4 });

    const partial = api.resolvePersonaModelOverrides(
      baseConfig(),
      persona({ llm_model: null, temperature: null })
    );
    expect(partial).toEqual({ model: 'run/model', temperature: 0.4 });
  });

  it('wraps the prompt with persona prefix and suffix', () => {
    const api = orchestrator({ strapi: createStrapi({}) });

    const wrapped = api.applyPersonaPromptAffixes('TREŚĆ', persona());
    expect(wrapped).toBe('PREFIKS PERSONY\n\nTREŚĆ\n\nSUFIKS PERSONY');

    const unwrapped = api.applyPersonaPromptAffixes('TREŚĆ', null);
    expect(unwrapped).toBe('TREŚĆ');
  });
});

// Premium content satisfying assertPremiumContentQuality (all 5 sections,
// >= 350 words, not a copy of the free content).
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

describe('orchestrator article persona integration', () => {
  it('uses the persona byline as the article author and feeds system_instruction into the LLM call', async () => {
    const articlePersona = persona({
      id: 33,
      byline: 'Luna Mistyczna',
      system_instruction: 'INSTRUKCJA_SYSTEMOWA_PERSONY',
      prompt_prefix: null,
      prompt_suffix: null,
      llm_model: null,
      temperature: null,
    });

    const requestJsonCalls: any[] = [];
    let createdArticle: any = null;

    const draftPayload = {
      title: 'Astrologiczny przewodnik',
      excerpt: 'Krótki wstęp.',
      content: 'Publiczna zajawka artykułu.',
      premiumContent: buildPremiumContent(),
      isPremium: true,
    };

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

    const strapi = createStrapi(
      {
        personas: { resolveForTopic: vi.fn(async () => articlePersona) },
        'open-router': {
          requestJson: vi.fn(async (input: any) => {
            requestJsonCalls.push(input);
            return {
              payload: draftPayload,
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
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
            editor_persona: 33,
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
      },
      entityService
    );
    (strapi as any).store = vi.fn(() => ({
      get: vi.fn(async () => ({ aico_auto_publish_enabled: false })),
    }));

    const api = orchestrator({ strapi });
    // Skip the heavy Polish-style repair heuristics; we assert on wiring, not
    // on content-quality scoring (covered by its own tests).
    api.ensurePolishContentQuality = vi.fn(async ({ payload }: any) => ({
      payload,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      repaired: false,
    })) as any;

    const result = await api.generateArticleFromQueue(
      1,
      { id: 7, workflow_type: 'article' } as any,
      baseConfig({
        articleCategoryId: 3,
        autoPublish: true,
        forceRegenerate: false,
        promptTemplate: 'Napisz artykuł o {{topicTitle}}.',
        locale: 'pl',
        timezone: 'Europe/Warsaw',
        imageGenModel: 'test-image-model',
        maxCompletionTokens: 1800,
      } as any),
      'token',
      new Date('2026-05-04T08:00:00.000Z'),
      new Date('2026-05-04T08:00:00.000Z'),
      'Zasady redakcyjne: pisz po polsku.'
    );

    expect(result.created).toBe(1);

    // Byline becomes the article author.
    expect(createdArticle.author).toBe('Luna Mistyczna');

    // system_instruction reaches the systemPreamble of the LLM call.
    expect(requestJsonCalls.length).toBeGreaterThan(0);
    expect(requestJsonCalls[0].systemPreamble).toContain('INSTRUKCJA_SYSTEMOWA_PERSONY');
    expect(requestJsonCalls[0].systemPreamble).toContain('Zasady redakcyjne: pisz po polsku.');
  });
});
