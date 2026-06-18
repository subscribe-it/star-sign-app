import type React from 'react';

import { UiAlert, UiButton, UiTextInput } from '../../components/ui';
import type { SocialConnectionResult, SocialDryRunResult, SocialPlatform } from '../../types';

type WorkflowSocialForm = {
  enabled_channels: SocialPlatform[];
  fb_page_id: string;
  fbAccessToken: string;
  ig_user_id: string;
  igAccessToken: string;
  x_api_key: string;
  xApiSecret: string;
  xAccessToken: string;
  xAccessTokenSecret: string;
};

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

type WorkflowSocialStepProps = {
  workflowForm: WorkflowSocialForm;
  editingWorkflowId: number | null;
  saving: boolean;
  socialConnectionResult: SocialConnectionResult | null;
  socialDryRunResult: SocialDryRunResult | null;
  validationIssues: string[];
  checkboxRowStyle: React.CSSProperties;
  textColor: string;
  textLightColor: string;
  borderColor: string;
  Field: React.ComponentType<FieldProps>;
  onWorkflowFormChange: (next: Partial<WorkflowSocialForm>) => void;
  onTestConnection: () => void;
  onDryRun: () => void;
};

export const WorkflowSocialStep = ({
  workflowForm,
  editingWorkflowId,
  saving,
  socialConnectionResult,
  socialDryRunResult,
  validationIssues,
  checkboxRowStyle,
  textColor,
  textLightColor,
  borderColor,
  Field,
  onWorkflowFormChange,
  onTestConnection,
  onDryRun,
}: WorkflowSocialStepProps): React.ReactNode => (
  <div style={{ display: 'grid', gap: 20 }}>
    {validationIssues.length > 0 ? (
      <UiAlert tone="danger" title="Uzupełnij konfigurację social przed przejściem dalej:">
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            fontSize: 12,
            display: 'grid',
            gap: 4,
          }}
        >
          {validationIssues.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </UiAlert>
    ) : null}

    <div style={{ display: 'grid', gap: 10 }}>
      <div
        style={{ fontSize: 12, color: textLightColor, fontWeight: 700, textTransform: 'uppercase' }}
      >
        Aktywne kanały
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {(['facebook', 'instagram', 'twitter', 'tiktok'] as SocialPlatform[]).map((channel) => (
          <label key={channel} style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={workflowForm.enabled_channels.includes(channel)}
              onChange={(event) => {
                const next = new Set(workflowForm.enabled_channels);
                if (event.target.checked) {
                  next.add(channel);
                } else {
                  next.delete(channel);
                }
                onWorkflowFormChange({
                  enabled_channels: Array.from(next) as SocialPlatform[],
                });
              }}
            />
            {channel}
            {channel === 'tiktok' ? ' (draft-only)' : ''}
          </label>
        ))}
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <Field label="Facebook Page ID">
        <UiTextInput
          value={workflowForm.fb_page_id}
          onChange={(event) =>
            onWorkflowFormChange({
              fb_page_id: event.target.value,
            })
          }
        />
      </Field>
      <Field
        label={editingWorkflowId ? 'FB Page Access Token (opcjonalnie)' : 'FB Page Access Token'}
      >
        <UiTextInput
          type="password"
          value={workflowForm.fbAccessToken}
          onChange={(event) =>
            onWorkflowFormChange({
              fbAccessToken: event.target.value,
            })
          }
        />
      </Field>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <Field label="Instagram User ID">
        <UiTextInput
          value={workflowForm.ig_user_id}
          onChange={(event) =>
            onWorkflowFormChange({
              ig_user_id: event.target.value,
            })
          }
        />
      </Field>
      <Field label={editingWorkflowId ? 'IG Access Token (opcjonalnie)' : 'IG Access Token'}>
        <UiTextInput
          type="password"
          value={workflowForm.igAccessToken}
          onChange={(event) =>
            onWorkflowFormChange({
              igAccessToken: event.target.value,
            })
          }
        />
      </Field>
    </div>

    <div
      style={{
        padding: 16,
        background: '#fdf2f8',
        borderRadius: 12,
        border: '1px solid #fbcfe8',
        marginTop: 8,
      }}
    >
      <h4 style={{ fontSize: 14, fontWeight: 700, color: '#9d174d', marginBottom: 8 }}>
        X (OAuth 1.0a user context)
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Field label="X API Key">
          <UiTextInput
            value={workflowForm.x_api_key}
            onChange={(event) =>
              onWorkflowFormChange({
                x_api_key: event.target.value,
              })
            }
          />
        </Field>
        <Field label={editingWorkflowId ? 'X API Secret (opcjonalnie)' : 'X API Secret'}>
          <UiTextInput
            type="password"
            value={workflowForm.xApiSecret}
            onChange={(event) =>
              onWorkflowFormChange({
                xApiSecret: event.target.value,
              })
            }
          />
        </Field>
        <Field label={editingWorkflowId ? 'X Access Token (opcjonalnie)' : 'X Access Token'}>
          <UiTextInput
            type="password"
            value={workflowForm.xAccessToken}
            onChange={(event) =>
              onWorkflowFormChange({
                xAccessToken: event.target.value,
              })
            }
          />
        </Field>
        <Field
          label={
            editingWorkflowId ? 'X Access Token Secret (opcjonalnie)' : 'X Access Token Secret'
          }
        >
          <UiTextInput
            type="password"
            value={workflowForm.xAccessTokenSecret}
            onChange={(event) =>
              onWorkflowFormChange({
                xAccessTokenSecret: event.target.value,
              })
            }
          />
        </Field>
      </div>
    </div>

    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <UiButton variant="secondary" disabled={saving} onClick={onTestConnection}>
        Test Connection
      </UiButton>
      <UiButton variant="secondary" disabled={saving} onClick={onDryRun}>
        Dry Run Publish
      </UiButton>
    </div>

    {socialConnectionResult && (
      <div
        style={{
          padding: 14,
          borderRadius: 10,
          background: '#f8fafc',
          border: `1px solid ${borderColor}`,
          display: 'grid',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700 }}>
          Connection Status:{' '}
          <span
            style={{ color: socialConnectionResult.overall === 'ready' ? '#16a34a' : '#dc2626' }}
          >
            {socialConnectionResult.overall}
          </span>
        </div>
        {socialConnectionResult.channels.map((item) => (
          <div key={item.platform} style={{ fontSize: 12, color: textColor }}>
            <strong>{item.platform}</strong>: {item.status} - {item.message}
          </div>
        ))}
      </div>
    )}

    {socialDryRunResult && (
      <div
        style={{
          padding: 14,
          borderRadius: 10,
          background: '#fff7ed',
          border: '1px solid #fed7aa',
          display: 'grid',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700 }}>
          Dry Run Result:{' '}
          <span style={{ color: socialDryRunResult.overall === 'ready' ? '#16a34a' : '#c2410c' }}>
            {socialDryRunResult.overall}
          </span>
        </div>
        {socialDryRunResult.channels.map((item) => (
          <div key={item.platform} style={{ fontSize: 12, color: textColor }}>
            <strong>{item.platform}</strong>: {item.status} - {item.message}
          </div>
        ))}
      </div>
    )}
  </div>
);
