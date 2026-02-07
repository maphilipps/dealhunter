import type { Job } from 'bullmq';
import { and, eq } from 'drizzle-orm';

import { db } from '../../db';
import { backgroundJobs, preQualifications, leadScans, users } from '../../db/schema';
import { withRetry, DEFAULT_RETRY_CONFIGS } from '../../errors/retry';
import { sendScanCompleteEmail } from '../../qualification-scan/notifications/scan-complete-email';
import { runQualificationScanAgentNative } from '../../qualification-scan/agent-native';
import type { QualificationScanResult } from '../../qualification-scan/workflow-agent';
import { embedAgentOutput } from '../../rag/embedding-service';
import { generateTimelineFromQualificationScan } from '../../timeline/integration';
import { onAgentComplete } from '../../workflow/orchestrator';
import type { QualificationScanJobData, QualificationScanJobResult } from '../queues';

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function mergeQualificationScanResults(
  scan: typeof leadScans.$inferSelect,
  result: QualificationScanResult
) {
  type ResultTechStack = typeof result.techStack;
  type ResultDecisionMakers = typeof result.decisionMakers;

  const existingTechStack = parseJson<Partial<ResultTechStack>>(scan.techStack) || null;
  const existingDecisionMakers = parseJson<ResultDecisionMakers>(scan.decisionMakers) || null;

  const mergedTechStack: ResultTechStack = {
    ...existingTechStack,
    ...result.techStack,
    libraries: [
      ...new Set([...(existingTechStack?.libraries || []), ...(result.techStack.libraries || [])]),
    ],
    analytics: [
      ...new Set([...(existingTechStack?.analytics || []), ...(result.techStack.analytics || [])]),
    ],
    marketing: [
      ...new Set([...(existingTechStack?.marketing || []), ...(result.techStack.marketing || [])]),
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
  scan: typeof leadScans.$inferSelect,
  techStack: QualificationScanResult['techStack']
) {
  const existingTechStack = parseJson<Partial<typeof techStack>>(scan.techStack) || null;

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
  scan: typeof leadScans.$inferSelect,
  decisionMakers: QualificationScanResult['decisionMakers']
) {
  const existingDecisionMakers =
    parseJson<QualificationScanResult['decisionMakers']>(scan.decisionMakers) || null;

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

  constructor(
    private qualificationScanId: string,
    initialLog: typeof this.activityLog
  ) {
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
      .update(leadScans)
      .set({ activityLog: payload })
      .where(eq(leadScans.id, this.qualificationScanId))
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
    .where(
      and(
        eq(backgroundJobs.bullmqJobId, bullmqJobId),
        eq(backgroundJobs.jobType, 'qualification-scan')
      )
    )
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

export async function processQualificationScanJob(
  job: Job<QualificationScanJobData>
): Promise<QualificationScanJobResult> {
  const { preQualificationId, qualificationScanId, websiteUrl, userId } = job.data;

  console.log(
    `[QualificationScan Worker] Starting job ${job.id} for prequal ${preQualificationId}`
  );
  const dbJobId = await getBackgroundJobId(String(job.id));

  const [bid] = await db
    .select()
    .from(preQualifications)
    .where(eq(preQualifications.id, preQualificationId))
    .limit(1);

  const [qualificationScan] = await db
    .select()
    .from(leadScans)
    .where(eq(leadScans.id, qualificationScanId))
    .limit(1);

  if (!bid || !qualificationScan) {
    throw new Error('Qualification Scan record or prequalification not found');
  }

  await updateBackgroundJob(dbJobId, {
    status: 'running',
    progress: 5,
    currentStep: 'Initializing qualifications scan',
    startedAt: new Date(),
  });

  await db
    .update(leadScans)
    .set({
      status: 'running',
      startedAt: qualificationScan.startedAt || new Date(),
      completedAt: null,
    })
    .where(eq(leadScans.id, qualificationScanId));

  await db
    .update(preQualifications)
    .set({
      status: 'qualification_scanning',
      updatedAt: new Date(),
    })
    .where(eq(preQualifications.id, preQualificationId));

  const extractedReqs = parseJson<Record<string, unknown>>(bid.extractedRequirements) || null;

  const initialLog = (parseJson<Array<{ timestamp: string; action: string; details?: string }>>(
    qualificationScan.activityLog
  ) || []) as Array<{ timestamp: string; action: string; details?: string }>;
  const logUpdater = new ActivityLogUpdater(qualificationScanId, initialLog);

  try {
    await updateBackgroundJob(dbJobId, {
      progress: 15,
      currentStep: 'Running qualifications scan agent',
    });

    // Agent-Aufruf mit Retry-Wrapper für transiente Fehler
    const agentResult = await withRetry(
      async () =>
        runQualificationScanAgentNative(
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
        ),
      { ...DEFAULT_RETRY_CONFIGS.qualificationScan, maxAttempts: 3 },
      (attempt, maxAttempts, delay) => {
        logUpdater.push({
          timestamp: new Date().toISOString(),
          action: `Retry ${attempt}/${maxAttempts}`,
          details: `Warte ${delay / 1000}s vor nächstem Versuch...`,
        });
      }
    );

    if (!agentResult.success) {
      throw new Error(
        agentResult.error?.message || 'Qualifications-Scan fehlgeschlagen nach mehreren Versuchen'
      );
    }

    const result = agentResult.data!;

    const { mergedTechStack, mergedDecisionMakers } = mergeQualificationScanResults(
      qualificationScan,
      result
    );

    let timeline: Record<string, unknown> | null = null;
    let timelineGeneratedAt: Date | null = null;

    await updateBackgroundJob(dbJobId, {
      progress: 70,
      currentStep: 'Generating timeline',
    });

    try {
      timeline = await generateTimelineFromQualificationScan({
        projectName:
          (extractedReqs?.projectTitle as string | undefined) ||
          (extractedReqs?.projectDescription as string | undefined) ||
          'Projekt',
        projectDescription: extractedReqs?.projectDescription as string | undefined,
        websiteUrl,
        extractedRequirements: extractedReqs,
        qualificationScanResult: {
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
      console.error('[QualificationScan Worker] Timeline generation failed:', error);
    }

    await updateBackgroundJob(dbJobId, {
      progress: 85,
      currentStep: 'Saving qualifications scan results',
    });

    await db
      .update(leadScans)
      .set({
        status: 'completed',
        techStack: JSON.stringify(mergedTechStack),
        cms: mergedTechStack.cms || null,
        framework: mergedTechStack.framework || null,
        hosting: mergedTechStack.hosting || null,
        contentVolume: JSON.stringify(result.contentVolume),
        features: JSON.stringify(result.features),
        recommendedBusinessUnit: result.blRecommendation.primaryBusinessLine,
        confidence: result.blRecommendation.confidence,
        reasoning: result.blRecommendation.reasoning,
        navigationStructure: result.navigationStructure
          ? JSON.stringify(result.navigationStructure)
          : qualificationScan.navigationStructure,
        accessibilityAudit: result.accessibilityAudit
          ? JSON.stringify(result.accessibilityAudit)
          : qualificationScan.accessibilityAudit,
        seoAudit: result.seoAudit ? JSON.stringify(result.seoAudit) : qualificationScan.seoAudit,
        legalCompliance: result.legalCompliance
          ? JSON.stringify(result.legalCompliance)
          : qualificationScan.legalCompliance,
        performanceIndicators: result.performanceIndicators
          ? JSON.stringify(result.performanceIndicators)
          : qualificationScan.performanceIndicators,
        screenshots: result.screenshots
          ? JSON.stringify(result.screenshots)
          : qualificationScan.screenshots,
        companyIntelligence: result.companyIntelligence
          ? JSON.stringify(result.companyIntelligence)
          : qualificationScan.companyIntelligence,
        contentTypes: result.contentTypes
          ? JSON.stringify(result.contentTypes)
          : qualificationScan.contentTypes,
        migrationComplexity: result.migrationComplexity
          ? JSON.stringify(result.migrationComplexity)
          : qualificationScan.migrationComplexity,
        decisionMakers: mergedDecisionMakers
          ? JSON.stringify(mergedDecisionMakers)
          : qualificationScan.decisionMakers,
        rawScanData: result.rawScanData
          ? JSON.stringify(result.rawScanData)
          : qualificationScan.rawScanData,
        activityLog: JSON.stringify(result.activityLog),
        timeline: timeline ? JSON.stringify(timeline) : qualificationScan.timeline,
        timelineGeneratedAt: timelineGeneratedAt || qualificationScan.timelineGeneratedAt,
        completedAt: new Date(),
      })
      .where(eq(leadScans.id, qualificationScanId));

    await updateBackgroundJob(dbJobId, {
      progress: 92,
      currentStep: 'Embedding results',
    });

    try {
      await embedAgentOutput(
        preQualificationId,
        'qualification_scan',
        result as unknown as Record<string, unknown>
      );
      console.error('[QualificationScan Worker] Embedded Qualification Scan result for RAG');
    } catch (error) {
      console.error('[QualificationScan Worker] Failed to embed Qualification Scan result:', error);
    }

    await logUpdater.flush();
    await onAgentComplete(preQualificationId, 'QualificationScan');

    // Send scan-complete email notification (fire-and-forget)
    try {
      const [owner] = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (owner) {
        const topFindings: string[] = [];
        if (result.blRecommendation?.primaryBusinessLine) {
          topFindings.push(`BL-Empfehlung: ${result.blRecommendation.primaryBusinessLine}`);
        }
        if (result.techStack?.cms) {
          topFindings.push(`CMS: ${result.techStack.cms}`);
        }
        if (result.migrationComplexity?.recommendation) {
          topFindings.push(`Migration: ${result.migrationComplexity.recommendation}`);
        }

        await sendScanCompleteEmail({
          recipientEmail: owner.email,
          recipientName: owner.name,
          customerName: bid.rawInput?.substring(0, 80) ?? 'Unbekannt',
          websiteUrl,
          qualificationId: preQualificationId,
          topFindings,
          scanStatus: 'completed',
        });
      }
    } catch (emailError) {
      console.error('[QualificationScan Worker] Failed to send completion email:', emailError);
    }

    await updateBackgroundJob(dbJobId, {
      status: 'completed',
      progress: 100,
      currentStep: 'Completed',
      result: JSON.stringify({ success: true }),
      completedAt: new Date(),
    });

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Qualification Scan failed';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'Error';

    console.error(`[QualificationScan Worker] Job ${job.id} failed:`, {
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
      .update(leadScans)
      .set({
        status: 'failed',
        activityLog: JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            action: 'Qualification Scan failed',
            details: errorMsg,
          },
        ]),
        completedAt: new Date(),
      })
      .where(eq(leadScans.id, qualificationScanId));

    await db
      .update(preQualifications)
      .set({
        status: 'qualification_scan_failed',
        agentErrors: JSON.stringify([
          {
            agent: 'qualification-scan',
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
