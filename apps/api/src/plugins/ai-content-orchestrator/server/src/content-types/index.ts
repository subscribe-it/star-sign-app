import workflow from './workflow/schema.json';
import topicQueueItem from './topic-queue-item/schema.json';
import runLog from './run-log/schema.json';
import publicationTicket from './publication-ticket/schema.json';
import socialPostTicket from './social-post-ticket/schema.json';
import usageDaily from './usage-daily/schema.json';
import mediaAsset from './media-asset/schema.json';
import mediaUsageLog from './media-usage-log/schema.json';
import contentPlanItem from './content-plan-item/schema.json';
import contentPerformanceSnapshot from './content-performance-snapshot/schema.json';
import editorialMemory from './editorial-memory/schema.json';
import homepageRecommendation from './homepage-recommendation/schema.json';
import auditEvent from './audit-event/schema.json';
import runtimeLock from './runtime-lock/schema.json';
import autonomyPolicy from './autonomy-policy/schema.json';
import generationJob from './generation-job/schema.json';
import videoAsset from './video-asset/schema.json';
import trafficSnapshot from './traffic-snapshot/schema.json';
import adCampaignPlan from './ad-campaign-plan/schema.json';
import adsMutationLedger from './ads-mutation-ledger/schema.json';
import growthExperiment from './growth-experiment/schema.json';
import providerCredentialStatus from './provider-credential-status/schema.json';
import editorPersona from './editor-persona/schema.json';

export default {
  workflow: { schema: workflow },
  'topic-queue-item': { schema: topicQueueItem },
  'run-log': { schema: runLog },
  'publication-ticket': { schema: publicationTicket },
  'social-post-ticket': { schema: socialPostTicket },
  'usage-daily': { schema: usageDaily },
  'media-asset': { schema: mediaAsset },
  'media-usage-log': { schema: mediaUsageLog },
  'content-plan-item': { schema: contentPlanItem },
  'content-performance-snapshot': { schema: contentPerformanceSnapshot },
  'editorial-memory': { schema: editorialMemory },
  'homepage-recommendation': { schema: homepageRecommendation },
  'audit-event': { schema: auditEvent },
  'runtime-lock': { schema: runtimeLock },
  'autonomy-policy': { schema: autonomyPolicy },
  'generation-job': { schema: generationJob },
  'video-asset': { schema: videoAsset },
  'traffic-snapshot': { schema: trafficSnapshot },
  'ad-campaign-plan': { schema: adCampaignPlan },
  'ads-mutation-ledger': { schema: adsMutationLedger },
  'growth-experiment': { schema: growthExperiment },
  'provider-credential-status': { schema: providerCredentialStatus },
  'editor-persona': { schema: editorPersona },
};
