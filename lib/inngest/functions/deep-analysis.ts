import { inngest } from '../client';
import { db } from '@/lib/db';
import { deepMigrationAnalyses, rfps, quickScans } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
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

/**
 * Deep Migration Analysis Background Job
 * Runs 4 analysis agents in sequence: Content Architecture → Migration Complexity → Accessibility → PT Estimation
 * Expected duration: 25-30 minutes
 */
export const deepAnalysisFunction = inngest.createFunction(
  {
    id: 'deep-analysis-run',
    name: 'Deep Migration Analysis',
    retries: 2,
  },
  { event: 'deep-analysis.run' },
  async ({ event, step }) => {
    const { bidId, userId } = event.data;

    // Step 1: Fetch bid data and create analysis record
    const { bid, analysis, quickScan } = await step.run('init-analysis', async () => {
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

      return {
        bid: bidData,
        quickScan: quickScanData,
        analysis: analysisRecord,
      };
    });

    try {
      // Step 2: Content Architecture Analysis (6-10 minutes)
      const contentArchitecture = await step.run('content-architecture', async () => {
        console.log('[Inngest] Running Content Architecture analysis...');

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

        console.log('[Inngest] Content Architecture complete');
        return result;
      });

      // Step 3: Migration Complexity Scoring (4-6 minutes)
      const migrationComplexity = await step.run('migration-complexity', async () => {
        console.log('[Inngest] Running Migration Complexity analysis...');

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

        console.log('[Inngest] Migration Complexity complete');
        return result;
      });

      // Step 4: Accessibility Audit (10-14 minutes)
      const accessibilityAudit = await step.run('accessibility-audit', async () => {
        console.log('[Inngest] Running Accessibility audit...');

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

        console.log('[Inngest] Accessibility audit complete');
        return result;
      });

      // Step 5: PT Estimation (1-3 minutes)
      const ptEstimation = await step.run('pt-estimation', async () => {
        console.log('[Inngest] Running PT estimation...');

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

      // Step 6: Update bid status
      await step.run('update-bid-status', async () => {
        await db
          .update(rfps)
          .set({
            deepMigrationAnalysisId: analysis.id,
            status: 'analysis_complete',
            updatedAt: new Date(),
          })
          .where(eq(rfps.id, bidId));

        console.log('[Inngest] Bid status updated to analysis_complete');
      });

      return {
        success: true,
        bidId,
        analysisId: analysis.id,
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

        return { success: false };
      });

      // Re-throw to trigger Inngest retry mechanism
      throw error;
    }
  }
);
