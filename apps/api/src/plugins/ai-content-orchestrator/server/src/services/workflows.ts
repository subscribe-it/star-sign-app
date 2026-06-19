import {
  DEFAULT_DAILY_REQUEST_LIMIT,
  DEFAULT_DAILY_TOKEN_LIMIT,
  DEFAULT_LOCALE,
  DEFAULT_MAX_COMPLETION_TOKENS,
  DEFAULT_RETRY_BACKOFF_SECONDS,
  DEFAULT_RETRY_MAX,
  DEFAULT_TEMPERATURE,
  DEFAULT_TIMEZONE,
  HOROSCOPE_PERIODS,
  SOCIAL_CHANNELS,
  WORKFLOW_STATUS,
  WORKFLOW_UID,
} from '../constants';
import type {
  NormalizedWorkflowConfig,
  SocialPlatform,
  Strapi,
  WorkflowRecord,
  WorkflowUpdatePayload,
} from '../types';
import { assertValidCron } from '../utils/cron';
import { clampNumber } from '../utils/date-time';
import { getEntityService } from '../utils/entity-service';
import { isRecord, toSafeErrorMessage } from '../utils/json';
import { getPluginService } from '../utils/plugin';

type EncryptionService = {
  encrypt: (value: string) => string;
  decrypt: (value: string) => string;
};

type TokenKind =
  | 'llm'
  | 'image'
  | 'fb'
  | 'ig'
  | 'tt'
  | 'xApiSecret'
  | 'xAccessToken'
  | 'xAccessTokenSecret';

const DEFAULT_SOCIAL_CHANNELS: SocialPlatform[] = ['facebook', 'instagram', 'twitter'];

const getId = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return value;
  }

  if (isRecord(value) && typeof value.id === 'number') {
    return value.id;
  }

  return null;
};

const toSocialChannels = (value: unknown): SocialPlatform[] => {
  const source = Array.isArray(value) ? value : DEFAULT_SOCIAL_CHANNELS;
  const allowed = new Set<SocialPlatform>(SOCIAL_CHANNELS);
  const channels = source
    .map((item) => String(item).trim().toLowerCase())
    .filter((item): item is SocialPlatform => allowed.has(item as SocialPlatform));

  return channels.length > 0 ? Array.from(new Set(channels)) : [...DEFAULT_SOCIAL_CHANNELS];
};

const workflows = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  return {
    async list(): Promise<Array<Record<string, unknown>>> {
      const records = (await entityService.findMany(WORKFLOW_UID, {
        sort: { id: 'asc' },
        populate: ['article_category', 'default_editor_persona'],
      })) as WorkflowRecord[];

      return records.map((record) => this.serialize(record));
    },

    async getById(id: number): Promise<WorkflowRecord | null> {
      const record = (await entityService.findOne(WORKFLOW_UID, id, {
        populate: ['article_category', 'default_editor_persona'],
      })) as WorkflowRecord | null;

      return record;
    },

    async getByIdOrThrow(id: number): Promise<WorkflowRecord> {
      const record = await this.getById(id);

      if (!record) {
        throw new Error(`Workflow #${id} nie istnieje.`);
      }

      return record;
    },

    async create(payload: WorkflowUpdatePayload): Promise<Record<string, unknown>> {
      this.validateInput(payload, true);

      const llm = this.resolveEncryptedToken(payload, null, 'llm');
      const image = this.resolveEncryptedToken(payload, null, 'image');
      const fb = this.resolveEncryptedToken(payload, null, 'fb');
      const ig = this.resolveEncryptedToken(payload, null, 'ig');
      const tt = this.resolveEncryptedToken(payload, null, 'tt');
      const xApiSecret = this.resolveEncryptedToken(payload, null, 'xApiSecret');
      const xAccessToken = this.resolveEncryptedToken(payload, null, 'xAccessToken');
      const xAccessTokenSecret = this.resolveEncryptedToken(payload, null, 'xAccessTokenSecret');

      const data = this.mapPayloadToEntity(payload, {
        llm,
        image,
        fb,
        ig,
        tt,
        xApiSecret,
        xAccessToken,
        xAccessTokenSecret,
      });

      const created = (await entityService.create(WORKFLOW_UID, {
        data,
        populate: ['article_category', 'default_editor_persona'],
      })) as WorkflowRecord;

      return this.serialize(created);
    },

    async update(id: number, payload: WorkflowUpdatePayload): Promise<Record<string, unknown>> {
      const current = await this.getByIdOrThrow(id);

      this.validateInput(payload, false, current);

      const llm = this.resolveEncryptedToken(
        payload,
        current.llm_api_token_encrypted ?? null,
        'llm'
      );
      const image = this.resolveEncryptedToken(
        payload,
        current.image_gen_api_token_encrypted ?? null,
        'image'
      );
      const fb = this.resolveEncryptedToken(
        payload,
        current.fb_access_token_encrypted ?? null,
        'fb'
      );
      const ig = this.resolveEncryptedToken(
        payload,
        current.ig_access_token_encrypted ?? null,
        'ig'
      );
      const tt = this.resolveEncryptedToken(
        payload,
        current.tt_access_token_encrypted ?? null,
        'tt'
      );
      const xApiSecret = this.resolveEncryptedToken(
        payload,
        current.x_api_secret_encrypted ?? null,
        'xApiSecret'
      );
      const xAccessToken = this.resolveEncryptedToken(
        payload,
        current.x_access_token_encrypted ?? null,
        'xAccessToken'
      );
      const xAccessTokenSecret = this.resolveEncryptedToken(
        payload,
        current.x_access_token_secret_encrypted ?? null,
        'xAccessTokenSecret'
      );

      const data = this.mapPayloadToEntity(payload, {
        llm,
        image,
        fb,
        ig,
        tt,
        xApiSecret,
        xAccessToken,
        xAccessTokenSecret,
      });

      const updated = (await entityService.update(WORKFLOW_UID, id, {
        data,
        populate: ['article_category', 'default_editor_persona'],
      })) as WorkflowRecord;

      return this.serialize(updated);
    },

    async remove(id: number): Promise<Record<string, unknown>> {
      const current = await this.getByIdOrThrow(id);

      if (current.status === WORKFLOW_STATUS.running) {
        throw new Error('Najpierw zatrzymaj workflow, potem usuń.');
      }

      const deleted = (await entityService.delete(WORKFLOW_UID, id, {
        populate: ['article_category', 'default_editor_persona'],
      })) as WorkflowRecord;

      return this.serialize(deleted ?? current);
    },

    async setStatus(
      id: number,
      status: WorkflowRecord['status'],
      lastError?: string | null
    ): Promise<void> {
      await entityService.update(WORKFLOW_UID, id, {
        data: {
          status,
          last_error: lastError ?? null,
        },
      });
    },

    async markGenerationSlot(id: number, slot: string, generatedAt: Date): Promise<void> {
      await entityService.update(WORKFLOW_UID, id, {
        data: {
          last_generation_slot: slot,
          last_generated_at: generatedAt,
        },
      });
    },

    async markPublishSlot(id: number, slot: string, publishedAt: Date): Promise<void> {
      await entityService.update(WORKFLOW_UID, id, {
        data: {
          last_publish_slot: slot,
          last_published_at: publishedAt,
        },
      });
    },

    serialize(record: WorkflowRecord): Record<string, unknown> {
      const safe: Record<string, unknown> = { ...record };
      delete safe.llm_api_token_encrypted;
      delete safe.image_gen_api_token_encrypted;
      delete safe.fb_access_token_encrypted;
      delete safe.ig_access_token_encrypted;
      delete safe.tt_access_token_encrypted;
      delete safe.x_api_secret_encrypted;
      delete safe.x_access_token_encrypted;
      delete safe.x_access_token_secret_encrypted;

      return {
        ...safe,
        has_api_token: Boolean(record.llm_api_token_encrypted),
        has_image_gen_token: Boolean(record.image_gen_api_token_encrypted),
        has_fb_token: Boolean(record.fb_access_token_encrypted),
        has_ig_token: Boolean(record.ig_access_token_encrypted),
        has_tt_token: Boolean(record.tt_access_token_encrypted),
        has_x_api_secret: Boolean(record.x_api_secret_encrypted),
        has_x_access_token: Boolean(record.x_access_token_encrypted),
        has_x_access_token_secret: Boolean(record.x_access_token_secret_encrypted),
        enabled_channels: toSocialChannels(record.enabled_channels),
        article_category: getId(record.article_category),
        default_editor_persona: getId(record.default_editor_persona),
      };
    },

    async getGlobalSettings(): Promise<Record<string, unknown>> {
      const store = strapi.store({
        type: 'plugin',
        name: 'ai-content-orchestrator',
        key: 'settings',
      });
      return ((await store.get()) as Record<string, unknown> | null) ?? {};
    },

    async normalizeRuntime(record: WorkflowRecord): Promise<NormalizedWorkflowConfig> {
      const globalSettings = await this.getGlobalSettings();

      const timezone = record.timezone || (globalSettings.timezone as string) || DEFAULT_TIMEZONE;
      const locale = record.locale || (globalSettings.locale as string) || DEFAULT_LOCALE;
      const encryptedToken = record.llm_api_token_encrypted?.trim() || '';

      if (!encryptedToken) {
        throw new Error(`Workflow "${record.name}" nie ma ustawionego tokena LLM.`);
      }

      const workflowType = record.workflow_type;
      if (!workflowType) {
        throw new Error(`Workflow "${record.name}" nie ma typu workflow.`);
      }

      const horoscopePeriod = record.horoscope_period ?? 'Dzienny';
      if (!HOROSCOPE_PERIODS.includes(horoscopePeriod)) {
        throw new Error(`Workflow "${record.name}" ma niepoprawny okres horoskopu.`);
      }

      const imageGenModel =
        record.image_gen_model ||
        (globalSettings.image_gen_model as string) ||
        'openai/gpt-image-2';

      return {
        id: record.id,
        name: record.name,
        enabled: Boolean(record.enabled),
        status: (record.status || WORKFLOW_STATUS.idle) as NormalizedWorkflowConfig['status'],
        workflowType,
        generateCron: record.generate_cron,
        publishCron: record.publish_cron,
        timezone,
        locale,
        llmModel: record.llm_model,
        llmTokenEncrypted: record.llm_api_token_encrypted ?? '',
        imageGenModel,
        imageGenTokenEncrypted: record.image_gen_api_token_encrypted,
        promptTemplate: record.prompt_template,
        temperature: clampNumber(record.temperature ?? DEFAULT_TEMPERATURE, 0, 2),
        maxCompletionTokens: Math.max(
          128,
          Math.min(64_000, Number(record.max_completion_tokens ?? DEFAULT_MAX_COMPLETION_TOKENS))
        ),
        retryMax: Math.max(1, Math.min(10, Number(record.retry_max ?? DEFAULT_RETRY_MAX))),
        retryBackoffSeconds: Math.max(
          15,
          Math.min(3600, Number(record.retry_backoff_seconds ?? DEFAULT_RETRY_BACKOFF_SECONDS))
        ),
        dailyRequestLimit: Math.max(
          1,
          Number(record.daily_request_limit ?? DEFAULT_DAILY_REQUEST_LIMIT)
        ),
        dailyTokenLimit: Math.max(
          1000,
          Number(record.daily_token_limit ?? DEFAULT_DAILY_TOKEN_LIMIT)
        ),
        allowManualEdit: record.allow_manual_edit ?? true,
        autoPublish: record.auto_publish ?? true,
        forceRegenerate: record.force_regenerate ?? false,
        strategyEnabled: record.strategy_enabled ?? false,
        performanceFeedbackEnabled: record.performance_feedback_enabled ?? true,
        contentCluster: record.content_cluster ?? null,
        autoPublishGuardrails: isRecord(record.auto_publish_guardrails)
          ? record.auto_publish_guardrails
          : {},
        topicMode: record.topic_mode === 'manual' ? 'manual' : 'mixed',
        horoscopePeriod,
        horoscopeTypeValues: this.normalizeHoroscopeTypes(record.horoscope_type_values),
        allSigns: record.all_signs ?? true,
        articleCategoryId: getId(record.article_category),
        defaultEditorPersonaId: getId(record.default_editor_persona),
        lastGenerationSlot: record.last_generation_slot ?? null,
        lastPublishSlot: record.last_publish_slot ?? null,
        enabledChannels: toSocialChannels(record.enabled_channels),
        fbPageId: record.fb_page_id,
        fbTokenEncrypted: record.fb_access_token_encrypted,
        igUserId: record.ig_user_id,
        igTokenEncrypted: record.ig_access_token_encrypted,
        xApiKey: record.x_api_key,
        xApiSecretEncrypted: record.x_api_secret_encrypted,
        xAccessTokenEncrypted: record.x_access_token_encrypted,
        xAccessTokenSecretEncrypted: record.x_access_token_secret_encrypted,
        ttCreatorId: record.tt_creator_id,
        ttTokenEncrypted: record.tt_access_token_encrypted,
      };
    },

    validateInput(
      payload: WorkflowUpdatePayload,
      isCreate: boolean,
      current?: WorkflowRecord
    ): void {
      const enabled = payload.enabled ?? current?.enabled ?? true;
      const workflowType = payload.workflow_type ?? current?.workflow_type;
      const generateCron = payload.generate_cron ?? current?.generate_cron;
      const publishCron = payload.publish_cron ?? current?.publish_cron;
      const timezone = payload.timezone ?? current?.timezone ?? 'Europe/Warsaw';
      const llmModel = (payload.llm_model ?? current?.llm_model ?? '').trim();
      const promptTemplate = (payload.prompt_template ?? current?.prompt_template ?? '').trim();
      const articleCategory =
        typeof payload.article_category !== 'undefined'
          ? getId(payload.article_category)
          : getId(current?.article_category ?? null);

      if (!workflowType) {
        throw new Error('Typ workflow jest wymagany.');
      }

      if (!generateCron || !publishCron) {
        throw new Error('Pola generate_cron i publish_cron są wymagane.');
      }

      assertValidCron(generateCron, timezone);
      assertValidCron(publishCron, timezone);

      if (
        typeof payload.temperature !== 'undefined' &&
        (payload.temperature < 0 || payload.temperature > 2)
      ) {
        throw new Error('Temperature musi być w zakresie 0..2.');
      }

      if (
        typeof payload.max_completion_tokens !== 'undefined' &&
        payload.max_completion_tokens < 128
      ) {
        throw new Error('max_completion_tokens musi być >= 128.');
      }

      if ((workflowType === 'article' || workflowType === 'daily_card') && !articleCategory) {
        throw new Error('Workflow typu article/daily_card wymaga przypisanej kategorii artykułu.');
      }

      if (!enabled) {
        return;
      }

      const hasExistingToken = Boolean(current?.llm_api_token_encrypted?.trim());
      const hasNewToken = Boolean(payload.apiToken?.trim());

      if (!hasExistingToken && !hasNewToken) {
        throw new Error(
          'Włączony workflow wymaga tokena OpenRouter. Utwórz najpierw wyłączony draft lub podaj apiToken.'
        );
      }

      if (!llmModel) {
        throw new Error('Włączony workflow wymaga modelu LLM.');
      }

      if (!promptTemplate) {
        throw new Error('Włączony workflow wymaga prompt_template.');
      }
    },

    normalizeHoroscopeTypes(value: unknown): string[] {
      if (!Array.isArray(value)) {
        return ['Ogólny'];
      }

      const normalized = value.map((item) => String(item).trim()).filter((item) => item.length > 0);

      return normalized.length > 0 ? Array.from(new Set(normalized)) : ['Ogólny'];
    },

    resolveEncryptedToken(
      payload: WorkflowUpdatePayload,
      existingEncrypted: string | null,
      kind: TokenKind
    ): string | null {
      const encryptionService = getPluginService<EncryptionService>(strapi, 'encryption');

      let inputToken: string | undefined;
      if (kind === 'llm') inputToken = payload.apiToken;
      if (kind === 'image') inputToken = payload.imageGenApiToken;
      if (kind === 'fb') inputToken = payload.fbAccessToken;
      if (kind === 'ig') inputToken = payload.igAccessToken;
      if (kind === 'tt') inputToken = payload.ttAccessToken;
      if (kind === 'xApiSecret') inputToken = payload.xApiSecret;
      if (kind === 'xAccessToken') inputToken = payload.xAccessToken;
      if (kind === 'xAccessTokenSecret') inputToken = payload.xAccessTokenSecret;

      const trimmed = inputToken?.trim();
      if (trimmed) {
        return encryptionService.encrypt(trimmed);
      }

      if (existingEncrypted) {
        return existingEncrypted;
      }

      if (kind === 'llm' && payload.enabled !== false) {
        throw new Error('Brak tokena OpenRouter dla workflow.');
      }

      return null;
    },

    mapPayloadToEntity(
      payload: WorkflowUpdatePayload,
      tokens: {
        llm: string | null;
        image: string | null;
        fb: string | null;
        ig: string | null;
        tt: string | null;
        xApiSecret: string | null;
        xAccessToken: string | null;
        xAccessTokenSecret: string | null;
      }
    ): Record<string, unknown> {
      const data: Record<string, unknown> = {
        llm_api_token_encrypted: tokens.llm,
        image_gen_api_token_encrypted: tokens.image,
        fb_access_token_encrypted: tokens.fb,
        ig_access_token_encrypted: tokens.ig,
        tt_access_token_encrypted: tokens.tt,
        x_api_secret_encrypted: tokens.xApiSecret,
        x_access_token_encrypted: tokens.xAccessToken,
        x_access_token_secret_encrypted: tokens.xAccessTokenSecret,
      };

      const copy = <K extends keyof WorkflowUpdatePayload>(key: K): void => {
        if (typeof payload[key] !== 'undefined') {
          data[key] = payload[key] as unknown;
        }
      };

      copy('name');
      copy('enabled');
      copy('workflow_type');
      copy('generate_cron');
      copy('publish_cron');
      copy('timezone');
      copy('locale');
      copy('llm_model');
      copy('image_gen_model');
      copy('prompt_template');
      copy('temperature');
      copy('max_completion_tokens');
      copy('retry_max');
      copy('retry_backoff_seconds');
      copy('daily_request_limit');
      copy('daily_token_limit');
      copy('allow_manual_edit');
      copy('auto_publish');
      copy('force_regenerate');
      copy('strategy_enabled');
      copy('performance_feedback_enabled');
      copy('content_cluster');
      copy('auto_publish_guardrails');
      copy('topic_mode');
      copy('horoscope_period');
      copy('horoscope_type_values');
      copy('all_signs');
      copy('enabled_channels');
      copy('fb_page_id');
      copy('ig_user_id');
      copy('x_api_key');
      copy('tt_creator_id');

      if (typeof payload.article_category !== 'undefined') {
        data.article_category = getId(payload.article_category);
      }

      if (typeof payload.default_editor_persona !== 'undefined') {
        data.default_editor_persona = getId(payload.default_editor_persona);
      }

      if (!data.status) {
        data.status = WORKFLOW_STATUS.idle;
      }

      return data;
    },

    async decryptTokenForRuntime(record: WorkflowRecord): Promise<string> {
      const encrypted = record.llm_api_token_encrypted?.trim();
      if (!encrypted) {
        throw new Error(`Workflow "${record.name}" nie ma ustawionego tokena LLM.`);
      }

      return this.decryptEncryptedValue(encrypted, `LLM workflow "${record.name}"`);
    },

    async decryptImageTokenForRuntime(record: WorkflowRecord): Promise<string | null> {
      let encrypted = record.image_gen_api_token_encrypted?.trim();

      if (!encrypted) {
        const globalSettings = await this.getGlobalSettings();
        encrypted = (globalSettings.image_gen_api_token_encrypted as string | undefined)?.trim();
      }

      if (!encrypted) {
        return null;
      }

      try {
        return this.decryptEncryptedValue(encrypted, 'image generation token');
      } catch (error) {
        strapi.log.error(
          `[aico] Nie udało się odszyfrować tokena obrazów: ${toSafeErrorMessage(error)}`
        );
        return null;
      }
    },

    decryptEncryptedValue(encrypted: string, label: string): string {
      const encryptionService = getPluginService<EncryptionService>(strapi, 'encryption');
      try {
        return encryptionService.decrypt(encrypted);
      } catch (error) {
        throw new Error(`Nie udało się odszyfrować ${label}: ${toSafeErrorMessage(error)}`);
      }
    },
  };
};

export default workflows;
