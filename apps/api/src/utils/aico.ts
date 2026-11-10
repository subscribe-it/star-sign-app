import type { Core } from '@strapi/strapi';

export const AICO_MEDIA_ASSET_UID =
  'plugin::ai-content-orchestrator.media-asset';

/**
 * Wtyczka ai-content-orchestrator (AICO) jest wyłączona w config/plugins.ts
 * (treści generuje zewnętrzny stack przez REST API). Gdy jest wyłączona, jej
 * content-types nie istnieją, więc kod rozruchowy nie może się do nich odwoływać.
 *
 * Brak `strapi.contentTypes` (np. uproszczone mocki w testach) traktujemy jak
 * "wtyczka włączona" — prawdziwy Strapi zawsze go wystawia.
 */
export const isAicoPluginEnabled = (strapi: Core.Strapi): boolean => {
  const contentTypes = (strapi as unknown as { contentTypes?: object })
    .contentTypes;

  if (!contentTypes) {
    return true;
  }

  return Object.prototype.hasOwnProperty.call(contentTypes, AICO_MEDIA_ASSET_UID);
};
