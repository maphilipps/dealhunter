import { tool } from 'ai';
import { z } from 'zod';

import { queryKnowledge } from '../rag/retrieval';
import { runCmsAgent, type CmsAnalysisResult } from '../agents/cms-agent';
import { runIndustryAgent, type IndustryAnalysisResult } from '../agents/industry-agent';
import { markAgentComplete, markAgentFailed } from '../checkpoints';
import { AGENT_NAMES } from '../constants';
import type { KnowledgeChunk, KnowledgeChunkMetadata } from '../types';

// Re-export types for consumers
export type { KnowledgeChunk, KnowledgeChunkMetadata } from '../types';
export type { CmsAnalysisResult } from '../agents/cms-agent';
export type { IndustryAnalysisResult } from '../agents/industry-agent';

// ============================================================================
// Primitive Tool - Generic RAG Query
// ============================================================================

/**
 * Knowledge chunk result schema for tool output.
 */
const knowledgeChunkSchema = z.object({
  id: z.string(),
  content: z.string(),
  tokenCount: z.number(),
  sourceType: z.string(),
  sourceFileName: z.string().nullable(),
  metadata: z.object({
    cms: z.string().nullable(),
    industry: z.string().nullable(),
    documentType: z.string().nullable(),
    confidence: z.number(),
    businessUnit: z.string().nullable(),
  }),
  similarity: z.number().optional(),
});

/**
 * Primitive: Query the knowledge base.
 *
 * Performs semantic search over the RAG knowledge base.
 * Returns raw chunks - the agent decides how to use them.
 * No LLM processing, no business logic.
 */
export function createKnowledgeQueryTool() {
  return tool({
    description:
      'Durchsucht die Wissensdatenbank nach relevanten Informationen. ' +
      'Gibt rohe Wissens-Chunks zurück, sortiert nach Relevanz. ' +
      'Nutze Filter für CMS, Branche oder Dokumenttyp um Ergebnisse einzugrenzen.',
    inputSchema: z.object({
      query: z.string().describe('Die Suchanfrage (natürliche Sprache)'),
      filters: z
        .object({
          cms: z.string().optional().describe('Filter nach CMS (z.B. "contentful", "strapi")'),
          industry: z
            .string()
            .optional()
            .describe('Filter nach Branche (z.B. "finance", "healthcare")'),
          documentType: z
            .string()
            .optional()
            .describe('Filter nach Dokumenttyp (z.B. "case-study", "best-practice")'),
          businessUnit: z.string().optional().describe('Filter nach Geschäftsbereich'),
        })
        .optional()
        .describe('Optionale Filter um Ergebnisse einzugrenzen'),
      topK: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe('Anzahl der Ergebnisse (Standard: 10, Max: 50)'),
      minConfidence: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe('Minimale Konfidenz der Chunks (Standard: 30)'),
    }),
    execute: async ({ query, filters, topK, minConfidence }): Promise<KnowledgeChunk[]> => {
      return queryKnowledge({
        query,
        filters: filters as Partial<KnowledgeChunkMetadata> | undefined,
        topK,
        minConfidence,
      });
    },
  });
}

// ============================================================================
// Agent Wrapper Tools - For backward compatibility and convenience
// ============================================================================

/**
 * Agent Wrapper: CMS analysis with RAG enrichment.
 *
 * This wraps the CMS agent which internally uses RAG.
 * Use createKnowledgeQueryTool() if you want raw RAG access.
 * The orchestrator can combine queryKnowledge + LLM for custom analysis.
 */
export function createCmsQueryTool(params: {
  runId: string;
  targetCmsIds: string[];
  industry: string | null;
  websiteUrl: string;
}) {
  return tool({
    description:
      'Führt eine vollständige CMS-Analyse durch mit RAG-Wissen. ' +
      'Empfiehlt ein Ziel-CMS basierend auf Audit-Ergebnissen und Wissensdatenbank. ' +
      'Für direkte RAG-Abfragen nutze stattdessen queryKnowledge.',
    inputSchema: z.object({
      auditResults: z
        .record(z.string(), z.unknown())
        .describe('Die Audit-Ergebnisse als JSON-Objekt'),
    }),
    execute: async ({ auditResults }): Promise<CmsAnalysisResult> => {
      try {
        const result = await runCmsAgent({
          auditResults,
          targetCmsIds: params.targetCmsIds,
          industry: params.industry,
          websiteUrl: params.websiteUrl,
        });

        await markAgentComplete(params.runId, AGENT_NAMES.CMS, result.confidence);

        return result;
      } catch (error) {
        console.error(`[CMS Agent] Failed for run ${params.runId}:`, error);
        await markAgentFailed(params.runId, AGENT_NAMES.CMS);
        return {
          recommendedCms: params.targetCmsIds[0] ?? 'unknown',
          reasoning: 'CMS-Analyse fehlgeschlagen — Empfehlung basiert auf Ziel-CMS.',
          migrationComplexity: 'medium',
          migrationStrategy: 'Standardmigration — manuelle Prüfung empfohlen.',
          alternatives: [],
          confidence: 0,
        };
      }
    },
  });
}

/**
 * Agent Wrapper: Industry analysis with RAG enrichment.
 *
 * This wraps the Industry agent which internally uses RAG.
 * Use createKnowledgeQueryTool() if you want raw RAG access.
 * The orchestrator can combine queryKnowledge + LLM for custom analysis.
 */
export function createIndustryQueryTool(params: {
  runId: string;
  industry: string | null;
  websiteUrl: string;
  goal: string;
}) {
  return tool({
    description:
      'Führt eine vollständige Branchen-Analyse durch mit RAG-Wissen. ' +
      'Identifiziert regulatorische Anforderungen, Wettbewerbsaspekte und Risiken. ' +
      'Für direkte RAG-Abfragen nutze stattdessen queryKnowledge.',
    inputSchema: z.object({
      auditResults: z
        .record(z.string(), z.unknown())
        .describe('Die Audit-Ergebnisse als JSON-Objekt'),
    }),
    execute: async ({ auditResults }): Promise<IndustryAnalysisResult> => {
      try {
        const result = await runIndustryAgent({
          auditResults,
          industry: params.industry,
          websiteUrl: params.websiteUrl,
          goal: params.goal,
        });

        await markAgentComplete(params.runId, AGENT_NAMES.INDUSTRY, result.confidence);

        return result;
      } catch (error) {
        console.error(`[Industry Agent] Failed for run ${params.runId}:`, error);
        await markAgentFailed(params.runId, AGENT_NAMES.INDUSTRY);
        return {
          industry: params.industry ?? 'unbekannt',
          industryRequirements: [],
          competitiveInsights: [],
          riskFactors: [
            {
              risk: 'Branchenanalyse fehlgeschlagen — keine branchenspezifischen Daten verfügbar.',
              severity: 'medium',
              mitigation: 'Manuelle Branchenrecherche empfohlen.',
            },
          ],
          recommendations: ['Branchenanalyse manuell nachholen.'],
          confidence: 0,
        };
      }
    },
  });
}

// ============================================================================
// Tool Collections - For easy registration
// ============================================================================

/**
 * Returns the RAG primitive tool.
 * Use this when you want the agent to have direct RAG access.
 */
export function createRagPrimitiveTools() {
  return {
    queryKnowledge: createKnowledgeQueryTool(),
  };
}

/**
 * Returns all RAG-related tools including agent wrappers.
 * Agent wrappers require run context for DB persistence.
 */
export function createRagTools(params: {
  runId: string;
  targetCmsIds: string[];
  industry: string | null;
  websiteUrl: string;
  goal: string;
}) {
  return {
    queryKnowledge: createKnowledgeQueryTool(),
    queryCmsKnowledge: createCmsQueryTool({
      runId: params.runId,
      targetCmsIds: params.targetCmsIds,
      industry: params.industry,
      websiteUrl: params.websiteUrl,
    }),
    queryIndustryKnowledge: createIndustryQueryTool({
      runId: params.runId,
      industry: params.industry,
      websiteUrl: params.websiteUrl,
      goal: params.goal,
    }),
  };
}
