import type React from 'react';

import {
  UiAlert,
  UiButton,
  UiTable,
  UiTbody,
  UiTd,
  UiTh,
  UiThead,
  UiTr,
} from '../../components/ui';
import type { AuditReport } from '../../types';

type OpsState = 'ready' | 'needs_action' | 'blocked' | 'degraded';

type StatusPillProps = { status: string };

type AuditTabProps = {
  auditReport: AuditReport | null;
  auditOpsState: OpsState;
  auditOpsMessage: string | null;
  saving: boolean;
  cardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  primaryButtonStyle: React.CSSProperties;
  colors: { text: string; textLight: string; border: string };
  formatDateTime: (value?: string | null) => string;
  StatusPill: React.ComponentType<StatusPillProps>;
  onRunPreflightAudit: (strict: boolean) => void;
};

export const AuditTab = ({
  auditReport,
  auditOpsState,
  auditOpsMessage,
  saving,
  cardStyle,
  sectionTitleStyle,
  primaryButtonStyle,
  colors,
  formatDateTime,
  StatusPill,
  onRunPreflightAudit,
}: AuditTabProps): React.ReactNode => (
  <section style={cardStyle}>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
      }}
    >
      <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Audyt produkcyjny (Go/No-Go)</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <UiButton
          variant="secondary"
          disabled={saving}
          onClick={() => {
            void onRunPreflightAudit(false);
          }}
        >
          Sprawdź (łagodnie)
        </UiButton>
        <button
          type="button"
          style={primaryButtonStyle}
          disabled={saving}
          onClick={() => {
            void onRunPreflightAudit(true);
          }}
        >
          Sprawdź rygorystycznie
        </button>
      </div>
    </div>

    {auditOpsState !== 'ready' ? (
      <div style={{ marginBottom: 14 }}>
        <UiAlert
          tone={
            auditOpsState === 'blocked'
              ? 'danger'
              : auditOpsState === 'degraded'
                ? 'info'
                : 'warning'
          }
        >
          Status: <strong>{auditOpsState}</strong>.{' '}
          {auditOpsMessage || 'Sprawdź autoryzację i endpoint preflight.'}
        </UiAlert>
      </div>
    ) : null}

    {auditReport ? (
      <div style={{ display: 'grid', gap: 14 }}>
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            border: `1px solid ${auditReport.decision === 'NO_GO' ? '#fecaca' : auditReport.decision === 'GO_WITH_WARNINGS' ? '#fde68a' : '#86efac'}`,
            background:
              auditReport.decision === 'NO_GO'
                ? '#fef2f2'
                : auditReport.decision === 'GO_WITH_WARNINGS'
                  ? '#fffbeb'
                  : '#f0fdf4',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800 }}>Decyzja: {auditReport.decision}</div>
          <div style={{ fontSize: 12, color: colors.textLight, marginTop: 4 }}>
            Błędy krytyczne: {auditReport.summary.criticalFailures} | Ostrzeżenia:{' '}
            {auditReport.summary.warnings} | Wygenerowano: {formatDateTime(auditReport.generatedAt)}
          </div>
        </div>

        <div>
          <UiTable colCount={5} rowCount={auditReport.checks.length + 1} minWidth={940}>
            <UiThead>
              <UiTr>
                <UiTh>Obszar</UiTh>
                <UiTh>ID</UiTh>
                <UiTh>Waga</UiTh>
                <UiTh>Status</UiTh>
                <UiTh>Komunikat</UiTh>
              </UiTr>
            </UiThead>
            <UiTbody>
              {auditReport.checks.map((check) => (
                <UiTr key={check.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <UiTd>{check.area}</UiTd>
                  <UiTd>{check.id}</UiTd>
                  <UiTd>{check.severity}</UiTd>
                  <UiTd>
                    <StatusPill
                      status={
                        check.status === 'pass'
                          ? 'success'
                          : check.status === 'warn'
                            ? 'blocked_budget'
                            : 'failed'
                      }
                    />
                  </UiTd>
                  <UiTd>{check.message}</UiTd>
                </UiTr>
              ))}
            </UiTbody>
          </UiTable>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              padding: 12,
              background: '#fff',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Nieudane przepływy</div>
            {auditReport.failed_flows.length === 0 ? (
              <div style={{ fontSize: 12, color: colors.textLight }}>
                Brak krytycznych błędów flow.
              </div>
            ) : (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 12,
                  color: colors.text,
                  display: 'grid',
                  gap: 6,
                }}
              >
                {auditReport.failed_flows.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>

          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              padding: 12,
              background: '#fff',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              Nieudane kontrole dostępu
            </div>
            {auditReport.failed_access_checks.length === 0 ? (
              <div style={{ fontSize: 12, color: colors.textLight }}>
                Brak krytycznych braków RBAC/route.
              </div>
            ) : (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 12,
                  color: colors.text,
                  display: 'grid',
                  gap: 6,
                }}
              >
                {auditReport.failed_access_checks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div
            style={{
              border: '1px solid #fecaca',
              borderRadius: 10,
              padding: 12,
              background: '#fff7f7',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>
              Ustalenia krytyczne
            </div>
            {auditReport.critical_findings.length === 0 ? (
              <div style={{ fontSize: 12, color: colors.textLight }}>
                Brak krytycznych findingów.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {auditReport.critical_findings.map((finding) => (
                  <div
                    key={finding.id}
                    style={{
                      padding: 10,
                      border: '1px solid #fecaca',
                      borderRadius: 8,
                      background: '#fff',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#7f1d1d' }}>
                      {finding.area} · {finding.id}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>{finding.message}</div>
                    <div style={{ fontSize: 12, color: '#9f1239', marginTop: 6 }}>
                      Naprawa: {finding.remediation}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              border: '1px solid #fde68a',
              borderRadius: 10,
              padding: 12,
              background: '#fffbeb',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
              Ustalenia niekrytyczne
            </div>
            {auditReport.non_critical_findings.length === 0 ? (
              <div style={{ fontSize: 12, color: colors.textLight }}>Brak warningów.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {auditReport.non_critical_findings.map((finding) => (
                  <div
                    key={finding.id}
                    style={{
                      padding: 10,
                      border: '1px solid #fde68a',
                      borderRadius: 8,
                      background: '#fff',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#78350f' }}>
                      {finding.area} · {finding.id}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>{finding.message}</div>
                    <div style={{ fontSize: 12, color: '#92400e', marginTop: 6 }}>
                      Naprawa: {finding.remediation}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    ) : (
      <div style={{ color: colors.textLight, fontSize: 13 }}>
        Brak raportu audytu. Uruchom preflight, aby otrzymać decyzję GO/NO-GO.
      </div>
    )}
  </section>
);
