/**
 * Pitch Pipeline Tools
 *
 * Tools are categorized into:
 * - Primitives: Stateless, composable capabilities (no business logic)
 * - Agent Wrappers: Convenience tools that wrap agents with DB persistence
 *
 * Primitives enable the orchestrator to compose its own workflows.
 * Agent wrappers provide backward compatibility and convenience.
 */

// ============================================================================
// Audit Tools
// ============================================================================

export {
  // Primitives
  createFetchHtmlTool,
  createDetectTechStackTool,
  createAuditPerformanceTool,
  createAuditAccessibilityTool,
  createAnalyzeComponentsTool,
  // Convenience wrapper
  createRunAuditTool,
  // Collections
  createAuditPrimitiveTools,
  createAuditTools,
  // Legacy alias
  createAuditTool,
  // Types
  type FullAuditResult,
  type FetchedPage,
  type TechStackResult,
  type PerformanceResult,
  type AccessibilityResult,
  type ComponentAnalysis,
} from './audit-tool';

// ============================================================================
// RAG Query Tools
// ============================================================================

export {
  // Primitive
  createKnowledgeQueryTool,
  // Agent wrappers
  createCmsQueryTool,
  createIndustryQueryTool,
  // Collections
  createRagPrimitiveTools,
  createRagTools,
  // Types
  type KnowledgeChunk,
  type KnowledgeChunkMetadata,
  type CmsAnalysisResult,
  type IndustryAnalysisResult,
} from './rag-query-tool';

// ============================================================================
// Generation Tools
// ============================================================================

export {
  // Primitives
  createRenderIndicationTool,
  createStoreIndicationDocumentTool,
  // Convenience wrapper
  createGenerateIndicationTool,
  // Collections
  createGenerationPrimitiveTools,
  createGenerationPrimitiveToolsWithStorage,
} from './generation-tools';

// ============================================================================
// User Interaction Tools
// ============================================================================

export { createAskUserTool, AskUserInterrupt } from './ask-user';

// ============================================================================
// Progress & Uncertainty Tools
// ============================================================================

export { createProgressTool, publishCompletion, publishError } from './progress-tool';
export { createUncertaintyTool, type UncertaintyFlag } from './uncertainty-tool';

// ============================================================================
// Combined Tool Collections
// ============================================================================

import type { UncertaintyFlag } from './uncertainty-tool';
import type { OrchestratorCheckpoint } from '../types';
import { createAuditTools } from './audit-tool';
import { createRagTools } from './rag-query-tool';
import { createGenerateIndicationTool } from './generation-tools';
import { createAskUserTool } from './ask-user';
import { createProgressTool } from './progress-tool';
import { createUncertaintyTool } from './uncertainty-tool';

export interface PipelineToolParams {
  runId: string;
  pitchId: string;
  websiteUrl: string;
  targetCmsIds: string[];
  industry: string | null;
  goal: string;
  flags: UncertaintyFlag[];
  getCheckpoint: () => OrchestratorCheckpoint;
}

/**
 * Creates all primitive tools for the orchestrator.
 * Primitives are stateless and composable.
 */
export function createPrimitiveTools() {
  return {
    ...createAuditTools({ runId: '', pitchId: '', websiteUrl: '' }),
    ...createRagTools({
      runId: '',
      targetCmsIds: [],
      industry: null,
      websiteUrl: '',
      goal: '',
    }),
  };
}

/**
 * Creates the complete tool set for the orchestrator pipeline.
 * Includes primitives, agent wrappers, and utility tools.
 */
export function createPipelineTools(params: PipelineToolParams) {
  return {
    // Audit tools (primitives + convenience wrapper)
    ...createAuditTools({
      runId: params.runId,
      pitchId: params.pitchId,
      websiteUrl: params.websiteUrl,
    }),

    // RAG tools (primitive + agent wrappers)
    ...createRagTools({
      runId: params.runId,
      targetCmsIds: params.targetCmsIds,
      industry: params.industry,
      websiteUrl: params.websiteUrl,
      goal: params.goal,
    }),

    // Generation
    generateIndication: createGenerateIndicationTool({
      runId: params.runId,
      pitchId: params.pitchId,
      flags: params.flags,
    }),

    // User interaction
    askUser: createAskUserTool({
      runId: params.runId,
      getCheckpoint: params.getCheckpoint,
    }),

    // Progress reporting
    reportProgress: createProgressTool({ runId: params.runId }),

    // Uncertainty flagging
    flagUncertainty: createUncertaintyTool({ flags: params.flags }),
  };
}
