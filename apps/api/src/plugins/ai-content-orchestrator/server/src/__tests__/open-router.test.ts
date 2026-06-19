import { afterEach, describe, expect, it, vi } from 'vitest';

import openRouter from '../services/open-router';
import type { Strapi } from '../types';

const createStrapi = (): Strapi =>
  ({
    log: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  }) as unknown as Strapi;

const JSON_ONLY_INSTRUCTION =
  'Zwracaj WYŁĄCZNIE poprawny JSON bez markdown i bez dodatkowych komentarzy. Stosuj się ściśle do schematu.';

describe('open-router buildMessages systemPreamble', () => {
  it('omits the preamble system message when none is provided', () => {
    const api = openRouter({ strapi: createStrapi() });

    const messages = api.buildMessages('Napisz horoskop', '{"items":[]}');

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: 'system', content: JSON_ONLY_INSTRUCTION });
    expect(messages[1].role).toBe('user');
  });

  it('omits the preamble system message when it is empty/whitespace', () => {
    const api = openRouter({ strapi: createStrapi() });

    const messages = api.buildMessages('Napisz horoskop', '{"items":[]}', '   ');

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe(JSON_ONLY_INSTRUCTION);
  });

  it('emits the preamble as a leading system message and keeps JSON instruction last', () => {
    const api = openRouter({ strapi: createStrapi() });
    const preamble = 'Piszesz jako Luna Mistyczna. Ton ciepły i empatyczny.';

    const messages = api.buildMessages('Napisz horoskop', '{"items":[]}', preamble);

    expect(messages).toHaveLength(3);

    // Preamble first.
    expect(messages[0]).toEqual({ role: 'system', content: preamble });

    // JSON-only contract stays the LAST system message (not weakened).
    expect(messages[1]).toEqual({ role: 'system', content: JSON_ONLY_INSTRUCTION });

    // User prompt last overall.
    expect(messages[2].role).toBe('user');
    expect(messages[2].content).toContain('Napisz horoskop');

    const systemMessages = messages.filter((message) => message.role === 'system');
    expect(systemMessages[systemMessages.length - 1].content).toBe(JSON_ONLY_INSTRUCTION);
  });
});

describe('open-router requestJson systemPreamble threading', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('threads the preamble into the request body and the captured trace messages', async () => {
    const preamble = 'Piszesz jako Luna Mistyczna.';
    let capturedBody: any = null;

    global.fetch = vi.fn(async (_url: any, init: any) => {
      capturedBody = JSON.parse(init.body as string);
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            choices: [{ message: { content: '{"ok":true}' } }],
            usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
          }),
      } as any;
    }) as any;

    const api = openRouter({ strapi: createStrapi() });

    const result = await api.requestJson({
      model: 'openai/test',
      apiToken: 'token',
      prompt: 'Napisz horoskop',
      schemaDescription: '{"ok":true}',
      systemPreamble: preamble,
    });

    // Request body carries the preamble as the leading system message.
    expect(capturedBody.messages[0]).toEqual({ role: 'system', content: preamble });
    expect(capturedBody.messages[1].content).toBe(JSON_ONLY_INSTRUCTION);

    // Trace captures the same messages (preamble included).
    expect(result.trace.request.messages[0]).toEqual({ role: 'system', content: preamble });
    expect(result.trace.request.messages[1].content).toBe(JSON_ONLY_INSTRUCTION);
  });
});
