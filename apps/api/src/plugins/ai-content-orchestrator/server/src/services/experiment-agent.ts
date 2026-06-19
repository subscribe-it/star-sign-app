import {
  CONTENT_PERFORMANCE_SNAPSHOT_UID,
  EDITORIAL_MEMORY_UID,
  GROWTH_EXPERIMENT_UID,
} from '../constants';
import type {
  ContentPerformanceSnapshotRecord,
  EditorialMemoryRecord,
  GrowthExperimentRecord,
  Strapi,
} from '../types';
import { recordSystemAuditEvent } from '../utils/audit-trail';
import { getEntityService } from '../utils/entity-service';
import { isRecord, toSafeErrorMessage } from '../utils/json';
import { getPluginService } from '../utils/plugin';

export const EXPERIMENT_MIN_SAMPLE_SIZE = 100;
export const EXPERIMENT_Z_CRITICAL_95 = 1.96;

/**
 * Przybliżona odwrotność dystrybuanty rozkładu normalnego (Acklam) — używana
 * do skorygowanej wartości krytycznej z przy poprawce Bonferroniego dla A/B/n.
 */
export const inverseNormalCdf = (p: number): number => {
  if (!(p > 0 && p < 1)) {
    return EXPERIMENT_Z_CRITICAL_95;
  }

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
};

/**
 * Wartość krytyczna z dla dwustronnego testu z poprawką Bonferroniego.
 * Dla 2 wariantów (1 porównanie) zwraca klasyczne 1.96 (95%).
 * Dla A/B/n dzieli alfa przez liczbę porównań par → zaostrza próg.
 */
export const bonferroniZCritical = (comparisons: number, alpha = 0.05): number => {
  const safeComparisons = Math.max(1, Math.floor(comparisons));
  if (safeComparisons === 1) {
    return EXPERIMENT_Z_CRITICAL_95;
  }
  const adjustedAlpha = alpha / safeComparisons;
  return inverseNormalCdf(1 - adjustedAlpha / 2);
};

export type ExperimentVariantStats = {
  key: string;
  trials: number;
  successes: number;
  rate: number;
};

export type ZTestResult = {
  z: number;
  significant: boolean;
  winner: 'a' | 'b' | null;
};

export type ExperimentEvaluation = {
  experimentId: number;
  outcome: 'winner' | 'inconclusive' | 'insufficient_sample' | 'invalid_variants';
  reason?: string;
  winnerVariantKey?: string;
  loserVariantKey?: string;
  applied: boolean;
  z?: number;
  variants?: ExperimentVariantStats[];
};

/**
 * Dwustronny test z dla dwóch proporcji (95% poziom ufności przy zCritical=1.96).
 */
export const twoProportionZTest = (
  input: {
    aSuccesses: number;
    aTrials: number;
    bSuccesses: number;
    bTrials: number;
  },
  zCritical = EXPERIMENT_Z_CRITICAL_95
): ZTestResult => {
  const { aTrials, bTrials } = input;

  if (aTrials <= 0 || bTrials <= 0) {
    return { z: 0, significant: false, winner: null };
  }

  // Zabezpieczenie: sukcesy (kliknięcia/checkout/premium) nie są gwarantowane <= próby (views).
  // Clampujemy do [0, trials], by proporcja pA/pB nigdy nie przekroczyła 1 ani nie była ujemna.
  const aSuccesses = Math.min(Math.max(0, input.aSuccesses), aTrials);
  const bSuccesses = Math.min(Math.max(0, input.bSuccesses), bTrials);

  const pA = aSuccesses / aTrials;
  const pB = bSuccesses / bTrials;
  const pooled = (aSuccesses + bSuccesses) / (aTrials + bTrials);
  const standardError = Math.sqrt(pooled * (1 - pooled) * (1 / aTrials + 1 / bTrials));

  if (!Number.isFinite(standardError) || standardError === 0) {
    return { z: 0, significant: false, winner: null };
  }

  const z = (pA - pB) / standardError;
  const significant = Math.abs(z) >= zCritical;

  return {
    z: Math.round(z * 10000) / 10000,
    significant,
    winner: significant ? (z > 0 ? 'a' : 'b') : null,
  };
};

export type ExperimentMetricField =
  | 'cta_clicks'
  | 'checkout_events'
  | 'premium_events'
  | 'newsletter_events';

/**
 * Mapuje primary_metric eksperymentu na pole licznika sukcesów w snapshotcie
 * wydajności. Newsletter sign-up to jedyny żywy kanał konwersji dopóki Premium
 * jest w trybie 'open', więc autopilot może optymalizować eksperymenty wprost
 * pod zapisy do newslettera (primary_metric = 'newsletter_signup' / 'newsletter').
 * Domyślna metryka (cta_clicks) pozostaje bez zmian, gdy metryka nie pasuje do
 * żadnej znanej gałęzi — zachowanie wstecznie kompatybilne.
 */
export const metricFieldForExperiment = (
  primaryMetric?: string | null
): ExperimentMetricField => {
  const metric = String(primaryMetric ?? '').trim();
  if (metric === 'begin_checkout' || metric === 'checkout_redirect') {
    return 'checkout_events';
  }
  if (metric === 'premium_content_view' || metric === 'premium_content_impression') {
    return 'premium_events';
  }
  if (metric === 'newsletter_signup' || metric === 'newsletter') {
    return 'newsletter_events';
  }
  return 'cta_clicks';
};

type NormalizedVariant = {
  key: string;
  contentEntryId: number | null;
  contentSlug: string | null;
};

const normalizeVariants = (raw: unknown): NormalizedVariant[] => {
  const list = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.variants) ? raw.variants : [];

  return list
    .filter(isRecord)
    .map((variant) => ({
      key: String(variant.key ?? variant.variant_key ?? '').trim(),
      contentEntryId:
        typeof variant.content_entry_id === 'number' ? variant.content_entry_id : null,
      contentSlug:
        typeof variant.content_slug === 'string' && variant.content_slug.trim()
          ? variant.content_slug.trim()
          : null,
    }))
    .filter((variant) => variant.key && (variant.contentEntryId !== null || variant.contentSlug));
};

const experimentAgent = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  return {
    async list(input: { status?: string; limit?: number } = {}): Promise<GrowthExperimentRecord[]> {
      const filters: Record<string, unknown> = {};
      if (input.status) filters.status = input.status;

      return entityService.findMany<GrowthExperimentRecord>(GROWTH_EXPERIMENT_UID, {
        filters,
        sort: [{ updatedAt: 'desc' }],
        populate: ['workflow'],
        limit: Math.max(1, Math.min(200, Number(input.limit ?? 50))),
      });
    },

    async chooseWinner(id: number, winnerVariantKey: string): Promise<GrowthExperimentRecord> {
      return entityService.update<GrowthExperimentRecord>(GROWTH_EXPERIMENT_UID, id, {
        data: {
          status: 'completed',
          ended_at: new Date().toISOString(),
          winner_variant_key: winnerVariantKey,
          decision: {
            chosenBy: 'experiment-agent',
            reason: 'manual_or_policy_decision',
          },
        },
      });
    },

    async evaluate(input: { now?: Date; minSampleSize?: number } = {}): Promise<{
      evaluated: number;
      decided: number;
      results: ExperimentEvaluation[];
    }> {
      const now = input.now ?? new Date();
      // Auto-apply winners when enabled by the global env OR by the autonomy policy
      // toggle (auto_apply_experiments) surfaced in the admin panel. Best-effort
      // policy read so unit tests without the policy service keep using the env flag.
      let policyAutoApply = false;
      try {
        const policyService = getPluginService<
          { getPolicy?: () => Promise<{ auto_apply_experiments?: boolean }> } | undefined
        >(strapi, 'autonomy-policy');
        policyAutoApply = (await policyService?.getPolicy?.())?.auto_apply_experiments === true;
      } catch {
        policyAutoApply = false;
      }
      const autoApply =
        process.env.AICO_STRATEGY_AUTO_APPROVE_PLAN === 'true' || policyAutoApply;

      const experiments = await entityService.findMany<GrowthExperimentRecord>(
        GROWTH_EXPERIMENT_UID,
        {
          filters: { status: 'running' },
          sort: [{ id: 'asc' }],
          limit: 50,
        }
      );

      const results: ExperimentEvaluation[] = [];
      let decided = 0;

      for (const experiment of experiments) {
        try {
          const result = await this.evaluateExperiment(experiment, { now, autoApply, ...input });
          results.push(result);
          if (result.outcome === 'winner') {
            decided += 1;
          }
        } catch (error) {
          strapi.log.warn(
            `[AICO] Experiment #${experiment.id} evaluation failed: ${toSafeErrorMessage(error)}`
          );
        }
      }

      return { evaluated: experiments.length, decided, results };
    },

    async evaluateExperiment(
      experiment: GrowthExperimentRecord,
      options: { now: Date; autoApply: boolean; minSampleSize?: number }
    ): Promise<ExperimentEvaluation> {
      const variants = normalizeVariants(experiment.variants);
      if (variants.length < 2) {
        return {
          experimentId: experiment.id,
          outcome: 'invalid_variants',
          applied: false,
        };
      }

      const minSampleSize = Math.max(
        10,
        Number(
          options.minSampleSize ??
            (isRecord(experiment.metadata) ? experiment.metadata.min_sample_size : undefined) ??
            EXPERIMENT_MIN_SAMPLE_SIZE
        )
      );

      const startDay = String(experiment.started_at ?? '').slice(0, 10);
      if (!startDay) {
        // Brak started_at = brak okna pomiarowego. NIE odpytujemy snapshotów all-time
        // (groziłoby to zliczeniem ruchu sprzed eksperymentu). Status zostaje 'running',
        // nie zapisujemy decyzji — jedynie ślad audytowy o pominięciu ewaluacji.
        await recordSystemAuditEvent(strapi, {
          action: 'experiment.evaluate.skipped_no_start',
          outcome: 'success',
          severity: 'warn',
          resourceUid: GROWTH_EXPERIMENT_UID,
          resourceId: experiment.id,
          metadata: { experimentId: experiment.id },
        });

        return {
          experimentId: experiment.id,
          outcome: 'inconclusive',
          reason: 'missing_started_at',
          applied: false,
        };
      }

      const variantEntryIds = variants
        .map((variant) => variant.contentEntryId)
        .filter((id): id is number => id !== null);
      const variantSlugs = variants
        .map((variant) => variant.contentSlug)
        .filter((slug): slug is string => slug !== null);
      const variantFilters: Record<string, unknown>[] = [];
      if (variantEntryIds.length > 0) {
        variantFilters.push({ content_entry_id: { $in: variantEntryIds } });
      }
      if (variantSlugs.length > 0) {
        variantFilters.push({ content_slug: { $in: variantSlugs } });
      }

      const snapshots = await entityService.findMany<ContentPerformanceSnapshotRecord>(
        CONTENT_PERFORMANCE_SNAPSHOT_UID,
        {
          filters:
            variantFilters.length > 0
              ? { snapshot_day: { $gte: startDay }, $or: variantFilters }
              : { snapshot_day: { $gte: startDay } },
          // Sortowanie rosnące po dacie: limit:2000 nie obetnie istotnych wierszy w losowej kolejności.
          sort: [{ snapshot_day: 'asc' }],
          limit: 2000,
        }
      );

      const metricField = metricFieldForExperiment(experiment.primary_metric);
      const stats = variants.map((variant) => {
        let trials = 0;
        let successes = 0;

        for (const snapshot of snapshots) {
          const matches =
            (variant.contentEntryId !== null &&
              Number(snapshot.content_entry_id) === variant.contentEntryId) ||
            (variant.contentSlug !== null && snapshot.content_slug === variant.contentSlug);
          if (!matches) {
            continue;
          }

          trials += Number(snapshot.views ?? 0);
          successes += Number(snapshot[metricField] ?? 0);
        }

        return {
          key: variant.key,
          trials,
          successes,
          rate: trials > 0 ? successes / trials : 0,
        };
      });

      // Nieprawidłowe metryki (sukcesy > próby lub brak prób) = brak decyzji, nigdy auto-apply.
      if (stats.some((variant) => variant.trials <= 0 || variant.successes > variant.trials)) {
        return {
          experimentId: experiment.id,
          outcome: 'inconclusive',
          reason: 'invalid_metrics',
          applied: false,
          variants: stats,
        };
      }

      if (stats.some((variant) => variant.trials < minSampleSize)) {
        return {
          experimentId: experiment.id,
          outcome: 'insufficient_sample',
          applied: false,
          variants: stats,
        };
      }

      const sorted = [...stats].sort((a, b) => b.rate - a.rate);
      const [best, runnerUp] = sorted;

      // Poprawka na wielokrotne porównania (A/B/n): przy >2 wariantach mamy
      // C(n,2) par, więc dzielimy alfa przez liczbę porównań (Bonferroni) i
      // zaostrzamy próg z. Dla 2 wariantów zostaje klasyczne 95% (z=1.96).
      const comparisons = (stats.length * (stats.length - 1)) / 2;
      const zCritical = bonferroniZCritical(comparisons);
      const confidence = comparisons <= 1 ? 0.95 : 1 - 0.05 / comparisons;
      const test = twoProportionZTest(
        {
          aSuccesses: best.successes,
          aTrials: best.trials,
          bSuccesses: runnerUp.successes,
          bTrials: runnerUp.trials,
        },
        zCritical
      );

      const outcome: ExperimentEvaluation['outcome'] = test.significant ? 'winner' : 'inconclusive';
      const winnerVariantKey = test.significant ? best.key : undefined;
      const loserVariantKey = test.significant ? runnerUp.key : undefined;
      const applied = Boolean(test.significant && options.autoApply);

      const decision = {
        evaluatedAt: options.now.toISOString(),
        evaluatedBy: 'experiment-agent',
        method: 'two_proportion_z_test',
        confidence: Math.round(confidence * 10000) / 10000,
        comparisons,
        zCritical: Math.round(zCritical * 10000) / 10000,
        z: test.z,
        outcome,
        metricField,
        minSampleSize,
        variants: stats,
        recommendedWinner: winnerVariantKey ?? null,
        autoApplied: applied,
      };

      await entityService.update(GROWTH_EXPERIMENT_UID, experiment.id, {
        data: applied
          ? {
              status: 'completed',
              ended_at: options.now.toISOString(),
              winner_variant_key: winnerVariantKey,
              decision,
            }
          : { decision },
      });

      await this.recordDecisionMemory(experiment, decision, options.now);

      await recordSystemAuditEvent(strapi, {
        action: 'experiment.evaluate',
        outcome: 'success',
        severity: 'info',
        resourceUid: GROWTH_EXPERIMENT_UID,
        resourceId: experiment.id,
        metadata: decision,
      });

      return {
        experimentId: experiment.id,
        outcome,
        winnerVariantKey,
        loserVariantKey,
        applied,
        z: test.z,
        variants: stats,
      };
    },

    async recordDecisionMemory(
      experiment: GrowthExperimentRecord,
      decision: Record<string, unknown>,
      now: Date
    ): Promise<void> {
      const key = `experiment:${experiment.id}:decision`;
      const outcome = String(decision.outcome ?? 'inconclusive');
      const winner = decision.recommendedWinner ? String(decision.recommendedWinner) : null;
      const content =
        outcome === 'winner'
          ? `Eksperyment "${experiment.name}" ma zwycięzcę: wariant "${winner}" (test z, 95% ufności).${
              decision.autoApplied ? ' Zastosowano automatycznie.' : ' Czeka na decyzję admina.'
            }`
          : `Eksperyment "${experiment.name}" bez rozstrzygnięcia (test z, 95% ufności). Zbieraj dalej dane.`;

      const data = {
        key,
        label: `Decyzja eksperymentu: ${experiment.name}`,
        memory_type: 'custom' as const,
        content,
        active: true,
        priority: 60,
        metadata: {
          kind: 'experiment_decision',
          experimentId: experiment.id,
          generatedAt: now.toISOString(),
          decision,
        },
      };

      const existing = await entityService.findMany<EditorialMemoryRecord>(EDITORIAL_MEMORY_UID, {
        filters: { key },
        limit: 1,
      });

      if (existing[0]) {
        await entityService.update(EDITORIAL_MEMORY_UID, existing[0].id, { data });
        return;
      }

      await entityService.create(EDITORIAL_MEMORY_UID, { data });
    },
  };
};

export default experimentAgent;
