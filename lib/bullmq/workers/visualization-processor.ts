import type { Job } from 'bullmq';
import { and, eq, sql } from 'drizzle-orm';

import { db } from '../../db';
import { backgroundJobs, dealEmbeddings, pitches } from '../../db/schema';
import { generateSectionVisualization } from '../../json-render/section-visualization-agent';
import { QUALIFICATION_NAVIGATION_SECTIONS } from '../../pitches/navigation-config';
import type { VisualizationJobData, VisualizationJobResult } from '../queues';

/**
 * Process a visualization generation job
 *
 * Generates visualizations for sections that have RAG data but no visualization.
 */
export async function processVisualizationJob(
  job: Job<VisualizationJobData, VisualizationJobResult, string>
): Promise<VisualizationJobResult> {
  const { pitchId, sectionIds, dbJobId, focusPrompt, userId } = job.data;

  console.log(`[VisualizationProcessor] Starting job ${job.id} for qualification ${pitchId}`);

  try {
    // Update job status to running
    await db
      .update(backgroundJobs)
      .set({
        status: 'running',
        startedAt: new Date(),
        progress: 0,
      })
      .where(eq(backgroundJobs.id, dbJobId));

    // Get qualification with project context
    const qualification = await db.query.pitches.findFirst({
      where: eq(pitches.id, pitchId),
    });

    if (!qualification) {
      throw new Error('Qualification not found');
    }

    // Determine which sections to process
    const sectionsToProcess = sectionIds;

    if (sectionsToProcess.length === 0) {
      // Find all sections with RAG data but no visualization
      const allSectionIds = QUALIFICATION_NAVIGATION_SECTIONS.flatMap(section => {
        const ids = [section.id];
        if (section.subsections) {
          ids.push(...section.subsections.map(sub => sub.id));
        }
        return ids;
      }).filter(id => id !== 'overview' && id !== 'executive-summary');

      for (const sectionId of allSectionIds) {
        const hasRagData = await db.query.dealEmbeddings.findFirst({
          where: and(
            eq(dealEmbeddings.pitchId, pitchId),
            sql`(metadata::jsonb)->>'sectionId' = ${sectionId}`,
            sql`chunk_type != 'visualization'`
          ),
        });

        if (!hasRagData) continue;

        const hasVisualization = await db.query.dealEmbeddings.findFirst({
          where: and(
            eq(dealEmbeddings.pitchId, pitchId),
            eq(dealEmbeddings.chunkType, 'visualization'),
            sql`(metadata::jsonb)->>'sectionId' = ${sectionId}`
          ),
        });

        if (!hasVisualization) {
          sectionsToProcess.push(sectionId);
        }
      }
    }

    if (sectionsToProcess.length === 0) {
      // No sections need visualization
      await db
        .update(backgroundJobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          progress: 100,
          result: JSON.stringify({
            success: true,
            generated: 0,
            total: 0,
            message: 'Alle Sektionen haben bereits Visualisierungen',
          }),
        })
        .where(eq(backgroundJobs.id, dbJobId));

      return {
        success: true,
        generated: 0,
        total: 0,
        sections: [],
      };
    }

    // Build project context
    const projectContext = {
      customerName: qualification.customerName,
      websiteUrl: qualification.websiteUrl,
      industry: qualification.industry,
      projectDescription: qualification.projectDescription,
    };

    // Process each section
    const results: Array<{ sectionId: string; success: boolean; error?: string }> = [];
    let completed = 0;

    for (const sectionId of sectionsToProcess) {
      try {
        // Get RAG chunks for this section
        const ragChunks = await db.query.dealEmbeddings.findMany({
          where: and(
            eq(dealEmbeddings.pitchId, pitchId),
            sql`(metadata::jsonb)->>'sectionId' = ${sectionId}`,
            sql`chunk_type != 'visualization'`
          ),
          orderBy: (embeddings, { desc }) => [desc(embeddings.confidence)],
          limit: 20,
        });

        if (ragChunks.length === 0) {
          results.push({ sectionId, success: false, error: 'No RAG data' });
          continue;
        }

        const result = await generateSectionVisualization({
          pitchId,
          sectionId,
          ragChunks: ragChunks.map(chunk => ({
            content: chunk.content,
            confidence: chunk.confidence ?? 50,
            chunkType: chunk.chunkType ?? 'finding',
            agentName: chunk.agentName ?? 'unknown',
          })),
          projectContext,
          refinementPrompt: focusPrompt,
        });

        results.push({
          sectionId,
          success: result.success,
          error: result.error,
        });

        completed++;

        // Update progress
        const progress = Math.round((completed / sectionsToProcess.length) * 100);
        await db.update(backgroundJobs).set({ progress }).where(eq(backgroundJobs.id, dbJobId));

        // Update job progress for BullMQ
        await job.updateProgress(progress);
      } catch (error) {
        results.push({
          sectionId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        completed++;
      }
    }

    const successCount = results.filter(r => r.success).length;

    // Update job as completed
    await db
      .update(backgroundJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        progress: 100,
        result: JSON.stringify({
          success: true,
          generated: successCount,
          total: sectionsToProcess.length,
          sections: results,
        }),
      })
      .where(eq(backgroundJobs.id, dbJobId));

    console.log(
      `[VisualizationProcessor] Job ${job.id} completed: ${successCount}/${sectionsToProcess.length} visualizations generated`
    );

    return {
      success: true,
      generated: successCount,
      total: sectionsToProcess.length,
      sections: results,
    };
  } catch (error) {
    console.error(`[VisualizationProcessor] Job ${job.id} failed:`, error);

    // Update job as failed
    await db
      .update(backgroundJobs)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })
      .where(eq(backgroundJobs.id, dbJobId));

    return {
      success: false,
      generated: 0,
      total: 0,
      sections: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
