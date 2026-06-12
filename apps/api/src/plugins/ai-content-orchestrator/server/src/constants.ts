export const PLUGIN_ID = 'ai-content-orchestrator';

export const WORKFLOW_UID = `plugin::${PLUGIN_ID}.workflow`;
export const TOPIC_QUEUE_UID = `plugin::${PLUGIN_ID}.topic-queue-item`;
export const RUN_LOG_UID = `plugin::${PLUGIN_ID}.run-log`;
export const PUBLICATION_TICKET_UID = `plugin::${PLUGIN_ID}.publication-ticket`;
export const SOCIAL_POST_TICKET_UID = `plugin::${PLUGIN_ID}.social-post-ticket`;
export const USAGE_DAILY_UID = `plugin::${PLUGIN_ID}.usage-daily`;
export const MEDIA_ASSET_UID = `plugin::${PLUGIN_ID}.media-asset`;
export const MEDIA_USAGE_LOG_UID = `plugin::${PLUGIN_ID}.media-usage-log`;
export const CONTENT_PLAN_ITEM_UID = `plugin::${PLUGIN_ID}.content-plan-item`;
export const CONTENT_PERFORMANCE_SNAPSHOT_UID = `plugin::${PLUGIN_ID}.content-performance-snapshot`;
export const EDITORIAL_MEMORY_UID = `plugin::${PLUGIN_ID}.editorial-memory`;
export const HOMEPAGE_RECOMMENDATION_UID = `plugin::${PLUGIN_ID}.homepage-recommendation`;
export const AUDIT_EVENT_UID = `plugin::${PLUGIN_ID}.audit-event`;
export const RUNTIME_LOCK_UID = `plugin::${PLUGIN_ID}.runtime-lock`;
export const AUTONOMY_POLICY_UID = `plugin::${PLUGIN_ID}.autonomy-policy`;
export const GENERATION_JOB_UID = `plugin::${PLUGIN_ID}.generation-job`;
export const VIDEO_ASSET_UID = `plugin::${PLUGIN_ID}.video-asset`;
export const TRAFFIC_SNAPSHOT_UID = `plugin::${PLUGIN_ID}.traffic-snapshot`;
export const AD_CAMPAIGN_PLAN_UID = `plugin::${PLUGIN_ID}.ad-campaign-plan`;
export const ADS_MUTATION_LEDGER_UID = `plugin::${PLUGIN_ID}.ads-mutation-ledger`;
export const GROWTH_EXPERIMENT_UID = `plugin::${PLUGIN_ID}.growth-experiment`;
export const PROVIDER_CREDENTIAL_STATUS_UID = `plugin::${PLUGIN_ID}.provider-credential-status`;

export const CONTENT_UIDS = {
  horoscope: 'api::horoscope.horoscope',
  article: 'api::article.article',
  tarotCard: 'api::tarot-card.tarot-card',
  dailyTarotDraw: 'api::daily-tarot-draw.daily-tarot-draw',
  zodiacSign: 'api::zodiac-sign.zodiac-sign',
  category: 'api::category.category',
  analyticsEvent: 'api::analytics-event.analytics-event',
} as const;

export const DEFAULT_TIMEZONE = 'Europe/Warsaw';
export const DEFAULT_LOCALE = 'pl';

export const CRON_TICK_RULE = '* * * * *';
export const CRON_DUE_WINDOW_MS = 90_000;

export const DEFAULT_RETRY_MAX = 3;
export const DEFAULT_RETRY_BACKOFF_SECONDS = 120;
export const DEFAULT_DAILY_REQUEST_LIMIT = 120;
export const DEFAULT_DAILY_TOKEN_LIMIT = 250_000;

export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_COMPLETION_TOKENS = 1800;

export const MAX_BACKFILL_DAYS = 120;

export const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export const ZODIAC_SIGNS_PL = [
  'Baran',
  'Byk',
  'Bliźnięta',
  'Rak',
  'Lew',
  'Panna',
  'Waga',
  'Skorpion',
  'Strzelec',
  'Koziorożec',
  'Wodnik',
  'Ryby',
] as const;

export const WORKFLOW_TYPES = [
  'horoscope',
  'daily_card',
  'article',
  'video_short',
  'ad_campaign',
  'homepage_curation',
  'traffic_analysis',
] as const;
export const RUN_TYPES = ['generate', 'publish', 'manual', 'backfill'] as const;
export const SOCIAL_CHANNELS = [
  'facebook',
  'instagram',
  'twitter',
  'tiktok',
  'youtube_shorts',
] as const;
export const PROVIDER_KEYS = [
  'openrouter',
  'replicate',
  'openai',
  'facebook',
  'instagram',
  'twitter',
  'tiktok',
  'youtube',
  'meta_ads',
  'google_ads',
  'ga4',
] as const;

export const HOROSCOPE_PERIODS = ['Dzienny', 'Tygodniowy', 'Miesięczny', 'Roczny'] as const;

export const RBAC_ACTIONS = {
  read: `plugin::${PLUGIN_ID}.read`,
  manageWorkflows: `plugin::${PLUGIN_ID}.manage-workflows`,
  manageSocial: `plugin::${PLUGIN_ID}.manage-social`,
  runAudit: `plugin::${PLUGIN_ID}.run-audit`,
  run: `plugin::${PLUGIN_ID}.run`,
  backfill: `plugin::${PLUGIN_ID}.backfill`,
  manageTopics: `plugin::${PLUGIN_ID}.manage-topics`,
  viewRuns: `plugin::${PLUGIN_ID}.view-runs`,
  manageMedia: `plugin::${PLUGIN_ID}.manage-media`,
  viewMediaUsage: `plugin::${PLUGIN_ID}.view-media-usage`,
  manageStrategy: `plugin::${PLUGIN_ID}.manage-strategy`,
  viewPerformance: `plugin::${PLUGIN_ID}.view-performance`,
  managePerformance: `plugin::${PLUGIN_ID}.manage-performance`,
  manageHomepage: `plugin::${PLUGIN_ID}.manage-homepage`,
  viewAuditTrail: `plugin::${PLUGIN_ID}.view-audit-trail`,
  manageAutonomy: `plugin::${PLUGIN_ID}.manage-autonomy`,
  manageAds: `plugin::${PLUGIN_ID}.manage-ads`,
  activateAds: `plugin::${PLUGIN_ID}.activate-ads`,
  pauseAds: `plugin::${PLUGIN_ID}.pause-ads`,
  manageVideo: `plugin::${PLUGIN_ID}.manage-video`,
  renderVideo: `plugin::${PLUGIN_ID}.render-video`,
  viewTraffic: `plugin::${PLUGIN_ID}.view-traffic`,
  importTraffic: `plugin::${PLUGIN_ID}.import-traffic`,
  manageExperiments: `plugin::${PLUGIN_ID}.manage-experiments`,
  viewProviderStatus: `plugin::${PLUGIN_ID}.view-provider-status`,
  testProviderReadiness: `plugin::${PLUGIN_ID}.test-provider-readiness`,
} as const;

export const TICKET_STATUS = {
  scheduled: 'scheduled',
  published: 'published',
  failed: 'failed',
  canceled: 'canceled',
} as const;

export const WORKFLOW_STATUS = {
  idle: 'idle',
  running: 'running',
  failed: 'failed',
  blockedBudget: 'blocked_budget',
} as const;

export const RUN_STATUS = {
  running: 'running',
  success: 'success',
  failed: 'failed',
  blockedBudget: 'blocked_budget',
} as const;

export const TOPIC_STATUS = {
  pending: 'pending',
  processing: 'processing',
  done: 'done',
  failed: 'failed',
} as const;
