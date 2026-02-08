import type { EventEmitter } from '@/lib/streaming/event-emitter';

import type { BuiltInSectionId, PitchScanSectionId } from './section-ids';

// ─── Phase Category ────────────────────────────────────────────────────────────

/**
 * Categories for grouping phases in the UI.
 */
export type PhaseCategory =
  | 'discovery' // Initial analysis
  | 'technical' // Performance, accessibility, etc.
  | 'legal' // GDPR, compliance
  | 'cms' // CMS comparison/recommendation
  | 'architecture' // Drupal architecture
  | 'synthesis'; // Estimation, documentation

// ─── Phase Context & Result ────────────────────────────────────────────────────

export interface PhaseContext {
  runId: string;
  pitchId: string;
  websiteUrl: string;
  previousResults: Record<string, unknown>;
  ragContext?: unknown;
  targetCmsIds: string[];
}

export interface PhaseResult {
  /** Section ID - accepts both built-in and dynamic section IDs */
  sectionId: string;
  /** Human-readable title for UI display */
  label: string;
  /** Category for UI grouping */
  category?: PhaseCategory;
  /** The actual result content */
  content: unknown;
  /** Confidence score (0-100) */
  confidence: number;
  /** Source URLs or references */
  sources?: string[];
}

// ─── Planning Types ────────────────────────────────────────────────────────────

/**
 * A phase that was skipped during planning with the reason why.
 */
export interface SkippedPhase {
  id: string;
  reason: string;
}

/**
 * The analysis plan created by the planner LLM.
 * Defines which phases to execute and in what order.
 */
export interface PhasePlan {
  /** Detected or specified website type */
  websiteType: 'e-commerce' | 'portal' | 'corporate' | 'informational' | 'blog' | 'multi-site';
  /** Phases to execute with priority and rationale */
  enabledPhases: Array<{
    id: string;
    priority: 'required' | 'recommended' | 'optional';
    rationale: string;
  }>;
  /** Phases that were skipped with reasons */
  skippedPhases: SkippedPhase[];
  /** Execution configuration */
  executionStrategy: {
    parallelism: 'aggressive' | 'balanced' | 'sequential';
    estimatedDurationMinutes: number;
  };
  /** Custom phases suggested by the planner */
  customPhases?: Array<{
    id: string;
    label: string;
    labelDe: string;
    category: PhaseCategory;
    description: string;
    dependencies: string[];
    promptTemplate: string;
  }>;
}

// ─── Checkpoint Types ──────────────────────────────────────────────────────────

export interface PitchScanCheckpoint {
  runId: string;
  /** The analysis plan (optional for legacy checkpoints) */
  plan?: PhasePlan;
  /** Completed phase IDs - accepts both built-in and dynamic */
  completedPhases: string[];
  /** Results keyed by section ID */
  phaseResults: Record<string, PhaseResult>;
  /** Phases that were skipped during execution */
  skippedPhases?: SkippedPhase[];
  startedAt: string;
  updatedAt: string;
}

// ─── Phase Agent Function Signature ────────────────────────────────────────────

export type PhaseAgentFn = (context: PhaseContext, emit: EventEmitter) => Promise<PhaseResult>;

// ─── Chat Types ────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Section ID - accepts both built-in and dynamic */
  sectionId?: string;
  timestamp: string;
}

export interface CustomSection {
  id: string;
  label: string;
  content: unknown;
  createdAt: string;
  prompt: string;
}

// ─── Legacy Type Aliases (for backward compatibility) ──────────────────────────

/**
 * @deprecated Use PhaseResult with string sectionId instead
 */
export interface LegacyPhaseResult {
  sectionId: BuiltInSectionId;
  content: unknown;
  confidence: number;
  sources?: string[];
}
