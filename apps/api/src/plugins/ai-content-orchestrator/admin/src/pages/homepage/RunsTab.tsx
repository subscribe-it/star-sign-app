import type React from 'react';
import { Fragment } from 'react';

import { UiButton, UiSelect, UiTextInput } from '../../components/ui';
import type { LlmTrace, Run, RunStep, Workflow } from '../../types';

type RunFiltersState = {
  status: 'all' | Run['status'];
  workflowName: string;
  fromDate: string;
  toDate: string;
};

type StatusPillProps = { status: string };
type StatTileProps = {
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
};
type ThProps = { children?: React.ReactNode; style?: React.CSSProperties };
type TdProps = { children: React.ReactNode; style?: React.CSSProperties; colSpan?: number };
type FieldProps = { label: string; hint?: string; children: React.ReactNode };

type RunsTabProps = {
  runs: Run[];
  filteredRuns: Run[];
  liveRunCount: number;
  expandedRunIds: number[];
  workflows: Workflow[];
  runFilters: RunFiltersState;
  setRunFilters: React.Dispatch<React.SetStateAction<RunFiltersState>>;
  initialRunFilters: () => RunFiltersState;
  saving: boolean;
  cardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  primaryButtonStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
  colors: { primary: string; text: string; textLight: string; border: string };
  formatDateTime: (value?: string | null) => string;
  formatDuration: (startedAt: string, finishedAt?: string | null) => string;
  formatDetailValue: (value: unknown) => string;
  getRunSteps: (run: Run) => RunStep[];
  getRunLlmTraces: (run: Run) => LlmTrace[];
  getRunWorkflowName: (run: Run, workflows: Workflow[]) => string;
  getRunResultSummary: (run: Run) => string;
  StatusPill: React.ComponentType<StatusPillProps>;
  StatTile: React.ComponentType<StatTileProps>;
  Th: React.ComponentType<ThProps>;
  Td: React.ComponentType<TdProps>;
  Field: React.ComponentType<FieldProps>;
  ErrorInsight: React.ComponentType<{ error?: string | null }>;
  AutonomousIntelligence: React.ComponentType<{ run: Run }>;
  onRefresh: () => void;
  onToggleRunDetails: (runId: number) => void;
  onRetryRun: (runId: number) => void;
};

export const RunsTab = ({
  runs,
  filteredRuns,
  liveRunCount,
  expandedRunIds,
  workflows,
  runFilters,
  setRunFilters,
  initialRunFilters,
  saving,
  cardStyle,
  sectionTitleStyle,
  primaryButtonStyle,
  inputStyle,
  colors,
  formatDateTime,
  formatDuration,
  formatDetailValue,
  getRunSteps,
  getRunLlmTraces,
  getRunWorkflowName,
  getRunResultSummary,
  StatusPill,
  StatTile,
  Th,
  Td,
  Field,
  ErrorInsight,
  AutonomousIntelligence,
  onRefresh,
  onToggleRunDetails,
  onRetryRun,
}: RunsTabProps): React.ReactNode => (
  <section style={cardStyle}>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
      }}
    >
      <div>
        <h2 style={{ ...sectionTitleStyle, marginBottom: 4 }}>Monitoring Operacyjny</h2>
        <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
          Historia wykonań, analiza AI i diagnostyka błędów w czasie rzeczywistym.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <StatTile label="Aktywne" value={liveRunCount} />
        <StatTile
          label="Ostatnie 24h"
          value={
            runs.filter((r) => new Date(r.started_at) > new Date(Date.now() - 86400000)).length
          }
        />
        <StatTile
          label="Błędy (24h)"
          value={
            runs.filter(
              (r) =>
                r.status === 'failed' && new Date(r.started_at) > new Date(Date.now() - 86400000)
            ).length
          }
        />
      </div>
    </div>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 10,
        marginBottom: 14,
      }}
    >
      <Field label="Status">
        <UiSelect
          aria-label="Status"
          value={runFilters.status}
          onChange={(value) =>
            setRunFilters((prev) => ({
              ...prev,
              status: value as RunFiltersState['status'],
            }))
          }
          options={[
            { value: 'all', label: 'Wszystkie' },
            { value: 'running', label: 'running' },
            { value: 'success', label: 'success' },
            { value: 'failed', label: 'failed' },
            { value: 'blocked_budget', label: 'blocked_budget' },
          ]}
        />
      </Field>
      <Field label="Nazwa workflow">
        <UiTextInput
          value={runFilters.workflowName}
          onChange={(event) =>
            setRunFilters((prev) => ({ ...prev, workflowName: event.target.value }))
          }
        />
      </Field>
      <Field label="Od">
        <UiTextInput
          type="date"
          value={runFilters.fromDate}
          onChange={(event) => setRunFilters((prev) => ({ ...prev, fromDate: event.target.value }))}
        />
      </Field>
      <Field label="Do">
        <UiTextInput
          type="date"
          value={runFilters.toDate}
          onChange={(event) => setRunFilters((prev) => ({ ...prev, toDate: event.target.value }))}
        />
      </Field>
      <div style={{ display: 'flex', alignItems: 'end', gap: 8, flexWrap: 'wrap' }}>
        <UiButton variant="secondary" onClick={() => setRunFilters(initialRunFilters())}>
          Wyczyść
        </UiButton>
        <button
          type="button"
          style={primaryButtonStyle}
          onClick={() => {
            void onRefresh();
          }}
        >
          Odśwież
        </button>
      </div>
    </div>

    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
        <thead>
          <tr>
            <Th />
            <Th>ID</Th>
            <Th>Przepływ</Th>
            <Th>Typ</Th>
            <Th>Status</Th>
            <Th>Start</Th>
            <Th>Czas trwania</Th>
            <Th>Wynik</Th>
            <Th>Akcja</Th>
          </tr>
        </thead>
        <tbody>
          {filteredRuns.map((run) => {
            const isExpanded = expandedRunIds.includes(run.id);
            const steps = getRunSteps(run);
            const llmTraces = getRunLlmTraces(run);
            return (
              <Fragment key={run.id}>
                <tr
                  style={{
                    transition: 'background 0.2s',
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  <Td>
                    <button
                      type="button"
                      onClick={() => onToggleRunDetails(run.id)}
                      style={{
                        border: `1px solid ${colors.border}`,
                        background: '#fff',
                        borderRadius: 8,
                        width: 28,
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontWeight: 800,
                        color: colors.primary,
                      }}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? '−' : '+'}
                    </button>
                  </Td>
                  <Td>
                    <span style={{ color: colors.textLight, fontWeight: 700 }}>#{run.id}</span>
                  </Td>
                  <Td>
                    <strong style={{ color: colors.text }}>
                      {getRunWorkflowName(run, workflows)}
                    </strong>
                  </Td>
                  <Td>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 6px',
                        background: '#f1f5f9',
                        borderRadius: 4,
                        color: '#475569',
                        fontWeight: 600,
                      }}
                    >
                      {run.run_type}
                    </span>
                  </Td>
                  <Td>
                    <StatusPill status={run.status} />
                  </Td>
                  <Td>
                    <div style={{ fontSize: 12, color: colors.text }}>
                      {formatDateTime(run.started_at)}
                    </div>
                  </Td>
                  <Td>
                    <div style={{ fontSize: 12, color: colors.textLight, fontWeight: 600 }}>
                      {formatDuration(run.started_at, run.finished_at)}
                    </div>
                  </Td>
                  <Td>
                    <div
                      style={{
                        fontSize: 12,
                        color: colors.text,
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {getRunResultSummary(run)}
                    </div>
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <UiButton
                        variant="secondary"
                        size="S"
                        disabled={saving || run.status === 'running'}
                        onClick={() => void onRetryRun(run.id)}
                      >
                        Ponów
                      </UiButton>
                    </div>
                  </Td>
                </tr>
                {isExpanded ? (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        padding: 12,
                        borderBottom: '1px solid #e8eaf3',
                        background: '#fbfcff',
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                          gap: 12,
                        }}
                      >
                        <div style={{ overflowX: 'auto' }}>
                          <strong style={{ fontSize: 13 }}>Kroki</strong>
                          <table
                            style={{
                              width: '100%',
                              borderCollapse: 'collapse',
                              marginTop: 8,
                              minWidth: 560,
                            }}
                          >
                            <thead>
                              <tr>
                                <Th>Status</Th>
                                <Th>Krok</Th>
                                <Th>Komunikat</Th>
                                <Th>Wynik</Th>
                              </tr>
                            </thead>
                            <tbody>
                              {steps.map((step) => (
                                <tr key={step.id}>
                                  <Td>
                                    <StatusPill status={step.status} />
                                  </Td>
                                  <Td>{step.label}</Td>
                                  <Td>{step.message || '-'}</Td>
                                  <Td>
                                    <code style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>
                                      {formatDetailValue(step.output)}
                                    </code>
                                  </Td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <strong style={{ fontSize: 13 }}>Szczegóły</strong>
                          <div
                            style={{
                              display: 'grid',
                              gap: 6,
                              fontSize: 12,
                              color: '#3a3d4f',
                              marginTop: 8,
                              marginBottom: 8,
                            }}
                          >
                            <span>Rozpoczęto: {formatDateTime(run.started_at)}</span>
                            <span>Zakończono: {formatDateTime(run.finished_at)}</span>
                            <span>Tokeny promptu: {run.usage_prompt_tokens ?? 0}</span>
                            <span>Tokeny odpowiedzi: {run.usage_completion_tokens ?? 0}</span>
                            <span>Tokeny łącznie: {run.usage_total_tokens ?? 0}</span>
                          </div>

                          <ErrorInsight error={run.error_message} />
                          <AutonomousIntelligence run={run} />

                          <div style={{ marginTop: 16 }}>
                            <strong style={{ fontSize: 13 }}>Zapis LLM (trace)</strong>
                          </div>
                          {llmTraces.length === 0 ? (
                            <div
                              style={{
                                marginTop: 8,
                                marginBottom: 10,
                                color: '#606477',
                                fontSize: 12,
                              }}
                            >
                              Brak zapisanego promptu/odpowiedzi dla tego runa.
                            </div>
                          ) : (
                            <div
                              style={{
                                display: 'grid',
                                gap: 10,
                                marginTop: 8,
                                marginBottom: 10,
                              }}
                            >
                              {llmTraces.map((trace) => (
                                <details
                                  key={trace.id}
                                  open={llmTraces.length === 1}
                                  style={{
                                    border: '1px solid #dfe3ef',
                                    borderRadius: 8,
                                    background: '#fff',
                                    padding: 10,
                                  }}
                                >
                                  <summary
                                    style={{
                                      cursor: 'pointer',
                                      fontSize: 12,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {trace.label} • {trace.request.model} •{' '}
                                    {formatDateTime(trace.createdAt)}
                                  </summary>
                                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                                    <div style={{ fontSize: 12, color: '#4c5265' }}>
                                      temp {trace.request.temperature} • max{' '}
                                      {trace.request.maxCompletionTokens} • tokens{' '}
                                      {trace.response.usage.total_tokens}
                                    </div>
                                    {trace.redacted ? (
                                      <div
                                        style={{
                                          border: '1px solid #f3d08b',
                                          background: '#fff8e6',
                                          borderRadius: 8,
                                          padding: 10,
                                          color: '#6f4d08',
                                          fontSize: 12,
                                        }}
                                      >
                                        Trace redacted before storage
                                        {trace.redactionReason ? `: ${trace.redactionReason}` : '.'}
                                      </div>
                                    ) : null}
                                    <Field label={trace.redacted ? 'Prompt summary' : 'Prompt'}>
                                      <textarea
                                        readOnly
                                        style={{
                                          ...inputStyle,
                                          minHeight: 140,
                                          fontFamily: 'monospace',
                                          fontSize: 12,
                                        }}
                                        value={trace.request.prompt}
                                      />
                                    </Field>
                                    <Field
                                      label={
                                        trace.redacted
                                          ? 'Message summaries'
                                          : 'Messages sent to OpenRouter'
                                      }
                                    >
                                      <textarea
                                        readOnly
                                        style={{
                                          ...inputStyle,
                                          minHeight: 180,
                                          fontFamily: 'monospace',
                                          fontSize: 12,
                                        }}
                                        value={JSON.stringify(trace.request.messages, null, 2)}
                                      />
                                    </Field>
                                    <Field
                                      label={
                                        trace.redacted
                                          ? 'Response content summary'
                                          : 'Raw response content'
                                      }
                                    >
                                      <textarea
                                        readOnly
                                        style={{
                                          ...inputStyle,
                                          minHeight: 160,
                                          fontFamily: 'monospace',
                                          fontSize: 12,
                                        }}
                                        value={trace.response.content}
                                      />
                                    </Field>
                                    <Field
                                      label={
                                        trace.redacted
                                          ? 'Parsed response summary'
                                          : 'Parsed response JSON'
                                      }
                                    >
                                      <textarea
                                        readOnly
                                        style={{
                                          ...inputStyle,
                                          minHeight: 160,
                                          fontFamily: 'monospace',
                                          fontSize: 12,
                                        }}
                                        value={formatDetailValue(trace.response.payload)}
                                      />
                                    </Field>
                                  </div>
                                </details>
                              ))}
                            </div>
                          )}
                          <strong style={{ fontSize: 13 }}>Surowe szczegóły</strong>
                          <pre
                            style={{
                              background: '#f3f5fb',
                              border: '1px solid #e0e4ef',
                              borderRadius: 8,
                              padding: 10,
                              fontSize: 11,
                              overflowX: 'auto',
                              maxHeight: 260,
                            }}
                          >
                            {JSON.stringify(run.details ?? {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {filteredRuns.length === 0 ? (
        <div style={{ padding: 14, color: '#606477', fontSize: 13 }}>
          Brak uruchomień dla wybranych filtrów.
        </div>
      ) : null}
    </div>
  </section>
);
