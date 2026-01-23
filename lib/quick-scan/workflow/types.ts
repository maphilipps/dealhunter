// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW TYPES - QuickScan 2.0 Refactoring
// Type definitions for the workflow engine, steps, and context
// ═══════════════════════════════════════════════════════════════════════════════

import type { QuickScanInput, QuickScanResult } from '../agent';

import type { EventEmitter } from '@/lib/streaming/event-emitter';
import type { QuickScanPhase } from '@/lib/streaming/event-types';

// ═══════════════════════════════════════════════════════════════════════════════
// STEP CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ToolConfig {
  /** Unique identifier for the step (used in dependency resolution) */
  name: string;
  /** Human-readable name for UI display */
  displayName: string;
  /** Which workflow phase this step belongs to */
  phase: QuickScanPhase;
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

export interface WorkflowContext {
  /** Original input to the workflow */
  input: QuickScanInput;
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
  phase: QuickScanPhase;
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
export type { QuickScanInput, QuickScanResult };
