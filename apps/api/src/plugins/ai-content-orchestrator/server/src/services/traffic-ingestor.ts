import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { CONTENT_UIDS, TRAFFIC_SNAPSHOT_UID } from '../constants';
import type { ProviderKey, Strapi, TrafficSnapshotRecord } from '../types';
import { getEntityService } from '../utils/entity-service';
import { getPluginService } from '../utils/plugin';

type ImportTrafficInput = {
  day?: string;
  source?: TrafficSnapshotRecord['source'];
  dryRun?: boolean;
};

type ProviderStatusService = {
  upsert: (input: {
    provider: ProviderKey;
    status: 'ready' | 'missing_credentials' | 'blocked' | 'failed';
    hasCredentials?: boolean;
    scopes?: string[];
    blockedReason?: string;
    lastError?: string;
  }) => Promise<unknown>;
};

type Ga4RunReportMetricValue = {
  value?: string;
};

type Ga4RunReportRow = {
  dimensionValues?: Ga4RunReportMetricValue[];
  metricValues?: Ga4RunReportMetricValue[];
};

type Ga4RunReportResponse = {
  rows?: Ga4RunReportRow[];
  totals?: Array<{ metricValues?: Ga4RunReportMetricValue[] }>;
  rowCount?: number;
};

type GoogleServiceAccount = {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
};

type Ga4AccessTokenResult = {
  token: string;
  credentialType: 'access_token' | 'service_account';
};

const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const GA4_SCOPES = ['analytics.readonly'];
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const toDay = (value?: string): string => {
  if (value?.trim()) {
    const day = value.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      throw new Error('invalid_traffic_snapshot_day');
    }
    return day;
  }
  return new Date().toISOString().slice(0, 10);
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getGa4PropertyId = (): string | null => {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim() ?? '';
  if (!propertyId) return null;
  if (!/^\d+$/.test(propertyId)) {
    throw new Error('ga4_invalid_property_id');
  }
  return propertyId;
};

const base64Url = (input: string): string =>
  Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const signJwt = (payload: Record<string, unknown>, privateKey: string): string => {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64Url(JSON.stringify(payload));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${body}`);
  signer.end();
  const signature = signer
    .sign(privateKey)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${header}.${body}.${signature}`;
};

const parseServiceAccountJson = (raw: string): GoogleServiceAccount => {
  try {
    return JSON.parse(raw) as GoogleServiceAccount;
  } catch {
    throw new Error('ga4_invalid_service_account_json');
  }
};

const loadServiceAccount = async (): Promise<GoogleServiceAccount | null> => {
  const inlineJson = process.env.GA4_SERVICE_ACCOUNT_JSON?.trim();
  if (inlineJson) {
    return parseServiceAccountJson(inlineJson);
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!credentialsPath) {
    return null;
  }

  const raw = await readFile(credentialsPath, 'utf8');
  return parseServiceAccountJson(raw);
};

const requestServiceAccountAccessToken = async (
  account: GoogleServiceAccount
): Promise<Ga4AccessTokenResult> => {
  if (!account.client_email || !account.private_key) {
    throw new Error('ga4_service_account_missing_fields');
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    {
      iss: account.client_email,
      scope: GA4_SCOPE,
      aud: GOOGLE_OAUTH_TOKEN_URL,
      exp: now + 3600,
      iat: now,
    },
    account.private_key
  );

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`ga4_token_http_${response.status}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error('ga4_token_missing_access_token');
  }

  return { token: payload.access_token, credentialType: 'service_account' };
};

const getGa4AccessToken = async (): Promise<Ga4AccessTokenResult> => {
  const explicitToken = process.env.AICO_GA4_ACCESS_TOKEN?.trim();
  if (explicitToken) {
    return { token: explicitToken, credentialType: 'access_token' };
  }

  const account = await loadServiceAccount();
  if (!account) {
    throw new Error('ga4_missing_credentials');
  }

  return requestServiceAccountAccessToken(account);
};

const runGa4Report = async (propertyId: string, token: string, day: string): Promise<Ga4RunReportResponse> => {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: day, endDate: day }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'sessions' },
        { name: 'eventCount' },
        { name: 'conversions' },
        { name: 'totalRevenue' },
      ],
      limit: '10',
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    }),
  });

  if (!response.ok) {
    throw new Error(`ga4_run_report_http_${response.status}`);
  }

  return (await response.json()) as Ga4RunReportResponse;
};

const isMissingGa4CredentialsError = (error: unknown): boolean =>
  ['ga4_missing_credentials', 'ga4_missing_property_id', 'ga4_service_account_missing_fields'].includes(
    String((error as Error).message ?? error)
  );

const summarizeGa4Report = (report: Ga4RunReportResponse): {
  metrics: Record<string, number>;
  topContent: Record<string, unknown>;
} => {
  const totals = report.totals?.[0]?.metricValues ?? [];
  const rows = report.rows ?? [];
  const sumMetricAt = (index: number): number =>
    totals[index]?.value !== undefined
      ? toNumber(totals[index]?.value)
      : rows.reduce((sum, row) => sum + toNumber(row.metricValues?.[index]?.value), 0);

  const topRows = rows.slice(0, 10).map((row) => ({
    path: row.dimensionValues?.[0]?.value ?? '/',
    views: toNumber(row.metricValues?.[0]?.value),
    sessions: toNumber(row.metricValues?.[1]?.value),
    events: toNumber(row.metricValues?.[2]?.value),
    conversions: toNumber(row.metricValues?.[3]?.value),
    revenue: toNumber(row.metricValues?.[4]?.value),
  }));

  return {
    metrics: {
      views: sumMetricAt(0),
      sessions: sumMetricAt(1),
      organic_clicks: 0,
      social_engagements: 0,
      ad_spend_pln: 0,
      ad_clicks: 0,
      ad_conversions: sumMetricAt(3),
      revenue_or_value: sumMetricAt(4),
    },
    topContent: {
      source: 'ga4',
      rowCount: report.rowCount ?? rows.length,
      rows: topRows,
    },
  };
};

const trafficIngestor = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  return {
    async list(input: { source?: string; limit?: number } = {}): Promise<TrafficSnapshotRecord[]> {
      const filters: Record<string, unknown> = {};
      if (input.source) filters.source = input.source;

      return entityService.findMany<TrafficSnapshotRecord>(TRAFFIC_SNAPSHOT_UID, {
        filters,
        sort: [{ snapshot_day: 'desc' }, { createdAt: 'desc' }],
        limit: Math.max(1, Math.min(200, Number(input.limit ?? 50))),
      });
    },

    async importFirstParty(input: ImportTrafficInput = {}): Promise<{
      dryRun: boolean;
      uniqueKey: string;
      operation: 'dry_run' | 'created' | 'updated';
      snapshot?: TrafficSnapshotRecord;
      metrics: Record<string, number>;
    }> {
      const day = toDay(input.day);
      const source = input.source ?? 'first_party';
      const uniqueKey = `${source}:${day}`;

      const events = await entityService.count(CONTENT_UIDS.analyticsEvent, {
        filters: { event_day: day },
      });
      const premiumEvents = await entityService.count(CONTENT_UIDS.analyticsEvent, {
        filters: { event_day: day, event_type: 'premium_content_view' },
      });
      const ctaClicks = await entityService.count(CONTENT_UIDS.analyticsEvent, {
        filters: { event_day: day, event_type: 'premium_cta_click' },
      });

      const metrics = {
        views: events,
        sessions: events,
        organic_clicks: ctaClicks,
        social_engagements: 0,
        ad_spend_pln: 0,
        ad_clicks: 0,
        ad_conversions: premiumEvents,
        revenue_or_value: 0,
      };

      if (input.dryRun) {
        return { dryRun: true, uniqueKey, operation: 'dry_run', metrics };
      }

      const existing = await entityService.findMany<TrafficSnapshotRecord>(TRAFFIC_SNAPSHOT_UID, {
        filters: { unique_key: uniqueKey },
        limit: 1,
      });

      const data = {
        unique_key: uniqueKey,
        snapshot_day: day,
        source,
        ...metrics,
        recommendations: {
          nextAction: events === 0 ? 'seed_or_promote_content' : 'optimize_top_content',
        },
      };

      const snapshot = existing[0]
        ? await entityService.update<TrafficSnapshotRecord>(TRAFFIC_SNAPSHOT_UID, existing[0].id, {
            data,
          })
        : await entityService.create<TrafficSnapshotRecord>(TRAFFIC_SNAPSHOT_UID, { data });

      return { dryRun: false, uniqueKey, operation: existing[0] ? 'updated' : 'created', snapshot, metrics };
    },

    async importGa4(input: ImportTrafficInput = {}): Promise<{
      dryRun: boolean;
      uniqueKey: string;
      operation: 'dry_run' | 'created' | 'updated';
      snapshot?: TrafficSnapshotRecord;
      metrics: Record<string, number>;
      topContent: Record<string, unknown>;
      provider: {
        source: 'ga4';
        propertyId: string;
        credentialType: Ga4AccessTokenResult['credentialType'];
        liveEffects: false;
      };
    }> {
      const day = toDay(input.day);
      const propertyId = getGa4PropertyId();
      let access: Ga4AccessTokenResult;
      let report: Ga4RunReportResponse;

      try {
        if (!propertyId) {
          throw new Error('ga4_missing_property_id');
        }

        access = await getGa4AccessToken();
        report = await runGa4Report(propertyId, access.token, day);
      } catch (error) {
        try {
          await getPluginService<ProviderStatusService>(strapi, 'provider-status').upsert({
            provider: 'ga4',
            status: isMissingGa4CredentialsError(error) ? 'missing_credentials' : 'failed',
            hasCredentials: !isMissingGa4CredentialsError(error),
            scopes: [],
            blockedReason: String((error as Error).message ?? error),
            lastError: String((error as Error).message ?? error),
          });
        } catch {
          strapi.log.debug('AICO GA4 provider-status failure upsert skipped.');
        }

        throw error;
      }

      const { metrics, topContent } = summarizeGa4Report(report);
      const uniqueKey = `ga4:${propertyId}:${day}`;
      const provider = {
        source: 'ga4' as const,
        propertyId,
        credentialType: access.credentialType,
        liveEffects: false as const,
      };

      try {
        await getPluginService<ProviderStatusService>(strapi, 'provider-status').upsert({
          provider: 'ga4',
          status: 'ready',
          hasCredentials: true,
          scopes: GA4_SCOPES,
        });
      } catch {
        strapi.log.debug('AICO GA4 provider-status upsert skipped.');
      }

      if (input.dryRun) {
        return { dryRun: true, uniqueKey, operation: 'dry_run', metrics, topContent, provider };
      }

      const existing = await entityService.findMany<TrafficSnapshotRecord>(TRAFFIC_SNAPSHOT_UID, {
        filters: { unique_key: uniqueKey },
        limit: 1,
      });

      const data = {
        unique_key: uniqueKey,
        snapshot_day: day,
        source: 'ga4',
        ...metrics,
        top_content: topContent,
        recommendations: {
          nextAction: metrics.views === 0 ? 'seed_or_promote_content' : 'optimize_top_ga4_content',
        },
        metadata: {
          provider,
          importedBy: 'traffic-ingestor',
        },
      };

      const snapshot = existing[0]
        ? await entityService.update<TrafficSnapshotRecord>(TRAFFIC_SNAPSHOT_UID, existing[0].id, {
            data,
          })
        : await entityService.create<TrafficSnapshotRecord>(TRAFFIC_SNAPSHOT_UID, { data });

      return {
        dryRun: false,
        uniqueKey,
        operation: existing[0] ? 'updated' : 'created',
        snapshot,
        metrics,
        topContent,
        provider,
      };
    },
  };
};

export default trafficIngestor;
