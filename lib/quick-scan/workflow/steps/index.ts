// ═══════════════════════════════════════════════════════════════════════════════
// STEP REGISTRY - QuickScan 2.0 Workflow
// Central registry of all workflow steps
// ═══════════════════════════════════════════════════════════════════════════════

import type { StepRegistry, WorkflowStep } from '../types';
// Import all step groups
import {
  techStackStep,
  contentVolumeStep,
  featuresStep,
  playwrightAuditStep,
  companyIntelligenceStep,
  seoAuditStep,
  legalComplianceStep,
  contentClassificationStep,
  migrationComplexityStep,
  decisionMakersStep,
  httpxTechStep,
  analysisSteps,
} from './analysis';
import { loadBusinessUnitsStep, fetchWebsiteStep, bootstrapSteps } from './bootstrap';
import { recommendBusinessLineStep, synthesisSteps } from './synthesis';

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE STEP REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates the complete step registry for QuickScan workflow
 *
 * The registry maps step IDs to their implementations and allows the
 * WorkflowEngine to resolve dependencies and execute steps in order.
 */
export function createQuickScanStepRegistry(): StepRegistry {
  const registry: StepRegistry = new Map();

  // Bootstrap steps (no dependencies, run first)
  registry.set('loadBusinessUnits', loadBusinessUnitsStep as WorkflowStep);
  registry.set('fetchWebsite', fetchWebsiteStep as WorkflowStep);

  // Analysis steps (depend on fetchWebsite, run in parallel)
  registry.set('techStack', techStackStep as WorkflowStep);
  registry.set('contentVolume', contentVolumeStep as WorkflowStep);
  registry.set('features', featuresStep as WorkflowStep);
  registry.set('playwrightAudit', playwrightAuditStep as WorkflowStep);
  registry.set('companyIntelligence', companyIntelligenceStep as WorkflowStep);
  registry.set('seoAudit', seoAuditStep as WorkflowStep);
  registry.set('legalCompliance', legalComplianceStep as WorkflowStep);
  registry.set('contentClassification', contentClassificationStep as WorkflowStep);
  registry.set('migrationComplexity', migrationComplexityStep as WorkflowStep);
  registry.set('decisionMakers', decisionMakersStep as WorkflowStep);
  registry.set('httpxTech', httpxTechStep as WorkflowStep);

  // Synthesis steps (depend on analysis steps)
  registry.set('recommendBusinessLine', recommendBusinessLineStep as WorkflowStep);

  return registry;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRE-CREATED REGISTRY INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pre-created registry instance for quick access
 */
export const quickScanSteps = createQuickScanStepRegistry();

// ═══════════════════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// Export individual steps for direct access
export {
  // Bootstrap
  loadBusinessUnitsStep,
  fetchWebsiteStep,
  bootstrapSteps,
  // Analysis
  techStackStep,
  contentVolumeStep,
  featuresStep,
  playwrightAuditStep,
  companyIntelligenceStep,
  seoAuditStep,
  legalComplianceStep,
  contentClassificationStep,
  migrationComplexityStep,
  decisionMakersStep,
  httpxTechStep,
  analysisSteps,
  // Synthesis
  recommendBusinessLineStep,
  synthesisSteps,
};

// ═══════════════════════════════════════════════════════════════════════════════
// STEP COUNT CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const STEP_COUNTS = {
  bootstrap: 2,
  analysis: 11,
  synthesis: 1,
  total: 14,
};
