/**
 * Script to retrigger a PreQualification processing job
 * Usage: npx tsx scripts/retrigger-prequal.ts <preQualificationId>
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';

import { backgroundJobs, preQualifications, documents } from '../lib/db/schema';
import { addPreQualProcessingJob } from '../lib/bullmq/queues';

async function retriggerPreQual(preQualId: string) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const db = drizzle(pool);

  console.log(`\n[Retrigger] Looking up PreQualification ${preQualId}...`);

  // Get the PreQualification
  const preQual = await db
    .select()
    .from(preQualifications)
    .where(eq(preQualifications.id, preQualId))
    .limit(1);

  if (!preQual.length) {
    console.error(`[Retrigger] PreQualification ${preQualId} not found!`);
    process.exit(1);
  }

  const pq = preQual[0];
  console.log(`[Retrigger] Found: ${pq.id} (Status: ${pq.status})`);

  // Get associated documents
  const docs = await db.select().from(documents).where(eq(documents.preQualificationId, preQualId));

  console.log(`[Retrigger] Found ${docs.length} documents`);

  // Create background job
  const [qualificationJob] = await db
    .insert(backgroundJobs)
    .values({
      userId: pq.userId,
      jobType: 'qualification',
      status: 'pending',
      preQualificationId: preQualId,
    })
    .returning();

  console.log(`[Retrigger] Created background job: ${qualificationJob.id}`);

  // Prepare file data (re-read from stored documents)
  const files = docs
    .filter(d => d.fileData)
    .map(d => ({
      name: d.fileName,
      base64: d.fileData,
      size: d.fileSize,
    }));

  console.log(`[Retrigger] Prepared ${files.length} files for processing`);

  // Reset status to processing
  await db
    .update(preQualifications)
    .set({
      status: 'processing',
      updatedAt: new Date(),
    })
    .where(eq(preQualifications.id, preQualId));

  // Add job to queue
  const bullmqJob = await addPreQualProcessingJob({
    preQualificationId: preQualId,
    userId: pq.userId,
    backgroundJobId: qualificationJob.id,
    files,
    websiteUrls: pq.websiteUrl ? [pq.websiteUrl] : [],
    additionalText: '',
    enableDSGVO: true,
  });

  console.log(`[Retrigger] Job added to queue: ${bullmqJob.id}`);
  console.log(`[Retrigger] Done! Watch the worker logs for progress.\n`);

  await pool.end();
}

// Main
const preQualId = process.argv[2];
if (!preQualId) {
  console.error('Usage: npx tsx scripts/retrigger-prequal.ts <preQualificationId>');
  process.exit(1);
}

retriggerPreQual(preQualId).catch(err => {
  console.error('[Retrigger] Error:', err);
  process.exit(1);
});
