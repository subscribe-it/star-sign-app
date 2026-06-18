import type React from 'react';

import {
  UiAlert,
  UiButton,
  UiSelect,
  UiTable,
  UiTbody,
  UiTd,
  UiTextInput,
  UiTh,
  UiThead,
  UiTr,
} from '../../components/ui';
import type { SocialPlatform, SocialTicket } from '../../types';

type OpsState = 'ready' | 'needs_action' | 'blocked' | 'degraded';

type SocialFiltersState = {
  platform: 'all' | SocialPlatform;
  status: 'all' | SocialTicket['status'];
  workflow: string;
};

type StatusPillProps = { status: string };

type SocialTabProps = {
  socialOpsState: OpsState;
  socialOpsMessage: string | null;
  socialFilters: SocialFiltersState;
  setSocialFilters: React.Dispatch<React.SetStateAction<SocialFiltersState>>;
  filteredSocialTickets: SocialTicket[];
  saving: boolean;
  cardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  primaryButtonStyle: React.CSSProperties;
  colors: { border: string };
  formatDateTime: (value?: string | null) => string;
  getWorkflowId: (value: unknown) => number | null;
  StatusPill: React.ComponentType<StatusPillProps>;
  Field: React.ComponentType<{ label: string; hint?: string; children: React.ReactNode }>;
  onRefresh: () => void;
  onRetryTicket: (ticketId: number) => void;
  onCancelTicket: (ticketId: number) => void;
};

export const SocialTab = ({
  socialOpsState,
  socialOpsMessage,
  socialFilters,
  setSocialFilters,
  filteredSocialTickets,
  saving,
  cardStyle,
  sectionTitleStyle,
  primaryButtonStyle,
  colors,
  formatDateTime,
  getWorkflowId,
  StatusPill,
  Field,
  onRefresh,
  onRetryTicket,
  onCancelTicket,
}: SocialTabProps): React.ReactNode => (
  <section style={cardStyle}>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
      }}
    >
      <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Zlecenia social media</h2>
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

    {socialOpsState !== 'ready' ? (
      <div style={{ marginBottom: 14 }}>
        <UiAlert
          tone={
            socialOpsState === 'blocked'
              ? 'danger'
              : socialOpsState === 'degraded'
                ? 'info'
                : 'warning'
          }
          title={`Status: ${socialOpsState}`}
        >
          {socialOpsMessage || 'Sprawdź RBAC i konfigurację endpointów social.'}
        </UiAlert>
      </div>
    ) : null}

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}
    >
      <Field label="Platforma">
        <UiSelect
          aria-label="Platforma"
          value={socialFilters.platform}
          onChange={(value) =>
            setSocialFilters((prev) => ({
              ...prev,
              platform: value as typeof socialFilters.platform,
            }))
          }
          options={[
            { value: 'all', label: 'Wszystkie' },
            { value: 'facebook', label: 'facebook' },
            { value: 'instagram', label: 'instagram' },
            { value: 'twitter', label: 'twitter' },
            { value: 'tiktok', label: 'tiktok (tylko szkic)' },
          ]}
        />
      </Field>
      <Field label="Status">
        <UiSelect
          aria-label="Status"
          value={socialFilters.status}
          onChange={(value) =>
            setSocialFilters((prev) => ({
              ...prev,
              status: value as typeof socialFilters.status,
            }))
          }
          options={[
            { value: 'all', label: 'Wszystkie' },
            { value: 'scheduled', label: 'scheduled' },
            { value: 'pending', label: 'pending' },
            { value: 'published', label: 'published' },
            { value: 'failed', label: 'failed' },
            { value: 'canceled', label: 'canceled' },
          ]}
        />
      </Field>
      <Field label="ID workflow">
        <UiTextInput
          value={socialFilters.workflow}
          onChange={(event) =>
            setSocialFilters((prev) => ({ ...prev, workflow: event.target.value }))
          }
          placeholder="np. 3"
        />
      </Field>
      <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
        <UiButton
          variant="secondary"
          onClick={() => setSocialFilters({ platform: 'all', status: 'all', workflow: '' })}
        >
          Wyczyść
        </UiButton>
      </div>
    </div>

    <div>
      <UiTable colCount={9} rowCount={filteredSocialTickets.length + 1} minWidth={1080}>
        <UiThead>
          <UiTr>
            <UiTh>ID</UiTh>
            <UiTh>Platforma</UiTh>
            <UiTh>Status</UiTh>
            <UiTh>Przepływ</UiTh>
            <UiTh>Zaplanowano</UiTh>
            <UiTh>Próba</UiTh>
            <UiTh>Kolejna próba</UiTh>
            <UiTh>Ostatni błąd</UiTh>
            <UiTh>Akcja</UiTh>
          </UiTr>
        </UiThead>
        <UiTbody>
          {filteredSocialTickets.map((ticket) => (
            <UiTr key={ticket.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
              <UiTd>#{ticket.id}</UiTd>
              <UiTd>{ticket.platform}</UiTd>
              <UiTd>
                <StatusPill status={ticket.status} />
              </UiTd>
              <UiTd>{getWorkflowId(ticket.workflow) ?? '-'}</UiTd>
              <UiTd>{formatDateTime(ticket.scheduled_at)}</UiTd>
              <UiTd>{ticket.attempt_count ?? 0}</UiTd>
              <UiTd>{ticket.next_attempt_at ? formatDateTime(ticket.next_attempt_at) : '-'}</UiTd>
              <UiTd>
                <div
                  style={{
                    maxWidth: 320,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {ticket.last_error || ticket.blocked_reason || '-'}
                </div>
              </UiTd>
              <UiTd>
                <div style={{ display: 'flex', gap: 8 }}>
                  <UiButton
                    variant="secondary"
                    size="S"
                    disabled={
                      saving || ticket.status === 'published' || ticket.status === 'canceled'
                    }
                    onClick={() => {
                      void onRetryTicket(ticket.id);
                    }}
                  >
                    Ponów
                  </UiButton>
                  <UiButton
                    variant="danger"
                    size="S"
                    disabled={
                      saving || ticket.status === 'published' || ticket.status === 'canceled'
                    }
                    onClick={() => {
                      void onCancelTicket(ticket.id);
                    }}
                  >
                    Anuluj
                  </UiButton>
                </div>
              </UiTd>
            </UiTr>
          ))}
        </UiTbody>
      </UiTable>
      {filteredSocialTickets.length === 0 ? (
        <div style={{ padding: 14, color: '#606477', fontSize: 13 }}>
          Brak zleceń social dla wybranych filtrów.
        </div>
      ) : null}
    </div>
  </section>
);
