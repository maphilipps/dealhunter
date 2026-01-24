import { eq, and } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { runExpertAgents } from '@/lib/agents/expert-agents';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rfps, quickScans } from '@/lib/db/schema';
import { runQuickScanWithStreaming } from '@/lib/quick-scan/agent';
import { embedAgentOutput } from '@/lib/rag/embedding-service';
import { createAgentEventStream, createSSEResponse } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';
import { generateTimelineFromQuickScan } from '@/lib/timeline/integration';
import { onAgentComplete } from '@/lib/workflow/orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE endpoint for streaming Quick Scan activity
 * Best practice: Use native Web Streams for real-time updates
 * Security: Requires authentication and bid ownership verification
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // 1. Verify authentication
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = await context.params;

  try {
    // 2. Fetch bid data and verify ownership
    const [bid] = await db
      .select()
      .from(rfps)
      .where(and(eq(rfps.id, id), eq(rfps.userId, session.user.id)));

    if (!bid) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Get the existing QuickScan record
    if (!bid.quickScanId) {
      return new Response(JSON.stringify({ error: 'No Quick Scan found for this bid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [quickScan] = await db
      .select()
      .from(quickScans)
      .where(eq(quickScans.id, bid.quickScanId));

    if (!quickScan) {
      return new Response(JSON.stringify({ error: 'Quick Scan record not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!quickScan.websiteUrl) {
      return new Response(JSON.stringify({ error: 'No website URL in Quick Scan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // If scan is already completed, return the activity log as events
    if (quickScan.status === 'completed' && quickScan.activityLog) {
      const activityLog = JSON.parse(quickScan.activityLog) as Array<{
        agent?: string;
        message: string;
      }>;
      const stream = createAgentEventStream(async emit => {
        emit({ type: AgentEventType.START });

        // Replay the activity log
        for (const entry of activityLog) {
          emit({
            type: AgentEventType.AGENT_PROGRESS,
            data: { agent: entry.agent || 'Quick Scan', message: entry.message },
          });
        }

        emit({
          type: AgentEventType.AGENT_COMPLETE,
          data: {
            agent: 'Quick Scan',
            result: {
              recommendedBusinessUnit: quickScan.recommendedBusinessUnit,
              confidence: quickScan.confidence,
            },
          },
        });
      });

      return createSSEResponse(stream);
    }

    // If scan is still running, stream the live activity
    // Create SSE stream for live updates
    const stream = createAgentEventStream(async emit => {
      emit({ type: AgentEventType.START });

      // Parse extracted requirements if available
      const extractedReqs = bid.extractedRequirements
        ? (JSON.parse(bid.extractedRequirements) as Record<string, unknown>)
        : null;

      // Run quick scan with streaming callbacks
      const result = await runQuickScanWithStreaming(
        {
          websiteUrl: quickScan.websiteUrl,
          extractedRequirements: extractedReqs,
          bidId: id, // Pass bid ID for screenshot storage
        },
        emit
      );

      // Debug-Logging for QuickScan 2.0 fields before DB save
      console.error('[QuickScan Stream] Saving to DB:', {
        quickScanId: quickScan.id,
        hasContentTypes: !!result.contentTypes,
        hasMigrationComplexity: !!result.migrationComplexity,
        hasDecisionMakers: !!result.decisionMakers,
        hasRawScanData: !!result.rawScanData,
      });

      // DEA-108: Merge new results with existing data (ergänzen, nicht ersetzen)
      // Parse existing data for merging - use same types as result
      type ResultTechStack = typeof result.techStack;
      type ResultDecisionMakers = typeof result.decisionMakers;

      const existingTechStack = quickScan.techStack
        ? (JSON.parse(quickScan.techStack) as Partial<ResultTechStack>)
        : null;
      const existingDecisionMakers = quickScan.decisionMakers
        ? (JSON.parse(quickScan.decisionMakers) as ResultDecisionMakers)
        : null;

      // Merge tech stack arrays - new data takes precedence for single values, arrays are combined
      const mergedTechStack: ResultTechStack = {
        ...existingTechStack,
        ...result.techStack,
        // Merge arrays by combining and deduping
        libraries: [
          ...new Set([
            ...(existingTechStack?.libraries || []),
            ...(result.techStack.libraries || []),
          ]),
        ],
        analytics: [
          ...new Set([
            ...(existingTechStack?.analytics || []),
            ...(result.techStack.analytics || []),
          ]),
        ],
        marketing: [
          ...new Set([
            ...(existingTechStack?.marketing || []),
            ...(result.techStack.marketing || []),
          ]),
        ],
        backend: [
          ...new Set([...(existingTechStack?.backend || []), ...(result.techStack.backend || [])]),
        ],
        cdnProviders: [
          ...new Set([
            ...(existingTechStack?.cdnProviders || []),
            ...(result.techStack.cdnProviders || []),
          ]),
        ],
      };

      // Merge decision makers - combine contacts and dedupe by email
      let mergedDecisionMakers = result.decisionMakers;
      if (existingDecisionMakers?.decisionMakers && result.decisionMakers?.decisionMakers) {
        const existingEmails = new Set(
          existingDecisionMakers.decisionMakers
            .map(d => d.email)
            .filter((email): email is string => Boolean(email))
        );
        const newContacts = result.decisionMakers.decisionMakers.filter(
          d => !d.email || !existingEmails.has(d.email)
        );
        mergedDecisionMakers = {
          ...result.decisionMakers,
          decisionMakers: [...existingDecisionMakers.decisionMakers, ...newContacts],
        };
        console.error('[QuickScan Stream] Merged decision makers:', {
          existing: existingDecisionMakers.decisionMakers.length,
          new: newContacts.length,
          total: mergedDecisionMakers.decisionMakers.length,
        });
      }

      console.error('[QuickScan Stream] Data merge complete - ergänzt, nicht ersetzt');

      // Generate Timeline Estimate (Phase 1)
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: { agent: 'Timeline Agent', message: 'Generiere Projekt-Timeline...' },
      });

      let timeline: Record<string, unknown> | null = null;
      let timelineGeneratedAt: Date | null = null;

      try {
        timeline = await generateTimelineFromQuickScan({
          projectName:
            (extractedReqs?.projectTitle as string | undefined) ||
            (extractedReqs?.projectDescription as string | undefined) ||
            'Projekt',
          projectDescription: extractedReqs?.projectDescription as string | undefined,
          websiteUrl: quickScan.websiteUrl,
          extractedRequirements: extractedReqs,
          quickScanResult: {
            techStack: result.techStack,
            contentVolume: result.contentVolume
              ? {
                  estimatedPages: result.contentVolume.estimatedPageCount,
                  estimatedContentTypes: result.contentVolume.contentTypes?.length,
                }
              : undefined,
            features: {
              detectedFeatures: result.features
                ? Object.entries(result.features)
                    .filter(([key, value]) => value === true && key !== 'customFeatures')
                    .map(([key]) => key)
                    .concat(result.features.customFeatures || [])
                : [],
            },
          },
        });

        timelineGeneratedAt = new Date();

        emit({
          type: AgentEventType.AGENT_COMPLETE,
          data: {
            agent: 'Timeline Agent',
            result: {
              totalWeeks: timeline.totalWeeks,
              confidence: timeline.confidence,
            },
          },
        });
      } catch (error) {
        console.error('[Timeline Agent] Error:', error);
        emit({
          type: AgentEventType.ERROR,
          data: {
            agent: 'Timeline Agent',
            error: error instanceof Error ? error.message : 'Timeline generation failed',
          },
        });
      }

      // Update QuickScan record with MERGED results (ergänzen, nicht ersetzen)
      await db
        .update(quickScans)
        .set({
          status: 'completed',
          // Use merged tech stack (existing + new)
          techStack: JSON.stringify(mergedTechStack),
          cms: (mergedTechStack.cms as string | undefined) || null,
          framework: (mergedTechStack.framework as string | undefined) || null,
          hosting: (mergedTechStack.hosting as string | undefined) || null,
          contentVolume: JSON.stringify(result.contentVolume),
          features: JSON.stringify(result.features),
          recommendedBusinessUnit: result.blRecommendation.primaryBusinessLine,
          confidence: result.blRecommendation.confidence,
          reasoning: result.blRecommendation.reasoning,
          // Enhanced audit fields - use new if available, otherwise keep existing
          navigationStructure: result.navigationStructure
            ? JSON.stringify(result.navigationStructure)
            : quickScan.navigationStructure,
          accessibilityAudit: result.accessibilityAudit
            ? JSON.stringify(result.accessibilityAudit)
            : quickScan.accessibilityAudit,
          seoAudit: result.seoAudit ? JSON.stringify(result.seoAudit) : quickScan.seoAudit,
          legalCompliance: result.legalCompliance
            ? JSON.stringify(result.legalCompliance)
            : quickScan.legalCompliance,
          performanceIndicators: result.performanceIndicators
            ? JSON.stringify(result.performanceIndicators)
            : quickScan.performanceIndicators,
          screenshots: result.screenshots
            ? JSON.stringify(result.screenshots)
            : quickScan.screenshots,
          companyIntelligence: result.companyIntelligence
            ? JSON.stringify(result.companyIntelligence)
            : quickScan.companyIntelligence,
          // QuickScan 2.0 fields - use new if available, otherwise keep existing
          contentTypes: result.contentTypes
            ? JSON.stringify(result.contentTypes)
            : quickScan.contentTypes,
          migrationComplexity: result.migrationComplexity
            ? JSON.stringify(result.migrationComplexity)
            : quickScan.migrationComplexity,
          // Use merged decision makers (existing + new contacts)
          decisionMakers: mergedDecisionMakers
            ? JSON.stringify(mergedDecisionMakers)
            : quickScan.decisionMakers,
          rawScanData: result.rawScanData
            ? JSON.stringify(result.rawScanData)
            : quickScan.rawScanData,
          activityLog: JSON.stringify(result.activityLog),
          // Timeline (Phase 1 estimate)
          timeline: timeline ? JSON.stringify(timeline) : quickScan.timeline,
          timelineGeneratedAt: timelineGeneratedAt || quickScan.timelineGeneratedAt,
          completedAt: new Date(),
        })
        .where(eq(quickScans.id, quickScan.id));

      // DEA-107: Embed Quick Scan result for RAG knowledge base
      try {
        await embedAgentOutput(id, 'quick_scan', result as unknown as Record<string, unknown>);
        console.error('[QuickScan Stream] Embedded Quick Scan result for RAG');
      } catch (error) {
        console.error('[QuickScan Stream] Failed to embed Quick Scan result:', error);
        // Don't block on embedding failure
      }

      // Run Expert Agents (Timing, Deliverables, TechStack, Legal, Summary)
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: { agent: 'Expert Agents', message: 'Starte detaillierte RFP-Analyse...' },
      });

      try {
        const expertResult = await runExpertAgents({ rfpId: id });

        emit({
          type: AgentEventType.AGENT_COMPLETE,
          data: {
            agent: 'Expert Agents',
            result: {
              success: expertResult.success,
              timing: expertResult.results.timing.success,
              deliverables: expertResult.results.deliverables.success,
              techstack: expertResult.results.techstack.success,
              legal: expertResult.results.legal.success,
              summary: expertResult.results.summary.success,
            },
          },
        });

        console.error(
          '[QuickScan Stream] Expert Agents completed:',
          expertResult.success ? 'success' : 'partial'
        );
      } catch (error) {
        console.error('[QuickScan Stream] Expert Agents failed:', error);
        emit({
          type: AgentEventType.ERROR,
          data: {
            agent: 'Expert Agents',
            message: 'Expert-Analyse fehlgeschlagen',
          },
        });
        // Don't block on expert agent failure
      }

      // DEA-90: Use orchestrator to handle status transition
      // This will set status to 'bit_pending' (waiting for manual BID/NO-BID decision)
      await onAgentComplete(id, 'QuickScan');

      // Emit completion event
      emit({
        type: AgentEventType.AGENT_COMPLETE,
        data: {
          agent: 'Quick Scan',
          result: {
            recommendedBusinessUnit: result.blRecommendation.primaryBusinessLine,
            confidence: result.blRecommendation.confidence,
          },
        },
      });
    });

    return createSSEResponse(stream);
  } catch (error) {
    console.error('Quick scan stream error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
