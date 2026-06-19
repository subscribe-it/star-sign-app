import { describe, expect, it, vi } from 'vitest';

import { EDITORIAL_MEMORY_UID } from '../constants';
import type { EditorialMemoryRecord, Strapi } from '../types';
import {
  buildEditorialContext,
  EDITORIAL_CONTEXT_MAX_CHARS,
} from '../utils/editorial-context';

const createStrapi = (rows: Partial<EditorialMemoryRecord>[], findManyImpl?: any): Strapi => {
  const findMany =
    findManyImpl ??
    vi.fn(async (uid: string, query?: any) => {
      expect(uid).toBe(EDITORIAL_MEMORY_UID);

      let result = rows.map((row, index) => ({ id: index + 1, ...row }));

      if (query?.filters?.active === true) {
        result = result.filter((row) => row.active === true);
      }

      // Mirror sort by priority desc, id asc.
      result.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id - b.id);

      return result;
    });

  return {
    entityService: { findMany },
    log: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  } as unknown as Strapi;
};

describe('buildEditorialContext', () => {
  it('returns an empty string when there are no active entries (safe no-op)', async () => {
    const strapi = createStrapi([{ memory_type: 'brand_voice', content: 'X', active: false }]);

    const result = await buildEditorialContext(strapi);

    expect(result).toBe('');
  });

  it('returns an empty string when editorial-memory is empty', async () => {
    const strapi = createStrapi([]);

    expect(await buildEditorialContext(strapi)).toBe('');
  });

  it('formats active entries grouped by memory type with Polish labels', async () => {
    const strapi = createStrapi([
      {
        memory_type: 'brand_voice',
        label: 'Ton',
        content: 'Pisz ciepło i przystępnie.',
        active: true,
        priority: 10,
      },
      {
        memory_type: 'seo_rule',
        label: 'Słowa kluczowe',
        content: 'Używaj fraz long-tail.',
        active: true,
        priority: 5,
      },
      {
        memory_type: 'prohibited_phrase',
        label: 'Zakaz',
        content: 'Nie obiecuj cudów.',
        active: true,
        priority: 1,
      },
      {
        memory_type: 'linking_rule',
        label: 'Linki',
        content: 'Linkuj do powiązanych horoskopów.',
        active: true,
        priority: 0,
      },
    ]);

    const result = await buildEditorialContext(strapi);

    expect(result).toContain('Głos marki:');
    expect(result).toContain('Pisz ciepło i przystępnie.');
    expect(result).toContain('Zasady SEO:');
    expect(result).toContain('Zwroty zakazane:');
    expect(result).toContain('Zasady linkowania:');
    expect(result).toContain('Ton: Pisz ciepło i przystępnie.');
  });

  it("excludes the 'persona' and 'custom' memory types", async () => {
    const strapi = createStrapi([
      {
        memory_type: 'persona',
        label: 'Persona',
        content: 'TO_NIE_MOZE_BYC_W_BLOKU',
        active: true,
        priority: 100,
      },
      {
        memory_type: 'custom',
        label: 'Insight',
        content: 'TO_TEZ_NIE',
        active: true,
        priority: 100,
      },
      {
        memory_type: 'brand_voice',
        label: 'Ton',
        content: 'Pisz ciepło.',
        active: true,
        priority: 1,
      },
    ]);

    const result = await buildEditorialContext(strapi);

    expect(result).not.toContain('TO_NIE_MOZE_BYC_W_BLOKU');
    expect(result).not.toContain('TO_TEZ_NIE');
    expect(result).toContain('Pisz ciepło.');
  });

  it('returns an empty string when only excluded types are active', async () => {
    const strapi = createStrapi([
      { memory_type: 'persona', content: 'X', active: true, priority: 1 },
      { memory_type: 'custom', content: 'Y', active: true, priority: 1 },
    ]);

    expect(await buildEditorialContext(strapi)).toBe('');
  });

  it('caps the block at the hard length limit', async () => {
    const long = 'a'.repeat(5000);
    const strapi = createStrapi([
      { memory_type: 'brand_voice', label: 'Ton', content: long, active: true, priority: 1 },
    ]);

    const result = await buildEditorialContext(strapi);

    expect(result.length).toBeLessThanOrEqual(EDITORIAL_CONTEXT_MAX_CHARS);
  });

  it('returns an empty string and never throws when the query fails', async () => {
    const failing = vi.fn(async () => {
      throw new Error('db down');
    });
    const strapi = createStrapi([], failing);

    expect(await buildEditorialContext(strapi)).toBe('');
  });
});
