import type React from 'react';

import { UiAlert, UiStatus } from '../../components/ui';
import type {
  DashboardSummary,
  DashboardUsageSummary,
  DiagnosticsSummary,
  OperatorSummary,
} from '../../types';

type StatTileProps = {
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
};

type DashboardTabColors = {
  danger: string;
  warning: string;
  secondary: string;
  text: string;
  textLight: string;
};

type DashboardTabProps = {
  summary: DashboardSummary | null;
  diagnostics: DiagnosticsSummary | null;
  cardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  colors: DashboardTabColors;
  StatTile: React.ComponentType<StatTileProps>;
};

const formatNumber = (value: number): string => new Intl.NumberFormat('pl-PL').format(value);

const formatPln = (value: number): string =>
  `${new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value
  )} zł`;

// Kolor stanu paska/etykiety względem progu wykorzystania limitu:
//   >= 100% -> danger, >= 80% -> warning, w przeciwnym razie -> secondary.
const usageRatio = (used: number, cap: number): number => (cap > 0 ? used / cap : 0);

const usageColor = (used: number, cap: number, colors: DashboardTabColors): string => {
  const ratio = usageRatio(used, cap);
  if (cap > 0 && ratio >= 1) {
    return colors.danger;
  }
  if (cap > 0 && ratio >= 0.8) {
    return colors.warning;
  }
  return colors.secondary;
};

type BudgetRowProps = {
  label: string;
  used: number;
  cap: number;
  valueText: string;
  capText?: string;
  colors: DashboardTabColors;
};

const BudgetRow = ({ label, used, cap, valueText, capText, colors }: BudgetRowProps) => {
  const ratio = usageRatio(used, cap);
  const widthPct = Math.min(100, Math.round(ratio * 100));
  const color = usageColor(used, cap, colors);

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, color: colors.textLight }}>{label}</span>
        <strong style={{ fontSize: 14, color }}>
          {valueText}
          {capText ? <span style={{ color: colors.textLight, fontWeight: 500 }}> {capText}</span> : null}
        </strong>
      </div>
      {cap > 0 ? (
        <div
          aria-hidden="true"
          style={{ height: 8, borderRadius: 999, background: '#eef2f7', overflow: 'hidden' }}
        >
          <div
            style={{
              width: `${widthPct}%`,
              height: '100%',
              borderRadius: 999,
              background: color,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

// ——————————————————————————————————————————————————————————————————————————
// "Co zrobił autopilot" — przyjazna, nietechniczna karta wyjaśniająca, co
// silnik zrobił dziś, ile wydał, co czeka w kolejce i co warto zrobić dalej.
// Cel: zbudować zaufanie nietechnicznego właściciela do autonomicznego silnika
// (odblokowanie przejścia z trybu „tylko szkice" do realnej autonomii).
// ——————————————————————————————————————————————————————————————————————————

// Mała, spokojna kafelka statystyki (lokalna — nie miesza się z globalnym
// StatTile z Centrum Dowodzenia; tutaj liczby są mniejsze i bardziej "miękkie").
const OperatorStatTile = ({
  label,
  value,
  color,
  colors,
}: {
  label: string;
  value: string | number;
  color?: string;
  colors: DashboardTabColors;
}) => (
  <div
    style={{
      background: '#f8fafc',
      borderRadius: 12,
      padding: '14px 16px',
      display: 'grid',
      gap: 4,
    }}
  >
    <span style={{ fontSize: 12, color: colors.textLight, fontWeight: 600 }}>{label}</span>
    <strong style={{ fontSize: 22, color: color ?? colors.text, lineHeight: 1.1 }}>{value}</strong>
  </div>
);

// Buduje 1–2 zdania w prostym języku podsumowujące dzień autopilota.
const buildOperatorHeadline = (operator: OperatorSummary): string => {
  const { generated, autonomy, pipeline } = operator;

  if (autonomy.killSwitch) {
    return 'Autopilot jest zatrzymany wyłącznikiem awaryjnym. Dziś nic nie zostało wygenerowane.';
  }

  if (generated.total === 0) {
    if (pipeline.pendingTopics > 0 || pipeline.plannedItems > 0) {
      return 'Dziś autopilot jeszcze nic nie wygenerował, ale ma zaplanowaną pracę i zajmie się nią przy najbliższym uruchomieniu.';
    }
    return 'Dziś autopilot jeszcze nic nie wygenerował, a kolejka pracy jest pusta.';
  }

  const successPart =
    generated.successes === 1
      ? 'przygotował 1 materiał'
      : `przygotował ${formatNumber(generated.successes)} materiałów`;
  const failurePart =
    generated.failures > 0
      ? generated.failures === 1
        ? ', a 1 zadanie wymaga uwagi'
        : `, a ${formatNumber(generated.failures)} zadań wymaga uwagi`
      : '';

  return `Dziś autopilot ${successPart}${failurePart}.`;
};

const OperatorSummaryCard = ({
  operator,
  cardStyle,
  sectionTitleStyle,
  colors,
}: {
  operator: OperatorSummary | undefined;
  cardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  colors: DashboardTabColors;
}) => {
  if (!operator) {
    return (
      <section style={cardStyle}>
        <h3 style={{ ...sectionTitleStyle, fontSize: 16 }}>Co zrobił autopilot</h3>
        <div style={{ fontSize: 13, color: colors.textLight }}>
          Brak danych o pracy autopilota. Spróbuj odświeżyć panel.
        </div>
      </section>
    );
  }

  const { generated, spend, autonomy, recommendations } = operator;

  // Status badge: czerwony przy zatrzymaniu, pomarańczowy przy błędach,
  // niebieski w trybie „tylko szkice", zielony gdy pracuje normalnie.
  const headlineTone: 'danger' | 'warning' | 'info' | 'success' = autonomy.killSwitch
    ? 'danger'
    : generated.failures > 0
      ? 'warning'
      : autonomy.mode === 'off' || autonomy.mode === 'draft_only'
        ? 'info'
        : 'success';

  const adsSpentText =
    spend.ads.capPln > 0
      ? `${formatPln(spend.ads.spentPln)} / ${formatPln(spend.ads.capPln)}`
      : formatPln(spend.ads.spentPln);

  return (
    <section style={cardStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h3 style={{ ...sectionTitleStyle, fontSize: 16, marginBottom: 0 }}>Co zrobił autopilot</h3>
        <UiStatus tone={headlineTone} size="S">
          {`TRYB: ${autonomy.modeLabel.toUpperCase()}`}
        </UiStatus>
      </div>

      <p
        style={{
          fontSize: 15,
          lineHeight: 1.5,
          color: colors.text,
          margin: '0 0 20px',
        }}
      >
        {buildOperatorHeadline(operator)}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
          marginBottom: recommendations.length ? 20 : 0,
        }}
      >
        <OperatorStatTile label="Wygenerowano dziś" value={formatNumber(generated.total)} colors={colors} />
        <OperatorStatTile
          label="Sukcesy"
          value={formatNumber(generated.successes)}
          color={generated.successes > 0 ? colors.secondary : undefined}
          colors={colors}
        />
        <OperatorStatTile
          label="Błędy"
          value={formatNumber(generated.failures)}
          color={generated.failures > 0 ? colors.danger : undefined}
          colors={colors}
        />
        <OperatorStatTile label="Wydatek na reklamy (dziś)" value={adsSpentText} colors={colors} />
      </div>

      {recommendations.length ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: colors.textLight }}>Co dalej</span>
          {recommendations.map((rec) => (
            <UiAlert key={rec.key} tone={rec.tone}>
              {rec.message}
            </UiAlert>
          ))}
        </div>
      ) : null}
    </section>
  );
};

const BudgetUsageCard = ({
  usage,
  cardStyle,
  sectionTitleStyle,
  colors,
}: {
  usage: DashboardUsageSummary | undefined;
  cardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  colors: DashboardTabColors;
}) => {
  if (!usage) {
    return (
      <section style={cardStyle}>
        <h3 style={{ ...sectionTitleStyle, fontSize: 16 }}>Budżet i zużycie (dziś)</h3>
        <div style={{ fontSize: 13, color: colors.textLight }}>
          Brak danych o zużyciu. Spróbuj odświeżyć panel.
        </div>
      </section>
    );
  }

  const overCap =
    usageRatio(usage.media.jobsToday, usage.media.cap) >= 1 ||
    usageRatio(usage.ads.spentPln, usage.ads.capPln) >= 1 ||
    usageRatio(usage.llm.requests, usage.llm.requestsCap) >= 1;

  return (
    <section style={cardStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h3 style={{ ...sectionTitleStyle, fontSize: 16, marginBottom: 0 }}>
          Budżet i zużycie (dziś)
        </h3>
        <UiStatus tone={overCap ? 'danger' : 'success'} size="S">
          {overCap ? 'LIMIT OSIĄGNIĘTY' : 'W LIMICIE'}
        </UiStatus>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <BudgetRow
          label="LLM (zapytania)"
          used={usage.llm.requests}
          cap={usage.llm.requestsCap}
          valueText={`${formatNumber(usage.llm.requests)} zapytań · ${formatNumber(
            usage.llm.tokens
          )} tokenów`}
          capText={usage.llm.requestsCap > 0 ? `/ ${formatNumber(usage.llm.requestsCap)}` : undefined}
          colors={colors}
        />
        <BudgetRow
          label="Media (zadania)"
          used={usage.media.jobsToday}
          cap={usage.media.cap}
          valueText={formatNumber(usage.media.jobsToday)}
          capText={`/ ${formatNumber(usage.media.cap)}`}
          colors={colors}
        />
        <BudgetRow
          label="Reklamy (wydatek)"
          used={usage.ads.spentPln}
          cap={usage.ads.capPln}
          valueText={formatPln(usage.ads.spentPln)}
          capText={`/ ${formatPln(usage.ads.capPln)}`}
          colors={colors}
        />
      </div>
    </section>
  );
};

export const DashboardTab = ({
  summary,
  diagnostics,
  cardStyle,
  sectionTitleStyle,
  colors,
  StatTile,
}: DashboardTabProps): React.ReactNode => (
  <div
    id="aico-tabpanel-dashboard"
    role="tabpanel"
    aria-labelledby="aico-tab-dashboard"
    style={{ display: 'grid', gap: 24 }}
  >
    <section style={cardStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Centrum Dowodzenia</h2>
        <UiStatus tone={diagnostics?.ok ? 'success' : 'warning'} size="S">
          {diagnostics?.ok ? 'SYSTEM GOTOWY' : 'WYMAGA UWAGI'}
        </UiStatus>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 20,
        }}
      >
        <StatTile
          label="Aktywne Workflows"
          value={`${summary?.workflows.enabled ?? 0} / ${summary?.workflows.total ?? 0}`}
        />
        <StatTile label="Oczekujące Tematy" value={summary?.topics.pending ?? 0} />
        <StatTile label="Zaplanowane Publikacje" value={summary?.publications.scheduled ?? 0} />
        <StatTile label="Błędy Wykonań (łącznie)" value={summary?.runs.failed ?? 0} />
        <StatTile
          label="Social Media"
          value={`${summary?.social?.published ?? 0} ok / ${summary?.social?.scheduled ?? 0} zaplan.`}
          subValue={summary?.social?.failed ? `${summary.social.failed} błędów` : undefined}
          color={summary?.social?.failed ? colors.danger : undefined}
        />
      </div>
    </section>

    <OperatorSummaryCard
      operator={summary?.operator}
      cardStyle={cardStyle}
      sectionTitleStyle={sectionTitleStyle}
      colors={colors}
    />

    <BudgetUsageCard
      usage={summary?.usage}
      cardStyle={cardStyle}
      sectionTitleStyle={sectionTitleStyle}
      colors={colors}
    />

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <section style={cardStyle}>
        <h3 style={{ ...sectionTitleStyle, fontSize: 16 }}>Status Zasobów</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: '#f8fafc',
              borderRadius: 12,
            }}
          >
            <span style={{ fontSize: 14, color: colors.textLight }}>Media aktywne / Razem</span>
            <strong style={{ fontSize: 14, color: colors.text }}>
              {diagnostics?.media.linkedActive ?? 0} / {diagnostics?.media.total ?? 0}
            </strong>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: '#f8fafc',
              borderRadius: 12,
            }}
          >
            <span style={{ fontSize: 14, color: colors.textLight }}>Nieprzypisane tematy</span>
            <strong
              style={{
                fontSize: 14,
                color: diagnostics?.topics.unassignedPending ? colors.warning : colors.secondary,
              }}
            >
              {diagnostics?.topics.unassignedPending ?? 0}
            </strong>
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <h3 style={{ ...sectionTitleStyle, fontSize: 16 }}>Ostatnie Problemy</h3>
        {diagnostics?.workflows.issues.length ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {diagnostics.workflows.issues.slice(0, 4).map((issue) => (
              <UiAlert
                key={`${issue.workflowId}-${issue.message}`}
                tone="danger"
                title={`#${issue.workflowId}`}
              >
                {issue.message}
              </UiAlert>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: colors.secondary,
              fontWeight: 600,
            }}
          >
            ✅ Wszystkie systemy sprawne
          </div>
        )}
      </section>
    </div>
  </div>
);
