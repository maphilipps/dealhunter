// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW TYPES - QualificationScan 2.0 Refactoring
// Type definitions for the workflow engine, steps, and context
// ═══════════════════════════════════════════════════════════════════════════════

import type { QualificationScanInput, QualificationScanResult } from '../agent';

import type { EventEmitter } from '@/lib/streaming/event-emitter';
import type { QualificationScanPhase } from '@/lib/streaming/event-types';

// ═══════════════════════════════════════════════════════════════════════════════
// STEP CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ToolConfig {
  /** Unique identifier for the step (used in dependency resolution) */
  name: string;
  /** Human-readable name for UI display */
  displayName: string;
  /** Which workflow phase this step belongs to */
  phase: QualificationScanPhase;
  /** Step IDs this step depends on (must complete before this step starts) */
  dependencies?: string[];
  /** Whether step failure should stop the workflow (default: false) */
  optional?: boolean;
  /** Maximum execution time in ms before timeout (default: 60000) */
  timeout?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Finding input for RAG storage
 */
export interface FindingInput {
  category: 'fact' | 'elaboration' | 'recommendation' | 'risk' | 'estimate';
  chunkType: string;
  content: string;
  confidence: number;
  requiresValidation?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Visualization input for RAG storage
 */
export interface VisualizationInput {
  sectionId: string;
  visualization: {
    root: string | null;
    elements: Record<
      string,
      {
        key: string;
        type: string;
        props: Record<string, unknown>;
        children?: string[];
      }
    >;
  };
  confidence: number;
}

/**
 * RAG Write Tools for agent-native output
 * Allows steps to store findings and visualizations directly in the knowledge base
 * Uses callable functions instead of AI SDK tools for direct invocation
 */
export interface RagWriteTools {
  /** Store a single finding in the knowledge base */
  storeFinding: (input: FindingInput) => Promise<{ success: boolean; message: string }>;
  /** Store a visualization (JsonRenderTree) for UI display */
  storeVisualization: (
    input: VisualizationInput
  ) => Promise<{ success: boolean; message: string; sectionId?: string }>;
  /** Batch store multiple findings at once */
  storeFindingsBatch: (
    findings: FindingInput[]
  ) => Promise<{ success: boolean; message: string; storedCount: number }>;
  /** The AI SDK tools for LLM use (optional) */
  aiTools?: {
    storeFinding: ReturnType<typeof import('@/lib/agent-tools').createRagWriteTool>;
    storeVisualization: ReturnType<typeof import('@/lib/agent-tools').createVisualizationWriteTool>;
    storeFindingsBatch: ReturnType<typeof import('@/lib/agent-tools').createBatchRagWriteTool>;
  };
}

export interface WorkflowContext {
  /** Original input to the workflow */
  input: QualificationScanInput;
  /** Event emitter for streaming updates */
  emit: EventEmitter;
  /** Results from completed steps (Map<stepId, result>) */
  results: Map<string, StepResult>;
  /** Get a typed result from a dependency */
  getResult<T>(stepId: string): T | undefined;
  /** User context section for AI prompts */
  contextSection?: string;
  /** Validated URL (after redirects) */
  fullUrl: string;
  /** RAG Write Tools for agent-native output (optional - only if preQualificationId provided) */
  ragTools?: RagWriteTools;
}

export interface StepResult<T = unknown> {
  stepId: string;
  success: boolean;
  output?: T;
  error?: string;
  duration: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW STEP
// ═══════════════════════════════════════════════════════════════════════════════

export interface WorkflowStep<TInput = unknown, TOutput = unknown> {
  /** Step configuration */
  config: ToolConfig;
  /** Execute the step */
  execute(input: TInput, ctx: WorkflowContext): Promise<TOutput>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

export type StepRegistry = Map<string, WorkflowStep>;

export interface StepGroup {
  phase: QualificationScanPhase;
  steps: WorkflowStep[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAG RESOLVER TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DAGNode {
  stepId: string;
  config: ToolConfig;
  dependencies: Set<string>;
  dependents: Set<string>;
}

export interface ExecutionPlan {
  /** Steps grouped by execution wave (parallel within wave, sequential between waves) */
  waves: string[][];
  /** Total number of steps */
  totalSteps: number;
  /** Dependency graph for debugging */
  graph: Map<string, DAGNode>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW ENGINE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WorkflowEngineOptions {
  /** All steps to execute */
  steps: StepRegistry;
  /** Event emitter for streaming */
  emit: EventEmitter;
  /** Optional user context for AI prompts */
  contextSection?: string;
  /** Qualification ID for RAG write tools (enables agent-native output) */
  preQualificationId?: string;
}

export interface WorkflowExecutionResult {
  /** All step results */
  results: Map<string, StepResult>;
  /** Total workflow duration in ms */
  duration: number;
  /** Whether all required steps succeeded */
  success: boolean;
  /** Errors from failed steps */
  errors: Array<{ stepId: string; error: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP DEFINITION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Helper type for step functions
 * Used with wrapTool to define step implementations
 */
export type StepFunction<TInput, TOutput> = (
  input: TInput,
  ctx: WorkflowContext
) => TOutput | Promise<TOutput>;

/**
 * Common step input types
 */
export interface BootstrapInput {
  url: string;
}

export interface WebsiteData {
  html: string;
  headers: Record<string, string>;
  url: string;
  wappalyzerResults: Array<{
    name: string;
    categories: string[];
    version?: string;
    confidence: number;
  }>;
  sitemapUrls: string[];
  sitemapFound: boolean;
  sitemapUrl?: string;
}

export interface BusinessUnit {
  name: string;
  keywords: string[];
}

// Re-export for convenience
export type { QualificationScanInput, QualificationScanResult };
