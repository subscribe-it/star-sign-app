import type React from 'react';

import { help as helpFn } from '../../help';
import {
  UiButton,
  UiCheckbox,
  UiEmptyState,
  UiSelect,
  UiTable,
  UiTbody,
  UiTd,
  UiTextInput,
  UiTh,
  UiThead,
  UiTr,
} from '../../components/ui';
import type {
  AdCampaignPlan,
  AutonomyStatus,
  ContentPerformanceSnapshot,
  ContentPlanItem,
  GenerationJob,
  GrowthExperiment,
  HomepageRecommendation,
  PerformanceAggregateResult,
  ProductionReadinessReport,
  ProviderCredentialStatus,
  ProviderProbeRunResult,
  ProviderReadiness,
  SettingsPayload,
  StrategyApprovePlanResult,
  StrategyGeneratePlanResult,
  VideoAsset,
  Workflow,
} from '../../types';

type StrategyFormState = {
  weekStart: string;
  limit: number;
  workflowId: string;
  autoApprove: boolean;
};

type PerformanceFormState = {
  day: string;
  limit: number;
};

type HomepageFormState = {
  limit: number;
};

type StatusPillProps = { status: string };
type StatTileProps = {
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
};
type FieldProps = { label: string; hint?: string; children: React.ReactNode };

type GrowthColors = {
  primary: string;
  secondary: string;
  danger: string;
  warning: string;
  text: string;
  textLight: string;
  border: string;
};

type GrowthTabProps = {
  saving: boolean;
  workflows: Workflow[];
  settings: SettingsPayload;
  setSettings: React.Dispatch<React.SetStateAction<SettingsPayload>>;
  strategyPlan: ContentPlanItem[];
  performanceSnapshots: ContentPerformanceSnapshot[];
  homepageRecommendations: HomepageRecommendation[];
  productionReadiness: ProductionReadinessReport | null;
  productionDecision: ProductionReadinessReport['decision'] | 'NO_GO';
  providerReadiness: ProviderReadiness[];
  readyProviderCount: number;
  blockedProviderCount: number;
  autonomyStatus: AutonomyStatus | null;
  autonomyPolicy: Record<string, unknown>;
  autonomyMode: string;
  killSwitch: boolean;
  dryRunSteps: Record<string, unknown>[];
  blockedDryRunStepCount: number;
  providerProbeResult: ProviderProbeRunResult | null;
  generationJobs: GenerationJob[];
  videoAssets: VideoAsset[];
  adCampaignPlans: AdCampaignPlan[];
  growthExperiments: GrowthExperiment[];
  providerStatuses: ProviderCredentialStatus[];
  strategyForm: StrategyFormState;
  setStrategyForm: React.Dispatch<React.SetStateAction<StrategyFormState>>;
  strategyGenerateResult: StrategyGeneratePlanResult | null;
  strategyApproveResult: StrategyApprovePlanResult | null;
  performanceForm: PerformanceFormState;
  setPerformanceForm: React.Dispatch<React.SetStateAction<PerformanceFormState>>;
  performanceAggregateResult: PerformanceAggregateResult | null;
  homepageForm: HomepageFormState;
  setHomepageForm: React.Dispatch<React.SetStateAction<HomepageFormState>>;
  homepageRunResult: Record<string, unknown> | null;
  runNowConfirmation: string;
  setRunNowConfirmation: React.Dispatch<React.SetStateAction<string>>;
  runNowConfirmationPlaceholder: string;
  canRunControlledAutonomyTick: boolean;
  adsStopLossConfirmation: string;
  setAdsStopLossConfirmation: React.Dispatch<React.SetStateAction<string>>;
  adsStopLossConfirmationPlaceholder: string;
  canRunAdsStopLoss: boolean;
  cardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  primaryButtonStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
  checkboxRowStyle: React.CSSProperties;
  colors: GrowthColors;
  formatDateTime: (value?: string | null) => string;
  formatDetailValue: (value: unknown) => string;
  help?: typeof helpFn;
  StatusPill: React.ComponentType<StatusPillProps>;
  StatTile: React.ComponentType<StatTileProps>;
  Field: React.ComponentType<FieldProps>;
  onRefreshGrowthData: () => void;
  onRunProviderReadinessProbe: () => void;
  onImportGa4Traffic: () => void;
  onSaveAutonomyPatch: (patch: Record<string, unknown>, message: string) => void;
  onRunControlledAutonomyTick: () => void;
  onRunAdsStopLoss: () => void;
  onGenerateStrategyPlan: () => void;
  onApproveStrategyPlan: () => void;
  onAggregatePerformance: () => void;
  onRunHomepageRecommendations: () => void;
};

export const GrowthTab = ({
  saving,
  workflows,
  settings,
  setSettings,
  strategyPlan,
  performanceSnapshots,
  homepageRecommendations,
  productionReadiness,
  productionDecision,
  providerReadiness,
  readyProviderCount,
  blockedProviderCount,
  autonomyStatus,
  autonomyPolicy,
  autonomyMode,
  killSwitch,
  dryRunSteps,
  blockedDryRunStepCount,
  providerProbeResult,
  generationJobs,
  videoAssets,
  adCampaignPlans,
  growthExperiments,
  providerStatuses,
  strategyForm,
  setStrategyForm,
  strategyGenerateResult,
  strategyApproveResult,
  performanceForm,
  setPerformanceForm,
  performanceAggregateResult,
  homepageForm,
  setHomepageForm,
  homepageRunResult,
  runNowConfirmation,
  setRunNowConfirmation,
  runNowConfirmationPlaceholder,
  canRunControlledAutonomyTick,
  adsStopLossConfirmation,
  setAdsStopLossConfirmation,
  adsStopLossConfirmationPlaceholder,
  canRunAdsStopLoss,
  cardStyle,
  sectionTitleStyle,
  primaryButtonStyle,
  inputStyle,
  checkboxRowStyle,
  colors,
  formatDateTime,
  formatDetailValue,
  help = helpFn,
  StatusPill,
  StatTile,
  Field,
  onRefreshGrowthData,
  onRunProviderReadinessProbe,
  onImportGa4Traffic,
  onSaveAutonomyPatch,
  onRunControlledAutonomyTick,
  onRunAdsStopLoss,
  onGenerateStrategyPlan,
  onApproveStrategyPlan,
  onAggregatePerformance,
  onRunHomepageRecommendations,
}: GrowthTabProps): React.ReactNode => (
  <div style={{ display: 'grid', gap: 24 }}>
    <section style={cardStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ ...sectionTitleStyle, marginBottom: 4 }}>Wzrost</h2>
          <p style={{ fontSize: 13, color: colors.textLight, margin: 0 }}>
            Strategy Agent, feedback SEO/performance i rekomendacje homepage bez zmiany otwartego
            dostępu Premium.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <UiButton
            variant="secondary"
            disabled={saving}
            onClick={() => {
              void onRefreshGrowthData();
            }}
          >
            Odśwież dane
          </UiButton>
          <button
            type="button"
            disabled={saving}
            style={primaryButtonStyle}
            onClick={() => {
              void onRunProviderReadinessProbe();
            }}
          >
            Provider preflight
          </button>
          <button
            type="button"
            disabled={saving}
            style={primaryButtonStyle}
            onClick={() => {
              void onImportGa4Traffic();
            }}
          >
            Importuj GA4
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
        }}
      >
        <StatTile label="Pozycje planu" value={strategyPlan.length} />
        <StatTile label="Migawki skuteczności" value={performanceSnapshots.length} />
        <StatTile label="Rekomendacje strony głównej" value={homepageRecommendations.length} />
        <StatTile
          label="Gotowość produkcyjna"
          value={productionDecision}
          color={
            productionDecision === 'GO'
              ? colors.secondary
              : productionDecision === 'GO_WITH_WARNINGS'
                ? colors.warning
                : colors.danger
          }
        />
        <StatTile
          label="Gotowość dostawców"
          value={`${readyProviderCount}/${providerReadiness.length || 0}`}
          color={blockedProviderCount > 0 ? colors.danger : colors.secondary}
        />
        <StatTile
          label="Tryb autonomii"
          value={killSwitch ? 'KILL' : autonomyMode}
          color={killSwitch ? colors.danger : undefined}
        />
        <StatTile
          label="Blokady próbnego uruchomienia"
          value={blockedDryRunStepCount}
          color={blockedDryRunStepCount > 0 ? colors.warning : colors.secondary}
        />
        <StatTile
          label="Globalna auto-publikacja"
          value={settings.aico_auto_publish_enabled === false ? 'OFF' : 'ON'}
          color={settings.aico_auto_publish_enabled === false ? colors.warning : undefined}
        />
      </div>
    </section>

    <section style={cardStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div>
          <h3 style={{ ...sectionTitleStyle, fontSize: 16, marginBottom: 4 }}>PROD GO / NO-GO</h3>
          <div style={{ fontSize: 12, color: colors.textLight }}>
            Raport produkcyjnej gotowości agreguje policy, provider readiness, audit i live gates.
          </div>
        </div>
        <StatusPill status={productionDecision} />
      </div>

      {productionReadiness ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <StatTile
              label="Blokery"
              value={productionReadiness.blockers.length}
              color={productionReadiness.blockers.length > 0 ? colors.danger : colors.secondary}
            />
            <StatTile
              label="Ostrzeżenia"
              value={productionReadiness.warnings.length}
              color={productionReadiness.warnings.length > 0 ? colors.warning : colors.secondary}
            />
            <StatTile
              label="Działania na żywo"
              value={productionReadiness.liveEffectsAllowed ? 'ON' : 'OFF'}
              color={productionReadiness.liveEffectsAllowed ? colors.danger : colors.textLight}
            />
            <StatTile
              label="Wymagani dostawcy"
              value={productionReadiness.requiredProviders.length}
            />
          </div>

          <div>
            <UiTable colCount={4} rowCount={productionReadiness.checks.length + 1}>
              <UiThead>
                <UiTr>
                  <UiTh>Kontrola</UiTh>
                  <UiTh>Obszar</UiTh>
                  <UiTh>Status</UiTh>
                  <UiTh>Komunikat</UiTh>
                </UiTr>
              </UiThead>
              <UiTbody>
                {productionReadiness.checks.map((check) => (
                  <UiTr key={check.id}>
                    <UiTd>{check.id}</UiTd>
                    <UiTd>{check.area}</UiTd>
                    <UiTd>
                      <StatusPill status={check.status} />
                    </UiTd>
                    <UiTd>{check.message}</UiTd>
                  </UiTr>
                ))}
              </UiTbody>
            </UiTable>
          </div>
        </div>
      ) : (
        <div style={{ padding: 24, color: colors.textLight, textAlign: 'center' }}>
          Brak raportu gotowości produkcyjnej.
        </div>
      )}
    </section>

    <section style={cardStyle}>
      <h3 style={{ ...sectionTitleStyle, fontSize: 16 }}>Sterowanie autonomią</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <StatTile
          label="Dzienny limit reklam"
          value={String(autonomyPolicy.daily_ads_budget_pln ?? '-')}
        />
        <StatTile
          label="Zapytania LLM dziś"
          value={String(autonomyStatus?.counts?.llmRequestsToday ?? '-')}
        />
        <StatTile
          label="Zadania graficzne dziś"
          value={String(autonomyStatus?.counts?.mediaJobsToday ?? '-')}
        />
        <StatTile
          label="Zmiany reklam dziś"
          value={String(autonomyStatus?.counts?.adsMutationsToday ?? '-')}
        />
      </div>

      <div
        key={`autonomy-edit-${String(autonomyPolicy.updatedAt ?? autonomyMode)}`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 14,
          padding: 16,
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          background: '#ffffff',
          marginBottom: 16,
        }}
      >
        <div style={{ gridColumn: '1 / -1', fontWeight: 700, color: colors.text }}>
          Ustawienia autonomii
          <span
            style={{
              fontWeight: 400,
              color: colors.textLight,
              marginLeft: 8,
              fontSize: 12,
            }}
          >
            Zmiany zapisują się automatycznie. Najedź na „?", aby zobaczyć opis.
          </span>
        </div>

        <Field label={help('autonomy_mode').label} hint={help('autonomy_mode').hint}>
          <UiSelect
            aria-label={help('autonomy_mode').label}
            value={autonomyMode}
            onChange={(value) =>
              void onSaveAutonomyPatch(
                { autonomy_mode: String(value) },
                'Zmieniono tryb autonomii.'
              )
            }
            options={[
              { value: 'off', label: 'Wyłączony' },
              { value: 'draft_only', label: 'Tylko szkice' },
              { value: 'guarded', label: 'Strzeżony' },
              { value: 'full', label: 'Pełny' },
            ]}
          />
        </Field>

        <Field label={help('global_kill_switch').label} hint={help('global_kill_switch').hint}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              defaultChecked={killSwitch}
              onChange={(event) => {
                const checked = event.target.checked;
                if (
                  checked &&
                  !window.confirm(
                    'Włączyć wyłącznik awaryjny? Zatrzyma to całą autonomię i spauzuje aktywne kampanie reklamowe.'
                  )
                ) {
                  event.target.checked = false;
                  return;
                }
                void onSaveAutonomyPatch(
                  { global_kill_switch: checked },
                  checked ? 'Włączono wyłącznik awaryjny.' : 'Wyłączono wyłącznik awaryjny.'
                );
              }}
            />
            <span>{killSwitch ? 'Aktywny' : 'Nieaktywny'}</span>
          </label>
        </Field>

        <Field label={help('daily_ads_budget_pln').label} hint={help('daily_ads_budget_pln').hint}>
          <input
            type="number"
            step="0.01"
            min="0"
            style={inputStyle}
            defaultValue={String(autonomyPolicy.daily_ads_budget_pln ?? '')}
            onBlur={(event) => {
              const value = Number(event.target.value);
              if (
                Number.isFinite(value) &&
                value >= 0 &&
                value !== Number(autonomyPolicy.daily_ads_budget_pln)
              ) {
                void onSaveAutonomyPatch(
                  { daily_ads_budget_pln: value },
                  'Zapisano dzienny budżet reklam.'
                );
              }
            }}
          />
        </Field>

        <Field
          label={help('guarded_max_ads_impact_pct').label}
          hint={help('guarded_max_ads_impact_pct').hint}
        >
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            style={inputStyle}
            defaultValue={String(autonomyPolicy.guarded_max_ads_impact_pct ?? 0.4)}
            onBlur={(event) => {
              const value = Number(event.target.value);
              if (
                Number.isFinite(value) &&
                value >= 0 &&
                value <= 1 &&
                value !== Number(autonomyPolicy.guarded_max_ads_impact_pct ?? 0.4)
              ) {
                void onSaveAutonomyPatch(
                  { guarded_max_ads_impact_pct: value },
                  'Zapisano próg trybu strzeżonego.'
                );
              }
            }}
          />
        </Field>

        <Field
          label={help('ads_stop_loss_on_tick').label}
          hint={help('ads_stop_loss_on_tick').hint}
        >
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              defaultChecked={autonomyPolicy.ads_stop_loss_on_tick !== false}
              onChange={(event) =>
                void onSaveAutonomyPatch(
                  { ads_stop_loss_on_tick: event.target.checked },
                  'Zapisano stop-loss reklam.'
                )
              }
            />
            <span>Stop-loss na bieżąco</span>
          </label>
        </Field>

        <Field
          label={help('auto_apply_experiments').label}
          hint={help('auto_apply_experiments').hint}
        >
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              defaultChecked={autonomyPolicy.auto_apply_experiments === true}
              onChange={(event) =>
                void onSaveAutonomyPatch(
                  { auto_apply_experiments: event.target.checked },
                  'Zapisano auto-wdrażanie zwycięzców testów A/B.'
                )
              }
            />
            <span>Auto-wdrażaj zwycięzców A/B</span>
          </label>
        </Field>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 1fr) auto',
          gap: 12,
          alignItems: 'end',
          padding: 12,
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          background: '#f8fafc',
          marginBottom: 16,
        }}
      >
        <Field label="Potwierdzenie kontrolowanego uruchomienia">
          <UiTextInput
            value={runNowConfirmation}
            onChange={(event) => setRunNowConfirmation(event.target.value)}
            placeholder={runNowConfirmationPlaceholder}
          />
        </Field>
        <button
          type="button"
          disabled={saving || !canRunControlledAutonomyTick}
          style={{
            ...primaryButtonStyle,
            background: canRunControlledAutonomyTick && !saving ? colors.danger : colors.textLight,
            boxShadow: 'none',
            minWidth: 180,
          }}
          onClick={() => {
            void onRunControlledAutonomyTick();
          }}
        >
          Uruchom kontrolowanie
        </button>
      </div>

      {providerProbeResult ? (
        <div
          style={{
            padding: 12,
            background: '#f8fafc',
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 12,
            color: colors.textLight,
          }}
        >
          Ostatni preflight dostawców: {providerProbeResult.results.length} dostawców, łączność{' '}
          {providerProbeResult.includeConnectivity ? 'ON' : 'OFF'}, działania na żywo{' '}
          {providerProbeResult.liveEffects ? 'ON' : 'OFF'}.
        </div>
      ) : null}

      <div style={{ marginBottom: 18 }}>
        <UiTable colCount={6} rowCount={providerReadiness.length + 1}>
          <UiThead>
            <UiTr>
              <UiTh>Dostawca</UiTh>
              <UiTh>Status</UiTh>
              <UiTh>Dane logowania</UiTh>
              <UiTh>Zakresy</UiTh>
              <UiTh>Ostatni test</UiTh>
              <UiTh>Powód blokady</UiTh>
            </UiTr>
          </UiThead>
          <UiTbody>
            {providerReadiness.map((provider: ProviderReadiness) => (
              <UiTr key={provider.provider}>
                <UiTd>{provider.provider}</UiTd>
                <UiTd>
                  <StatusPill status={provider.ready ? 'ready' : 'blocked'} />
                </UiTd>
                <UiTd>{provider.hasCredentials ? 'yes' : 'no'}</UiTd>
                <UiTd>
                  {provider.missingScopes.length > 0
                    ? `missing: ${provider.missingScopes.join(', ')}`
                    : provider.requiredScopes.join(', ') || '-'}
                </UiTd>
                <UiTd>{provider.lastTestedAt ? formatDateTime(provider.lastTestedAt) : '-'}</UiTd>
                <UiTd>{provider.blockedReason || '-'}</UiTd>
              </UiTr>
            ))}
          </UiTbody>
        </UiTable>
        {providerReadiness.length === 0 ? (
          <div style={{ padding: 24, color: colors.textLight, textAlign: 'center' }}>
            Brak macierzy gotowości dostawców.
          </div>
        ) : null}
      </div>

      <div>
        <UiTable colCount={4} rowCount={dryRunSteps.length + 1}>
          <UiThead>
            <UiTr>
              <UiTh>Krok próbny</UiTh>
              <UiTh>Status</UiTh>
              <UiTh>Powód</UiTh>
              <UiTh>Wynik</UiTh>
            </UiTr>
          </UiThead>
          <UiTbody>
            {dryRunSteps.map((step) => (
              <UiTr key={String(step.id ?? step.label)}>
                <UiTd>{String(step.label ?? step.id ?? '-')}</UiTd>
                <UiTd>
                  <StatusPill status={String(step.status ?? 'idle')} />
                </UiTd>
                <UiTd>{String(step.reason ?? '-')}</UiTd>
                <UiTd>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      fontSize: 11,
                      color: colors.textLight,
                      maxWidth: 420,
                    }}
                  >
                    {formatDetailValue(step.output ?? {})}
                  </pre>
                </UiTd>
              </UiTr>
            ))}
          </UiTbody>
        </UiTable>
        {dryRunSteps.length === 0 ? (
          <div style={{ padding: 24, color: colors.textLight, textAlign: 'center' }}>
            Brak podglądu próbnego uruchomienia autopilota.
          </div>
        ) : null}
      </div>
    </section>

    <section style={cardStyle}>
      <h3 style={{ ...sectionTitleStyle, fontSize: 16 }}>Kolejki, wideo, reklamy, eksperymenty</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <StatTile label="Zadania generowania" value={generationJobs.length} />
        <StatTile label="Zasoby wideo" value={videoAssets.length} />
        <StatTile label="Plany reklam" value={adCampaignPlans.length} />
        <StatTile label="Eksperymenty" value={growthExperiments.length} />
        <StatTile label="Wpisy dostawców" value={providerStatuses.length} />
      </div>

      <div style={{ marginBottom: 18 }}>
        <UiTable colCount={5} rowCount={generationJobs.slice(0, 10).length + 1}>
          <UiThead>
            <UiTr>
              <UiTh>Zadanie</UiTh>
              <UiTh>Typ</UiTh>
              <UiTh>Status</UiTh>
              <UiTh>Priorytet</UiTh>
              <UiTh>Zablokowane</UiTh>
            </UiTr>
          </UiThead>
          <UiTbody>
            {generationJobs.slice(0, 10).map((job) => (
              <UiTr key={job.id}>
                <UiTd>#{job.id}</UiTd>
                <UiTd>{job.job_type}</UiTd>
                <UiTd>
                  <StatusPill status={job.status} />
                </UiTd>
                <UiTd>{job.priority_score ?? '-'}</UiTd>
                <UiTd>{job.blocked_reason || job.last_error || '-'}</UiTd>
              </UiTr>
            ))}
          </UiTbody>
        </UiTable>
        {generationJobs.length === 0 ? (
          <UiEmptyState
            compact
            title="Brak zadań generowania"
            description="Zadania pojawią się tu po uruchomieniu generowania treści lub grafik."
          />
        ) : null}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 18,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Zasoby wideo</div>
          <UiTable colCount={3} rowCount={videoAssets.slice(0, 8).length + 1}>
            <UiThead>
              <UiTr>
                <UiTh>Tytuł</UiTh>
                <UiTh>Status</UiTh>
                <UiTh>Zablokowane</UiTh>
              </UiTr>
            </UiThead>
            <UiTbody>
              {videoAssets.slice(0, 8).map((asset) => (
                <UiTr key={asset.id}>
                  <UiTd>{asset.title}</UiTd>
                  <UiTd>
                    <StatusPill status={asset.status} />
                  </UiTd>
                  <UiTd>{asset.blocked_reason || asset.last_error || '-'}</UiTd>
                </UiTr>
              ))}
            </UiTbody>
          </UiTable>
          {videoAssets.length === 0 ? <UiEmptyState compact title="Brak zasobów wideo" /> : null}
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Plany reklam</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(220px, 1fr) auto',
              gap: 12,
              alignItems: 'end',
              marginBottom: 12,
            }}
          >
            <Field label="Potwierdzenie stop-loss reklam">
              <UiTextInput
                value={adsStopLossConfirmation}
                onChange={(event) => setAdsStopLossConfirmation(event.target.value)}
                placeholder={adsStopLossConfirmationPlaceholder}
              />
            </Field>
            <button
              type="button"
              disabled={saving || !canRunAdsStopLoss}
              style={{
                ...primaryButtonStyle,
                background: canRunAdsStopLoss && !saving ? colors.danger : colors.textLight,
                boxShadow: 'none',
                minWidth: 180,
              }}
              onClick={() => {
                void onRunAdsStopLoss();
              }}
            >
              Wstrzymaj aktywne reklamy
            </button>
          </div>
          <UiTable colCount={4} rowCount={adCampaignPlans.slice(0, 8).length + 1}>
            <UiThead>
              <UiTr>
                <UiTh>Nazwa</UiTh>
                <UiTh>Platforma</UiTh>
                <UiTh>Status</UiTh>
                <UiTh>Budżet</UiTh>
              </UiTr>
            </UiThead>
            <UiTbody>
              {adCampaignPlans.slice(0, 8).map((plan) => (
                <UiTr key={plan.id}>
                  <UiTd>{plan.name}</UiTd>
                  <UiTd>{plan.platform}</UiTd>
                  <UiTd>
                    <StatusPill status={plan.status} />
                  </UiTd>
                  <UiTd>{plan.daily_budget_pln ?? '-'}</UiTd>
                </UiTr>
              ))}
            </UiTbody>
          </UiTable>
          {adCampaignPlans.length === 0 ? (
            <UiEmptyState compact title="Brak planów reklam" />
          ) : null}
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Eksperymenty</div>
          <UiTable colCount={3} rowCount={growthExperiments.slice(0, 8).length + 1}>
            <UiThead>
              <UiTr>
                <UiTh>Nazwa</UiTh>
                <UiTh>Typ</UiTh>
                <UiTh>Status</UiTh>
              </UiTr>
            </UiThead>
            <UiTbody>
              {growthExperiments.slice(0, 8).map((experiment) => (
                <UiTr key={experiment.id}>
                  <UiTd>{experiment.name}</UiTd>
                  <UiTd>{experiment.experiment_type}</UiTd>
                  <UiTd>
                    <StatusPill status={experiment.status} />
                  </UiTd>
                </UiTr>
              ))}
            </UiTbody>
          </UiTable>
          {growthExperiments.length === 0 ? (
            <UiEmptyState compact title="Brak eksperymentów" />
          ) : null}
        </div>
      </div>
    </section>

    <section style={cardStyle}>
      <h3 style={{ ...sectionTitleStyle, fontSize: 16 }}>Agent strategii treści</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Field label="Start tygodnia">
          <UiTextInput
            type="date"
            value={strategyForm.weekStart}
            onChange={(event) =>
              setStrategyForm((prev) => ({ ...prev, weekStart: event.target.value }))
            }
          />
        </Field>
        <Field label="Limit">
          <UiTextInput
            type="number"
            value={String(strategyForm.limit)}
            onChange={(event) =>
              setStrategyForm((prev) => ({ ...prev, limit: Number(event.target.value) }))
            }
          />
        </Field>
        <Field label="Workflow article">
          <UiSelect
            aria-label="Workflow article"
            value={strategyForm.workflowId}
            onChange={(value) =>
              setStrategyForm((prev) => ({ ...prev, workflowId: String(value) }))
            }
            options={[
              { value: '', label: 'Wszystkie aktywne' },
              ...workflows
                .filter((workflow) => workflow.workflow_type === 'article')
                .map((workflow) => ({
                  value: String(workflow.id),
                  label: `#${workflow.id} ${workflow.name}`,
                })),
            ]}
          />
        </Field>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            alignSelf: 'end',
            minHeight: 46,
          }}
        >
          <UiCheckbox
            checked={strategyForm.autoApprove}
            onChange={(checked) =>
              setStrategyForm((prev) => ({
                ...prev,
                autoApprove: checked,
              }))
            }
          >
            Automatycznie zatwierdź plan
          </UiCheckbox>
        </div>
        <label
          style={{
            ...checkboxRowStyle,
            padding: 14,
            background: settings.aico_strategy_autopilot_enabled ? '#f0fdf4' : '#f8fafc',
            border: `1px solid ${
              settings.aico_strategy_autopilot_enabled ? '#bbf7d0' : colors.border
            }`,
            borderRadius: 12,
            alignItems: 'flex-start',
          }}
        >
          <input
            type="checkbox"
            checked={settings.aico_strategy_autopilot_enabled === true}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                aico_strategy_autopilot_enabled: event.target.checked,
              }))
            }
          />
          <span>
            Autopilot strategii
            <span
              style={{
                display: 'block',
                marginTop: 4,
                fontSize: 12,
                color: colors.textLight,
                lineHeight: 1.5,
              }}
            >
              Włączenie pozwala AICO samodzielnie uzupełniać plan treści według zabezpieczeń.
              Domyślnie pozostaje wyłączone.
            </span>
          </span>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          type="button"
          disabled={saving}
          style={primaryButtonStyle}
          onClick={() => {
            void onGenerateStrategyPlan();
          }}
        >
          Wygeneruj plan
        </button>
        <UiButton
          variant="secondary"
          disabled={saving}
          onClick={() => {
            void onApproveStrategyPlan();
          }}
        >
          Zatwierdź do Topic Queue
        </UiButton>
      </div>
      {strategyGenerateResult || strategyApproveResult ? (
        <div
          style={{
            display: 'grid',
            gap: 6,
            padding: 12,
            background: '#f8fafc',
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 12,
            color: colors.textLight,
          }}
        >
          {strategyGenerateResult ? (
            <span>
              Ostatnie generowanie: {strategyGenerateResult.created} utworzono,{' '}
              {strategyGenerateResult.skipped} pominięto, tydzień {strategyGenerateResult.weekStart}
              .
            </span>
          ) : null}
          {strategyApproveResult ? (
            <span>
              Ostatnie zatwierdzenie: {strategyApproveResult.queued} w kolejce,{' '}
              {strategyApproveResult.skipped} pominięto.
            </span>
          ) : null}
        </div>
      ) : null}
      <div>
        <UiTable colCount={6} rowCount={strategyPlan.slice(0, 12).length + 1}>
          <UiThead>
            <UiTr>
              <UiTh>Tytuł</UiTh>
              <UiTh>Status</UiTh>
              <UiTh>Klaster SEO</UiTh>
              <UiTh>Priorytet</UiTh>
              <UiTh>Publikacja</UiTh>
              <UiTh>Uzasadnienie</UiTh>
            </UiTr>
          </UiThead>
          <UiTbody>
            {strategyPlan.slice(0, 12).map((item) => (
              <UiTr key={item.id}>
                <UiTd>
                  <strong>{item.title}</strong>
                  {item.seo_intent ? (
                    <div style={{ fontSize: 11, color: colors.textLight }}>{item.seo_intent}</div>
                  ) : null}
                </UiTd>
                <UiTd>
                  <StatusPill status={item.status} />
                </UiTd>
                <UiTd>{item.seo_cluster || '-'}</UiTd>
                <UiTd>{item.priority_score ?? '-'}</UiTd>
                <UiTd>{formatDateTime(item.target_publish_at)}</UiTd>
                <UiTd>
                  <span
                    style={{
                      display: 'block',
                      maxWidth: 260,
                      fontSize: 12,
                      color: colors.textLight,
                    }}
                  >
                    {item.agent_rationale || '-'}
                  </span>
                </UiTd>
              </UiTr>
            ))}
          </UiTbody>
        </UiTable>
        {strategyPlan.length === 0 ? (
          <div style={{ padding: 24, color: colors.textLight, textAlign: 'center' }}>
            Brak pozycji planu.
          </div>
        ) : null}
      </div>
    </section>

    <section style={cardStyle}>
      <h3 style={{ ...sectionTitleStyle, fontSize: 16 }}>Sygnały SEO / skuteczności</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Field label="Dzień snapshotu">
          <UiTextInput
            type="date"
            value={performanceForm.day}
            onChange={(event) =>
              setPerformanceForm((prev) => ({ ...prev, day: event.target.value }))
            }
          />
        </Field>
        <Field label="Limit artykułów">
          <UiTextInput
            type="number"
            value={String(performanceForm.limit)}
            onChange={(event) =>
              setPerformanceForm((prev) => ({ ...prev, limit: Number(event.target.value) }))
            }
          />
        </Field>
        <div style={{ alignSelf: 'end' }}>
          <button
            type="button"
            disabled={saving}
            style={primaryButtonStyle}
            onClick={() => {
              void onAggregatePerformance();
            }}
          >
            Przelicz performance
          </button>
        </div>
      </div>
      {performanceAggregateResult ? (
        <div
          style={{
            padding: 12,
            background: '#f8fafc',
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 12,
            color: colors.textLight,
          }}
        >
          Ostatnia agregacja: {performanceAggregateResult.processed} snapshotów dla dnia{' '}
          {performanceAggregateResult.day}.
        </div>
      ) : null}
      <div style={{ display: 'grid', gap: 10 }}>
        {performanceSnapshots.slice(0, 8).map((snapshot) => (
          <div
            key={snapshot.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 12,
              padding: 14,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              background: '#fff',
            }}
          >
            <div>
              <strong style={{ color: colors.text }}>
                {snapshot.content_title || snapshot.content_slug || snapshot.unique_key}
              </strong>
              <div style={{ fontSize: 12, color: colors.textLight, marginTop: 4 }}>
                {snapshot.snapshot_day} | views {snapshot.views ?? 0} | CTA{' '}
                {snapshot.cta_clicks ?? 0} | premium events {snapshot.premium_events ?? 0}
              </div>
              {snapshot.recommendations ? (
                <pre
                  style={{
                    margin: '8px 0 0',
                    whiteSpace: 'pre-wrap',
                    fontSize: 11,
                    color: colors.textLight,
                    background: '#f8fafc',
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  {formatDetailValue(snapshot.recommendations)}
                </pre>
              ) : null}
            </div>
            <StatusPill status={`score ${snapshot.score ?? 0}`} />
          </div>
        ))}
        {performanceSnapshots.length === 0 ? (
          <div style={{ padding: 24, color: colors.textLight, textAlign: 'center' }}>
            Brak snapshotów performance.
          </div>
        ) : null}
      </div>
    </section>

    <section style={cardStyle}>
      <h3 style={{ ...sectionTitleStyle, fontSize: 16 }}>Rekomendacje strony głównej</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(180px, 240px) auto',
          gap: 16,
          marginBottom: 16,
          alignItems: 'end',
        }}
      >
        <Field label="Limit rekomendacji">
          <UiTextInput
            type="number"
            value={String(homepageForm.limit)}
            onChange={(event) =>
              setHomepageForm((prev) => ({ ...prev, limit: Number(event.target.value) }))
            }
          />
        </Field>
        <button
          type="button"
          disabled={saving}
          style={primaryButtonStyle}
          onClick={() => {
            void onRunHomepageRecommendations();
          }}
        >
          Przelicz homepage
        </button>
      </div>
      {homepageRunResult ? (
        <pre
          style={{
            margin: '0 0 16px',
            whiteSpace: 'pre-wrap',
            fontSize: 12,
            color: colors.textLight,
            background: '#f8fafc',
            borderRadius: 10,
            padding: 12,
          }}
        >
          {formatDetailValue(homepageRunResult)}
        </pre>
      ) : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {homepageRecommendations.slice(0, 12).map((item) => (
          <div
            key={item.id}
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 14,
              background: '#fff',
              display: 'grid',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong style={{ color: colors.text }}>{item.title}</strong>
              <StatusPill status={item.status} />
            </div>
            <div style={{ fontSize: 12, color: colors.textLight }}>
              Slot: {item.slot} | Priority: {item.priority_score ?? '-'}
            </div>
            {item.subtitle ? (
              <div style={{ fontSize: 12, color: colors.textLight }}>{item.subtitle}</div>
            ) : null}
            {item.rationale ? (
              <div style={{ fontSize: 12, color: colors.text }}>{item.rationale}</div>
            ) : null}
            {item.target_url ? (
              <a
                href={item.target_url}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: colors.primary, fontWeight: 700 }}
              >
                Podgląd celu
              </a>
            ) : null}
          </div>
        ))}
        {homepageRecommendations.length === 0 ? (
          <div style={{ padding: 24, color: colors.textLight, textAlign: 'center' }}>
            Brak rekomendacji homepage.
          </div>
        ) : null}
      </div>
    </section>
  </div>
);
