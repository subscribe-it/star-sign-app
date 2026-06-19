export type Workflow = {
  id: number;
  name: string;
  enabled: boolean;
  status: 'idle' | 'running' | 'failed' | 'blocked_budget';
  workflow_type:
    | 'horoscope'
    | 'daily_card'
    | 'article'
    | 'video_short'
    | 'ad_campaign'
    | 'homepage_curation'
    | 'traffic_analysis';
  generate_cron: string;
  publish_cron: string;
  timezone: string;
  locale: string;
  llm_model: string;
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
  strategy_enabled?: boolean;
  performance_feedback_enabled?: boolean;
  content_cluster?: string | null;
  auto_publish_guardrails?: Record<string, unknown> | null;
  topic_mode: 'manual' | 'mixed';
  horoscope_period: 'Dzienny' | 'Tygodniowy' | 'Miesięczny' | 'Roczny';
  horoscope_type_values: string[];
  all_signs: boolean;
  article_category: number | null;
  default_editor_persona?: number | null;
  enabled_channels?: SocialPlatform[];
  fb_page_id?: string | null;
  ig_user_id?: string | null;
  x_api_key?: string | null;
  tt_creator_id?: string | null;
  has_api_token: boolean;
  has_image_gen_token?: boolean;
  has_fb_token?: boolean;
  has_ig_token?: boolean;
  has_x_api_secret?: boolean;
  has_x_access_token?: boolean;
  has_x_access_token_secret?: boolean;
  has_tt_token?: boolean;
  image_gen_model?: string | null;
  last_error?: string | null;
  last_generated_at?: string | null;
  last_published_at?: string | null;
};

// Redaktor (editor persona) — wirtualny autor o własnym, rozpoznawalnym głosie.
// Pola odwzorowują schema.json content-type'u editor-persona; sercem są pola
// zrozumiałe dla operatora (byline/specjalizacja/temperament/biogram) oraz
// instrukcja stylu dla AI (system_instruction). Pola id/key/optionals jak w Workflow.
export type Persona = {
  id: number;
  name: string;
  key?: string;
  byline?: string | null;
  bio?: string | null;
  specialization?: string | null;
  temperament?: string | null;
  writing_style?: Record<string, unknown> | null;
  system_instruction?: string | null;
  prompt_prefix?: string | null;
  prompt_suffix?: string | null;
  llm_model?: string | null;
  temperature?: number | null;
  enabled_for?: string[] | null;
  active?: boolean;
  priority?: number;
};

export type SocialPlatform = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'youtube_shorts';
export type ProviderKey =
  | 'openrouter'
  | 'replicate'
  | 'openai'
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'tiktok'
  | 'youtube'
  | 'meta_ads'
  | 'google_ads'
  | 'ga4';

export type ProviderReadiness = {
  provider: ProviderKey;
  status: 'unknown' | 'ready' | 'missing_credentials' | 'blocked' | 'failed';
  ready: boolean;
  hasCredentials: boolean;
  scopes: string[];
  requiredScopes: string[];
  missingScopes: string[];
  requiredFor: string[];
  stale: boolean;
  blockedReason?: string | null;
  lastTestedAt?: string | null;
  lastError?: Record<string, unknown> | null;
};

export type ProviderCredentialStatus = {
  id: number;
  provider: ProviderKey;
  status: 'unknown' | 'ready' | 'missing_credentials' | 'blocked' | 'failed';
  has_credentials?: boolean;
  scopes?: string[] | null;
  last_tested_at?: string | null;
  blocked_reason?: string | null;
  last_error?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ProviderProbeResult = {
  provider: ProviderKey;
  status: 'ready' | 'missing_credentials' | 'blocked' | 'failed';
  hasCredentials: boolean;
  scopes: string[];
  blockedReason?: string | null;
  connectivity: 'skipped' | 'passed' | 'failed';
  liveEffects: false;
};

export type ProviderProbeRunResult = {
  includeConnectivity: boolean;
  liveEffects: false;
  results: ProviderProbeResult[];
};

export type ProductionReadinessCheck = {
  id: string;
  area: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: Record<string, unknown>;
};

export type ProductionReadinessReport = {
  decision: 'GO' | 'GO_WITH_WARNINGS' | 'NO_GO';
  generatedAt: string;
  fullAutonomyRequired: boolean;
  liveEffectsAllowed: false;
  checks: ProductionReadinessCheck[];
  blockers: ProductionReadinessCheck[];
  warnings: ProductionReadinessCheck[];
  requiredProviders: ProviderKey[];
};

export type AutonomyStatus = {
  policy: Record<string, unknown>;
  counts: Record<string, unknown>;
  providerReadiness: ProviderReadiness[];
  dryRunPreview: Record<string, unknown>;
};

export type GenerationJob = {
  id: number;
  job_type: string;
  status: string;
  priority_score?: number;
  idempotency_key?: string | null;
  blocked_reason?: string | null;
  last_error?: string | null;
};

export type VideoAsset = {
  id: number;
  title: string;
  status: string;
  duration_seconds?: number | null;
  blocked_reason?: string | null;
  last_error?: string | null;
};

export type AdCampaignPlan = {
  id: number;
  name: string;
  platform: 'meta' | 'google';
  status: string;
  target_url: string;
  daily_budget_pln?: number;
  blocked_reason?: string | null;
};

export type AdStopLossSweepResult = {
  reason: string;
  attempted: number;
  paused: number;
  blocked: number;
  failed: number;
  results: Array<{
    id: number;
    status: string;
    blockedReason?: string | null;
    errorMessage?: string;
  }>;
};

export type GrowthExperiment = {
  id: number;
  name: string;
  experiment_type: string;
  status: string;
  winner_variant_key?: string | null;
};

export type SocialTicket = {
  id: number;
  platform: SocialPlatform;
  status: 'pending' | 'scheduled' | 'published' | 'failed' | 'canceled';
  caption: string;
  media_url?: string | null;
  target_url?: string | null;
  scheduled_at: string;
  published_on?: string | null;
  last_error?: string | null;
  attempt_count?: number;
  next_attempt_at?: string | null;
  provider_post_id?: string | null;
  blocked_reason?: string | null;
  workflow?: number | { id: number; name?: string } | null;
  source_run?: number | { id: number } | null;
};

export type SocialConnectionStatus = {
  platform: SocialPlatform;
  status: 'ready' | 'needs_action' | 'blocked' | 'degraded';
  message: string;
  details?: Record<string, unknown>;
};

export type SocialConnectionResult = {
  workflowId: number;
  overall: 'ready' | 'needs_action' | 'blocked' | 'degraded';
  channels: SocialConnectionStatus[];
};

export type SocialDryRunResult = {
  workflowId: number;
  overall: 'ready' | 'needs_action' | 'blocked' | 'degraded';
  channels: Array<SocialConnectionStatus & { renderedCaption: string }>;
};

export type AuditCheck = {
  id: string;
  area: string;
  severity: 'critical' | 'warning';
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: Record<string, unknown>;
};

export type AuditFinding = {
  id: string;
  area: string;
  message: string;
  remediation: string;
};

export type AuditReport = {
  decision: 'GO' | 'GO_WITH_WARNINGS' | 'NO_GO';
  strict: boolean;
  generatedAt: string;
  summary: {
    criticalFailures: number;
    warnings: number;
  };
  checks: AuditCheck[];
  failed_flows: string[];
  failed_access_checks: string[];
  critical_findings: AuditFinding[];
  non_critical_findings: AuditFinding[];
};

export type Topic = {
  id: number;
  title: string;
  brief?: string | null;
  image_asset_key?: string | null;
  status: 'pending' | 'processing' | 'done' | 'failed';
  scheduled_for?: string | null;
  processed_at?: string | null;
  error_message?: string | null;
  workflow?: number | null;
  article_category?: number | null;
  generated_article?: number | null;
};

export type Run = {
  id: number;
  run_type: 'generate' | 'publish' | 'manual' | 'backfill';
  status: 'running' | 'success' | 'failed' | 'blocked_budget';
  started_at: string;
  finished_at?: string | null;
  error_message?: string | null;
  attempts?: number;
  details?: Record<string, unknown>;
  usage_prompt_tokens?: number;
  usage_completion_tokens?: number;
  usage_total_tokens?: number;
  workflow?: number | { id: number; name?: string } | null;
};

export type RunStepStatus = 'pending' | 'running' | 'success' | 'failed';

export type RunStep = {
  id: string;
  label: string;
  status: RunStepStatus;
  message?: string | null;
  timestamp?: string | null;
  output?: unknown;
};

export type LlmTrace = {
  id: string;
  label: string;
  workflowType?: Workflow['workflow_type'];
  createdAt: string;
  redacted?: boolean;
  redactionReason?: string;
  request: {
    model: string;
    temperature: number;
    maxCompletionTokens: number;
    prompt: string;
    schemaDescription: string;
    messages: Array<{ role: 'system' | 'user'; content: string }>;
  };
  response: {
    content: string;
    payload: unknown;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };
};

export type DashboardSummary = {
  workflows: {
    total: number;
    enabled: number;
    failed: number;
  };
  runs: {
    failed: number;
    latest: Run[];
  };
  topics: {
    pending: number;
    failed: number;
  };
  publications: {
    scheduled: number;
    failed: number;
  };
  social: {
    scheduled: number;
    failed: number;
    published: number;
  };
  // Dzisiejsze zużycie kosztowe (LLM / media / reklamy) względem dziennych
  // limitów autonomii. Read-only, prezentowane na karcie "Budżet i zużycie (dziś)".
  usage?: DashboardUsageSummary;
  // Narracyjny, nietechniczny obraz dnia dla właściciela — zasila kartę
  // "Co zrobił autopilot" (co powstało, ile wydał, co czeka, podpowiedzi).
  operator?: OperatorSummary;
};

export type AutonomyMode = 'off' | 'draft_only' | 'guarded' | 'full';

export type OperatorRecommendationTone = 'info' | 'warning' | 'danger' | 'success';

export type OperatorRecommendation = {
  key: string;
  tone: OperatorRecommendationTone;
  message: string;
};

export type OperatorSummary = {
  generated: {
    total: number;
    successes: number;
    failures: number;
    running: number;
  };
  spend: DashboardUsageSummary;
  pipeline: {
    pendingTopics: number;
    plannedItems: number;
    scheduledPublications: number;
  };
  autonomy: {
    mode: AutonomyMode;
    modeLabel: string;
    killSwitch: boolean;
    llmTokenConfigured: boolean;
  };
  recommendations: OperatorRecommendation[];
};

export type DashboardUsageSummary = {
  llm: {
    requests: number;
    tokens: number;
    requestsCap: number;
  };
  media: {
    jobsToday: number;
    cap: number;
  };
  ads: {
    spentPln: number;
    capPln: number;
  };
};

export type DiagnosticsSummary = {
  ok: boolean;
  workflows: {
    total: number;
    enabled: number;
    issues: Array<{
      workflowId: number;
      name: string;
      workflow_type: string;
      enabled: boolean;
      message: string;
    }>;
  };
  media: {
    total: number;
    linkedActive: number;
    byPurpose: Record<string, { total: number; linkedActive: number }>;
  };
  topics: {
    pending: number;
    unassignedPending: number;
  };
  runs: {
    latestFailed: Run[];
  };
};

export type SettingsPayload = {
  timezone: string;
  locale: string;
  image_gen_model?: string;
  imageGenApiToken?: string;
  has_image_gen_token?: boolean;
  aico_auto_publish_enabled?: boolean;
  aico_strategy_autopilot_enabled?: boolean;
};

export type ContentPlanStatus =
  | 'planned'
  | 'approved'
  | 'queued'
  | 'published'
  | 'rejected'
  | 'failed';

export type ContentPlanItem = {
  id: number;
  title: string;
  brief?: string | null;
  seo_intent?: string | null;
  seo_cluster?: string | null;
  priority_score?: number | null;
  target_persona?: string | null;
  target_publish_at?: string | null;
  status: ContentPlanStatus;
  channels?: SocialPlatform[] | null;
  agent_rationale?: string | null;
  source?: 'strategy_agent' | 'manual' | 'performance_feedback' | null;
  dedupe_key?: string | null;
  metadata?: Record<string, unknown> | null;
  workflow?: number | { id: number; name?: string } | null;
  article_category?: number | { id: number; name?: string } | null;
  generated_topic?: number | { id: number; title?: string } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type StrategyGeneratePlanResult = {
  created: number;
  skipped: number;
  items: ContentPlanItem[];
  weekStart: string;
};

export type StrategyApprovePlanResult = {
  queued: number;
  skipped: number;
  topics: Topic[];
};

export type ContentPerformanceSnapshot = {
  id: number;
  unique_key: string;
  snapshot_day: string;
  content_uid: string;
  content_entry_id: number;
  content_slug?: string | null;
  content_title?: string | null;
  views?: number;
  premium_events?: number;
  cta_clicks?: number;
  checkout_events?: number;
  social_published?: number;
  social_failed?: number;
  freshness_days?: number;
  score?: number;
  recommendations?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  workflow?: number | { id: number; name?: string } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PerformanceAggregateResult = {
  day: string;
  processed: number;
  snapshots: ContentPerformanceSnapshot[];
};

export type HomepageRecommendation = {
  id: number;
  slot: 'today_in_stars' | 'weekly_focus' | 'recommended_for_you' | 'new_premium' | 'evergreen';
  title: string;
  subtitle?: string | null;
  target_url?: string | null;
  content_uid?: string | null;
  content_entry_id?: number | null;
  content_slug?: string | null;
  priority_score?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  status: 'scheduled' | 'active' | 'expired' | 'archived';
  rationale?: string | null;
  metadata?: Record<string, unknown> | null;
  workflow?: number | { id: number; name?: string } | null;
  source_snapshot?: number | { id: number } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type HomepageRecommendationsRunResult = {
  created?: number;
  expired?: number;
  updated?: number;
  skipped?: number;
  recommendations?: HomepageRecommendation[];
};

export type MediaAsset = {
  id: number;
  asset_key: string;
  label: string;
  purpose: 'horoscope_sign' | 'daily_card' | 'blog_article' | 'fallback_general';
  sign_slug?: string | null;
  period_scope?: 'any' | 'daily' | 'weekly' | 'monthly' | null;
  keywords?: string[] | null;
  priority?: number;
  active?: boolean;
  cooldown_days?: number;
  last_used_at?: string | null;
  use_count?: number;
  mapping_source?: 'manual' | 'suggestion' | 'bulk_suggestion' | 'seed' | null;
  mapping_confidence?: number | null;
  mapping_reasons?: string[] | null;
  notes?: string | null;
  asset?: {
    id: number;
    name?: string;
    url?: string;
    mime?: string;
    width?: number;
    height?: number;
    createdAt?: string;
  } | null;
};

export type MediaUsage = {
  id: number;
  content_uid: string;
  content_entry_id: number;
  context_key: string;
  used_at: string;
  target_date?: string | null;
  workflow?: number | null;
  media_asset?: number | null;
};

export type ApiEnvelope<T> = {
  data: T;
};

export type PaginationResult = {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
};

export type MediaMappingSuggestion = {
  asset_key: string;
  label: string;
  purpose: 'horoscope_sign' | 'daily_card' | 'blog_article' | 'fallback_general';
  sign_slug: string | null;
  period_scope: 'any' | 'daily' | 'weekly' | 'monthly';
  keywords: string[];
  confidence: number;
  reasons: string[];
};

export type MediaIdentityPreview = {
  fileId: number;
  asset_key: string;
  label: string;
  purpose: 'horoscope_sign' | 'daily_card' | 'blog_article' | 'fallback_general';
  sign_slug: string | null;
  period_scope: 'any' | 'daily' | 'weekly' | 'monthly';
};

export type MediaLibraryFile = {
  id: number;
  name: string;
  url: string;
  mime: string;
  width?: number | null;
  height?: number | null;
  createdAt?: string | null;
  formats?: Record<string, unknown> | null;
  mapping: MediaAsset | null;
  suggestion: MediaMappingSuggestion;
};

export type MediaLibraryListResult = {
  items: MediaLibraryFile[];
  pagination: PaginationResult;
};

export type MediaBulkUpsertItemRequest = {
  fileId: number;
  asset_key?: string;
  label?: string;
  purpose?: 'horoscope_sign' | 'daily_card' | 'blog_article' | 'fallback_general';
  sign_slug?: string | null;
  period_scope?: 'any' | 'daily' | 'weekly' | 'monthly';
  keywords?: string[] | string;
  priority?: number;
  active?: boolean;
  cooldown_days?: number;
  notes?: string | null;
};

export type MediaBulkUpsertResult = {
  dryRun: boolean;
  apply: boolean;
  summary: {
    total: number;
    previewCreate: number;
    previewUpdate: number;
    appliedCreate: number;
    appliedUpdate: number;
    errors: number;
  };
  items: Array<Record<string, unknown>>;
};
