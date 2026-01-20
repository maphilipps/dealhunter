import { inngest } from '../client';
import { db } from '@/lib/db';
import { deepMigrationAnalyses, rfps, quickScans, backgroundJobs } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { runFullScan } from '@/lib/full-scan/agent';
import { analyzeContentArchitecture } from '@/lib/deep-analysis/agents/content-architecture-agent';
import { scoreMigrationComplexity } from '@/lib/deep-analysis/agents/migration-complexity-agent';
import { auditAccessibility } from '@/lib/deep-analysis/agents/accessibility-audit-agent';
import { estimatePT } from '@/lib/deep-analysis/agents/pt-estimation-agent';
import {
  ContentArchitectureSchema,
  MigrationComplexitySchema,
  AccessibilityAuditSchema,
  PTEstimationSchema,
} from '@/lib/deep-analysis/schemas';
import { fullScanResultSchema } from '@/lib/full-scan/agent';
import {
  saveCheckpoint,
  loadCheckpoint,
  resumeFromCheckpoint,
  cleanupCheckpoint,
  createWorkflowState,
  updateWorkflowState,
  DeepAnalysisState,
} from '@/lib/workflow/checkpoints';

/**
 * Deep Migration Analysis Background Job
 * Runs 5 analysis agents in sequence:
 * Full-Scan → Content Architecture → Migration Complexity → Accessibility → PT Estimation
 * Expected duration: 35-60 minutes
 */
export const deepAnalysisFunction = inngest.createFunction(
  {
    id: 'deep-analysis-run',
    name: 'Deep Migration Analysis',
    retries: 2,
  },
  { event: 'deep-analysis.run' },
  async ({ event, step }) => {
    const { bidId, userId, jobId } = event.data;

    // Step 1: Check for existing checkpoint and resume if needed
    const workflowId = event.id || createId();
    const existingCheckpoint = await resumeFromCheckpoint(workflowId);

    // Step 2: Fetch bid data and create analysis record + job tracking
    const { bid, analysis, quickScan, jobRecord, workflowState } = await step.run('init-analysis', async () => {
      console.log('[Inngest] Starting deep analysis for bid:', bidId);

      const [bidData] = await db
        .select()
        .from(rfps)
        .where(eq(rfps.id, bidId))
        .limit(1);

      if (!bidData) {
        throw new Error(`Bid ${bidId} not found`);
      }

      if (!bidData.websiteUrl) {
        throw new Error('No website URL - cannot run Deep Analysis');
      }

      // Fetch quick scan results to get detected CMS
      const [quickScanData] = await db
        .select()
        .from(quickScans)
        .where(eq(quickScans.rfpId, bidId))
        .orderBy(desc(quickScans.createdAt))
        .limit(1);

      // Create analysis record
      const [analysisRecord] = await db
        .insert(deepMigrationAnalyses)
        .values({
          rfpId: bidId,
          userId: userId, // User ownership for access control
          jobId: event.id || 'manual-trigger',
          status: 'running' as const,
          startedAt: new Date(),
          websiteUrl: bidData.websiteUrl!,
          sourceCMS: quickScanData?.cms || 'Unknown',
          targetCMS: 'Drupal',
          version: 1,
        })
        .returning();

      // Create job tracking record
      const [job] = await db
        .insert(backgroundJobs)
        .values({
          id: jobId || createId(),
          jobType: 'deep-analysis',
          inngestRunId: event.id || 'manual-trigger',
          rfpId: bidId,
          userId,
          status: 'running',
          progress: 0,
          currentStep: 'Initializing deep analysis',
          startedAt: new Date(),
          attemptNumber: 1,
          maxAttempts: 2,
        })
        .returning();

      // Initialize workflow state checkpoint
      const state = createWorkflowState<DeepAnalysisState>({
        workflowId,
        workflowType: 'deep-analysis',
        rfpId: bidId,
        userId,
        status: 'running',
        currentStep: 'init-analysis',
        stepIndex: 0,
        totalSteps: 6, // full-scan, content-arch, complexity, accessibility, pt-estimation, finalize
        progress: 0,
        data: {
          analysisId: analysisRecord.id,
          websiteUrl: bidData.websiteUrl!,
          sourceCMS: quickScanData?.cms || 'Unknown',
          targetCMS: 'Drupal',
        },
      });

      // Save initial checkpoint
      await saveCheckpoint(state);

      return {
        bid: bidData,
        quickScan: quickScanData,
        analysis: analysisRecord,
        jobRecord: job,
        workflowState: state,
      };
    });

    try {
      // Step 2: Full-Scan (Website Audit) (10-30 minutes)
      const fullScanResult = await step.run('full-scan', async () => {
        console.log('[Inngest] Running Full-Scan (comprehensive website audit)...');

        // Update progress: Starting full-scan
        await db
          .update(backgroundJobs)
          .set({
            progress: 5,
            currentStep: 'Running comprehensive website audit',
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobRecord.id));

        // Update RFP status to 'full_scanning'
        await db
          .update(rfps)
          .set({
            status: 'full_scanning',
            updatedAt: new Date(),
          })
          .where(eq(rfps.id, bidId));

        const result = await runFullScan({
          websiteUrl: bid.websiteUrl!,
          quickScanData: {
            cms: quickScan?.cms ?? undefined,
            techStack: quickScan?.techStack ? (typeof quickScan.techStack === 'string' ? JSON.parse(quickScan.techStack) : quickScan.techStack) : undefined,
            features: quickScan?.features ? (typeof quickScan.features === 'string' ? JSON.parse(quickScan.features) : quickScan.features) : undefined,
          },
          targetCMS: 'Drupal',
        });

        // SECURITY: Validate AI output against schema
        const validated = fullScanResultSchema.parse(result);

        // Store full-scan result
        await db
          .update(deepMigrationAnalyses)
          .set({
            fullScanResult: JSON.stringify(validated),
            updatedAt: new Date(),
          })
          .where(eq(deepMigrationAnalyses.id, analysis.id));

        // Update progress: Full-scan complete
        await db
          .update(backgroundJobs)
          .set({
            progress: 20,
            currentStep: 'Website audit complete',
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobRecord.id));

        // Save checkpoint after full-scan
        const currentState = await loadCheckpoint(workflowId);
        if (currentState) {
          const deepAnalysisState = currentState as DeepAnalysisState;
          const updatedState = updateWorkflowState(deepAnalysisState, {
            currentStep: 'full-scan',
            stepIndex: 1,
            progress: 20,
            data: {
              ...deepAnalysisState.data,
              fullScanResult: result,
            },
          });
          await saveCheckpoint(updatedState);
        }

        console.log('[Inngest] Full-Scan complete');
        return result;
      });

      // Step 3: Content Architecture Analysis (6-10 minutes)
      const contentArchitecture = await step.run('content-architecture', async () => {
        console.log('[Inngest] Running Content Architecture analysis...');

        // Update progress: Starting content architecture
        await db
          .update(backgroundJobs)
          .set({
            progress: 30,
            currentStep: 'Analyzing content architecture',
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobRecord.id));

        const result = await analyzeContentArchitecture(
          bid.websiteUrl!,
          (message) => console.log(`[Content Architecture] ${message}`)
        );

        // SECURITY: Validate AI output against schema (XSS prevention)
        const validated = ContentArchitectureSchema.parse(result);

        // Store intermediate result
        await db
          .update(deepMigrationAnalyses)
          .set({
            contentArchitecture: JSON.stringify(validated),
            updatedAt: new Date(),
          })
          .where(eq(deepMigrationAnalyses.id, analysis.id));

        // Update progress: Content architecture complete
        await db
          .update(backgroundJobs)
          .set({
            progress: 45,
            currentStep: 'Content architecture complete',
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobRecord.id));

        console.log('[Inngest] Content Architecture complete');
        return result;
      });

      // Step 4: Migration Complexity Scoring (4-6 minutes)
      const migrationComplexity = await step.run('migration-complexity', async () => {
        console.log('[Inngest] Running Migration Complexity analysis...');

        await db
          .update(backgroundJobs)
          .set({
            progress: 55,
            currentStep: 'Scoring migration complexity',
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobRecord.id));

        const result = await scoreMigrationComplexity(
          bid.websiteUrl!,
          quickScan?.cms || 'Unknown',
          contentArchitecture.pageTypes.flatMap(pt => pt.sampleUrls),
          contentArchitecture.contentTypeMapping.length,
          (message) => console.log(`[Migration Complexity] ${message}`)
        );

        // SECURITY: Validate AI output against schema
        const validated = MigrationComplexitySchema.parse(result);

        // Store intermediate result
        await db
          .update(deepMigrationAnalyses)
          .set({
            migrationComplexity: JSON.stringify(validated),
            updatedAt: new Date(),
          })
          .where(eq(deepMigrationAnalyses.id, analysis.id));

        await db
          .update(backgroundJobs)
          .set({
            progress: 65,
            currentStep: 'Migration complexity complete',
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobRecord.id));

        console.log('[Inngest] Migration Complexity complete');
        return result;
      });

      // Step 5: Accessibility Audit (10-14 minutes)
      const accessibilityAudit = await step.run('accessibility-audit', async () => {
        console.log('[Inngest] Running Accessibility audit...');

        await db
          .update(backgroundJobs)
          .set({
            progress: 70,
            currentStep: 'Running accessibility audit',
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobRecord.id));

        const sampleUrls = contentArchitecture.pageTypes.flatMap(pt => pt.sampleUrls);

        const result = await auditAccessibility(
          bid.websiteUrl!,
          sampleUrls,
          (message) => console.log(`[Accessibility] ${message}`)
        );

        // SECURITY: Validate audit output against schema
        const validated = AccessibilityAuditSchema.parse(result);

        // Store intermediate result
        await db
          .update(deepMigrationAnalyses)
          .set({
            accessibilityAudit: JSON.stringify(validated),
            updatedAt: new Date(),
          })
          .where(eq(deepMigrationAnalyses.id, analysis.id));

        await db
          .update(backgroundJobs)
          .set({
            progress: 80,
            currentStep: 'Accessibility audit complete',
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobRecord.id));

        console.log('[Inngest] Accessibility audit complete');
        return result;
      });

      // Step 6: PT Estimation (1-3 minutes)
      const ptEstimation = await step.run('pt-estimation', async () => {
        console.log('[Inngest] Running PT estimation...');

        await db
          .update(backgroundJobs)
          .set({
            progress: 90,
            currentStep: 'Estimating project effort (PT)',
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobRecord.id));

        const result = await estimatePT({
          targetCMS: 'Drupal',
          businessUnitId: bid.assignedBusinessUnitId || undefined,
          contentTypeCount: contentArchitecture.contentTypeMapping.length,
          paragraphCount: contentArchitecture.paragraphEstimate,
          complexityScore: migrationComplexity.score,
          pageCount: contentArchitecture.totalPages,
        });

        // SECURITY: Validate PT estimation against schema
        const validated = PTEstimationSchema.parse(result);

        // Store final result
        await db
          .update(deepMigrationAnalyses)
          .set({
            ptEstimation: JSON.stringify(validated),
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(deepMigrationAnalyses.id, analysis.id));

        console.log('[Inngest] PT estimation complete');
        return result;
      });

      // Step 7: Update bid status and complete job
      await step.run('update-bid-status', async () => {
        await db
          .update(rfps)
          .set({
            deepMigrationAnalysisId: analysis.id,
            status: 'analysis_complete',
            updatedAt: new Date(),
          })
          .where(eq(rfps.id, bidId));

        // Mark job as completed
        await db
          .update(backgroundJobs)
          .set({
            status: 'completed',
            progress: 100,
            currentStep: 'Deep analysis completed successfully',
            result: JSON.stringify({
              analysisId: analysis.id,
              totalPages: contentArchitecture.totalPages,
              contentTypes: contentArchitecture.contentTypeMapping.length,
              totalHours: ptEstimation.totalHours,
            }),
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobRecord.id));

        // Cleanup checkpoint (or keep for debug based on env var)
        const keepForDebug = process.env.KEEP_CHECKPOINTS === 'true';
        await cleanupCheckpoint(workflowId, keepForDebug);

        console.log('[Inngest] Bid status updated to analysis_complete');
      });

      return {
        success: true,
        bidId,
        analysisId: analysis.id,
        jobId: jobRecord.id,
        message: 'Deep analysis completed successfully',
        summary: {
          totalPages: contentArchitecture.totalPages,
          contentTypes: contentArchitecture.contentTypeMapping.length,
          paragraphs: contentArchitecture.paragraphEstimate,
          complexityScore: migrationComplexity.score,
          accessibilityScore: accessibilityAudit.overallScore,
          totalHours: ptEstimation.totalHours,
          confidence: ptEstimation.confidence,
        },
      };
    } catch (error) {
      // Handle errors
      await step.run('handle-error', async () => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        console.error('[Inngest] Deep analysis failed:', {
          bidId,
          analysisId: analysis.id,
          jobId: jobRecord.id,
          error: errorMessage,
        });

        // Update analysis status to failed
        await db
          .update(deepMigrationAnalyses)
          .set({
            status: 'failed',
            errorMessage,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(deepMigrationAnalyses.id, analysis.id));

        // Update job status to failed
        await db
          .update(backgroundJobs)
          .set({
            status: 'failed',
            errorMessage,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(backgroundJobs.id, jobRecord.id));

        return { success: false };
      });

      // Re-throw to trigger Inngest retry mechanism
      throw error;
    }
  }
);
