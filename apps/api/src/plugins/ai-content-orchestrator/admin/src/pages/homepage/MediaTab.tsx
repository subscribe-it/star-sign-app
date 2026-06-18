import type React from 'react';

import {
  UiBadge,
  UiButton,
  UiField,
  UiLoader,
  UiSelect,
  UiTable,
  UiTbody,
  UiTd,
  UiTextField,
  UiTh,
  UiThead,
  UiTr,
} from '../../components/ui';
import type {
  MediaBulkUpsertResult,
  MediaLibraryFile,
  MediaLibraryListResult,
  MediaUsage,
} from '../../types';

type MediaAssetFormState = {
  asset_key: string;
  label: string;
  purpose: 'horoscope_sign' | 'daily_card' | 'blog_article' | 'fallback_general';
  sign_slug: string;
  period_scope: 'any' | 'daily' | 'weekly' | 'monthly';
  keywords: string;
  priority: number;
  active: boolean;
  cooldown_days: number;
  notes: string;
};

type MediaFiltersState = {
  page: number;
  pageSize: number;
  search: string;
  mapped: 'all' | 'mapped' | 'unmapped';
  purpose: 'all' | 'horoscope_sign' | 'daily_card' | 'blog_article' | 'fallback_general';
  sign: string;
  active: 'all' | 'active' | 'inactive';
  sort: 'createdAtDesc' | 'createdAtAsc' | 'nameAsc' | 'nameDesc';
};

type MediaTabProps = {
  backfillingImages: 'article' | 'tarot' | 'zodiac' | null;
  saving: boolean;
  mediaFilters: MediaFiltersState;
  setMediaFilters: React.Dispatch<React.SetStateAction<MediaFiltersState>>;
  signOptions: string[];
  mediaLibrary: MediaLibraryFile[];
  mediaLibraryLoading: boolean;
  mediaLibraryPagination: MediaLibraryListResult['pagination'];
  bulkSelectedFileIds: number[];
  selectedMediaFileId: number | null;
  selectedMediaFile: MediaLibraryFile | null;
  generatedMediaIdentity: { asset_key: string; label: string };
  mediaAssetForm: MediaAssetFormState;
  setMediaAssetForm: React.Dispatch<React.SetStateAction<MediaAssetFormState>>;
  bulkPreview: MediaBulkUpsertResult | null;
  mediaUsage: MediaUsage[];
  cardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  colors: {
    primary: string;
    primaryLight: string;
    secondary: string;
    danger: string;
    text: string;
    textLight: string;
    border: string;
  };
  onBackfillImages: (kind: 'article' | 'tarot' | 'zodiac') => void;
  onValidateCoverage: () => void;
  onRefreshMediaGrid: () => void;
  onFilterMediaLibrary: () => void;
  onPickMediaFile: (item: MediaLibraryFile) => void;
  onToggleBulkSelection: (fileId: number) => void;
  onGoToMediaPage: (page: number) => void;
  onSaveMediaMapping: () => void;
  onDeleteMediaMapping: (mappingId: number) => void;
  onPreviewBulkMapping: () => void;
  onApplyBulkMapping: () => void;
};

export const MediaTab = ({
  backfillingImages,
  saving,
  mediaFilters,
  setMediaFilters,
  signOptions,
  mediaLibrary,
  mediaLibraryLoading,
  mediaLibraryPagination,
  bulkSelectedFileIds,
  selectedMediaFileId,
  selectedMediaFile,
  generatedMediaIdentity,
  mediaAssetForm,
  setMediaAssetForm,
  bulkPreview,
  mediaUsage,
  cardStyle,
  sectionTitleStyle,
  colors,
  onBackfillImages,
  onValidateCoverage,
  onRefreshMediaGrid,
  onFilterMediaLibrary,
  onPickMediaFile,
  onToggleBulkSelection,
  onGoToMediaPage,
  onSaveMediaMapping,
  onDeleteMediaMapping,
  onPreviewBulkMapping,
  onApplyBulkMapping,
}: MediaTabProps): React.ReactNode => (
  <div style={{ display: 'grid', gap: 24 }}>
    <section style={cardStyle}>
      <h2 style={{ ...sectionTitleStyle, marginBottom: 4 }}>Uzupełnij brakujące zdjęcia</h2>
      <p style={{ color: colors.textLight, marginBottom: 16, fontSize: 14 }}>
        Dla treści bez przypisanego zdjęcia spróbujemy dobrać lub wygenerować obraz. Może to potrwać
        i zużywać limity generacji obrazów.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <UiButton
          variant="primary"
          disabled={backfillingImages !== null}
          loading={backfillingImages === 'article'}
          onClick={() => onBackfillImages('article')}
        >
          {backfillingImages === 'article' ? 'Uzupełniam…' : 'Artykuły'}
        </UiButton>
        <UiButton
          variant="primary"
          disabled={backfillingImages !== null}
          loading={backfillingImages === 'tarot'}
          onClick={() => onBackfillImages('tarot')}
        >
          {backfillingImages === 'tarot' ? 'Uzupełniam…' : 'Karty tarota'}
        </UiButton>
        <UiButton
          variant="primary"
          disabled={backfillingImages !== null}
          loading={backfillingImages === 'zodiac'}
          onClick={() => onBackfillImages('zodiac')}
        >
          {backfillingImages === 'zodiac' ? 'Uzupełniam…' : 'Znaki zodiaku'}
        </UiButton>
      </div>
    </section>

    <section style={cardStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Katalog Mediów</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <UiButton variant="secondary" disabled={saving} onClick={onValidateCoverage}>
            Waliduj pokrycie
          </UiButton>
          <UiButton
            variant="primary"
            disabled={mediaLibraryLoading}
            loading={mediaLibraryLoading}
            onClick={onRefreshMediaGrid}
          >
            Odśwież siatkę
          </UiButton>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          background: '#f8fafc',
          padding: 20,
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          marginBottom: 24,
        }}
      >
        <UiTextField
          label="Szukaj"
          value={mediaFilters.search}
          onChange={(event) => setMediaFilters((prev) => ({ ...prev, search: event.target.value }))}
          placeholder="Nazwa / Klucz / Etykieta"
        />
        <UiField label="Mapowanie">
          <UiSelect
            aria-label="Mapowanie"
            value={mediaFilters.mapped}
            onChange={(value) =>
              setMediaFilters((prev) => ({
                ...prev,
                mapped: value as MediaFiltersState['mapped'],
              }))
            }
            options={[
              { value: 'all', label: 'Wszystkie' },
              { value: 'mapped', label: 'Zmapowane' },
              { value: 'unmapped', label: 'Niezmapowane' },
            ]}
          />
        </UiField>
        <UiField label="Przeznaczenie">
          <UiSelect
            aria-label="Przeznaczenie"
            value={mediaFilters.purpose}
            onChange={(value) =>
              setMediaFilters((prev) => ({
                ...prev,
                purpose: value as MediaFiltersState['purpose'],
              }))
            }
            options={[
              { value: 'all', label: 'Wszystkie' },
              { value: 'blog_article', label: 'Artykuł' },
              { value: 'daily_card', label: 'Karta dnia' },
              { value: 'horoscope_sign', label: 'Znak zodiaku' },
              { value: 'fallback_general', label: 'Ogólne' },
            ]}
          />
        </UiField>
        <UiField label="Znak zodiaku">
          <UiSelect
            aria-label="Znak zodiaku"
            value={mediaFilters.sign}
            onChange={(value) => setMediaFilters((prev) => ({ ...prev, sign: String(value) }))}
            options={signOptions.map((item) => ({ value: item, label: item }))}
          />
        </UiField>
        <div style={{ display: 'flex', alignItems: 'end' }}>
          <UiButton
            variant="primary"
            fullWidth
            onClick={onFilterMediaLibrary}
            disabled={mediaLibraryLoading}
          >
            Filtruj
          </UiButton>
        </div>
      </div>

      {mediaLibrary.length === 0 && !mediaLibraryLoading ? (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            background: '#f8fafc',
            borderRadius: 12,
            border: `1px dashed ${colors.border}`,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 16 }}>🖼️</div>
          <h3 style={{ fontWeight: 700, color: colors.text }}>Brak plików w bibliotece</h3>
          <p style={{ color: colors.textLight, fontSize: 14, marginTop: 8 }}>
            Dodaj obrazy w panelu Media Library, a następnie wróć tutaj i kliknij "Odśwież siatkę".
          </p>
          <a
            href="/admin/plugins/upload"
            style={{
              display: 'inline-block',
              marginTop: 16,
              color: colors.primary,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Idź do Media Library →
          </a>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 13, color: colors.textLight }}>
                Znaleziono: <strong>{mediaLibraryPagination.total}</strong> plików
              </span>
              {bulkSelectedFileIds.length > 0 && (
                <UiBadge tone="info" size="S">
                  Zaznaczono: {bulkSelectedFileIds.length}
                </UiBadge>
              )}
            </div>

            {mediaLibraryLoading ? <UiLoader small>Ładowanie plików…</UiLoader> : null}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 12,
                maxHeight: 600,
                overflowY: 'auto',
                paddingRight: 8,
              }}
            >
              {mediaLibrary.map((item) => {
                const isSelected = selectedMediaFileId === item.id;
                const isBulkSelected = bulkSelectedFileIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => onPickMediaFile(item)}
                    style={{
                      border: isSelected
                        ? `2px solid ${colors.primary}`
                        : `1px solid ${colors.border}`,
                      borderRadius: 12,
                      padding: 8,
                      background: isSelected ? colors.primaryLight : '#fff',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 12,
                        left: 12,
                        zIndex: 1,
                        background: '#fff',
                        borderRadius: 4,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isBulkSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => onToggleBulkSelection(item.id)}
                        style={{ width: 16, height: 16 }}
                      />
                    </div>
                    {item.url ? (
                      <img
                        src={item.url}
                        alt=""
                        style={{
                          width: '100%',
                          height: 100,
                          objectFit: 'cover',
                          borderRadius: 8,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: 100,
                          background: '#f1f5f9',
                          borderRadius: 8,
                        }}
                      />
                    )}
                    <div style={{ marginTop: 8 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: colors.text,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.name}
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        <span
                          style={{
                            fontSize: 9,
                            background: item.mapping ? '#dcfce7' : '#f1f5f9',
                            color: item.mapping ? '#16a34a' : '#475569',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontWeight: 800,
                          }}
                        >
                          {item.mapping ? 'MAPPED' : 'NEW'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
              <UiButton
                variant="secondary"
                disabled={mediaLibraryPagination.page <= 1 || mediaLibraryLoading}
                onClick={() => onGoToMediaPage(mediaLibraryPagination.page - 1)}
              >
                ← Poprzednia
              </UiButton>
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>
                {mediaLibraryPagination.page} / {mediaLibraryPagination.pageCount}
              </span>
              <UiButton
                variant="secondary"
                disabled={
                  mediaLibraryPagination.page >= mediaLibraryPagination.pageCount ||
                  mediaLibraryLoading
                }
                onClick={() => onGoToMediaPage(mediaLibraryPagination.page + 1)}
              >
                Następna →
              </UiButton>
            </div>
          </div>

          <div style={{ borderLeft: `1px solid ${colors.border}`, paddingLeft: 24 }}>
            {selectedMediaFile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div
                  style={{
                    background: '#f8fafc',
                    padding: 16,
                    borderRadius: 12,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <h3
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: colors.text,
                      marginBottom: 12,
                    }}
                  >
                    Wybrany plik
                  </h3>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    {selectedMediaFile.url ? (
                      <img
                        src={selectedMediaFile.url}
                        alt=""
                        style={{
                          width: 80,
                          height: 80,
                          objectFit: 'cover',
                          borderRadius: 8,
                          border: `1px solid ${colors.border}`,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 80,
                          height: 80,
                          background: '#f1f5f9',
                          borderRadius: 8,
                        }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: colors.text }}>
                        {selectedMediaFile.name}
                      </div>
                      <div style={{ fontSize: 11, color: colors.textLight, marginTop: 4 }}>
                        ID: #{selectedMediaFile.id}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <UiTextField
                      label="Klucz zasobu"
                      value={generatedMediaIdentity.asset_key}
                      disabled
                    />
                    <UiTextField label="Etykieta" value={generatedMediaIdentity.label} disabled />
                  </div>

                  <UiField label="Przeznaczenie">
                    <UiSelect
                      aria-label="Przeznaczenie"
                      value={mediaAssetForm.purpose}
                      onChange={(value) => {
                        const purpose = value as MediaAssetFormState['purpose'];
                        const fallbackSign =
                          purpose === 'horoscope_sign'
                            ? mediaAssetForm.sign_slug.trim() ||
                              selectedMediaFile.mapping?.sign_slug?.trim() ||
                              selectedMediaFile.suggestion.sign_slug ||
                              ''
                            : mediaAssetForm.sign_slug;
                        setMediaAssetForm((prev) => ({
                          ...prev,
                          purpose,
                          sign_slug: fallbackSign,
                        }));
                      }}
                      options={[
                        { value: 'blog_article', label: 'Artykuł blogowy' },
                        { value: 'daily_card', label: 'Karta dnia' },
                        { value: 'horoscope_sign', label: 'Znak zodiaku' },
                        { value: 'fallback_general', label: 'Ogólny (zapasowy)' },
                      ]}
                    />
                  </UiField>

                  {mediaAssetForm.purpose === 'horoscope_sign' && (
                    <UiField label="Znak zodiaku">
                      <UiSelect
                        aria-label="Znak zodiaku"
                        value={mediaAssetForm.sign_slug}
                        onChange={(value) =>
                          setMediaAssetForm((prev) => ({
                            ...prev,
                            sign_slug: String(value),
                          }))
                        }
                        placeholder="Wybierz znak..."
                        options={signOptions
                          .filter((s) => s !== 'all')
                          .map((item) => ({
                            value: item.toLowerCase(),
                            label: item,
                          }))}
                      />
                    </UiField>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <UiField label="Zasięg czasowy">
                      <UiSelect
                        aria-label="Zasięg czasowy"
                        value={mediaAssetForm.period_scope}
                        onChange={(value) =>
                          setMediaAssetForm((prev) => ({
                            ...prev,
                            period_scope: value as MediaAssetFormState['period_scope'],
                          }))
                        }
                        options={[
                          { value: 'any', label: 'Dowolny' },
                          { value: 'daily', label: 'Dzienny' },
                          { value: 'weekly', label: 'Tygodniowy' },
                          { value: 'monthly', label: 'Miesięczny' },
                        ]}
                      />
                    </UiField>
                    <UiTextField
                      label="Priorytet"
                      type="number"
                      value={String(mediaAssetForm.priority)}
                      onChange={(event) =>
                        setMediaAssetForm((prev) => ({
                          ...prev,
                          priority: Number(event.target.value),
                        }))
                      }
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <UiButton
                      variant="primary"
                      fullWidth
                      disabled={saving}
                      loading={saving}
                      onClick={onSaveMediaMapping}
                    >
                      {saving ? 'Zapisywanie...' : 'Zapisz mapowanie'}
                    </UiButton>
                    {selectedMediaFile.mapping && (
                      <UiButton
                        variant="danger"
                        disabled={saving}
                        onClick={() => {
                          const mappingId = selectedMediaFile.mapping?.id;
                          if (typeof mappingId === 'number') {
                            onDeleteMediaMapping(mappingId);
                          }
                        }}
                      >
                        Usuń
                      </UiButton>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: colors.textLight,
                  textAlign: 'center',
                  padding: 40,
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 16 }}>👈</div>
                <h3 style={{ fontWeight: 600 }}>Wybierz plik</h3>
                <p style={{ fontSize: 13, marginTop: 8 }}>
                  Kliknij w kafel po lewej stronie, aby edytować mapowanie.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>

    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Operacje Masowe (Bulk)</h2>
      <div
        style={{
          background: '#f8fafc',
          padding: 20,
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <UiButton
            variant="secondary"
            disabled={saving || bulkSelectedFileIds.length === 0}
            onClick={onPreviewBulkMapping}
          >
            Podgląd zmian ({bulkSelectedFileIds.length})
          </UiButton>
          <UiButton
            variant="primary"
            disabled={saving || bulkSelectedFileIds.length === 0}
            onClick={onApplyBulkMapping}
          >
            Zastosuj mapowanie masowe
          </UiButton>
        </div>

        {bulkPreview && (
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  background: '#fff',
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: colors.textLight,
                    textTransform: 'uppercase',
                  }}
                >
                  Suma
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{bulkPreview.summary.total}</div>
              </div>
              <div
                style={{
                  background: '#fff',
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: colors.textLight,
                    textTransform: 'uppercase',
                  }}
                >
                  Nowe
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: colors.secondary }}>
                  {bulkPreview.summary.previewCreate}
                </div>
              </div>
              <div
                style={{
                  background: '#fff',
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: colors.textLight,
                    textTransform: 'uppercase',
                  }}
                >
                  Błędy
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: colors.danger }}>
                  {bulkPreview.summary.errors}
                </div>
              </div>
            </div>
            <div
              style={{
                maxHeight: 300,
                overflowY: 'auto',
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
              }}
            >
              <UiTable colCount={4} rowCount={bulkPreview.items.length + 1}>
                <UiThead>
                  <UiTr
                    style={{
                      background: '#f1f5f9',
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    <UiTh>Plik</UiTh>
                    <UiTh>Akcja</UiTh>
                    <UiTh>Klucz</UiTh>
                    <UiTh>Status</UiTh>
                  </UiTr>
                </UiThead>
                <UiTbody>
                  {bulkPreview.items.map((row, i) => (
                    <UiTr key={i} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <UiTd>#{String(row.fileId ?? '')}</UiTd>
                      <UiTd>{String(row.action ?? '')}</UiTd>
                      <UiTd>{String(row.asset_key ?? '')}</UiTd>
                      <UiTd>{String(row.status ?? '')}</UiTd>
                    </UiTr>
                  ))}
                </UiTbody>
              </UiTable>
            </div>
          </div>
        )}
      </div>
    </section>

    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Ostatnie użycie mediów</h2>
      <div
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <UiTable colCount={5} rowCount={(mediaUsage.length === 0 ? 1 : mediaUsage.length) + 1}>
          <UiThead>
            <UiTr style={{ background: '#f8fafc', borderBottom: `1px solid ${colors.border}` }}>
              <UiTh>Zasób</UiTh>
              <UiTh>Workflow</UiTh>
              <UiTh>Treść</UiTh>
              <UiTh>Kontekst</UiTh>
              <UiTh>Data</UiTh>
            </UiTr>
          </UiThead>
          <UiTbody>
            {mediaUsage.length === 0 ? (
              <UiTr>
                <UiTd
                  colSpan={5}
                  style={{ textAlign: 'center', padding: 24, color: colors.textLight }}
                >
                  Brak danych o użyciu mediów.
                </UiTd>
              </UiTr>
            ) : (
              mediaUsage.map((item) => (
                <UiTr key={item.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <UiTd>
                    <strong style={{ color: colors.text }}>{item.media_asset}</strong>
                  </UiTd>
                  <UiTd>{item.workflow}</UiTd>
                  <UiTd>
                    {item.content_uid} (#{item.content_entry_id})
                  </UiTd>
                  <UiTd>
                    <span
                      style={{
                        fontSize: 11,
                        background: '#f1f5f9',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      {item.context_key}
                    </span>
                  </UiTd>
                  <UiTd style={{ color: colors.textLight }}>
                    {new Date(item.used_at).toLocaleString()}
                  </UiTd>
                </UiTr>
              ))
            )}
          </UiTbody>
        </UiTable>
      </div>
    </section>
  </div>
);
