import type React from 'react';

import { UiBadge, UiButton, UiTable, UiTbody, UiTd, UiTh, UiThead, UiTr } from '../../components/ui';
import type { Workflow } from '../../types';

type StatusPillProps = { status: string };

type WorkflowsTabProps = {
  workflows: Workflow[];
  saving: boolean;
  runningWorkflowIds: number[];
  cardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  colors: {
    primary: string;
    secondary: string;
    danger: string;
    text: string;
    textLight: string;
    border: string;
  };
  StatusPill: React.ComponentType<StatusPillProps>;
  onNewWorkflow: () => void;
  onEditWorkflow: (workflow: Workflow) => void;
  onRunWorkflow: (workflowId: number) => void;
  onViewLogs: (workflow: Workflow) => void;
};

export const WorkflowsTab = ({
  workflows,
  saving,
  runningWorkflowIds,
  cardStyle,
  sectionTitleStyle,
  colors,
  StatusPill,
  onNewWorkflow,
  onEditWorkflow,
  onRunWorkflow,
  onViewLogs,
}: WorkflowsTabProps): React.ReactNode => (
  <section style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
    <div
      style={{
        padding: '24px 28px',
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fcfcfd',
      }}
    >
      <div>
        <h2 style={{ ...sectionTitleStyle, marginBottom: 4 }}>Zarządzanie Workflow</h2>
        <p style={{ fontSize: 13, color: colors.textLight, margin: 0 }}>
          Konfiguruj automatyczne generowanie horoskopów, kart i artykułów.
        </p>
      </div>
      <UiButton variant="primary" onClick={onNewWorkflow}>
        + Nowy Workflow
      </UiButton>
    </div>

    <div>
      <UiTable colCount={8} rowCount={workflows.length + 1}>
        <UiThead>
          <UiTr>
            <UiTh>ID</UiTh>
            <UiTh>Nazwa</UiTh>
            <UiTh>Typ</UiTh>
            <UiTh>Status</UiTh>
            <UiTh>Aktywny</UiTh>
            <UiTh>Harmonogram</UiTh>
            <UiTh>Ostatni Błąd</UiTh>
            <UiTh style={{ textAlign: 'right' }}>Akcje</UiTh>
          </UiTr>
        </UiThead>
        <UiTbody>
          {workflows.map((workflow) => (
            <UiTr key={workflow.id} style={{ transition: 'background 0.2s' }}>
              <UiTd>
                <span style={{ color: colors.textLight, fontWeight: 700 }}>#{workflow.id}</span>
              </UiTd>
              <UiTd>
                <strong style={{ color: colors.text }}>{workflow.name}</strong>
              </UiTd>
              <UiTd>
                <UiBadge tone="neutral" size="S">
                  {workflow.workflow_type}
                </UiBadge>
              </UiTd>
              <UiTd>
                <StatusPill status={workflow.status} />
              </UiTd>
              <UiTd>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: workflow.enabled ? colors.secondary : '#cbd5e1',
                    margin: '0 auto',
                  }}
                />
              </UiTd>
              <UiTd>
                <div style={{ fontSize: 12, color: colors.textLight }}>
                  Gen: {workflow.generate_cron}
                  <br />
                  Pub: {workflow.publish_cron}
                </div>
              </UiTd>
              <UiTd>
                {workflow.last_error ? (
                  <span
                    style={{
                      color: colors.danger,
                      fontSize: 12,
                      display: 'block',
                      maxWidth: 200,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {workflow.last_error}
                  </span>
                ) : (
                  '-'
                )}
              </UiTd>
              <UiTd>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <UiButton variant="secondary" size="S" onClick={() => onEditWorkflow(workflow)}>
                    Edytuj
                  </UiButton>
                  <UiButton
                    variant="primary"
                    size="S"
                    onClick={() => onRunWorkflow(workflow.id)}
                    disabled={
                      saving ||
                      runningWorkflowIds.includes(workflow.id) ||
                      workflow.status === 'running'
                    }
                    loading={
                      runningWorkflowIds.includes(workflow.id) || workflow.status === 'running'
                    }
                  >
                    {runningWorkflowIds.includes(workflow.id) || workflow.status === 'running'
                      ? 'W toku...'
                      : 'Uruchom'}
                  </UiButton>
                  <UiButton variant="secondary" size="S" onClick={() => onViewLogs(workflow)}>
                    Logi
                  </UiButton>
                </div>
              </UiTd>
            </UiTr>
          ))}
        </UiTbody>
      </UiTable>
      {workflows.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: colors.textLight }}>
          Brak zdefiniowanych workflow. Kliknij "+ Nowy Workflow", aby zacząć.
        </div>
      )}
    </div>
  </section>
);
