import { db } from '../lib/db';
import { backgroundJobs } from '../lib/db/schema';
import { desc } from 'drizzle-orm';

async function main() {
  const jobs = await db
    .select()
    .from(backgroundJobs)
    .orderBy(desc(backgroundJobs.createdAt))
    .limit(5);

  console.log('=== Recent Background Jobs ===\n');
  jobs.forEach((job, idx) => {
    console.log(`[${idx + 1}] ${job.jobType} - ${job.status}`);
    console.log(`  ID: ${job.id}`);
    console.log(`  Progress: ${job.progress}%`);
    console.log(`  Current: ${job.currentStep || 'N/A'}`);
    console.log(`  Created: ${job.createdAt?.toISOString()}`);
    console.log(`  Updated: ${job.updatedAt?.toISOString()}`);
    if (job.errorMessage) {
      console.log(`  ERROR: ${job.errorMessage.slice(0, 150)}`);
    }
    console.log('');
  });

  process.exit(0);
}

main().catch(console.error);
