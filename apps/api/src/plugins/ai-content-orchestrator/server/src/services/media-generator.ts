import path from 'path';
import fs from 'fs';
import axios from 'axios';
import Replicate from 'replicate';
import { MEDIA_ASSET_UID } from '../constants';
import type { Strapi } from '../types';
import { getPluginService } from '../utils/plugin';
import { isPublicHttpUrl } from '../utils/public-url';

// Hard cap on the generated-image download (bytes) to bound memory / guard
// against a hostile or misbehaving provider returning an oversized payload.
const MAX_GENERATED_IMAGE_BYTES = 25 * 1024 * 1024;

type AutonomyPolicyService = {
  evaluate: (input: {
    action: 'media.generate';
    requiresBrandSafety: boolean;
  }) => Promise<{ allowed: boolean; reason?: string }>;
};

type ProviderStatusService = {
  checkProviders: (input: { action: 'media.generate'; providers: ['replicate'] }) => Promise<{
    ready: boolean;
    blockedProviders: Array<{
      provider: string;
      status: string;
      blockedReason?: string | null;
    }>;
  }>;
};

const unique = (values: string[]): string[] => Array.from(new Set(values));

export const getMediaPublicDirCandidates = (): string[] =>
  unique([
    path.resolve(__dirname, '../../../../../../public'),
    path.resolve(__dirname, '../../../../../public'),
    path.resolve(process.cwd(), 'public'),
  ]);

export const resolveMediaPublicDir = (): string => {
  const candidates = getMediaPublicDirCandidates();
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
};

export const resolveImageGenToken = (inputToken?: string): string | null =>
  inputToken?.trim() ||
  process.env.AICO_IMAGE_GEN_TOKEN?.trim() ||
  process.env.REPLICATE_API_TOKEN?.trim() ||
  null;

const assertMediaGenerationAllowed = async (strapi: Strapi): Promise<void> => {
  const policyDecision = await getPluginService<AutonomyPolicyService>(
    strapi,
    'autonomy-policy'
  ).evaluate({
    action: 'media.generate',
    requiresBrandSafety: true,
  });

  if (!policyDecision.allowed) {
    throw new Error(
      `AICO media generation blocked by autonomy policy: ${policyDecision.reason ?? 'unknown'}`
    );
  }

  const providerDecision = await getPluginService<ProviderStatusService>(
    strapi,
    'provider-status'
  ).checkProviders({
    action: 'media.generate',
    providers: ['replicate'],
  });

  if (!providerDecision.ready) {
    const blocked = providerDecision.blockedProviders
      .map((provider) => `${provider.provider}:${provider.blockedReason ?? provider.status}`)
      .join(', ');
    throw new Error(
      `AICO media generation blocked by provider readiness: ${blocked || 'replicate'}`
    );
  }
};

const mediaGenerator = ({ strapi }: { strapi: Strapi }) => {
  return {
    async generateAndUpload(input: {
      prompt: string;
      label: string;
      purpose: string;
      signSlug?: string;
      workflowId?: number;
      model?: string;
      apiToken?: string;
    }): Promise<{ mediaAssetId: number; uploadFileId: number }> {
      await assertMediaGenerationAllowed(strapi);
      const token = resolveImageGenToken(input.apiToken);
      if (!token) {
        throw new Error('AICO media generation blocked: missing image generation token.');
      }

      const replicate = new Replicate({
        auth: token,
      });

      strapi.log.info(`[aico] Autonomiczna generacja obrazu: ${input.label}`);

      // 1. Generowanie w Replicate
      const modelId = input.model || 'openai/gpt-image-2';

      const output = await replicate.run(modelId as Parameters<Replicate['run']>[0], {
        input: {
          prompt: input.prompt,
          aspect_ratio: '2:3',
          output_format: 'webp',
          output_quality: 90,
        },
      });

      const imageUrl = String(Array.isArray(output) ? output[0] : output);
      // SSRF guard: the URL comes from an external provider; only fetch public http(s) hosts.
      if (!isPublicHttpUrl(imageUrl)) {
        throw new Error(
          `AICO media generation: provider returned a non-public image URL (${imageUrl.slice(0, 80)}).`
        );
      }

      // 2. Pobieranie obrazu do bufora (z limitem rozmiaru + timeout, by ograniczyć ryzyko DoS).
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60_000,
        maxContentLength: MAX_GENERATED_IMAGE_BYTES,
        maxBodyLength: MAX_GENERATED_IMAGE_BYTES,
        // SSRF guard: provider asset URLs are direct downloads; a redirect could
        // rebind to an internal/metadata host that bypasses the isPublicHttpUrl
        // check above, so refuse to follow any redirects.
        maxRedirects: 0,
      });
      const buffer = Buffer.from(response.data, 'binary');

      // 3. Strategia Temp File dla Strapi 5
      const publicDir = resolveMediaPublicDir();
      const tmpDir = path.join(publicDir, 'uploads', 'tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      const filename = `auto_${Date.now()}.webp`;
      const tmpPath = path.join(tmpDir, filename);
      fs.writeFileSync(tmpPath, buffer);

      try {
        const uploadService = strapi.plugin('upload').service('upload');

        // 4. Upload do Strapi (R2)
        const uploadedFiles = await uploadService.upload({
          data: {
            fileInfo: {
              alternativeText: input.label,
              caption: input.label,
              name: filename,
            },
          },
          files: {
            filepath: tmpPath,
            originalFilename: filename,
            name: filename,
            type: 'image/webp',
            size: buffer.length,
          },
        });

        const fileId = uploadedFiles[0].id;

        // 5. Rejestracja w katalogu mediów AICO
        const assetKey = `auto_${input.signSlug || 'gen'}_${Date.now()}`;
        const mediaAsset = await strapi.entityService.create(MEDIA_ASSET_UID, {
          data: {
            asset_key: assetKey,
            label: input.label,
            purpose: input.purpose,
            sign_slug: input.signSlug || null,
            active: true,
            asset: fileId,
            mapping_confidence: 0.9,
            mapping_source: 'autonomous_agent',
            last_used_at: new Date(),
            use_count: 1,
            keywords: [],
          } as never,
        });

        return {
          mediaAssetId: (mediaAsset as { id: number }).id,
          uploadFileId: fileId,
        };
      } finally {
        // Cleanup temp file
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
        }
      }
    },
  };
};

export default mediaGenerator;
