import type { Core } from '@strapi/strapi';

import type {
  DEFAULT_LOCALE,
  DEFAULT_MAX_COMPLETION_TOKENS,
  DEFAULT_RETRY_BACKOFF_SECONDS,
  DEFAULT_RETRY_MAX,
  SOCIAL_CHANNELS,
  DEFAULT_TEMPERATURE,
  DEFAULT_TIMEZONE,
  WORKFLOW_TYPES,
  HOROSCOPE_PERIODS,
} from './constants';

export type Strapi = Core.Strapi;

export type WorkflowType = (typeof WORKFLOW_TYPES)[number];
export type HoroscopePeriod = (typeof HOROSCOPE_PERIODS)[number];

export type RunType = 'generate' | 'publish' | 'manual' | 'backfill';
export type RunStatus = 'running' | 'success' | 'failed' | 'blocked_budget';
export type RunStepStatus = 'pending' | 'running' | 'success' | 'failed';

export type WorkflowStatus = 'idle' | 'running' | 'failed' | 'blocked_budget';
export type SocialPlatform = (typeof SOCIAL_CHANNELS)[number];

export type TopicStatus = 'pending' | 'processing' | 'done' | 'failed';

export type WorkflowRecord = {
  id: number;
  name: string;
  enabled: boolean;
  status: WorkflowStatus;
  workflow_type: WorkflowType;
  generate_cron: string;
  publish_cron: string;
  timezone?: string;
  locale?: string;
  llm_model: string;
  llm_api_token_encrypted?: string | null;
  image_gen_model?: string;
  image_gen_api_token_encrypted?: string | null;
  prompt_template: string;
  temperature?: number;
  max_completion_tokens?: number;
  retry_max?: number;
  retry_backoff_seconds?: number;
  daily_request_limit?: number;
  daily_token_limit?: number;
  allow_manual_edit?: boolean;
  auto_publish?: boolean;
  force_regenerate?: boolean;
  strategy_enabled?: boolean;
  performance_feedback_enabled?: boolean;
  content_cluster?: string | null;
  auto_publish_guardrails?: Record<string, unknown> | null;
  topic_mode?: 'manual' | 'mixed';
  horoscope_period?: HoroscopePeriod;
  horoscope_type_values?: string[] | null;
  all_signs?: boolean;
  article_category?: number | { id: number } | null;
  last_generated_at?: string | Date | null;
  last_published_at?: string | Date | null;
  last_generation_slot?: string | null;
  last_publish_slot?: string | null;
  last_error?: string | null;
  enabled_channels?: SocialPlatform[] | null;
  fb_page_id?: string | null;
  fb_access_token_encrypted?: string | null;
  ig_user_id?: string | null;
  ig_access_token_encrypted?: string | null;
  x_api_key?: string | null;
  x_api_secret_encrypted?: string | null;
  x_access_token_encrypted?: string | null;
  x_access_token_secret_encrypted?: string | null;
  tt_creator_id?: string | null;
  tt_access_token_encrypted?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type TopicQueueItemRecord = {
  id: number;
  title: string;
  brief?: string | null;
  image_asset_key?: string | null;
  status: TopicStatus;
  scheduled_for?: string | null;
  processed_at?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
  seo_intent?: string | null;
  target_persona?: string | null;
  priority_score?: number | null;
  workflow?: number | { id: number } | null;
  article_category?: number | { id: number } | null;
  generated_article?: number | { id: number } | null;
  plan_item?: number | { id: number } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ContentPlanStatus =
  | 'planned'
  | 'approved'
  | 'queued'
  | 'published'
  | 'rejected'
  | 'failed';

export type ContentPlanItemRecord = {
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
  workflow?: number | { id: number } | null;
  article_category?: number | { id: number } | null;
  generated_topic?: number | { id: number } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ContentPerformanceSnapshotRecord = {
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
  organic_clicks?: number;
  social_engagements?: number;
  ad_spend_pln?: number;
  ad_clicks?: number;
  ad_conversions?: number;
  revenue_or_value?: number;
  freshness_days?: number;
  score?: number;
  recommendations?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  workflow?: number | { id: number } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type EditorialMemoryRecord = {
  id: number;
  key: string;
  label: string;
  memory_type:
    | 'brand_voice'
    | 'seo_rule'
    | 'persona'
    | 'prohibited_phrase'
    | 'linking_rule'
    | 'custom';
  content: string;
  active?: boolean;
  priority?: number;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type EditorPersonaRecord = {
  id: number;
  name: string;
  key: string;
  byline?: string | null;
  bio?: string | null;
  specialization?: string | null;
  avatar?:
    | number
    | {
        id: number;
        url?: string;
        name?: string;
        mime?: string;
        width?: number;
        height?: number;
        formats?: Record<string, unknown>;
      }
    | null;
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
  createdAt?: string;
  updatedAt?: string;
};

export type HomepageRecommendationRecord = {
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
  workflow?: number | { id: number } | null;
  source_snapshot?: number | { id: number } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AuditEventRecord = {
  id: number;
  event_key: string;
  action: string;
  outcome: 'success' | 'failure' | 'skipped';
  severity?: 'info' | 'warn' | 'error';
  occurred_at: string;
  actor_type?: 'admin' | 'system' | 'unknown';
  actor_id?: string | null;
  resource_uid?: string | null;
  resource_id?: string | null;
  resource_label?: string | null;
  request_id?: string | null;
  ip_hash?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type RuntimeLockRecord = {
  id: number;
  lock_key: string;
  owner_id: string;
  status: 'active' | 'released';
  acquired_at: string;
  expires_at: string;
  released_at?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PublicHomepageRecommendation = Pick<
  HomepageRecommendationRecord,
  | 'slot'
  | 'title'
  | 'subtitle'
  | 'target_url'
  | 'content_slug'
  | 'priority_score'
  | 'starts_at'
  | 'expires_at'
>;

export type MediaPurpose =
  | 'horoscope_sign'
  | 'daily_card'
  | 'blog_article'
  | 'zodiac_profile'
  | 'fallback_general'
  | 'short_video_frame'
  | 'social_story'
  | 'ad_creative'
  | 'youtube_short'
  | 'tiktok_video';
export type MediaPeriodScope = 'any' | 'daily' | 'weekly' | 'monthly';

export type MediaAssetRecord = {
  id: number;
  asset_key: string;
  label: string;
  purpose: MediaPurpose;
  sign_slug?: string | null;
  period_scope?: MediaPeriodScope | null;
  keywords?: string[] | null;
  priority?: number;
  active?: boolean;
  cooldown_days?: number;
  last_used_at?: string | null;
  use_count?: number;
  mapping_source?:
    | 'manual'
    | 'suggestion'
    | 'bulk_suggestion'
    | 'seed'
    | 'autonomous_agent'
    | null;
  mapping_confidence?: number | null;
  mapping_reasons?: string[] | null;
  notes?: string | null;
  asset?:
    | number
    | {
        id: number;
        url?: string;
        name?: string;
        mime?: string;
        width?: number;
        height?: number;
        createdAt?: string;
        formats?: Record<string, unknown>;
      }
    | null;
  createdAt?: string;
  updatedAt?: string;
};

export type MediaUsageLogRecord = {
  id: number;
  content_uid: string;
  content_entry_id: number;
  context_key: string;
  used_at: string;
  target_date?: string | null;
  workflow?: number | { id: number } | null;
  media_asset?: number | { id: number; asset_key?: string } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type RunLogRecord = {
  id: number;
  run_type: RunType;
  status: RunStatus;
  started_at: string;
  finished_at?: string | null;
  attempts?: number;
  error_message?: string | null;
  details?: Record<string, unknown> | null;
  usage_prompt_tokens?: number;
  usage_completion_tokens?: number;
  usage_total_tokens?: number;
  workflow?: number | { id: number } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type RunStepLog = {
  id: string;
  label: string;
  status: RunStepStatus;
  message?: string | null;
  timestamp?: string | null;
  output?: unknown;
};

export type PublicationTicketRecord = {
  id: number;
  status: 'scheduled' | 'published' | 'failed' | 'canceled';
  business_key: string;
  content_uid: string;
  content_entry_id: number;
  target_publish_at: string;
  published_on?: string | null;
  retries?: number;
  last_error?: string | null;
  payload?: Record<string, unknown> | null;
  workflow?: number | { id: number } | null;
  source_run?: number | { id: number } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SocialPostTicketRecord = {
  id: number;
  platform: SocialPlatform;
  status: 'pending' | 'scheduled' | 'published' | 'failed' | 'canceled';
  content_format?: 'image' | 'video' | 'link' | 'story';
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
  idempotency_key?: string | null;
  provider_payload?: Record<string, unknown> | null;
  utm_campaign?: string | null;
  workflow?: number | { id: number } | null;
  video_asset?: number | { id: number } | null;
  experiment?: number | { id: number } | null;
  source_run?: number | { id: number } | null;
  related_content_uid?: string | null;
  related_content_id?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AutonomyMode = 'off' | 'draft_only' | 'guarded' | 'full';
export type AdsPlatform = 'meta' | 'google';
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

export type AutonomyPolicyRecord = {
  id: number;
  policy_key: string;
  autonomy_mode: AutonomyMode;
  global_kill_switch?: boolean;
  daily_ads_budget_pln?: number;
  daily_meta_ads_budget_pln?: number;
  daily_google_ads_budget_pln?: number;
  daily_llm_request_limit?: number;
  daily_media_job_limit?: number;
  daily_video_job_limit?: number;
  max_auto_publish_per_day?: number;
  max_social_posts_per_day?: number;
  max_ads_mutations_per_day?: number;
  brand_safety_required?: boolean;
  legal_disclaimer_required?: boolean;
  no_sensitive_targeting?: boolean;
  guarded_max_ads_impact_pct?: number;
  ads_stop_loss_on_tick?: boolean;
  auto_apply_experiments?: boolean;
  allowed_social_channels?: string[] | null;
  allowed_ads_platforms?: AdsPlatform[] | null;
  stop_loss_rules?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type GenerationJobType =
  | 'article'
  | 'horoscope'
  | 'image'
  | 'video'
  | 'social_caption'
  | 'ad_creative'
  | 'homepage_slot';
export type GenerationJobStatus = 'queued' | 'running' | 'blocked' | 'succeeded' | 'failed' | 'canceled';

export type GenerationJobRecord = {
  id: number;
  job_type: GenerationJobType;
  status: GenerationJobStatus;
  priority_score?: number;
  scheduled_for?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  attempt_count?: number;
  max_attempts?: number;
  blocked_reason?: string | null;
  last_error?: string | null;
  input_summary?: Record<string, unknown> | null;
  output_summary?: Record<string, unknown> | null;
  provider?: string | null;
  provider_job_id?: string | null;
  cost_weight?: number;
  idempotency_key?: string | null;
  metadata?: Record<string, unknown> | null;
  workflow?: number | { id: number } | null;
  plan_item?: number | { id: number } | null;
  source_run?: number | { id: number } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type TrafficSnapshotRecord = {
  id: number;
  unique_key: string;
  snapshot_day: string;
  source: 'first_party' | 'ga4' | 'meta' | 'google_ads' | 'social';
  views?: number;
  sessions?: number;
  organic_clicks?: number;
  social_engagements?: number;
  ad_spend_pln?: number;
  ad_clicks?: number;
  ad_conversions?: number;
  revenue_or_value?: number;
  top_content?: Record<string, unknown> | null;
  recommendations?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type VideoAssetRecord = {
  id: number;
  title: string;
  status: 'queued' | 'storyboard' | 'rendering' | 'qc_passed' | 'uploaded' | 'scheduled' | 'failed' | 'canceled';
  script?: string | null;
  storyboard?: Record<string, unknown> | null;
  text_overlay?: Record<string, unknown> | null;
  subtitles?: string | null;
  provider?: string | null;
  provider_job_id?: string | null;
  aspect_ratio?: string | null;
  duration_seconds?: number | null;
  platform_variants?: Record<string, unknown> | null;
  blocked_reason?: string | null;
  last_error?: string | null;
  metadata?: Record<string, unknown> | null;
  workflow?: number | { id: number } | null;
  generation_job?: number | { id: number } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AdCampaignPlanRecord = {
  id: number;
  name: string;
  platform: AdsPlatform;
  status: 'draft' | 'ready' | 'active' | 'paused' | 'blocked' | 'failed' | 'completed';
  objective?: string | null;
  target_url: string;
  utm_campaign?: string | null;
  daily_budget_pln?: number;
  provider_campaign_id?: string | null;
  provider_adset_id?: string | null;
  provider_ad_id?: string | null;
  creative_payload?: Record<string, unknown> | null;
  targeting_payload?: Record<string, unknown> | null;
  stop_loss_state?: Record<string, unknown> | null;
  last_error?: string | null;
  blocked_reason?: string | null;
  metadata?: Record<string, unknown> | null;
  workflow?: number | { id: number } | null;
  experiment?: number | { id: number } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AdsMutationLedgerRecord = {
  id: number;
  unique_key: string;
  day: string;
  platform: AdsPlatform;
  operation: 'activate' | 'pause' | 'release';
  status: 'reserved' | 'applied' | 'released' | 'blocked' | 'failed';
  amount_pln?: number | string;
  provider_mode?: string | null;
  provider_decision?: string | null;
  provider_campaign_id?: string | null;
  blocked_reason?: string | null;
  metadata?: Record<string, unknown> | null;
  ad_campaign_plan?: number | { id: number } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type GrowthExperimentRecord = {
  id: number;
  name: string;
  experiment_type: 'content_title' | 'cta' | 'image' | 'social_caption' | 'ad_creative' | 'homepage_slot';
  status: 'draft' | 'running' | 'paused' | 'completed' | 'failed';
  primary_metric?: string | null;
  variants?: Record<string, unknown> | null;
  started_at?: string | null;
  ended_at?: string | null;
  winner_variant_key?: string | null;
  decision?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  workflow?: number | { id: number } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ProviderCredentialStatusRecord = {
  id: number;
  provider: ProviderKey;
  status: 'unknown' | 'ready' | 'missing_credentials' | 'blocked' | 'failed';
  has_credentials?: boolean;
  scopes?: string[] | null;
  last_tested_at?: string | null;
  blocked_reason?: string | null;
  last_error?: string | null;
  metadata?: Record<string, unknown> | null;
  workflow?: number | { id: number } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type UsageDailyRecord = {
  id: number;
  day: string;
  unique_key: string;
  status: 'ok' | 'blocked_budget';
  request_count: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  workflow?: number | { id: number } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type OpenRouterUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type LlmTraceMessage = {
  role: 'system' | 'user';
  content: string;
};

export type OpenRouterTrace = {
  redacted?: boolean;
  redactionReason?: string;
  request: {
    model: string;
    temperature: number;
    maxCompletionTokens: number;
    prompt: string;
    schemaDescription: string;
    messages: LlmTraceMessage[];
  };
  response: {
    content: string;
    payload: unknown;
    usage: OpenRouterUsage;
  };
};

export type LlmTraceLog = OpenRouterTrace & {
  id: string;
  label: string;
  workflowType?: WorkflowType;
  createdAt: string;
};

export type HoroscopeItem = {
  sign: string;
  title?: string;
  content: string;
  premiumContent?: string | null;
  type?: string;
};

export type HoroscopePayload = {
  items: HoroscopeItem[];
};

export type ArticlePayload = {
  title: string;
  slug?: string;
  excerpt: string;
  content: string;
  premiumContent?: string | null;
  isPremium?: boolean;
  author?: string;
  read_time_minutes?: number;
};

export type DailyCardPayload = {
  title: string;
  slug?: string;
  excerpt: string;
  content: string;
  premiumContent: string;
  isPremium?: boolean;
  draw_message: string;
  author?: string;
  read_time_minutes?: number;
};

export type GeneratePayload = HoroscopePayload | ArticlePayload | DailyCardPayload;

export type NormalizedWorkflowConfig = {
  id: number;
  name: string;
  enabled: boolean;
  status: WorkflowStatus;
  workflowType: WorkflowType;
  generateCron: string;
  publishCron: string;
  timezone: string;
  locale: string;
  llmModel: string;
  llmTokenEncrypted: string;
  imageGenModel: string;
  imageGenTokenEncrypted?: string | null;
  promptTemplate: string;
  temperature: number;
  maxCompletionTokens: number;
  retryMax: number;
  retryBackoffSeconds: number;
  dailyRequestLimit: number;
  dailyTokenLimit: number;
  allowManualEdit: boolean;
  autoPublish: boolean;
  forceRegenerate: boolean;
  strategyEnabled: boolean;
  performanceFeedbackEnabled: boolean;
  contentCluster?: string | null;
  autoPublishGuardrails: Record<string, unknown>;
  topicMode: 'manual' | 'mixed';
  horoscopePeriod: HoroscopePeriod;
  horoscopeTypeValues: string[];
  allSigns: boolean;
  articleCategoryId: number | null;
  lastGenerationSlot: string | null;
  lastPublishSlot: string | null;
  enabledChannels: SocialPlatform[];
  fbPageId?: string | null;
  fbTokenEncrypted?: string | null;
  igUserId?: string | null;
  igTokenEncrypted?: string | null;
  xApiKey?: string | null;
  xApiSecretEncrypted?: string | null;
  xAccessTokenEncrypted?: string | null;
  xAccessTokenSecretEncrypted?: string | null;
  ttCreatorId?: string | null;
  ttTokenEncrypted?: string | null;
};

export type CreateRunInput = {
  workflowId?: number;
  runType: RunType;
  status: RunStatus;
  startedAt: Date;
  attempts?: number;
  details?: Record<string, unknown>;
  errorMessage?: string;
};

export type CompleteRunInput = {
  runId: number;
  status: RunStatus;
  errorMessage?: string;
  details?: Record<string, unknown>;
  usage?: OpenRouterUsage;
};

export type WorkflowUpdatePayload = Partial<
  Pick<
    WorkflowRecord,
    | 'name'
    | 'enabled'
    | 'workflow_type'
    | 'generate_cron'
    | 'publish_cron'
    | 'timezone'
    | 'locale'
    | 'llm_model'
    | 'prompt_template'
    | 'temperature'
    | 'max_completion_tokens'
    | 'retry_max'
    | 'retry_backoff_seconds'
    | 'daily_request_limit'
    | 'daily_token_limit'
    | 'all_signs'
    | 'article_category'
    | 'image_gen_model'
    | 'enabled_channels'
    | 'allow_manual_edit'
    | 'auto_publish'
    | 'force_regenerate'
    | 'strategy_enabled'
    | 'performance_feedback_enabled'
    | 'content_cluster'
    | 'auto_publish_guardrails'
    | 'topic_mode'
    | 'horoscope_period'
    | 'horoscope_type_values'
    | 'fb_page_id'
    | 'ig_user_id'
    | 'x_api_key'
    | 'tt_creator_id'
  >
> & {
  apiToken?: string;
  imageGenApiToken?: string;
  fbAccessToken?: string;
  igAccessToken?: string;
  xApiSecret?: string;
  xAccessToken?: string;
  xAccessTokenSecret?: string;
  ttAccessToken?: string;
};

export type BackfillPayload = {
  startDate: string;
  endDate: string;
  dryRun?: boolean;
};

export type RuntimeDefaults = {
  timezone: typeof DEFAULT_TIMEZONE;
  locale: typeof DEFAULT_LOCALE;
  temperature: typeof DEFAULT_TEMPERATURE;
  maxCompletionTokens: typeof DEFAULT_MAX_COMPLETION_TOKENS;
  retryMax: typeof DEFAULT_RETRY_MAX;
  retryBackoffSeconds: typeof DEFAULT_RETRY_BACKOFF_SECONDS;
};
