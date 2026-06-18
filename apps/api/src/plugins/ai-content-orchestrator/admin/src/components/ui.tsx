// Współdzielone, cienkie nakładki na @strapi/design-system (v2.2.0) dla panelu AICO.
//
// Cel (Etap 1): wprowadzić DOSTĘPNE i SPÓJNE prymitywy interaktywne/feedbackowe
// (przyciski, pola formularza, selecty, statusy, alerty) BEZ utraty obecnego,
// markowego wyglądu panelu (gradientowe tło strony, białe zaokrąglone karty,
// kafelki KPI, fioletowy akcent, layout „Centrum Dowodzenia").
//
// Dlatego:
//  - karty/sekcje zostają na obecnym stylu (UiCard reużywa CARD_STYLE),
//  - prymitywy formularzy/feedbacku korzystają z DS dla a11y i spójności,
//  - całe copy pozostaje po polsku i jest sterowane z zewnątrz (HELP/help()).

import {
  Alert,
  Badge,
  Button,
  Field,
  SingleSelect,
  SingleSelectOption,
  Status,
  Textarea,
  TextInput,
} from '@strapi/design-system';
import * as React from 'react';

// DS AlertVariant (v2.2.0): 'success' | 'danger' | 'default' | 'warning'.
// Typujemy lokalnie, bo top-level barrel DS eksportuje AlertProps jako
// namespace (nie da się użyć jako typu w `import type`).
type DsAlertVariant = 'success' | 'danger' | 'default' | 'warning';

// — Wspólny styl karty (markowy wygląd panelu) ————————————————————————————
// Trzymamy go tutaj, by sekcje spoza HomePage mogły go reużywać; wartości
// odpowiadają CARD_STYLE z HomePage.tsx (nie zmieniamy wyglądu).
export const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(10px)',
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 24,
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
  transition: 'transform 0.2s, box-shadow 0.2s',
};

// ——————————————————————————————————————————————————————————————————————————
// UiCard — zachowuje istniejący markowy wygląd karty/sekcji.
// Pozwala nadpisać/rozszerzyć style (np. padding: 0 dla tabel).
// ——————————————————————————————————————————————————————————————————————————
export type UiCardProps = {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  as?: 'section' | 'div';
};

export const UiCard = ({ children, style, as = 'section' }: UiCardProps) => {
  const Tag = as;
  return <Tag style={{ ...CARD_STYLE, ...style }}>{children}</Tag>;
};

// ——————————————————————————————————————————————————————————————————————————
// UiButton — nakładka na DS Button.
// Mapowanie wariantów (intencja panelu -> DS ButtonVariant):
//   primary    -> 'default'        (główna akcja, fioletowy akcent DS)
//   secondary  -> 'tertiary'       (akcja drugorzędna, lekka)
//   danger     -> 'danger-light'   (akcja destrukcyjna, czytelny kolor a11y)
//   success    -> 'success-light'
//   ghost      -> 'ghost'
// Obsługuje loading/disabled oraz ikony (DS Button: loading, disabled,
// startIcon, endIcon, fullWidth, size, type).
// ——————————————————————————————————————————————————————————————————————————
export type UiButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';

const BUTTON_VARIANT_MAP: Record<
  UiButtonVariant,
  'default' | 'tertiary' | 'danger-light' | 'success-light' | 'ghost'
> = {
  primary: 'default',
  secondary: 'tertiary',
  danger: 'danger-light',
  success: 'success-light',
  ghost: 'ghost',
};

export type UiButtonProps = {
  children?: React.ReactNode;
  variant?: UiButtonVariant;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  size?: 'XS' | 'S' | 'M' | 'L';
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
};

export const UiButton = ({
  children,
  variant = 'primary',
  onClick,
  disabled,
  loading,
  type = 'button',
  size = 'M',
  fullWidth,
  startIcon,
  endIcon,
}: UiButtonProps) => (
  <Button
    type={type}
    variant={BUTTON_VARIANT_MAP[variant]}
    onClick={onClick}
    disabled={disabled}
    loading={loading}
    size={size}
    fullWidth={fullWidth}
    startIcon={startIcon}
    endIcon={endIcon}
  >
    {children}
  </Button>
);

// ——————————————————————————————————————————————————————————————————————————
// UiField — DS Field.Root + Field.Label + Field.Hint.
// Renderuje ETYKIETĘ ORAZ PODPOWIEDŹ (hint) pod nią — zgodnie z systemem
// pomocy panelu (help(): { label, hint }). Hint/error/required przekazujemy
// do Field.Root (Field.Hint/Field.Error czytają je z kontekstu DS).
//
// Używaj jako kontenera dla pola — np.:
//   <UiField label={l} hint={h}><UiTextInput .../></UiField>
// lub skorzystaj z gotowych UiTextField / UiTextareaField poniżej.
// ——————————————————————————————————————————————————————————————————————————
export type UiFieldProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  name?: string;
  id?: string;
  children: React.ReactNode;
};

export const UiField = ({ label, hint, error, required, name, id, children }: UiFieldProps) => (
  <Field.Root name={name} id={id} hint={hint} error={error} required={required} width="100%">
    <Field.Label>{label}</Field.Label>
    {children}
    <Field.Hint />
    <Field.Error />
  </Field.Root>
);

// ——————————————————————————————————————————————————————————————————————————
// UiTextInput — DS TextInput (czyta kontekst z Field.Root: id, name, error).
// ——————————————————————————————————————————————————————————————————————————
export type UiTextInputProps = {
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  size?: 'S' | 'M';
};

export const UiTextInput = ({
  value,
  onChange,
  placeholder,
  type,
  disabled,
  size,
}: UiTextInputProps) => (
  <TextInput
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    type={type}
    disabled={disabled}
    size={size}
  />
);

// ——————————————————————————————————————————————————————————————————————————
// UiTextField / UiTextareaField — gotowe pole: etykieta + hint + kontrolka.
// Najprostszy, bezpieczny domyślny wariant dla operatora.
// ——————————————————————————————————————————————————————————————————————————
export type UiTextFieldProps = Omit<UiFieldProps, 'children'> & UiTextInputProps;

export const UiTextField = ({
  label,
  hint,
  error,
  required,
  name,
  id,
  ...inputProps
}: UiTextFieldProps) => (
  <UiField label={label} hint={hint} error={error} required={required} name={name} id={id}>
    <UiTextInput {...inputProps} />
  </UiField>
);

export type UiTextareaFieldProps = Omit<UiFieldProps, 'children'> & {
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
};

export const UiTextareaField = ({
  label,
  hint,
  error,
  required,
  name,
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: UiTextareaFieldProps) => (
  <UiField label={label} hint={hint} error={error} required={required} name={name} id={id}>
    <Textarea value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />
  </UiField>
);

// ——————————————————————————————————————————————————————————————————————————
// UiSelect — DS SingleSelect + SingleSelectOption.
// onChange zwraca wartość (string | number) — wygodne dla setState.
// Może być użyty samodzielnie (z label) lub wewnątrz UiField.
// ——————————————————————————————————————————————————————————————————————————
export type UiSelectOption = { value: string | number; label: React.ReactNode };

export type UiSelectProps = {
  value?: string | number | null;
  onChange?: (value: string | number) => void;
  options: UiSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  'aria-label'?: string;
};

export const UiSelect = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  'aria-label': ariaLabel,
}: UiSelectProps) => (
  <SingleSelect
    value={value ?? undefined}
    onChange={onChange}
    placeholder={placeholder}
    disabled={disabled}
    aria-label={ariaLabel}
  >
    {options.map((option) => (
      <SingleSelectOption key={String(option.value)} value={option.value}>
        {option.label}
      </SingleSelectOption>
    ))}
  </SingleSelect>
);

// ——————————————————————————————————————————————————————————————————————————
// Statusy/odznaki — semantyczne, dostępne kolory DS.
// Mapowanie wewnętrznych stanów panelu na warianty DS (Badge/Status mają
// nieco różne zestawy wariantów — używamy wspólnego, bezpiecznego mapowania).
// ——————————————————————————————————————————————————————————————————————————
export type UiTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

const BADGE_VARIANT_MAP: Record<
  UiTone,
  'success' | 'danger' | 'warning' | 'secondary' | 'neutral'
> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'secondary',
  neutral: 'neutral',
};

const STATUS_VARIANT_MAP: Record<
  UiTone,
  'success' | 'danger' | 'warning' | 'secondary' | 'neutral'
> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'secondary',
  neutral: 'neutral',
};

// UiBadge — pigułka statusu (np. krótka etykieta stanu w tabelach).
export type UiBadgeProps = {
  children?: React.ReactNode;
  tone?: UiTone;
  size?: 'S' | 'M';
};

export const UiBadge = ({ children, tone = 'neutral', size = 'M' }: UiBadgeProps) => (
  <Badge variant={BADGE_VARIANT_MAP[tone]} size={size}>
    {children}
  </Badge>
);

// UiStatus — status z kropką (np. „SYSTEM GOTOWY"); dostępny tekst PL.
export type UiStatusProps = {
  children?: React.ReactNode;
  tone?: UiTone;
  size?: 'XS' | 'S' | 'M';
};

export const UiStatus = ({ children, tone = 'neutral', size = 'S' }: UiStatusProps) => (
  <Status variant={STATUS_VARIANT_MAP[tone]} size={size}>
    {children}
  </Status>
);

// ——————————————————————————————————————————————————————————————————————————
// UiAlert — DS Alert (error/success/info/warning).
// closeLabel jest wymagany przez DS dla a11y; domyślnie PL „Zamknij".
// onClose opcjonalne — bez niego DS nie pokaże przycisku zamykania.
// ——————————————————————————————————————————————————————————————————————————
export type UiAlertTone = 'success' | 'danger' | 'warning' | 'info';

const ALERT_VARIANT_MAP: Record<UiAlertTone, DsAlertVariant> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'default',
};

export type UiAlertProps = {
  children?: React.ReactNode;
  title?: string;
  tone?: UiAlertTone;
  onClose?: () => void;
  closeLabel?: string;
  action?: React.ReactNode;
};

export const UiAlert = ({
  children,
  title,
  tone = 'info',
  onClose,
  closeLabel = 'Zamknij',
  action,
}: UiAlertProps) => (
  <Alert
    title={title}
    variant={ALERT_VARIANT_MAP[tone]}
    onClose={onClose}
    closeLabel={closeLabel}
    action={action}
  >
    {children}
  </Alert>
);
