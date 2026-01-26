import type { Job } from 'bullmq';
import { and, eq } from 'drizzle-orm';

import { runExpertAgents } from '../../agents/expert-agents';
import { db } from '../../db';
import { backgroundJobs, preQualifications, quickScans } from '../../db/schema';
import { runQuickScanAgentNative } from '../../quick-scan/agent-native';
import type { QuickScanResult } from '../../quick-scan/workflow-agent';
import { embedAgentOutput } from '../../rag/embedding-service';
import { generateTimelineFromQuickScan } from '../../timeline/integration';
import { onAgentComplete } from '../../workflow/orchestrator';
import type { QuickScanJobData, QuickScanJobResult } from '../queues';

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function mergeQuickScanResults(quickScan: typeof quickScans.$inferSelect, result: QuickScanResult) {
  type ResultTechStack = typeof result.techStack;
  type ResultDecisionMakers = typeof result.decisionMakers;

  const existingTechStack = parseJson<Partial<ResultTechStack>>(quickScan.techStack) || null;
  const existingDecisionMakers = parseJson<ResultDecisionMakers>(quickScan.decisionMakers) || null;

  const mergedTechStack: ResultTechStack = {
    ...existingTechStack,
    ...result.techStack,
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
  }

  return { mergedTechStack, mergedDecisionMakers };
}

function mergeTechStack(
  quickScan: typeof quickScans.$inferSelect,
  techStack: QuickScanResult['techStack']
) {
  const existingTechStack = parseJson<Partial<typeof techStack>>(quickScan.techStack) || null;

  return {
    ...existingTechStack,
    ...techStack,
    libraries: [
      ...new Set([...(existingTechStack?.libraries || []), ...(techStack.libraries || [])]),
    ],
    analytics: [
      ...new Set([...(existingTechStack?.analytics || []), ...(techStack.analytics || [])]),
    ],
    marketing: [
      ...new Set([...(existingTechStack?.marketing || []), ...(techStack.marketing || [])]),
    ],
    backend: [...new Set([...(existingTechStack?.backend || []), ...(techStack.backend || [])])],
    cdnProviders: [
      ...new Set([...(existingTechStack?.cdnProviders || []), ...(techStack.cdnProviders || [])]),
    ],
  };
}

function mergeDecisionMakers(
  quickScan: typeof quickScans.$inferSelect,
  decisionMakers: QuickScanResult['decisionMakers']
) {
  const existingDecisionMakers =
    parseJson<QuickScanResult['decisionMakers']>(quickScan.decisionMakers) || null;

  if (!existingDecisionMakers?.decisionMakers || !decisionMakers?.decisionMakers) {
    return decisionMakers;
  }

  const existingEmails = new Set(
    existingDecisionMakers.decisionMakers
      .map(d => d.email)
      .filter((email): email is string => Boolean(email))
  );
  const newContacts = decisionMakers.decisionMakers.filter(
    d => !d.email || !existingEmails.has(d.email)
  );

  return {
    ...decisionMakers,
    decisionMakers: [...existingDecisionMakers.decisionMakers, ...newContacts],
  };
}

class ActivityLogUpdater {
  private activityLog: Array<{ timestamp: string; action: string; details?: string }>;
  private flushPromise: Promise<void> | null = null;
  private lastFlush = 0;
  private readonly minFlushInterval = 2000;

  constructor(private quickScanId: string, initialLog: typeof this.activityLog) {
    this.activityLog = initialLog;
  }

  push(entry: { timestamp: string; action: string; details?: string }) {
    this.activityLog.push(entry);
    const now = Date.now();
    if (now - this.lastFlush >= this.minFlushInterval) {
      void this.flush();
    }
  }

  async flush() {
    if (this.flushPromise) {
      await this.flushPromise;
      return;
    }

    this.lastFlush = Date.now();
    const payload = JSON.stringify(this.activityLog);
    this.flushPromise = db
      .update(quickScans)
      .set({ activityLog: payload })
      .where(eq(quickScans.id, this.quickScanId))
      .then(() => {
        this.flushPromise = null;
      });

    await this.flushPromise;
  }
}

async function getBackgroundJobId(bullmqJobId: string) {
  const [jobRecord] = await db
    .select({ id: backgroundJobs.id })
    .from(backgroundJobs)
    .where(and(eq(backgroundJobs.bullmqJobId, bullmqJobId), eq(backgroundJobs.jobType, 'quick-scan')))
    .limit(1);

  return jobRecord?.id ?? null;
}

async function updateBackgroundJob(
  dbJobId: string | null,
  update: Partial<{
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    currentStep: string | null;
    errorMessage: string | null;
    result: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
  }>
) {
  if (!dbJobId) return;

  await db
    .update(backgroundJobs)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(backgroundJobs.id, dbJobId));
}

export async function processQuickScanJob(job: Job<QuickScanJobData>): Promise<QuickScanJobResult> {
  const { preQualificationId, quickScanId, websiteUrl, userId } = job.data;

  console.log(`[QuickScan Worker] Starting job ${job.id} for prequal ${preQualificationId}`);
  const dbJobId = await getBackgroundJobId(String(job.id));

  const [bid] = await db
    .select()
    .from(preQualifications)
    .where(eq(preQualifications.id, preQualificationId))
    .limit(1);

  const [quickScan] = await db
    .select()
    .from(quickScans)
    .where(eq(quickScans.id, quickScanId))
    .limit(1);

  if (!bid || !quickScan) {
    throw new Error('Quick Scan record or prequalification not found');
  }

  await updateBackgroundJob(dbJobId, {
    status: 'running',
    progress: 5,
    currentStep: 'Initializing quick scan',
    startedAt: new Date(),
  });

  await db
    .update(quickScans)
    .set({
      status: 'running',
      startedAt: quickScan.startedAt || new Date(),
      completedAt: null,
    })
    .where(eq(quickScans.id, quickScanId));

  await db
    .update(preQualifications)
    .set({
      status: 'quick_scanning',
      updatedAt: new Date(),
    })
    .where(eq(preQualifications.id, preQualificationId));

  const extractedReqs = parseJson<Record<string, unknown>>(bid.extractedRequirements) || null;

  const initialLog =
    (parseJson<Array<{ timestamp: string; action: string; details?: string }>>(
      quickScan.activityLog
    ) || []) as Array<{ timestamp: string; action: string; details?: string }>;
  const logUpdater = new ActivityLogUpdater(quickScanId, initialLog);

  try {
    await updateBackgroundJob(dbJobId, {
      progress: 15,
      currentStep: 'Running quick scan agent',
    });

    const result = await runQuickScanAgentNative(
      {
        bidId: preQualificationId,
        websiteUrl,
        extractedRequirements: extractedReqs,
        userId,
        preQualificationId,
      },
      {
        onActivity: entry => {
          logUpdater.push(entry);
        },
      }
    );

    const { mergedTechStack, mergedDecisionMakers } = mergeQuickScanResults(quickScan, result);

    let timeline: Record<string, unknown> | null = null;
    let timelineGeneratedAt: Date | null = null;

    await updateBackgroundJob(dbJobId, {
      progress: 70,
      currentStep: 'Generating timeline',
    });

    try {
      timeline = await generateTimelineFromQuickScan({
        projectName:
          (extractedReqs?.projectTitle as string | undefined) ||
          (extractedReqs?.projectDescription as string | undefined) ||
          'Projekt',
        projectDescription: extractedReqs?.projectDescription as string | undefined,
        websiteUrl,
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
    } catch (error) {
      console.error('[QuickScan Worker] Timeline generation failed:', error);
    }

    await updateBackgroundJob(dbJobId, {
      progress: 85,
      currentStep: 'Saving quick scan results',
    });

    await db
      .update(quickScans)
      .set({
        status: 'completed',
        techStack: JSON.stringify(mergedTechStack),
        cms: (mergedTechStack.cms) || null,
        framework: (mergedTechStack.framework) || null,
        hosting: (mergedTechStack.hosting) || null,
        contentVolume: JSON.stringify(result.contentVolume),
        features: JSON.stringify(result.features),
        recommendedBusinessUnit: result.blRecommendation.primaryBusinessLine,
        confidence: result.blRecommendation.confidence,
        reasoning: result.blRecommendation.reasoning,
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
        screenshots: result.screenshots ? JSON.stringify(result.screenshots) : quickScan.screenshots,
        companyIntelligence: result.companyIntelligence
          ? JSON.stringify(result.companyIntelligence)
          : quickScan.companyIntelligence,
        contentTypes: result.contentTypes
          ? JSON.stringify(result.contentTypes)
          : quickScan.contentTypes,
        migrationComplexity: result.migrationComplexity
          ? JSON.stringify(result.migrationComplexity)
          : quickScan.migrationComplexity,
        decisionMakers: mergedDecisionMakers
          ? JSON.stringify(mergedDecisionMakers)
          : quickScan.decisionMakers,
        rawScanData: result.rawScanData
          ? JSON.stringify(result.rawScanData)
          : quickScan.rawScanData,
        activityLog: JSON.stringify(result.activityLog),
        timeline: timeline ? JSON.stringify(timeline) : quickScan.timeline,
        timelineGeneratedAt: timelineGeneratedAt || quickScan.timelineGeneratedAt,
        completedAt: new Date(),
      })
      .where(eq(quickScans.id, quickScanId));

    await updateBackgroundJob(dbJobId, {
      progress: 92,
      currentStep: 'Embedding results',
    });

    try {
      await embedAgentOutput(
        preQualificationId,
        'quick_scan',
        result as unknown as Record<string, unknown>
      );
      console.error('[QuickScan Worker] Embedded Quick Scan result for RAG');
    } catch (error) {
      console.error('[QuickScan Worker] Failed to embed Quick Scan result:', error);
    }

    try {
      await updateBackgroundJob(dbJobId, {
        progress: 96,
        currentStep: 'Running expert agents',
      });
      const expertResult = await runExpertAgents({ preQualificationId: preQualificationId });
      console.log(
        '[QuickScan Worker] Expert Agents completed:',
        expertResult.success ? 'success' : 'partial'
      );
    } catch (error) {
      console.error('[QuickScan Worker] Expert Agents failed:', error);
    }

    await logUpdater.flush();
    await onAgentComplete(preQualificationId, 'QuickScan');

    await updateBackgroundJob(dbJobId, {
      status: 'completed',
      progress: 100,
      currentStep: 'Completed',
      result: JSON.stringify({ success: true }),
      completedAt: new Date(),
    });

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Quick Scan failed';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'Error';

    console.error(`[QuickScan Worker] Job ${job.id} failed:`, {
      message: errorMsg,
      name: errorName,
      stack: errorStack,
      preQualificationId,
      websiteUrl,
    });

    const fullErrorDetails = JSON.stringify({
      message: errorMsg,
      name: errorName,
      stack: errorStack,
      timestamp: new Date().toISOString(),
    });

    await updateBackgroundJob(dbJobId, {
      status: 'failed',
      progress: 100,
      currentStep: 'Failed',
      errorMessage: fullErrorDetails,
      result: JSON.stringify({ success: false, error: errorMsg }),
      completedAt: new Date(),
    });

    await db
      .update(quickScans)
      .set({
        status: 'failed',
        activityLog: JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            action: 'Quick Scan failed',
            details: errorMsg,
          },
        ]),
        completedAt: new Date(),
      })
      .where(eq(quickScans.id, quickScanId));

    await db
      .update(preQualifications)
      .set({
        status: 'quick_scan_failed',
        agentErrors: JSON.stringify([
          {
            agent: 'quick-scan',
            error: errorMsg,
            timestamp: new Date().toISOString(),
          },
        ]),
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, preQualificationId));

    await logUpdater.flush();
    return { success: false, error: errorMsg };
  }
}
