import { MEDIA_ASSET_UID, MEDIA_USAGE_LOG_UID } from '../constants';
import type { MediaAssetRecord, Strapi } from '../types';
import { toTokens } from '../utils/media-mapping';
import { getPluginService } from '../utils/plugin';

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

const mediaSelector = ({ strapi }: { strapi: Strapi }) => {
  const entityService = strapi.entityService as any;

  return {
    async resolveForArticle(input: {
      workflowType: 'article' | 'daily_card';
      imageAssetKey?: string | null;
      requiredSignSlug?: string | null;
      contextKey: string;
      now: Date;
      targetDate?: string;
      title?: string;
      content?: string;
      categoryName?: string;
      apiToken?: string;
      llmModel?: string;
      imageGenModel?: string;
      imageGenToken?: string;
      workflowId?: number;
      onStep?: (
        stepId: string,
        status: 'running' | 'success' | 'failed',
        message?: string,
        output?: any
      ) => Promise<void>;
    }): Promise<{ mediaAssetId: number; mediaAssetKey: string; uploadFileId: number }> {
      const filters: any = { active: true };

      if (input.imageAssetKey?.trim()) {
        filters.asset_key = input.imageAssetKey.trim();
      } else if (input.workflowType === 'article') {
        filters.purpose = 'blog_article';
      } else {
        filters.purpose = { $in: ['daily_card', 'fallback_general'] };
      }

      if (input.requiredSignSlug?.trim()) {
        filters.sign_slug = input.requiredSignSlug.trim();
      }

      let candidates = (await entityService.findMany(MEDIA_ASSET_UID, {
        filters,
        sort: [{ priority: 'desc' }, { use_count: 'asc' }, { last_used_at: 'asc' }, { id: 'asc' }],
        populate: ['asset'],
        limit: 200,
      })) as MediaAssetRecord[];

      if (candidates.length === 0 && input.imageAssetKey) {
        throw new Error(`Nie znaleziono media-asset dla klucza "${input.imageAssetKey}".`);
      }

      // Jeśli nie mamy ścisłego klucza, a mamy tytuł/kategorię, stosujemy scoring
      if (!input.imageAssetKey && (input.title || input.categoryName)) {
        const titleTokens = input.title ? toTokens(input.title) : [];
        const categoryTokens = input.categoryName ? toTokens(input.categoryName) : [];

        const scored = candidates.map((c) => {
          let score = 0;
          const assetKeywords = Array.isArray(c.keywords) ? (c.keywords as string[]) : [];

          // Punktacja za kategorię (wysoki priorytet)
          if (categoryTokens.length > 0) {
            const catMatch = categoryTokens.some(
              (t) => assetKeywords.includes(t) || c.label.toLowerCase().includes(t)
            );
            if (catMatch) score += 10;
          }

          // Punktacja za słowa kluczowe z tytułu
          for (const token of titleTokens) {
            if (assetKeywords.includes(token)) score += 2;
            if (c.label.toLowerCase().includes(token)) score += 1;
          }

          return { candidate: c, score };
        });

        // Sortujemy po wyniku, potem po domyślnych kryteriach
        scored.sort((a, b) => b.score - a.score);
        candidates = scored.map((s) => s.candidate);
      }

      const usable = candidates.filter((item) => Boolean(getId(item.asset)));

      // --- AUTONOMOUS FALLBACK ---
      if (usable.length === 0) {
        if (input.apiToken && input.llmModel && input.title) {
          strapi.log.info(
            `[aico] Brak dopasowanych mediów dla "${input.title}". Uruchamiam generację on-demand...`
          );
          return await this.triggerAutonomousGeneration(input);
        }
        throw new Error('Brak dostępnych media-asset z plikiem dla zadanych kryteriów.');
      }

      for (const candidate of usable) {
        const cooldownDays =
          typeof candidate.cooldown_days === 'number'
            ? Math.max(0, Math.min(30, Math.floor(candidate.cooldown_days)))
            : 3;

        if (cooldownDays > 0) {
          const cutoffDate = new Date(input.now.getTime() - cooldownDays * 24 * 60 * 60 * 1000);

          const recent = (await entityService.findMany(MEDIA_USAGE_LOG_UID, {
            filters: {
              context_key: input.contextKey,
              media_asset: candidate.id,
              used_at: {
                $gte: cutoffDate.toISOString(),
              },
            },
            sort: [{ used_at: 'desc' }],
            limit: 1,
          })) as Array<{ id: number }>;

          if (recent[0]) {
            continue;
          }
        }

        const uploadFileId = getId(candidate.asset);
        if (!uploadFileId) {
          continue;
        }

        return {
          mediaAssetId: candidate.id,
          mediaAssetKey: candidate.asset_key,
          uploadFileId,
        };
      }

      // Jeśli wszystko w cooldown, też próbujemy generować nowe zamiast rzucać błąd
      if (input.apiToken && input.llmModel && input.title) {
        strapi.log.info(`[aico] Wszystkie media w cooldown. Generuję nowe on-demand...`);
        return await this.triggerAutonomousGeneration(input);
      }

      throw new Error('Wszystkie dopasowane media-asset są w okresie cooldown.');
    },

    async triggerAutonomousGeneration(
      input: any
    ): Promise<{ mediaAssetId: number; mediaAssetKey: string; uploadFileId: number }> {
      const designer = getPluginService<any>(strapi, 'image-designer');
      const generator = getPluginService<any>(strapi, 'media-generator');

      try {
        // 1. Projektowanie wizualne
        await input.onStep?.(
          'image_design',
          'running',
          'Projektowanie promptu wizualnego przez LLM...'
        );
        const { design } = await designer.designForContent({
          title: input.title,
          content: input.content,
          categoryName: input.categoryName,
          workflowType: input.workflowType,
          apiToken: input.apiToken,
          model: input.llmModel,
        });

        const fullPrompt = designer.buildFullPrompt(design);
        await input.onStep?.('image_design', 'success', `Zaprojektowano: ${design.label}`, {
          design,
          fullPrompt,
        });

        // 2. Fizyczna generacja i upload
        await input.onStep?.(
          'image_generation',
          'running',
          `Generowanie obrazu (${input.imageGenModel || 'default'}) i upload...`
        );
        const result = await generator.generateAndUpload({
          prompt: fullPrompt,
          label: design.label,
          purpose: input.workflowType === 'article' ? 'blog_article' : 'daily_card',
          signSlug: input.requiredSignSlug,
          workflowId: input.workflowId,
          model: input.imageGenModel,
          apiToken: input.imageGenToken,
        });

        const mediaAsset = await entityService.findOne(MEDIA_ASSET_UID, result.mediaAssetId);
        await input.onStep?.('image_generation', 'success', 'Obraz wygenerowany i zmapowany.', {
          mediaAssetId: result.mediaAssetId,
          uploadFileId: result.uploadFileId,
        });

        return {
          mediaAssetId: result.mediaAssetId,
          mediaAssetKey: mediaAsset.asset_key,
          uploadFileId: result.uploadFileId,
        };
      } catch (error) {
        await input.onStep?.(
          'image_generation',
          'failed',
          `Błąd autonomicznej generacji: ${error.message}`
        );
        throw error;
      }
    },

    async resolveForZodiacSign(input: {
      signSlug: string;
    }): Promise<{ mediaAssetId: number; uploadFileId: number } | null> {
      const candidates = (await entityService.findMany(MEDIA_ASSET_UID, {
        filters: {
          active: true,
          purpose: 'zodiac_profile',
          sign_slug: input.signSlug,
        },
        sort: [{ priority: 'desc' }, { id: 'asc' }],
        populate: ['asset'],
        limit: 1,
      })) as MediaAssetRecord[];

      if (candidates.length === 0) {
        return null;
      }

      const uploadFileId = getId(candidates[0].asset);
      if (!uploadFileId) {
        return null;
      }

      return {
        mediaAssetId: candidates[0].id,
        uploadFileId,
      };
    },

    // Rozwiązuje (lub generuje) obraz dla karty tarota. Każda karta ma mieć UNIKALNY
    // obraz, więc preferujemy generację on-demand (gdy mamy tokeny + nazwę). Dopiero
    // gdy generacja jest niemożliwa lub padnie, używamy istniejącego media-asset jako
    // fallbacku. Karty tarota nie mają sign_slug, więc nie da się ich rozróżnić w
    // katalogu mediów — dlatego NIE reużywamy współdzielonego assetu daily_card jako
    // pierwszego wyboru (inaczej wszystkie karty dostałyby ten sam obraz). Nie rzuca
    // wyjątkiem — zwraca null na wypadek backfillu (best-effort).
    async resolveForTarotCard(input: {
      cardName: string;
      description?: string | null;
      meaningUpright?: string | null;
      meaningReversed?: string | null;
      contextKey?: string;
      apiToken?: string | null;
      llmModel?: string | null;
      imageGenModel?: string | null;
      imageGenToken?: string | null;
      workflowId?: number;
    }): Promise<{ mediaAssetId: number; uploadFileId: number } | null> {
      const now = new Date();

      // 1. Generacja on-demand (preferowana — unikalny obraz na kartę).
      if (input.apiToken && input.llmModel && input.cardName?.trim()) {
        try {
          const content = [input.description, input.meaningUpright, input.meaningReversed]
            .filter((value): value is string => Boolean(value && value.trim()))
            .join('\n');

          const result = await this.triggerAutonomousGeneration({
            workflowType: 'daily_card',
            contextKey: input.contextKey ?? 'reconciliation',
            now,
            title: input.cardName,
            content,
            categoryName: 'Tarot',
            apiToken: input.apiToken,
            llmModel: input.llmModel,
            imageGenModel: input.imageGenModel ?? undefined,
            imageGenToken: input.imageGenToken ?? undefined,
            workflowId: input.workflowId,
          });

          return { mediaAssetId: result.mediaAssetId, uploadFileId: result.uploadFileId };
        } catch (error) {
          strapi.log.warn(
            `[aico] Generacja obrazu dla karty tarota "${input.cardName}" nie powiodła się: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          // Spadamy do fallbacku na istniejący asset poniżej.
        }
      }

      // 2. Fallback: istniejący, mapowany media-asset (gdy brak tokenów lub generacja padła).
      const candidates = (await entityService.findMany(MEDIA_ASSET_UID, {
        filters: {
          active: true,
          purpose: { $in: ['daily_card', 'fallback_general'] },
        },
        sort: [{ priority: 'desc' }, { use_count: 'asc' }, { last_used_at: 'asc' }, { id: 'asc' }],
        populate: ['asset'],
        limit: 50,
      })) as MediaAssetRecord[];

      const existing = candidates.find((item) => Boolean(getId(item.asset)));
      if (existing) {
        const uploadFileId = getId(existing.asset);
        if (uploadFileId) {
          return { mediaAssetId: existing.id, uploadFileId };
        }
      }

      return null;
    },

    // Rozwiązuje (lub generuje) obraz dla znaku zodiaku. Najpierw reużywa
    // read-only resolveForZodiacSign (asset o przeznaczeniu zodiac_profile); jeśli
    // brak, a mamy tokeny + nazwę — generuje on-demand. Nie rzuca wyjątkiem.
    async resolveForZodiacSignWithGeneration(input: {
      signSlug: string;
      signName: string;
      description?: string | null;
      element?: string | null;
      contextKey?: string;
      apiToken?: string | null;
      llmModel?: string | null;
      imageGenModel?: string | null;
      imageGenToken?: string | null;
      workflowId?: number;
    }): Promise<{ mediaAssetId: number; uploadFileId: number } | null> {
      // 1. Istniejący profil znaku zodiaku.
      const existing = await this.resolveForZodiacSign({ signSlug: input.signSlug });
      if (existing) {
        return existing;
      }

      // 2. Generacja on-demand.
      if (input.apiToken && input.llmModel && input.signName?.trim()) {
        try {
          const result = await this.triggerAutonomousGeneration({
            workflowType: 'daily_card',
            requiredSignSlug: input.signSlug,
            contextKey: input.contextKey ?? 'reconciliation',
            now: new Date(),
            title: input.signName,
            content: input.description ?? '',
            categoryName: input.element ?? 'Zodiak',
            apiToken: input.apiToken,
            llmModel: input.llmModel,
            imageGenModel: input.imageGenModel ?? undefined,
            imageGenToken: input.imageGenToken ?? undefined,
            workflowId: input.workflowId,
          });

          return { mediaAssetId: result.mediaAssetId, uploadFileId: result.uploadFileId };
        } catch (error) {
          strapi.log.warn(
            `[aico] Generacja obrazu dla znaku zodiaku "${input.signName}" nie powiodła się: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          return null;
        }
      }

      return null;
    },

    async registerUsage(input: {
      mediaAssetId: number;
      workflowId?: number;
      contentUid: string;
      contentEntryId: number;
      contextKey: string;
      targetDate?: string;
    }): Promise<void> {
      const now = new Date();

      await entityService.create(MEDIA_USAGE_LOG_UID, {
        data: {
          media_asset: input.mediaAssetId,
          workflow: input.workflowId ?? null,
          content_uid: input.contentUid,
          content_entry_id: input.contentEntryId,
          context_key: input.contextKey,
          used_at: now,
          target_date: input.targetDate ?? null,
        },
      });

      const current = (await entityService.findOne(
        MEDIA_ASSET_UID,
        input.mediaAssetId
      )) as MediaAssetRecord | null;

      if (!current) {
        return;
      }

      await entityService.update(MEDIA_ASSET_UID, input.mediaAssetId, {
        data: {
          last_used_at: now,
          use_count: Math.max(0, Number(current.use_count ?? 0)) + 1,
        },
      });
    },
  };
};

export default mediaSelector;
