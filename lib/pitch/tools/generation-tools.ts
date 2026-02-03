import { tool } from 'ai';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import { pitchDocuments } from '@/lib/db/schema';
import { generateIndication } from '../generators/indication-generator';
import { markAgentComplete, markAgentFailed } from '../checkpoints';
import { AGENT_NAMES } from '../constants';
import type { UncertaintyFlag } from './uncertainty-tool';

/**
 * Creates the generateIndication tool that produces the final indication document.
 *
 * This is the culmination of the pipeline — it takes all analysis results
 * and generates a structured HTML indication document.
 */
export function createGenerateIndicationTool(params: {
  runId: string;
  pitchId: string;
  flags: UncertaintyFlag[];
}) {
  return tool({
    description:
      'Generiere das Indikations-Dokument basierend auf allen gesammelten Analyseergebnissen. ' +
      'Rufe dieses Tool als letzten Schritt auf, nachdem Audit, CMS-Analyse und Branchen-Analyse abgeschlossen sind.',
    inputSchema: z.object({
      auditResults: z
        .record(z.string(), z.unknown())
        .describe('Die vollständigen Audit-Ergebnisse'),
      cmsAnalysis: z.record(z.string(), z.unknown()).describe('Die CMS-Analyse-Ergebnisse'),
      industryAnalysis: z
        .record(z.string(), z.unknown())
        .describe('Die Branchen-Analyse-Ergebnisse'),
      interviewContext: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Kontext aus dem Interview (Ziel, Budget, Anforderungen)'),
    }),
    execute: async ({ auditResults, cmsAnalysis, industryAnalysis, interviewContext }) => {
      try {
        const indication = await generateIndication({
          auditResults,
          cmsAnalysis,
          industryAnalysis,
          interviewContext: interviewContext ?? {},
          flags: params.flags,
        });

        // Store document in DB
        const docId = createId();
        await db.insert(pitchDocuments).values({
          id: docId,
          runId: params.runId,
          pitchId: params.pitchId,
          documentType: 'indication',
          format: 'html',
          content: JSON.stringify(indication),
          confidence:
            indication.scopeEstimate.phases.length > 0
              ? Math.round(
                  indication.scopeEstimate.phases.reduce((sum, p) => sum + p.confidence, 0) /
                    indication.scopeEstimate.phases.length
                )
              : 50,
          flags: JSON.stringify(params.flags),
          generatedAt: new Date(),
        });

        await markAgentComplete(params.runId, AGENT_NAMES.QUALITY, 85);

        return {
          documentId: docId,
          executiveSummary: indication.executiveSummary,
          recommendation: indication.recommendation.targetCms,
          totalEstimate: indication.scopeEstimate.totalRange,
          flagCount: indication.flags.length,
        };
      } catch (error) {
        console.error(`[Generation Tool] Failed for run ${params.runId}:`, error);
        await markAgentFailed(params.runId, AGENT_NAMES.QUALITY);
        return {
          documentId: null,
          executiveSummary:
            'Indikation konnte nicht generiert werden — manuelle Erstellung erforderlich.',
          recommendation: 'unbekannt',
          totalEstimate: 'nicht verfügbar',
          flagCount: 0,
        };
      }
    },
  });
}
