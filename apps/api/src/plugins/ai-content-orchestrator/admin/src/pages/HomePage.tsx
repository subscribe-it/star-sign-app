import { Page, useFetchClient, useNotification } from '@strapi/strapi/admin';
import { Fragment, useEffect, useMemo, useState } from 'react';

import { api } from '../api';
import { WorkflowSocialStep } from './homepage/WorkflowSocialStep';
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
  ProviderReadiness,
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

const WORKFLOW_STEP_LABELS = ['Basics', 'Schedule', 'Content', 'Social', 'Controls'] as const;
const ADS_STOP_LOSS_CONFIRMATION = 'PAUSE_ACTIVE_ADS';

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
  const [adCampaignPlans, setAdCampaignPlans] = useState<AdCampaignPlan[]>([]);
  const [growthExperiments, setGrowthExperiments] = useState<GrowthExperiment[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<ProviderCredentialStatus[]>([]);
  const [providerProbeResult, setProviderProbeResult] = useState<ProviderProbeRunResult | null>(null);
  const [productionReadiness, setProductionReadiness] =
    useState<ProductionReadinessReport | null>(null);
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
        `Ads stop-loss: attempted ${result.attempted}, paused ${result.paused}, blocked ${result.blocked}, failed ${result.failed}.`
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

  const getTopicWorkflowName = (topic: Topic, workflowList: Workflow[]): string => {
    if (!topic.workflow) return '-';
    const wf = workflowList.find((w) => w.id === topic.workflow);
    return wf ? wf.name : '-';
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
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() => setWorkflowStep((prev) => prev - 1)}
            >
              Poprzedni krok
            </button>
          )}
          {workflowStep < WORKFLOW_STEP_LABELS.length - 1 ? (
            <button
              type="button"
              style={primaryButtonStyle}
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
            </button>
          ) : (
            <button
              type="button"
              style={primaryButtonStyle}
              disabled={saving}
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
            </button>
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
              <Field label="Nazwa">
                <input
                  style={inputStyle}
                  value={workflowForm.name}
                  placeholder="np. Horoskop Dzienny - Główne Wydanie"
                  onChange={(e) => setWorkflowForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <Field label="Typ Workflow">
                  <select
                    style={inputStyle}
                    value={workflowForm.workflow_type}
                    onChange={(e) =>
                      setWorkflowForm((prev) => ({
                        ...prev,
                        workflow_type: e.target.value as WorkflowFormState['workflow_type'],
                      }))
                    }
                  >
                    <option value="horoscope">horoscope</option>
                    <option value="daily_card">daily_card</option>
                    <option value="article">article</option>
                  </select>
                </Field>
                <Field label="Tryb Tematów">
                  <select
                    style={inputStyle}
                    value={workflowForm.topic_mode}
                    onChange={(e) =>
                      setWorkflowForm((prev) => ({
                        ...prev,
                        topic_mode: e.target.value as WorkflowFormState['topic_mode'],
                      }))
                    }
                  >
                    <option value="mixed">Mieszany (Auto + Ręczny)</option>
                    <option value="manual">Tylko Ręczny</option>
                  </select>
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <Field label="Lokalizacja">
                  <input
                    style={inputStyle}
                    value={workflowForm.locale}
                    onChange={(e) =>
                      setWorkflowForm((prev) => ({ ...prev, locale: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Strefa Czasowa">
                  <input
                    style={inputStyle}
                    value={workflowForm.timezone}
                    onChange={(e) =>
                      setWorkflowForm((prev) => ({ ...prev, timezone: e.target.value }))
                    }
                  />
                </Field>
              </div>
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={workflowForm.enabled}
                  onChange={(e) =>
                    setWorkflowForm((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                />
                Włączony (Active)
              </label>
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
              <Field label="Harmonogram Generowania">
                <input
                  style={inputStyle}
                  value={workflowForm.generate_cron}
                  onChange={(e) =>
                    setWorkflowForm((prev) => ({ ...prev, generate_cron: e.target.value }))
                  }
                />
              </Field>
              <Field label="Harmonogram Publikacji">
                <input
                  style={inputStyle}
                  value={workflowForm.publish_cron}
                  onChange={(e) =>
                    setWorkflowForm((prev) => ({ ...prev, publish_cron: e.target.value }))
                  }
                />
              </Field>
            </div>
          )}

          {workflowStep === 2 && (
            <div style={{ display: 'grid', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <Field label="Model LLM">
                  <input
                    style={inputStyle}
                    value={workflowForm.llm_model}
                    onChange={(e) =>
                      setWorkflowForm((prev) => ({ ...prev, llm_model: e.target.value }))
                    }
                  />
                </Field>
                <Field
                  label={editingWorkflowId ? 'API Token (Zostaw puste aby zachować)' : 'API Token'}
                >
                  <input
                    type="password"
                    style={inputStyle}
                    value={workflowForm.apiToken}
                    onChange={(e) =>
                      setWorkflowForm((prev) => ({ ...prev, apiToken: e.target.value }))
                    }
                  />
                </Field>
              </div>

              {workflowForm.workflow_type === 'horoscope' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <Field label="Okres Horoskopu">
                    <select
                      style={inputStyle}
                      value={workflowForm.horoscope_period}
                      onChange={(e) =>
                        setWorkflowForm((prev) => ({
                          ...prev,
                          horoscope_period: e.target.value as WorkflowFormState['horoscope_period'],
                        }))
                      }
                    >
                      <option value="Dzienny">Dzienny</option>
                      <option value="Tygodniowy">Tygodniowy</option>
                      <option value="Miesięczny">Miesięczny</option>
                      <option value="Roczny">Roczny</option>
                    </select>
                  </Field>
                  <Field label="Typy Horoskopów (oddzielone przecinkiem)">
                    <input
                      style={inputStyle}
                      value={workflowForm.horoscope_type_values}
                      onChange={(e) =>
                        setWorkflowForm((prev) => ({
                          ...prev,
                          horoscope_type_values: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              )}

              <Field label="Prompt Template (Main Context)">
                <textarea
                  style={{ ...inputStyle, minHeight: 200, fontFamily: 'monospace', fontSize: 13 }}
                  value={workflowForm.prompt_template}
                  onChange={(e) =>
                    setWorkflowForm((prev) => ({ ...prev, prompt_template: e.target.value }))
                  }
                />
              </Field>
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
                  Guided Social Onboarding (FB / IG / X)
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: '#0c4a6e', lineHeight: 1.5 }}>
                  Kroki: wybierz kanały, uzupełnij credentials, uruchom{' '}
                  <strong>Test Connection</strong> i<strong> Dry Run</strong>, dopiero potem aktywuj
                  auto-publish.
                </p>
              </div>
              <WorkflowSocialStep
                workflowForm={workflowForm}
                editingWorkflowId={editingWorkflowId}
                saving={saving}
                socialConnectionResult={socialConnectionResult}
                socialDryRunResult={socialDryRunResult}
                validationIssues={socialStepValidationIssues}
                inputStyle={inputStyle}
                checkboxRowStyle={checkboxRowStyle}
                secondaryButtonStyle={secondaryButtonStyle}
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
                <Field label="Temperature">
                  <input
                    type="number"
                    step="0.1"
                    style={inputStyle}
                    value={workflowForm.temperature}
                    onChange={(e) =>
                      setWorkflowForm((prev) => ({ ...prev, temperature: Number(e.target.value) }))
                    }
                  />
                </Field>
                <Field label="Max Tokens">
                  <input
                    type="number"
                    style={inputStyle}
                    value={workflowForm.max_completion_tokens}
                    onChange={(e) =>
                      setWorkflowForm((prev) => ({
                        ...prev,
                        max_completion_tokens: Number(e.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="Max Retries">
                  <input
                    type="number"
                    style={inputStyle}
                    value={workflowForm.retry_max}
                    onChange={(e) =>
                      setWorkflowForm((prev) => ({ ...prev, retry_max: Number(e.target.value) }))
                    }
                  />
                </Field>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                <label style={checkboxRowStyle}>
                  <input
                    type="checkbox"
                    checked={workflowForm.auto_publish}
                    onChange={(e) =>
                      setWorkflowForm((prev) => ({ ...prev, auto_publish: e.target.checked }))
                    }
                  />
                  Automatyczna publikacja (pomiń moderację)
                </label>
                <label style={checkboxRowStyle}>
                  <input
                    type="checkbox"
                    checked={workflowForm.strategy_enabled}
                    onChange={(e) =>
                      setWorkflowForm((prev) => ({
                        ...prev,
                        strategy_enabled: e.target.checked,
                      }))
                    }
                  />
                  Strategy Agent może planować tematy dla tego workflow
                </label>
                <label style={checkboxRowStyle}>
                  <input
                    type="checkbox"
                    checked={workflowForm.performance_feedback_enabled}
                    onChange={(e) =>
                      setWorkflowForm((prev) => ({
                        ...prev,
                        performance_feedback_enabled: e.target.checked,
                      }))
                    }
                  />
                  Używaj feedbacku SEO/performance przy planowaniu
                </label>
                <label style={checkboxRowStyle}>
                  <input
                    type="checkbox"
                    checked={workflowForm.force_regenerate}
                    onChange={(e) =>
                      setWorkflowForm((prev) => ({ ...prev, force_regenerate: e.target.checked }))
                    }
                  />
                  Wymuś regenerację (nawet jeśli treść istnieje)
                </label>
                {workflowForm.workflow_type === 'horoscope' && (
                  <label style={checkboxRowStyle}>
                    <input
                      type="checkbox"
                      checked={workflowForm.all_signs}
                      onChange={(e) =>
                        setWorkflowForm((prev) => ({ ...prev, all_signs: e.target.checked }))
                      }
                    />
                    Generuj dla wszystkich 12 znaków zodiaku
                  </label>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Content cluster">
                  <input
                    style={inputStyle}
                    value={workflowForm.content_cluster}
                    onChange={(e) =>
                      setWorkflowForm((prev) => ({ ...prev, content_cluster: e.target.value }))
                    }
                    placeholder="np. astrologia-praktyczna"
                  />
                </Field>
                <Field label="Auto-publish guardrails (JSON)">
                  <textarea
                    style={{ ...inputStyle, minHeight: 120, fontFamily: 'monospace', fontSize: 12 }}
                    value={workflowForm.auto_publish_guardrails}
                    onChange={(e) =>
                      setWorkflowForm((prev) => ({
                        ...prev,
                        auto_publish_guardrails: e.target.value,
                      }))
                    }
                  />
                </Field>
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
          <Field label="Details (JSON)">
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
                System status:{' '}
                <span style={{ color: COLORS.secondary, fontWeight: 700 }}>Online</span>
              </div>
            )}
          </div>
        </div>

        <section style={{ ...CARD_STYLE, padding: 8, borderRadius: 12, background: '#fff' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(
              [
                ['dashboard', 'Dashboard'],
                ['workflows', 'Workflows'],
                ['topics', 'Topic Queue'],
                ['media', 'Media Catalog'],
                ['runs', 'Monitoring'],
                ['social', 'Social Ops'],
                ['audit', 'Audit'],
                ['growth', 'Growth Ops'],
                ['settings', 'Settings'],
              ] as Array<[TabKey, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                style={{
                  border: 'none',
                  background: activeTab === key ? COLORS.primaryLight : 'transparent',
                  color: activeTab === key ? COLORS.primary : COLORS.textLight,
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
                    background: activeTab === key ? COLORS.primary : 'transparent',
                    transition: 'all 0.2s',
                  }}
                />
                {label}
              </button>
            ))}
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
          <div style={{ display: 'grid', gap: 24 }}>
            <section style={CARD_STYLE}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 24,
                }}
              >
                <h2 style={{ ...SECTION_TITLE_STYLE, marginBottom: 0 }}>Centrum Dowodzenia</h2>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 12px',
                    background: diagnostics?.ok ? '#f0fdf4' : '#fff7ed',
                    borderRadius: 20,
                    border: `1px solid ${diagnostics?.ok ? '#dcfce7' : '#ffedd5'}`,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: diagnostics?.ok ? COLORS.secondary : COLORS.warning,
                      boxShadow: `0 0 8px ${diagnostics?.ok ? COLORS.secondary : COLORS.warning}`,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: diagnostics?.ok ? '#166534' : '#9a3412',
                    }}
                  >
                    {diagnostics?.ok ? 'SYSTEM GOTOWY' : 'WYMAGA UWAGI'}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 20,
                }}
              >
                <StatTile
                  label="Aktywne Workflows"
                  value={`${summary?.workflows.enabled ?? 0} / ${summary?.workflows.total ?? 0}`}
                />
                <StatTile label="Oczekujące Tematy" value={summary?.topics.pending ?? 0} />
                <StatTile
                  label="Zaplanowane Publikacje"
                  value={summary?.publications.scheduled ?? 0}
                />
                <StatTile label="Błędy Wykonań (Total)" value={summary?.runs.failed ?? 0} />
                <StatTile
                  label="Social Media"
                  value={`${summary?.social?.published ?? 0} ok / ${summary?.social?.scheduled ?? 0} zaplan.`}
                  subValue={summary?.social?.failed ? `${summary.social.failed} błędów` : undefined}
                  color={summary?.social?.failed ? COLORS.danger : undefined}
                />
              </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <section style={CARD_STYLE}>
                <h3 style={{ ...SECTION_TITLE_STYLE, fontSize: 16 }}>Status Zasobów</h3>
                <div style={{ display: 'grid', gap: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: '#f8fafc',
                      borderRadius: 12,
                    }}
                  >
                    <span style={{ fontSize: 14, color: COLORS.textLight }}>
                      Media aktywne / Razem
                    </span>
                    <strong style={{ fontSize: 14, color: COLORS.text }}>
                      {diagnostics?.media.linkedActive ?? 0} / {diagnostics?.media.total ?? 0}
                    </strong>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: '#f8fafc',
                      borderRadius: 12,
                    }}
                  >
                    <span style={{ fontSize: 14, color: COLORS.textLight }}>
                      Nieprzypisane tematy
                    </span>
                    <strong
                      style={{
                        fontSize: 14,
                        color: diagnostics?.topics.unassignedPending
                          ? COLORS.warning
                          : COLORS.secondary,
                      }}
                    >
                      {diagnostics?.topics.unassignedPending ?? 0}
                    </strong>
                  </div>
                </div>
              </section>

              <section style={CARD_STYLE}>
                <h3 style={{ ...SECTION_TITLE_STYLE, fontSize: 16 }}>Ostatnie Problemy</h3>
                {diagnostics?.workflows.issues.length ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {diagnostics.workflows.issues.slice(0, 4).map((issue) => (
                      <div
                        key={`${issue.workflowId}-${issue.message}`}
                        style={{
                          padding: '10px 12px',
                          background: '#fef2f2',
                          border: '1px solid #fee2e2',
                          borderRadius: 10,
                          fontSize: 13,
                          color: '#991b1b',
                          display: 'flex',
                          gap: 10,
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>#{issue.workflowId}</span>
                        <span>{issue.message}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '20px',
                      textAlign: 'center',
                      color: COLORS.secondary,
                      fontWeight: 600,
                    }}
                  >
                    ✅ Wszystkie systemy sprawne
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {activeTab === 'workflows' && (
          <section style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '24px 28px',
                borderBottom: `1px solid ${COLORS.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#fcfcfd',
              }}
            >
              <div>
                <h2 style={{ ...SECTION_TITLE_STYLE, marginBottom: 4 }}>Zarządzanie Workflow</h2>
                <p style={{ fontSize: 13, color: COLORS.textLight, margin: 0 }}>
                  Konfiguruj automatyczne generowanie horoskopów, kart i artykułów.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingWorkflowId(null);
                  setWorkflowForm(initialWorkflowForm());
                  setWorkflowStep(0);
                  setShowWorkflowModal(true);
                }}
                style={primaryButtonStyle}
              >
                + Nowy Workflow
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>ID</Th>
                    <Th>Nazwa</Th>
                    <Th>Typ</Th>
                    <Th>Status</Th>
                    <Th>Aktywny</Th>
                    <Th>Harmonogram</Th>
                    <Th>Ostatni Błąd</Th>
                    <Th style={{ textAlign: 'right' }}>Akcje</Th>
                  </tr>
                </thead>
                <tbody>
                  {workflows.map((workflow) => (
                    <tr key={workflow.id} style={{ transition: 'background 0.2s' }}>
                      <Td>
                        <span style={{ color: COLORS.textLight, fontWeight: 700 }}>
                          #{workflow.id}
                        </span>
                      </Td>
                      <Td>
                        <strong style={{ color: COLORS.text }}>{workflow.name}</strong>
                      </Td>
                      <Td>
                        <span
                          style={{
                            fontSize: 12,
                            padding: '2px 8px',
                            background: '#f1f5f9',
                            borderRadius: 6,
                            color: '#475569',
                            fontWeight: 600,
                          }}
                        >
                          {workflow.workflow_type}
                        </span>
                      </Td>
                      <Td>
                        <StatusPill status={workflow.status} />
                      </Td>
                      <Td>
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: workflow.enabled ? COLORS.secondary : '#cbd5e1',
                            margin: '0 auto',
                          }}
                        />
                      </Td>
                      <Td>
                        <div style={{ fontSize: 12, color: COLORS.textLight }}>
                          Gen: {workflow.generate_cron}
                          <br />
                          Pub: {workflow.publish_cron}
                        </div>
                      </Td>
                      <Td>
                        {workflow.last_error ? (
                          <span
                            style={{
                              color: COLORS.danger,
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
                      </Td>
                      <Td>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => {
                              onPickWorkflowToEdit(workflow);
                              setShowWorkflowModal(true);
                            }}
                            style={{
                              border: `1px solid ${COLORS.border}`,
                              background: '#fff',
                              borderRadius: 8,
                              padding: '6px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Edytuj
                          </button>
                          <button
                            type="button"
                            onClick={() => void runNow(workflow.id)}
                            disabled={
                              saving ||
                              runningWorkflowIds.includes(workflow.id) ||
                              workflow.status === 'running'
                            }
                            style={{
                              background: COLORS.primaryLight,
                              color: COLORS.primary,
                              border: 'none',
                              borderRadius: 8,
                              padding: '6px 12px',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              opacity:
                                runningWorkflowIds.includes(workflow.id) ||
                                workflow.status === 'running'
                                  ? 0.5
                                  : 1,
                            }}
                          >
                            {runningWorkflowIds.includes(workflow.id) ||
                            workflow.status === 'running'
                              ? 'W toku...'
                              : 'Uruchom'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRunFilters((prev) => ({ ...prev, workflowName: workflow.name }));
                              setActiveTab('runs');
                            }}
                            style={{
                              border: `1px solid ${COLORS.border}`,
                              background: '#fff',
                              borderRadius: 8,
                              padding: '6px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Logi
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {workflows.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: COLORS.textLight }}>
                  Brak zdefiniowanych workflow. Kliknij "+ Nowy Workflow", aby zacząć.
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'topics' && (
          <section style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '24px 28px',
                borderBottom: `1px solid ${COLORS.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#fcfcfd',
              }}
            >
              <div>
                <h2 style={{ ...SECTION_TITLE_STYLE, marginBottom: 4 }}>Kolejka Tematów</h2>
                <p style={{ fontSize: 13, color: COLORS.textLight, margin: 0 }}>
                  Zarządzaj ręcznymi tematami i planuj generowanie treści.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTopicForm(initialTopicForm());
                  setShowTopicModal(true);
                }}
                style={primaryButtonStyle}
              >
                + Nowy Temat
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>ID</Th>
                    <Th>Tytuł / Brief</Th>
                    <Th>Workflow</Th>
                    <Th>Status</Th>
                    <Th>Planowany</Th>
                    <Th>Grafika</Th>
                    <Th style={{ textAlign: 'right' }}>Akcje</Th>
                  </tr>
                </thead>
                <tbody>
                  {topics.map((topic) => (
                    <tr key={topic.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <Td>
                        <span style={{ color: COLORS.textLight, fontWeight: 700 }}>
                          #{topic.id}
                        </span>
                      </Td>
                      <Td>
                        <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 2 }}>
                          {topic.title}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: COLORS.textLight,
                            maxWidth: 300,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {topic.brief}
                        </div>
                      </Td>
                      <Td>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                          {getTopicWorkflowName(topic, workflows)}
                        </span>
                      </Td>
                      <Td>
                        <StatusPill status={topic.status} />
                      </Td>
                      <Td>
                        <div style={{ fontSize: 11, color: COLORS.textLight }}>
                          {topic.scheduled_for ? formatDateTime(topic.scheduled_for) : '-'}
                        </div>
                      </Td>
                      <Td>
                        {topic.image_asset_key ? (
                          <span
                            style={{
                              fontSize: 11,
                              padding: '2px 6px',
                              background: '#eef2ff',
                              borderRadius: 4,
                              color: COLORS.primary,
                              fontWeight: 600,
                            }}
                          >
                            {topic.image_asset_key}
                          </span>
                        ) : (
                          '-'
                        )}
                      </Td>
                      <Td>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => void deleteTopic(topic.id)}
                            style={{
                              border: `1px solid ${COLORS.border}`,
                              background: '#fff',
                              borderRadius: 8,
                              padding: '6px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              color: COLORS.danger,
                              cursor: 'pointer',
                            }}
                          >
                            Usuń
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {topics.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: COLORS.textLight }}>
                  Brak tematów w kolejce.
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'media' && (
          <div style={{ display: 'grid', gap: 24 }}>
            <section style={CARD_STYLE}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 24,
                }}
              >
                <h2 style={{ ...SECTION_TITLE_STYLE, marginBottom: 0 }}>Katalog Mediów</h2>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    disabled={saving}
                    style={secondaryButtonStyle}
                    onClick={() => void validateCoverage(false)}
                  >
                    Waliduj pokrycie
                  </button>
                  <button
                    type="button"
                    disabled={mediaLibraryLoading}
                    style={primaryButtonStyle}
                    onClick={() => void refreshMediaGrid()}
                  >
                    Odśwież siatkę
                  </button>
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
                  border: `1px solid ${COLORS.border}`,
                  marginBottom: 24,
                }}
              >
                <Field label="Szukaj">
                  <input
                    style={inputStyle}
                    value={mediaFilters.search}
                    onChange={(event) =>
                      setMediaFilters((prev) => ({ ...prev, search: event.target.value }))
                    }
                    placeholder="Nazwa / Klucz / Etykieta"
                  />
                </Field>
                <Field label="Mapowanie">
                  <select
                    style={inputStyle}
                    value={mediaFilters.mapped}
                    onChange={(event) =>
                      setMediaFilters((prev) => ({
                        ...prev,
                        mapped: event.target.value as MediaFiltersState['mapped'],
                      }))
                    }
                  >
                    <option value="all">Wszystkie</option>
                    <option value="mapped">Zmapowane</option>
                    <option value="unmapped">Niezmapowane</option>
                  </select>
                </Field>
                <Field label="Przeznaczenie">
                  <select
                    style={inputStyle}
                    value={mediaFilters.purpose}
                    onChange={(event) =>
                      setMediaFilters((prev) => ({
                        ...prev,
                        purpose: event.target.value as MediaFiltersState['purpose'],
                      }))
                    }
                  >
                    <option value="all">Wszystkie</option>
                    <option value="blog_article">Artykuł</option>
                    <option value="daily_card">Karta dnia</option>
                    <option value="horoscope_sign">Znak zodiaku</option>
                    <option value="fallback_general">Ogólne</option>
                  </select>
                </Field>
                <Field label="Znak zodiaku">
                  <select
                    style={inputStyle}
                    value={mediaFilters.sign}
                    onChange={(event) =>
                      setMediaFilters((prev) => ({ ...prev, sign: event.target.value }))
                    }
                  >
                    {signOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>
                <div style={{ display: 'flex', alignItems: 'end' }}>
                  <button
                    type="button"
                    style={{ ...primaryButtonStyle, width: '100%', padding: '12px' }}
                    onClick={() => void loadMediaLibrary({ page: 1 })}
                    disabled={mediaLibraryLoading}
                  >
                    Filtruj
                  </button>
                </div>
              </div>

              {mediaLibrary.length === 0 && !mediaLibraryLoading ? (
                <div
                  style={{
                    padding: 40,
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: 12,
                    border: `1px dashed ${COLORS.border}`,
                  }}
                >
                  <div style={{ fontSize: 40, marginBottom: 16 }}>🖼️</div>
                  <h3 style={{ fontWeight: 700, color: COLORS.text }}>Brak plików w bibliotece</h3>
                  <p style={{ color: COLORS.textLight, fontSize: 14, marginTop: 8 }}>
                    Dodaj obrazy w panelu Media Library, a następnie wróć tutaj i kliknij "Odśwież
                    siatkę".
                  </p>
                  <a
                    href="/admin/plugins/upload"
                    style={{
                      display: 'inline-block',
                      marginTop: 16,
                      color: COLORS.primary,
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
                      <span style={{ fontSize: 13, color: COLORS.textLight }}>
                        Znaleziono: <strong>{mediaLibraryPagination.total}</strong> plików
                      </span>
                      {bulkSelectedFileIds.length > 0 && (
                        <span
                          style={{
                            fontSize: 12,
                            background: COLORS.primaryLight,
                            color: COLORS.primary,
                            padding: '4px 12px',
                            borderRadius: 20,
                            fontWeight: 700,
                          }}
                        >
                          Zaznaczono: {bulkSelectedFileIds.length}
                        </span>
                      )}
                    </div>

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
                            onClick={() => pickMediaFile(item)}
                            style={{
                              border: isSelected
                                ? `2px solid ${COLORS.primary}`
                                : `1px solid ${COLORS.border}`,
                              borderRadius: 12,
                              padding: 8,
                              background: isSelected ? COLORS.primaryLight : '#fff',
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
                                onChange={() => toggleBulkSelection(item.id)}
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
                                  color: COLORS.text,
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
                      <button
                        type="button"
                        style={secondaryButtonStyle}
                        disabled={mediaLibraryPagination.page <= 1 || mediaLibraryLoading}
                        onClick={() => void goToMediaPage(mediaLibraryPagination.page - 1)}
                      >
                        ← Poprzednia
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                        {mediaLibraryPagination.page} / {mediaLibraryPagination.pageCount}
                      </span>
                      <button
                        type="button"
                        style={secondaryButtonStyle}
                        disabled={
                          mediaLibraryPagination.page >= mediaLibraryPagination.pageCount ||
                          mediaLibraryLoading
                        }
                        onClick={() => void goToMediaPage(mediaLibraryPagination.page + 1)}
                      >
                        Następna →
                      </button>
                    </div>
                  </div>

                  <div style={{ borderLeft: `1px solid ${COLORS.border}`, paddingLeft: 24 }}>
                    {selectedMediaFile ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div
                          style={{
                            background: '#f8fafc',
                            padding: 16,
                            borderRadius: 12,
                            border: `1px solid ${COLORS.border}`,
                          }}
                        >
                          <h3
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: COLORS.text,
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
                                  border: `1px solid ${COLORS.border}`,
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
                              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>
                                {selectedMediaFile.name}
                              </div>
                              <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}>
                                ID: #{selectedMediaFile.id}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gap: 16 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <Field label="Asset Key">
                              <input
                                style={{
                                  ...inputStyle,
                                  background: '#f8fafc',
                                  cursor: 'not-allowed',
                                }}
                                value={generatedMediaIdentity.asset_key}
                                readOnly
                              />
                            </Field>
                            <Field label="Etykieta">
                              <input
                                style={{
                                  ...inputStyle,
                                  background: '#f8fafc',
                                  cursor: 'not-allowed',
                                }}
                                value={generatedMediaIdentity.label}
                                readOnly
                              />
                            </Field>
                          </div>

                          <Field label="Przeznaczenie (Purpose)">
                            <select
                              style={inputStyle}
                              value={mediaAssetForm.purpose}
                              onChange={(event) => {
                                const purpose = event.target.value as MediaAssetFormState['purpose'];
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
                            >
                              <option value="blog_article">Artykuł blogowy</option>
                              <option value="daily_card">Karta dnia</option>
                              <option value="horoscope_sign">Znak zodiaku</option>
                              <option value="fallback_general">Ogólny fallback</option>
                            </select>
                          </Field>

                          {mediaAssetForm.purpose === 'horoscope_sign' && (
                            <Field label="Znak zodiaku">
                              <select
                                style={inputStyle}
                                value={mediaAssetForm.sign_slug}
                                onChange={(event) =>
                                  setMediaAssetForm((prev) => ({
                                    ...prev,
                                    sign_slug: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Wybierz znak...</option>
                                {signOptions
                                  .filter((s) => s !== 'all')
                                  .map((item) => (
                                    <option key={item} value={item.toLowerCase()}>
                                      {item}
                                    </option>
                                  ))}
                              </select>
                            </Field>
                          )}

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <Field label="Zasięg czasowy">
                              <select
                                style={inputStyle}
                                value={mediaAssetForm.period_scope}
                                onChange={(event) =>
                                  setMediaAssetForm((prev) => ({
                                    ...prev,
                                    period_scope: event.target.value as MediaAssetFormState['period_scope'],
                                  }))
                                }
                              >
                                <option value="any">Dowolny</option>
                                <option value="daily">Dzienny</option>
                                <option value="weekly">Tygodniowy</option>
                                <option value="monthly">Miesięczny</option>
                              </select>
                            </Field>
                            <Field label="Priorytet">
                              <input
                                type="number"
                                style={inputStyle}
                                value={mediaAssetForm.priority}
                                onChange={(event) =>
                                  setMediaAssetForm((prev) => ({
                                    ...prev,
                                    priority: Number(event.target.value),
                                  }))
                                }
                              />
                            </Field>
                          </div>

                          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                            <button
                              type="button"
                              style={{ ...primaryButtonStyle, flex: 1 }}
                              disabled={saving}
                              onClick={() => void saveMediaMapping()}
                            >
                              {saving ? 'Zapisywanie...' : 'Zapisz mapowanie'}
                            </button>
                            {selectedMediaFile.mapping && (
                              <button
                                type="button"
                                style={{
                                  ...secondaryButtonStyle,
                                  color: COLORS.danger,
                                  borderColor: COLORS.danger,
                                }}
                                disabled={saving}
                                onClick={() => {
                                  const mappingId = selectedMediaFile.mapping?.id;
                                  if (typeof mappingId === 'number') {
                                    void deleteMediaMapping(mappingId);
                                  }
                                }}
                              >
                                Usuń
                              </button>
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
                          color: COLORS.textLight,
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

            <section style={CARD_STYLE}>
              <h2 style={SECTION_TITLE_STYLE}>Operacje Masowe (Bulk)</h2>
              <div
                style={{
                  background: '#f8fafc',
                  padding: 20,
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button
                    type="button"
                    style={secondaryButtonStyle}
                    disabled={saving || bulkSelectedFileIds.length === 0}
                    onClick={() => void previewBulkMapping()}
                  >
                    Podgląd zmian ({bulkSelectedFileIds.length})
                  </button>
                  <button
                    type="button"
                    style={primaryButtonStyle}
                    disabled={saving || bulkSelectedFileIds.length === 0}
                    onClick={() => void applyBulkMapping()}
                  >
                    Zastosuj mapowanie masowe
                  </button>
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
                          border: `1px solid ${COLORS.border}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: COLORS.textLight,
                            textTransform: 'uppercase',
                          }}
                        >
                          Suma
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>
                          {bulkPreview.summary.total}
                        </div>
                      </div>
                      <div
                        style={{
                          background: '#fff',
                          padding: 12,
                          borderRadius: 8,
                          border: `1px solid ${COLORS.border}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: COLORS.textLight,
                            textTransform: 'uppercase',
                          }}
                        >
                          Nowe
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.secondary }}>
                          {bulkPreview.summary.previewCreate}
                        </div>
                      </div>
                      <div
                        style={{
                          background: '#fff',
                          padding: 12,
                          borderRadius: 8,
                          border: `1px solid ${COLORS.border}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: COLORS.textLight,
                            textTransform: 'uppercase',
                          }}
                        >
                          Błędy
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.danger }}>
                          {bulkPreview.summary.errors}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        maxHeight: 300,
                        overflowY: 'auto',
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 8,
                      }}
                    >
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr
                            style={{
                              background: '#f1f5f9',
                              borderBottom: `1px solid ${COLORS.border}`,
                            }}
                          >
                            <Th>Plik</Th>
                            <Th>Akcja</Th>
                            <Th>Klucz</Th>
                            <Th>Status</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkPreview.items.map((row, i) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                              <Td>#{String(row.fileId ?? '')}</Td>
                              <Td>{String(row.action ?? '')}</Td>
                              <Td>{String(row.asset_key ?? '')}</Td>
                              <Td>{String(row.status ?? '')}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section style={CARD_STYLE}>
              <h2 style={SECTION_TITLE_STYLE}>Ostatnie użycie mediów</h2>
              <div
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr
                      style={{ background: '#f8fafc', borderBottom: `1px solid ${COLORS.border}` }}
                    >
                      <Th>Zasób</Th>
                      <Th>Workflow</Th>
                      <Th>Treść</Th>
                      <Th>Kontekst</Th>
                      <Th>Data</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {mediaUsage.length === 0 ? (
                      <tr>
                        <Td
                          colSpan={5}
                          style={{ textAlign: 'center', padding: 24, color: COLORS.textLight }}
                        >
                          Brak danych o użyciu mediów.
                        </Td>
                      </tr>
                    ) : (
                      mediaUsage.map((item) => (
                        <tr key={item.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                          <Td>
                            <strong style={{ color: COLORS.text }}>{item.media_asset}</strong>
                          </Td>
                          <Td>{item.workflow}</Td>
                          <Td>
                            {item.content_uid} (#{item.content_entry_id})
                          </Td>
                          <Td>
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
                          </Td>
                          <Td style={{ color: COLORS.textLight }}>
                            {new Date(item.used_at).toLocaleString()}
                          </Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'runs' && (
          <section style={CARD_STYLE}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <div>
                <h2 style={{ ...SECTION_TITLE_STYLE, marginBottom: 4 }}>Monitoring Operacyjny</h2>
                <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
                  Historia wykonań, analiza AI i diagnostyka błędów w czasie rzeczywistym.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <StatTile label="Aktywne" value={liveRunCount} />
                <StatTile
                  label="Ostatnie 24h"
                  value={
                    runs.filter((r) => new Date(r.started_at) > new Date(Date.now() - 86400000))
                      .length
                  }
                />
                <StatTile
                  label="Błędy (24h)"
                  value={
                    runs.filter(
                      (r) =>
                        r.status === 'failed' &&
                        new Date(r.started_at) > new Date(Date.now() - 86400000)
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
                <select
                  style={inputStyle}
                  value={runFilters.status}
                  onChange={(event) =>
                    setRunFilters((prev) => ({
                      ...prev,
                      status: event.target.value as RunFiltersState['status'],
                    }))
                  }
                >
                  <option value="all">all</option>
                  <option value="running">running</option>
                  <option value="success">success</option>
                  <option value="failed">failed</option>
                  <option value="blocked_budget">blocked_budget</option>
                </select>
              </Field>
              <Field label="Workflow name">
                <input
                  style={inputStyle}
                  value={runFilters.workflowName}
                  onChange={(event) =>
                    setRunFilters((prev) => ({ ...prev, workflowName: event.target.value }))
                  }
                />
              </Field>
              <Field label="From">
                <input
                  type="date"
                  style={inputStyle}
                  value={runFilters.fromDate}
                  onChange={(event) =>
                    setRunFilters((prev) => ({ ...prev, fromDate: event.target.value }))
                  }
                />
              </Field>
              <Field label="To">
                <input
                  type="date"
                  style={inputStyle}
                  value={runFilters.toDate}
                  onChange={(event) =>
                    setRunFilters((prev) => ({ ...prev, toDate: event.target.value }))
                  }
                />
              </Field>
              <div style={{ display: 'flex', alignItems: 'end', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() => setRunFilters(initialRunFilters())}
                >
                  Clear
                </button>
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={() => {
                    void refreshMonitoringData(true);
                  }}
                >
                  Refresh
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                <thead>
                  <tr>
                    <Th />
                    <Th>ID</Th>
                    <Th>Workflow</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th>Started</Th>
                    <Th>Duration</Th>
                    <Th>Result</Th>
                    <Th>Action</Th>
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
                            borderBottom: `1px solid ${COLORS.border}`,
                          }}
                        >
                          <Td>
                            <button
                              type="button"
                              onClick={() => toggleRunDetails(run.id)}
                              style={{
                                border: `1px solid ${COLORS.border}`,
                                background: '#fff',
                                borderRadius: 8,
                                width: 28,
                                height: 28,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontWeight: 800,
                                color: COLORS.primary,
                              }}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          </Td>
                          <Td>
                            <span style={{ color: COLORS.textLight, fontWeight: 700 }}>
                              #{run.id}
                            </span>
                          </Td>
                          <Td>
                            <strong style={{ color: COLORS.text }}>
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
                            <div style={{ fontSize: 12, color: COLORS.text }}>
                              {formatDateTime(run.started_at)}
                            </div>
                          </Td>
                          <Td>
                            <div style={{ fontSize: 12, color: COLORS.textLight, fontWeight: 600 }}>
                              {formatDuration(run.started_at, run.finished_at)}
                            </div>
                          </Td>
                          <Td>
                            <div
                              style={{
                                fontSize: 12,
                                color: COLORS.text,
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
                              <button
                                type="button"
                                disabled={saving || run.status === 'running'}
                                onClick={() => void retryRun(run.id)}
                                style={{
                                  border: `1px solid ${COLORS.border}`,
                                  background: '#fff',
                                  borderRadius: 8,
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  opacity: saving || run.status === 'running' ? 0.5 : 1,
                                }}
                              >
                                Ponów
                              </button>
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
                                  <strong style={{ fontSize: 13 }}>Steps</strong>
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
                                        <Th>Step</Th>
                                        <Th>Message</Th>
                                        <Th>Output</Th>
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
                                  <strong style={{ fontSize: 13 }}>Details</strong>
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
                                    <span>Started: {formatDateTime(run.started_at)}</span>
                                    <span>Finished: {formatDateTime(run.finished_at)}</span>
                                    <span>Prompt tokens: {run.usage_prompt_tokens ?? 0}</span>
                                    <span>
                                      Completion tokens: {run.usage_completion_tokens ?? 0}
                                    </span>
                                    <span>Total tokens: {run.usage_total_tokens ?? 0}</span>
                                  </div>

                                  <ErrorInsight error={run.error_message} />
                                  <AutonomousIntelligence run={run} />

                                  <div style={{ marginTop: 16 }}>
                                    <strong style={{ fontSize: 13 }}>LLM trace</strong>
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
                                                {trace.redactionReason
                                                  ? `: ${trace.redactionReason}`
                                                  : '.'}
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
                                                value={JSON.stringify(
                                                  trace.request.messages,
                                                  null,
                                                  2
                                                )}
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
                                  <strong style={{ fontSize: 13 }}>Raw details</strong>
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
        )}

        {activeTab === 'social' && (
          <section style={CARD_STYLE}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <h2 style={{ ...SECTION_TITLE_STYLE, marginBottom: 0 }}>Social Ticket Ops</h2>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={() => {
                  void refreshSocialTickets();
                }}
              >
                Odśwież
              </button>
            </div>

            {socialOpsState !== 'ready' ? (
              <div
                style={{
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 10,
                  border:
                    socialOpsState === 'blocked'
                      ? '1px solid #fecaca'
                      : socialOpsState === 'degraded'
                        ? '1px solid #bfdbfe'
                        : '1px solid #facc15',
                  background:
                    socialOpsState === 'blocked'
                      ? '#fef2f2'
                      : socialOpsState === 'degraded'
                        ? '#eff6ff'
                        : '#fefce8',
                  color:
                    socialOpsState === 'blocked'
                      ? '#991b1b'
                      : socialOpsState === 'degraded'
                        ? '#1e40af'
                        : '#854d0e',
                  fontSize: 12,
                }}
              >
                Status: <strong>{socialOpsState}</strong>.{' '}
                {socialOpsMessage || 'Sprawdź RBAC i konfigurację endpointów social.'}
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
              <Field label="Platform">
                <select
                  style={inputStyle}
                  value={socialFilters.platform}
                  onChange={(event) =>
                    setSocialFilters((prev) => ({
                      ...prev,
                      platform: event.target.value as typeof socialFilters.platform,
                    }))
                  }
                >
                  <option value="all">all</option>
                  <option value="facebook">facebook</option>
                  <option value="instagram">instagram</option>
                  <option value="twitter">twitter</option>
                  <option value="tiktok">tiktok draft-only</option>
                </select>
              </Field>
              <Field label="Status">
                <select
                  style={inputStyle}
                  value={socialFilters.status}
                  onChange={(event) =>
                    setSocialFilters((prev) => ({
                      ...prev,
                      status: event.target.value as typeof socialFilters.status,
                    }))
                  }
                >
                  <option value="all">all</option>
                  <option value="scheduled">scheduled</option>
                  <option value="pending">pending</option>
                  <option value="published">published</option>
                  <option value="failed">failed</option>
                  <option value="canceled">canceled</option>
                </select>
              </Field>
              <Field label="Workflow ID">
                <input
                  style={inputStyle}
                  value={socialFilters.workflow}
                  onChange={(event) =>
                    setSocialFilters((prev) => ({ ...prev, workflow: event.target.value }))
                  }
                  placeholder="np. 3"
                />
              </Field>
              <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() => setSocialFilters({ platform: 'all', status: 'all', workflow: '' })}
                >
                  Clear
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1080 }}>
                <thead>
                  <tr>
                    <Th>ID</Th>
                    <Th>Platform</Th>
                    <Th>Status</Th>
                    <Th>Workflow</Th>
                    <Th>Scheduled</Th>
                    <Th>Attempt</Th>
                    <Th>Next Retry</Th>
                    <Th>Last Error</Th>
                    <Th>Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSocialTickets.map((ticket) => (
                    <tr key={ticket.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <Td>#{ticket.id}</Td>
                      <Td>{ticket.platform}</Td>
                      <Td>
                        <StatusPill status={ticket.status} />
                      </Td>
                      <Td>{getWorkflowId(ticket.workflow) ?? '-'}</Td>
                      <Td>{formatDateTime(ticket.scheduled_at)}</Td>
                      <Td>{ticket.attempt_count ?? 0}</Td>
                      <Td>
                        {ticket.next_attempt_at ? formatDateTime(ticket.next_attempt_at) : '-'}
                      </Td>
                      <Td>
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
                      </Td>
                      <Td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            style={secondaryButtonStyle}
                            disabled={
                              saving ||
                              ticket.status === 'published' ||
                              ticket.status === 'canceled'
                            }
                            onClick={() => {
                              void retrySocialTicket(ticket.id);
                            }}
                          >
                            Retry
                          </button>
                          <button
                            type="button"
                            style={secondaryButtonStyle}
                            disabled={
                              saving ||
                              ticket.status === 'published' ||
                              ticket.status === 'canceled'
                            }
                            onClick={() => {
                              void cancelSocialTicket(ticket.id);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSocialTickets.length === 0 ? (
                <div style={{ padding: 14, color: '#606477', fontSize: 13 }}>
                  Brak ticketów social dla filtrów.
                </div>
              ) : null}
            </div>
          </section>
        )}

        {activeTab === 'audit' && (
          <section style={CARD_STYLE}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <h2 style={{ ...SECTION_TITLE_STYLE, marginBottom: 0 }}>
                Production Audit (Go/No-Go)
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  disabled={saving}
                  onClick={() => {
                    void runPreflightAudit(false);
                  }}
                >
                  Run (soft)
                </button>
                <button
                  type="button"
                  style={primaryButtonStyle}
                  disabled={saving}
                  onClick={() => {
                    void runPreflightAudit(true);
                  }}
                >
                  Run Strict
                </button>
              </div>
            </div>

            {auditOpsState !== 'ready' ? (
              <div
                style={{
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 10,
                  border:
                    auditOpsState === 'blocked'
                      ? '1px solid #fecaca'
                      : auditOpsState === 'degraded'
                        ? '1px solid #bfdbfe'
                        : '1px solid #facc15',
                  background:
                    auditOpsState === 'blocked'
                      ? '#fef2f2'
                      : auditOpsState === 'degraded'
                        ? '#eff6ff'
                        : '#fefce8',
                  color:
                    auditOpsState === 'blocked'
                      ? '#991b1b'
                      : auditOpsState === 'degraded'
                        ? '#1e40af'
                        : '#854d0e',
                  fontSize: 12,
                }}
              >
                Status: <strong>{auditOpsState}</strong>.{' '}
                {auditOpsMessage || 'Sprawdź autoryzację i endpoint preflight.'}
              </div>
            ) : null}

            {auditReport ? (
              <div style={{ display: 'grid', gap: 14 }}>
                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: `1px solid ${auditReport.decision === 'NO_GO' ? '#fecaca' : auditReport.decision === 'GO_WITH_WARNINGS' ? '#fde68a' : '#86efac'}`,
                    background:
                      auditReport.decision === 'NO_GO'
                        ? '#fef2f2'
                        : auditReport.decision === 'GO_WITH_WARNINGS'
                          ? '#fffbeb'
                          : '#f0fdf4',
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 800 }}>
                    Decision: {auditReport.decision}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>
                    Critical failures: {auditReport.summary.criticalFailures} | Warnings:{' '}
                    {auditReport.summary.warnings} | Generated:{' '}
                    {formatDateTime(auditReport.generatedAt)}
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
                    <thead>
                      <tr>
                        <Th>Area</Th>
                        <Th>ID</Th>
                        <Th>Severity</Th>
                        <Th>Status</Th>
                        <Th>Message</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditReport.checks.map((check) => (
                        <tr key={check.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                          <Td>{check.area}</Td>
                          <Td>{check.id}</Td>
                          <Td>{check.severity}</Td>
                          <Td>
                            <StatusPill
                              status={
                                check.status === 'pass'
                                  ? 'success'
                                  : check.status === 'warn'
                                    ? 'blocked_budget'
                                    : 'failed'
                              }
                            />
                          </Td>
                          <Td>{check.message}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div
                    style={{
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 10,
                      padding: 12,
                      background: '#fff',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                      Failed Flows
                    </div>
                    {auditReport.failed_flows.length === 0 ? (
                      <div style={{ fontSize: 12, color: COLORS.textLight }}>
                        Brak krytycznych błędów flow.
                      </div>
                    ) : (
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 18,
                          fontSize: 12,
                          color: COLORS.text,
                          display: 'grid',
                          gap: 6,
                        }}
                      >
                        {auditReport.failed_flows.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div
                    style={{
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 10,
                      padding: 12,
                      background: '#fff',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                      Failed Access Checks
                    </div>
                    {auditReport.failed_access_checks.length === 0 ? (
                      <div style={{ fontSize: 12, color: COLORS.textLight }}>
                        Brak krytycznych braków RBAC/route.
                      </div>
                    ) : (
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 18,
                          fontSize: 12,
                          color: COLORS.text,
                          display: 'grid',
                          gap: 6,
                        }}
                      >
                        {auditReport.failed_access_checks.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div
                    style={{
                      border: '1px solid #fecaca',
                      borderRadius: 10,
                      padding: 12,
                      background: '#fff7f7',
                    }}
                  >
                    <div
                      style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', marginBottom: 8 }}
                    >
                      Critical Findings
                    </div>
                    {auditReport.critical_findings.length === 0 ? (
                      <div style={{ fontSize: 12, color: COLORS.textLight }}>
                        Brak krytycznych findingów.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {auditReport.critical_findings.map((finding) => (
                          <div
                            key={finding.id}
                            style={{
                              padding: 10,
                              border: '1px solid #fecaca',
                              borderRadius: 8,
                              background: '#fff',
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#7f1d1d' }}>
                              {finding.area} · {finding.id}
                            </div>
                            <div style={{ fontSize: 12, marginTop: 4 }}>{finding.message}</div>
                            <div style={{ fontSize: 12, color: '#9f1239', marginTop: 6 }}>
                              Remediation: {finding.remediation}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      border: '1px solid #fde68a',
                      borderRadius: 10,
                      padding: 12,
                      background: '#fffbeb',
                    }}
                  >
                    <div
                      style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 8 }}
                    >
                      Non-Critical Findings
                    </div>
                    {auditReport.non_critical_findings.length === 0 ? (
                      <div style={{ fontSize: 12, color: COLORS.textLight }}>Brak warningów.</div>
                    ) : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {auditReport.non_critical_findings.map((finding) => (
                          <div
                            key={finding.id}
                            style={{
                              padding: 10,
                              border: '1px solid #fde68a',
                              borderRadius: 8,
                              background: '#fff',
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#78350f' }}>
                              {finding.area} · {finding.id}
                            </div>
                            <div style={{ fontSize: 12, marginTop: 4 }}>{finding.message}</div>
                            <div style={{ fontSize: 12, color: '#92400e', marginTop: 6 }}>
                              Remediation: {finding.remediation}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: COLORS.textLight, fontSize: 13 }}>
                Brak raportu audytu. Uruchom preflight, aby otrzymać decyzję GO/NO-GO.
              </div>
            )}
          </section>
        )}

        {activeTab === 'growth' && (
          <div style={{ display: 'grid', gap: 24 }}>
            <section style={CARD_STYLE}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 20,
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <h2 style={{ ...SECTION_TITLE_STYLE, marginBottom: 4 }}>Growth Ops</h2>
                  <p style={{ fontSize: 13, color: COLORS.textLight, margin: 0 }}>
                    Strategy Agent, feedback SEO/performance i rekomendacje homepage bez zmiany
                    otwartego dostępu Premium.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={saving}
                    style={secondaryButtonStyle}
                    onClick={() => {
                      void refreshGrowthData();
                    }}
                  >
                    Odśwież dane
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    style={primaryButtonStyle}
                    onClick={() => {
                      void runProviderReadinessProbe();
                    }}
                  >
                    Provider preflight
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    style={primaryButtonStyle}
                    onClick={() => {
                      void importGa4Traffic();
                    }}
                  >
                    Importuj GA4
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 16,
                }}
              >
                <StatTile label="Pozycje planu" value={strategyPlan.length} />
                <StatTile label="Snapshoty performance" value={performanceSnapshots.length} />
                <StatTile label="Rekomendacje homepage" value={homepageRecommendations.length} />
                <StatTile
                  label="PROD readiness"
                  value={productionDecision}
                  color={
                    productionDecision === 'GO'
                      ? COLORS.secondary
                      : productionDecision === 'GO_WITH_WARNINGS'
                        ? COLORS.warning
                        : COLORS.danger
                  }
                />
                <StatTile
                  label="Provider readiness"
                  value={`${readyProviderCount}/${providerReadiness.length || 0}`}
                  color={blockedProviderCount > 0 ? COLORS.danger : COLORS.secondary}
                />
                <StatTile
                  label="Autonomy mode"
                  value={killSwitch ? 'KILL' : autonomyMode}
                  color={killSwitch ? COLORS.danger : undefined}
                />
                <StatTile
                  label="Dry-run blokady"
                  value={blockedDryRunStepCount}
                  color={blockedDryRunStepCount > 0 ? COLORS.warning : COLORS.secondary}
                />
                <StatTile
                  label="Global auto-publish"
                  value={settings.aico_auto_publish_enabled === false ? 'OFF' : 'ON'}
                  color={settings.aico_auto_publish_enabled === false ? COLORS.warning : undefined}
                />
              </div>
            </section>

            <section style={CARD_STYLE}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                  marginBottom: 16,
                }}
              >
                <div>
                  <h3 style={{ ...SECTION_TITLE_STYLE, fontSize: 16, marginBottom: 4 }}>
                    PROD GO / NO-GO
                  </h3>
                  <div style={{ fontSize: 12, color: COLORS.textLight }}>
                    Raport produkcyjnej gotowości agreguje policy, provider readiness, audit i live gates.
                  </div>
                </div>
                <StatusPill status={productionDecision} />
              </div>

              {productionReadiness ? (
                <div style={{ display: 'grid', gap: 14 }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 12,
                    }}
                  >
                    <StatTile
                      label="Blockery"
                      value={productionReadiness.blockers.length}
                      color={productionReadiness.blockers.length > 0 ? COLORS.danger : COLORS.secondary}
                    />
                    <StatTile
                      label="Warningi"
                      value={productionReadiness.warnings.length}
                      color={productionReadiness.warnings.length > 0 ? COLORS.warning : COLORS.secondary}
                    />
                    <StatTile
                      label="Live effects"
                      value={productionReadiness.liveEffectsAllowed ? 'ON' : 'OFF'}
                      color={productionReadiness.liveEffectsAllowed ? COLORS.danger : COLORS.textLight}
                    />
                    <StatTile
                      label="Providerzy wymagani"
                      value={productionReadiness.requiredProviders.length}
                    />
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <Th>Check</Th>
                          <Th>Area</Th>
                          <Th>Status</Th>
                          <Th>Message</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {productionReadiness.checks.map((check) => (
                          <tr key={check.id}>
                            <Td>{check.id}</Td>
                            <Td>{check.area}</Td>
                            <Td>
                              <StatusPill status={check.status} />
                            </Td>
                            <Td>{check.message}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 24, color: COLORS.textLight, textAlign: 'center' }}>
                  Brak raportu production readiness.
                </div>
              )}
            </section>

            <section style={CARD_STYLE}>
              <h3 style={{ ...SECTION_TITLE_STYLE, fontSize: 16 }}>Autonomy Control Plane</h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <StatTile
                  label="Daily ads cap"
                  value={String(autonomyPolicy.daily_ads_budget_pln ?? '-')}
                />
                <StatTile
                  label="LLM requests dziś"
                  value={String(autonomyStatus?.counts?.llmRequestsToday ?? '-')}
                />
                <StatTile
                  label="Media jobs dziś"
                  value={String(autonomyStatus?.counts?.mediaJobsToday ?? '-')}
                />
                <StatTile
                  label="Ads mutations dziś"
                  value={String(autonomyStatus?.counts?.adsMutationsToday ?? '-')}
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(220px, 1fr) auto',
                  gap: 12,
                  alignItems: 'end',
                  padding: 12,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  background: '#f8fafc',
                  marginBottom: 16,
                }}
              >
                <Field label="Controlled run-now confirmation">
                  <input
                    style={inputStyle}
                    value={runNowConfirmation}
                    onChange={(event) => setRunNowConfirmation(event.target.value)}
                    placeholder={RUN_NOW_CONFIRMATION}
                    autoComplete="off"
                  />
                </Field>
                <button
                  type="button"
                  disabled={saving || !canRunControlledAutonomyTick}
                  style={{
                    ...primaryButtonStyle,
                    background:
                      canRunControlledAutonomyTick && !saving
                        ? COLORS.danger
                        : COLORS.textLight,
                    boxShadow: 'none',
                    minWidth: 180,
                  }}
                  onClick={() => {
                    void runControlledAutonomyTick();
                  }}
                >
                  Controlled run-now
                </button>
              </div>

              {providerProbeResult ? (
                <div
                  style={{
                    padding: 12,
                    background: '#f8fafc',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 10,
                    marginBottom: 16,
                    fontSize: 12,
                    color: COLORS.textLight,
                  }}
                >
                  Ostatni provider preflight: {providerProbeResult.results.length} providerów,
                  connectivity {providerProbeResult.includeConnectivity ? 'ON' : 'OFF'}, live effects{' '}
                  {providerProbeResult.liveEffects ? 'ON' : 'OFF'}.
                </div>
              ) : null}

              <div style={{ overflowX: 'auto', marginBottom: 18 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <Th>Provider</Th>
                      <Th>Status</Th>
                      <Th>Credentials</Th>
                      <Th>Scopes</Th>
                      <Th>Last test</Th>
                      <Th>Blocked reason</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {providerReadiness.map((provider: ProviderReadiness) => (
                      <tr key={provider.provider}>
                        <Td>{provider.provider}</Td>
                        <Td>
                          <StatusPill status={provider.ready ? 'ready' : 'blocked'} />
                        </Td>
                        <Td>{provider.hasCredentials ? 'yes' : 'no'}</Td>
                        <Td>
                          {provider.missingScopes.length > 0
                            ? `missing: ${provider.missingScopes.join(', ')}`
                            : provider.requiredScopes.join(', ') || '-'}
                        </Td>
                        <Td>{provider.lastTestedAt ? formatDateTime(provider.lastTestedAt) : '-'}</Td>
                        <Td>{provider.blockedReason || '-'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {providerReadiness.length === 0 ? (
                  <div style={{ padding: 24, color: COLORS.textLight, textAlign: 'center' }}>
                    Brak macierzy provider readiness.
                  </div>
                ) : null}
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <Th>Dry-run step</Th>
                      <Th>Status</Th>
                      <Th>Reason</Th>
                      <Th>Output</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {dryRunSteps.map((step) => (
                      <tr key={String(step.id ?? step.label)}>
                        <Td>{String(step.label ?? step.id ?? '-')}</Td>
                        <Td>
                          <StatusPill status={String(step.status ?? 'idle')} />
                        </Td>
                        <Td>{String(step.reason ?? '-')}</Td>
                        <Td>
                          <pre
                            style={{
                              margin: 0,
                              whiteSpace: 'pre-wrap',
                              fontSize: 11,
                              color: COLORS.textLight,
                              maxWidth: 420,
                            }}
                          >
                            {formatDetailValue(step.output ?? {})}
                          </pre>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {dryRunSteps.length === 0 ? (
                  <div style={{ padding: 24, color: COLORS.textLight, textAlign: 'center' }}>
                    Brak dry-run preview autopilota.
                  </div>
                ) : null}
              </div>
            </section>

            <section style={CARD_STYLE}>
              <h3 style={{ ...SECTION_TITLE_STYLE, fontSize: 16 }}>Queues, Video, Ads, Experiments</h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <StatTile label="Generation jobs" value={generationJobs.length} />
                <StatTile label="Video assets" value={videoAssets.length} />
                <StatTile label="Ad plans" value={adCampaignPlans.length} />
                <StatTile label="Experiments" value={growthExperiments.length} />
                <StatTile label="Provider records" value={providerStatuses.length} />
              </div>

              <div style={{ overflowX: 'auto', marginBottom: 18 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <Th>Job</Th>
                      <Th>Type</Th>
                      <Th>Status</Th>
                      <Th>Priority</Th>
                      <Th>Blocked</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {generationJobs.slice(0, 10).map((job) => (
                      <tr key={job.id}>
                        <Td>#{job.id}</Td>
                        <Td>{job.job_type}</Td>
                        <Td>
                          <StatusPill status={job.status} />
                        </Td>
                        <Td>{job.priority_score ?? '-'}</Td>
                        <Td>{job.blocked_reason || job.last_error || '-'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {generationJobs.length === 0 ? (
                  <div style={{ padding: 18, color: COLORS.textLight, textAlign: 'center' }}>
                    Brak generation jobs.
                  </div>
                ) : null}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 18,
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Video assets</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <Th>Title</Th>
                        <Th>Status</Th>
                        <Th>Blocked</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {videoAssets.slice(0, 8).map((asset) => (
                        <tr key={asset.id}>
                          <Td>{asset.title}</Td>
                          <Td>
                            <StatusPill status={asset.status} />
                          </Td>
                          <Td>{asset.blocked_reason || asset.last_error || '-'}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Ad plans</div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(220px, 1fr) auto',
                      gap: 12,
                      alignItems: 'end',
                      marginBottom: 12,
                    }}
                  >
                    <Field label="Ads stop-loss confirmation">
                      <input
                        style={inputStyle}
                        value={adsStopLossConfirmation}
                        onChange={(event) => setAdsStopLossConfirmation(event.target.value)}
                        placeholder={ADS_STOP_LOSS_CONFIRMATION}
                        autoComplete="off"
                      />
                    </Field>
                    <button
                      type="button"
                      disabled={saving || !canRunAdsStopLoss}
                      style={{
                        ...primaryButtonStyle,
                        background:
                          canRunAdsStopLoss && !saving ? COLORS.danger : COLORS.textLight,
                        boxShadow: 'none',
                        minWidth: 180,
                      }}
                      onClick={() => {
                        void runAdsStopLoss();
                      }}
                    >
                      Pause active ads
                    </button>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <Th>Name</Th>
                        <Th>Platform</Th>
                        <Th>Status</Th>
                        <Th>Budget</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {adCampaignPlans.slice(0, 8).map((plan) => (
                        <tr key={plan.id}>
                          <Td>{plan.name}</Td>
                          <Td>{plan.platform}</Td>
                          <Td>
                            <StatusPill status={plan.status} />
                          </Td>
                          <Td>{plan.daily_budget_pln ?? '-'}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Experiments</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <Th>Name</Th>
                        <Th>Type</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {growthExperiments.slice(0, 8).map((experiment) => (
                        <tr key={experiment.id}>
                          <Td>{experiment.name}</Td>
                          <Td>{experiment.experiment_type}</Td>
                          <Td>
                            <StatusPill status={experiment.status} />
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section style={CARD_STYLE}>
              <h3 style={{ ...SECTION_TITLE_STYLE, fontSize: 16 }}>Strategy Agent</h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <Field label="Start tygodnia">
                  <input
                    type="date"
                    style={inputStyle}
                    value={strategyForm.weekStart}
                    onChange={(event) =>
                      setStrategyForm((prev) => ({ ...prev, weekStart: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Limit">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    style={inputStyle}
                    value={strategyForm.limit}
                    onChange={(event) =>
                      setStrategyForm((prev) => ({ ...prev, limit: Number(event.target.value) }))
                    }
                  />
                </Field>
                <Field label="Workflow article">
                  <select
                    style={inputStyle}
                    value={strategyForm.workflowId}
                    onChange={(event) =>
                      setStrategyForm((prev) => ({ ...prev, workflowId: event.target.value }))
                    }
                  >
                    <option value="">Wszystkie aktywne</option>
                    {workflows
                      .filter((workflow) => workflow.workflow_type === 'article')
                      .map((workflow) => (
                        <option key={workflow.id} value={workflow.id}>
                          #{workflow.id} {workflow.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <label style={{ ...checkboxRowStyle, alignSelf: 'end', minHeight: 46 }}>
                  <input
                    type="checkbox"
                    checked={strategyForm.autoApprove}
                    onChange={(event) =>
                      setStrategyForm((prev) => ({
                        ...prev,
                        autoApprove: event.target.checked,
                      }))
                    }
                  />
                  Auto-approve plan
                </label>
                <label
                  style={{
                    ...checkboxRowStyle,
                    padding: 14,
                    background: settings.aico_strategy_autopilot_enabled ? '#f0fdf4' : '#f8fafc',
                    border: `1px solid ${
                      settings.aico_strategy_autopilot_enabled ? '#bbf7d0' : COLORS.border
                    }`,
                    borderRadius: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={settings.aico_strategy_autopilot_enabled === true}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        aico_strategy_autopilot_enabled: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    Strategy autopilot
                    <span
                      style={{
                        display: 'block',
                        marginTop: 4,
                        fontSize: 12,
                        color: COLORS.textLight,
                        lineHeight: 1.5,
                      }}
                    >
                      Włączenie pozwala AICO samodzielnie uzupełniać plan treści według guardrails.
                      Domyślnie pozostaje wyłączone.
                    </span>
                  </span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <button
                  type="button"
                  disabled={saving}
                  style={primaryButtonStyle}
                  onClick={() => {
                    void generateStrategyPlan();
                  }}
                >
                  Wygeneruj plan
                </button>
                <button
                  type="button"
                  disabled={saving}
                  style={secondaryButtonStyle}
                  onClick={() => {
                    void approveStrategyPlan();
                  }}
                >
                  Zatwierdź do Topic Queue
                </button>
              </div>
              {strategyGenerateResult || strategyApproveResult ? (
                <div
                  style={{
                    display: 'grid',
                    gap: 6,
                    padding: 12,
                    background: '#f8fafc',
                    borderRadius: 10,
                    marginBottom: 16,
                    fontSize: 12,
                    color: COLORS.textLight,
                  }}
                >
                  {strategyGenerateResult ? (
                    <span>
                      Ostatnie generowanie: {strategyGenerateResult.created} utworzono,{' '}
                      {strategyGenerateResult.skipped} pominięto, tydzień{' '}
                      {strategyGenerateResult.weekStart}.
                    </span>
                  ) : null}
                  {strategyApproveResult ? (
                    <span>
                      Ostatnie zatwierdzenie: {strategyApproveResult.queued} queued,{' '}
                      {strategyApproveResult.skipped} pominięto.
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <Th>Tytuł</Th>
                      <Th>Status</Th>
                      <Th>SEO cluster</Th>
                      <Th>Priorytet</Th>
                      <Th>Publikacja</Th>
                      <Th>Uzasadnienie</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {strategyPlan.slice(0, 12).map((item) => (
                      <tr key={item.id}>
                        <Td>
                          <strong>{item.title}</strong>
                          {item.seo_intent ? (
                            <div style={{ fontSize: 11, color: COLORS.textLight }}>
                              {item.seo_intent}
                            </div>
                          ) : null}
                        </Td>
                        <Td>
                          <StatusPill status={item.status} />
                        </Td>
                        <Td>{item.seo_cluster || '-'}</Td>
                        <Td>{item.priority_score ?? '-'}</Td>
                        <Td>{formatDateTime(item.target_publish_at)}</Td>
                        <Td>
                          <span
                            style={{
                              display: 'block',
                              maxWidth: 260,
                              fontSize: 12,
                              color: COLORS.textLight,
                            }}
                          >
                            {item.agent_rationale || '-'}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {strategyPlan.length === 0 ? (
                  <div style={{ padding: 24, color: COLORS.textLight, textAlign: 'center' }}>
                    Brak pozycji planu.
                  </div>
                ) : null}
              </div>
            </section>

            <section style={CARD_STYLE}>
              <h3 style={{ ...SECTION_TITLE_STYLE, fontSize: 16 }}>SEO / Performance Feedback</h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <Field label="Dzień snapshotu">
                  <input
                    type="date"
                    style={inputStyle}
                    value={performanceForm.day}
                    onChange={(event) =>
                      setPerformanceForm((prev) => ({ ...prev, day: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Limit artykułów">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    style={inputStyle}
                    value={performanceForm.limit}
                    onChange={(event) =>
                      setPerformanceForm((prev) => ({ ...prev, limit: Number(event.target.value) }))
                    }
                  />
                </Field>
                <div style={{ alignSelf: 'end' }}>
                  <button
                    type="button"
                    disabled={saving}
                    style={primaryButtonStyle}
                    onClick={() => {
                      void aggregatePerformance();
                    }}
                  >
                    Przelicz performance
                  </button>
                </div>
              </div>
              {performanceAggregateResult ? (
                <div
                  style={{
                    padding: 12,
                    background: '#f8fafc',
                    borderRadius: 10,
                    marginBottom: 16,
                    fontSize: 12,
                    color: COLORS.textLight,
                  }}
                >
                  Ostatnia agregacja: {performanceAggregateResult.processed} snapshotów dla dnia{' '}
                  {performanceAggregateResult.day}.
                </div>
              ) : null}
              <div style={{ display: 'grid', gap: 10 }}>
                {performanceSnapshots.slice(0, 8).map((snapshot) => (
                  <div
                    key={snapshot.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: 12,
                      padding: 14,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 12,
                      background: '#fff',
                    }}
                  >
                    <div>
                      <strong style={{ color: COLORS.text }}>
                        {snapshot.content_title || snapshot.content_slug || snapshot.unique_key}
                      </strong>
                      <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>
                        {snapshot.snapshot_day} | views {snapshot.views ?? 0} | CTA{' '}
                        {snapshot.cta_clicks ?? 0} | premium events {snapshot.premium_events ?? 0}
                      </div>
                      {snapshot.recommendations ? (
                        <pre
                          style={{
                            margin: '8px 0 0',
                            whiteSpace: 'pre-wrap',
                            fontSize: 11,
                            color: COLORS.textLight,
                            background: '#f8fafc',
                            borderRadius: 8,
                            padding: 8,
                          }}
                        >
                          {formatDetailValue(snapshot.recommendations)}
                        </pre>
                      ) : null}
                    </div>
                    <StatusPill status={`score ${snapshot.score ?? 0}`} />
                  </div>
                ))}
                {performanceSnapshots.length === 0 ? (
                  <div style={{ padding: 24, color: COLORS.textLight, textAlign: 'center' }}>
                    Brak snapshotów performance.
                  </div>
                ) : null}
              </div>
            </section>

            <section style={CARD_STYLE}>
              <h3 style={{ ...SECTION_TITLE_STYLE, fontSize: 16 }}>Homepage Recommendations</h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(180px, 240px) auto',
                  gap: 16,
                  marginBottom: 16,
                  alignItems: 'end',
                }}
              >
                <Field label="Limit rekomendacji">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    style={inputStyle}
                    value={homepageForm.limit}
                    onChange={(event) =>
                      setHomepageForm((prev) => ({ ...prev, limit: Number(event.target.value) }))
                    }
                  />
                </Field>
                <button
                  type="button"
                  disabled={saving}
                  style={primaryButtonStyle}
                  onClick={() => {
                    void runHomepageRecommendations();
                  }}
                >
                  Przelicz homepage
                </button>
              </div>
              {homepageRunResult ? (
                <pre
                  style={{
                    margin: '0 0 16px',
                    whiteSpace: 'pre-wrap',
                    fontSize: 12,
                    color: COLORS.textLight,
                    background: '#f8fafc',
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  {formatDetailValue(homepageRunResult)}
                </pre>
              ) : null}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 12,
                }}
              >
                {homepageRecommendations.slice(0, 12).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 12,
                      padding: 14,
                      background: '#fff',
                      display: 'grid',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong style={{ color: COLORS.text }}>{item.title}</strong>
                      <StatusPill status={item.status} />
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textLight }}>
                      Slot: {item.slot} | Priority: {item.priority_score ?? '-'}
                    </div>
                    {item.subtitle ? (
                      <div style={{ fontSize: 12, color: COLORS.textLight }}>{item.subtitle}</div>
                    ) : null}
                    {item.rationale ? (
                      <div style={{ fontSize: 12, color: COLORS.text }}>{item.rationale}</div>
                    ) : null}
                    {item.target_url ? (
                      <a
                        href={item.target_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12, color: COLORS.primary, fontWeight: 700 }}
                      >
                        Podgląd celu
                      </a>
                    ) : null}
                  </div>
                ))}
                {homepageRecommendations.length === 0 ? (
                  <div style={{ padding: 24, color: COLORS.textLight, textAlign: 'center' }}>
                    Brak rekomendacji homepage.
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'settings' && (
          <section style={CARD_STYLE}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 24,
                paddingBottom: 16,
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <h2 style={{ ...SECTION_TITLE_STYLE, marginBottom: 0 }}>Ustawienia Systemowe</h2>
              <button
                type="button"
                disabled={saving}
                style={{ ...primaryButtonStyle, padding: '10px 24px' }}
                onClick={() => {
                  void saveSettings();
                }}
              >
                {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
              <div style={{ display: 'grid', gap: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
                  Konfiguracja Regionalna
                </h3>
                <Field label="Strefa czasowa (Timezone)">
                  <input
                    style={inputStyle}
                    value={settings.timezone}
                    onChange={(event) =>
                      setSettings((prev) => ({ ...prev, timezone: event.target.value }))
                    }
                    placeholder="UTC / Europe/Warsaw"
                  />
                </Field>
                <Field label="Lokalizacja (Locale)">
                  <input
                    style={inputStyle}
                    value={settings.locale}
                    onChange={(event) =>
                      setSettings((prev) => ({ ...prev, locale: event.target.value }))
                    }
                    placeholder="pl / en"
                  />
                </Field>
                <label
                  style={{
                    ...checkboxRowStyle,
                    padding: 14,
                    background:
                      settings.aico_auto_publish_enabled === false ? '#fffbeb' : '#f8fafc',
                    border: `1px solid ${
                      settings.aico_auto_publish_enabled === false ? '#fde68a' : COLORS.border
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
                        color: COLORS.textLight,
                        lineHeight: 1.5,
                      }}
                    >
                      Wyłączenie zatrzymuje autonomiczne publikowanie treści AICO, ale nie blokuje
                      dostępu do Premium.
                    </span>
                  </span>
                </label>
              </div>

              <div style={{ display: 'grid', gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, margin: 0 }}>
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

                <Field label="Model AI do generowania grafik">
                  <input
                    style={inputStyle}
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
                    borderLeft: `4px solid ${COLORS.primary}`,
                  }}
                >
                  <strong>Wskazówka:</strong> Ten model zostanie użyty przez agenta do
                  autonomicznego tworzenia grafik, gdy nie zostanie znalezione dopasowanie w
                  bibliotece Media Catalog.
                </div>
              </div>
            </div>
          </section>
        )}
        {renderWorkflowModal()}
        {renderTopicModal()}
        {renderRunDetailsModal()}
      </div>
    </Page.Main>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 13, color: '#47475a' }}>
      <span>{label}</span>
      {children}
    </label>
  );
};

const StatusPill = ({ status }: { status: string }) => {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.idle;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 12px',
        borderRadius: 20,
        background: colors.bg,
        color: colors.color,
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
        border: `1px solid ${colors.border}`,
      }}
    >
      {status}
    </span>
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
