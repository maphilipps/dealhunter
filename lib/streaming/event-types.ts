// Event types for agent streaming

export enum AgentEventType {
  START = 'start',
  AGENT_PROGRESS = 'agent-progress',
  AGENT_COMPLETE = 'agent-complete',
  DECISION = 'decision',
  COMPLETE = 'complete',
  ERROR = 'error',
  ABORT = 'abort',
  // QuickScan Phase Events
  PHASE_START = 'phase-start',
  ANALYSIS_COMPLETE = 'analysis-complete',
  // URL Check Events
  URL_CHECK = 'url-check',
  URL_SUGGESTION = 'url-suggestion',
  // Workflow Step Events (QuickScan 2.0 Refactoring)
  STEP_START = 'step-start',
  STEP_COMPLETE = 'step-complete',
  WORKFLOW_PROGRESS = 'workflow-progress',
}

// QuickScan Phase Types
export type QuickScanPhase = 'bootstrap' | 'multi_page' | 'analysis' | 'synthesis';

// QuickScan Phase Event Data
export interface PhaseStartData {
  phase: QuickScanPhase;
  message: string;
  timestamp: number;
}

export interface AnalysisCompleteData {
  analysis: string; // z.B. 'techStack', 'accessibility', 'seo', etc.
  success: boolean;
  duration: number;
  details?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW STEP EVENT DATA (QuickScan 2.0 Refactoring)
// Used for consistent step-level tracking across all Quick Scan tools
// ═══════════════════════════════════════════════════════════════════════════════

export interface StepStartData {
  stepId: string;
  stepName: string;
  phase: QuickScanPhase;
  timestamp: number;
  dependencies?: string[]; // Steps this step depends on
  optional?: boolean; // Whether step failure stops the workflow
}

export interface StepCompleteData {
  stepId: string;
  stepName: string;
  phase: QuickScanPhase;
  success: boolean;
  duration: number;
  error?: string;
  result?: unknown; // Step output for downstream steps
}

export interface WorkflowProgressData {
  phase: QuickScanPhase;
  completedSteps: number;
  totalSteps: number;
  currentSteps: string[]; // Steps currently running
  percentage: number;
}

// Tech Stack Detection specific event types
export enum TechStackEventType {
  DETECTION_START = 'tech-stack:detection-start',
  FINDING = 'tech-stack:finding',
  DETECTION_COMPLETE = 'tech-stack:detection-complete',
  DETECTION_ERROR = 'tech-stack:detection-error',
}

export type TechFindingCategory =
  | 'cms'
  | 'framework'
  | 'library'
  | 'analytics'
  | 'hosting'
  | 'cdn'
  | 'server'
  | 'build-tool';

export interface AgentProgressData {
  agent: string;
  message: string;
  reasoning?: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
  }>;
  confidence?: number;
}

export interface AgentCompleteData {
  agent: string;
  result: unknown;
  confidence?: number;
  sources?: Array<{
    type: 'reference' | 'competitor' | 'technology';
    title: string;
    content?: string;
  }>;
}

export interface DecisionData {
  decision: 'BIT' | 'NO_BIT';
  overallScore: number;
  confidence: number;
  reasoning: string;
  scores: {
    capability?: number;
    dealQuality?: number;
    strategicFit?: number;
    competition?: number;
  };
}

export interface ErrorData {
  message: string;
  code?: string;
}

// URL Check Event Data
export interface UrlCheckData {
  originalUrl: string;
  finalUrl: string;
  reachable: boolean;
  statusCode?: number;
  redirectChain?: string[];
}

export interface UrlSuggestionData {
  originalUrl: string;
  suggestedUrl: string;
  reason: string;
}

export type AgentEventData =
  | { type: AgentEventType.START }
  | { type: AgentEventType.AGENT_PROGRESS; data: AgentProgressData }
  | { type: AgentEventType.AGENT_COMPLETE; data: AgentCompleteData }
  | { type: AgentEventType.DECISION; data: DecisionData }
  | { type: AgentEventType.COMPLETE }
  | { type: AgentEventType.ERROR; data: ErrorData }
  | { type: AgentEventType.ABORT }
  // QuickScan Phase Events
  | { type: AgentEventType.PHASE_START; data: PhaseStartData }
  | { type: AgentEventType.ANALYSIS_COMPLETE; data: AnalysisCompleteData }
  // URL Check Events
  | { type: AgentEventType.URL_CHECK; data: UrlCheckData }
  | { type: AgentEventType.URL_SUGGESTION; data: UrlSuggestionData }
  // Workflow Step Events (QuickScan 2.0 Refactoring)
  | { type: AgentEventType.STEP_START; data: StepStartData }
  | { type: AgentEventType.STEP_COMPLETE; data: StepCompleteData }
  | { type: AgentEventType.WORKFLOW_PROGRESS; data: WorkflowProgressData };

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  timestamp: number;
  data?: unknown;
}

export interface StreamState {
  events: AgentEvent[];
  isStreaming: boolean;
  error: string | null;
  decision: DecisionData | null;
  urlSuggestion: UrlSuggestionData | null;
  agentStates: Record<
    string,
    {
      status: 'pending' | 'running' | 'complete' | 'error';
      progress?: string;
      result?: unknown;
      confidence?: number;
    }
  >;
  // Workflow Step States (QuickScan 2.0 Refactoring)
  stepStates: Record<
    string,
    {
      status: 'pending' | 'running' | 'complete' | 'error' | 'skipped';
      phase: QuickScanPhase;
      stepName?: string;
      startTime?: number;
      duration?: number;
      error?: string;
      result?: unknown;
    }
  >;
  workflowProgress: {
    phase: QuickScanPhase;
    completedSteps: number;
    totalSteps: number;
    percentage: number;
  } | null;
}
