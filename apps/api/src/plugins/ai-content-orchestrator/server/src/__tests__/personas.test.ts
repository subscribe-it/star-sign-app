import { describe, expect, it, vi } from 'vitest';

import { EDITOR_PERSONA_UID, PLUGIN_ID } from '../constants';
import personasService from '../services/personas';
import type { Strapi } from '../types';

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

const createInMemoryEntityService = () => {
  const rows: any[] = [];

  return {
    rows,
    create: vi.fn(async (uid: string, payload: any) => {
      expect(uid).toBe(EDITOR_PERSONA_UID);
      const record = { id: rows.length + 1, ...payload.data };
      rows.push(record);
      return record;
    }),
    update: vi.fn(async (uid: string, id: number, payload: any) => {
      expect(uid).toBe(EDITOR_PERSONA_UID);
      const index = rows.findIndex((item) => item.id === id);
      rows[index] = { ...rows[index], ...payload.data };
      return rows[index];
    }),
    findOne: vi.fn(async (uid: string, id: number) => {
      expect(uid).toBe(EDITOR_PERSONA_UID);
      return rows.find((item) => item.id === id) ?? null;
    }),
    findMany: vi.fn(async (uid: string, query?: any) => {
      expect(uid).toBe(EDITOR_PERSONA_UID);
      let result = [...rows];

      if (query?.filters?.active === true) {
        result = result.filter((item) => item.active === true);
      }

      if (typeof query?.filters?.key === 'string') {
        result = result.filter((item) => item.key === query.filters.key);
      }

      if (typeof query?.limit === 'number') {
        result = result.slice(0, query.limit);
      }

      return result;
    }),
    delete: vi.fn(async (uid: string, id: number) => {
      expect(uid).toBe(EDITOR_PERSONA_UID);
      const index = rows.findIndex((item) => item.id === id);
      const [removed] = rows.splice(index, 1);
      return removed;
    }),
  };
};

describe('editor personas service', () => {
  it('creates a persona with trimmed fields and defaults', async () => {
    const entityService = createInMemoryEntityService();
    const api = personasService({ strapi: createStrapi({}, entityService) });

    const created = await api.create({
      name: '  Luna Mistyczna  ',
      key: 'luna-mistyczna',
      byline: ' Luna Mistyczna ',
      specialization: 'Astrologia i horoskopy',
      temperature: 0.5,
      enabled_for: ['article', 'horoscope'],
    });

    expect(created.id).toBe(1);
    expect(created.name).toBe('Luna Mistyczna');
    expect(created.key).toBe('luna-mistyczna');
    expect(created.byline).toBe('Luna Mistyczna');
    expect(created.active).toBe(true);
    expect(created.priority).toBe(0);
    expect(created.temperature).toBe(0.5);
    expect(created.enabled_for).toEqual(['article', 'horoscope']);
  });

  it('clamps temperature to the allowed range on create', async () => {
    const entityService = createInMemoryEntityService();
    const api = personasService({ strapi: createStrapi({}, entityService) });

    const tooHigh = await api.create({ name: 'Gorąca', temperature: 5 });
    const tooLow = await api.create({ name: 'Zimna', temperature: -2 });

    expect(tooHigh.temperature).toBe(2);
    expect(tooLow.temperature).toBe(0);
  });

  it('rejects a persona without a name', async () => {
    const entityService = createInMemoryEntityService();
    const api = personasService({ strapi: createStrapi({}, entityService) });

    await expect(api.create({ name: '   ' })).rejects.toThrow('Persona musi mieć nazwę.');
  });

  it('finds a persona by its key', async () => {
    const entityService = createInMemoryEntityService();
    const api = personasService({ strapi: createStrapi({}, entityService) });

    await api.create({ name: 'Luna Mistyczna', key: 'luna-mistyczna' });
    await api.create({ name: 'Rzeczowy Redaktor', key: 'rzeczowy-redaktor' });

    const found = await api.getByKey('rzeczowy-redaktor');
    const missing = await api.getByKey('nie-istnieje');

    expect(found?.name).toBe('Rzeczowy Redaktor');
    expect(missing).toBeNull();
  });

  it('lists only active personas when activeOnly is set', async () => {
    const entityService = createInMemoryEntityService();
    const api = personasService({ strapi: createStrapi({}, entityService) });

    await api.create({ name: 'Aktywna', key: 'aktywna', active: true });
    await api.create({ name: 'Nieaktywna', key: 'nieaktywna', active: false });

    const all = await api.list();
    const activeOnly = await api.list({ activeOnly: true });

    expect(all).toHaveLength(2);
    expect(activeOnly).toHaveLength(1);
    expect(activeOnly[0].name).toBe('Aktywna');
  });

  it('updates only the provided persona fields', async () => {
    const entityService = createInMemoryEntityService();
    const api = personasService({ strapi: createStrapi({}, entityService) });

    const created = await api.create({
      name: 'Luna Mistyczna',
      key: 'luna-mistyczna',
      specialization: 'Astrologia',
    });

    const updated = await api.update(created.id, {
      specialization: 'Astrologia i tarot',
      active: false,
    });

    expect(updated.specialization).toBe('Astrologia i tarot');
    expect(updated.active).toBe(false);
    expect(updated.name).toBe('Luna Mistyczna');
    expect(updated.key).toBe('luna-mistyczna');
  });

  it('throws when updating a persona that does not exist', async () => {
    const entityService = createInMemoryEntityService();
    const api = personasService({ strapi: createStrapi({}, entityService) });

    await expect(api.update(999, { name: 'Nowa' })).rejects.toThrow(
      'Nie znaleziono persony #999.'
    );
  });

  it('removes a persona by id', async () => {
    const entityService = createInMemoryEntityService();
    const api = personasService({ strapi: createStrapi({}, entityService) });

    const created = await api.create({ name: 'Do usunięcia', key: 'do-usuniecia' });
    await api.remove(created.id);

    expect(entityService.delete).toHaveBeenCalledWith(EDITOR_PERSONA_UID, created.id);
    expect(await api.getById(created.id)).toBeNull();
  });

  it('resolves a persona for a topic by key, by id and returns null when missing', async () => {
    const entityService = createInMemoryEntityService();
    const api = personasService({ strapi: createStrapi({}, entityService) });

    const created = await api.create({ name: 'Luna Mistyczna', key: 'luna-mistyczna' });

    const byKey = await api.resolveForTopic('luna-mistyczna');
    const byNumericId = await api.resolveForTopic(created.id);
    const byStringId = await api.resolveForTopic(String(created.id));
    const missingKey = await api.resolveForTopic('nie-istnieje');
    const missingId = await api.resolveForTopic(999);

    expect(byKey?.id).toBe(created.id);
    expect(byNumericId?.id).toBe(created.id);
    expect(byStringId?.id).toBe(created.id);
    expect(missingKey).toBeNull();
    expect(missingId).toBeNull();
  });
});
