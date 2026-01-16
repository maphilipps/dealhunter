// Event types for agent streaming

export enum AgentEventType {
  START = 'start',
  AGENT_PROGRESS = 'agent-progress',
  AGENT_COMPLETE = 'agent-complete',
  DECISION = 'decision',
  COMPLETE = 'complete',
  ERROR = 'error',
  ABORT = 'abort',
}

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

export type AgentEventData =
  | { type: AgentEventType.START }
  | { type: AgentEventType.AGENT_PROGRESS; data: AgentProgressData }
  | { type: AgentEventType.AGENT_COMPLETE; data: AgentCompleteData }
  | { type: AgentEventType.DECISION; data: DecisionData }
  | { type: AgentEventType.COMPLETE }
  | { type: AgentEventType.ERROR; data: ErrorData }
  | { type: AgentEventType.ABORT };

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
  agentStates: Record<
    string,
    {
      status: 'pending' | 'running' | 'complete' | 'error';
      progress?: string;
      result?: unknown;
      confidence?: number;
    }
  >;
}
