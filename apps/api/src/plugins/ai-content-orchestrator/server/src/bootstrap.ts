import type { Core } from '@strapi/strapi';

import {
  AUDIT_EVENT_UID,
  CRON_TICK_RULE,
  DEFAULT_TIMEZONE,
  PLUGIN_ID,
  RBAC_ACTIONS,
  RUN_LOG_UID,
} from './constants';
import { pluginActions } from './permissions/actions';

// Daily retention sweep at 03:15 (low-traffic window).
const RETENTION_CRON_RULE = '15 3 * * *';

// Generic prune by createdAt; days<=0 disables pruning for that collection.
const pruneByCreatedAt = async (
  strapi: Core.Strapi,
  uid: string,
  days: number
): Promise<number> => {
  if (!Number.isFinite(days) || days <= 0) {
    return 0;
  }
  const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const result = (await strapi.db
    .query(uid as never)
    .deleteMany({ where: { createdAt: { $lt: cutoffIso } } })) as { count?: number };
  return result?.count ?? 0;
};

type AicoRbacAction = (typeof RBAC_ACTIONS)[keyof typeof RBAC_ACTIONS];

type PermissionService = {
  actionProvider: {
    registerMany: (actions: ReadonlyArray<Record<string, unknown>>) => Promise<void>;
  };
  createMany: (permissions: Array<Record<string, unknown>>) => Promise<unknown>;
};

const DEFAULT_EDITOR_PERMISSION_ACTIONS = [RBAC_ACTIONS.read] as const;

export const resolveEditorRolePermissionActions = (
  env: NodeJS.ProcessEnv = process.env
): string[] => {
  if (env.AICO_SYNC_EDITOR_ROLE_PERMISSIONS !== 'true') {
    return [];
  }

  const validActions = new Set<string>(Object.values(RBAC_ACTIONS));
  const requestedActions =
    env.AICO_EDITOR_PERMISSION_ACTIONS?.split(',')
      .map((action) => action.trim())
      .filter(Boolean) ?? [...DEFAULT_EDITOR_PERMISSION_ACTIONS];

  return [...new Set(requestedActions)].filter((action): action is AicoRbacAction =>
    validActions.has(action)
  );
};

export const syncEditorRolePermissions = async (
  strapi: Core.Strapi,
  targetActions = resolveEditorRolePermissionActions()
): Promise<void> => {
  if (targetActions.length === 0) {
    strapi.log.info(
      '[aico] Pominięto auto-grant uprawnień roli Editor. Ustaw AICO_SYNC_EDITOR_ROLE_PERMISSIONS=true, aby włączyć allowlistę.'
    );
    return;
  }

  const roleCandidates = ['Editor Content', 'Content Editor', 'Editor'];

  const roles = (await strapi.db.query('admin::role').findMany({
    where: {
      name: {
        $in: roleCandidates,
      },
    },
  })) as Array<{ id: number; name: string }>;

  if (roles.length === 0) {
    return;
  }

  for (const role of roles) {
    const existing = (await strapi.db.query('admin::permission').findMany({
      where: {
        role: role.id,
      },
    })) as Array<{ action: string }>;

    const existingActions = new Set(existing.map((item) => item.action));

    const missingPermissions = targetActions
      .filter((action) => !existingActions.has(action))
      .map((action) => ({
        action,
        actionParameters: {},
        subject: null,
        properties: {},
        conditions: [],
        role: role.id,
      }));

    if (missingPermissions.length > 0) {
      const permissionService = strapi.service('admin::permission') as unknown as PermissionService;
      await permissionService.createMany(missingPermissions);
      strapi.log.info(
        `[aico] Dodano ${missingPermissions.length} uprawnień pluginu do roli admin "${role.name}".`
      );
    }
  }
};

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }): Promise<void> => {
  try {
    const permissionService = strapi.service('admin::permission') as unknown as PermissionService;
    await permissionService.actionProvider.registerMany(
      pluginActions as unknown as Record<string, unknown>[]
    );
    await syncEditorRolePermissions(strapi);
  } catch (error) {
    strapi.log.warn(`[aico] Nie udało się zarejestrować RBAC pluginu: ${String(error)}`);
  }

  strapi.cron.add({
    'ai-content-orchestrator-minute-tick': {
      task: async () => {
        await strapi.plugin(PLUGIN_ID).service('orchestrator').tick();
      },
      options: {
        rule: CRON_TICK_RULE,
        tz: DEFAULT_TIMEZONE,
      },
    },
    'ai-content-orchestrator-retention': {
      task: async () => {
        try {
          const reapedLocks = await strapi
            .plugin(PLUGIN_ID)
            .service('runtime-locks')
            .reapStale();
          const runLogs = await pruneByCreatedAt(
            strapi,
            RUN_LOG_UID,
            Number(process.env.AICO_RUN_LOG_RETENTION_DAYS ?? 0)
          );
          const auditEvents = await pruneByCreatedAt(
            strapi,
            AUDIT_EVENT_UID,
            Number(process.env.AICO_AUDIT_EVENT_RETENTION_DAYS ?? 0)
          );
          strapi.log.info(
            `[aico] retention sweep: locks=${reapedLocks} run_logs=${runLogs} audit_events=${auditEvents}`
          );
        } catch (error) {
          strapi.log.warn(`[aico] retention sweep failed: ${String(error)}`);
        }
      },
      options: {
        rule: RETENTION_CRON_RULE,
        tz: DEFAULT_TIMEZONE,
      },
    },
  });

  strapi.log.info('[aico] Plugin cron tick + retention registered.');
};

export default bootstrap;
