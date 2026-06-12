const fs = require('node:fs');
const path = require('node:path');

const { compileStrapi, createStrapi } = require('@strapi/strapi');
const { resolveFromWorkspace } = require('./release-env');

const PLUGIN = 'ai-content-orchestrator';
const WORKFLOW_UID = `plugin::${PLUGIN}.workflow`;
const TOPIC_QUEUE_UID = `plugin::${PLUGIN}.topic-queue-item`;
const RUN_LOG_UID = `plugin::${PLUGIN}.run-log`;
const PUBLICATION_TICKET_UID = `plugin::${PLUGIN}.publication-ticket`;
const SOCIAL_POST_TICKET_UID = `plugin::${PLUGIN}.social-post-ticket`;
const APP_DIR = path.resolve(__dirname, '..');

const DEFAULT_SOCIAL_CHANNELS = ['facebook', 'instagram', 'twitter'];
const CANONICAL_FRONTEND_URL = 'https://star-sign.pl';
const BASE_REQUIRED_PROVIDERS = ['openrouter', 'replicate', 'meta_ads', 'google_ads', 'ga4'];
const SOCIAL_PROVIDER_BY_CHANNEL = {
  facebook: 'facebook',
  instagram: 'instagram',
  twitter: 'twitter',
  tiktok: 'tiktok',
  youtube_shorts: 'youtube',
  youtube: 'youtube',
};

const parseEnvValue = (rawValue) => {
  const value = String(rawValue || '').trim();
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
    const unquoted = value.slice(1, -1);
    return quote === '"'
      ? unquoted
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
      : unquoted;
  }

  return value;
};

const parseEnvFile = (content) => {
  const entries = [];
  for (const rawLine of String(content || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (!match) continue;

    entries.push([match[1], parseEnvValue(match[2])]);
  }

  return entries;
};

const loadEnvFile = (filename, input = {}) => {
  const override = Boolean(input.override);
  const resolved = resolveFromWorkspace(filename);
  const content = fs.readFileSync(resolved, 'utf8');
  const entries = parseEnvFile(content);
  let loaded = 0;
  let skippedExisting = 0;

  for (const [key, value] of entries) {
    if (!override && Object.prototype.hasOwnProperty.call(process.env, key)) {
      skippedExisting += 1;
      continue;
    }

    process.env[key] = value;
    loaded += 1;
  }

  return { path: resolved, loaded, skippedExisting };
};

const loadConfiguredEnvFile = () => {
  const filename = process.env.AICO_PREFLIGHT_ENV_FILE || process.env.COMPOSE_ENV_FILE;
  if (!filename) return null;

  return loadEnvFile(filename);
};

const getAppDir = () => APP_DIR;

const isRecord = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toChannels = (workflow) => {
  if (Array.isArray(workflow.enabled_channels) && workflow.enabled_channels.length > 0) {
    return workflow.enabled_channels;
  }

  return DEFAULT_SOCIAL_CHANNELS;
};

const normalizeSocialChannels = (value = process.env.AICO_SOCIAL_CHANNELS) => {
  const raw = Array.isArray(value)
    ? value
    : String(value || DEFAULT_SOCIAL_CHANNELS.join(',')).split(',');

  const channels = raw
    .map((channel) => String(channel || '').trim().toLowerCase())
    .filter((channel) => Boolean(SOCIAL_PROVIDER_BY_CHANNEL[channel]));

  return Array.from(new Set(channels.length > 0 ? channels : DEFAULT_SOCIAL_CHANNELS));
};

const getRequiredProviders = (socialChannels = process.env.AICO_SOCIAL_CHANNELS) => {
  const socialProviders = normalizeSocialChannels(socialChannels)
    .map((channel) => SOCIAL_PROVIDER_BY_CHANNEL[channel])
    .filter(Boolean);

  return Array.from(new Set([...BASE_REQUIRED_PROVIDERS, ...socialProviders]));
};

const shouldRunSocialConnectionPreflight = () =>
  isTruthy(process.env.AICO_FULL_AUTONOMY_REQUIRED) ||
  isTruthy(process.env.AICO_SOCIAL_CONNECTION_PREFLIGHT);

const addCheck = (checks, status, id, message, details = undefined) => {
  checks.push({
    id,
    status,
    message,
    ...(details ? { details } : {}),
  });
};

const countRows = async (strapi, uid, where = {}) =>
  strapi.db.query(uid).count({
    where,
  });

const readSettings = async (strapi) => {
  const store = strapi.store({
    type: 'plugin',
    name: PLUGIN,
    key: 'settings',
  });

  const settings = await store.get();
  return isRecord(settings) ? settings : {};
};

const getPublicFrontendUrl = () => {
  const configured =
    process.env.AICO_PUBLIC_FRONTEND_URL ||
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_FRONTEND_URL ||
    CANONICAL_FRONTEND_URL;

  try {
    const url = new URL(configured);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return CANONICAL_FRONTEND_URL;
    }

    return url.toString().replace(/\/$/, '');
  } catch {
    return CANONICAL_FRONTEND_URL;
  }
};

const hasWorkflowSocialCredentials = (workflow, channel) => {
  if (channel === 'facebook') {
    return Boolean(workflow.fb_page_id && workflow.fb_access_token_encrypted);
  }

  if (channel === 'instagram') {
    return Boolean(workflow.ig_user_id && workflow.ig_access_token_encrypted);
  }

  if (channel === 'twitter') {
    return Boolean(
      workflow.x_api_key &&
        workflow.x_api_secret_encrypted &&
        workflow.x_access_token_encrypted &&
        workflow.x_access_token_secret_encrypted,
    );
  }

  return channel === 'tiktok';
};

const summarizeSocialCredentialIssues = (workflows) =>
  workflows
    .map((workflow) => {
      const missing = toChannels(workflow)
        .filter((channel) => channel !== 'tiktok')
        .filter((channel) => !hasWorkflowSocialCredentials(workflow, channel));

      return {
        workflowId: workflow.id,
        workflow: workflow.name,
        missing,
      };
    })
    .filter((item) => item.missing.length > 0);

const isBlogAutomationReady = ({ enabledArticleWorkflows, pendingTopics }) => {
  const blogReadyByQueue = pendingTopics > 0;
  const blogReadyByStrategy = enabledArticleWorkflows.some((workflow) => {
    const guardrails = isRecord(workflow.auto_publish_guardrails)
      ? workflow.auto_publish_guardrails
      : {};
    const strategy = isRecord(guardrails.strategy) ? guardrails.strategy : {};
    return workflow.strategy_enabled === true && strategy.auto_approve_plan === true;
  });

  return {
    ready: blogReadyByQueue || blogReadyByStrategy,
    blogReadyByQueue,
    blogReadyByStrategy,
  };
};

const evaluateSocialUrlStatus = ({ publicFrontendUrl, socialDefaultImageUrl }) => {
  if (publicFrontendUrl.includes('star-sign.app') || socialDefaultImageUrl.includes('star-sign.app')) {
    return {
      status: 'fail',
      message: 'Publiczne URL-e social nadal wskazują star-sign.app.',
    };
  }

  return {
    status: 'pass',
    message: 'Publiczne URL-e social nie wskazują star-sign.app.',
  };
};

const isTruthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());

const isStrictAuditRequired = () => isTruthy(process.env.AICO_STRICT_AUDIT_REQUIRED);

const shouldIncludeStrictAuditInReadiness = (
  fullAutonomyRequired = isTruthy(process.env.AICO_FULL_AUTONOMY_REQUIRED),
) => fullAutonomyRequired || isStrictAuditRequired();

const evaluateStrictAuditReport = (auditReport) => {
  if (!isRecord(auditReport)) {
    return {
      status: 'fail',
      message: 'Strict AICO audit nie zwrócił raportu.',
    };
  }

  if (auditReport.decision === 'GO' && auditReport.strict === true) {
    return {
      status: 'pass',
      message: 'Strict AICO audit ma decyzję GO.',
    };
  }

  return {
    status: 'fail',
    message: `Strict AICO audit nie ma decyzji GO: ${String(auditReport.decision || 'unknown')}.`,
  };
};

const redactSensitiveText = (value) =>
  String(value ?? '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, 'Bearer [REDACTED]')
    .replace(/sk-[A-Za-z0-9_-]{8,}/gi, 'sk-[REDACTED]')
    .replace(/(token|secret|password|api[_-]?key)=([^&\s]+)/gi, '$1=[REDACTED]');

const sanitizeRecentRun = (run) => ({
  ...run,
  error_message: run.error_message ? redactSensitiveText(run.error_message) : run.error_message,
});

const evaluateProviderReadinessMatrix = (
  matrix,
  fullAutonomyRequired = false,
  requiredProviders = getRequiredProviders()
) => {
  if (!Array.isArray(matrix)) {
    return {
      status: fullAutonomyRequired ? 'fail' : 'warn',
      message: 'Provider readiness matrix nie jest dostępna.',
      details: {},
    };
  }

  const requiredProviderSet = fullAutonomyRequired
    ? new Set((requiredProviders || []).map((provider) => String(provider)))
    : null;
  const evaluatedMatrix = requiredProviderSet
    ? matrix.filter((provider) => isRecord(provider) && requiredProviderSet.has(String(provider.provider)))
    : matrix;
  const blockedProviders = matrix
    .filter((provider) => evaluatedMatrix.includes(provider))
    .filter((provider) => isRecord(provider) && provider.ready !== true)
    .map((provider) => ({
      provider: provider.provider,
      status: provider.status,
      blockedReason: provider.blockedReason,
      missingScopes: Array.isArray(provider.missingScopes) ? provider.missingScopes : [],
      stale: Boolean(provider.stale),
    }));

  if (blockedProviders.length === 0) {
    return {
      status: 'pass',
      message: fullAutonomyRequired
        ? 'Provider readiness matrix jest zielona dla wymaganych providerów.'
        : 'Provider readiness matrix jest zielona.',
      details: { providers: evaluatedMatrix.length },
    };
  }

  return {
    status: fullAutonomyRequired ? 'fail' : 'warn',
    message: `Provider readiness blokuje ${blockedProviders.length} providerów.`,
    details: {
      blockedProviders,
      providers: evaluatedMatrix.length,
    },
  };
};

const evaluateProviderMode = (kind, mode, fullAutonomyRequired = false) => {
  const normalized = String(mode || 'disabled').trim().toLowerCase();
  const normalizedKind = String(kind || '').trim().toLowerCase();

  if (normalizedKind === 'ads' && normalized === 'controlled') {
    return {
      status: 'pass',
      message: 'Ads provider mode=controlled jest gotowy do kontrolowanego preflightu bez live spendu.',
      details: {
        mode: normalized,
        liveEffects: false,
        liveSpendEnabled: false,
        controlledExternalMutation: false,
      },
    };
  }

  if (normalizedKind === 'video' && normalized === 'replicate') {
    return {
      status: 'pass',
      message: 'Video provider mode=replicate jest gotowy do kontrolowanego external render job.',
      details: {
        mode: normalized,
        liveEffects: false,
        controlledExternalRender: true,
      },
    };
  }

  if (normalized === 'sandbox') {
    return {
      status: fullAutonomyRequired ? 'warn' : 'pass',
      message: `${kind} provider działa w sandbox mode; live effects są wyłączone.`,
      details: { mode: normalized, liveEffects: false },
    };
  }

  if (normalized === 'live') {
    return {
      status: 'fail',
      message: `${kind} provider mode=live jest zablokowany, bo live adapter nie przeszedł kontrolowanego smoke.`,
      details: { mode: normalized, liveEffects: false },
    };
  }

  return {
    status: fullAutonomyRequired ? 'fail' : 'warn',
    message: `${kind} provider jest wyłączony.`,
    details: { mode: normalized || 'disabled', liveEffects: false },
  };
};

const sanitizeSocialDetails = (details) => {
  if (!isRecord(details)) return undefined;

  const sanitized = {};
  for (const key of ['pageId', 'pageName', 'userId', 'username', 'screenName', 'draftOnly', 'status']) {
    if (details[key] !== undefined) {
      sanitized[key] = details[key];
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const sanitizeSocialChannelStatus = (channel) => ({
  platform: channel.platform,
  status: channel.status,
  message: redactSensitiveText(channel.message),
  ...(sanitizeSocialDetails(channel.details) ? { details: sanitizeSocialDetails(channel.details) } : {}),
});

const runSocialConnectionPreflight = async (app, workflows) => {
  const service = app.plugin(PLUGIN).service('social-publisher');
  if (!service || typeof service.testConnection !== 'function') {
    return {
      liveEffects: false,
      status: 'failed',
      workflows: [],
      totals: { checked: 0, ready: 0, blocked: 0, degraded: 0, needsAction: 0, skipped: 0 },
      error: 'social_publisher_test_connection_unavailable',
    };
  }

  const runtimeChannels = new Set(normalizeSocialChannels());
  const results = [];
  const totals = { checked: 0, ready: 0, blocked: 0, degraded: 0, needsAction: 0, skipped: 0 };

  for (const workflow of workflows) {
    const channels = toChannels(workflow).filter((channel) => runtimeChannels.has(channel));
    if (channels.length === 0) {
      totals.skipped += 1;
      continue;
    }

    try {
      const result = await service.testConnection({
        workflowId: workflow.id,
        channels,
      });
      const sanitizedChannels = Array.isArray(result.channels)
        ? result.channels.map(sanitizeSocialChannelStatus)
        : [];
      totals.checked += 1;
      for (const channel of sanitizedChannels) {
        if (channel.status === 'ready') totals.ready += 1;
        if (channel.status === 'blocked') totals.blocked += 1;
        if (channel.status === 'degraded') totals.degraded += 1;
        if (channel.status === 'needs_action') totals.needsAction += 1;
      }

      results.push({
        workflowId: workflow.id,
        workflow: workflow.name,
        overall: result.overall,
        channels: sanitizedChannels,
      });
    } catch (error) {
      totals.checked += 1;
      totals.blocked += 1;
      results.push({
        workflowId: workflow.id,
        workflow: workflow.name,
        overall: 'blocked',
        error: redactSensitiveText(error?.message || error),
        channels: [],
      });
    }
  }

  const status =
    totals.blocked > 0 || totals.needsAction > 0
      ? 'blocked'
      : totals.degraded > 0
        ? 'degraded'
        : 'ready';

  return {
    liveEffects: false,
    status,
    workflows: results,
    totals,
  };
};

const evaluateProductionReadinessReport = (report, fullAutonomyRequired = false) => {
  if (!isRecord(report)) {
    return {
      status: fullAutonomyRequired ? 'fail' : 'warn',
      message: 'Production readiness report nie jest dostępny.',
      details: {},
    };
  }

  if (report.decision === 'GO') {
    return {
      status: 'pass',
      message: 'Production readiness report ma decyzję GO.',
      details: {
        decision: report.decision,
        blockers: Array.isArray(report.blockers) ? report.blockers.length : undefined,
        warnings: Array.isArray(report.warnings) ? report.warnings.length : undefined,
      },
    };
  }

  return {
    status: fullAutonomyRequired ? 'fail' : 'warn',
    message: `Production readiness report nie ma decyzji GO: ${String(report.decision || 'unknown')}.`,
    details: {
      decision: report.decision,
      blockers: Array.isArray(report.blockers) ? report.blockers.length : undefined,
      warnings: Array.isArray(report.warnings) ? report.warnings.length : undefined,
      liveEffectsAllowed: report.liveEffectsAllowed === true,
    },
  };
};

const main = async () => {
  loadConfiguredEnvFile();
  const appContext = await compileStrapi({ appDir: getAppDir() });
  const app = await createStrapi(appContext).load();

  try {
    const checks = [];
    const workflows = await app.db.query(WORKFLOW_UID).findMany({
      populate: ['article_category'],
      orderBy: { id: 'asc' },
    });
    const enabledWorkflows = workflows.filter((workflow) => workflow.enabled === true);
    const enabledArticleWorkflows = enabledWorkflows.filter(
      (workflow) => workflow.workflow_type === 'article',
    );
    const settings = await readSettings(app);
    const pendingTopics = await countRows(app, TOPIC_QUEUE_UID, {
      status: { $in: ['pending', 'processing'] },
    });
    const plannedItems = await countRows(app, `plugin::${PLUGIN}.content-plan-item`, {
      status: { $in: ['planned', 'approved', 'queued'] },
    });
    const scheduledPublicationTickets = await countRows(app, PUBLICATION_TICKET_UID, {
      status: 'scheduled',
    });
    const scheduledSocialTickets = await countRows(app, SOCIAL_POST_TICKET_UID, {
      status: 'scheduled',
    });
    const failedSocialTickets = await countRows(app, SOCIAL_POST_TICKET_UID, {
      status: 'failed',
    });
    const recentRuns = (await app.db.query(RUN_LOG_UID).findMany({
      orderBy: { started_at: 'desc' },
      limit: 5,
      select: ['id', 'run_type', 'status', 'started_at', 'finished_at', 'error_message'],
    })).map(sanitizeRecentRun);
    const serverUrl = String(app.config.get('server.url') || '').trim();
    const publicFrontendUrl = getPublicFrontendUrl();
    const socialDefaultImageUrl =
      process.env.AICO_SOCIAL_DEFAULT_IMAGE_URL || `${publicFrontendUrl}/assets/og-default.png`;
    const fullAutonomyRequired = isTruthy(process.env.AICO_FULL_AUTONOMY_REQUIRED);

    if (workflows.length >= 12) {
      addCheck(checks, 'pass', 'workflows.total', `Workflowy AICO: ${workflows.length}.`);
    } else {
      addCheck(checks, 'fail', 'workflows.total', `Za mało workflowów AICO: ${workflows.length}.`);
    }

    if (enabledWorkflows.length > 0) {
      addCheck(
        checks,
        'pass',
        'workflows.enabled',
        `Włączone workflowy AICO: ${enabledWorkflows.length}.`,
      );
    } else {
      addCheck(checks, 'fail', 'workflows.enabled', 'Brak włączonych workflowów AICO.');
    }

    const missingLlmToken = enabledWorkflows.filter(
      (workflow) => !workflow.llm_api_token_encrypted,
    );
    if (missingLlmToken.length === 0) {
      addCheck(checks, 'pass', 'llm.token', 'Token LLM obecny dla włączonych workflowów.');
    } else {
      addCheck(checks, 'fail', 'llm.token', 'Część workflowów nie ma tokena LLM.', {
        workflows: missingLlmToken.map((workflow) => workflow.name),
      });
    }

    if (settings.aico_auto_publish_enabled === false) {
      addCheck(checks, 'fail', 'settings.autopublish', 'Globalny auto-publish AICO jest wyłączony.');
    } else {
      addCheck(checks, 'pass', 'settings.autopublish', 'Globalny auto-publish AICO jest włączony.');
    }

    if (settings.image_gen_model && settings.image_gen_api_token_encrypted) {
      addCheck(checks, 'pass', 'media-gen.ready', 'Media Gen ma model i token.');
    } else {
      addCheck(checks, 'warn', 'media-gen.ready', 'Media Gen nie ma kompletu model/token.');
    }

    const blogAutomation = isBlogAutomationReady({
      enabledArticleWorkflows,
      pendingTopics,
    });

    if (blogAutomation.ready) {
      addCheck(checks, 'pass', 'blog.backlog', 'Blog ma kolejkę tematów albo auto-approve strategii.', {
        pendingTopics,
        plannedItems,
        blogReadyByStrategy: blogAutomation.blogReadyByStrategy,
      });
    } else {
      addCheck(checks, 'fail', 'blog.backlog', 'Blog nie ma aktywnej kolejki ani auto-approve strategii.', {
        pendingTopics,
        plannedItems,
      });
    }

    const socialCredentialIssues = summarizeSocialCredentialIssues(enabledWorkflows);
    if (socialCredentialIssues.length === 0) {
      addCheck(checks, 'pass', 'social.credentials', 'Credentiale FB/IG/X są kompletne.');
    } else {
      addCheck(checks, 'fail', 'social.credentials', 'Brakuje credentiali social dla workflowów.', {
        workflows: socialCredentialIssues,
      });
    }

    const socialUrlStatus = evaluateSocialUrlStatus({
      publicFrontendUrl,
      socialDefaultImageUrl,
    });
    addCheck(checks, socialUrlStatus.status, 'social.urls', socialUrlStatus.message, {
      publicFrontendUrl,
      socialDefaultImageUrl,
    });

    if (!/^https?:\/\//.test(serverUrl) || serverUrl.includes('star-sign.app')) {
      addCheck(checks, 'fail', 'config.server-url', 'SERVER_URL nie jest poprawnym publicznym URL-em API.', {
        serverUrl: serverUrl || '(empty)',
      });
    } else {
      addCheck(checks, 'pass', 'config.server-url', 'SERVER_URL jest ustawiony jako publiczny URL API.', {
        serverUrl,
      });
    }

    try {
      const coverage = await app
        .plugin(PLUGIN)
        .service('media-assets')
        .validateCoverage({ applyWorkflowDisabling: false });

      addCheck(
        checks,
        coverage.ok ? 'pass' : 'fail',
        'media.coverage',
        coverage.ok ? 'Media coverage OK.' : 'Media coverage ma braki.',
        {
          missingWorkflows: Array.isArray(coverage.missingWorkflows)
            ? coverage.missingWorkflows.length
            : 0,
        },
      );
    } catch (error) {
      addCheck(checks, 'warn', 'media.coverage', 'Nie udało się sprawdzić media coverage.', {
        error: String(error?.message || error),
      });
    }

    if (shouldRunSocialConnectionPreflight()) {
      try {
        const socialPreflight = await runSocialConnectionPreflight(app, enabledWorkflows);
        const socialStatus =
          socialPreflight.status === 'ready'
            ? 'pass'
            : fullAutonomyRequired
              ? 'fail'
              : 'warn';
        addCheck(
          checks,
          socialStatus,
          'social.connection-preflight',
          socialPreflight.status === 'ready'
            ? 'Read-only social connection preflight jest zielony.'
            : `Read-only social connection preflight nie jest zielony: ${socialPreflight.status}.`,
          {
            liveEffects: false,
            status: socialPreflight.status,
            totals: socialPreflight.totals,
            workflows: socialPreflight.workflows,
          },
        );
      } catch (error) {
        addCheck(
          checks,
          fullAutonomyRequired ? 'fail' : 'warn',
          'social.connection-preflight',
          'Read-only social connection preflight nie wykonał się.',
          { error: redactSensitiveText(error?.message || error), liveEffects: false },
        );
      }
    }

    if (isStrictAuditRequired()) {
      try {
        const auditReport = await app.plugin(PLUGIN).service('audit').preflight({
          strict: true,
          includeConnectivity: true,
        });
        const auditStatus = evaluateStrictAuditReport(auditReport);
        addCheck(checks, auditStatus.status, 'audit.strict-go', auditStatus.message, {
          decision: auditReport?.decision,
          strict: auditReport?.strict,
          summary: auditReport?.summary,
        });
      } catch (error) {
        addCheck(checks, 'fail', 'audit.strict-go', 'Strict AICO audit nie wykonał się.', {
          error: String(error?.message || error),
        });
      }
    } else {
      addCheck(
        checks,
        'warn',
        'audit.strict-go',
        'Strict AICO audit nie jest wymagany; ustaw AICO_STRICT_AUDIT_REQUIRED=true przed pełnym PROD GO.',
      );
    }

    try {
      const providerMatrix = await app
        .plugin(PLUGIN)
        .service('provider-status')
        .getReadinessMatrix();
      const readinessStatus = evaluateProviderReadinessMatrix(
        providerMatrix,
        fullAutonomyRequired,
        getRequiredProviders(),
      );
      addCheck(
        checks,
        readinessStatus.status,
        'providers.readiness',
        readinessStatus.message,
        readinessStatus.details,
      );
    } catch (error) {
      addCheck(
        checks,
        isTruthy(process.env.AICO_FULL_AUTONOMY_REQUIRED) ? 'fail' : 'warn',
        'providers.readiness',
        'Nie udało się sprawdzić provider readiness matrix.',
        { error: redactSensitiveText(error?.message || error) },
      );
    }

    const adsModeStatus = evaluateProviderMode(
      'Ads',
      process.env.AICO_ADS_PROVIDER_MODE,
      fullAutonomyRequired,
    );
    addCheck(checks, adsModeStatus.status, 'providers.ads-mode', adsModeStatus.message, adsModeStatus.details);

    const videoModeStatus = evaluateProviderMode(
      'Video',
      process.env.AICO_VIDEO_PROVIDER_MODE,
      fullAutonomyRequired,
    );
    addCheck(
      checks,
      videoModeStatus.status,
      'providers.video-mode',
      videoModeStatus.message,
      videoModeStatus.details,
    );

    try {
      const readinessReport = await app
        .plugin(PLUGIN)
        .service('production-readiness')
        .evaluate({ includeStrictAudit: shouldIncludeStrictAuditInReadiness(fullAutonomyRequired) });
      const readinessStatus = evaluateProductionReadinessReport(
        readinessReport,
        fullAutonomyRequired,
      );
      addCheck(
        checks,
        readinessStatus.status,
        'autonomy.production-readiness',
        readinessStatus.message,
        readinessStatus.details,
      );
    } catch (error) {
      addCheck(
        checks,
        fullAutonomyRequired ? 'fail' : 'warn',
        'autonomy.production-readiness',
        'Production readiness report nie wykonał się.',
        { error: redactSensitiveText(error?.message || error) },
      );
    }

    const failed = checks.filter((check) => check.status === 'fail');
    const warned = checks.filter((check) => check.status === 'warn');
    const status = failed.length > 0 ? 'failed' : warned.length > 0 ? 'warning' : 'passed';
    const report = {
      status,
      summary: {
        workflows: workflows.length,
        enabledWorkflows: enabledWorkflows.length,
        pendingTopics,
        plannedItems,
        scheduledPublicationTickets,
        scheduledSocialTickets,
        failedSocialTickets,
      },
      checks,
      recentRuns,
    };

    console.log(JSON.stringify(report, null, 2));

    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await app.destroy();
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error('AICO post-seed preflight failed:', error);
    process.exit(1);
  });
}

module.exports = {
  evaluateStrictAuditReport,
  evaluateProviderMode,
  evaluateProviderReadinessMatrix,
  evaluateProductionReadinessReport,
  evaluateSocialUrlStatus,
  getAppDir,
  getRequiredProviders,
  getPublicFrontendUrl,
  isBlogAutomationReady,
  isStrictAuditRequired,
  loadConfiguredEnvFile,
  loadEnvFile,
  parseEnvFile,
  shouldIncludeStrictAuditInReadiness,
  redactSensitiveText,
  runSocialConnectionPreflight,
  summarizeSocialCredentialIssues,
};
