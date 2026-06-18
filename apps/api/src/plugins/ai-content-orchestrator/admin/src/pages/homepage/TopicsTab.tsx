import type React from 'react';

import { UiButton, UiTable, UiTbody, UiTd, UiTh, UiThead, UiTr } from '../../components/ui';
import type { Topic, Workflow } from '../../types';

type StatusPillProps = { status: string };

type TopicsTabProps = {
  topics: Topic[];
  workflows: Workflow[];
  cardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  primaryButtonStyle: React.CSSProperties;
  colors: {
    primary: string;
    text: string;
    textLight: string;
    border: string;
  };
  formatDateTime: (value?: string | null) => string;
  StatusPill: React.ComponentType<StatusPillProps>;
  onAddTopic: () => void;
  onDeleteTopic: (id: number) => void;
};

// Tiny pure helper używany wyłącznie przez tę zakładkę (przeniesiony 1:1).
const getTopicWorkflowName = (topic: Topic, workflowList: Workflow[]): string => {
  if (!topic.workflow) return '-';
  const wf = workflowList.find((w) => w.id === topic.workflow);
  return wf ? wf.name : '-';
};

export const TopicsTab = ({
  topics,
  workflows,
  cardStyle,
  sectionTitleStyle,
  primaryButtonStyle,
  colors,
  formatDateTime,
  StatusPill,
  onAddTopic,
  onDeleteTopic,
}: TopicsTabProps): React.ReactNode => (
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
        <h2 style={{ ...sectionTitleStyle, marginBottom: 4 }}>Kolejka Tematów</h2>
        <p style={{ fontSize: 13, color: colors.textLight, margin: 0 }}>
          Zarządzaj ręcznymi tematami i planuj generowanie treści.
        </p>
      </div>
      <button type="button" onClick={onAddTopic} style={primaryButtonStyle}>
        + Nowy Temat
      </button>
    </div>

    <div>
      <UiTable colCount={7} rowCount={topics.length + 1}>
        <UiThead>
          <UiTr>
            <UiTh>ID</UiTh>
            <UiTh>Tytuł / Brief</UiTh>
            <UiTh>Workflow</UiTh>
            <UiTh>Status</UiTh>
            <UiTh>Planowany</UiTh>
            <UiTh>Grafika</UiTh>
            <UiTh style={{ textAlign: 'right' }}>Akcje</UiTh>
          </UiTr>
        </UiThead>
        <UiTbody>
          {topics.map((topic) => (
            <UiTr key={topic.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
              <UiTd>
                <span style={{ color: colors.textLight, fontWeight: 700 }}>#{topic.id}</span>
              </UiTd>
              <UiTd>
                <div style={{ fontWeight: 700, color: colors.text, marginBottom: 2 }}>
                  {topic.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: colors.textLight,
                    maxWidth: 300,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {topic.brief}
                </div>
              </UiTd>
              <UiTd>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {getTopicWorkflowName(topic, workflows)}
                </span>
              </UiTd>
              <UiTd>
                <StatusPill status={topic.status} />
              </UiTd>
              <UiTd>
                <div style={{ fontSize: 11, color: colors.textLight }}>
                  {topic.scheduled_for ? formatDateTime(topic.scheduled_for) : '-'}
                </div>
              </UiTd>
              <UiTd>
                {topic.image_asset_key ? (
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 6px',
                      background: '#eef2ff',
                      borderRadius: 4,
                      color: colors.primary,
                      fontWeight: 600,
                    }}
                  >
                    {topic.image_asset_key}
                  </span>
                ) : (
                  '-'
                )}
              </UiTd>
              <UiTd>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <UiButton variant="danger" size="S" onClick={() => void onDeleteTopic(topic.id)}>
                    Usuń
                  </UiButton>
                </div>
              </UiTd>
            </UiTr>
          ))}
        </UiTbody>
      </UiTable>
      {topics.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: colors.textLight }}>
          Brak tematów w kolejce.
        </div>
      )}
    </div>
  </section>
);
