/**
 * CMS Matrix Stream API
 *
 * Startet die parallele Anforderungsmatrix-Recherche und streamt Fortschritt.
 * POST /api/rfps/[id]/cms-matrix/stream
 */

import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import {
  runParallelMatrixResearch,
  saveMatrixToRfp,
  matrixToCMSMatchingResult,
} from '@/lib/cms-matching/parallel-matrix-orchestrator';
import type { RequirementMatch } from '@/lib/cms-matching/schema';
import { db } from '@/lib/db';
import { rfps, technologies } from '@/lib/db/schema';
import { AgentEventType, type AgentEvent } from '@/lib/streaming/event-types';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for research

/**
 * Extrahiert Requirements aus Quick Scan Daten
 */
function extractRequirementsFromQuickScan(quickScanData: Record<string, unknown>): Array<{
  name: string;
  category: RequirementMatch['category'];
  priority: RequirementMatch['priority'];
  source: RequirementMatch['source'];
}> {
  const requirements: Array<{
    name: string;
    category: RequirementMatch['category'];
    priority: RequirementMatch['priority'];
    source: RequirementMatch['source'];
  }> = [];

  const features = quickScanData.features as Record<string, unknown> | undefined;
  const techStack = quickScanData.techStack as Record<string, unknown> | undefined;
  const contentVolume = quickScanData.contentVolume as Record<string, unknown> | undefined;

  // Features -> Functional Requirements
  if (features) {
    if (features.ecommerce) {
      requirements.push({
        name: 'E-Commerce Funktionalität',
        category: 'functional',
        priority: 'must-have',
        source: 'detected',
      });
    }
    if (features.multiLanguage) {
      requirements.push({
        name: 'Mehrsprachigkeit',
        category: 'functional',
        priority: 'must-have',
        source: 'detected',
      });
    }
    if (features.search) {
      requirements.push({
        name: 'Suchfunktion',
        category: 'functional',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if (features.blog) {
      requirements.push({
        name: 'Blog/News Bereich',
        category: 'functional',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if (features.forms) {
      requirements.push({
        name: 'Formulare',
        category: 'functional',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if (features.userAccounts) {
      requirements.push({
        name: 'Benutzerkonten/Login',
        category: 'functional',
        priority: 'must-have',
        source: 'detected',
      });
    }
    if (features.api) {
      requirements.push({
        name: 'API-Schnittstelle',
        category: 'technical',
        priority: 'should-have',
        source: 'detected',
      });
    }
  }

  // Tech Stack -> Technical Requirements
  if (techStack) {
    if (techStack.serverSideRendering) {
      requirements.push({
        name: 'Server-Side Rendering (SSR)',
        category: 'technical',
        priority: 'should-have',
        source: 'detected',
      });
    }
    if ((techStack.apiEndpoints as Record<string, unknown>)?.graphql) {
      requirements.push({
        name: 'GraphQL API',
        category: 'technical',
        priority: 'should-have',
        source: 'detected',
      });
    }
  }

  // Content Volume -> Scalability
  if (contentVolume) {
    const pageCount = contentVolume.estimatedPageCount as number | undefined;
    if (pageCount && pageCount > 500) {
      requirements.push({
        name: 'Enterprise-Skalierbarkeit (>500 Seiten)',
        category: 'scalability',
        priority: 'must-have',
        source: 'inferred',
      });
    }
    if (contentVolume.complexity === 'high') {
      requirements.push({
        name: 'Komplexe Content-Strukturen',
        category: 'functional',
        priority: 'must-have',
        source: 'inferred',
      });
    }
  }

  // Always include common requirements
  requirements.push({
    name: 'DSGVO-Konformität',
    category: 'compliance',
    priority: 'must-have',
    source: 'inferred',
  });

  requirements.push({
    name: 'Barrierefreiheit (WCAG)',
    category: 'compliance',
    priority: 'should-have',
    source: 'inferred',
  });

  return requirements;
}

/**
 * POST Handler - Startet die Matrix-Recherche
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rfpId } = await params;

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
      // 1. Load RFP
      const rfp = await db.select().from(rfps).where(eq(rfps.id, rfpId)).limit(1);

      if (!rfp.length) {
        await sendEvent({
          id: `error-${Date.now()}`,
          type: AgentEventType.AGENT_PROGRESS,
          timestamp: Date.now(),
          data: {
            agent: 'Matrix Orchestrator',
            message: 'RFP nicht gefunden',
          },
        });
        await writer.close();
        return;
      }

      // 2. Parse Quick Scan Results
      const quickScanData: Record<string, unknown> = rfp[0].quickScanResults
        ? (JSON.parse(rfp[0].quickScanResults) as Record<string, unknown>)
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
            message: 'Keine Anforderungen erkannt. Bitte zuerst Quick Scan durchführen.',
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
      const techs = await db.select().from(technologies).where(eq(technologies.category, 'CMS'));

      const cmsOptions =
        techs.length > 0
          ? techs.map(t => ({
              id: t.id,
              name: t.name,
              isBaseline: t.isDefault || false,
            }))
          : [
              { id: 'drupal', name: 'Drupal', isBaseline: true },
              { id: 'wordpress', name: 'WordPress', isBaseline: false },
              { id: 'contentful', name: 'Contentful', isBaseline: false },
              { id: 'strapi', name: 'Strapi', isBaseline: false },
            ];

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

      // 6. Save to RFP
      await saveMatrixToRfp(rfpId, matrix);

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
  const { id: rfpId } = await params;

  const rfp = await db
    .select({ quickScanResults: rfps.quickScanResults })
    .from(rfps)
    .where(eq(rfps.id, rfpId))
    .limit(1);

  if (!rfp.length) {
    return Response.json({ error: 'RFP not found' }, { status: 404 });
  }

  const quickScanData: Record<string, unknown> = rfp[0].quickScanResults
    ? (JSON.parse(rfp[0].quickScanResults) as Record<string, unknown>)
    : {};

  return Response.json({
    matrix: (quickScanData.cmsMatchingMatrix as Record<string, unknown> | null) || null,
    cmsMatchingResult: (quickScanData.cmsMatchingResult as Record<string, unknown> | null) || null,
  });
}
