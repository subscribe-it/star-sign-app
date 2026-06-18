import * as React from 'react';

import {
  UiBadge,
  UiButton,
  UiCheckbox,
  UiEmptyState,
  UiField,
  UiLoader,
  UiSelect,
  UiTable,
  UiTbody,
  UiTd,
  UiTextField,
  UiTextareaField,
  UiTextInput,
  UiTh,
  UiThead,
  UiTr,
} from '../../components/ui';
import type { UiTone } from '../../components/ui';
import type { VideoAsset } from '../../types';

// — Kontrakt propsów ————————————————————————————————————————————————————————
// Ładunek zlecenia generacji wideo budowany lokalnie z formularza i przekazywany
// w górę przez onCreateJob. HomePage importuje ten typ, dlatego eksportujemy go.
export type VideoJobPayload = {
  title?: string;
  script?: string;
  subject?: {
    kind: 'zodiac' | 'tarot' | 'horoscope' | 'custom';
    title?: string;
    sign?: string;
    card?: string;
    period?: string;
    sourceText?: string;
  };
  durationSeconds?: number;
  dryRun?: boolean;
};

export interface VideoTabProps {
  assets: VideoAsset[];
  loading: boolean;
  creating: boolean; // create-job request in flight
  busyAssetId: number | null; // asset id whose render/publish is in flight
  onRefresh: () => void;
  onCreateJob: (payload: VideoJobPayload) => void;
  onRender: (id: number) => void;
  onPublish: (id: number) => void;
  cardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  colors: Record<string, string>;
}

// — Stan lokalny formularza ————————————————————————————————————————————————
type VideoSubjectKind = NonNullable<VideoJobPayload['subject']>['kind'];

type VideoFormState = {
  kind: VideoSubjectKind;
  title: string;
  sign: string;
  card: string;
  period: string;
  sourceText: string;
  durationSeconds: string;
  dryRun: boolean;
};

const INITIAL_FORM: VideoFormState = {
  kind: 'zodiac',
  title: '',
  sign: '',
  card: '',
  period: '',
  sourceText: '',
  durationSeconds: '',
  dryRun: false,
};

const KIND_OPTIONS: { value: VideoSubjectKind; label: string }[] = [
  { value: 'zodiac', label: 'Znak zodiaku' },
  { value: 'tarot', label: 'Tarot' },
  { value: 'horoscope', label: 'Horoskop' },
  { value: 'custom', label: 'Własny' },
];

// Mapowanie statusu zasobu wideo na ton odznaki/statusu (dostępne kolory DS).
const STATUS_TONE_MAP: Record<string, UiTone> = {
  published: 'success',
  ready: 'success',
  done: 'success',
  completed: 'success',
  rendering: 'info',
  processing: 'info',
  queued: 'info',
  pending: 'warning',
  draft: 'warning',
  blocked: 'danger',
  failed: 'danger',
  error: 'danger',
};

const statusTone = (status: string): UiTone => STATUS_TONE_MAP[status.toLowerCase()] ?? 'neutral';

const trim = (value: string): string => value.trim();

export const VideoTab = ({
  assets,
  loading,
  creating,
  busyAssetId,
  onRefresh,
  onCreateJob,
  onRender,
  onPublish,
  cardStyle,
  sectionTitleStyle,
  colors,
}: VideoTabProps): React.ReactNode => {
  const [form, setForm] = React.useState<VideoFormState>(INITIAL_FORM);

  const border = colors.border ?? '#e2e8f0';
  const textLight = colors.textLight ?? '#64748b';

  const handleCreate = (): void => {
    // Budujemy subject z wybranego rodzaju + odpowiedniego pola. Puste pola pomijamy.
    const subject: NonNullable<VideoJobPayload['subject']> = { kind: form.kind };

    const title = trim(form.title);
    if (title) {
      subject.title = title;
    }

    if (form.kind === 'zodiac') {
      const sign = trim(form.sign);
      if (sign) {
        subject.sign = sign;
      }
    } else if (form.kind === 'tarot') {
      const card = trim(form.card);
      if (card) {
        subject.card = card;
      }
    } else if (form.kind === 'horoscope') {
      const period = trim(form.period);
      if (period) {
        subject.period = period;
      }
    } else {
      const sourceText = trim(form.sourceText);
      if (sourceText) {
        subject.sourceText = sourceText;
      }
    }

    const payload: VideoJobPayload = { subject };

    if (title) {
      payload.title = title;
    }

    const parsedDuration = Number(trim(form.durationSeconds));
    if (form.durationSeconds.trim() !== '' && Number.isFinite(parsedDuration)) {
      payload.durationSeconds = parsedDuration;
    }

    if (form.dryRun) {
      payload.dryRun = true;
    }

    onCreateJob(payload);
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={cardStyle}>
        <h2 style={{ ...sectionTitleStyle, marginBottom: 4 }}>Generuj wideo</h2>
        <p style={{ color: textLight, marginBottom: 16, fontSize: 14 }}>
          Zbuduj zlecenie generacji wideo. Wybierz temat, dodaj tytuł i czas trwania, a następnie
          uruchom generację. Tryb próbny pozwala sprawdzić zlecenie bez zużywania limitów.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            background: '#f8fafc',
            padding: 20,
            borderRadius: 12,
            border: `1px solid ${border}`,
            marginBottom: 16,
          }}
        >
          <UiField label="Rodzaj tematu">
            <UiSelect
              aria-label="Rodzaj tematu"
              value={form.kind}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, kind: value as VideoSubjectKind }))
              }
              options={KIND_OPTIONS}
            />
          </UiField>

          {form.kind === 'zodiac' ? (
            <UiTextField
              label="Znak zodiaku"
              value={form.sign}
              onChange={(event) => setForm((prev) => ({ ...prev, sign: event.target.value }))}
              placeholder="np. Baran"
            />
          ) : null}

          {form.kind === 'tarot' ? (
            <UiTextField
              label="Karta tarota"
              value={form.card}
              onChange={(event) => setForm((prev) => ({ ...prev, card: event.target.value }))}
              placeholder="np. Mag"
            />
          ) : null}

          {form.kind === 'horoscope' ? (
            <UiTextField
              label="Okres"
              value={form.period}
              onChange={(event) => setForm((prev) => ({ ...prev, period: event.target.value }))}
              placeholder="np. dzienny"
            />
          ) : null}

          <UiTextField
            label="Tytuł"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Tytuł wideo"
          />

          <UiField label="Czas trwania (s)">
            <UiTextInput
              type="number"
              value={form.durationSeconds}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, durationSeconds: event.target.value }))
              }
              placeholder="np. 30"
            />
          </UiField>
        </div>

        {form.kind === 'custom' ? (
          <div style={{ marginBottom: 16 }}>
            <UiTextareaField
              label="Własny tekst źródłowy"
              value={form.sourceText}
              onChange={(event) => setForm((prev) => ({ ...prev, sourceText: event.target.value }))}
              placeholder="Wklej tekst, na podstawie którego powstanie wideo…"
            />
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <UiCheckbox
            checked={form.dryRun}
            onChange={(checked) => setForm((prev) => ({ ...prev, dryRun: checked }))}
          >
            Tryb próbny (dry run)
          </UiCheckbox>
          <UiButton variant="primary" loading={creating} disabled={creating} onClick={handleCreate}>
            {creating ? 'Generuję…' : 'Generuj'}
          </UiButton>
        </div>
      </section>

      <section style={cardStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Zasoby wideo</h2>
          <UiButton
            variant="primary"
            disabled={loading}
            loading={loading}
            onClick={() => onRefresh()}
          >
            Odśwież
          </UiButton>
        </div>

        {loading ? (
          <UiLoader>Ładowanie zasobów wideo…</UiLoader>
        ) : assets.length === 0 ? (
          <UiEmptyState
            title="Brak zasobów wideo"
            description="Brak zasobów wideo. Wygeneruj pierwsze powyżej."
          />
        ) : (
          <UiTable colCount={6} rowCount={assets.length + 1} minWidth={920}>
            <UiThead>
              <UiTr>
                <UiTh>ID</UiTh>
                <UiTh>Tytuł</UiTh>
                <UiTh>Status</UiTh>
                <UiTh>Długość</UiTh>
                <UiTh>Problem</UiTh>
                <UiTh>Akcje</UiTh>
              </UiTr>
            </UiThead>
            <UiTbody>
              {assets.map((asset) => {
                const busy = busyAssetId === asset.id;
                const problem = asset.blocked_reason || asset.last_error || '—';
                return (
                  <UiTr key={asset.id} style={{ borderBottom: `1px solid ${border}` }}>
                    <UiTd>#{asset.id}</UiTd>
                    <UiTd>{asset.title}</UiTd>
                    <UiTd>
                      <UiBadge tone={statusTone(asset.status)}>{asset.status}</UiBadge>
                    </UiTd>
                    <UiTd>
                      {typeof asset.duration_seconds === 'number'
                        ? `${asset.duration_seconds}s`
                        : '—'}
                    </UiTd>
                    <UiTd>
                      <div
                        style={{
                          maxWidth: 280,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={problem}
                      >
                        {problem}
                      </div>
                    </UiTd>
                    <UiTd>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <UiButton
                          variant="secondary"
                          size="S"
                          disabled={busy}
                          loading={busy}
                          onClick={() => onRender(asset.id)}
                        >
                          Render
                        </UiButton>
                        <UiButton
                          variant="primary"
                          size="S"
                          disabled={busy}
                          loading={busy}
                          onClick={() => onPublish(asset.id)}
                        >
                          Publikuj
                        </UiButton>
                      </div>
                    </UiTd>
                  </UiTr>
                );
              })}
            </UiTbody>
          </UiTable>
        )}
      </section>
    </div>
  );
};

export default VideoTab;
