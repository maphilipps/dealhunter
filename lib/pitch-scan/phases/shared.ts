// Shared utilities for audit scan phase agents

import { z } from 'zod';

import type { PhaseContext, PhaseResult } from '../types';
import type { PitchScanSectionId } from '../section-ids';
import { PHASE_AGENT_CONFIG } from '../constants';
import { generateWithFallback } from '@/lib/ai/config';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

/**
 * Zod schema for phase agent responses.
 * All phase agents return structured JSON with content, confidence, and optional sources.
 * Using generateObject (via generateStructuredOutput) eliminates brittle regex JSON parsing.
 */
const phaseAgentResponseSchema = z.object({
  content: z.unknown(),
  confidence: z.number().min(0).max(100),
  sources: z.array(z.string()).optional(),
});

interface RunPhaseAgentOptions {
  sectionId: PitchScanSectionId;
  label: string;
  systemPrompt: string;
  userPrompt: string;
  context: PhaseContext;
  emit: EventEmitter;
}

/**
 * Shared runner for all phase agents.
 * Uses AI SDK's generateObject (via generateWithFallback) for reliable
 * structured output instead of generateText + regex JSON parsing.
 * Timeout is handled by generateWithFallback's built-in AbortController.
 * Automatic model fallback is enabled for empty response errors.
 */
export async function runPhaseAgent(options: RunPhaseAgentOptions): Promise<PhaseResult> {
  const { sectionId, label, systemPrompt, userPrompt, emit } = options;
  const config = PHASE_AGENT_CONFIG[sectionId];

  emit({
    type: AgentEventType.AGENT_PROGRESS,
    data: { agent: label, message: `Starte ${label}...` },
  });

  const modelKey = config.modelSlot === 'fast' ? ('fast' as const) : ('quality' as const);

  const result = await generateWithFallback({
    model: modelKey,
    schema: phaseAgentResponseSchema,
    system: systemPrompt,
    prompt: userPrompt,
    timeout: config.timeoutMs,
  });

  const parsed: PhaseResult = {
    sectionId,
    content: result.content,
    confidence: result.confidence,
    sources: result.sources,
  };

  emit({
    type: AgentEventType.AGENT_COMPLETE,
    data: {
      agent: label,
      result: { confidence: parsed.confidence },
      confidence: parsed.confidence,
    },
  });

  return parsed;
}

/**
 * Formats previous phase results into a context string for prompts.
 */
export function formatPreviousResults(context: PhaseContext): string {
  const entries = Object.entries(context.previousResults);
  if (entries.length === 0) return 'Keine vorherigen Ergebnisse verfügbar.';

  return entries
    .map(([key, value]) => {
      const summary =
        typeof value === 'string' ? value.slice(0, 2000) : JSON.stringify(value).slice(0, 2000);
      return `### ${key}\n${summary}`;
    })
    .join('\n\n');
}
