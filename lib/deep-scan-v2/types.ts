/**
 * Deep Scan v2 Type Definitions
 *
 * Shared TypeScript interfaces and Zod schemas for the agent-native Deep Scan pipeline.
 */

import { z } from 'zod';

// ====== Run Status ======

export const deepScanV2StatusEnum = [
  'pending',
  'running',
  'audit_complete',
  'generating',
  'waiting_for_user',
  'review',
  'completed',
  'failed',
  'cancelled',
] as const;

export type DeepScanV2Status = (typeof deepScanV2StatusEnum)[number];

export const deepScanV2StatusSchema = z.enum(deepScanV2StatusEnum);

// ====== Document Types ======

export const documentTypeEnum = ['indication', 'calculation', 'presentation', 'proposal'] as const;
export type DocumentType = (typeof documentTypeEnum)[number];

export const documentFormatEnum = ['html', 'xlsx', 'pptx', 'docx', 'pdf'] as const;
export type DocumentFormat = (typeof documentFormatEnum)[number];

// ====== Audit Types ======

export const auditTypeEnum = [
  'tech_detection',
  'performance',
  'accessibility',
  'component_analysis',
  'seo',
  'security',
] as const;
export type AuditType = (typeof auditTypeEnum)[number];

// ====== Interview Results ======

export const interviewResultsSchema = z.object({
  goal: z.string(),
  cmsPreference: z.string().optional(),
  budgetRange: z.string().optional(),
  specialRequirements: z.string().optional(),
  tonality: z.enum(['formal', 'balanced', 'casual']).optional(),
});

export type InterviewResults = z.infer<typeof interviewResultsSchema>;

// ====== Activity Log (A7 - Structured Observability) ======

export const activityLogEntryTypeEnum = [
  'run_started',
  'phase_started',
  'phase_completed',
  'agent_started',
  'agent_completed',
  'agent_failed',
  'audit_started',
  'audit_completed',
  'question_asked',
  'answer_received',
  'document_generated',
  'checkpoint_saved',
  'checkpoint_restored',
  'run_completed',
  'run_failed',
  'run_cancelled',
  'run_deleted',
  'retry_attempted',
] as const;

export type ActivityLogEntryType = (typeof activityLogEntryTypeEnum)[number];

export interface ActivityLogEntry {
  timestamp: string;
  type: ActivityLogEntryType;
  message: string;
  metadata?: Record<string, unknown>;
  agentId?: string;
  phase?: string;
  durationMs?: number;
}

export const activityLogEntrySchema = z.object({
  timestamp: z.string(),
  type: z.enum(activityLogEntryTypeEnum),
  message: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  agentId: z.string().optional(),
  phase: z.string().optional(),
  durationMs: z.number().optional(),
});

// ====== Audit Result Types ======

export interface TechStackResult {
  cms: string | null;
  cmsVersion: string | null;
  framework: string | null;
  libraries: string[];
  cdn: string | null;
  hosting: string | null;
  analytics: string[];
  confidence: number;
}

export interface PerformanceResult {
  lcp: number | null;
  cls: number | null;
  fid: number | null;
  ttfb: number | null;
  fcp: number | null;
  speedIndex: number | null;
  overallScore: number;
  recommendations: string[];
}

export interface AccessibilityResult {
  wcagLevel: 'A' | 'AA' | 'AAA' | null;
  violations: Array<{
    id: string;
    impact: 'minor' | 'moderate' | 'serious' | 'critical';
    description: string;
    count: number;
  }>;
  overallScore: number;
}

export interface ComponentAnalysisResult {
  components: Array<{
    name: string;
    category: 'layout' | 'navigation' | 'content' | 'form' | 'interactive' | 'media';
    occurrences: number;
    complexity: 'simple' | 'medium' | 'complex';
    description: string;
    migrationNotes: string;
  }>;
  contentTypes: Array<{
    name: string;
    count: number;
    fields: string[];
    hasCustomLogic: boolean;
  }>;
  forms: Array<{
    name: string;
    fields: number;
    hasValidation: boolean;
    hasFileUpload: boolean;
    submitsTo: string;
  }>;
  interactions: Array<{
    name: string;
    type: 'search' | 'filter' | 'sort' | 'pagination' | 'animation' | 'realtime' | 'other';
    complexity: 'simple' | 'medium' | 'complex';
  }>;
}

// ====== Agent-Native Results Format (A8) ======

export interface DeepScanV2ResultsFormat {
  runId: string;
  status: DeepScanV2Status;
  progress: number;
  confidence: number;

  // Audit Results
  audits: {
    techStack?: TechStackResult;
    performance?: PerformanceResult;
    accessibility?: AccessibilityResult;
    componentAnalysis?: ComponentAnalysisResult;
  };

  // Analysis Results
  analysis: {
    cmsRecommendation?: {
      cmsId: string;
      cmsName: string;
      score: number;
      reasoning: string;
    };
    migrationComplexity?: {
      overall: 'low' | 'medium' | 'high' | 'very_high';
      estimatedHours: number;
      factors: string[];
    };
    expertInsights?: Array<{
      expertId: string;
      expertName: string;
      findings: string[];
      recommendations: string[];
      confidence: number;
    }>;
  };

  // Documents
  documents: Array<{
    id: string;
    type: DocumentType;
    format: DocumentFormat;
    title: string;
    downloadUrl?: string;
  }>;

  // Provenance (A5)
  provenance: {
    sources: string[];
    methodology: string;
    dataCollectedAt: string;
    toolVersions: Record<string, string>;
  };

  // Timing
  timing: {
    startedAt: string;
    completedAt?: string;
    phases: Array<{
      name: string;
      startedAt: string;
      completedAt?: string;
      durationMs?: number;
    }>;
  };
}

// ====== Tool Input Schemas (for Agent Tools) ======

export const triggerDeepScanInputSchema = z.object({
  preQualificationId: z.string().describe('ID of the pre-qualification to scan'),
  websiteUrl: z.string().url().describe('Website URL to analyze'),
  targetCmsIds: z.array(z.string()).optional().describe('Target CMS IDs to consider'),
  interviewResults: interviewResultsSchema.optional().describe('Optional interview results'),
});

export type TriggerDeepScanInput = z.infer<typeof triggerDeepScanInputSchema>;

export const getDeepScanStatusInputSchema = z.object({
  runId: z.string().describe('ID of the Deep Scan run'),
});

export type GetDeepScanStatusInput = z.infer<typeof getDeepScanStatusInputSchema>;

export const getDeepScanResultInputSchema = z.object({
  runId: z.string().describe('ID of the Deep Scan run'),
  includeDocuments: z.boolean().optional().default(true).describe('Include document URLs'),
  includeProvenance: z.boolean().optional().default(true).describe('Include provenance data'),
});

export type GetDeepScanResultInput = z.infer<typeof getDeepScanResultInputSchema>;

export const cancelDeepScanInputSchema = z.object({
  runId: z.string().describe('ID of the Deep Scan run to cancel'),
  reason: z.string().optional().describe('Reason for cancellation'),
});

export type CancelDeepScanInput = z.infer<typeof cancelDeepScanInputSchema>;

export const deleteDeepScanInputSchema = z.object({
  runId: z.string().describe('ID of the Deep Scan run to delete'),
  deleteDocuments: z.boolean().optional().default(true).describe('Also delete generated documents'),
});

export type DeleteDeepScanInput = z.infer<typeof deleteDeepScanInputSchema>;

export const retryDeepScanInputSchema = z.object({
  runId: z.string().describe('ID of the failed Deep Scan run to retry'),
  fromPhase: z.string().optional().describe('Phase to restart from (default: last checkpoint)'),
});

export type RetryDeepScanInput = z.infer<typeof retryDeepScanInputSchema>;

export const getDeepScanActivityInputSchema = z.object({
  runId: z.string().describe('ID of the Deep Scan run'),
  limit: z.number().optional().default(100).describe('Maximum number of entries'),
  types: z.array(z.enum(activityLogEntryTypeEnum)).optional().describe('Filter by entry types'),
});

export type GetDeepScanActivityInput = z.infer<typeof getDeepScanActivityInputSchema>;

export const listDeepScansInputSchema = z.object({
  preQualificationId: z.string().optional().describe('Filter by pre-qualification'),
  status: z.array(deepScanV2StatusSchema).optional().describe('Filter by status'),
  limit: z.number().optional().default(20).describe('Maximum number of results'),
  offset: z.number().optional().default(0).describe('Pagination offset'),
  orderBy: z.enum(['createdAt', 'updatedAt', 'status']).optional().default('createdAt'),
  orderDir: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ListDeepScansInput = z.infer<typeof listDeepScansInputSchema>;

export const answerDeepScanInputSchema = z.object({
  runId: z.string().describe('ID of the Deep Scan run waiting for answer'),
  answer: z.string().describe('Answer to the pending question'),
  reasoning: z.string().optional().describe('Agent reasoning for the answer (for audit trail)'),
});

export type AnswerDeepScanInput = z.infer<typeof answerDeepScanInputSchema>;
