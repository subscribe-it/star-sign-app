import { describe, expect, it, vi } from 'vitest';

import type { Core } from '@strapi/strapi';

import { ensureGlobalSettings, upsertAicoWorkflows } from '../bootstrap/content';
import { isAicoPluginEnabled } from './aico';

const strapiWithContentTypes = (contentTypes: object): Core.Strapi =>
  ({
    contentTypes,
    db: {
      query: vi.fn(() => {
        throw new Error('db.query nie powinno być wołane bez AICO');
      }),
    },
    store: vi.fn(() => {
      throw new Error('store nie powinno być wołane bez AICO');
    }),
  }) as unknown as Core.Strapi;

describe('isAicoPluginEnabled', () => {
  it('zwraca false, gdy content-type wtyczki nie jest załadowany', () => {
    expect(isAicoPluginEnabled(strapiWithContentTypes({}))).toBe(false);
  });

  it('zwraca true, gdy content-type wtyczki istnieje', () => {
    expect(
      isAicoPluginEnabled(
        strapiWithContentTypes({
          'plugin::ai-content-orchestrator.media-asset': {},
        }),
      ),
    ).toBe(true);
  });
});

describe('bootstrap bez AICO', () => {
  it('upsertAicoWorkflows i ensureGlobalSettings nic nie robią', async () => {
    const strapi = strapiWithContentTypes({});

    await expect(
      upsertAicoWorkflows(strapi, ['horoscope']),
    ).resolves.toBeUndefined();
    await expect(ensureGlobalSettings(strapi)).resolves.toBeUndefined();
  });
});
