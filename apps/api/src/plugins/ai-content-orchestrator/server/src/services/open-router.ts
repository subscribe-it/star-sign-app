import {
  DEFAULT_MAX_COMPLETION_TOKENS,
  DEFAULT_TEMPERATURE,
  OPENROUTER_ENDPOINT,
} from '../constants';
import type { OpenRouterTrace, OpenRouterUsage, Strapi } from '../types';
import { parseFirstJsonObject } from '../utils/json';

type ChatCompletionMessage = {
  role: 'system' | 'user';
  content: string;
};

type OpenRouterRequestInput = {
  model: string;
  apiToken: string;
  prompt: string;
  schemaDescription: string;
  systemPreamble?: string;
  temperature?: number;
  maxCompletionTokens?: number;
  signal?: AbortSignal;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
};

const openRouter = ({ strapi }: { strapi: Strapi }) => ({
  async requestJson(
    input: OpenRouterRequestInput
  ): Promise<{ payload: unknown; usage: OpenRouterUsage; trace: OpenRouterTrace }> {
    const messages = this.buildMessages(
      input.prompt,
      input.schemaDescription,
      input.systemPreamble
    );
    const temperature = input.temperature ?? DEFAULT_TEMPERATURE;
    const maxCompletionTokens = input.maxCompletionTokens ?? DEFAULT_MAX_COMPLETION_TOKENS;
    const body = {
      model: input.model,
      messages,
      temperature,
      max_tokens: maxCompletionTokens,
    };

    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: input.signal,
    });

    const raw = (await response.text()).trim();

    if (!response.ok) {
      throw new Error(`OpenRouter HTTP ${response.status}: response body redacted chars=${raw.length}`);
    }

    let parsed: OpenRouterResponse;

    try {
      parsed = JSON.parse(raw) as OpenRouterResponse;
    } catch (error) {
      throw new Error(`OpenRouter zwrócił niepoprawny JSON: ${String(error)}`);
    }

    if (parsed.error?.message) {
      throw new Error('OpenRouter error: provider_error_message_redacted');
    }

    const content = this.extractContent(parsed);
    const payload = parseFirstJsonObject(content);

    const usage: OpenRouterUsage = {
      prompt_tokens: Number(parsed.usage?.prompt_tokens ?? 0),
      completion_tokens: Number(parsed.usage?.completion_tokens ?? 0),
      total_tokens: Number(parsed.usage?.total_tokens ?? 0),
    };

    strapi.log.info(
      `[aico] OpenRouter usage prompt=${usage.prompt_tokens} completion=${usage.completion_tokens} total=${usage.total_tokens}`
    );

    return {
      payload,
      usage,
      trace: {
        request: {
          model: input.model,
          temperature,
          maxCompletionTokens,
          prompt: input.prompt,
          schemaDescription: input.schemaDescription,
          messages,
        },
        response: {
          content,
          payload,
          usage,
        },
      },
    };
  },

  buildMessages(
    prompt: string,
    schemaDescription: string,
    systemPreamble?: string
  ): ChatCompletionMessage[] {
    const messages: ChatCompletionMessage[] = [];

    const preamble = systemPreamble?.trim();
    if (preamble) {
      // Persona / editorial context goes FIRST so the JSON-only contract below
      // stays the last (and therefore strongest) system instruction.
      messages.push({
        role: 'system',
        content: preamble,
      });
    }

    messages.push({
      role: 'system',
      content:
        'Zwracaj WYŁĄCZNIE poprawny JSON bez markdown i bez dodatkowych komentarzy. Stosuj się ściśle do schematu.',
    });

    messages.push({
      role: 'user',
      content: `${prompt}\n\nWymagany format odpowiedzi JSON:\n${schemaDescription}`,
    });

    return messages;
  },

  extractContent(response: OpenRouterResponse): string {
    const messageContent = response.choices?.[0]?.message?.content;

    if (typeof messageContent === 'string') {
      return messageContent;
    }

    if (Array.isArray(messageContent)) {
      const merged = messageContent
        .map((part) => {
          if (typeof part?.text === 'string') {
            return part.text;
          }

          return '';
        })
        .join('')
        .trim();

      if (merged) {
        return merged;
      }
    }

    throw new Error('Brak contentu w odpowiedzi OpenRouter.');
  },
});

export default openRouter;
