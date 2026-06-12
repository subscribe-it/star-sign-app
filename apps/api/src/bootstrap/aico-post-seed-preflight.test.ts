import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
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
  loadEnvFile,
  parseEnvFile,
  shouldIncludeStrictAuditInReadiness,
  redactSensitiveText,
  runSocialConnectionPreflight,
  summarizeSocialCredentialIssues,
} = require('../../scripts/aico-post-seed-preflight.js');
const { getWorkspaceDir } = require('../../scripts/release-env.js');

describe('AICO post-seed preflight helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves the Strapi app directory independently from current working directory', () => {
    const originalCwd = process.cwd();
    const expectedAppDir = getAppDir();
    const directory = mkdtempSync(join(tmpdir(), 'aico-cwd-'));

    try {
      process.chdir(directory);

      expect(getAppDir()).toBe(expectedAppDir);
      expect(getAppDir()).toMatch(/apps\/api$/);
      expect(isAbsolute(getAppDir())).toBe(true);
    } finally {
      process.chdir(originalCwd);
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('loads explicit env files without overriding existing process env values', () => {
    vi.stubEnv('AICO_OPENROUTER_TOKEN', 'existing-token');
    const directory = mkdtempSync(join(tmpdir(), 'aico-env-'));
    const filename = join(directory, '.env');
    writeFileSync(
      filename,
      [
        '# comment',
        'AICO_OPENROUTER_TOKEN=file-token',
        'AICO_ADS_PROVIDER_MODE="controlled"',
        'export AICO_CONTROLLED_LIVE_ENABLED=true',
        "AICO_PUBLIC_FRONTEND_URL='https://star-sign.pl'",
        '',
      ].join('\n'),
      'utf8',
    );

    try {
      const result = loadEnvFile(filename);

      expect(result).toMatchObject({ loaded: 3, skippedExisting: 1 });
      expect(process.env.AICO_OPENROUTER_TOKEN).toBe('existing-token');
      expect(process.env.AICO_ADS_PROVIDER_MODE).toBe('controlled');
      expect(process.env.AICO_CONTROLLED_LIVE_ENABLED).toBe('true');
      expect(process.env.AICO_PUBLIC_FRONTEND_URL).toBe('https://star-sign.pl');
      expect(JSON.stringify(result)).not.toContain('file-token');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('resolves relative env files from the workspace root independently from current working directory', () => {
    const originalCwd = process.cwd();
    const runtimeDirectory = mkdtempSync(join(tmpdir(), 'aico-env-cwd-'));
    const envDirectory = mkdtempSync(join(tmpdir(), 'aico-env-workspace-relative-'));
    const filename = join(envDirectory, '.env');
    const relativeFilename = relative(getWorkspaceDir(), filename);

    writeFileSync(filename, 'AICO_RELATIVE_ENV_TEST_FLAG=enabled\n', 'utf8');

    try {
      process.chdir(runtimeDirectory);

      const result = loadEnvFile(relativeFilename);

      expect(result).toMatchObject({ path: filename, loaded: 1, skippedExisting: 0 });
      expect(process.env.AICO_RELATIVE_ENV_TEST_FLAG).toBe('enabled');
    } finally {
      delete process.env.AICO_RELATIVE_ENV_TEST_FLAG;
      process.chdir(originalCwd);
      rmSync(runtimeDirectory, { recursive: true, force: true });
      rmSync(envDirectory, { recursive: true, force: true });
    }
  });

  it('parses quoted preflight env values', () => {
    expect(parseEnvFile('A="one\\ntwo"\nB=plain\nexport C=\'quoted\'\n# ignored')).toEqual([
      ['A', 'one\ntwo'],
      ['B', 'plain'],
      ['C', 'quoted'],
    ]);
  });

  it('passes social URL check for canonical star-sign.pl env', () => {
    expect(
      evaluateSocialUrlStatus({
        publicFrontendUrl: 'https://star-sign.pl',
        socialDefaultImageUrl: 'https://star-sign.pl/assets/og-default.png',
      }),
    ).toEqual({
      status: 'pass',
      message: 'Publiczne URL-e social nie wskazują star-sign.app.',
    });
  });

  it('fails social URL check when public URL or default image points to star-sign.app', () => {
    expect(
      evaluateSocialUrlStatus({
        publicFrontendUrl: 'https://star-sign.app',
        socialDefaultImageUrl: 'https://cdn.star-sign.pl/og.jpg',
      }),
    ).toEqual({
      status: 'fail',
      message: 'Publiczne URL-e social nadal wskazują star-sign.app.',
    });
  });

  it('reports missing social credentials without leaking token values', () => {
    const issues = summarizeSocialCredentialIssues([
      {
        id: 7,
        name: 'AICO Blog',
        enabled_channels: ['facebook', 'instagram', 'twitter'],
        fb_page_id: 'page-id',
        fb_access_token_encrypted: 'encrypted-secret-value',
        ig_user_id: null,
        ig_access_token_encrypted: null,
        x_api_key: 'x-key',
        x_api_secret_encrypted: null,
        x_access_token_encrypted: 'encrypted-x-token',
        x_access_token_secret_encrypted: null,
      },
    ]);

    expect(issues).toEqual([
      {
        workflowId: 7,
        workflow: 'AICO Blog',
        missing: ['instagram', 'twitter'],
      },
    ]);
    expect(JSON.stringify(issues)).not.toContain('encrypted-secret-value');
    expect(JSON.stringify(issues)).not.toContain('encrypted-x-token');
  });

  it('fails blog readiness when there are no pending topics and strategy auto approve is disabled', () => {
    expect(
      isBlogAutomationReady({
        pendingTopics: 0,
        enabledArticleWorkflows: [
          {
            strategy_enabled: true,
            auto_publish_guardrails: {
              strategy: {
                auto_approve_plan: false,
              },
            },
          },
        ],
      }),
    ).toEqual({
      ready: false,
      blogReadyByQueue: false,
      blogReadyByStrategy: false,
    });
  });

  it('prefers explicit AICO public frontend URL over generic frontend URL', () => {
    vi.stubEnv('AICO_PUBLIC_FRONTEND_URL', 'https://star-sign.pl/');
    vi.stubEnv('FRONTEND_URL', 'https://localhost.invalid');

    expect(getPublicFrontendUrl()).toBe('https://star-sign.pl');
  });

  it('requires strict AICO audit GO for production autonomy gate', () => {
    expect(evaluateStrictAuditReport({ decision: 'GO', strict: true })).toEqual({
      status: 'pass',
      message: 'Strict AICO audit ma decyzję GO.',
    });
    expect(evaluateStrictAuditReport({ decision: 'GO_WITH_WARNINGS', strict: true })).toEqual({
      status: 'fail',
      message: 'Strict AICO audit nie ma decyzji GO: GO_WITH_WARNINGS.',
    });
    expect(evaluateStrictAuditReport({ decision: 'GO', strict: false })).toEqual({
      status: 'fail',
      message: 'Strict AICO audit nie ma decyzji GO: GO.',
    });
  });

  it('detects AICO_STRICT_AUDIT_REQUIRED truthy values', () => {
    vi.stubEnv('AICO_STRICT_AUDIT_REQUIRED', 'true');
    expect(isStrictAuditRequired()).toBe(true);

    vi.stubEnv('AICO_STRICT_AUDIT_REQUIRED', 'false');
    expect(isStrictAuditRequired()).toBe(false);
  });

  it('includes strict audit in final readiness when strict audit or full autonomy is required', () => {
    vi.stubEnv('AICO_STRICT_AUDIT_REQUIRED', 'false');
    vi.stubEnv('AICO_FULL_AUTONOMY_REQUIRED', 'false');
    expect(shouldIncludeStrictAuditInReadiness()).toBe(false);

    vi.stubEnv('AICO_STRICT_AUDIT_REQUIRED', 'true');
    expect(shouldIncludeStrictAuditInReadiness()).toBe(true);

    vi.stubEnv('AICO_STRICT_AUDIT_REQUIRED', 'false');
    vi.stubEnv('AICO_FULL_AUTONOMY_REQUIRED', 'true');
    expect(shouldIncludeStrictAuditInReadiness()).toBe(true);
    expect(shouldIncludeStrictAuditInReadiness(false)).toBe(false);
    expect(shouldIncludeStrictAuditInReadiness(true)).toBe(true);
  });

  it('fails provider readiness matrix for blocked providers when full autonomy is required', () => {
    expect(
      evaluateProviderReadinessMatrix(
        [
          { provider: 'openrouter', ready: true, status: 'ready' },
          {
            provider: 'meta_ads',
            ready: false,
            status: 'failed',
            blockedReason: 'policy_review_required',
            missingScopes: ['ads_management'],
            lastError: 'Bearer secret-provider-token',
          },
        ],
        true,
      ),
    ).toEqual({
      status: 'fail',
      message: 'Provider readiness blokuje 1 providerów.',
      details: {
        providers: 2,
        blockedProviders: [
          {
            provider: 'meta_ads',
            status: 'failed',
            blockedReason: 'policy_review_required',
            missingScopes: ['ads_management'],
            stale: false,
          },
        ],
      },
    });
  });

  it('checks only required providers for full autonomy readiness matrix', () => {
    expect(
      evaluateProviderReadinessMatrix(
        [
          { provider: 'openrouter', ready: true, status: 'ready' },
          { provider: 'facebook', ready: true, status: 'ready' },
          {
            provider: 'openai',
            ready: false,
            status: 'missing_credentials',
            blockedReason: 'missing_credentials',
          },
        ],
        true,
        ['openrouter', 'facebook'],
      ),
    ).toEqual({
      status: 'pass',
      message: 'Provider readiness matrix jest zielona dla wymaganych providerów.',
      details: {
        providers: 2,
      },
    });
  });

  it('derives required providers from runtime social channels', () => {
    expect(getRequiredProviders('facebook,instagram,twitter')).toEqual([
      'openrouter',
      'replicate',
      'meta_ads',
      'google_ads',
      'ga4',
      'facebook',
      'instagram',
      'twitter',
    ]);

    expect(getRequiredProviders('facebook')).not.toContain('youtube');
    expect(getRequiredProviders('youtube_shorts')).toContain('youtube');
  });

  it('evaluates provider adapter modes for full autonomy without enabling live effects', () => {
    expect(evaluateProviderMode('Ads', 'disabled', true)).toEqual({
      status: 'fail',
      message: 'Ads provider jest wyłączony.',
      details: { mode: 'disabled', liveEffects: false },
    });
    expect(evaluateProviderMode('Video', 'live', true)).toEqual({
      status: 'fail',
      message:
        'Video provider mode=live jest zablokowany, bo live adapter nie przeszedł kontrolowanego smoke.',
      details: { mode: 'live', liveEffects: false },
    });
    expect(evaluateProviderMode('Ads', 'sandbox', true)).toEqual({
      status: 'warn',
      message: 'Ads provider działa w sandbox mode; live effects są wyłączone.',
      details: { mode: 'sandbox', liveEffects: false },
    });
    expect(evaluateProviderMode('Ads', 'controlled', true)).toEqual({
      status: 'pass',
      message: 'Ads provider mode=controlled jest gotowy do kontrolowanego preflightu bez live spendu.',
      details: {
        mode: 'controlled',
        liveEffects: false,
        liveSpendEnabled: false,
        controlledExternalMutation: false,
      },
    });
    expect(evaluateProviderMode('Video', 'replicate', true)).toEqual({
      status: 'pass',
      message: 'Video provider mode=replicate jest gotowy do kontrolowanego external render job.',
      details: {
        mode: 'replicate',
        liveEffects: false,
        controlledExternalRender: true,
      },
    });
  });

  it('redacts sensitive tokens from preflight error text', () => {
    const redacted = redactSensitiveText(
      'Bearer secret-provider-token failed with sk-test-secret and api_key=raw-secret',
    );

    expect(redacted).toContain('Bearer [REDACTED]');
    expect(redacted).toContain('sk-[REDACTED]');
    expect(redacted).toContain('api_key=[REDACTED]');
    expect(redacted).not.toContain('secret-provider-token');
    expect(redacted).not.toContain('raw-secret');
  });

  it('fails full autonomy preflight when production readiness is not GO', () => {
    expect(
      evaluateProductionReadinessReport(
        {
          decision: 'NO_GO',
          blockers: [{ id: 'live.ads-adapter' }],
          warnings: [],
          liveEffectsAllowed: false,
        },
        true,
      ),
    ).toEqual({
      status: 'fail',
      message: 'Production readiness report nie ma decyzji GO: NO_GO.',
      details: {
        decision: 'NO_GO',
        blockers: 1,
        warnings: 0,
        liveEffectsAllowed: false,
      },
    });

    expect(
      evaluateProductionReadinessReport({ decision: 'GO', blockers: [], warnings: [] }, true),
    ).toEqual({
      status: 'pass',
      message: 'Production readiness report ma decyzję GO.',
      details: {
        decision: 'GO',
        blockers: 0,
        warnings: 0,
      },
    });
  });

  it('runs read-only social connection preflight without leaking provider payloads', async () => {
    vi.stubEnv('AICO_SOCIAL_CHANNELS', 'facebook');
    const testConnection = vi.fn(async () => ({
      workflowId: 10,
      overall: 'ready',
      channels: [
        {
          platform: 'facebook',
          status: 'ready',
          message: 'Połączenie Facebook OK.',
          details: {
            pageId: 'page-1',
            pageName: 'Star Sign',
            data: { access_token: 'raw-secret-token' },
          },
        },
      ],
    }));
    const app = {
      plugin: vi.fn(() => ({
        service: vi.fn(() => ({ testConnection })),
      })),
    };

    const result = await runSocialConnectionPreflight(app, [
      {
        id: 10,
        name: 'AICO Blog',
        enabled_channels: ['facebook', 'twitter'],
      },
    ]);

    expect(testConnection).toHaveBeenCalledWith({
      workflowId: 10,
      channels: ['facebook'],
    });
    expect(result).toEqual({
      liveEffects: false,
      status: 'ready',
      workflows: [
        {
          workflowId: 10,
          workflow: 'AICO Blog',
          overall: 'ready',
          channels: [
            {
              platform: 'facebook',
              status: 'ready',
              message: 'Połączenie Facebook OK.',
              details: {
                pageId: 'page-1',
                pageName: 'Star Sign',
              },
            },
          ],
        },
      ],
      totals: {
        checked: 1,
        ready: 1,
        blocked: 0,
        degraded: 0,
        needsAction: 0,
        skipped: 0,
      },
    });
    expect(JSON.stringify(result)).not.toContain('raw-secret-token');
  });
});
