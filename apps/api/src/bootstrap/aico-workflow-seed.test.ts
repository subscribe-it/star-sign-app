import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Core } from '@strapi/strapi';

import { upsertAicoWorkflows } from './content';

const encryptMock = vi.fn((value: string) => `encrypted:${value}`);

const createStrapiMock = (options: {
  existingWorkflow?: Record<string, unknown>;
}): Core.Strapi => {
  const savedWorkflows: Record<string, unknown>[] = [];

  const strapi: Record<string, unknown> = {
    service: (name: string) => {
      if (name === 'admin::encryption') {
        return { encrypt: encryptMock };
      }
      throw new Error(`Unexpected service requested: ${name}`);
    },
    db: {
      query: (uid: string) => {
        if (uid !== 'plugin::ai-content-orchestrator.workflow') {
          throw new Error(`Unexpected query uid: ${uid}`);
        }
        const existing = options.existingWorkflow ?? null;
        const saved = savedWorkflows;
        return {
          findOne: vi.fn(async () => existing),
          create: vi.fn(async ({ data }: { data: unknown }) => {
            saved.push(data as Record<string, unknown>);
            return data;
          }),
          update: vi.fn(async ({ data }: { data: unknown }) => {
            saved.push(data as Record<string, unknown>);
            return data;
          }),
        };
      },
    },
    entityService: {
      findMany: vi.fn(async () => [{ id: 7 }]),
    },
  };

  (strapi as Record<string, unknown>)['__saved'] = savedWorkflows;
  return strapi as unknown as Core.Strapi;
};

describe('upsertAicoWorkflows — social credential seeding z env', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('seeduje tokeny social z env i ustawia enabled_channels', async () => {
    vi.stubEnv('AICO_OPENROUTER_TOKEN', 'llm-token');
    vi.stubEnv('AICO_ENABLE_WORKFLOWS', 'true');
    vi.stubEnv('AICO_FACEBOOK_PAGE_ID', 'fb-page-1');
    vi.stubEnv('AICO_FACEBOOK_ACCESS_TOKEN', 'fb-token-1');
    vi.stubEnv('AICO_INSTAGRAM_USER_ID', 'ig-user-1');
    vi.stubEnv('AICO_INSTAGRAM_ACCESS_TOKEN', 'ig-token-1');
    vi.stubEnv('AICO_X_API_KEY', 'x-key-1');
    vi.stubEnv('AICO_X_API_SECRET', 'x-secret-1');
    vi.stubEnv('AICO_X_ACCESS_TOKEN', 'x-token-1');
    vi.stubEnv('AICO_X_ACCESS_TOKEN_SECRET', 'x-token-secret-1');
    vi.stubEnv('AICO_SOCIAL_CHANNELS', 'facebook,instagram,twitter');

    const strapi = createStrapiMock({});
    await upsertAicoWorkflows(strapi, ['horoscope']);

    const saved = (strapi as unknown as { __saved: Record<string, unknown>[] })
      .__saved;
    expect(saved.length).toBeGreaterThan(0);

    for (const workflow of saved) {
      expect(workflow).toEqual(
        expect.objectContaining({
          fb_page_id: 'fb-page-1',
          fb_access_token_encrypted: 'encrypted:fb-token-1',
          ig_user_id: 'ig-user-1',
          ig_access_token_encrypted: 'encrypted:ig-token-1',
          x_api_key: 'x-key-1',
          x_api_secret_encrypted: 'encrypted:x-secret-1',
          x_access_token_encrypted: 'encrypted:x-token-1',
          x_access_token_secret_encrypted: 'encrypted:x-token-secret-1',
          enabled_channels: ['facebook', 'instagram', 'twitter'],
        }),
      );
      expect(workflow).not.toHaveProperty('tt_access_token_encrypted');
    }
  });

  it('zachowuje istniejące social credentialy gdy env pusty', async () => {
    vi.stubEnv('AICO_OPENROUTER_TOKEN', 'llm-token');
    vi.stubEnv('AICO_ENABLE_WORKFLOWS', 'true');

    const strapi = createStrapiMock({
      existingWorkflow: {
        fb_page_id: 'old-page',
        fb_access_token_encrypted: 'old-fb',
        ig_user_id: 'old-ig',
        ig_access_token_encrypted: 'old-ig-tok',
        x_api_key: 'old-x-key',
        x_api_secret_encrypted: 'old-x-secret',
        x_access_token_encrypted: 'old-x-token',
        x_access_token_secret_encrypted: 'old-x-token-secret',
        enabled_channels: ['facebook'],
      },
    });
    await upsertAicoWorkflows(strapi, ['article']);

    const saved = (strapi as unknown as { __saved: Record<string, unknown>[] })
      .__saved;
    for (const workflow of saved) {
      expect(workflow).toEqual(
        expect.objectContaining({
          fb_page_id: 'old-page',
          fb_access_token_encrypted: 'old-fb',
          ig_user_id: 'old-ig',
          ig_access_token_encrypted: 'old-ig-tok',
          x_api_key: 'old-x-key',
          x_api_secret_encrypted: 'old-x-secret',
          x_access_token_encrypted: 'old-x-token',
          x_access_token_secret_encrypted: 'old-x-token-secret',
          enabled_channels: ['facebook'],
        }),
      );
    }
  });

  it('nie ustawia enabled_channels gdy env AICO_SOCIAL_CHANNELS pusty', async () => {
    vi.stubEnv('AICO_OPENROUTER_TOKEN', 'llm-token');
    vi.stubEnv('AICO_ENABLE_WORKFLOWS', 'true');
    vi.stubEnv('AICO_SOCIAL_CHANNELS', '');

    const strapi = createStrapiMock({});
    await upsertAicoWorkflows(strapi, ['daily_card']);

    const saved = (strapi as unknown as { __saved: Record<string, unknown>[] })
      .__saved;
    for (const workflow of saved) {
      expect(workflow).toEqual(
        expect.objectContaining({
          enabled_channels: undefined,
        }),
      );
    }
  });
});
