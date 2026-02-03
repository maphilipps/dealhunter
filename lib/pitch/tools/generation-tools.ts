import { tool } from 'ai';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import { pitchDocuments } from '@/lib/db/schema';
import { generateIndication } from '../generators/indication-generator';
import { markAgentComplete, markAgentFailed } from '../checkpoints';
import { AGENT_NAMES } from '../constants';
import type { IndicationDocument } from '../types';
import type { UncertaintyFlag } from './uncertainty-tool';

// =============================================================================
// PRIMITIVE TOOLS
// These are atomic operations that do ONE thing each.
// The agent should compose these rather than using the convenience wrapper.
// =============================================================================

/**
 * PRIMITIVE: Render the indication document from analysis results.
 * Does NOT store in DB. Does NOT mark agent complete/failed.
 * Returns the full IndicationDocument for further processing.
 */
export function createRenderIndicationTool(params: { flags: UncertaintyFlag[] }) {
  return tool({
    description:
      'Rendere das Indikations-Dokument aus Analyseergebnissen. ' +
      'Speichert NICHT in der DB — nutze storeIndicationDocument separat.',
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
      const indication = await generateIndication({
        auditResults,
        cmsAnalysis,
        industryAnalysis,
        interviewContext: interviewContext ?? {},
        flags: params.flags,
      });

      return {
        rendered: true,
        indication,
        summary: {
          executiveSummary: indication.executiveSummary,
          recommendation: indication.recommendation.targetCms,
          totalEstimate: indication.scopeEstimate.totalRange,
          flagCount: indication.flags.length,
        },
      };
    },
  });
}

/**
 * PRIMITIVE: Store an indication document in the database.
 * Does NOT render the document. Does NOT mark agent complete/failed.
 * Takes a pre-rendered IndicationDocument and persists it.
 */
export function createStoreIndicationDocumentTool(params: {
  runId: string;
  pitchId: string;
  flags: UncertaintyFlag[];
}) {
  return tool({
    description:
      'Speichere ein gerendertes Indikations-Dokument in der Datenbank. ' +
      'Nutze renderIndication zuerst, um das Dokument zu generieren.',
    inputSchema: z.object({
      indication: z
        .record(z.string(), z.unknown())
        .describe('Das gerenderte IndicationDocument-Objekt'),
    }),
    execute: async ({ indication }) => {
      const doc = indication as unknown as IndicationDocument;

      const docId = createId();
      const confidence =
        doc.scopeEstimate?.phases?.length > 0
          ? Math.round(
              doc.scopeEstimate.phases.reduce((sum, p) => sum + (p.confidence ?? 50), 0) /
                doc.scopeEstimate.phases.length
            )
          : 50;

      await db.insert(pitchDocuments).values({
        id: docId,
        runId: params.runId,
        pitchId: params.pitchId,
        documentType: 'indication',
        format: 'html',
        content: JSON.stringify(doc),
        confidence,
        flags: JSON.stringify(params.flags),
        generatedAt: new Date(),
      });

      return {
        stored: true,
        documentId: docId,
        confidence,
      };
    },
  });
}

/**
 * Creates a collection of generation primitive tools.
 * These are stateless and composable — agent orchestrates the workflow.
 */
export function createGenerationPrimitiveTools(params: { flags: UncertaintyFlag[] }) {
  return {
    renderIndication: createRenderIndicationTool({ flags: params.flags }),
  };
}

/**
 * Creates a collection of generation primitive tools with DB access.
 * Includes storage capabilities requiring runId/pitchId.
 */
export function createGenerationPrimitiveToolsWithStorage(params: {
  runId: string;
  pitchId: string;
  flags: UncertaintyFlag[];
}) {
  return {
    renderIndication: createRenderIndicationTool({ flags: params.flags }),
    storeIndicationDocument: createStoreIndicationDocumentTool({
      runId: params.runId,
      pitchId: params.pitchId,
      flags: params.flags,
    }),
  };
}

// =============================================================================
// CONVENIENCE WRAPPER (for backward compatibility)
// This combines render + store + checkpoint. Prefer using primitives above.
// =============================================================================

/**
 * CONVENIENCE WRAPPER: Renders, stores, and marks agent complete in one call.
 * @deprecated Prefer using createRenderIndicationTool + createStoreIndicationDocumentTool
 * + markAgentComplete/markAgentFailed from checkpoints
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
