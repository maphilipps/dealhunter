import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { db } from '../lib/db';
import { analyses } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  'analysis',
  async (job) => {
    const { analysisId } = job.data;

    console.log(`Processing analysis ${analysisId}`);

    // Update status to discovering
    await db
      .update(analyses)
      .set({
        status: 'discovering',
        currentPhase: 'discovery',
        progress: 5,
      })
      .where(eq(analyses.id, analysisId));

    // Simulate analysis phases (in real implementation, agents would do the work)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await db
      .update(analyses)
      .set({
        currentPhase: 'crawling',
        progress: 20,
      })
      .where(eq(analyses.id, analysisId));

    await new Promise((resolve) => setTimeout(resolve, 2000));

    await db
      .update(analyses)
      .set({
        currentPhase: 'detecting',
        progress: 40,
      })
      .where(eq(analyses.id, analysisId));

    await new Promise((resolve) => setTimeout(resolve, 2000));

    await db
      .update(analyses)
      .set({
        currentPhase: 'analyzing',
        progress: 60,
      })
      .where(eq(analyses.id, analysisId));

    await new Promise((resolve) => setTimeout(resolve, 2000));

    await db
      .update(analyses)
      .set({
        currentPhase: 'generating',
        progress: 80,
      })
      .where(eq(analyses.id, analysisId));

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Complete analysis
    await db
      .update(analyses)
      .set({
        status: 'completed',
        progress: 100,
        currentPhase: 'completed',
        leadScore: Math.floor(Math.random() * 40) + 60, // Random score 60-100 for demo
        maturityLevel: ['emerging', 'growing', 'mature', 'leader'][
          Math.floor(Math.random() * 4)
        ],
        completedAt: new Date(),
      })
      .where(eq(analyses.id, analysisId));

    console.log(`Analysis ${analysisId} completed`);
  },
  {
    connection,
    concurrency: 5,
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

process.on('SIGTERM', async () => {
  await worker.close();
});
