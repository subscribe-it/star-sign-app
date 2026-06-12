import type { FetchClient } from '@strapi/strapi/admin';

import type {
  ApiEnvelope,
  AdCampaignPlan,
  AdStopLossSweepResult,
  AutonomyStatus,
  ContentPerformanceSnapshot,
  ContentPlanItem,
  DashboardSummary,
  DiagnosticsSummary,
  GenerationJob,
  GrowthExperiment,
  HomepageRecommendation,
  HomepageRecommendationsRunResult,
  MediaAsset,
  MediaBulkUpsertItemRequest,
  MediaBulkUpsertResult,
  MediaIdentityPreview,
  MediaLibraryListResult,
  MediaUsage,
  Run,
  SocialConnectionResult,
  SocialDryRunResult,
  SocialTicket,
  AuditReport,
  SettingsPayload,
  SocialPlatform,
  PerformanceAggregateResult,
  ProviderCredentialStatus,
  ProviderProbeRunResult,
  ProviderReadiness,
  ProductionReadinessReport,
  StrategyApprovePlanResult,
  StrategyGeneratePlanResult,
  Topic,
  VideoAsset,
  Workflow,
} from './types';

const BASE = '/ai-content-orchestrator';

export const api = {
  async getDashboard(client: FetchClient): Promise<DashboardSummary> {
    const { data } = await client.get<ApiEnvelope<DashboardSummary>>(`${BASE}/dashboard`);
    return data.data;
  },

  async getDiagnostics(client: FetchClient): Promise<DiagnosticsSummary> {
    const { data } = await client.get<ApiEnvelope<DiagnosticsSummary>>(`${BASE}/diagnostics`);
    return data.data;
  },

  async getWorkflows(client: FetchClient): Promise<Workflow[]> {
    const { data } = await client.get<ApiEnvelope<Workflow[]>>(`${BASE}/workflows`);
    return data.data;
  },

  async createWorkflow(client: FetchClient, payload: Record<string, unknown>): Promise<Workflow> {
    const { data } = await client.post<ApiEnvelope<Workflow>, Record<string, unknown>>(
      `${BASE}/workflows`,
      payload
    );
    return data.data;
  },

  async updateWorkflow(
    client: FetchClient,
    id: number,
    payload: Record<string, unknown>
  ): Promise<Workflow> {
    const { data } = await client.put<ApiEnvelope<Workflow>, Record<string, unknown>>(
      `${BASE}/workflows/${id}`,
      payload
    );
    return data.data;
  },

  async runNow(client: FetchClient, id: number): Promise<Record<string, unknown>> {
    const { data } = await client.post<ApiEnvelope<Record<string, unknown>>>(
      `${BASE}/workflows/${id}/run-now`
    );
    return data.data;
  },

  async stopWorkflow(client: FetchClient, id: number): Promise<Record<string, unknown>> {
    const { data } = await client.post<ApiEnvelope<Record<string, unknown>>>(
      `${BASE}/workflows/${id}/stop`
    );
    return data.data;
  },

  async deleteWorkflow(client: FetchClient, id: number): Promise<Workflow> {
    const { data } = await client.post<ApiEnvelope<Workflow>>(`${BASE}/workflows/${id}/delete`);
    return data.data;
  },

  async backfill(
    client: FetchClient,
    id: number,
    payload: { startDate: string; endDate: string; dryRun?: boolean }
  ): Promise<Record<string, unknown>> {
    const { data } = await client.post<ApiEnvelope<Record<string, unknown>>, typeof payload>(
      `${BASE}/workflows/${id}/backfill`,
      payload
    );
    return data.data;
  },

  async getTopics(client: FetchClient): Promise<Topic[]> {
    const { data } = await client.get<ApiEnvelope<Topic[]>>(`${BASE}/topics`);
    return data.data;
  },

  async createTopic(client: FetchClient, payload: Record<string, unknown>): Promise<Topic> {
    const { data } = await client.post<ApiEnvelope<Topic>, Record<string, unknown>>(
      `${BASE}/topics`,
      payload
    );
    return data.data;
  },

  async updateTopic(
    client: FetchClient,
    id: number,
    payload: Record<string, unknown>
  ): Promise<Topic> {
    const { data } = await client.put<ApiEnvelope<Topic>, Record<string, unknown>>(
      `${BASE}/topics/${id}`,
      payload
    );
    return data.data;
  },

  async getRuns(client: FetchClient, params?: { limit?: number }): Promise<Run[]> {
    const query = new URLSearchParams();
    if (params?.limit) {
      query.set('limit', String(params.limit));
    }

    const queryString = query.toString();
    const { data } = await client.get<ApiEnvelope<Run[]>>(
      `${BASE}/runs${queryString ? `?${queryString}` : ''}`
    );
    return data.data;
  },

  async retryRun(client: FetchClient, id: number): Promise<Record<string, unknown>> {
    const { data } = await client.post<ApiEnvelope<Record<string, unknown>>>(
      `${BASE}/runs/${id}/retry`
    );
    return data.data;
  },

  async getSocialTickets(
    client: FetchClient,
    params?: {
      platform?: string;
      status?: string;
      workflowId?: number;
      page?: number;
      limit?: number;
    }
  ): Promise<SocialTicket[]> {
    const query = new URLSearchParams();
    if (params?.platform) query.set('platform', params.platform);
    if (params?.status) query.set('status', params.status);
    if (typeof params?.workflowId === 'number') query.set('workflowId', String(params.workflowId));
    if (typeof params?.page === 'number') query.set('page', String(params.page));
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));

    const queryString = query.toString();
    const { data } = await client.get<ApiEnvelope<SocialTicket[]>>(
      `${BASE}/social/tickets${queryString ? `?${queryString}` : ''}`
    );
    return data.data;
  },

  async testSocialConnection(
    client: FetchClient,
    payload: { workflowId: number; channels?: SocialPlatform[] }
  ): Promise<SocialConnectionResult> {
    const { data } = await client.post<ApiEnvelope<SocialConnectionResult>, typeof payload>(
      `${BASE}/social/test-connection`,
      payload
    );
    return data.data;
  },

  async dryRunSocial(
    client: FetchClient,
    payload: {
      workflowId: number;
      channels?: SocialPlatform[];
      caption?: string;
      mediaUrl?: string;
      targetUrl?: string;
    }
  ): Promise<SocialDryRunResult> {
    const { data } = await client.post<ApiEnvelope<SocialDryRunResult>, typeof payload>(
      `${BASE}/social/dry-run`,
      payload
    );
    return data.data;
  },

  async retrySocialTicket(client: FetchClient, id: number): Promise<SocialTicket> {
    const { data } = await client.post<ApiEnvelope<SocialTicket>>(
      `${BASE}/social/tickets/${id}/retry`
    );
    return data.data;
  },

  async cancelSocialTicket(client: FetchClient, id: number): Promise<SocialTicket> {
    const { data } = await client.post<ApiEnvelope<SocialTicket>>(
      `${BASE}/social/tickets/${id}/cancel`
    );
    return data.data;
  },

  async getAuditPreflight(client: FetchClient): Promise<AuditReport> {
    const { data } = await client.get<ApiEnvelope<AuditReport>>(`${BASE}/audit/preflight`);
    return data.data;
  },

  async runAuditPreflight(
    client: FetchClient,
    strict = true,
    includeConnectivity = false
  ): Promise<AuditReport> {
    const { data } = await client.post<
      ApiEnvelope<AuditReport>,
      { strict: boolean; includeConnectivity: boolean }
    >(
      `${BASE}/audit/preflight`,
      {
        strict,
        includeConnectivity,
      }
    );
    return data.data;
  },

  async getSettings(client: FetchClient): Promise<SettingsPayload> {
    const { data } = await client.get<ApiEnvelope<SettingsPayload>>(`${BASE}/settings`);
    return data.data;
  },

  async updateSettings(client: FetchClient, payload: SettingsPayload): Promise<SettingsPayload> {
    const { data } = await client.put<ApiEnvelope<SettingsPayload>, SettingsPayload>(
      `${BASE}/settings`,
      payload
    );
    return data.data;
  },

  async getStrategyPlan(
    client: FetchClient,
    params?: { status?: string; limit?: number }
  ): Promise<ContentPlanItem[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));

    const queryString = query.toString();
    const { data } = await client.get<ApiEnvelope<ContentPlanItem[]>>(
      `${BASE}/strategy/plan${queryString ? `?${queryString}` : ''}`
    );
    return data.data;
  },

  async generateStrategyPlan(
    client: FetchClient,
    payload: {
      weekStart?: string;
      limit?: number;
      workflowId?: number;
      autoApprove?: boolean;
    }
  ): Promise<StrategyGeneratePlanResult> {
    const { data } = await client.post<ApiEnvelope<StrategyGeneratePlanResult>, typeof payload>(
      `${BASE}/strategy/generate-plan`,
      payload
    );
    return data.data;
  },

  async approveStrategyPlan(
    client: FetchClient,
    payload: { ids?: number[]; limit?: number }
  ): Promise<StrategyApprovePlanResult> {
    const { data } = await client.post<ApiEnvelope<StrategyApprovePlanResult>, typeof payload>(
      `${BASE}/strategy/approve-plan`,
      payload
    );
    return data.data;
  },

  async getPerformance(
    client: FetchClient,
    params?: { limit?: number }
  ): Promise<ContentPerformanceSnapshot[]> {
    const query = new URLSearchParams();
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));

    const queryString = query.toString();
    const { data } = await client.get<ApiEnvelope<ContentPerformanceSnapshot[]>>(
      `${BASE}/performance${queryString ? `?${queryString}` : ''}`
    );
    return data.data;
  },

  async aggregatePerformance(
    client: FetchClient,
    payload: { day?: string; limit?: number }
  ): Promise<PerformanceAggregateResult> {
    const { data } = await client.post<ApiEnvelope<PerformanceAggregateResult>, typeof payload>(
      `${BASE}/performance/aggregate`,
      payload
    );
    return data.data;
  },

  async getHomepageRecommendations(
    client: FetchClient,
    params?: { status?: string; limit?: number }
  ): Promise<HomepageRecommendation[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));

    const queryString = query.toString();
    const { data } = await client.get<ApiEnvelope<HomepageRecommendation[]>>(
      `${BASE}/homepage/recommendations${queryString ? `?${queryString}` : ''}`
    );
    return data.data;
  },

  async runHomepageRecommendations(
    client: FetchClient,
    payload: { limit?: number }
  ): Promise<HomepageRecommendationsRunResult> {
    const { data } = await client.post<
      ApiEnvelope<HomepageRecommendationsRunResult>,
      typeof payload
    >(`${BASE}/homepage/recommendations/run`, payload);
    return data.data;
  },

  async getMediaAssets(client: FetchClient): Promise<MediaAsset[]> {
    const { data } = await client.get<ApiEnvelope<MediaAsset[]>>(`${BASE}/media-assets`);
    return data.data;
  },

  async createMediaAsset(
    client: FetchClient,
    payload: Record<string, unknown>
  ): Promise<MediaAsset> {
    const { data } = await client.post<ApiEnvelope<MediaAsset>, Record<string, unknown>>(
      `${BASE}/media-assets`,
      payload
    );
    return data.data;
  },

  async updateMediaAsset(
    client: FetchClient,
    id: number,
    payload: Record<string, unknown>
  ): Promise<MediaAsset> {
    const { data } = await client.put<ApiEnvelope<MediaAsset>, Record<string, unknown>>(
      `${BASE}/media-assets/${id}`,
      payload
    );
    return data.data;
  },

  async deleteMediaAsset(client: FetchClient, id: number): Promise<void> {
    await client.post(`${BASE}/media-assets/${id}/delete`);
  },

  async deleteTopic(client: FetchClient, id: number): Promise<void> {
    await client.post(`${BASE}/topics/${id}/delete`);
  },

  async getMediaLibraryFiles(
    client: FetchClient,
    params?: {
      page?: number;
      pageSize?: number;
      search?: string;
      mapped?: 'all' | 'mapped' | 'unmapped';
      purpose?: 'all' | 'horoscope_sign' | 'daily_card' | 'blog_article' | 'fallback_general';
      sign?: string;
      active?: 'all' | 'active' | 'inactive';
      sort?: 'createdAtDesc' | 'createdAtAsc' | 'nameAsc' | 'nameDesc';
    }
  ): Promise<MediaLibraryListResult> {
    const query = new URLSearchParams();

    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.search) query.set('search', params.search);
    if (params?.mapped) query.set('mapped', params.mapped);
    if (params?.purpose) query.set('purpose', params.purpose);
    if (params?.sign) query.set('sign', params.sign);
    if (params?.active) query.set('active', params.active);
    if (params?.sort) query.set('sort', params.sort);

    const queryString = query.toString();
    const { data } = await client.get<ApiEnvelope<MediaLibraryListResult>>(
      `${BASE}/media-library/files${queryString ? `?${queryString}` : ''}`
    );

    return data.data;
  },

  async bulkUpsertMediaAssets(
    client: FetchClient,
    payload: { items: MediaBulkUpsertItemRequest[]; dryRun?: boolean; apply?: boolean }
  ): Promise<MediaBulkUpsertResult> {
    const { data } = await client.post<ApiEnvelope<MediaBulkUpsertResult>, typeof payload>(
      `${BASE}/media-assets/bulk-upsert`,
      payload
    );
    return data.data;
  },

  async previewMediaIdentity(
    client: FetchClient,
    payload: {
      fileId: number;
      purpose: MediaIdentityPreview['purpose'];
      sign_slug?: string | null;
      period_scope?: MediaIdentityPreview['period_scope'];
      excludeId?: number | null;
    }
  ): Promise<MediaIdentityPreview> {
    const { data } = await client.post<ApiEnvelope<MediaIdentityPreview>, typeof payload>(
      `${BASE}/media-assets/preview-identity`,
      payload
    );
    return data.data;
  },

  async validateMediaCoverage(
    client: FetchClient,
    payload?: { applyWorkflowDisabling?: boolean }
  ): Promise<Record<string, unknown>> {
    const { data } = await client.post<ApiEnvelope<Record<string, unknown>>, typeof payload>(
      `${BASE}/media-assets/validate-coverage`,
      payload
    );
    return data.data;
  },

  async getMediaUsage(client: FetchClient, limit = 200): Promise<MediaUsage[]> {
    const { data } = await client.get<ApiEnvelope<MediaUsage[]>>(
      `${BASE}/media-usage?limit=${limit}`
    );
    return data.data;
  },

  async getAutonomyStatus(client: FetchClient): Promise<AutonomyStatus> {
    const { data } = await client.get<ApiEnvelope<AutonomyStatus>>(`${BASE}/autonomy/status`);
    return data.data;
  },

  async updateAutonomyPolicy(
    client: FetchClient,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const { data } = await client.put<ApiEnvelope<Record<string, unknown>>, typeof payload>(
      `${BASE}/autonomy/policy`,
      payload
    );
    return data.data;
  },

  async dryRunAutonomyTick(client: FetchClient): Promise<Record<string, unknown>> {
    const { data } = await client.post<ApiEnvelope<Record<string, unknown>>>(
      `${BASE}/autonomy/tick/dry-run`
    );
    return data.data;
  },

  async runAutonomyTickNow(
    client: FetchClient,
    payload?: { live?: boolean; mode?: 'controlled_live'; confirmation?: string }
  ): Promise<Record<string, unknown>> {
    const { data } = await client.post<
      ApiEnvelope<Record<string, unknown>>,
      typeof payload
    >(
      `${BASE}/autonomy/tick/run-now`,
      payload
    );
    return data.data;
  },

  async getProductionReadiness(
    client: FetchClient,
    params?: { includeStrictAudit?: boolean }
  ): Promise<ProductionReadinessReport> {
    const query = new URLSearchParams();
    if (params?.includeStrictAudit) query.set('includeStrictAudit', 'true');
    const queryString = query.toString();
    const { data } = await client.get<ApiEnvelope<ProductionReadinessReport>>(
      `${BASE}/autonomy/production-readiness${queryString ? `?${queryString}` : ''}`
    );
    return data.data;
  },

  async getGenerationJobs(
    client: FetchClient,
    params?: { status?: string; jobType?: string; limit?: number }
  ): Promise<GenerationJob[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.jobType) query.set('jobType', params.jobType);
    if (params?.limit) query.set('limit', String(params.limit));

    const queryString = query.toString();
    const { data } = await client.get<ApiEnvelope<GenerationJob[]>>(
      `${BASE}/generation/jobs${queryString ? `?${queryString}` : ''}`
    );
    return data.data;
  },

  async retryGenerationJob(client: FetchClient, id: number): Promise<GenerationJob> {
    const { data } = await client.post<ApiEnvelope<GenerationJob>>(
      `${BASE}/generation/jobs/${id}/retry`
    );
    return data.data;
  },

  async cancelGenerationJob(client: FetchClient, id: number): Promise<GenerationJob> {
    const { data } = await client.post<ApiEnvelope<GenerationJob>>(
      `${BASE}/generation/jobs/${id}/cancel`
    );
    return data.data;
  },

  async getTrafficSnapshots(
    client: FetchClient,
    params?: { source?: string; limit?: number }
  ): Promise<Record<string, unknown>[]> {
    const query = new URLSearchParams();
    if (params?.source) query.set('source', params.source);
    if (params?.limit) query.set('limit', String(params.limit));

    const queryString = query.toString();
    const { data } = await client.get<ApiEnvelope<Record<string, unknown>[]>>(
      `${BASE}/traffic/snapshots${queryString ? `?${queryString}` : ''}`
    );
    return data.data;
  },

  async importTraffic(
    client: FetchClient,
    payload?: { day?: string; dryRun?: boolean; source?: 'first_party' | 'ga4' }
  ): Promise<Record<string, unknown>> {
    const { data } = await client.post<ApiEnvelope<Record<string, unknown>>, typeof payload>(
      `${BASE}/traffic/import`,
      payload
    );
    return data.data;
  },

  async getVideoAssets(client: FetchClient, params?: { status?: string; limit?: number }): Promise<VideoAsset[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));

    const queryString = query.toString();
    const { data } = await client.get<ApiEnvelope<VideoAsset[]>>(
      `${BASE}/video/assets${queryString ? `?${queryString}` : ''}`
    );
    return data.data;
  },

  async createVideoJob(
    client: FetchClient,
    payload: {
      title: string;
      script?: string;
      workflowId?: number;
      idempotencyKey?: string;
      durationSeconds?: number;
      dryRun?: boolean;
    }
  ): Promise<Record<string, unknown>> {
    const { data } = await client.post<ApiEnvelope<Record<string, unknown>>, typeof payload>(
      `${BASE}/video/jobs`,
      payload
    );
    return data.data;
  },

  async renderVideoAsset(client: FetchClient, id: number): Promise<VideoAsset> {
    const { data } = await client.post<ApiEnvelope<VideoAsset>>(`${BASE}/video/assets/${id}/render`);
    return data.data;
  },

  async getAdCampaignPlans(
    client: FetchClient,
    params?: { status?: string; platform?: string; limit?: number }
  ): Promise<AdCampaignPlan[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.platform) query.set('platform', params.platform);
    if (params?.limit) query.set('limit', String(params.limit));

    const queryString = query.toString();
    const { data } = await client.get<ApiEnvelope<AdCampaignPlan[]>>(
      `${BASE}/ads/campaign-plans${queryString ? `?${queryString}` : ''}`
    );
    return data.data;
  },

  async createAdCampaignPlan(
    client: FetchClient,
    payload: {
      name: string;
      platform: 'meta' | 'google';
      targetUrl: string;
      dailyBudgetPln?: number;
      objective?: string;
      creativePayload?: Record<string, unknown>;
      targetingPayload?: Record<string, unknown>;
      dryRun?: boolean;
    }
  ): Promise<Record<string, unknown>> {
    const { data } = await client.post<ApiEnvelope<Record<string, unknown>>, typeof payload>(
      `${BASE}/ads/campaign-plans`,
      payload
    );
    return data.data;
  },

  async activateAdCampaignPlan(client: FetchClient, id: number): Promise<AdCampaignPlan> {
    const { data } = await client.post<ApiEnvelope<AdCampaignPlan>>(
      `${BASE}/ads/campaign-plans/${id}/activate`
    );
    return data.data;
  },

  async pauseAdCampaignPlan(client: FetchClient, id: number): Promise<AdCampaignPlan> {
    const { data } = await client.post<ApiEnvelope<AdCampaignPlan>>(
      `${BASE}/ads/campaign-plans/${id}/pause`
    );
    return data.data;
  },

  async pauseActiveAdCampaignPlans(
    client: FetchClient,
    payload: { confirmation: string }
  ): Promise<AdStopLossSweepResult> {
    const { data } = await client.post<ApiEnvelope<AdStopLossSweepResult>, typeof payload>(
      `${BASE}/ads/campaign-plans/stop-loss`,
      payload
    );
    return data.data;
  },

  async getGrowthExperiments(
    client: FetchClient,
    params?: { status?: string; limit?: number }
  ): Promise<GrowthExperiment[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));

    const queryString = query.toString();
    const { data } = await client.get<ApiEnvelope<GrowthExperiment[]>>(
      `${BASE}/experiments${queryString ? `?${queryString}` : ''}`
    );
    return data.data;
  },

  async chooseGrowthExperimentWinner(
    client: FetchClient,
    id: number,
    payload: { winnerVariantKey: string }
  ): Promise<GrowthExperiment> {
    const { data } = await client.post<ApiEnvelope<GrowthExperiment>, typeof payload>(
      `${BASE}/experiments/${id}/choose-winner`,
      payload
    );
    return data.data;
  },

  async getProviderStatus(
    client: FetchClient,
    params?: { provider?: string; limit?: number }
  ): Promise<ProviderCredentialStatus[]> {
    const query = new URLSearchParams();
    if (params?.provider) query.set('provider', params.provider);
    if (params?.limit) query.set('limit', String(params.limit));

    const queryString = query.toString();
    const { data } = await client.get<ApiEnvelope<ProviderCredentialStatus[]>>(
      `${BASE}/providers/status${queryString ? `?${queryString}` : ''}`
    );
    return data.data;
  },

  async testProviderReadiness(
    client: FetchClient,
    payload?: { providers?: string[]; includeConnectivity?: boolean }
  ): Promise<ProviderProbeRunResult> {
    const { data } = await client.post<ApiEnvelope<ProviderProbeRunResult>, typeof payload>(
      `${BASE}/providers/test-readiness`,
      payload ?? {}
    );
    return data.data;
  },
};
