import { MEDIA_ASSET_UID, WORKFLOW_STATUS, WORKFLOW_UID } from '../constants';
import type { MediaAssetRecord, Strapi, WorkflowRecord } from '../types';
import { getEntityService } from '../utils/entity-service';
import { generateMediaAssetIdentity, suggestMediaMapping } from '../utils/media-mapping';

type MediaAssetPayload = Partial<
  Pick<
    MediaAssetRecord,
    | 'asset_key'
    | 'label'
    | 'purpose'
    | 'sign_slug'
    | 'period_scope'
    | 'keywords'
    | 'priority'
    | 'active'
    | 'cooldown_days'
    | 'mapping_source'
    | 'mapping_confidence'
    | 'mapping_reasons'
    | 'notes'
    | 'asset'
  >
>;

type BulkUpsertInputItem = MediaAssetPayload & {
  fileId: number;
};

type BulkUpsertInput = {
  items: BulkUpsertInputItem[];
  dryRun?: boolean;
  apply?: boolean;
};

const getId = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return value;
  }

  if (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    typeof (value as { id: unknown }).id === 'number'
  ) {
    return (value as { id: number }).id;
  }

  return null;
};

const normalizeKeywords = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const normalizeUploadAsset = (
  value: unknown
): {
  id: number;
  name?: string;
  url?: string;
  mime?: string;
  width?: number;
  height?: number;
  createdAt?: string;
} | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const id = getId(value);
  if (!id) {
    return null;
  }

  const item = value as Record<string, unknown>;

  return {
    id,
    name: typeof item.name === 'string' ? item.name : undefined,
    url: typeof item.url === 'string' ? item.url : undefined,
    mime: typeof item.mime === 'string' ? item.mime : undefined,
    width: typeof item.width === 'number' ? item.width : undefined,
    height: typeof item.height === 'number' ? item.height : undefined,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : undefined,
  };
};

const clampInt = (value: unknown, fallback: number, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
};

const clampFloat = (
  value: unknown,
  fallback: number | null,
  min: number,
  max: number
): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, value));
};

const parseOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const purposeUsesSign = (purpose: MediaAssetRecord['purpose']): boolean =>
  purpose === 'horoscope_sign' || purpose === 'zodiac_profile';

const mediaAssets = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  const assertMappingCoherence = (payload: {
    purpose: MediaAssetRecord['purpose'];
    sign_slug?: string | null;
  }): void => {
    if (purposeUsesSign(payload.purpose) && !payload.sign_slug?.trim()) {
      throw new Error(
        `Dla purpose=${payload.purpose} pole sign_slug jest wymagane.`,
      );
    }
  };

  const toCreateData = (payload: MediaAssetPayload): Record<string, unknown> => {
    if (!payload.asset_key?.trim()) {
      throw new Error('Pole asset_key jest wymagane.');
    }

    if (!payload.label?.trim()) {
      throw new Error('Pole label jest wymagane.');
    }

    const purpose = payload.purpose ?? 'blog_article';
    const signSlug = parseOptionalString(payload.sign_slug);
    const periodScope = payload.period_scope ?? 'any';

    assertMappingCoherence({
      purpose,
      sign_slug: signSlug,
    });

    return {
      asset_key: payload.asset_key.trim(),
      label: payload.label.trim(),
      purpose,
      sign_slug: purposeUsesSign(purpose) ? signSlug : null,
      period_scope: periodScope,
      keywords: normalizeKeywords(payload.keywords),
      priority: clampInt(payload.priority, 0, -9999, 9999),
      active: payload.active ?? true,
      cooldown_days: clampInt(payload.cooldown_days, 3, 0, 30),
      mapping_source: payload.mapping_source ?? 'manual',
      mapping_confidence: clampFloat(payload.mapping_confidence, null, 0, 1),
      mapping_reasons: normalizeStringArray(payload.mapping_reasons),
      notes: parseOptionalString(payload.notes),
      asset: getId(payload.asset),
    };
  };

  const applyUpdateData = (
    existing: MediaAssetRecord,
    payload: MediaAssetPayload
  ): Record<string, unknown> => {
    const data: Record<string, unknown> = {};

    if (typeof payload.asset_key !== 'undefined') {
      if (!payload.asset_key?.trim()) {
        throw new Error('Pole asset_key nie może być puste.');
      }
      data.asset_key = payload.asset_key.trim();
    }

    if (typeof payload.label !== 'undefined') {
      if (!payload.label?.trim()) {
        throw new Error('Pole label nie może być puste.');
      }
      data.label = payload.label.trim();
    }

    if (typeof payload.purpose !== 'undefined') {
      data.purpose = payload.purpose;
    }

    if (typeof payload.sign_slug !== 'undefined') {
      data.sign_slug = parseOptionalString(payload.sign_slug);
    }

    if (typeof payload.period_scope !== 'undefined') {
      data.period_scope = payload.period_scope;
    }

    if (typeof payload.keywords !== 'undefined') {
      data.keywords = normalizeKeywords(payload.keywords);
    }

    if (typeof payload.priority !== 'undefined') {
      data.priority = clampInt(payload.priority, 0, -9999, 9999);
    }

    if (typeof payload.active !== 'undefined') {
      data.active = Boolean(payload.active);
    }

    if (typeof payload.cooldown_days !== 'undefined') {
      data.cooldown_days = clampInt(payload.cooldown_days, 3, 0, 30);
    }

    if (typeof payload.mapping_source !== 'undefined') {
      data.mapping_source = payload.mapping_source;
    }

    if (typeof payload.mapping_confidence !== 'undefined') {
      data.mapping_confidence = clampFloat(payload.mapping_confidence, null, 0, 1);
    }

    if (typeof payload.mapping_reasons !== 'undefined') {
      data.mapping_reasons = normalizeStringArray(payload.mapping_reasons);
    }

    if (typeof payload.notes !== 'undefined') {
      data.notes = parseOptionalString(payload.notes);
    }

    if (typeof payload.asset !== 'undefined') {
      data.asset = getId(payload.asset);
    }

    const finalPurpose = (
      typeof data.purpose === 'string' ? data.purpose : existing.purpose
    ) as MediaAssetRecord['purpose'];
    const finalSignSlug = (
      typeof data.sign_slug === 'string' || data.sign_slug === null
        ? (data.sign_slug as string | null)
        : parseOptionalString(existing.sign_slug)
    ) as string | null;

    assertMappingCoherence({
      purpose: finalPurpose,
      sign_slug: finalSignSlug,
    });

    if (!purposeUsesSign(finalPurpose)) {
      data.sign_slug = null;
    }

    return data;
  };

  const findByUploadFileId = async (fileId: number): Promise<MediaAssetRecord | null> => {
    const rows = (await entityService.findMany(MEDIA_ASSET_UID, {
      filters: {
        asset: fileId,
      },
      populate: ['asset'],
      limit: 1,
    })) as MediaAssetRecord[];

    return rows[0] ?? null;
  };

  const getUploadFileById = async (fileId: number): Promise<Record<string, unknown> | null> => {
    const file = (await entityService.findOne('plugin::upload.file', fileId)) as Record<
      string,
      unknown
    > | null;
    return file ?? null;
  };

  const getUploadFileName = (
    fileId: number,
    uploadFile: Record<string, unknown> | null
  ): string => {
    if (uploadFile && typeof uploadFile.name === 'string' && uploadFile.name.trim().length > 0) {
      return uploadFile.name;
    }

    return `file-${fileId}`;
  };

  const getExistingAssetKeys = async (excludeId?: number): Promise<Set<string>> => {
    const rows = (await entityService.findMany(MEDIA_ASSET_UID, {
      fields: ['id', 'asset_key'],
      limit: 10000,
    })) as Array<{ id: number; asset_key?: string | null }>;

    const keys = new Set<string>();
    for (const row of rows) {
      if (excludeId && row.id === excludeId) {
        continue;
      }

      const key = parseOptionalString(row.asset_key);
      if (key) {
        keys.add(key);
      }
    }

    return keys;
  };

  return {
    async previewIdentity(input: {
      fileId: number;
      purpose: MediaAssetRecord['purpose'];
      sign_slug?: string | null;
      period_scope?: MediaAssetRecord['period_scope'] | null;
      excludeId?: number | null;
    }): Promise<Record<string, unknown>> {
      const fileId = Number(input.fileId);
      if (!Number.isFinite(fileId) || fileId <= 0) {
        throw new Error('Niepoprawny fileId.');
      }

      const uploadFile = await getUploadFileById(fileId);
      if (!uploadFile) {
        throw new Error(`Nie znaleziono pliku Media Library #${fileId}.`);
      }

      const existingAssetKeys = await getExistingAssetKeys(input.excludeId ?? undefined);
      const signSlug = parseOptionalString(input.sign_slug);
      const periodScope = input.period_scope ?? 'any';
      const identity = generateMediaAssetIdentity({
        fileName: getUploadFileName(fileId, uploadFile),
        purpose: input.purpose,
        signSlug: purposeUsesSign(input.purpose) ? signSlug : null,
        periodScope,
        existingAssetKeys,
      });

      return {
        ...identity,
        fileId,
        purpose: input.purpose,
        sign_slug: purposeUsesSign(input.purpose) ? signSlug : null,
        period_scope: periodScope,
      };
    },

    async list(): Promise<MediaAssetRecord[]> {
      return (await entityService.findMany(MEDIA_ASSET_UID, {
        sort: [{ priority: 'desc' }, { asset_key: 'asc' }],
        populate: ['asset'],
      })) as MediaAssetRecord[];
    },

    async getByAssetKey(assetKey: string): Promise<MediaAssetRecord | null> {
      const rows = (await entityService.findMany(MEDIA_ASSET_UID, {
        filters: { asset_key: assetKey },
        populate: ['asset'],
        limit: 1,
      })) as MediaAssetRecord[];

      return rows[0] ?? null;
    },

    async getActiveLinkedByAssetKey(assetKey: string): Promise<MediaAssetRecord> {
      const existing = await this.getByAssetKey(assetKey);
      if (!existing) {
        throw new Error(`Nie znaleziono media-asset dla klucza "${assetKey}".`);
      }

      if (!existing.active) {
        throw new Error(`Media-asset "${assetKey}" jest nieaktywny.`);
      }

      if (!getId(existing.asset)) {
        throw new Error(`Media-asset "${assetKey}" nie ma podpiętego pliku Media Library.`);
      }

      return existing;
    },

    async upsertByAssetKey(
      assetKey: string,
      payload: MediaAssetPayload
    ): Promise<MediaAssetRecord> {
      const existing = await this.getByAssetKey(assetKey);

      if (!existing) {
        return this.create({
          ...payload,
          asset_key: assetKey,
        });
      }

      return this.update(existing.id, payload);
    },

    async create(payload: MediaAssetPayload): Promise<MediaAssetRecord> {
      const purpose = (payload.purpose ?? 'blog_article') as MediaAssetRecord['purpose'];
      const signSlug = parseOptionalString(payload.sign_slug);
      const periodScope = payload.period_scope ?? 'any';

      assertMappingCoherence({
        purpose,
        sign_slug: signSlug,
      });

      const fileId = getId(payload.asset);
      if (!fileId) {
        throw new Error('Pole asset (plik z Media Library) jest wymagane.');
      }

      const uploadFile = await getUploadFileById(fileId);
      if (!uploadFile) {
        throw new Error(`Nie znaleziono pliku Media Library #${fileId}.`);
      }

      const existingAssetKeys = await getExistingAssetKeys();
      const identity = generateMediaAssetIdentity({
        fileName: getUploadFileName(fileId, uploadFile),
        purpose,
        signSlug: purposeUsesSign(purpose) ? signSlug : null,
        periodScope,
        existingAssetKeys,
      });

      const created = (await entityService.create(MEDIA_ASSET_UID, {
        data: toCreateData({
          ...payload,
          ...identity,
          purpose,
          sign_slug: purposeUsesSign(purpose) ? signSlug : null,
          period_scope: periodScope,
          asset: fileId,
        }),
        populate: ['asset'],
      })) as MediaAssetRecord;

      return created;
    },

    async update(id: number, payload: MediaAssetPayload): Promise<MediaAssetRecord> {
      const existing = (await entityService.findOne(MEDIA_ASSET_UID, id, {
        populate: ['asset'],
      })) as MediaAssetRecord | null;

      if (!existing) {
        throw new Error(`Media-asset #${id} nie istnieje.`);
      }

      const finalPurpose = (payload.purpose ??
        existing.purpose ??
        'blog_article') as MediaAssetRecord['purpose'];
      const finalSignSlug =
        typeof payload.sign_slug !== 'undefined'
          ? parseOptionalString(payload.sign_slug)
          : parseOptionalString(existing.sign_slug);
      const finalPeriodScope = (payload.period_scope ??
        existing.period_scope ??
        'any') as NonNullable<MediaAssetRecord['period_scope']>;
      const finalFileId =
        typeof payload.asset !== 'undefined' ? getId(payload.asset) : getId(existing.asset);

      if (!finalFileId) {
        throw new Error('Pole asset (plik z Media Library) jest wymagane.');
      }

      const uploadFile = await getUploadFileById(finalFileId);
      if (!uploadFile) {
        throw new Error(`Nie znaleziono pliku Media Library #${finalFileId}.`);
      }

      assertMappingCoherence({
        purpose: finalPurpose,
        sign_slug: finalSignSlug,
      });

      const existingAssetKeys = await getExistingAssetKeys(id);
      const identity = generateMediaAssetIdentity({
        fileName: getUploadFileName(finalFileId, uploadFile),
        purpose: finalPurpose,
        signSlug: purposeUsesSign(finalPurpose) ? finalSignSlug : null,
        periodScope: finalPeriodScope,
        existingAssetKeys,
      });

      const data = applyUpdateData(existing, {
        ...payload,
        ...identity,
        purpose: finalPurpose,
        sign_slug: purposeUsesSign(finalPurpose) ? finalSignSlug : null,
        period_scope: finalPeriodScope,
        asset: finalFileId,
      });

      const updated = (await entityService.update(MEDIA_ASSET_UID, id, {
        data,
        populate: ['asset'],
      })) as MediaAssetRecord;

      return updated;
    },

    async bulkUpsert(input: BulkUpsertInput): Promise<Record<string, unknown>> {
      const dryRun = input.dryRun !== false;
      const apply = Boolean(input.apply) && !dryRun;
      const sourceItems = Array.isArray(input.items) ? input.items : [];

      const existingAssets = await this.list();
      const existingAssetKeys = new Set(existingAssets.map((item) => item.asset_key));

      const results: Array<Record<string, unknown>> = [];
      let previewCreate = 0;
      let previewUpdate = 0;
      let appliedCreate = 0;
      let appliedUpdate = 0;
      let errors = 0;

      for (const rawItem of sourceItems) {
        const fileId = Number(rawItem.fileId);

        if (!Number.isFinite(fileId) || fileId <= 0) {
          errors += 1;
          results.push({
            fileId: rawItem.fileId,
            status: 'error',
            error: 'Niepoprawny fileId.',
          });
          continue;
        }

        try {
          const [uploadFile, existingByFile] = await Promise.all([
            getUploadFileById(fileId),
            findByUploadFileId(fileId),
          ]);

          if (!uploadFile) {
            throw new Error(`Nie znaleziono pliku Media Library #${fileId}.`);
          }

          const fileName = typeof uploadFile.name === 'string' ? uploadFile.name : `file-${fileId}`;
          const suggestion = suggestMediaMapping({
            fileName,
            existingAssetKeys: new Set(existingAssetKeys),
          });

          const resolvedPurpose = rawItem.purpose ?? existingByFile?.purpose ?? suggestion.purpose;
          const resolvedSign =
            typeof rawItem.sign_slug !== 'undefined'
              ? parseOptionalString(rawItem.sign_slug)
              : (existingByFile?.sign_slug ?? suggestion.sign_slug);
          const resolvedPeriodScope =
            rawItem.period_scope ?? existingByFile?.period_scope ?? suggestion.period_scope;
          const keyPool = new Set(existingAssetKeys);
          if (existingByFile?.asset_key) {
            keyPool.delete(existingByFile.asset_key);
          }
          const identity = generateMediaAssetIdentity({
            fileName,
            purpose: resolvedPurpose,
            signSlug: purposeUsesSign(resolvedPurpose) ? resolvedSign : null,
            periodScope: resolvedPeriodScope,
            existingAssetKeys: keyPool,
          });
          if (existingByFile?.asset_key) {
            existingAssetKeys.delete(existingByFile.asset_key);
          }
          existingAssetKeys.add(identity.asset_key);

          const payload: MediaAssetPayload = {
            asset_key: identity.asset_key,
            label: identity.label,
            purpose: resolvedPurpose,
            sign_slug: purposeUsesSign(resolvedPurpose) ? resolvedSign : null,
            period_scope: resolvedPeriodScope,
            keywords:
              typeof rawItem.keywords !== 'undefined'
                ? rawItem.keywords
                : (existingByFile?.keywords ?? suggestion.keywords),
            priority:
              typeof rawItem.priority !== 'undefined'
                ? rawItem.priority
                : (existingByFile?.priority ?? 0),
            active:
              typeof rawItem.active !== 'undefined'
                ? rawItem.active
                : (existingByFile?.active ?? true),
            cooldown_days:
              typeof rawItem.cooldown_days !== 'undefined'
                ? rawItem.cooldown_days
                : (existingByFile?.cooldown_days ?? 3),
            mapping_source: existingByFile
              ? (existingByFile.mapping_source ?? 'bulk_suggestion')
              : 'bulk_suggestion',
            mapping_confidence: suggestion.confidence,
            mapping_reasons: suggestion.reasons,
            notes:
              typeof rawItem.notes !== 'undefined'
                ? rawItem.notes
                : (existingByFile?.notes ?? null),
            asset: fileId,
          };

          const action = existingByFile ? 'update' : 'create';
          if (action === 'create') {
            previewCreate += 1;
          } else {
            previewUpdate += 1;
          }

          if (!apply) {
            results.push({
              fileId,
              fileName,
              status: 'preview',
              action,
              payload: {
                asset_key: parseOptionalString(payload.asset_key) ?? '',
                label: parseOptionalString(payload.label) ?? '',
                purpose: payload.purpose ?? 'blog_article',
                sign_slug: parseOptionalString(payload.sign_slug),
                period_scope: payload.period_scope ?? 'any',
                keywords: normalizeKeywords(payload.keywords),
                priority: clampInt(payload.priority, 0, -9999, 9999),
                active: payload.active ?? true,
                cooldown_days: clampInt(payload.cooldown_days, 3, 0, 30),
                mapping_source: payload.mapping_source ?? 'bulk_suggestion',
                mapping_confidence: clampFloat(payload.mapping_confidence, null, 0, 1),
                mapping_reasons: normalizeStringArray(payload.mapping_reasons),
                notes: parseOptionalString(payload.notes),
                asset: fileId,
              },
              existingMediaAssetId: existingByFile?.id ?? null,
            });
            continue;
          }

          const createData = toCreateData(payload);
          if (action === 'create') {
            assertMappingCoherence({
              purpose: createData.purpose as MediaAssetRecord['purpose'],
              sign_slug: (createData.sign_slug as string | null) ?? null,
            });
          } else if (existingByFile) {
            applyUpdateData(existingByFile, payload);
          }

          if (existingByFile) {
            const updated = await this.update(existingByFile.id, payload);
            appliedUpdate += 1;
            results.push({
              fileId,
              fileName,
              status: 'applied',
              action: 'update',
              mediaAssetId: updated.id,
              asset_key: updated.asset_key,
            });
          } else {
            const created = await this.create(payload);
            appliedCreate += 1;
            results.push({
              fileId,
              fileName,
              status: 'applied',
              action: 'create',
              mediaAssetId: created.id,
              asset_key: created.asset_key,
            });
          }
        } catch (error) {
          errors += 1;
          results.push({
            fileId,
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        dryRun,
        apply,
        summary: {
          total: sourceItems.length,
          previewCreate,
          previewUpdate,
          appliedCreate,
          appliedUpdate,
          errors,
        },
        items: results,
      };
    },

    async validateCoverage(input?: {
      applyWorkflowDisabling?: boolean;
    }): Promise<Record<string, unknown>> {
      const applyWorkflowDisabling = Boolean(input?.applyWorkflowDisabling);

      const [assets, workflows] = await Promise.all([
        this.list(),
        entityService.findMany(WORKFLOW_UID, {
          sort: [{ id: 'asc' }],
        }) as Promise<WorkflowRecord[]>,
      ]);

      const linkedAssets = assets.filter(
        (item) => Boolean(item.active) && Boolean(getId(item.asset))
      );

      const hasPurpose = (purposes: string[]): boolean => {
        return linkedAssets.some((item) => purposes.includes(item.purpose));
      };

      const missingWorkflows: Array<Record<string, unknown>> = [];

      for (const workflow of workflows) {
        if (workflow.workflow_type !== 'article' && workflow.workflow_type !== 'daily_card') {
          continue;
        }

        const coverageOk =
          workflow.workflow_type === 'daily_card'
            ? hasPurpose(['daily_card', 'fallback_general'])
            : hasPurpose(['blog_article', 'fallback_general']);

        if (coverageOk) {
          continue;
        }

        const reason =
          workflow.workflow_type === 'daily_card'
            ? 'Brak aktywnych assetów z purpose daily_card/fallback_general i powiązanym plikiem media.'
            : 'Brak aktywnych assetów z purpose blog_article/fallback_general i powiązanym plikiem media.';

        missingWorkflows.push({
          id: workflow.id,
          name: workflow.name,
          workflow_type: workflow.workflow_type,
          reason,
        });

        if (applyWorkflowDisabling && workflow.enabled) {
          await entityService.update(WORKFLOW_UID, workflow.id, {
            data: {
              enabled: false,
              status: WORKFLOW_STATUS.failed,
              last_error: `[coverage] ${reason}`,
            },
          });
        }
      }

      const byPurpose = assets.reduce<Record<string, { total: number; linked: number }>>(
        (acc, item) => {
          const key = item.purpose || 'unknown';
          const current = acc[key] ?? { total: 0, linked: 0 };
          current.total += 1;
          if (Boolean(item.active) && Boolean(getId(item.asset))) {
            current.linked += 1;
          }
          acc[key] = current;
          return acc;
        },
        {}
      );

      return {
        ok: missingWorkflows.length === 0,
        applyWorkflowDisabling,
        assets: {
          total: assets.length,
          linked: linkedAssets.length,
          byPurpose,
        },
        checkedWorkflows: workflows
          .filter((item) => item.workflow_type === 'article' || item.workflow_type === 'daily_card')
          .map((item) => ({
            id: item.id,
            name: item.name,
            workflow_type: item.workflow_type,
            enabled: item.enabled,
          })),
        missingWorkflows,
      };
    },

    serialize(item: MediaAssetRecord): Record<string, unknown> {
      return {
        ...item,
        asset: normalizeUploadAsset(item.asset),
      };
    },
  };
};

export default mediaAssets;
