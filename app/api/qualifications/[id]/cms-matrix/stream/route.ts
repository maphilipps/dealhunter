/**
 * CMS Matrix Stream API
 *
 * Startet die parallele Anforderungsmatrix-Recherche und streamt Fortschritt.
 * POST /api/qualifications/[id]/cms-matrix/stream
 */

import { and, eq, ilike } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  runParallelMatrixResearch,
  saveMatrixToRfp,
  matrixToCMSMatchingResult,
  type LicenseCostContext,
} from '@/lib/cms-matching/parallel-matrix-orchestrator';
import { extractRequirementsFromQualificationScan } from '@/lib/cms-matching/requirements';
import { db } from '@/lib/db';
import { preQualifications, leadScans, technologies } from '@/lib/db/schema';
import { AgentEventType, type AgentEvent } from '@/lib/streaming/in-process/event-types';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for research

/**
 * Requirements extraction moved to lib/cms-matching/requirements
 */

/**
 * POST Handler - Startet die Matrix-Recherche
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const { id: qualificationId } = await params;

  // Ownership verification
  const [owned] = await db
    .select({ id: preQualifications.id })
    .from(preQualifications)
    .where(
      and(eq(preQualifications.id, qualificationId), eq(preQualifications.userId, session.user.id))
    );
  if (!owned) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

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
      // 1. Load Qualification
      const preQualification = await db
        .select()
        .from(preQualifications)
        .where(eq(preQualifications.id, qualificationId))
        .limit(1);

      if (!preQualification.length) {
        await sendEvent({
          id: `error-${Date.now()}`,
          type: AgentEventType.AGENT_PROGRESS,
          timestamp: Date.now(),
          data: {
            agent: 'Matrix Orchestrator',
            message: 'Qualification nicht gefunden',
          },
        });
        await writer.close();
        return;
      }

      // 2. Load Qualification Scan and parse its structured fields
      // Prefer the linked qualificationScanId; fall back to the latest completed scan.
      const linkedQualificationScan = preQualification[0].qualificationScanId
        ? await db.query.leadScans.findFirst({
            where: eq(leadScans.id, preQualification[0].qualificationScanId),
          })
        : null;

      const latestCompletedQualificationScan =
        linkedQualificationScan ??
        (await db.query.leadScans.findFirst({
          where: and(
            eq(leadScans.preQualificationId, qualificationId),
            eq(leadScans.status, 'completed')
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

      const qualificationScanData: Record<string, unknown> = latestCompletedQualificationScan
        ? {
            features: safeParse(latestCompletedQualificationScan.features),
            techStack: safeParse(latestCompletedQualificationScan.techStack),
            contentVolume: safeParse(latestCompletedQualificationScan.contentVolume),
            accessibilityAudit: safeParse(latestCompletedQualificationScan.accessibilityAudit),
            legalCompliance: safeParse(latestCompletedQualificationScan.legalCompliance),
            performanceIndicators: safeParse(
              latestCompletedQualificationScan.performanceIndicators
            ),
          }
        : {};

      // 3. Extract Requirements
      const requirements = extractRequirementsFromQualificationScan(qualificationScanData);

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

      // 6. Build license cost context & save to Qualification
      let extractedReq: Record<string, unknown> = {};
      try {
        const reqStr = preQualification[0].extractedRequirements;
        if (reqStr) extractedReq = JSON.parse(reqStr) as Record<string, unknown>;
      } catch {
        /* ignore */
      }

      const licenseCostCtx: LicenseCostContext = {
        companySize:
          typeof extractedReq.companySize === 'string' ? extractedReq.companySize : undefined,
        pageCount: (qualificationScanData.contentVolume as Record<string, unknown> | undefined)
          ?.estimatedPageCount as number | undefined,
        requirements: requirements.map(r => ({ name: r.name, priority: r.priority })),
      };
      const techLicenseInfos = techs.map(t => ({
        id: t.id,
        annualLicenseCost: t.annualLicenseCost,
        requiresEnterprise: t.requiresEnterprise,
      }));

      await saveMatrixToRfp(qualificationId, matrix, licenseCostCtx, techLicenseInfos);

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
            cmsMatchingResult: matrixToCMSMatchingResult(matrix, licenseCostCtx, techLicenseInfos),
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
          message: 'Ein Fehler ist bei der Matrix-Recherche aufgetreten',
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
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const { id: qualificationId } = await params;

  const preQualification = await db
    .select({ qualificationScanId: preQualifications.qualificationScanId })
    .from(preQualifications)
    .where(
      and(eq(preQualifications.id, qualificationId), eq(preQualifications.userId, session.user.id))
    )
    .limit(1);

  if (!preQualification.length) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const qualificationScanId = preQualification[0].qualificationScanId;
  if (!qualificationScanId) {
    return Response.json({ matrix: null, cmsMatchingResult: null });
  }

  const qualificationScan = await db.query.leadScans.findFirst({
    where: eq(leadScans.id, qualificationScanId),
  });

  const cmsEval = qualificationScan?.cmsEvaluation
    ? (JSON.parse(qualificationScan.cmsEvaluation) as Record<string, unknown>)
    : {};

  return Response.json({
    matrix: (cmsEval.cmsMatchingMatrix as Record<string, unknown> | null) || null,
    cmsMatchingResult: (cmsEval.cmsMatchingResult as Record<string, unknown> | null) || null,
  });
}
