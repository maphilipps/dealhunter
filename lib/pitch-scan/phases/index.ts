// Phase Agent Registry — maps sectionId to agent function

import type { PitchScanSectionId } from '../section-ids';
import type { PhaseAgentFn } from '../types';

import { runDiscoveryPhase } from './discovery';
import { runContentArchitecturePhase } from './content-architecture';
import { runFeaturesPhase } from './features';
import { runPerformancePhase } from './performance';
import { runAccessibilityPhase } from './accessibility';
import { runLegalPhase } from './legal';
import { runIntegrationsPhase } from './integrations';
import { runMigrationPhase } from './migration';
import { runCmsComparisonPhase } from './cms-comparison';
import { runCmsRecommendationPhase } from './cms-recommendation';
import { runDrupalArchitecturePhase } from './drupal-architecture';
import { runEstimationPhase } from './estimation';
import { runDocumentationPhase } from './documentation';

export const PHASE_AGENT_REGISTRY: Record<PitchScanSectionId, PhaseAgentFn> = {
  'ps-discovery': runDiscoveryPhase,
  'ps-content-architecture': runContentArchitecturePhase,
  'ps-features': runFeaturesPhase,
  'ps-performance': runPerformancePhase,
  'ps-accessibility': runAccessibilityPhase,
  'ps-legal': runLegalPhase,
  'ps-integrations': runIntegrationsPhase,
  'ps-migration': runMigrationPhase,
  'ps-cms-comparison': runCmsComparisonPhase,
  'ps-cms-recommendation': runCmsRecommendationPhase,
  'ps-drupal-architecture': runDrupalArchitecturePhase,
  'ps-estimation': runEstimationPhase,
  'ps-documentation': runDocumentationPhase,
};
