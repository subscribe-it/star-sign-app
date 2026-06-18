import { Page, useFetchClient, useNotification } from '@strapi/strapi/admin';
import { useEffect, useMemo, useState } from 'react';

import { api } from '../api';
import { help } from '../help';
import {
  UiBadge,
  UiButton,
  UiCheckbox,
  UiField,
  UiSelect,
  UiTextField,
  UiTextareaField,
} from '../components/ui';
import type { UiTone } from '../components/ui';
import { AuditTab } from './homepage/AuditTab';
import { DashboardTab } from './homepage/DashboardTab';
import { GrowthTab } from './homepage/GrowthTab';
import { MediaTab } from './homepage/MediaTab';
import { RunsTab } from './homepage/RunsTab';
import { SettingsTab } from './homepage/SettingsTab';
import { SocialTab } from './homepage/SocialTab';
import VideoTab, { type VideoJobPayload } from './homepage/VideoTab';
import { TopicsTab } from './homepage/TopicsTab';
import { WorkflowSocialStep } from './homepage/WorkflowSocialStep';
import { WorkflowsTab } from './homepage/WorkflowsTab';
import type {
  AuditReport,
  AdCampaignPlan,
  AutonomyStatus,
  ContentPerformanceSnapshot,
  ContentPlanItem,
  DashboardSummary,
  DiagnosticsSummary,
  GenerationJob,
  GrowthExperiment,
  HomepageRecommendation,
  LlmTrace,
  MediaAsset,
  MediaBulkUpsertItemRequest,
  MediaBulkUpsertResult,
  MediaIdentityPreview,
  MediaLibraryFile,
  MediaLibraryListResult,
  MediaUsage,
  Run,
  RunStep,
  SettingsPayload,
  PerformanceAggregateResult,
  ProviderCredentialStatus,
  ProviderProbeRunResult,
  ProductionReadinessReport,
  StrategyApprovePlanResult,
  StrategyGeneratePlanResult,
  SocialConnectionResult,
  SocialDryRunResult,
  SocialPlatform,
  SocialTicket,
  Topic,
  VideoAsset,
  Workflow,
} from '../types';

type TabKey =
  | 'dashboard'
  | 'workflows'
  | 'topics'
  | 'media'
  | 'runs'
  | 'social'
  | 'video'
  | 'audit'
  | 'growth'
  | 'settings';
type OpsState = 'ready' | 'needs_action' | 'blocked' | 'degraded';
const RUN_NOW_CONFIRMATION = 'RUN_AICO_CONTROLLED_TICK';

type WorkflowFormState = {
  name: string;
  enabled: boolean;
  workflow_type: Workflow['workflow_type'];
  generate_cron: string;
  publish_cron: string;
  timezone: string;
  locale: string;
  llm_model: string;
  apiToken: string;
  prompt_template: string;
  temperature: number;
  max_completion_tokens: number;
  retry_max: number;
  retry_backoff_seconds: number;
  daily_request_limit: number;
  daily_token_limit: number;
  allow_manual_edit: boolean;
  auto_publish: boolean;
  force_regenerate: boolean;
  strategy_enabled: boolean;
  performance_feedback_enabled: boolean;
  content_cluster: string;
  auto_publish_guardrails: string;
  topic_mode: 'manual' | 'mixed';
  horoscope_period: 'Dzienny' | 'Tygodniowy' | 'Miesięczny' | 'Roczny';
  horoscope_type_values: string;
  all_signs: boolean;
  article_category: string;
  image_gen_model: string;
  imageGenApiToken: string;
  enabled_channels: SocialPlatform[];
  fb_page_id: string;
  fbAccessToken: string;
  ig_user_id: string;
  igAccessToken: string;
  x_api_key: string;
  xApiSecret: string;
  xAccessToken: string;
  xAccessTokenSecret: string;
  tt_creator_id: string;
  ttAccessToken: string;
};

type TopicFormState = {
  title: string;
  brief: string;
  image_asset_key: string;
  workflow: string;
  article_category: string;
  scheduled_for: string;
};

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

type RunFiltersState = {
  status: 'all' | Run['status'];
  workflowName: string;
  fromDate: string;
  toDate: string;
};

type StrategyFormState = {
  weekStart: string;
  limit: number;
  workflowId: string;
  autoApprove: boolean;
};

type PerformanceFormState = {
  day: string;
  limit: number;
};

type HomepageFormState = {
  limit: number;
};

const COLORS = {
  primary: '#4f46e5',
  primaryHover: '#4338ca',
  primaryLight: '#eef2ff',
  secondary: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  text: '#1e293b',
  textLight: '#64748b',
  border: '#e2e8f0',
  cardBg: 'rgba(255, 255, 255, 0.95)',
};

const CARD_STYLE: React.CSSProperties = {
  background: COLORS.cardBg,
  backdropFilter: 'blur(10px)',
  border: `1px solid ${COLORS.border}`,
  borderRadius: 16,
  padding: 24,
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
  transition: 'transform 0.2s, box-shadow 0.2s',
};

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: COLORS.text,
  marginBottom: 20,
  letterSpacing: '-0.025em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 10,
  border: `1px solid ${COLORS.border}`,
  fontSize: 14,
  background: '#f8fafc',
  transition: 'all 0.2s ease',
  outline: 'none',
  color: COLORS.text,
};

const checkboxRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  fontWeight: 500,
  color: COLORS.text,
  cursor: 'pointer',
};

const primaryButtonStyle: React.CSSProperties = {
  background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryHover} 100%)`,
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '10px 20px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.3)',
  transition: 'all 0.2s ease',
};

const secondaryButtonStyle: React.CSSProperties = {
  background: '#fff',
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 10,
  padding: '10px 20px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const STAT_CARD_STYLE: React.CSSProperties = {
  ...CARD_STYLE,
  background: '#fff',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 8,
};

const initialWorkflowForm = (): WorkflowFormState => ({
  name: '',
  enabled: true,
  workflow_type: 'horoscope',
  generate_cron: '0 23 * * *',
  publish_cron: '0 0 * * *',
  timezone: 'Europe/Warsaw',
  locale: 'pl',
  llm_model: 'openai/gpt-4o-mini',
  apiToken: '',
  prompt_template:
    'Napisz treść dla {{type}} ({{period}}). Data docelowa: {{targetDate}}. Znaki: {{signList}}. Język: polski. Oddaj gotowy JSON.',
  temperature: 0.7,
  max_completion_tokens: 1800,
  retry_max: 3,
  retry_backoff_seconds: 120,
  daily_request_limit: 120,
  daily_token_limit: 250000,
  allow_manual_edit: true,
  auto_publish: true,
  force_regenerate: false,
  strategy_enabled: false,
  performance_feedback_enabled: true,
  content_cluster: '',
  auto_publish_guardrails: JSON.stringify(
    {
      minSeoScore: 70,
      requireTargetUrl: true,
      maxSocialFailures: 0,
    },
    null,
    2
  ),
  topic_mode: 'mixed',
  horoscope_period: 'Dzienny',
  horoscope_type_values: 'Ogólny',
  all_signs: true,
  article_category: '',
  image_gen_model: 'openai/gpt-image-2',
  imageGenApiToken: '',
  enabled_channels: ['facebook', 'instagram', 'twitter'],
  fb_page_id: '',
  fbAccessToken: '',
  ig_user_id: '',
  igAccessToken: '',
  x_api_key: '',
  xApiSecret: '',
  xAccessToken: '',
  xAccessTokenSecret: '',
  tt_creator_id: '',
  ttAccessToken: '',
});

const initialTopicForm = (): TopicFormState => ({
  title: '',
  brief: '',
  image_asset_key: '',
  workflow: '',
  article_category: '',
  scheduled_for: '',
});

const initialMediaAssetForm = (): MediaAssetFormState => ({
  asset_key: '',
  label: '',
  purpose: 'blog_article',
  sign_slug: '',
  period_scope: 'any',
  keywords: '',
  priority: 0,
  active: true,
  cooldown_days: 3,
  notes: '',
});

const initialMediaFilters = (): MediaFiltersState => ({
  page: 1,
  pageSize: 24,
  search: '',
  mapped: 'all',
  purpose: 'all',
  sign: 'all',
  active: 'all',
  sort: 'createdAtDesc',
});

const initialRunFilters = (): RunFiltersState => ({
  status: 'all',
  workflowName: '',
  fromDate: '',
  toDate: '',
});

const initialStrategyForm = (): StrategyFormState => ({
  weekStart: '',
  limit: 7,
  workflowId: '',
  autoApprove: false,
});

const initialPerformanceForm = (): PerformanceFormState => ({
  day: '',
  limit: 100,
});

const initialHomepageForm = (): HomepageFormState => ({
  limit: 12,
});

const WORKFLOW_STEP_LABELS = ['Podstawy', 'Harmonogram', 'Treść', 'Social', 'Sterowanie'] as const;
const ADS_STOP_LOSS_CONFIRMATION = 'PAUSE_ACTIVE_ADS';

// Definicje zakładek (klucz + polska etykieta). Kolejność = kolejność w pasku
// nawigacji oraz porządek nawigacji klawiaturą (strzałki/Home/End).
const TAB_DEFS: Array<[TabKey, string]> = [
  ['dashboard', 'Pulpit'],
  ['workflows', 'Przepływy'],
  ['topics', 'Kolejka tematów'],
  ['media', 'Katalog mediów'],
  ['runs', 'Monitoring'],
  ['social', 'Social'],
  ['video', 'Wideo'],
  ['audit', 'Audyt'],
  ['growth', 'Wzrost'],
  ['settings', 'Ustawienia'],
];

const STATUS_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  idle: { bg: '#f1f5f9', border: '#e2e8f0', color: '#64748b' },
  pending: { bg: '#f1f5f9', border: '#e2e8f0', color: '#64748b' },
  ready: { bg: '#f0fdf4', border: '#dcfce7', color: '#16a34a' },
  GO: { bg: '#f0fdf4', border: '#dcfce7', color: '#16a34a' },
  GO_WITH_WARNINGS: { bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
  NO_GO: { bg: '#fef2f2', border: '#fecaca', color: '#dc2626' },
  pass: { bg: '#f0fdf4', border: '#dcfce7', color: '#16a34a' },
  warn: { bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
  fail: { bg: '#fef2f2', border: '#fecaca', color: '#dc2626' },
  needs_action: { bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
  blocked: { bg: '#fef2f2', border: '#fecaca', color: '#dc2626' },
  degraded: { bg: '#eff6ff', border: '#dbeafe', color: '#2563eb' },
  running: { bg: '#eff6ff', border: '#dbeafe', color: '#2563eb' },
  success: { bg: '#f0fdf4', border: '#dcfce7', color: '#16a34a' },
  failed: { bg: '#fef2f2', border: '#fee2e2', color: '#dc2626' },
  blocked_budget: { bg: '#fffbeb', border: '#fef3c7', color: '#d97706' },
  enabled: { bg: '#f0fdf4', border: '#dcfce7', color: '#16a34a' },
  disabled: { bg: '#f1f5f9', border: '#e2e8f0', color: '#64748b' },
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

const stripExtension = (fileName: string): string => fileName.replace(/\.[a-z0-9]+$/i, '');

const toTokens = (fileName: string): string[] => {
  return stripExtension(fileName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
};

const extractNumericHints = (tokens: string[]): number[] => {
  return tokens
    .map((token) => token.match(/\d+/g) ?? [])
    .flat()
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 9999);
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const nextOrdinalForPrefix = (existingKeys: Set<string>, prefix: string): number => {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}-(\\d{1,4})(?:-[0-9]+)?$`);
  let max = 0;

  for (const key of existingKeys) {
    const matched = key.match(pattern);
    if (!matched?.[1]) {
      continue;
    }

    const parsed = Number(matched[1]);
    if (Number.isFinite(parsed) && parsed > max) {
      max = parsed;
    }
  }

  return max + 1;
};

const ensureUniqueKey = (existingKeys: Set<string>, candidate: string): string => {
  if (!existingKeys.has(candidate)) {
    return candidate;
  }

  let suffix = 2;
  while (existingKeys.has(`${candidate}-${suffix}`)) {
    suffix += 1;
  }
  return `${candidate}-${suffix}`;
};

const toTitleCase = (value: string): string => {
  return value
    .split(/\s+/)
    .map((token) => {
      if (!token) {
        return token;
      }

      if (/^\d+$/.test(token)) {
        return token;
      }

      if (token.length <= 2) {
        return token.toUpperCase();
      }

      return `${token.slice(0, 1).toUpperCase()}${token.slice(1).toLowerCase()}`;
    })
    .join(' ');
};

const computeGeneratedIdentity = (input: {
  fileName: string;
  purpose: MediaAssetFormState['purpose'];
  signSlug: string;
  periodScope: MediaAssetFormState['period_scope'];
  existingAssetKeys: Set<string>;
}): { asset_key: string; label: string } => {
  const normalizedSign = input.signSlug.trim();
  const tokens = toTokens(input.fileName);
  const numericHints = extractNumericHints(tokens);

  const useHintOrNext = (prefix: string): string => {
    const hinted = numericHints[0];
    const ordinal = hinted ?? nextOrdinalForPrefix(input.existingAssetKeys, prefix);
    return ensureUniqueKey(input.existingAssetKeys, `${prefix}-${pad2(ordinal)}`);
  };

  let assetKey = '';
  if (input.purpose === 'blog_article') {
    assetKey = useHintOrNext('blog-astro');
  } else if (input.purpose === 'daily_card') {
    assetKey = useHintOrNext('daily-card');
  } else if (input.purpose === 'horoscope_sign' && normalizedSign) {
    const normalizedPeriod = input.periodScope === 'any' ? 'daily' : input.periodScope;
    assetKey = useHintOrNext(`horoscope-${normalizedSign}-${normalizedPeriod}`);
  } else {
    assetKey = useHintOrNext('fallback-general');
  }

  const displayName = toTitleCase(
    stripExtension(input.fileName).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  );
  const safeDisplayName = displayName || 'Asset';

  let label = `Grafika - ${safeDisplayName}`;
  if (input.purpose === 'blog_article') {
    label = `Artykul - ${safeDisplayName}`;
  } else if (input.purpose === 'daily_card') {
    label = `Karta dnia - ${safeDisplayName}`;
  } else if (input.purpose === 'horoscope_sign') {
    const normalizedPeriod = input.periodScope === 'any' ? 'daily' : input.periodScope;
    const signPart = normalizedSign ? ` ${normalizedSign}` : '';
    label = `Horoskop${signPart} ${normalizedPeriod} - ${safeDisplayName}`
      .replace(/\s+/g, ' ')
      .trim();
  }

  return {
    asset_key: assetKey,
    label,
  };
};

const isRecordValue = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const getWorkflowId = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return value;
  }

  if (isRecordValue(value) && typeof value.id === 'number') {
    return value.id;
  }

  return null;
};

const getRunWorkflowId = (run: Run): number | null => {
  return getWorkflowId(run.workflow);
};

const getRunWorkflowName = (run: Run, workflows: Workflow[]): string => {
  if (
    isRecordValue(run.workflow) &&
    typeof run.workflow.name === 'string' &&
    run.workflow.name.trim()
  ) {
    return run.workflow.name;
  }

  const workflowId = getRunWorkflowId(run);
  const workflow = workflows.find((item) => item.id === workflowId);
  return workflow?.name ?? (workflowId ? `Workflow #${workflowId}` : 'Unassigned');
};

const isRunStepStatus = (value: unknown): value is RunStep['status'] => {
  return value === 'pending' || value === 'running' || value === 'success' || value === 'failed';
};

const normalizeRunStep = (value: unknown, index: number): RunStep | null => {
  if (!isRecordValue(value)) {
    return null;
  }

  const id = typeof value.id === 'string' && value.id.trim() ? value.id : `step-${index + 1}`;
  const label =
    typeof value.label === 'string' && value.label.trim() ? value.label : `Step ${index + 1}`;
  const status = isRunStepStatus(value.status) ? value.status : 'pending';

  return {
    id,
    label,
    status,
    message: typeof value.message === 'string' ? value.message : null,
    timestamp: typeof value.timestamp === 'string' ? value.timestamp : null,
    output: value.output,
  };
};

const isTraceMessage = (value: unknown): value is LlmTrace['request']['messages'][number] => {
  return (
    isRecordValue(value) &&
    (value.role === 'system' || value.role === 'user') &&
    typeof value.content === 'string'
  );
};

const normalizeLlmTrace = (value: unknown, index: number): LlmTrace | null => {
  if (!isRecordValue(value) || !isRecordValue(value.request) || !isRecordValue(value.response)) {
    return null;
  }

  const usage = isRecordValue(value.response.usage) ? value.response.usage : {};
  const messages = Array.isArray(value.request.messages)
    ? value.request.messages.filter(isTraceMessage)
    : [];

  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : `llm-${index + 1}`,
    label:
      typeof value.label === 'string' && value.label.trim() ? value.label : `LLM call ${index + 1}`,
    workflowType:
      value.workflowType === 'horoscope' ||
      value.workflowType === 'daily_card' ||
      value.workflowType === 'article'
        ? value.workflowType
        : undefined,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    redacted: value.redacted === true,
    redactionReason:
      typeof value.redactionReason === 'string' && value.redactionReason.trim()
        ? value.redactionReason
        : undefined,
    request: {
      model: typeof value.request.model === 'string' ? value.request.model : '',
      temperature: Number(value.request.temperature ?? 0),
      maxCompletionTokens: Number(value.request.maxCompletionTokens ?? 0),
      prompt: typeof value.request.prompt === 'string' ? value.request.prompt : '',
      schemaDescription:
        typeof value.request.schemaDescription === 'string' ? value.request.schemaDescription : '',
      messages,
    },
    response: {
      content: typeof value.response.content === 'string' ? value.response.content : '',
      payload: value.response.payload,
      usage: {
        prompt_tokens: Number(usage.prompt_tokens ?? 0),
        completion_tokens: Number(usage.completion_tokens ?? 0),
        total_tokens: Number(usage.total_tokens ?? 0),
      },
    },
  };
};

const formatDetailValue = (value: unknown): string => {
  if (typeof value === 'undefined' || value === null || value === '') {
    return '-';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
};

const formatJsonForTextarea = (value: unknown, fallback: Record<string, unknown>): string => {
  if (!isRecordValue(value)) {
    return JSON.stringify(fallback, null, 2);
  }

  return JSON.stringify(value, null, 2);
};

const parseJsonObject = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value);
    return isRecordValue(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const formatDuration = (startedAt: string, finishedAt?: string | null): string => {
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return '-';
  }

  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
};

const getRunResultSummary = (run: Run): string => {
  const details = isRecordValue(run.details) ? run.details : {};
  const parts = [
    typeof details.created === 'number' ? `created ${details.created}` : '',
    typeof details.updated === 'number' ? `updated ${details.updated}` : '',
    typeof details.skipped === 'number' ? `skipped ${details.skipped}` : '',
    run.usage_total_tokens ? `tokens ${run.usage_total_tokens}` : '',
  ].filter(Boolean);

  if (run.error_message) {
    return run.error_message;
  }

  return parts.join(' • ') || (run.status === 'running' ? 'In progress' : 'No result payload');
};

const getRunSteps = (run: Run): RunStep[] => {
  const details = isRecordValue(run.details) ? run.details : {};
  const rawSteps = Array.isArray(details.steps) ? details.steps : [];
  const steps = rawSteps
    .map((step, index) => normalizeRunStep(step, index))
    .filter((step): step is RunStep => Boolean(step));

  if (steps.length > 0) {
    return steps;
  }

  const executeStatus: RunStep['status'] =
    run.status === 'running' ? 'running' : run.status === 'success' ? 'success' : 'failed';
  const resultStatus: RunStep['status'] =
    run.status === 'running' ? 'pending' : run.status === 'success' ? 'success' : 'failed';

  return [
    {
      id: 'accepted',
      label: 'Accepted',
      status: 'success',
      timestamp: run.started_at,
      message: `${run.run_type} run created`,
    },
    {
      id: 'execute',
      label: 'Execute workflow',
      status: executeStatus,
      message: run.status === 'running' ? 'Workflow is still running' : getRunResultSummary(run),
    },
    {
      id: 'result',
      label: 'Result',
      status: resultStatus,
      timestamp: run.finished_at ?? null,
      message: getRunResultSummary(run),
    },
  ];
};

const getRunLlmTraces = (run: Run): LlmTrace[] => {
  const details = isRecordValue(run.details) ? run.details : {};
  const rawTraces = Array.isArray(details.llmTraces) ? details.llmTraces : [];

  return rawTraces
    .map((trace, index) => normalizeLlmTrace(trace, index))
    .filter((trace): trace is LlmTrace => Boolean(trace));
};

const toOpsStateFromErrorMessage = (message: string): OpsState => {
  const normalized = message.toLowerCase();
  if (normalized.includes('401') || normalized.includes('403')) {
    return 'blocked';
  }

  if (normalized.includes('404')) {
    return 'needs_action';
  }

  return 'degraded';
};

const toOpsStateFromSocialOverall = (overall: SocialConnectionResult['overall']): OpsState => {
  if (overall === 'ready') {
    return 'ready';
  }
  if (overall === 'blocked') {
    return 'blocked';
  }
  if (overall === 'degraded') {
    return 'degraded';
  }
  return 'needs_action';
};

const toOpsStateFromAuditDecision = (decision: AuditReport['decision']): OpsState => {
  if (decision === 'GO') {
    return 'ready';
  }
  if (decision === 'GO_WITH_WARNINGS') {
    return 'needs_action';
  }
  return 'blocked';
};

const OPS_STATE_PRIORITY: Record<OpsState, number> = {
  ready: 0,
  needs_action: 1,
  degraded: 2,
  blocked: 3,
};

const mergeOpsState = (current: OpsState, next: OpsState): OpsState =>
  OPS_STATE_PRIORITY[next] > OPS_STATE_PRIORITY[current] ? next : current;

const ErrorInsight = ({ error }: { error?: string | null }) => {
  if (!error) return null;

  let title = 'Nierozpoznany błąd';
  let action = 'Sprawdź logi serwera dla szczegółów.';
  let type: 'warning' | 'critical' = 'critical';

  if (error.includes('429') || error.toLowerCase().includes('limit')) {
    title = 'Przekroczono limity (Rate Limit)';
    action =
      'Sprawdź stan konta w OpenRouter/Replicate lub zwiększ limity w ustawieniach workflow.';
    type = 'warning';
  } else if (error.includes('401') || error.toLowerCase().includes('token')) {
    title = 'Błąd autoryzacji (Invalid Token)';
    action = 'Sprawdź poprawność klucza API w ustawieniach workflow lub w zakładce Settings.';
  } else if (error.includes('JSON')) {
    title = 'Błąd formatowania AI (JSON Error)';
    action =
      'Zwiększ parametr "temperature" lub dopracuj prompt. AI nie zwróciło poprawnego formatu.';
  } else if (error.includes('media-asset')) {
    title = 'Błąd zasobów mediów';
    action = 'Brakuje zdjęcia dla tej kategorii i autonomia nie zdołała go wygenerować.';
  } else if (
    error.toLowerCase().includes('aborted') ||
    error.toLowerCase().includes('zatrzymano')
  ) {
    title = 'Przerwano ręcznie';
    action = 'Użytkownik zatrzymał proces w trakcie pracy.';
    type = 'warning';
  } else if (
    error.toLowerCase().includes('budget') ||
    error.toLowerCase().includes('limit dzienny')
  ) {
    title = 'Zablokowano budżet';
    action = 'Osiągnięto dzienny limit requestów lub tokenów dla tego workflow.';
    type = 'warning';
  }

  return (
    <div
      style={{
        marginTop: 10,
        padding: 16,
        borderRadius: 12,
        border: `1px solid ${type === 'critical' ? '#ffc7c7' : '#ffd58a'}`,
        background: type === 'critical' ? '#fffafa' : '#fffcf5',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 14,
          color: type === 'critical' ? '#a42020' : '#8a5b00',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {type === 'critical' ? '🚫' : '⚠️'} {title}
      </div>
      <div style={{ fontSize: 12, marginTop: 6, color: '#4f4f60', lineHeight: 1.5 }}>
        <strong>Treść błędu:</strong> {error}
      </div>
      <div
        style={{
          fontSize: 12,
          marginTop: 12,
          padding: '8px 12px',
          background: type === 'critical' ? '#ffeded' : '#fff3dc',
          borderRadius: 6,
          fontWeight: 600,
          color: '#222',
        }}
      >
        💡 Rekomendacja: <span style={{ fontWeight: 400 }}>{action}</span>
      </div>
    </div>
  );
};

const AutonomousIntelligence = ({ run }: { run: Run }) => {
  const steps = getRunSteps(run);
  const designStep = steps.find((s) => s.id === 'image_design');
  const genStep = steps.find((s) => s.id === 'image_generation');
  const designOutput = isRecordValue(designStep?.output) ? designStep.output : null;
  const genOutput = isRecordValue(genStep?.output) ? genStep.output : null;
  const mediaAssetId = typeof genOutput?.mediaAssetId === 'number' ? genOutput.mediaAssetId : null;

  if (!designStep && !genStep) return null;

  return (
    <div
      style={{ marginTop: 12, border: '1px solid #dcdce4', borderRadius: 8, overflow: 'hidden' }}
    >
      <div
        style={{
          background: '#f0f0f7',
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 700,
          borderBottom: '1px solid #dcdce4',
          color: '#212134',
        }}
      >
        🤖 Autonomous Creative Agent
      </div>
      <div style={{ padding: 12, background: '#fff', display: 'grid', gap: 10 }}>
        {designStep && (
          <div>
            <div
              style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#666' }}
            >
              Designed Prompt (EN)
            </div>
            <div
              style={{
                fontSize: 12,
                marginTop: 4,
                fontStyle: 'italic',
                color: '#333',
                background: '#f9f9fb',
                padding: 8,
                borderRadius: 6,
              }}
            >
              "{String(designOutput?.fullPrompt || designStep.message || '')}"
            </div>
          </div>
        )}
        {genStep?.status === 'success' && mediaAssetId ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div
              style={{
                padding: '4px 8px',
                background: '#edf9f1',
                color: '#116b33',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              ASSET CREATED #{mediaAssetId}
            </div>
            <span style={{ fontSize: 11, color: '#666' }}>
              Wysłano do Cloudflare R2 i zarejestrowano w katalogu.
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const HomePage = () => {
  const client = useFetchClient();
  const { toggleNotification } = useNotification();

  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [showRunModal, setShowRunModal] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [backfillingImages, setBackfillingImages] = useState<'article' | 'tarot' | 'zodiac' | null>(
    null
  );

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaUsage, setMediaUsage] = useState<MediaUsage[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [socialTickets, setSocialTickets] = useState<SocialTicket[]>([]);
  const [runFilters, setRunFilters] = useState<RunFiltersState>(initialRunFilters());
  const [socialFilters, setSocialFilters] = useState<{
    platform: 'all' | SocialPlatform;
    status: 'all' | SocialTicket['status'];
    workflow: string;
  }>({ platform: 'all', status: 'all', workflow: '' });
  const [expandedRunIds, setExpandedRunIds] = useState<number[]>([]);
  const [runningWorkflowIds, setRunningWorkflowIds] = useState<number[]>([]);
  const [settings, setSettings] = useState<SettingsPayload>({
    timezone: 'Europe/Warsaw',
    locale: 'pl',
    image_gen_model: 'openai/gpt-image-2',
    imageGenApiToken: '',
    aico_auto_publish_enabled: true,
    aico_strategy_autopilot_enabled: false,
  });
  const [strategyPlan, setStrategyPlan] = useState<ContentPlanItem[]>([]);
  const [strategyForm, setStrategyForm] = useState<StrategyFormState>(initialStrategyForm());
  const [strategyGenerateResult, setStrategyGenerateResult] =
    useState<StrategyGeneratePlanResult | null>(null);
  const [strategyApproveResult, setStrategyApproveResult] =
    useState<StrategyApprovePlanResult | null>(null);
  const [performanceSnapshots, setPerformanceSnapshots] = useState<ContentPerformanceSnapshot[]>(
    []
  );
  const [performanceForm, setPerformanceForm] =
    useState<PerformanceFormState>(initialPerformanceForm());
  const [performanceAggregateResult, setPerformanceAggregateResult] =
    useState<PerformanceAggregateResult | null>(null);
  const [homepageRecommendations, setHomepageRecommendations] = useState<HomepageRecommendation[]>(
    []
  );
  const [homepageForm, setHomepageForm] = useState<HomepageFormState>(initialHomepageForm());
  const [homepageRunResult, setHomepageRunResult] = useState<Record<string, unknown> | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsSummary | null>(null);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [autonomyStatus, setAutonomyStatus] = useState<AutonomyStatus | null>(null);
  const [generationJobs, setGenerationJobs] = useState<GenerationJob[]>([]);
  const [videoAssets, setVideoAssets] = useState<VideoAsset[]>([]);
  const [videoLoading, setVideoLoading] = useState<boolean>(false);
  const [videoCreating, setVideoCreating] = useState<boolean>(false);
  const [videoBusyAssetId, setVideoBusyAssetId] = useState<number | null>(null);
  const [videoPolling, setVideoPolling] = useState<boolean>(false);
  const [adCampaignPlans, setAdCampaignPlans] = useState<AdCampaignPlan[]>([]);
  const [growthExperiments, setGrowthExperiments] = useState<GrowthExperiment[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<ProviderCredentialStatus[]>([]);
  const [providerProbeResult, setProviderProbeResult] = useState<ProviderProbeRunResult | null>(
    null
  );
  const [productionReadiness, setProductionReadiness] = useState<ProductionReadinessReport | null>(
    null
  );
  const [runNowConfirmation, setRunNowConfirmation] = useState<string>('');
  const [adsStopLossConfirmation, setAdsStopLossConfirmation] = useState<string>('');
  const [socialConnectionResult, setSocialConnectionResult] =
    useState<SocialConnectionResult | null>(null);
  const [socialDryRunResult, setSocialDryRunResult] = useState<SocialDryRunResult | null>(null);
  const [coreOpsState, setCoreOpsState] = useState<OpsState>('ready');
  const [coreOpsMessage, setCoreOpsMessage] = useState<string | null>(null);
  const [socialOpsState, setSocialOpsState] = useState<OpsState>('ready');
  const [socialOpsMessage, setSocialOpsMessage] = useState<string | null>(null);
  const [auditOpsState, setAuditOpsState] = useState<OpsState>('ready');
  const [auditOpsMessage, setAuditOpsMessage] = useState<string | null>(null);

  const [workflowForm, setWorkflowForm] = useState<WorkflowFormState>(initialWorkflowForm());
  const [editingWorkflowId, setEditingWorkflowId] = useState<number | null>(null);
  const [workflowStep, setWorkflowStep] = useState<number>(0);

  const [topicForm, setTopicForm] = useState<TopicFormState>(initialTopicForm());
  const [mediaAssetForm, setMediaAssetForm] =
    useState<MediaAssetFormState>(initialMediaAssetForm());
  const [mediaFilters, setMediaFilters] = useState<MediaFiltersState>(initialMediaFilters());
  const [mediaLibrary, setMediaLibrary] = useState<MediaLibraryFile[]>([]);
  const [mediaLibraryPagination, setMediaLibraryPagination] = useState<
    MediaLibraryListResult['pagination']
  >({
    page: 1,
    pageSize: 24,
    pageCount: 1,
    total: 0,
  });
  const [mediaLibraryLoading, setMediaLibraryLoading] = useState<boolean>(false);
  const [selectedMediaFileId, setSelectedMediaFileId] = useState<number | null>(null);
  const [identityPreview, setIdentityPreview] = useState<MediaIdentityPreview | null>(null);
  const [bulkSelectedFileIds, setBulkSelectedFileIds] = useState<number[]>([]);
  const [bulkPreview, setBulkPreview] = useState<MediaBulkUpsertResult | null>(null);
  const selectedTopicWorkflow = useMemo(() => {
    if (!topicForm.workflow) {
      return null;
    }
    return workflows.find((item) => String(item.id) === topicForm.workflow) ?? null;
  }, [topicForm.workflow, workflows]);

  const selectedMediaFile = useMemo(
    () => mediaLibrary.find((item) => item.id === selectedMediaFileId) ?? null,
    [mediaLibrary, selectedMediaFileId]
  );

  const generatedMediaIdentity = useMemo(() => {
    if (identityPreview && selectedMediaFile && identityPreview.fileId === selectedMediaFile.id) {
      return {
        asset_key: identityPreview.asset_key,
        label: identityPreview.label,
      };
    }

    if (!selectedMediaFile) {
      return {
        asset_key: mediaAssetForm.asset_key,
        label: mediaAssetForm.label,
      };
    }

    const purpose = mediaAssetForm.purpose;
    const signSlug =
      purpose === 'horoscope_sign'
        ? mediaAssetForm.sign_slug.trim() ||
          selectedMediaFile.mapping?.sign_slug?.trim() ||
          selectedMediaFile.suggestion.sign_slug ||
          ''
        : mediaAssetForm.sign_slug.trim();
    const periodScope = mediaAssetForm.period_scope;

    const existingAssetKeys = new Set(
      mediaAssets
        .map((item) => item.asset_key)
        .filter((key): key is string => typeof key === 'string' && key.trim().length > 0)
    );
    if (selectedMediaFile.mapping?.asset_key) {
      existingAssetKeys.delete(selectedMediaFile.mapping.asset_key);
    }

    return computeGeneratedIdentity({
      fileName: selectedMediaFile.name || `file-${selectedMediaFile.id}`,
      purpose,
      signSlug,
      periodScope,
      existingAssetKeys,
    });
  }, [
    selectedMediaFile,
    identityPreview,
    mediaAssetForm.asset_key,
    mediaAssetForm.label,
    mediaAssetForm.purpose,
    mediaAssetForm.sign_slug,
    mediaAssetForm.period_scope,
    mediaAssets,
  ]);

  const signOptions = useMemo(() => {
    const values = new Set<string>();
    mediaAssets.forEach((item) => {
      if (item.sign_slug) {
        values.add(item.sign_slug);
      }
    });
    return ['all', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [mediaAssets]);

  const filteredRuns = useMemo(() => {
    const workflowSearch = runFilters.workflowName.trim().toLowerCase();

    return runs.filter((run) => {
      if (runFilters.status !== 'all' && run.status !== runFilters.status) {
        return false;
      }

      const startedDay = run.started_at.slice(0, 10);
      if (runFilters.fromDate && startedDay < runFilters.fromDate) {
        return false;
      }

      if (runFilters.toDate && startedDay > runFilters.toDate) {
        return false;
      }

      if (workflowSearch) {
        const workflowName = getRunWorkflowName(run, workflows).toLowerCase();
        const workflowId = getRunWorkflowId(run);
        const searchable = `${workflowName} ${workflowId ?? ''}`;
        return searchable.includes(workflowSearch);
      }

      return true;
    });
  }, [runFilters, runs, workflows]);

  const filteredSocialTickets = useMemo(() => {
    return socialTickets.filter((ticket) => {
      if (socialFilters.platform !== 'all' && ticket.platform !== socialFilters.platform) {
        return false;
      }

      if (socialFilters.status !== 'all' && ticket.status !== socialFilters.status) {
        return false;
      }

      if (socialFilters.workflow.trim()) {
        const workflowId = getWorkflowId(ticket.workflow);
        return String(workflowId ?? '').includes(socialFilters.workflow.trim());
      }

      return true;
    });
  }, [socialFilters, socialTickets]);

  const liveRunCount = useMemo(() => runs.filter((run) => run.status === 'running').length, [runs]);
  const hasLiveActivity =
    liveRunCount > 0 || workflows.some((workflow) => workflow.status === 'running');
  const editingWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === editingWorkflowId) ?? null,
    [editingWorkflowId, workflows]
  );

  const socialStepValidationIssues = useMemo(() => {
    const channels = workflowForm.enabled_channels;
    const issues: string[] = [];

    const hasFbToken =
      Boolean(workflowForm.fbAccessToken.trim()) || Boolean(editingWorkflow?.has_fb_token);
    const hasIgToken =
      Boolean(workflowForm.igAccessToken.trim()) || Boolean(editingWorkflow?.has_ig_token);
    const hasXApiSecret =
      Boolean(workflowForm.xApiSecret.trim()) || Boolean(editingWorkflow?.has_x_api_secret);
    const hasXAccessToken =
      Boolean(workflowForm.xAccessToken.trim()) || Boolean(editingWorkflow?.has_x_access_token);
    const hasXAccessTokenSecret =
      Boolean(workflowForm.xAccessTokenSecret.trim()) ||
      Boolean(editingWorkflow?.has_x_access_token_secret);

    if (channels.length === 0) {
      issues.push('Wybierz minimum jeden kanał publikacji.');
    }

    if (channels.includes('facebook')) {
      if (!workflowForm.fb_page_id.trim()) {
        issues.push('Facebook: brak FB Page ID.');
      }
      if (!hasFbToken) {
        issues.push('Facebook: brak FB Access Token.');
      }
    }

    if (channels.includes('instagram')) {
      if (!workflowForm.ig_user_id.trim()) {
        issues.push('Instagram: brak IG User ID.');
      }
      if (!hasIgToken) {
        issues.push('Instagram: brak IG Access Token.');
      }
    }

    if (channels.includes('twitter')) {
      if (!workflowForm.x_api_key.trim()) {
        issues.push('X: brak API Key.');
      }
      if (!hasXApiSecret) {
        issues.push('X: brak API Secret.');
      }
      if (!hasXAccessToken) {
        issues.push('X: brak Access Token.');
      }
      if (!hasXAccessTokenSecret) {
        issues.push('X: brak Access Token Secret.');
      }
    }

    return issues;
  }, [editingWorkflow, workflowForm]);

  const showSuccess = (message: string): void => {
    toggleNotification({ type: 'success', message });
  };

  const showError = (message: string): void => {
    toggleNotification({ type: 'danger', message });
  };

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  };

  const refreshAutonomy = async (): Promise<void> => {
    const result = await runOptionalRequest(api.getAutonomyStatus(client));
    if (result.ok) {
      setAutonomyStatus(result.data);
    }
  };

  const saveAutonomyPatch = async (
    patch: Record<string, unknown>,
    successMessage: string
  ): Promise<void> => {
    try {
      await api.updateAutonomyPolicy(client, patch);
      showSuccess(successMessage);
      // Light refresh of just the autonomy status (avoids a full-page loadAll()
      // reload + Page.Loading flicker on every toggle).
      await refreshAutonomy();
    } catch (error) {
      showError(`Nie udało się zapisać ustawień autonomii: ${getErrorMessage(error)}`);
    }
  };

  const runOptionalRequest = async <T,>(
    request: Promise<T>
  ): Promise<{ ok: true; data: T } | { ok: false; error: string }> => {
    try {
      const data = await request;
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: getErrorMessage(error) };
    }
  };

  const refreshMonitoringData = async (notifyOnError = false): Promise<void> => {
    try {
      const [summaryData, diagnosticsData, workflowsData, runsData, socialTicketsResult] =
        await Promise.all([
          api.getDashboard(client),
          api.getDiagnostics(client),
          api.getWorkflows(client),
          api.getRuns(client, { limit: 200 }),
          runOptionalRequest(api.getSocialTickets(client, { limit: 200 })),
        ]);

      setSummary(summaryData);
      setDiagnostics(diagnosticsData);
      setWorkflows(workflowsData);
      setRuns(runsData);
      if (socialTicketsResult.ok) {
        setSocialTickets(socialTicketsResult.data);
        setSocialOpsState('ready');
        setSocialOpsMessage(null);
      } else {
        const message = `Social API: ${socialTicketsResult.error}`;
        setSocialOpsState(toOpsStateFromErrorMessage(message));
        setSocialOpsMessage(message);
      }
      setRunningWorkflowIds((prev) =>
        prev.filter(
          (id) =>
            workflowsData.some((workflow) => workflow.id === id && workflow.status === 'running') ||
            runsData.some((run) => getRunWorkflowId(run) === id && run.status === 'running')
        )
      );
    } catch (error) {
      if (notifyOnError) {
        showError(`Nie udało się odświeżyć monitoringu: ${String(error)}`);
      }
    }
  };

  const loadMediaLibrary = async (
    nextFilters?: Partial<MediaFiltersState>
  ): Promise<MediaLibraryListResult | null> => {
    const mergedFilters: MediaFiltersState = {
      ...mediaFilters,
      ...nextFilters,
    };

    setMediaLibraryLoading(true);
    try {
      const response = await api.getMediaLibraryFiles(client, {
        page: mergedFilters.page,
        pageSize: mergedFilters.pageSize,
        search: mergedFilters.search || undefined,
        mapped: mergedFilters.mapped,
        purpose: mergedFilters.purpose,
        sign: mergedFilters.sign === 'all' ? undefined : mergedFilters.sign,
        active: mergedFilters.active,
        sort: mergedFilters.sort,
      });

      setMediaLibrary(response.items);
      setMediaLibraryPagination(response.pagination);
      setMediaFilters((prev) => ({ ...prev, ...mergedFilters }));

      if (selectedMediaFileId && !response.items.some((item) => item.id === selectedMediaFileId)) {
        setSelectedMediaFileId(response.items[0]?.id ?? null);
      }

      return response;
    } catch (error) {
      showError(`Nie udało się pobrać Media Library: ${String(error)}`);
      return null;
    } finally {
      setMediaLibraryLoading(false);
    }
  };

  const loadAll = async (): Promise<void> => {
    setLoading(true);
    try {
      const [
        summaryResult,
        diagnosticsResult,
        workflowsResult,
        topicsResult,
        mediaAssetsResult,
        mediaUsageResult,
        runsResult,
        settingsResult,
        socialTicketsResult,
        auditResult,
        strategyPlanResult,
        performanceResult,
        homepageRecommendationsResult,
        autonomyResult,
        generationJobsResult,
        videoAssetsResult,
        adCampaignPlansResult,
        growthExperimentsResult,
        providerStatusesResult,
        productionReadinessResult,
      ] = await Promise.all([
        runOptionalRequest(api.getDashboard(client)),
        runOptionalRequest(api.getDiagnostics(client)),
        runOptionalRequest(api.getWorkflows(client)),
        runOptionalRequest(api.getTopics(client)),
        runOptionalRequest(api.getMediaAssets(client)),
        runOptionalRequest(api.getMediaUsage(client, 120)),
        runOptionalRequest(api.getRuns(client, { limit: 200 })),
        runOptionalRequest(api.getSettings(client)),
        runOptionalRequest(api.getSocialTickets(client, { limit: 200 })),
        runOptionalRequest(api.getAuditPreflight(client)),
        runOptionalRequest(api.getStrategyPlan(client, { limit: 50 })),
        runOptionalRequest(api.getPerformance(client, { limit: 50 })),
        runOptionalRequest(api.getHomepageRecommendations(client, { limit: 20 })),
        runOptionalRequest(api.getAutonomyStatus(client)),
        runOptionalRequest(api.getGenerationJobs(client, { limit: 50 })),
        runOptionalRequest(api.getVideoAssets(client, { limit: 50 })),
        runOptionalRequest(api.getAdCampaignPlans(client, { limit: 50 })),
        runOptionalRequest(api.getGrowthExperiments(client, { limit: 50 })),
        runOptionalRequest(api.getProviderStatus(client, { limit: 100 })),
        runOptionalRequest(api.getProductionReadiness(client)),
      ]);

      const coreErrors: string[] = [];
      let nextCoreState: OpsState = 'ready';

      if (summaryResult.ok) {
        setSummary(summaryResult.data);
      } else {
        setSummary(null);
        const message = `Dashboard API: ${summaryResult.error}`;
        coreErrors.push(message);
        nextCoreState = mergeOpsState(nextCoreState, toOpsStateFromErrorMessage(message));
      }

      if (diagnosticsResult.ok) {
        setDiagnostics(diagnosticsResult.data);
      } else {
        setDiagnostics(null);
        const message = `Diagnostics API: ${diagnosticsResult.error}`;
        coreErrors.push(message);
        nextCoreState = mergeOpsState(nextCoreState, toOpsStateFromErrorMessage(message));
      }

      if (workflowsResult.ok) {
        setWorkflows(workflowsResult.data);
      } else {
        setWorkflows([]);
        const message = `Workflows API: ${workflowsResult.error}`;
        coreErrors.push(message);
        nextCoreState = mergeOpsState(nextCoreState, toOpsStateFromErrorMessage(message));
      }

      if (topicsResult.ok) {
        setTopics(topicsResult.data);
      } else {
        setTopics([]);
        const message = `Topics API: ${topicsResult.error}`;
        coreErrors.push(message);
        nextCoreState = mergeOpsState(nextCoreState, toOpsStateFromErrorMessage(message));
      }

      if (mediaAssetsResult.ok) {
        setMediaAssets(mediaAssetsResult.data);
      } else {
        setMediaAssets([]);
        const message = `Media Assets API: ${mediaAssetsResult.error}`;
        coreErrors.push(message);
        nextCoreState = mergeOpsState(nextCoreState, toOpsStateFromErrorMessage(message));
      }

      if (mediaUsageResult.ok) {
        setMediaUsage(mediaUsageResult.data);
      } else {
        setMediaUsage([]);
        const message = `Media Usage API: ${mediaUsageResult.error}`;
        coreErrors.push(message);
        nextCoreState = mergeOpsState(nextCoreState, toOpsStateFromErrorMessage(message));
      }

      if (runsResult.ok) {
        setRuns(runsResult.data);
      } else {
        setRuns([]);
        const message = `Runs API: ${runsResult.error}`;
        coreErrors.push(message);
        nextCoreState = mergeOpsState(nextCoreState, toOpsStateFromErrorMessage(message));
      }

      if (settingsResult.ok) {
        setSettings(settingsResult.data);
      } else {
        setSettings({
          timezone: 'Europe/Warsaw',
          locale: 'pl',
          image_gen_model: 'openai/gpt-image-2',
          imageGenApiToken: '',
          aico_auto_publish_enabled: true,
          aico_strategy_autopilot_enabled: false,
        });
        const message = `Settings API: ${settingsResult.error}`;
        coreErrors.push(message);
        nextCoreState = mergeOpsState(nextCoreState, toOpsStateFromErrorMessage(message));
      }

      if (strategyPlanResult.ok) {
        setStrategyPlan(strategyPlanResult.data);
      } else {
        setStrategyPlan([]);
      }

      if (performanceResult.ok) {
        setPerformanceSnapshots(performanceResult.data);
      } else {
        setPerformanceSnapshots([]);
      }

      if (homepageRecommendationsResult.ok) {
        setHomepageRecommendations(homepageRecommendationsResult.data);
      } else {
        setHomepageRecommendations([]);
      }

      setAutonomyStatus(autonomyResult.ok ? autonomyResult.data : null);
      setGenerationJobs(generationJobsResult.ok ? generationJobsResult.data : []);
      setVideoAssets(videoAssetsResult.ok ? videoAssetsResult.data : []);
      setAdCampaignPlans(adCampaignPlansResult.ok ? adCampaignPlansResult.data : []);
      setGrowthExperiments(growthExperimentsResult.ok ? growthExperimentsResult.data : []);
      setProviderStatuses(providerStatusesResult.ok ? providerStatusesResult.data : []);
      setProductionReadiness(productionReadinessResult.ok ? productionReadinessResult.data : null);

      if (socialTicketsResult.ok) {
        setSocialTickets(socialTicketsResult.data);
        setSocialOpsState('ready');
        setSocialOpsMessage(null);
      } else {
        const message = `Social API: ${socialTicketsResult.error}`;
        setSocialTickets([]);
        setSocialOpsState(toOpsStateFromErrorMessage(message));
        setSocialOpsMessage(message);
      }

      if (auditResult.ok) {
        setAuditReport(auditResult.data);
        setAuditOpsState(toOpsStateFromAuditDecision(auditResult.data.decision));
        setAuditOpsMessage(null);
      } else {
        const message = `Audit API: ${auditResult.error}`;
        setAuditReport(null);
        setAuditOpsState(toOpsStateFromErrorMessage(message));
        setAuditOpsMessage(message);
      }

      if (coreErrors.length > 0) {
        setCoreOpsState(nextCoreState);
        setCoreOpsMessage(coreErrors.join(' | '));
      } else {
        setCoreOpsState('ready');
        setCoreOpsMessage(null);
      }

      await loadMediaLibrary();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (
      activeTab !== 'runs' &&
      activeTab !== 'workflows' &&
      !hasLiveActivity &&
      runningWorkflowIds.length === 0
    ) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void refreshMonitoringData(false);
    }, 4000);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeTab, hasLiveActivity, runningWorkflowIds.length]);

  useEffect(() => {
    if (!selectedMediaFile) {
      setIdentityPreview(null);
      return;
    }

    let canceled = false;
    void api
      .previewMediaIdentity(client, {
        fileId: selectedMediaFile.id,
        purpose: mediaAssetForm.purpose,
        sign_slug: mediaAssetForm.sign_slug.trim() || selectedMediaFile.suggestion.sign_slug,
        period_scope: mediaAssetForm.period_scope,
        excludeId: selectedMediaFile.mapping?.id ?? null,
      })
      .then((preview) => {
        if (!canceled) {
          setIdentityPreview(preview);
        }
      })
      .catch(() => {
        if (!canceled) {
          setIdentityPreview(null);
        }
      });

    return () => {
      canceled = true;
    };
  }, [
    client,
    selectedMediaFile?.id,
    selectedMediaFile?.mapping?.id,
    mediaAssetForm.purpose,
    mediaAssetForm.sign_slug,
    mediaAssetForm.period_scope,
  ]);

  const resetWorkflowForm = (): void => {
    setWorkflowForm(initialWorkflowForm());
    setEditingWorkflowId(null);
    setWorkflowStep(0);
    setSocialConnectionResult(null);
    setSocialDryRunResult(null);
  };

  const onPickWorkflowToEdit = (workflow: Workflow): void => {
    setEditingWorkflowId(workflow.id);
    setSocialConnectionResult(null);
    setSocialDryRunResult(null);
    setWorkflowForm({
      name: workflow.name,
      enabled: workflow.enabled,
      workflow_type: workflow.workflow_type,
      generate_cron: workflow.generate_cron,
      publish_cron: workflow.publish_cron,
      timezone: workflow.timezone || 'Europe/Warsaw',
      locale: workflow.locale || 'pl',
      llm_model: workflow.llm_model,
      apiToken: '',
      prompt_template: workflow.prompt_template,
      temperature: workflow.temperature,
      max_completion_tokens: workflow.max_completion_tokens,
      retry_max: workflow.retry_max,
      retry_backoff_seconds: workflow.retry_backoff_seconds,
      daily_request_limit: workflow.daily_request_limit,
      daily_token_limit: workflow.daily_token_limit,
      allow_manual_edit: Boolean(workflow.allow_manual_edit),
      auto_publish: Boolean(workflow.auto_publish),
      force_regenerate: Boolean(workflow.force_regenerate),
      strategy_enabled: Boolean(workflow.strategy_enabled),
      performance_feedback_enabled: workflow.performance_feedback_enabled !== false,
      content_cluster: workflow.content_cluster || '',
      auto_publish_guardrails: formatJsonForTextarea(workflow.auto_publish_guardrails, {
        minSeoScore: 70,
        requireTargetUrl: true,
        maxSocialFailures: 0,
      }),
      topic_mode: workflow.topic_mode || 'mixed',
      horoscope_period: workflow.horoscope_period || 'Dzienny',
      horoscope_type_values: Array.isArray(workflow.horoscope_type_values)
        ? workflow.horoscope_type_values.join(', ')
        : 'Ogólny',
      all_signs: Boolean(workflow.all_signs),
      article_category: workflow.article_category?.toString() || '',
      image_gen_model: workflow.image_gen_model ?? 'openai/gpt-image-2',
      imageGenApiToken: '',
      enabled_channels: Array.isArray(workflow.enabled_channels)
        ? workflow.enabled_channels
        : ['facebook', 'instagram', 'twitter'],
      fb_page_id: workflow.fb_page_id || '',
      fbAccessToken: '',
      ig_user_id: workflow.ig_user_id || '',
      igAccessToken: '',
      x_api_key: workflow.x_api_key || '',
      xApiSecret: '',
      xAccessToken: '',
      xAccessTokenSecret: '',
      tt_creator_id: workflow.tt_creator_id || '',
      ttAccessToken: '',
    });
    setWorkflowStep(0);
  };

  const buildWorkflowPayload = (): Record<string, unknown> => {
    const {
      apiToken,
      imageGenApiToken,
      fbAccessToken,
      igAccessToken,
      xApiSecret,
      xAccessToken,
      xAccessTokenSecret,
      ttAccessToken,
      auto_publish_guardrails,
      ...data
    } = workflowForm;

    const guardrails = parseJsonObject(auto_publish_guardrails);
    if (!guardrails) {
      throw new Error('Auto-publish guardrails muszą być poprawnym obiektem JSON.');
    }

    const payload: Record<string, unknown> = {
      ...data,
      content_cluster: data.content_cluster.trim() || null,
      auto_publish_guardrails: guardrails,
      horoscope_type_values: data.horoscope_type_values
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
      article_category: data.article_category ? Number(data.article_category) : null,
    };

    if (apiToken.trim()) payload.apiToken = apiToken.trim();
    if (imageGenApiToken.trim()) payload.imageGenApiToken = imageGenApiToken.trim();
    if (fbAccessToken.trim()) payload.fbAccessToken = fbAccessToken.trim();
    if (igAccessToken.trim()) payload.igAccessToken = igAccessToken.trim();
    if (xApiSecret.trim()) payload.xApiSecret = xApiSecret.trim();
    if (xAccessToken.trim()) payload.xAccessToken = xAccessToken.trim();
    if (xAccessTokenSecret.trim()) payload.xAccessTokenSecret = xAccessTokenSecret.trim();
    if (ttAccessToken.trim()) payload.ttAccessToken = ttAccessToken.trim();

    return payload;
  };

  const persistWorkflowDraft = async ({
    silent = false,
    resetAfterSave = false,
  }: {
    silent?: boolean;
    resetAfterSave?: boolean;
  } = {}): Promise<number | null> => {
    if (!workflowForm.name.trim()) {
      setWorkflowStep(0);
      showError('Nazwa workflow jest wymagana.');
      return null;
    }

    if (!workflowForm.prompt_template.trim()) {
      setWorkflowStep(2);
      showError('Prompt Template jest wymagany.');
      return null;
    }

    if (socialStepValidationIssues.length > 0) {
      setWorkflowStep(3);
      showError('Konfiguracja social wymaga uzupełnienia.');
      return null;
    }

    setSaving(true);

    try {
      const payload = buildWorkflowPayload();
      const workflow = editingWorkflowId
        ? await api.updateWorkflow(client, editingWorkflowId, payload)
        : await api.createWorkflow(client, payload);

      setEditingWorkflowId(workflow.id);

      if (editingWorkflowId) {
        if (!silent) {
          showSuccess('Workflow zaktualizowany.');
        }
      } else {
        if (!silent) {
          showSuccess('Workflow utworzony.');
        }
      }

      await refreshMonitoringData();
      if (resetAfterSave) {
        resetWorkflowForm();
      }
      return workflow.id;
    } catch (error) {
      showError(`Nie udało się zapisać workflow: ${String(error)}`);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveWorkflow = async (): Promise<void> => {
    await persistWorkflowDraft({ resetAfterSave: true });
  };

  const runNow = async (workflowId: number): Promise<void> => {
    if (
      !window.confirm(
        'Uruchomić ten przepływ teraz? Może to wygenerować treści i uruchomić płatne operacje.'
      )
    ) {
      return;
    }
    setRunningWorkflowIds((prev) => (prev.includes(workflowId) ? prev : [...prev, workflowId]));
    setWorkflows((prev) =>
      prev.map((workflow) =>
        workflow.id === workflowId ? { ...workflow, status: 'running', last_error: null } : workflow
      )
    );

    try {
      await api.runNow(client, workflowId);
      showSuccess(`Workflow #${workflowId} uruchomiony. Monitoring odświeża się w tle.`);
      window.setTimeout(() => {
        void refreshMonitoringData(false);
      }, 700);
      window.setTimeout(() => {
        void refreshMonitoringData(false);
      }, 2500);
    } catch (error) {
      showError(`Run now nie powiódł się: ${String(error)}`);
      setRunningWorkflowIds((prev) => prev.filter((id) => id !== workflowId));
      await refreshMonitoringData();
    }
  };

  const createTopic = async (): Promise<void> => {
    if (!topicForm.title.trim()) {
      showError('Tytuł tematu jest wymagany.');
      return;
    }

    if (selectedTopicWorkflow?.workflow_type === 'article' && !topicForm.image_asset_key.trim()) {
      showError('Dla workflow article wybierz obraz z Media Catalog.');
      return;
    }

    setSaving(true);

    try {
      await api.createTopic(client, {
        title: topicForm.title.trim(),
        brief: topicForm.brief.trim() || undefined,
        image_asset_key: topicForm.image_asset_key.trim() || undefined,
        workflow: topicForm.workflow ? Number(topicForm.workflow) : undefined,
        article_category: topicForm.article_category
          ? Number(topicForm.article_category)
          : undefined,
        scheduled_for: topicForm.scheduled_for || undefined,
      });

      setTopicForm(initialTopicForm());
      showSuccess('Temat dodany do kolejki.');
      await loadAll();
    } catch (error) {
      showError(`Nie udało się dodać tematu: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteTopic = async (id: number): Promise<void> => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten temat?')) return;
    setSaving(true);
    try {
      await api.deleteTopic(client, id);
      showSuccess('Temat usunięty.');
      await loadAll();
    } catch (error) {
      showError(`Błąd podczas usuwania tematu: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const retryRun = async (runId: number): Promise<void> => {
    setSaving(true);

    try {
      await api.retryRun(client, runId);
      showSuccess(`Retry run #${runId} uruchomiony.`);
      await loadAll();
    } catch (error) {
      showError(`Retry run nie powiódł się: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const refreshSocialTickets = async (): Promise<void> => {
    try {
      const items = await api.getSocialTickets(client, { limit: 200 });
      setSocialTickets(items);
      setSocialOpsState('ready');
      setSocialOpsMessage(null);
    } catch (error) {
      const message = `Nie udało się pobrać ticketów social: ${String(error)}`;
      setSocialOpsState(toOpsStateFromErrorMessage(message));
      setSocialOpsMessage(message);
      showError(message);
    }
  };

  const resolveWorkflowIdForSocialAction = async (): Promise<number | null> =>
    persistWorkflowDraft({ silent: true, resetAfterSave: false });

  const testWorkflowSocialConnection = async (): Promise<void> => {
    const workflowId = await resolveWorkflowIdForSocialAction();
    if (!workflowId) return;

    setSaving(true);
    try {
      const result = await api.testSocialConnection(client, {
        workflowId,
        channels: workflowForm.enabled_channels,
      });
      setSocialConnectionResult(result);
      setSocialOpsState(toOpsStateFromSocialOverall(result.overall));
      setSocialOpsMessage(result.overall === 'ready' ? null : `Test connection: ${result.overall}`);
      showSuccess(`Test połączeń zakończony: ${result.overall.toUpperCase()}`);
    } catch (error) {
      const message = `Test połączeń nie powiódł się: ${String(error)}`;
      setSocialOpsState(toOpsStateFromErrorMessage(message));
      setSocialOpsMessage(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const dryRunWorkflowSocial = async (): Promise<void> => {
    const workflowId = await resolveWorkflowIdForSocialAction();
    if (!workflowId) return;

    setSaving(true);
    try {
      const result = await api.dryRunSocial(client, {
        workflowId,
        channels: workflowForm.enabled_channels,
        caption: 'Test autopublikacji Star Sign',
        mediaUrl: 'https://star-sign.pl/assets/og-default.png',
        targetUrl: 'https://star-sign.pl',
      });
      setSocialDryRunResult(result);
      setSocialOpsState(toOpsStateFromSocialOverall(result.overall));
      setSocialOpsMessage(result.overall === 'ready' ? null : `Dry run: ${result.overall}`);
      showSuccess(`Dry-run zakończony: ${result.overall.toUpperCase()}`);
    } catch (error) {
      const message = `Dry-run nie powiódł się: ${String(error)}`;
      setSocialOpsState(toOpsStateFromErrorMessage(message));
      setSocialOpsMessage(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const retrySocialTicket = async (ticketId: number): Promise<void> => {
    setSaving(true);
    try {
      await api.retrySocialTicket(client, ticketId);
      await refreshSocialTickets();
      showSuccess(`Ticket #${ticketId} ustawiony do ponowienia.`);
    } catch (error) {
      showError(`Nie udało się ponowić ticketu #${ticketId}: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const cancelSocialTicket = async (ticketId: number): Promise<void> => {
    setSaving(true);
    try {
      await api.cancelSocialTicket(client, ticketId);
      await refreshSocialTickets();
      showSuccess(`Ticket #${ticketId} anulowany.`);
    } catch (error) {
      showError(`Nie udało się anulować ticketu #${ticketId}: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const runPreflightAudit = async (strict: boolean): Promise<void> => {
    setSaving(true);
    try {
      const report = await api.runAuditPreflight(client, strict);
      setAuditReport(report);
      setAuditOpsState(toOpsStateFromAuditDecision(report.decision));
      setAuditOpsMessage(
        report.decision === 'GO'
          ? null
          : report.decision === 'GO_WITH_WARNINGS'
            ? 'Audit wykrył ostrzeżenia wymagające działania.'
            : 'Audit wykrył krytyczne braki (NO_GO).'
      );
      if (report.decision === 'NO_GO') {
        showError('Audit zakończony decyzją NO_GO.');
      } else {
        showSuccess(`Audit zakończony: ${report.decision}`);
      }
    } catch (error) {
      const message = `Audit preflight nie powiódł się: ${String(error)}`;
      setAuditOpsState(toOpsStateFromErrorMessage(message));
      setAuditOpsMessage(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleRunDetails = (runId: number): void => {
    setExpandedRunIds((prev) =>
      prev.includes(runId) ? prev.filter((id) => id !== runId) : [...prev, runId]
    );
  };

  const refreshGrowthData = async (): Promise<void> => {
    const [
      planResult,
      performanceResult,
      homepageResult,
      autonomyResult,
      generationJobsResult,
      videoAssetsResult,
      adCampaignPlansResult,
      growthExperimentsResult,
      providerStatusesResult,
      productionReadinessResult,
    ] = await Promise.all([
      runOptionalRequest(api.getStrategyPlan(client, { limit: 50 })),
      runOptionalRequest(api.getPerformance(client, { limit: 50 })),
      runOptionalRequest(api.getHomepageRecommendations(client, { limit: 20 })),
      runOptionalRequest(api.getAutonomyStatus(client)),
      runOptionalRequest(api.getGenerationJobs(client, { limit: 50 })),
      runOptionalRequest(api.getVideoAssets(client, { limit: 50 })),
      runOptionalRequest(api.getAdCampaignPlans(client, { limit: 50 })),
      runOptionalRequest(api.getGrowthExperiments(client, { limit: 50 })),
      runOptionalRequest(api.getProviderStatus(client, { limit: 100 })),
      runOptionalRequest(api.getProductionReadiness(client)),
    ]);

    if (planResult.ok) setStrategyPlan(planResult.data);
    if (performanceResult.ok) setPerformanceSnapshots(performanceResult.data);
    if (homepageResult.ok) setHomepageRecommendations(homepageResult.data);
    if (autonomyResult.ok) setAutonomyStatus(autonomyResult.data);
    if (generationJobsResult.ok) setGenerationJobs(generationJobsResult.data);
    if (videoAssetsResult.ok) setVideoAssets(videoAssetsResult.data);
    if (adCampaignPlansResult.ok) setAdCampaignPlans(adCampaignPlansResult.data);
    if (growthExperimentsResult.ok) setGrowthExperiments(growthExperimentsResult.data);
    if (providerStatusesResult.ok) setProviderStatuses(providerStatusesResult.data);
    if (productionReadinessResult.ok) setProductionReadiness(productionReadinessResult.data);

    if (
      !planResult.ok ||
      !performanceResult.ok ||
      !homepageResult.ok ||
      !autonomyResult.ok ||
      !generationJobsResult.ok ||
      !videoAssetsResult.ok ||
      !adCampaignPlansResult.ok ||
      !growthExperimentsResult.ok ||
      !providerStatusesResult.ok ||
      !productionReadinessResult.ok
    ) {
      showError('Część danych Growth Ops nie załadowała się. Sprawdź uprawnienia i backend.');
    }
  };

  const runProviderReadinessProbe = async (): Promise<void> => {
    setSaving(true);
    try {
      const result = await api.testProviderReadiness(client, { includeConnectivity: false });
      setProviderProbeResult(result);
      await refreshGrowthData();
      showSuccess(`Provider preflight zapisał ${result.results.length} statusów readiness.`);
    } catch (error) {
      showError(`Provider preflight nie powiódł się: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const refreshVideoAssets = async (): Promise<void> => {
    setVideoLoading(true);
    try {
      const items = await api.getVideoAssets(client, { limit: 50 });
      setVideoAssets(items);
    } catch (error) {
      showError(`Nie udało się pobrać materiałów wideo: ${getErrorMessage(error)}`);
    } finally {
      setVideoLoading(false);
    }
  };

  const createVideoJob = async (payload: VideoJobPayload): Promise<void> => {
    setVideoCreating(true);
    try {
      await api.createVideoJob(client, payload);
      showSuccess('Zlecenie wideo zostało utworzone.');
      await refreshVideoAssets();
    } catch (error) {
      showError(`Nie udało się utworzyć zlecenia wideo: ${getErrorMessage(error)}`);
    } finally {
      setVideoCreating(false);
    }
  };

  const renderVideo = async (id: number): Promise<void> => {
    setVideoBusyAssetId(id);
    try {
      await api.renderVideoAsset(client, id);
      showSuccess(`Renderowanie materiału #${id} zostało uruchomione.`);
      await refreshVideoAssets();
    } catch (error) {
      showError(`Nie udało się wyrenderować materiału #${id}: ${getErrorMessage(error)}`);
    } finally {
      setVideoBusyAssetId(null);
    }
  };

  const publishVideo = async (id: number): Promise<void> => {
    setVideoBusyAssetId(id);
    try {
      const result = await api.publishVideoAsset(client, id);
      const blockedSuffix = result.blocked ? `, zablokowano: ${result.blocked}` : '';
      showSuccess(
        `Opublikowano: utworzono ${result.created}, pominięto ${result.skipped}${blockedSuffix}`
      );
      await refreshVideoAssets();
    } catch (error) {
      showError(`Nie udało się opublikować materiału #${id}: ${getErrorMessage(error)}`);
    } finally {
      setVideoBusyAssetId(null);
    }
  };

  const pollVideoRenders = async (): Promise<void> => {
    setVideoPolling(true);
    try {
      const result = await api.pollVideoRenders(client);
      showSuccess(
        `Sprawdzono ${result.checked}: gotowe ${result.completed}, błędy ${result.failed}, w toku ${result.pending}`
      );
      await refreshVideoAssets();
    } catch (error) {
      showError(`Nie udało się sprawdzić renderów: ${getErrorMessage(error)}`);
    } finally {
      setVideoPolling(false);
    }
  };

  const runControlledAutonomyTick = async (): Promise<void> => {
    if (productionReadiness?.decision !== 'GO') {
      showError('Production readiness musi mieć decyzję GO.');
      return;
    }

    if (runNowConfirmation.trim() !== RUN_NOW_CONFIRMATION) {
      showError('Potwierdzenie run-now jest niepoprawne.');
      return;
    }

    setSaving(true);
    try {
      const result = await api.runAutonomyTickNow(client, {
        live: true,
        mode: 'controlled_live',
        confirmation: RUN_NOW_CONFIRMATION,
      });
      setRunNowConfirmation('');
      await refreshGrowthData();
      showSuccess(`Controlled run-now zakończony: ${String(result.runNowMode ?? 'done')}.`);
    } catch (error) {
      showError(`Controlled run-now nie powiódł się: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const runAdsStopLoss = async (): Promise<void> => {
    if (adsStopLossConfirmation.trim() !== ADS_STOP_LOSS_CONFIRMATION) {
      showError('Potwierdzenie ads stop-loss jest niepoprawne.');
      return;
    }

    setSaving(true);
    try {
      const result = await api.pauseActiveAdCampaignPlans(client, {
        confirmation: ADS_STOP_LOSS_CONFIRMATION,
      });
      setAdsStopLossConfirmation('');
      await refreshGrowthData();
      showSuccess(
        `Stop-loss reklam: przetworzono ${result.attempted}, wstrzymano ${result.paused}, zablokowano ${result.blocked}, błędy ${result.failed}.`
      );
    } catch (error) {
      showError(`Ads stop-loss nie powiódł się: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const importGa4Traffic = async (): Promise<void> => {
    setSaving(true);
    try {
      const result = await api.importTraffic(client, { source: 'ga4' });
      await refreshGrowthData();
      showSuccess(`GA4 traffic import zapisany: ${String(result.uniqueKey ?? 'snapshot')}.`);
    } catch (error) {
      showError(`GA4 traffic import nie powiódł się: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const generateStrategyPlan = async (): Promise<void> => {
    setSaving(true);
    try {
      const result = await api.generateStrategyPlan(client, {
        weekStart: strategyForm.weekStart || undefined,
        limit: strategyForm.limit,
        workflowId: strategyForm.workflowId ? Number(strategyForm.workflowId) : undefined,
        autoApprove: strategyForm.autoApprove,
      });
      setStrategyGenerateResult(result);
      setStrategyApproveResult(null);
      setStrategyPlan((prev) => [...result.items, ...prev]);
      showSuccess(`Strategy Agent utworzył ${result.created} pozycji planu.`);
      await refreshGrowthData();
    } catch (error) {
      showError(`Strategy Agent nie utworzył planu: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const approveStrategyPlan = async (): Promise<void> => {
    const ids = strategyPlan
      .filter((item) => item.status === 'planned' || item.status === 'approved')
      .slice(0, strategyForm.limit)
      .map((item) => item.id);

    if (ids.length === 0) {
      showError('Brak pozycji planu do zatwierdzenia.');
      return;
    }

    setSaving(true);
    try {
      const result = await api.approveStrategyPlan(client, { ids, limit: strategyForm.limit });
      setStrategyApproveResult(result);
      showSuccess(`Zatwierdzono plan: ${result.queued} tematów trafiło do kolejki.`);
      await loadAll();
    } catch (error) {
      showError(`Nie udało się zatwierdzić planu: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const aggregatePerformance = async (): Promise<void> => {
    setSaving(true);
    try {
      const result = await api.aggregatePerformance(client, {
        day: performanceForm.day || undefined,
        limit: performanceForm.limit,
      });
      setPerformanceAggregateResult(result);
      setPerformanceSnapshots(result.snapshots);
      showSuccess(`Performance feedback przetworzył ${result.processed} rekordów.`);
    } catch (error) {
      showError(`Agregacja performance nie powiodła się: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const runHomepageRecommendations = async (): Promise<void> => {
    setSaving(true);
    try {
      const result = await api.runHomepageRecommendations(client, { limit: homepageForm.limit });
      setHomepageRunResult(result as Record<string, unknown>);
      await refreshGrowthData();
      showSuccess('Rekomendacje homepage zostały przeliczone.');
    } catch (error) {
      showError(`Nie udało się przeliczyć homepage recommendations: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (): Promise<void> => {
    setSaving(true);

    try {
      await api.updateSettings(client, settings);
      showSuccess('Ustawienia zapisane.');
      await loadAll();
    } catch (error) {
      showError(`Nie udało się zapisać ustawień: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const mapAssetToForm = (item: MediaAsset): MediaAssetFormState => {
    return {
      asset_key: item.asset_key,
      label: item.label,
      purpose: item.purpose,
      sign_slug: item.sign_slug || '',
      period_scope: item.period_scope || 'any',
      keywords: Array.isArray(item.keywords) ? item.keywords.join(', ') : '',
      priority: item.priority ?? 0,
      active: item.active ?? true,
      cooldown_days: item.cooldown_days ?? 3,
      notes: item.notes || '',
    };
  };

  const mapSuggestionToForm = (item: MediaLibraryFile): MediaAssetFormState => {
    return {
      asset_key: item.suggestion.asset_key,
      label: item.suggestion.label || item.name,
      purpose: item.suggestion.purpose,
      sign_slug: item.suggestion.sign_slug || '',
      period_scope: item.suggestion.period_scope,
      keywords: (item.suggestion.keywords || []).join(', '),
      priority: 0,
      active: true,
      cooldown_days: 3,
      notes: '',
    };
  };

  const refreshMediaCatalogData = async (): Promise<void> => {
    const [mediaAssetsData, mediaUsageData] = await Promise.all([
      api.getMediaAssets(client),
      api.getMediaUsage(client, 120),
    ]);

    setMediaAssets(mediaAssetsData);
    setMediaUsage(mediaUsageData);

    const library = await loadMediaLibrary();
    if (!library || !selectedMediaFileId) {
      return;
    }

    const selected = library.items.find((item) => item.id === selectedMediaFileId);
    if (!selected) {
      return;
    }

    setMediaAssetForm(
      selected.mapping ? mapAssetToForm(selected.mapping) : mapSuggestionToForm(selected)
    );
  };

  const pickMediaFile = (item: MediaLibraryFile): void => {
    setSelectedMediaFileId(item.id);
    setBulkPreview(null);
    if (item.mapping) {
      setMediaAssetForm(mapAssetToForm(item.mapping));
    } else {
      setMediaAssetForm(mapSuggestionToForm(item));
    }
  };

  const toggleBulkSelection = (fileId: number): void => {
    setBulkSelectedFileIds((prev) => {
      if (prev.includes(fileId)) {
        return prev.filter((id) => id !== fileId);
      }
      return [...prev, fileId];
    });
  };

  const buildBulkItems = (): MediaBulkUpsertItemRequest[] => {
    const selected = mediaLibrary.filter((item) => bulkSelectedFileIds.includes(item.id));
    return selected.map((item) => ({
      fileId: item.id,
      purpose: item.suggestion.purpose,
      sign_slug: item.suggestion.sign_slug,
      period_scope: item.suggestion.period_scope,
      keywords: item.suggestion.keywords,
      priority: item.mapping?.priority ?? 0,
      active: item.mapping?.active ?? true,
      cooldown_days: item.mapping?.cooldown_days ?? 3,
      notes: item.mapping?.notes ?? null,
    }));
  };

  const previewBulkMapping = async (): Promise<void> => {
    if (bulkSelectedFileIds.length === 0) {
      showError('Zaznacz przynajmniej jeden kafelek.');
      return;
    }

    setSaving(true);
    try {
      const result = await api.bulkUpsertMediaAssets(client, {
        items: buildBulkItems(),
        dryRun: true,
        apply: false,
      });
      setBulkPreview(result);
      showSuccess('Podgląd zmian bulk gotowy.');
    } catch (error) {
      showError(`Podgląd bulk nie powiódł się: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const applyBulkMapping = async (): Promise<void> => {
    if (bulkSelectedFileIds.length === 0) {
      showError('Zaznacz przynajmniej jeden kafelek.');
      return;
    }

    setSaving(true);
    try {
      const result = await api.bulkUpsertMediaAssets(client, {
        items: buildBulkItems(),
        dryRun: false,
        apply: true,
      });
      setBulkPreview(result);
      showSuccess('Bulk mapowanie zapisane.');
      await refreshMediaCatalogData();
    } catch (error) {
      showError(`Bulk mapowanie nie powiodło się: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const saveMediaMapping = async (): Promise<void> => {
    if (!selectedMediaFile) {
      showError('Wybierz zdjęcie z kafelka.');
      return;
    }

    const existingMappingId = selectedMediaFile.mapping?.id ?? null;

    setSaving(true);

    const payload: Record<string, unknown> = {
      purpose: mediaAssetForm.purpose,
      sign_slug: mediaAssetForm.sign_slug.trim() || null,
      period_scope: mediaAssetForm.period_scope,
      keywords: mediaAssetForm.keywords
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
      priority: Number(mediaAssetForm.priority) || 0,
      active: mediaAssetForm.active,
      cooldown_days: Number(mediaAssetForm.cooldown_days) || 3,
      asset: selectedMediaFile.id,
      mapping_source: 'manual',
      mapping_confidence: selectedMediaFile.suggestion.confidence,
      mapping_reasons: selectedMediaFile.suggestion.reasons,
      notes: mediaAssetForm.notes.trim() || null,
    };

    try {
      if (existingMappingId) {
        await api.updateMediaAsset(client, existingMappingId, payload);
        showSuccess('Media asset zaktualizowany.');
      } else {
        await api.createMediaAsset(client, payload);
        showSuccess('Media asset utworzony.');
      }

      await refreshMediaCatalogData();
    } catch (error) {
      showError(`Nie udało się zapisać media asset: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteMediaMapping = async (id: number): Promise<void> => {
    if (!window.confirm('Czy na pewno chcesz usunąć to mapowanie?')) return;
    setSaving(true);
    try {
      await api.deleteMediaAsset(client, id);
      showSuccess('Mapowanie usunięte.');
      await refreshMediaCatalogData();
    } catch (error) {
      showError(`Błąd podczas usuwania mapowania: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const goToMediaPage = async (page: number): Promise<void> => {
    await loadMediaLibrary({ page });
  };

  const refreshMediaGrid = async (): Promise<void> => {
    await loadMediaLibrary({ page: 1 });
  };

  const validateCoverage = async (applyWorkflowDisabling = false): Promise<void> => {
    if (applyWorkflowDisabling) {
      const confirmed = window.confirm(
        'To może wyłączyć workflow bez kompletnego pokrycia mediów. Kontynuować?'
      );

      if (!confirmed) {
        return;
      }
    }

    setSaving(true);
    try {
      await api.validateMediaCoverage(client, { applyWorkflowDisabling });
      showSuccess('Walidacja pokrycia mediów zakończona.');
      await loadAll();
    } catch (error) {
      showError(`Walidacja pokrycia nie powiodła się: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const backfillImages = async (kind: 'article' | 'tarot' | 'zodiac'): Promise<void> => {
    const labels: Record<typeof kind, string> = {
      article: 'artykułów',
      tarot: 'kart tarota',
      zodiac: 'znaków zodiaku',
    };

    if (
      !window.confirm(
        `Wygenerować brakujące zdjęcia (${labels[kind]})? To uruchomi płatną generację obrazów.`
      )
    ) {
      return;
    }

    setBackfillingImages(kind);
    try {
      const result =
        kind === 'article'
          ? await api.backfillArticleImages(client)
          : kind === 'tarot'
            ? await api.backfillTarotCardImages(client)
            : await api.backfillZodiacSignImages(client);

      showSuccess(
        `Uzupełniono zdjęcia ${labels[kind]}: ${result.updated} z ${result.attempted} (pominięto ${result.skipped}, błędy ${result.failed}).`
      );
    } catch (error) {
      showError(`Uzupełnianie zdjęć ${labels[kind]} nie powiodło się: ${String(error)}`);
    } finally {
      setBackfillingImages(null);
    }
  };

  useEffect(() => {
    if (!selectedMediaFile && mediaLibrary[0]) {
      pickMediaFile(mediaLibrary[0]);
    }
  }, [mediaLibrary]);

  const renderWorkflowModal = () => (
    <Modal
      title={editingWorkflowId ? `Edycja Workflow: ${workflowForm.name}` : 'Nowy Workflow'}
      isOpen={showWorkflowModal}
      onClose={() => setShowWorkflowModal(false)}
      maxWidth={1000}
      footer={
        <>
          {workflowStep > 0 && (
            <UiButton variant="secondary" onClick={() => setWorkflowStep((prev) => prev - 1)}>
              Poprzedni krok
            </UiButton>
          )}
          {workflowStep < WORKFLOW_STEP_LABELS.length - 1 ? (
            <UiButton
              variant="primary"
              onClick={() => {
                // Basic validation for Step 0
                if (workflowStep === 0 && !workflowForm.name) {
                  showError('Nazwa workflow jest wymagana.');
                  return;
                }
                if (workflowStep === 3 && socialStepValidationIssues.length > 0) {
                  showError('Uzupełnij konfigurację social przed przejściem dalej.');
                  return;
                }
                setWorkflowStep((prev) => prev + 1);
              }}
            >
              Następny krok
            </UiButton>
          ) : (
            <UiButton
              variant="primary"
              disabled={saving}
              loading={saving}
              onClick={() => {
                if (!workflowForm.prompt_template) {
                  showError('Prompt Template jest wymagany.');
                  setWorkflowStep(2);
                  return;
                }
                void saveWorkflow();
              }}
            >
              {saving
                ? 'Zapisywanie...'
                : editingWorkflowId
                  ? 'Zaktualizuj Workflow'
                  : 'Utwórz Workflow'}
            </UiButton>
          )}
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 32 }}>
        <div style={{ borderRight: `1px solid ${COLORS.border}`, paddingRight: 24 }}>
          {WORKFLOW_STEP_LABELS.map((label, idx) => (
            <div
              key={label}
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                background: workflowStep === idx ? COLORS.primaryLight : 'transparent',
                color: workflowStep === idx ? COLORS.primary : COLORS.textLight,
                fontWeight: 700,
                fontSize: 14,
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
              }}
              onClick={() => setWorkflowStep(idx)}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: workflowStep === idx ? COLORS.primary : '#e2e8f0',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                }}
              >
                {idx + 1}
              </div>
              {label}
            </div>
          ))}
        </div>

        <div style={{ minHeight: 400 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: COLORS.text, marginBottom: 24 }}>
            Krok {workflowStep + 1}: {WORKFLOW_STEP_LABELS[workflowStep]}
          </h3>

          {workflowStep === 0 && (
            <div style={{ display: 'grid', gap: 20 }}>
              <UiTextField
                label="Nazwa"
                value={workflowForm.name}
                placeholder="np. Horoskop Dzienny - Główne Wydanie"
                onChange={(e) => setWorkflowForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <UiField label="Typ Workflow">
                  <UiSelect
                    aria-label="Typ Workflow"
                    value={workflowForm.workflow_type}
                    onChange={(value) =>
                      setWorkflowForm((prev) => ({
                        ...prev,
                        workflow_type: value as WorkflowFormState['workflow_type'],
                      }))
                    }
                    options={[
                      { value: 'horoscope', label: 'Horoskop' },
                      { value: 'daily_card', label: 'Karta dnia' },
                      { value: 'article', label: 'Artykuł' },
                    ]}
                  />
                </UiField>
                <UiField label="Tryb Tematów">
                  <UiSelect
                    aria-label="Tryb Tematów"
                    value={workflowForm.topic_mode}
                    onChange={(value) =>
                      setWorkflowForm((prev) => ({
                        ...prev,
                        topic_mode: value as WorkflowFormState['topic_mode'],
                      }))
                    }
                    options={[
                      { value: 'mixed', label: 'Mieszany (Auto + Ręczny)' },
                      { value: 'manual', label: 'Tylko Ręczny' },
                    ]}
                  />
                </UiField>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <UiTextField
                  label="Lokalizacja"
                  value={workflowForm.locale}
                  onChange={(e) => setWorkflowForm((prev) => ({ ...prev, locale: e.target.value }))}
                />
                <UiTextField
                  label="Strefa Czasowa"
                  value={workflowForm.timezone}
                  onChange={(e) =>
                    setWorkflowForm((prev) => ({ ...prev, timezone: e.target.value }))
                  }
                />
              </div>
              <UiCheckbox
                checked={workflowForm.enabled}
                onChange={(checked) => setWorkflowForm((prev) => ({ ...prev, enabled: checked }))}
              >
                Włączony (aktywny)
              </UiCheckbox>
            </div>
          )}

          {workflowStep === 1 && (
            <div style={{ display: 'grid', gap: 24 }}>
              <div
                style={{
                  padding: 16,
                  background: '#f8fafc',
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                  Harmonogram używa formatu <strong>cron</strong> (np. <code>0 8 * * *</code> dla
                  godziny 08:00 każdego dnia).
                </p>
              </div>
              <UiTextField
                label="Harmonogram Generowania"
                value={workflowForm.generate_cron}
                onChange={(e) =>
                  setWorkflowForm((prev) => ({ ...prev, generate_cron: e.target.value }))
                }
              />
              <UiTextField
                label="Harmonogram Publikacji"
                value={workflowForm.publish_cron}
                onChange={(e) =>
                  setWorkflowForm((prev) => ({ ...prev, publish_cron: e.target.value }))
                }
              />
            </div>
          )}

          {workflowStep === 2 && (
            <div style={{ display: 'grid', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <UiTextField
                  label="Model LLM"
                  value={workflowForm.llm_model}
                  onChange={(e) =>
                    setWorkflowForm((prev) => ({ ...prev, llm_model: e.target.value }))
                  }
                />
                <UiTextField
                  label={editingWorkflowId ? 'API Token (Zostaw puste aby zachować)' : 'API Token'}
                  type="password"
                  value={workflowForm.apiToken}
                  onChange={(e) =>
                    setWorkflowForm((prev) => ({ ...prev, apiToken: e.target.value }))
                  }
                />
              </div>

              {workflowForm.workflow_type === 'horoscope' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <UiField label="Okres Horoskopu">
                    <UiSelect
                      aria-label="Okres Horoskopu"
                      value={workflowForm.horoscope_period}
                      onChange={(value) =>
                        setWorkflowForm((prev) => ({
                          ...prev,
                          horoscope_period: value as WorkflowFormState['horoscope_period'],
                        }))
                      }
                      options={[
                        { value: 'Dzienny', label: 'Dzienny' },
                        { value: 'Tygodniowy', label: 'Tygodniowy' },
                        { value: 'Miesięczny', label: 'Miesięczny' },
                        { value: 'Roczny', label: 'Roczny' },
                      ]}
                    />
                  </UiField>
                  <UiTextField
                    label="Typy Horoskopów (oddzielone przecinkiem)"
                    value={workflowForm.horoscope_type_values}
                    onChange={(e) =>
                      setWorkflowForm((prev) => ({
                        ...prev,
                        horoscope_type_values: e.target.value,
                      }))
                    }
                  />
                </div>
              )}

              <UiTextareaField
                label="Szablon promptu (główny kontekst)"
                value={workflowForm.prompt_template}
                onChange={(e) =>
                  setWorkflowForm((prev) => ({ ...prev, prompt_template: e.target.value }))
                }
              />
            </div>
          )}

          {workflowStep === 3 && (
            <div style={{ display: 'grid', gap: 24 }}>
              <div
                style={{
                  padding: 16,
                  background: '#f0f9ff',
                  borderRadius: 12,
                  border: `1px solid #bae6fd`,
                }}
              >
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0369a1', marginBottom: 8 }}>
                  Konfiguracja kanałów social (FB / IG / X)
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: '#0c4a6e', lineHeight: 1.5 }}>
                  Kroki: wybierz kanały, uzupełnij dane dostępowe, uruchom{' '}
                  <strong>Testuj połączenie</strong> i <strong>Próbną publikację</strong>, dopiero
                  potem włącz automatyczną publikację.
                </p>
              </div>
              <WorkflowSocialStep
                workflowForm={workflowForm}
                editingWorkflowId={editingWorkflowId}
                saving={saving}
                socialConnectionResult={socialConnectionResult}
                socialDryRunResult={socialDryRunResult}
                validationIssues={socialStepValidationIssues}
                textColor={COLORS.text}
                textLightColor={COLORS.textLight}
                borderColor={COLORS.border}
                Field={Field}
                onWorkflowFormChange={(next) => {
                  setWorkflowForm((prev) => ({
                    ...prev,
                    ...next,
                  }));
                }}
                onTestConnection={() => {
                  void testWorkflowSocialConnection();
                }}
                onDryRun={() => {
                  void dryRunWorkflowSocial();
                }}
              />
            </div>
          )}

          {workflowStep === 4 && (
            <div style={{ display: 'grid', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <UiTextField
                  label="Temperatura"
                  type="number"
                  value={String(workflowForm.temperature)}
                  onChange={(e) =>
                    setWorkflowForm((prev) => ({ ...prev, temperature: Number(e.target.value) }))
                  }
                />
                <UiTextField
                  label="Maks. tokenów"
                  type="number"
                  value={String(workflowForm.max_completion_tokens)}
                  onChange={(e) =>
                    setWorkflowForm((prev) => ({
                      ...prev,
                      max_completion_tokens: Number(e.target.value),
                    }))
                  }
                />
                <UiTextField
                  label="Maks. ponowień"
                  type="number"
                  value={String(workflowForm.retry_max)}
                  onChange={(e) =>
                    setWorkflowForm((prev) => ({ ...prev, retry_max: Number(e.target.value) }))
                  }
                />
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                <UiCheckbox
                  checked={workflowForm.auto_publish}
                  onChange={(checked) =>
                    setWorkflowForm((prev) => ({ ...prev, auto_publish: checked }))
                  }
                >
                  Automatyczna publikacja (pomiń moderację)
                </UiCheckbox>
                <UiCheckbox
                  checked={workflowForm.strategy_enabled}
                  onChange={(checked) =>
                    setWorkflowForm((prev) => ({
                      ...prev,
                      strategy_enabled: checked,
                    }))
                  }
                >
                  Agent strategii może planować tematy dla tego workflow
                </UiCheckbox>
                <UiCheckbox
                  checked={workflowForm.performance_feedback_enabled}
                  onChange={(checked) =>
                    setWorkflowForm((prev) => ({
                      ...prev,
                      performance_feedback_enabled: checked,
                    }))
                  }
                >
                  Używaj danych SEO/skuteczności przy planowaniu
                </UiCheckbox>
                <UiCheckbox
                  checked={workflowForm.force_regenerate}
                  onChange={(checked) =>
                    setWorkflowForm((prev) => ({ ...prev, force_regenerate: checked }))
                  }
                >
                  Wymuś regenerację (nawet jeśli treść istnieje)
                </UiCheckbox>
                {workflowForm.workflow_type === 'horoscope' && (
                  <UiCheckbox
                    checked={workflowForm.all_signs}
                    onChange={(checked) =>
                      setWorkflowForm((prev) => ({ ...prev, all_signs: checked }))
                    }
                  >
                    Generuj dla wszystkich 12 znaków zodiaku
                  </UiCheckbox>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <UiTextField
                  label="Klaster treści"
                  value={workflowForm.content_cluster}
                  onChange={(e) =>
                    setWorkflowForm((prev) => ({ ...prev, content_cluster: e.target.value }))
                  }
                  placeholder="np. astrologia-praktyczna"
                />
                <UiTextareaField
                  label="Zabezpieczenia auto-publikacji (JSON)"
                  value={workflowForm.auto_publish_guardrails}
                  onChange={(e) =>
                    setWorkflowForm((prev) => ({
                      ...prev,
                      auto_publish_guardrails: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );

  const renderTopicModal = () => (
    <Modal
      title="Nowy Temat w Kolejce"
      isOpen={showTopicModal}
      onClose={() => setShowTopicModal(false)}
      maxWidth={600}
      footer={
        <>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => setShowTopicModal(false)}
          >
            Anuluj
          </button>
          <button
            type="button"
            style={primaryButtonStyle}
            disabled={saving}
            onClick={() => {
              if (!topicForm.title) {
                showError('Tytuł tematu jest wymagany.');
                return;
              }
              if (!topicForm.workflow) {
                showError('Musisz wybrać workflow dla tego tematu.');
                return;
              }
              void createTopic();
            }}
          >
            {saving ? 'Dodawanie...' : 'Dodaj Temat'}
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 20 }}>
        <Field label="Tytuł / Nazwa Tematu">
          <input
            style={inputStyle}
            value={topicForm.title}
            placeholder="np. Pełnia Księżyca w Skorpionie"
            onChange={(e) => setTopicForm((prev) => ({ ...prev, title: e.target.value }))}
          />
        </Field>
        <Field label="Brief / Wytyczne (Opcjonalnie)">
          <textarea
            style={{ ...inputStyle, minHeight: 100 }}
            value={topicForm.brief}
            placeholder="Szczególne wytyczne dla LLM..."
            onChange={(e) => setTopicForm((prev) => ({ ...prev, brief: e.target.value }))}
          />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Field label="Przypisany Workflow">
            <select
              style={inputStyle}
              value={topicForm.workflow}
              onChange={(e) => setTopicForm((prev) => ({ ...prev, workflow: e.target.value }))}
            >
              <option value="">Wybierz workflow...</option>
              {workflows.map((wf) => (
                <option key={wf.id} value={wf.id}>
                  {wf.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Zasób Graficzny (Klucz)">
            <input
              style={inputStyle}
              value={topicForm.image_asset_key}
              placeholder="np. scorpion_moon"
              onChange={(e) =>
                setTopicForm((prev) => ({ ...prev, image_asset_key: e.target.value }))
              }
            />
          </Field>
        </div>
        <Field label="Planowana Data (Opcjonalnie)">
          <input
            type="datetime-local"
            style={inputStyle}
            value={topicForm.scheduled_for}
            onChange={(e) => setTopicForm((prev) => ({ ...prev, scheduled_for: e.target.value }))}
          />
        </Field>
      </div>
    </Modal>
  );

  const renderRunDetailsModal = () => (
    <Modal
      title={selectedRun ? `Szczegóły Run #${selectedRun.id}` : 'Szczegóły Run'}
      isOpen={showRunModal}
      onClose={() => {
        setShowRunModal(false);
        setSelectedRun(null);
      }}
      maxWidth={820}
      footer={
        <button
          type="button"
          style={secondaryButtonStyle}
          onClick={() => {
            setShowRunModal(false);
            setSelectedRun(null);
          }}
        >
          Zamknij
        </button>
      }
    >
      {selectedRun ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}
          >
            <Field label="Status">
              <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', minHeight: 42 }}>
                <StatusPill status={selectedRun.status} />
              </div>
            </Field>
            <Field label="Typ">
              <input style={inputStyle} value={selectedRun.run_type} disabled />
            </Field>
            <Field label="Start">
              <input
                style={inputStyle}
                value={new Date(selectedRun.started_at).toLocaleString()}
                disabled
              />
            </Field>
            <Field label="Koniec">
              <input
                style={inputStyle}
                value={
                  selectedRun.finished_at ? new Date(selectedRun.finished_at).toLocaleString() : '-'
                }
                disabled
              />
            </Field>
          </div>
          {selectedRun.error_message && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
              }}
            >
              {selectedRun.error_message}
            </div>
          )}
          <Field label="Szczegóły (JSON)">
            <pre
              style={{
                margin: 0,
                padding: 12,
                borderRadius: 10,
                background: '#0f172a',
                color: '#e2e8f0',
                maxHeight: 260,
                overflow: 'auto',
                fontSize: 12,
              }}
            >
              {JSON.stringify(selectedRun.details ?? {}, null, 2)}
            </pre>
          </Field>
        </div>
      ) : null}
    </Modal>
  );

  const autonomyPolicy = autonomyStatus?.policy ?? {};
  const providerReadiness = autonomyStatus?.providerReadiness ?? [];
  const blockedProviderCount = providerReadiness.filter((provider) => !provider.ready).length;
  const readyProviderCount = providerReadiness.length - blockedProviderCount;
  const dryRunPreview = autonomyStatus?.dryRunPreview as { steps?: unknown } | undefined;
  const dryRunSteps = Array.isArray(dryRunPreview?.steps)
    ? dryRunPreview.steps.filter(isRecordValue)
    : [];
  const blockedDryRunStepCount = dryRunSteps.filter((step) => step.status === 'blocked').length;
  const autonomyMode = String(autonomyPolicy.autonomy_mode ?? autonomyPolicy.mode ?? '-');
  const killSwitch = Boolean(autonomyPolicy.global_kill_switch);
  const productionDecision = productionReadiness?.decision ?? 'NO_GO';
  const canRunControlledAutonomyTick =
    productionDecision === 'GO' && runNowConfirmation.trim() === RUN_NOW_CONFIRMATION;
  const canRunAdsStopLoss = adsStopLossConfirmation.trim() === ADS_STOP_LOSS_CONFIRMATION;

  if (loading) {
    return <Page.Loading />;
  }

  return (
    <Page.Main>
      <div
        style={{
          padding: '32px 40px',
          display: 'grid',
          gridAutoRows: 'min-content',
          alignContent: 'start',
          gap: 24,
          background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <Page.Title>AI Content Orchestrator</Page.Title>
          <div style={{ display: 'flex', gap: 12 }}>
            {summary && (
              <div
                style={{
                  fontSize: 13,
                  color: COLORS.textLight,
                  background: '#fff',
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                Status systemu:{' '}
                <span style={{ color: COLORS.secondary, fontWeight: 700 }}>Online</span>
              </div>
            )}
          </div>
        </div>

        <section style={{ ...CARD_STYLE, padding: 8, borderRadius: 12, background: '#fff' }}>
          <div
            role="tablist"
            aria-label="Nawigacja panelu AICO"
            style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}
          >
            {TAB_DEFS.map(([key, label], index) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  id={`aico-tab-${key}`}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  aria-controls={`aico-tabpanel-${key}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(key)}
                  onKeyDown={(event) => {
                    // Dostępna nawigacja klawiaturą (WAI-ARIA tablist):
                    // strzałki przełączają zakładkę, Home/End skaczą na skraje.
                    let nextIndex: number | null = null;
                    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                      nextIndex = (index + 1) % TAB_DEFS.length;
                    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                      nextIndex = (index - 1 + TAB_DEFS.length) % TAB_DEFS.length;
                    } else if (event.key === 'Home') {
                      nextIndex = 0;
                    } else if (event.key === 'End') {
                      nextIndex = TAB_DEFS.length - 1;
                    }
                    if (nextIndex !== null) {
                      event.preventDefault();
                      const nextKey = TAB_DEFS[nextIndex][0];
                      setActiveTab(nextKey);
                      document.getElementById(`aico-tab-${nextKey}`)?.focus();
                    }
                  }}
                  style={{
                    border: 'none',
                    background: isActive ? COLORS.primaryLight : 'transparent',
                    color: isActive ? COLORS.primary : COLORS.textLight,
                    borderRadius: 10,
                    padding: '10px 20px',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isActive ? COLORS.primary : 'transparent',
                      transition: 'all 0.2s',
                    }}
                  />
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {coreOpsState !== 'ready' ? (
          <section
            style={{
              ...CARD_STYLE,
              padding: 14,
              border:
                coreOpsState === 'blocked'
                  ? '1px solid #fecaca'
                  : coreOpsState === 'degraded'
                    ? '1px solid #bfdbfe'
                    : '1px solid #fde68a',
              background:
                coreOpsState === 'blocked'
                  ? '#fef2f2'
                  : coreOpsState === 'degraded'
                    ? '#eff6ff'
                    : '#fffbeb',
            }}
          >
            <div
              style={{
                fontSize: 12,
                color:
                  coreOpsState === 'blocked'
                    ? '#991b1b'
                    : coreOpsState === 'degraded'
                      ? '#1d4ed8'
                      : '#92400e',
              }}
            >
              Status: <strong>{coreOpsState}</strong>.{' '}
              {coreOpsMessage ||
                'Część sekcji nie załadowała się poprawnie. Sprawdź integracje i uprawnienia.'}
            </div>
          </section>
        ) : null}

        {activeTab === 'dashboard' && (
          <DashboardTab
            summary={summary}
            diagnostics={diagnostics}
            cardStyle={CARD_STYLE}
            sectionTitleStyle={SECTION_TITLE_STYLE}
            colors={COLORS}
            StatTile={StatTile}
          />
        )}

        {activeTab === 'workflows' && (
          <WorkflowsTab
            workflows={workflows}
            saving={saving}
            runningWorkflowIds={runningWorkflowIds}
            cardStyle={CARD_STYLE}
            sectionTitleStyle={SECTION_TITLE_STYLE}
            colors={COLORS}
            StatusPill={StatusPill}
            onNewWorkflow={() => {
              setEditingWorkflowId(null);
              setWorkflowForm(initialWorkflowForm());
              setWorkflowStep(0);
              setShowWorkflowModal(true);
            }}
            onEditWorkflow={(workflow) => {
              onPickWorkflowToEdit(workflow);
              setShowWorkflowModal(true);
            }}
            onRunWorkflow={(workflowId) => {
              void runNow(workflowId);
            }}
            onViewLogs={(workflow) => {
              setRunFilters((prev) => ({ ...prev, workflowName: workflow.name }));
              setActiveTab('runs');
            }}
          />
        )}

        {activeTab === 'topics' && (
          <TopicsTab
            topics={topics}
            workflows={workflows}
            cardStyle={CARD_STYLE}
            sectionTitleStyle={SECTION_TITLE_STYLE}
            primaryButtonStyle={primaryButtonStyle}
            colors={COLORS}
            formatDateTime={formatDateTime}
            StatusPill={StatusPill}
            onAddTopic={() => {
              setTopicForm(initialTopicForm());
              setShowTopicModal(true);
            }}
            onDeleteTopic={(id) => {
              void deleteTopic(id);
            }}
          />
        )}

        {activeTab === 'media' && (
          <MediaTab
            backfillingImages={backfillingImages}
            saving={saving}
            mediaFilters={mediaFilters}
            setMediaFilters={setMediaFilters}
            signOptions={signOptions}
            mediaLibrary={mediaLibrary}
            mediaLibraryLoading={mediaLibraryLoading}
            mediaLibraryPagination={mediaLibraryPagination}
            bulkSelectedFileIds={bulkSelectedFileIds}
            selectedMediaFileId={selectedMediaFileId}
            selectedMediaFile={selectedMediaFile}
            generatedMediaIdentity={generatedMediaIdentity}
            mediaAssetForm={mediaAssetForm}
            setMediaAssetForm={setMediaAssetForm}
            bulkPreview={bulkPreview}
            mediaUsage={mediaUsage}
            cardStyle={CARD_STYLE}
            sectionTitleStyle={SECTION_TITLE_STYLE}
            colors={COLORS}
            onBackfillImages={(kind) => {
              void backfillImages(kind);
            }}
            onValidateCoverage={() => {
              void validateCoverage(false);
            }}
            onRefreshMediaGrid={() => {
              void refreshMediaGrid();
            }}
            onFilterMediaLibrary={() => {
              void loadMediaLibrary({ page: 1 });
            }}
            onPickMediaFile={(item) => pickMediaFile(item)}
            onToggleBulkSelection={(fileId) => toggleBulkSelection(fileId)}
            onGoToMediaPage={(page) => {
              void goToMediaPage(page);
            }}
            onSaveMediaMapping={() => {
              void saveMediaMapping();
            }}
            onDeleteMediaMapping={(mappingId) => {
              void deleteMediaMapping(mappingId);
            }}
            onPreviewBulkMapping={() => {
              void previewBulkMapping();
            }}
            onApplyBulkMapping={() => {
              void applyBulkMapping();
            }}
          />
        )}

        {activeTab === 'runs' && (
          <RunsTab
            runs={runs}
            filteredRuns={filteredRuns}
            liveRunCount={liveRunCount}
            expandedRunIds={expandedRunIds}
            workflows={workflows}
            runFilters={runFilters}
            setRunFilters={setRunFilters}
            initialRunFilters={initialRunFilters}
            saving={saving}
            cardStyle={CARD_STYLE}
            sectionTitleStyle={SECTION_TITLE_STYLE}
            primaryButtonStyle={primaryButtonStyle}
            inputStyle={inputStyle}
            colors={COLORS}
            formatDateTime={formatDateTime}
            formatDuration={formatDuration}
            formatDetailValue={formatDetailValue}
            getRunSteps={getRunSteps}
            getRunLlmTraces={getRunLlmTraces}
            getRunWorkflowName={getRunWorkflowName}
            getRunResultSummary={getRunResultSummary}
            StatusPill={StatusPill}
            StatTile={StatTile}
            Th={Th}
            Td={Td}
            Field={Field}
            ErrorInsight={ErrorInsight}
            AutonomousIntelligence={AutonomousIntelligence}
            onRefresh={() => {
              void refreshMonitoringData(true);
            }}
            onToggleRunDetails={(runId) => toggleRunDetails(runId)}
            onRetryRun={(runId) => {
              void retryRun(runId);
            }}
          />
        )}

        {activeTab === 'social' && (
          <SocialTab
            socialOpsState={socialOpsState}
            socialOpsMessage={socialOpsMessage}
            socialFilters={socialFilters}
            setSocialFilters={setSocialFilters}
            filteredSocialTickets={filteredSocialTickets}
            saving={saving}
            cardStyle={CARD_STYLE}
            sectionTitleStyle={SECTION_TITLE_STYLE}
            primaryButtonStyle={primaryButtonStyle}
            colors={COLORS}
            formatDateTime={formatDateTime}
            getWorkflowId={getWorkflowId}
            StatusPill={StatusPill}
            Field={Field}
            onRefresh={() => {
              void refreshSocialTickets();
            }}
            onRetryTicket={(ticketId) => {
              void retrySocialTicket(ticketId);
            }}
            onCancelTicket={(ticketId) => {
              void cancelSocialTicket(ticketId);
            }}
          />
        )}

        {activeTab === 'video' && (
          <VideoTab
            assets={videoAssets}
            loading={videoLoading}
            creating={videoCreating}
            busyAssetId={videoBusyAssetId}
            onRefresh={() => {
              void refreshVideoAssets();
            }}
            onCreateJob={(payload) => {
              void createVideoJob(payload);
            }}
            onRender={(id) => {
              void renderVideo(id);
            }}
            onPublish={(id) => {
              void publishVideo(id);
            }}
            onPollRenders={() => {
              void pollVideoRenders();
            }}
            polling={videoPolling}
            cardStyle={CARD_STYLE}
            sectionTitleStyle={SECTION_TITLE_STYLE}
            colors={COLORS}
          />
        )}

        {activeTab === 'audit' && (
          <AuditTab
            auditReport={auditReport}
            auditOpsState={auditOpsState}
            auditOpsMessage={auditOpsMessage}
            saving={saving}
            cardStyle={CARD_STYLE}
            sectionTitleStyle={SECTION_TITLE_STYLE}
            primaryButtonStyle={primaryButtonStyle}
            colors={COLORS}
            formatDateTime={formatDateTime}
            StatusPill={StatusPill}
            onRunPreflightAudit={(strict) => {
              void runPreflightAudit(strict);
            }}
          />
        )}

        {activeTab === 'growth' && (
          <GrowthTab
            saving={saving}
            workflows={workflows}
            settings={settings}
            setSettings={setSettings}
            strategyPlan={strategyPlan}
            performanceSnapshots={performanceSnapshots}
            homepageRecommendations={homepageRecommendations}
            productionReadiness={productionReadiness}
            productionDecision={productionDecision}
            providerReadiness={providerReadiness}
            readyProviderCount={readyProviderCount}
            blockedProviderCount={blockedProviderCount}
            autonomyStatus={autonomyStatus}
            autonomyPolicy={autonomyPolicy}
            autonomyMode={autonomyMode}
            killSwitch={killSwitch}
            dryRunSteps={dryRunSteps}
            blockedDryRunStepCount={blockedDryRunStepCount}
            providerProbeResult={providerProbeResult}
            generationJobs={generationJobs}
            videoAssets={videoAssets}
            adCampaignPlans={adCampaignPlans}
            growthExperiments={growthExperiments}
            providerStatuses={providerStatuses}
            strategyForm={strategyForm}
            setStrategyForm={setStrategyForm}
            strategyGenerateResult={strategyGenerateResult}
            strategyApproveResult={strategyApproveResult}
            performanceForm={performanceForm}
            setPerformanceForm={setPerformanceForm}
            performanceAggregateResult={performanceAggregateResult}
            homepageForm={homepageForm}
            setHomepageForm={setHomepageForm}
            homepageRunResult={homepageRunResult}
            runNowConfirmation={runNowConfirmation}
            setRunNowConfirmation={setRunNowConfirmation}
            runNowConfirmationPlaceholder={RUN_NOW_CONFIRMATION}
            canRunControlledAutonomyTick={canRunControlledAutonomyTick}
            adsStopLossConfirmation={adsStopLossConfirmation}
            setAdsStopLossConfirmation={setAdsStopLossConfirmation}
            adsStopLossConfirmationPlaceholder={ADS_STOP_LOSS_CONFIRMATION}
            canRunAdsStopLoss={canRunAdsStopLoss}
            cardStyle={CARD_STYLE}
            sectionTitleStyle={SECTION_TITLE_STYLE}
            primaryButtonStyle={primaryButtonStyle}
            inputStyle={inputStyle}
            checkboxRowStyle={checkboxRowStyle}
            colors={COLORS}
            formatDateTime={formatDateTime}
            formatDetailValue={formatDetailValue}
            help={help}
            StatusPill={StatusPill}
            StatTile={StatTile}
            Field={Field}
            onRefreshGrowthData={() => {
              void refreshGrowthData();
            }}
            onRunProviderReadinessProbe={() => {
              void runProviderReadinessProbe();
            }}
            onImportGa4Traffic={() => {
              void importGa4Traffic();
            }}
            onSaveAutonomyPatch={(patch, message) => {
              void saveAutonomyPatch(patch, message);
            }}
            onRunControlledAutonomyTick={() => {
              void runControlledAutonomyTick();
            }}
            onRunAdsStopLoss={() => {
              void runAdsStopLoss();
            }}
            onGenerateStrategyPlan={() => {
              void generateStrategyPlan();
            }}
            onApproveStrategyPlan={() => {
              void approveStrategyPlan();
            }}
            onAggregatePerformance={() => {
              void aggregatePerformance();
            }}
            onRunHomepageRecommendations={() => {
              void runHomepageRecommendations();
            }}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            setSettings={setSettings}
            saving={saving}
            cardStyle={CARD_STYLE}
            sectionTitleStyle={SECTION_TITLE_STYLE}
            primaryButtonStyle={primaryButtonStyle}
            inputStyle={inputStyle}
            checkboxRowStyle={checkboxRowStyle}
            colors={COLORS}
            Field={Field}
            onSaveSettings={() => {
              void saveSettings();
            }}
          />
        )}

        {renderWorkflowModal()}
        {renderTopicModal()}
        {renderRunDetailsModal()}
      </div>
    </Page.Main>
  );
};

const HelpIcon = ({ hint }: { hint: string }) => (
  <span
    title={hint}
    aria-label={hint}
    role="img"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 15,
      height: 15,
      borderRadius: '50%',
      border: '1px solid #c0c0cf',
      color: '#666687',
      fontSize: 10,
      fontWeight: 700,
      cursor: 'help',
      userSelect: 'none',
      flex: '0 0 auto',
    }}
  >
    ?
  </span>
);

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 13, color: '#47475a' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {label}
        {hint ? <HelpIcon hint={hint} /> : null}
      </span>
      {hint ? (
        <span style={{ fontSize: 12, lineHeight: 1.4, color: COLORS.textLight }}>{hint}</span>
      ) : null}
      {children}
    </label>
  );
};

// Mapowanie kluczy statusu (te same, co w STATUS_COLORS) na semantyczne tony DS.
// Dzięki temu StatusPill renderuje dostępny, otonowany UiBadge, zachowując
// jednocześnie ten sam zestaw stanów i ten sam (wielkimi literami) tekst PL/EN.
const STATUS_TONE: Record<string, UiTone> = {
  idle: 'neutral',
  pending: 'neutral',
  disabled: 'neutral',
  ready: 'success',
  GO: 'success',
  pass: 'success',
  success: 'success',
  enabled: 'success',
  GO_WITH_WARNINGS: 'warning',
  warn: 'warning',
  needs_action: 'warning',
  blocked_budget: 'warning',
  NO_GO: 'danger',
  fail: 'danger',
  failed: 'danger',
  blocked: 'danger',
  degraded: 'info',
  running: 'info',
};

const StatusPill = ({ status }: { status: string }) => {
  const tone = STATUS_TONE[status] ?? 'neutral';

  // UiBadge (DS Badge): dostępny, otonowany chip statusu. Wymuszamy wielkie
  // litery na samym tekście, aby zachować dotychczasowy wygląd pigułki.
  return (
    <UiBadge tone={tone}>
      <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
        {status}
      </span>
    </UiBadge>
  );
};

const StatTile = ({
  label,
  value,
  subValue,
  color,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
}) => (
  <div style={STAT_CARD_STYLE}>
    <span
      style={{
        fontSize: 12,
        color: COLORS.textLight,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {label}
    </span>
    <strong
      style={{
        fontSize: 24,
        color: color || COLORS.primary,
        marginTop: 4,
        letterSpacing: '-0.02em',
      }}
    >
      {value}
    </strong>
    {subValue && (
      <span style={{ fontSize: 11, color: COLORS.textLight, marginTop: 2, fontWeight: 500 }}>
        {subValue}
      </span>
    )}
  </div>
);

const Th = ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => (
  <th
    style={{
      textAlign: 'left',
      padding: '12px 16px',
      fontSize: 12,
      fontWeight: 700,
      color: COLORS.textLight,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      borderBottom: `2px solid ${COLORS.border}`,
      background: '#fcfcfd',
      ...style,
    }}
  >
    {children}
  </th>
);

const Td = ({
  children,
  style,
  colSpan,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  colSpan?: number;
}) => (
  <td
    colSpan={colSpan}
    style={{
      padding: '16px 16px',
      fontSize: 14,
      color: COLORS.text,
      borderBottom: `1px solid ${COLORS.border}`,
      verticalAlign: 'middle',
      ...style,
    }}
  >
    {children}
  </td>
);

const Modal = ({
  title,
  isOpen,
  onClose,
  children,
  maxWidth = 800,
  footer,
}: {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  footer?: React.ReactNode;
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(6px)',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 20,
          width: '100%',
          maxWidth,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '20px 28px',
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#fcfcfd',
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 800, color: COLORS.text, margin: 0 }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: '#f1f5f9',
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: COLORS.textLight,
              transition: 'all 0.2s',
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: 28, overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: '20px 28px',
              borderTop: `1px solid ${COLORS.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              background: '#fcfcfd',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export { HomePage };
