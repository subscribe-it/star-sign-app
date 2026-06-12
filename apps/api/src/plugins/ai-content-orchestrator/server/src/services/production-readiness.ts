import type { AutonomyPolicyRecord, ProviderKey, Strapi } from '../types';
import { getPluginService } from '../utils/plugin';

type ReadinessDecision = 'GO' | 'GO_WITH_WARNINGS' | 'NO_GO';
type CheckStatus = 'pass' | 'warn' | 'fail';

type ProductionReadinessCheck = {
  id: string;
  area: string;
  status: CheckStatus;
  message: string;
  details?: Record<string, unknown>;
};

type ProviderReadiness = {
  provider: ProviderKey;
  ready: boolean;
  status: string;
  blockedReason?: string | null;
};

type ProductionReadinessReport = {
  decision: ReadinessDecision;
  generatedAt: string;
  fullAutonomyRequired: boolean;
  liveEffectsAllowed: false;
  checks: ProductionReadinessCheck[];
  blockers: ProductionReadinessCheck[];
  warnings: ProductionReadinessCheck[];
  requiredProviders: ProviderKey[];
};

type AutonomyPolicyService = {
  getPolicy: () => Promise<AutonomyPolicyRecord>;
};

type ProviderStatusService = {
  getReadinessMatrix: () => Promise<ProviderReadiness[]>;
};

type AuditService = {
  preflight: (input: { strict: boolean; includeConnectivity: boolean }) => Promise<{
    decision: 'GO' | 'GO_WITH_WARNINGS' | 'NO_GO';
    strict: boolean;
    summary?: Record<string, unknown>;
  }>;
};

const SOCIAL_PROVIDER_BY_CHANNEL: Record<string, ProviderKey> = {
  facebook: 'facebook',
  instagram: 'instagram',
  twitter: 'twitter',
  tiktok: 'tiktok',
  youtube_shorts: 'youtube',
};

const BASE_REQUIRED_PROVIDERS: ProviderKey[] = [
  'openrouter',
  'replicate',
  'meta_ads',
  'google_ads',
  'ga4',
];

const isTruthy = (value: unknown): boolean =>
  ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());

const addCheck = (
  checks: ProductionReadinessCheck[],
  status: CheckStatus,
  id: string,
  area: string,
  message: string,
  details?: Record<string, unknown>
): void => {
  checks.push({ id, area, status, message, ...(details ? { details } : {}) });
};

const getRuntimeSocialProviders = (): ProviderKey[] => {
  const configured = String(process.env.AICO_SOCIAL_CHANNELS ?? 'facebook,instagram,twitter')
    .split(',')
    .map((channel) => channel.trim().toLowerCase())
    .filter(Boolean);
  const providers = configured
    .map((channel) => SOCIAL_PROVIDER_BY_CHANNEL[channel])
    .filter((provider): provider is ProviderKey => Boolean(provider));

  return Array.from(new Set(providers));
};

const getRequiredProviders = (): ProviderKey[] =>
  Array.from(new Set([...BASE_REQUIRED_PROVIDERS, ...getRuntimeSocialProviders()]));

const productionReadiness = ({ strapi }: { strapi: Strapi }) => ({
  async evaluate(input: { includeStrictAudit?: boolean } = {}): Promise<ProductionReadinessReport> {
    const checks: ProductionReadinessCheck[] = [];
    const fullAutonomyRequired = isTruthy(process.env.AICO_FULL_AUTONOMY_REQUIRED);
    const policy = await getPluginService<AutonomyPolicyService>(strapi, 'autonomy-policy').getPolicy();
    const requiredProviders = getRequiredProviders();

    addCheck(
      checks,
      fullAutonomyRequired ? 'pass' : 'warn',
      'env.full-autonomy-required',
      'env',
      fullAutonomyRequired
        ? 'AICO_FULL_AUTONOMY_REQUIRED jest wlaczone.'
        : 'AICO_FULL_AUTONOMY_REQUIRED nie jest wlaczone; raport pozostaje NO-GO dla pelnej produkcyjnej autonomii.'
    );

    addCheck(
      checks,
      policy.autonomy_mode === 'full' ? 'pass' : 'fail',
      'policy.mode',
      'policy',
      policy.autonomy_mode === 'full'
        ? 'Autonomy policy jest w trybie full.'
        : `Autonomy policy nie jest w trybie full: ${String(policy.autonomy_mode)}.`,
      { autonomyMode: policy.autonomy_mode }
    );

    addCheck(
      checks,
      policy.global_kill_switch ? 'fail' : 'pass',
      'policy.kill-switch',
      'policy',
      policy.global_kill_switch
        ? 'Global kill switch jest wlaczony.'
        : 'Global kill switch jest wylaczony.'
    );

    addCheck(
      checks,
      policy.brand_safety_required && policy.legal_disclaimer_required && policy.no_sensitive_targeting
        ? 'pass'
        : 'fail',
      'policy.safety',
      'policy',
      'Brand safety, legal disclaimer i no-sensitive-targeting musza byc wymagane.',
      {
        brandSafetyRequired: Boolean(policy.brand_safety_required),
        legalDisclaimerRequired: Boolean(policy.legal_disclaimer_required),
        noSensitiveTargeting: Boolean(policy.no_sensitive_targeting),
      }
    );

    addCheck(
      checks,
      Number(policy.daily_ads_budget_pln ?? 0) > 0 && Number(policy.daily_ads_budget_pln ?? 0) <= 25
        ? 'pass'
        : 'fail',
      'policy.ads-budget-cap',
      'policy',
      'Globalny dzienny limit ads musi byc dodatni i nie przekraczac 25 PLN.',
      { dailyAdsBudgetPln: policy.daily_ads_budget_pln }
    );

    const providerMatrix = await getPluginService<ProviderStatusService>(
      strapi,
      'provider-status'
    ).getReadinessMatrix();
    const blockedProviders = providerMatrix.filter(
      (provider) => requiredProviders.includes(provider.provider) && !provider.ready
    );

    addCheck(
      checks,
      blockedProviders.length === 0 ? 'pass' : 'fail',
      'providers.required-ready',
      'providers',
      blockedProviders.length === 0
        ? 'Wszyscy wymagani providerzy maja swiezy status ready.'
        : `Provider readiness blokuje ${blockedProviders.length} wymaganych providerow.`,
      {
        requiredProviders,
        blockedProviders: blockedProviders.map((provider) => ({
          provider: provider.provider,
          status: provider.status,
          blockedReason: provider.blockedReason,
        })),
      }
    );

    const strictAuditRequired = isTruthy(process.env.AICO_STRICT_AUDIT_REQUIRED);
    const auditStrict = isTruthy(process.env.AICO_AUDIT_TRAIL_STRICT);
    addCheck(
      checks,
      strictAuditRequired && auditStrict ? 'pass' : 'fail',
      'audit.strict-required',
      'audit',
      'Strict audit musi byc wymagany i wlaczony.',
      { strictAuditRequired, auditStrict }
    );

    if (input.includeStrictAudit) {
      try {
        const auditReport = await getPluginService<AuditService>(strapi, 'audit').preflight({
          strict: true,
          includeConnectivity: false,
        });
        addCheck(
          checks,
          auditReport.decision === 'GO' && auditReport.strict ? 'pass' : 'fail',
          'audit.strict-go',
          'audit',
          auditReport.decision === 'GO' && auditReport.strict
            ? 'Strict audit zwrocil GO.'
            : `Strict audit nie zwrocil GO: ${auditReport.decision}.`,
          { decision: auditReport.decision, strict: auditReport.strict, summary: auditReport.summary }
        );
      } catch (error) {
        addCheck(checks, 'fail', 'audit.strict-go', 'audit', 'Strict audit nie wykonal sie.', {
          error: String((error as Error).message ?? error),
        });
      }
    } else {
      addCheck(
        checks,
        'warn',
        'audit.strict-go',
        'audit',
        'Strict audit GO nie zostal uruchomiony w tym raporcie.'
      );
    }

    const runtimeLocksDisabled = isTruthy(process.env.AICO_RUNTIME_LOCKS_DISABLED);
    const socialSafetyDisabled = isTruthy(process.env.AICO_SOCIAL_CONTENT_SAFETY_DISABLED);
    addCheck(
      checks,
      !runtimeLocksDisabled && !socialSafetyDisabled ? 'pass' : 'fail',
      'runtime.safety-flags',
      'runtime',
      'Runtime locks musza byc wlaczone, a social content safety nie moze byc wylaczone.',
      { runtimeLocksDisabled, socialSafetyDisabled }
    );

    const adminRunNowEnabled = isTruthy(process.env.AICO_ADMIN_RUN_NOW_ENABLED);
    addCheck(
      checks,
      adminRunNowEnabled ? 'pass' : fullAutonomyRequired ? 'fail' : 'warn',
      'runtime.admin-run-now-enabled',
      'runtime',
      adminRunNowEnabled
        ? 'Kontrolowany admin run-now jest jawnie wlaczony.'
        : 'AICO_ADMIN_RUN_NOW_ENABLED nie jest wlaczone; admin run-now pozostaje dry-run.',
      { adminRunNowEnabled, confirmationRequired: true }
    );

    const adsMode = String(process.env.AICO_ADS_PROVIDER_MODE ?? 'disabled');
    const videoMode = String(process.env.AICO_VIDEO_PROVIDER_MODE ?? 'disabled');
    const adsProviderKeys: ProviderKey[] = ['meta_ads', 'google_ads'];
    const adsProvidersNotReady = providerMatrix.filter(
      (provider) => adsProviderKeys.includes(provider.provider) && !provider.ready
    );
    const liveAdsSmokeReady = adsProvidersNotReady.length === 0;
    addCheck(
      checks,
      adsMode === 'controlled' ? 'pass' : adsMode === 'live' && liveAdsSmokeReady ? 'pass' : 'fail',
      'live.ads-adapter',
      'controlled-live',
      adsMode === 'controlled'
        ? 'Ads provider mode=controlled ma zaimplementowany preflight bez live spendu.'
        : adsMode === 'live' && liveAdsSmokeReady
          ? 'Ads provider mode=live jest dopuszczony: meta_ads i google_ads maja swiezy status ready po controlled smoke.'
          : adsMode === 'live'
            ? 'Ads provider mode=live wymaga swiezego statusu ready dla meta_ads i google_ads (controlled smoke przed przelaczeniem na live).'
            : `Ads provider mode=${adsMode}; pelny PROD GO wymaga kontrolowanego ads preflight bez live spendu.`,
      {
        mode: adsMode,
        liveEffectsAllowed: false,
        liveSpendEnabled: false,
        liveAdsSmokeReady,
        adsProvidersNotReady: adsProvidersNotReady.map((provider) => ({
          provider: provider.provider,
          status: provider.status,
          blockedReason: provider.blockedReason,
        })),
      }
    );
    addCheck(
      checks,
      videoMode === 'replicate' ? 'pass' : 'fail',
      'live.video-adapter',
      'controlled-live',
      videoMode === 'replicate'
        ? 'Video provider mode=replicate ma zaimplementowany kontrolowany external render job.'
        : `Video provider mode=${videoMode}; pelny PROD GO wymaga zaimplementowanego kontrolowanego adaptera video.`,
      { mode: videoMode, liveEffectsAllowed: false, controlledExternalRender: videoMode === 'replicate' }
    );

    const controlledLiveEnabled = isTruthy(process.env.AICO_CONTROLLED_LIVE_ENABLED);
    const controlledProviderSmokeReady = controlledLiveEnabled && blockedProviders.length === 0;
    addCheck(
      checks,
      controlledProviderSmokeReady ? 'pass' : controlledLiveEnabled ? 'warn' : 'fail',
      'live.controlled-live-enabled',
      'controlled-live',
      controlledProviderSmokeReady
        ? 'Controlled live gate jest wlaczony, a wymagani providerzy maja swiezy status ready.'
        : controlledLiveEnabled
          ? 'Controlled live gate jest jawnie wlaczony, ale wymagani providerzy nadal musza przejsc smoke.'
          : 'AICO_CONTROLLED_LIVE_ENABLED nie jest wlaczone.',
      { controlledLiveEnabled, controlledProviderSmokeReady, liveEffectsAllowed: false }
    );

    const blockers = checks.filter((check) => check.status === 'fail');
    const warnings = checks.filter((check) => check.status === 'warn');
    const decision: ReadinessDecision =
      blockers.length > 0 ? 'NO_GO' : warnings.length > 0 ? 'GO_WITH_WARNINGS' : 'GO';

    return {
      decision,
      generatedAt: new Date().toISOString(),
      fullAutonomyRequired,
      liveEffectsAllowed: false,
      checks,
      blockers,
      warnings,
      requiredProviders,
    };
  },
});

export default productionReadiness;
