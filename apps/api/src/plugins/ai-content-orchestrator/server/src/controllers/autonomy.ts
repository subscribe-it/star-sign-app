import type { Context } from 'koa';

import { AUTONOMY_POLICY_UID } from '../constants';
import type { AutonomyPolicyRecord, Strapi } from '../types';
import { recordAdminAuditEvent } from '../utils/audit-trail';
import { toSafeErrorMessage } from '../utils/json';

const isTruthy = (value: unknown): boolean =>
  ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase());

const RUN_NOW_CONFIRMATION = 'RUN_AICO_CONTROLLED_TICK';

// Fields excluded from the audit diff: identity/timestamps that are not part of
// the governance policy the admin is changing, and never-dump blobs.
const POLICY_DIFF_IGNORED_KEYS = new Set([
  'id',
  'policy_key',
  'createdAt',
  'updatedAt',
]);

// Compute a compact before/after diff for governance-sensitive policy changes.
// Only keys present in the request payload that actually changed are recorded;
// values are JSON-comparable scalars/arrays/objects from the policy record.
const diffPolicyChanges = (
  before: AutonomyPolicyRecord,
  after: AutonomyPolicyRecord,
  payload: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> => {
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(payload)) {
    if (POLICY_DIFF_IGNORED_KEYS.has(key)) {
      continue;
    }
    const from = (before as Record<string, unknown>)[key];
    const to = (after as Record<string, unknown>)[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changed[key] = { from, to };
    }
  }
  return changed;
};

const autonomyController = ({ strapi }: { strapi: Strapi }) => ({
  async status(ctx: Context): Promise<void> {
    try {
      const [policy, counts, tick, providerReadiness] = await Promise.all([
        strapi.plugin('ai-content-orchestrator').service('autonomy-policy').getPolicy(),
        strapi.plugin('ai-content-orchestrator').service('autonomy-policy').getCounts(),
        strapi.plugin('ai-content-orchestrator').service('autopilot').dryRunTick(),
        strapi.plugin('ai-content-orchestrator').service('provider-status').getReadinessMatrix(),
      ]);

      ctx.body = { data: { policy, counts, providerReadiness, dryRunPreview: tick } };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },

  async updatePolicy(ctx: Context): Promise<void> {
    try {
      const payload = (ctx.request.body ?? {}) as Record<string, unknown>;
      const policyService = strapi.plugin('ai-content-orchestrator').service('autonomy-policy');

      // Capture the current governance policy BEFORE applying the update so the
      // audit trail can record a precise before/after diff of changed fields.
      const previousPolicy = await policyService.getPolicy();
      const policy = await policyService.updatePolicy(payload);

      const changed = diffPolicyChanges(previousPolicy, policy, payload);

      await recordAdminAuditEvent(strapi, ctx, {
        action: 'autonomy.policy.update',
        outcome: 'success',
        // Governance-sensitive change (money/automation limits): elevate severity.
        severity: 'warn',
        resourceUid: AUTONOMY_POLICY_UID,
        resourceId: policy.id,
        metadata: {
          changed,
          changedKeys: Object.keys(changed),
          autonomy_mode: policy.autonomy_mode,
        },
      });

      ctx.body = { data: policy };
    } catch (error) {
      const message = toSafeErrorMessage(error);
      await recordAdminAuditEvent(strapi, ctx, {
        action: 'autonomy.policy.update',
        outcome: 'failure',
        severity: 'error',
        resourceUid: AUTONOMY_POLICY_UID,
        metadata: { error: message },
      });
      ctx.badRequest(message);
    }
  },

  async dryRunTick(ctx: Context): Promise<void> {
    try {
      const result = await strapi
        .plugin('ai-content-orchestrator')
        .service('autopilot')
        .dryRunTick();

      ctx.body = { data: result };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },

  async runNow(ctx: Context): Promise<void> {
    try {
      const body = (ctx.request.body ?? {}) as {
        live?: boolean;
        mode?: string;
        confirmation?: string;
      };
      const liveRequested = body.live === true || body.mode === 'controlled_live';
      const liveConfirmed = body.confirmation === RUN_NOW_CONFIRMATION;

      if (liveRequested && !liveConfirmed) {
        await recordAdminAuditEvent(strapi, ctx, {
          action: 'autonomy.tick.run-now',
          outcome: 'skipped',
          severity: 'warn',
          metadata: {
            reason: 'live_confirmation_required',
            requiredConfirmation: RUN_NOW_CONFIRMATION,
            dryRun: true,
          },
        });
        ctx.badRequest(`Live run-now requires confirmation=${RUN_NOW_CONFIRMATION}.`);
        return;
      }

      if (liveRequested) {
        if (!isTruthy(process.env.AICO_ADMIN_RUN_NOW_ENABLED)) {
          await recordAdminAuditEvent(strapi, ctx, {
            action: 'autonomy.tick.run-now',
            outcome: 'skipped',
            severity: 'warn',
            metadata: {
              reason: 'admin_run_now_disabled',
              dryRun: true,
            },
          });
          ctx.badRequest('AICO_ADMIN_RUN_NOW_ENABLED must be true before controlled live run-now.');
          return;
        }

        const readiness = await strapi
          .plugin('ai-content-orchestrator')
          .service('production-readiness')
          .evaluate({ includeStrictAudit: true });

        if (readiness.decision !== 'GO') {
          await recordAdminAuditEvent(strapi, ctx, {
            action: 'autonomy.tick.run-now',
            outcome: 'skipped',
            severity: 'warn',
            metadata: {
              reason: 'production_readiness_not_go',
              decision: readiness.decision,
              blockers: Array.isArray(readiness.blockers) ? readiness.blockers.length : undefined,
              warnings: Array.isArray(readiness.warnings) ? readiness.warnings.length : undefined,
              dryRun: true,
            },
          });
          ctx.badRequest(`Production readiness is ${String(readiness.decision)}; live run-now blocked.`);
          return;
        }

        await recordAdminAuditEvent(strapi, ctx, {
          action: 'autonomy.tick.run-now.attempt',
          outcome: 'success',
          metadata: {
            mode: 'controlled_live',
            readinessDecision: readiness.decision,
            confirmationAccepted: true,
          },
        });

        await strapi.plugin('ai-content-orchestrator').service('orchestrator').tick();

        await recordAdminAuditEvent(strapi, ctx, {
          action: 'autonomy.tick.run-now',
          outcome: 'success',
          metadata: {
            mode: 'controlled_live',
            readinessDecision: readiness.decision,
            liveEffects: true,
          },
        });

        ctx.body = {
          data: {
            dryRun: false,
            liveEffects: true,
            runNowMode: 'controlled_live',
            readiness,
            message: 'Controlled live orchestrator tick completed.',
          },
        };
        return;
      }

      const result = await strapi
        .plugin('ai-content-orchestrator')
        .service('autopilot')
        .dryRunTick();

      await recordAdminAuditEvent(strapi, ctx, {
        action: 'autonomy.tick.run-now',
        outcome: 'skipped',
        metadata: {
          reason: 'live_confirmation_required',
          requiredConfirmation: RUN_NOW_CONFIRMATION,
          dryRun: true,
        },
      });

      ctx.body = {
        data: {
          ...result,
          runNowMode: 'dry_run_only',
          requiredConfirmation: RUN_NOW_CONFIRMATION,
          message: 'Controlled live run-now requires explicit confirmation and production readiness GO.',
        },
      };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },

  async productionReadiness(ctx: Context): Promise<void> {
    try {
      const includeStrictAudit =
        ctx.query.includeStrictAudit === 'true' ||
        ((ctx.request.body as { includeStrictAudit?: boolean } | undefined)?.includeStrictAudit === true) ||
        isTruthy(process.env.AICO_STRICT_AUDIT_REQUIRED) ||
        isTruthy(process.env.AICO_FULL_AUTONOMY_REQUIRED);
      const result = await strapi
        .plugin('ai-content-orchestrator')
        .service('production-readiness')
        .evaluate({ includeStrictAudit });

      ctx.body = { data: result };
    } catch (error) {
      ctx.badRequest(toSafeErrorMessage(error));
    }
  },
});

export default autonomyController;
