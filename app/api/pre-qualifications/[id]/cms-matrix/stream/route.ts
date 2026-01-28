/**
 * CMS Matrix Stream API
 *
 * Startet die parallele Anforderungsmatrix-Recherche und streamt Fortschritt.
 * POST /api/pre-qualifications/[id]/cms-matrix/stream
 */

import { and, eq, ilike } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import {
  runParallelMatrixResearch,
  saveMatrixToRfp,
  matrixToCMSMatchingResult,
} from '@/lib/cms-matching/parallel-matrix-orchestrator';
import { extractRequirementsFromQuickScan } from '@/lib/cms-matching/requirements';
import { db } from '@/lib/db';
import { preQualifications, quickScans, technologies } from '@/lib/db/schema';
import { AgentEventType, type AgentEvent } from '@/lib/streaming/event-types';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for research

/**
 * Requirements extraction moved to lib/cms-matching/requirements
 */

/**
 * POST Handler - Startet die Matrix-Recherche
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: preQualificationId } = await params;

  // Create streaming response
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Helper to send SSE events
  const sendEvent = async (event: AgentEvent) => {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    await writer.write(encoder.encode(data));
  };

  // Run research in background
  void (async () => {
    try {
      // 1. Load Pre-Qualification
      const preQualification = await db
        .select()
        .from(preQualifications)
        .where(eq(preQualifications.id, preQualificationId))
        .limit(1);

      if (!preQualification.length) {
        await sendEvent({
          id: `error-${Date.now()}`,
          type: AgentEventType.AGENT_PROGRESS,
          timestamp: Date.now(),
          data: {
            agent: 'Matrix Orchestrator',
            message: 'Pre-Qualification nicht gefunden',
          },
        });
        await writer.close();
        return;
      }

      // 2. Load Quick Scan and parse its structured fields
      // Prefer the linked quickScanId; fall back to the latest completed scan.
      const linkedQuickScan = preQualification[0].quickScanId
        ? await db.query.quickScans.findFirst({
            where: eq(quickScans.id, preQualification[0].quickScanId),
          })
        : null;

      const latestCompletedQuickScan =
        linkedQuickScan ??
        (await db.query.quickScans.findFirst({
          where: and(
            eq(quickScans.preQualificationId, preQualificationId),
            eq(quickScans.status, 'completed')
          ),
          orderBy: (table, { desc }) => [desc(table.completedAt), desc(table.createdAt)],
        }));

      const safeParse = (value: unknown): Record<string, unknown> | undefined => {
        if (!value || typeof value !== 'string') return undefined;
        try {
          return JSON.parse(value) as Record<string, unknown>;
        } catch {
          return undefined;
        }
      };

      const quickScanData: Record<string, unknown> = latestCompletedQuickScan
        ? {
            features: safeParse(latestCompletedQuickScan.features),
            techStack: safeParse(latestCompletedQuickScan.techStack),
            contentVolume: safeParse(latestCompletedQuickScan.contentVolume),
            accessibilityAudit: safeParse(latestCompletedQuickScan.accessibilityAudit),
            legalCompliance: safeParse(latestCompletedQuickScan.legalCompliance),
            performanceIndicators: safeParse(latestCompletedQuickScan.performanceIndicators),
          }
        : {};

      // 3. Extract Requirements
      const requirements = extractRequirementsFromQuickScan(quickScanData);

      if (requirements.length === 0) {
        await sendEvent({
          id: `error-${Date.now()}`,
          type: AgentEventType.AGENT_PROGRESS,
          timestamp: Date.now(),
          data: {
            agent: 'Matrix Orchestrator',
            message: 'Keine Anforderungen erkannt. Bitte zuerst die Qualification durchführen.',
          },
        });
        await writer.close();
        return;
      }

      await sendEvent({
        id: `start-${Date.now()}`,
        type: AgentEventType.AGENT_PROGRESS,
        timestamp: Date.now(),
        data: {
          agent: 'Matrix Orchestrator',
          message: `${requirements.length} Anforderungen erkannt`,
        },
      });

      // 4. Load CMS Options from DB
      const techs = await db.select().from(technologies).where(ilike(technologies.category, 'cms'));

      if (techs.length === 0) {
        throw new Error('Keine CMS-Technologies gefunden (technologies.category="cms")');
      }

      const cmsOptions = techs.map(t => {
        let strengths: string[] = [];
        let weaknesses: string[] = [];
        try {
          strengths = t.pros ? (JSON.parse(t.pros) as string[]) : [];
        } catch {
          strengths = [];
        }
        try {
          weaknesses = t.cons ? (JSON.parse(t.cons) as string[]) : [];
        } catch {
          weaknesses = [];
        }
        return {
          id: t.id,
          name: t.name,
          isBaseline: t.isDefault || false,
          strengths,
          weaknesses,
        };
      });

      await sendEvent({
        id: `cms-${Date.now()}`,
        type: AgentEventType.AGENT_PROGRESS,
        timestamp: Date.now(),
        data: {
          agent: 'Matrix Orchestrator',
          message: `${cmsOptions.length} CMS-Systeme werden verglichen`,
        },
      });

      // 5. Run Parallel Matrix Research
      const matrix = await runParallelMatrixResearch(
        requirements,
        cmsOptions,
        event => void sendEvent(event),
        {
          useCache: true,
          saveToDb: true,
          maxConcurrency: 5,
        }
      );

      // 6. Save to Pre-Qualification
      await saveMatrixToRfp(preQualificationId, matrix);

      // 7. Send final result
      await sendEvent({
        id: `result-${Date.now()}`,
        type: AgentEventType.COMPLETE,
        timestamp: Date.now(),
        data: {
          agent: 'Matrix Orchestrator',
          message: 'Matrix-Recherche abgeschlossen',
          result: {
            matrix,
            cmsMatchingResult: matrixToCMSMatchingResult(matrix),
          },
        },
      });
    } catch (error) {
      console.error('[CMS Matrix API] Error:', error);
      await sendEvent({
        id: `error-${Date.now()}`,
        type: AgentEventType.AGENT_PROGRESS,
        timestamp: Date.now(),
        data: {
          agent: 'Matrix Orchestrator',
          message: `Fehler: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/**
 * GET Handler - Lädt gespeicherte Matrix
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: preQualificationId } = await params;

  const preQualification = await db
    .select({ quickScanId: preQualifications.quickScanId })
    .from(preQualifications)
    .where(eq(preQualifications.id, preQualificationId))
    .limit(1);

  if (!preQualification.length) {
    return Response.json({ error: 'Pre-Qualification not found' }, { status: 404 });
  }

  const quickScanId = preQualification[0].quickScanId;
  if (!quickScanId) {
    return Response.json({ matrix: null, cmsMatchingResult: null });
  }

  const quickScan = await db.query.quickScans.findFirst({
    where: eq(quickScans.id, quickScanId),
  });

  const cmsEval = quickScan?.cmsEvaluation
    ? (JSON.parse(quickScan.cmsEvaluation) as Record<string, unknown>)
    : {};

  return Response.json({
    matrix: (cmsEval.cmsMatchingMatrix as Record<string, unknown> | null) || null,
    cmsMatchingResult: (cmsEval.cmsMatchingResult as Record<string, unknown> | null) || null,
  });
}
