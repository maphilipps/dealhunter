// lib/pitch/types.ts
import { z } from 'zod';

// ====== Run Status ======
export const pitchStatusEnum = [
  'pending',
  'running',
  'audit_complete',
  'generating',
  'waiting_for_user',
  'review',
  'completed',
  'failed',
] as const;

export type PitchStatus = (typeof pitchStatusEnum)[number];

// ====== Document Types ======
export const documentTypeEnum = ['indication', 'calculation', 'presentation', 'proposal'] as const;
export type DocumentType = (typeof documentTypeEnum)[number];

export const documentFormatEnum = ['html', 'xlsx', 'pptx', 'docx'] as const;
export type DocumentFormat = (typeof documentFormatEnum)[number];

// ====== Interview Results ======
export const interviewResultsSchema = z.object({
  goal: z.string(),
  cmsPreference: z.string().optional(),
  budgetRange: z.string().optional(),
  specialRequirements: z.string().optional(),
  tonality: z.enum(['formal', 'balanced', 'casual']).optional(),
});

export type InterviewResults = z.infer<typeof interviewResultsSchema>;

// ====== Orchestrator Checkpoint ======
export interface OrchestratorCheckpoint {
  runId: string;
  phase: string;
  completedAgents: string[];
  agentResults: Record<string, unknown>;
  conversationHistory: Array<{
    role: 'assistant' | 'user';
    content: string;
  }>;
  collectedAnswers: Record<string, string>;
  pendingQuestion: {
    question: string;
    context: string;
    options?: string[];
    defaultAnswer?: string;
  } | null;
}

// ====== Progress Events (SSE) ======
export interface ProgressEvent {
  type:
    | 'phase_start'
    | 'agent_start'
    | 'agent_complete'
    | 'document_ready'
    | 'question'
    | 'answer_received'
    | 'complete'
    | 'error';
  phase: string;
  agent?: string;
  progress: number;
  message: string;
  confidence?: number;
  documentId?: string;
  question?: {
    text: string;
    options?: string[];
    context?: string;
  };
  timestamp: string;
}

// ====== BullMQ Job Types ======
export interface PitchJobData {
  runId: string;
  pitchId: string;
  websiteUrl: string;
  userId: string;
  targetCmsIds: string[];
  interviewResults?: InterviewResults;
  checkpointId?: string;
  userAnswer?: string;
  forceReset?: boolean;
}

export interface PitchJobResult {
  success: boolean;
  phase: 'audit' | 'analysis' | 'generation' | 'waiting_for_user' | 'complete';
  completedAgents: string[];
  failedAgents: string[];
  generatedDocuments: string[];
  checkpointId?: string;
  error?: string;
}

// ====== Audit Types ======
export interface ComponentAnalysis {
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

// ====== Indication Document ======
export const indicationDocumentSchema = z.object({
  executiveSummary: z.string(),
  currentState: z.object({
    techStack: z.object({
      cms: z.string().nullable(),
      framework: z.string().nullable(),
      libraries: z.array(z.string()),
      cdn: z.string().nullable(),
    }),
    contentVolume: z.object({
      pageCount: z.number(),
      contentTypes: z.number(),
      estimatedWords: z.number().optional(),
    }),
    componentCount: z.number(),
  }),
  recommendation: z.object({
    targetCms: z.string(),
    reasoning: z.string(),
    alternatives: z.array(
      z.object({
        cms: z.string(),
        reasoning: z.string(),
      })
    ),
  }),
  scopeEstimate: z.object({
    phases: z.array(
      z.object({
        name: z.string(),
        effort: z.string(),
        confidence: z.number(),
      })
    ),
    totalRange: z.object({
      min: z.number(),
      max: z.number(),
      unit: z.literal('PT'),
    }),
    riskFactors: z.array(z.string()),
  }),
  nextSteps: z.array(z.string()),
  flags: z.array(
    z.object({
      area: z.string(),
      message: z.string(),
      severity: z.enum(['info', 'warning', 'critical']),
    })
  ),
});

export type IndicationDocument = z.infer<typeof indicationDocumentSchema>;

// ====== RAG Types ======
export interface KnowledgeChunkMetadata {
  cms: string | null;
  industry: string | null;
  documentType: string | null;
  confidence: number;
  businessUnit: string | null;
}

export interface KnowledgeChunk {
  id: string;
  content: string;
  tokenCount: number;
  sourceType: string;
  sourceFileName: string | null;
  metadata: KnowledgeChunkMetadata;
  similarity?: number;
}
