import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, it, expect } from 'vitest';

import experimentAgent, {
  metricFieldForExperiment,
} from '../services/experiment-agent';
import { CONTENT_PERFORMANCE_SNAPSHOT_UID, GROWTH_EXPERIMENT_UID } from '../constants';
import type { Strapi } from '../types';

type Row = Record<string, unknown>;

const match = (row: Row, filters?: Record<string, unknown>): boolean => {
  if (!filters) return true;
  return Object.entries(filters).every(([key, cond]) => {
    if (key === '$or' && Array.isArray(cond)) {
      return (cond as Record<string, unknown>[]).some((sub) => match(row, sub));
    }
    if (cond && typeof cond === 'object' && '$in' in (cond as Record<string, unknown>)) {
      return ((cond as { $in: unknown[] }).$in ?? []).includes(row[key]);
    }
    if (cond && typeof cond === 'object' && '$gte' in (cond as Record<string, unknown>)) {
      return String(row[key]) >= String((cond as { $gte: unknown }).$gte);
    }
    return row[key] === cond;
  });
};

const makeStrapi = () => {
  const store: Record<string, Row[]> = {};
  let id = 1;
  const entityService = {
    async findMany(uid: string, params: { filters?: Record<string, unknown> } = {}) {
      return (store[uid] ?? []).filter((r) => match(r, params.filters)).map((r) => ({ ...r }));
    },
    async create(uid: string, params: { data: Row }) {
      store[uid] = store[uid] ?? [];
      const row = { id: id++, ...params.data };
      store[uid].push(row);
      return { ...row };
    },
    async update(uid: string, rid: unknown, params: { data: Row }) {
      const row = (store[uid] ?? []).find((r) => r.id === rid);
      Object.assign(row ?? {}, params.data);
      return { ...(row ?? {}) };
    },
  };
  const strapi = {
    entityService,
    log: { warn: () => undefined, info: () => undefined },
    plugin: () => undefined,
  } as unknown as Strapi;
  return { strapi, store };
};

describe('metricFieldForExperiment — newsletter as a first-class conversion metric', () => {
  it("maps 'newsletter_signup' to 'newsletter_events'", () => {
    expect(metricFieldForExperiment('newsletter_signup')).toBe('newsletter_events');
  });

  it("maps the short alias 'newsletter' to 'newsletter_events'", () => {
    expect(metricFieldForExperiment('newsletter')).toBe('newsletter_events');
  });

  it('trims whitespace around the newsletter metric', () => {
    expect(metricFieldForExperiment('  newsletter_signup  ')).toBe('newsletter_events');
  });

  it('keeps existing metric mappings unchanged (backward compatible)', () => {
    expect(metricFieldForExperiment('begin_checkout')).toBe('checkout_events');
    expect(metricFieldForExperiment('checkout_redirect')).toBe('checkout_events');
    expect(metricFieldForExperiment('premium_content_view')).toBe('premium_events');
    expect(metricFieldForExperiment('premium_content_impression')).toBe('premium_events');
    expect(metricFieldForExperiment('premium_cta_click')).toBe('cta_clicks');
  });

  it('falls back to the default cta_clicks for unknown / empty metrics', () => {
    expect(metricFieldForExperiment(undefined)).toBe('cta_clicks');
    expect(metricFieldForExperiment(null)).toBe('cta_clicks');
    expect(metricFieldForExperiment('')).toBe('cta_clicks');
    expect(metricFieldForExperiment('something_else')).toBe('cta_clicks');
  });
});

describe('experiment evaluation uses newsletter_events like the other metrics', () => {
  it('picks the variant with more newsletter sign-ups as the winner', async () => {
    const { strapi, store } = makeStrapi();

    store[GROWTH_EXPERIMENT_UID] = [
      {
        id: 1,
        name: 'Newsletter CTA test',
        status: 'running',
        primary_metric: 'newsletter_signup',
        started_at: '2026-06-01T00:00:00.000Z',
        variants: [
          { key: 'a', content_slug: 'art-a' },
          { key: 'b', content_slug: 'art-b' },
        ],
        metadata: { min_sample_size: 100 },
      },
    ];

    // Variant A converts strongly on newsletter sign-ups, B barely at all.
    store[CONTENT_PERFORMANCE_SNAPSHOT_UID] = [
      {
        id: 10,
        unique_key: 'a',
        snapshot_day: '2026-06-02',
        content_slug: 'art-a',
        content_entry_id: 101,
        views: 1000,
        newsletter_events: 120,
        cta_clicks: 0,
      },
      {
        id: 11,
        unique_key: 'b',
        snapshot_day: '2026-06-02',
        content_slug: 'art-b',
        content_entry_id: 102,
        views: 1000,
        newsletter_events: 20,
        cta_clicks: 0,
      },
    ];

    const agent = experimentAgent({ strapi });
    const result = await agent.evaluate({ now: new Date('2026-06-10T00:00:00.000Z') });

    expect(result.evaluated).toBe(1);
    const [evaluation] = result.results;
    expect(evaluation.outcome).toBe('winner');
    expect(evaluation.winnerVariantKey).toBe('a');
    // Successes must come from the newsletter_events counter, not cta_clicks (which are 0).
    const winnerStats = evaluation.variants?.find((v) => v.key === 'a');
    expect(winnerStats?.successes).toBe(120);
  });
});

describe('schema fields — newsletter_events present and additive', () => {
  const readSchema = (relative: string) =>
    JSON.parse(
      readFileSync(path.join(__dirname, '..', 'content-types', relative, 'schema.json'), 'utf8')
    ) as { attributes: Record<string, { type: string; default?: unknown }> };

  it('growth-experiment exposes a newsletter_events integer (default 0) mirroring the *_events fields', () => {
    const schema = readSchema('growth-experiment');
    expect(schema.attributes.newsletter_events).toEqual({ type: 'integer', default: 0 });
  });

  it('content-performance-snapshot exposes newsletter_events so the metric can be evaluated', () => {
    const schema = readSchema('content-performance-snapshot');
    expect(schema.attributes.newsletter_events).toEqual({ type: 'integer', default: 0 });
    // Existing metric fields stay intact (backward compatible).
    expect(schema.attributes.cta_clicks).toEqual({ type: 'integer', default: 0 });
    expect(schema.attributes.checkout_events).toEqual({ type: 'integer', default: 0 });
    expect(schema.attributes.premium_events).toEqual({ type: 'integer', default: 0 });
  });
});
