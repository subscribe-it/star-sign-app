import type React from 'react';

import { UiTextInput } from '../../components/ui';
import type { SettingsPayload } from '../../types';

type FieldProps = { label: string; hint?: string; children: React.ReactNode };

type SettingsTabProps = {
  settings: SettingsPayload;
  setSettings: React.Dispatch<React.SetStateAction<SettingsPayload>>;
  saving: boolean;
  cardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  primaryButtonStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
  checkboxRowStyle: React.CSSProperties;
  colors: { primary: string; text: string; textLight: string; border: string };
  Field: React.ComponentType<FieldProps>;
  onSaveSettings: () => void;
};

export const SettingsTab = ({
  settings,
  setSettings,
  saving,
  cardStyle,
  sectionTitleStyle,
  primaryButtonStyle,
  inputStyle,
  checkboxRowStyle,
  colors,
  Field,
  onSaveSettings,
}: SettingsTabProps): React.ReactNode => (
  <section style={cardStyle}>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Ustawienia Systemowe</h2>
      <button
        type="button"
        disabled={saving}
        style={{ ...primaryButtonStyle, padding: '10px 24px' }}
        onClick={() => {
          void onSaveSettings();
        }}
      >
        {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
      </button>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
      <div style={{ display: 'grid', gap: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: colors.text, marginBottom: 4 }}>
          Konfiguracja Regionalna
        </h3>
        <Field
          label="Strefa czasowa (Timezone)"
          hint="Strefa używana do planowania publikacji i raportów (np. Europe/Warsaw)."
        >
          <UiTextInput
            value={settings.timezone}
            onChange={(event) => setSettings((prev) => ({ ...prev, timezone: event.target.value }))}
            placeholder="UTC / Europe/Warsaw"
          />
        </Field>
        <Field
          label="Lokalizacja (Locale)"
          hint="Język i format treści generowanych przez agenta (np. pl lub en)."
        >
          <UiTextInput
            value={settings.locale}
            onChange={(event) => setSettings((prev) => ({ ...prev, locale: event.target.value }))}
            placeholder="pl / en"
          />
        </Field>
        <label
          style={{
            ...checkboxRowStyle,
            padding: 14,
            background: settings.aico_auto_publish_enabled === false ? '#fffbeb' : '#f8fafc',
            border: `1px solid ${
              settings.aico_auto_publish_enabled === false ? '#fde68a' : colors.border
            }`,
            borderRadius: 12,
            alignItems: 'flex-start',
          }}
        >
          <input
            type="checkbox"
            checked={settings.aico_auto_publish_enabled !== false}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                aico_auto_publish_enabled: event.target.checked,
              }))
            }
          />
          <span>
            Globalny auto-publish AICO
            <span
              style={{
                display: 'block',
                marginTop: 4,
                fontSize: 12,
                color: colors.textLight,
                lineHeight: 1.5,
              }}
            >
              Wyłączenie zatrzymuje autonomiczne publikowanie treści AICO, ale nie blokuje dostępu
              do Premium.
            </span>
          </span>
        </label>
      </div>

      <div style={{ display: 'grid', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: colors.text, margin: 0 }}>
            Integracja Media Gen
          </h3>
          {settings.has_image_gen_token && settings.image_gen_model ? (
            <span
              style={{
                background: '#ecfdf5',
                color: '#059669',
                fontSize: 10,
                padding: '4px 10px',
                borderRadius: 20,
                border: '1px solid #10b981',
                fontWeight: 800,
                letterSpacing: '0.05em',
              }}
            >
              GOTOWY DO PRACY
            </span>
          ) : (
            <span
              style={{
                background: '#fff1f2',
                color: '#e11d48',
                fontSize: 10,
                padding: '4px 10px',
                borderRadius: 20,
                border: '1px solid #f43f5e',
                fontWeight: 800,
                letterSpacing: '0.05em',
              }}
            >
              WYMAGA KONFIGURACJI
            </span>
          )}
        </div>

        <Field
          label="Model AI do generowania grafik"
          hint="Identyfikator modelu używanego do autonomicznego tworzenia grafik (np. openai/gpt-image-2)."
        >
          <UiTextInput
            value={settings.image_gen_model}
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, image_gen_model: event.target.value }))
            }
            placeholder="openai/gpt-image-2"
          />
        </Field>

        <Field
          label={
            settings.has_image_gen_token
              ? 'Image API Token (zmień jeśli chcesz)'
              : 'Image API Token'
          }
        >
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              style={{ ...inputStyle, paddingRight: 40 }}
              value={settings.imageGenApiToken}
              placeholder={
                settings.has_image_gen_token ? '••••••••••••••••' : 'Wklej swój klucz...'
              }
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, imageGenApiToken: event.target.value }))
              }
            />
            {settings.has_image_gen_token && (
              <div
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#10b981',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            )}
          </div>
        </Field>

        <div
          style={{
            padding: '12px 16px',
            background: '#f1f5f9',
            borderRadius: 12,
            fontSize: 12,
            color: '#475569',
            lineHeight: 1.5,
            borderLeft: `4px solid ${colors.primary}`,
          }}
        >
          <strong>Wskazówka:</strong> Ten model zostanie użyty przez agenta do autonomicznego
          tworzenia grafik, gdy nie zostanie znalezione dopasowanie w bibliotece Media Catalog.
        </div>
      </div>
    </div>
  </section>
);
