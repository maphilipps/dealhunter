import type { EventEmitter } from '@/lib/streaming/event-emitter';

import type { PitchScanSectionId } from './section-ids';

export interface PhaseContext {
  runId: string;
  pitchId: string;
  websiteUrl: string;
  previousResults: Record<string, unknown>;
  ragContext?: unknown;
  targetCmsIds: string[];
}

export interface PhaseResult {
  sectionId: PitchScanSectionId;
  content: unknown;
  confidence: number;
  sources?: string[];
}

export interface PitchScanCheckpoint {
  runId: string;
  completedPhases: PitchScanSectionId[];
  phaseResults: Record<string, PhaseResult>;
  startedAt: string;
  updatedAt: string;
}

// ─── Phase Agent Function Signature ────────────────────────────────────────────

export type PhaseAgentFn = (context: PhaseContext, emit: EventEmitter) => Promise<PhaseResult>;

// ─── Chat Types ────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sectionId?: PitchScanSectionId;
  timestamp: string;
}

export interface CustomSection {
  id: string;
  label: string;
  content: unknown;
  createdAt: string;
  prompt: string;
}
