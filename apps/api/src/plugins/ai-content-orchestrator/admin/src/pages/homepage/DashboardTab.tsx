import type React from 'react';

import { UiAlert, UiStatus } from '../../components/ui';
import type { DashboardSummary, DiagnosticsSummary } from '../../types';

type StatTileProps = {
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
};

type DashboardTabProps = {
  summary: DashboardSummary | null;
  diagnostics: DiagnosticsSummary | null;
  cardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  colors: {
    danger: string;
    warning: string;
    secondary: string;
    text: string;
    textLight: string;
  };
  StatTile: React.ComponentType<StatTileProps>;
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
