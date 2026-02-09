// Shared utilities for audit scan phase agents

import { z } from 'zod';

import type { PhaseContext, PhaseResult } from '../types';
import { PHASE_AGENT_CONFIG } from '../constants';
import { generateWithFallback } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { dealEmbeddings, pitches } from '@/lib/db/schema';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/in-process/event-types';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';

/**
 * Zod schema for phase agent responses.
 * All phase agents return markdown-first output: a short summary plus full markdown analysis.
 * Using generateObject (via generateStructuredOutput) eliminates brittle regex JSON parsing.
 */
export const phaseAgentResponseSchema = z.object({
  content: z.object({
    summary: z.string().min(1),
    markdown: z.string().min(1),
  }),
  confidence: z.number().min(0).max(100),
  sources: z.array(z.string()).optional(),
});

interface RunPhaseAgentOptions {
  sectionId: string;
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
  const config = PHASE_AGENT_CONFIG[sectionId as keyof typeof PHASE_AGENT_CONFIG];
  if (!config) {
    throw new Error(`Unknown phase config for sectionId="${sectionId}"`);
  }

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
    label,
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

interface PreQualChunk {
  agentName: string;
  chunkType: string;
  chunkCategory: string | null;
  confidence: number | null;
  content: string;
}

export function formatPreQualContext(
  chunks: PreQualChunk[],
  maxChars: number
): {
  raw: string;
  truncated: boolean;
} {
  const formatted = chunks
    .map(c => {
      const meta = [
        c.chunkCategory ? `cat=${c.chunkCategory}` : null,
        c.confidence != null ? `conf=${c.confidence}%` : null,
      ]
        .filter(Boolean)
        .join(', ');

      const header = meta
        ? `### ${c.agentName} (${c.chunkType}) [${meta}]`
        : `### ${c.agentName} (${c.chunkType})`;
      return `${header}\n${c.content}`;
    })
    .join('\n\n');

  const truncated = formatted.length > maxChars;
  const body = truncated ? `${formatted.slice(0, maxChars)}\n\n[...Kontext gekuerzt]` : formatted;

  return {
    raw: `<prequal_context>\n${body}\n</prequal_context>`,
    truncated,
  };
}

/**
 * Load PreQualification context from deal_embeddings.
 * Gracefully degrades (returns undefined) when PreQual is missing or query fails.
 */
export async function loadPreQualContext(
  pitchId: string
): Promise<PhaseContext['preQualContext'] | undefined> {
  try {
    const [pitch] = await db
      .select({ preQualificationId: pitches.preQualificationId })
      .from(pitches)
      .where(eq(pitches.id, pitchId))
      .limit(1);

    if (!pitch?.preQualificationId) return undefined;

    const chunks = await db
      .select({
        agentName: dealEmbeddings.agentName,
        chunkType: dealEmbeddings.chunkType,
        chunkCategory: dealEmbeddings.chunkCategory,
        confidence: dealEmbeddings.confidence,
        content: dealEmbeddings.content,
      })
      .from(dealEmbeddings)
      .where(
        and(
          eq(dealEmbeddings.preQualificationId, pitch.preQualificationId),
          inArray(dealEmbeddings.chunkCategory, [
            'fact',
            'recommendation',
            'risk',
            'estimate',
            'elaboration',
          ]),
          gte(dealEmbeddings.confidence, 50)
        )
      )
      .orderBy(desc(dealEmbeddings.confidence))
      .limit(15);

    if (chunks.length === 0) return undefined;

    const MAX_CONTEXT_CHARS = 8000;
    const { raw, truncated } = formatPreQualContext(chunks, MAX_CONTEXT_CHARS);

    return {
      raw,
      metadata: {
        preQualificationId: pitch.preQualificationId,
        chunkCount: chunks.length,
        truncated,
      },
    };
  } catch (error) {
    console.error(`[Pitch Scan] Failed to load PreQual context for pitch ${pitchId}:`, error);
    return undefined;
  }
}

/**
 * Build a common user prompt that includes website, PreQual context, and previous results.
 */
export function buildBaseUserPrompt(context: PhaseContext): string {
  const parts: string[] = [];

  parts.push(`# Website\n${context.websiteUrl || '(keine URL)'}\n`);

  if (context.targetCmsIds.length > 0) {
    parts.push(
      `# Erlaubte Ziel-CMS (adesso Portfolio)\nNur diese CMS duerfen empfohlen werden: ${context.targetCmsIds.join(', ')}\nANDERE CMS (WordPress, Contentful, Strapi, etc.) sind NICHT im adesso Portfolio und duerfen NICHT empfohlen werden.`
    );
  }

  if (context.preQualContext) {
    parts.push(`# Kontext aus Pre-Qualification\n${context.preQualContext.raw}`);
    if (context.preQualContext.metadata.truncated) {
      parts.push(`*(Hinweis: Kontext wurde gekuerzt)*`);
    }
  } else {
    parts.push(
      `# Kontext aus Pre-Qualification\n*(Kein PreQual-Kontext verfuegbar. Bitte nutze Best-Effort und mache Annahmen explizit.)*`
    );
  }

  parts.push(`# Vorherige Analyse-Ergebnisse\n${formatPreviousResults(context)}`);

  return parts.join('\n\n');
}
