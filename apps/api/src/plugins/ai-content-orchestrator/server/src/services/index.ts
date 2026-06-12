import audit from './audit';
import auditTrail from './audit-trail';
import adsAgent from './ads-agent';
import adsBudgetLedger from './ads-budget-ledger';
import adsProviderAdapter from './ads-provider-adapter';
import autopilot from './autopilot';
import autonomyPolicy from './autonomy-policy';
import dashboard from './dashboard';
import diagnostics from './diagnostics';
import encryption from './encryption';
import experimentAgent from './experiment-agent';
import generationJobs from './generation-jobs';
import mediaAssets from './media-assets';
import imageDesigner from './image-designer';
import insightsEngine from './insights-engine';
import mediaGenerator from './media-generator';
import mediaLibrary from './media-library';
import mediaSelector from './media-selector';
import mediaUsage from './media-usage';
import openRouter from './open-router';
import orchestrator from './orchestrator';
import performanceFeedback from './performance-feedback';
import providerProbe from './provider-probe';
import providerStatus from './provider-status';
import productionReadiness from './production-readiness';
import runtimeLocks from './runtime-locks';
import runs from './runs';
import seoGuardrails from './seo-guardrails';
import siteAlive from './site-alive';
import socialPublisher from './social-publisher';
import strategyPlanner from './strategy-planner';
import topics from './topics';
import trafficIngestor from './traffic-ingestor';
import usage from './usage';
import videoAgent from './video-agent';
import videoProviderAdapter from './video-provider-adapter';
import workflows from './workflows';

export default {
  'ads-agent': adsAgent,
  'ads-budget-ledger': adsBudgetLedger,
  'ads-provider-adapter': adsProviderAdapter,
  audit,
  'audit-trail': auditTrail,
  autopilot,
  'autonomy-policy': autonomyPolicy,
  dashboard,
  diagnostics,
  encryption,
  'experiment-agent': experimentAgent,
  'generation-jobs': generationJobs,
  'image-designer': imageDesigner,
  'insights-engine': insightsEngine,
  'media-assets': mediaAssets,
  'media-generator': mediaGenerator,
  'media-library': mediaLibrary,
  'media-selector': mediaSelector,
  'media-usage': mediaUsage,
  'open-router': openRouter,
  orchestrator,
  'performance-feedback': performanceFeedback,
  'provider-probe': providerProbe,
  'provider-status': providerStatus,
  'production-readiness': productionReadiness,
  'runtime-locks': runtimeLocks,
  runs,
  'seo-guardrails': seoGuardrails,
  'site-alive': siteAlive,
  'social-publisher': socialPublisher,
  'strategy-planner': strategyPlanner,
  topics,
  'traffic-ingestor': trafficIngestor,
  usage,
  'video-agent': videoAgent,
  'video-provider-adapter': videoProviderAdapter,
  workflows,
};
