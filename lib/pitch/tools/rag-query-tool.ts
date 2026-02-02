import { tool } from 'ai';
import { z } from 'zod';

import { runCmsAgent, type CmsAnalysisResult } from '../agents/cms-agent';
import { runIndustryAgent, type IndustryAnalysisResult } from '../agents/industry-agent';
import { markAgentComplete, markAgentFailed } from '../checkpoints';
import { AGENT_NAMES } from '../constants';

/**
 * Creates the CMS knowledge query tool.
 *
 * Delegates to the CMS expert agent which uses RAG retrieval
 * internally to enrich its analysis with knowledge base data.
 */
export function createCmsQueryTool(params: {
  runId: string;
  targetCmsIds: string[];
  industry: string | null;
  websiteUrl: string;
}) {
  return tool({
    description:
      'Analysiere die Website mit dem CMS-Experten. Verwendet RAG-Wissen für fundierte CMS-Empfehlungen. ' +
      'Rufe dieses Tool nach dem Audit auf.',
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
        // Return degraded result so the pipeline can continue (best-effort)
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
 * Creates the Industry knowledge query tool.
 *
 * Delegates to the Industry expert agent which uses RAG retrieval
 * internally to enrich its analysis with industry-specific knowledge.
 */
export function createIndustryQueryTool(params: {
  runId: string;
  industry: string | null;
  websiteUrl: string;
  goal: string;
}) {
  return tool({
    description:
      'Analysiere die Website im Branchen-Kontext. Identifiziert regulatorische Anforderungen, ' +
      'Wettbewerbsaspekte und branchenspezifische Risiken. Rufe dieses Tool nach dem Audit auf.',
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
        // Return degraded result so the pipeline can continue (best-effort)
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
