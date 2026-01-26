import { db } from '../lib/db';
import { backgroundJobs } from '../lib/db/schema';
import { desc, eq } from 'drizzle-orm';

async function main() {
  const jobs = await db
    .select()
    .from(backgroundJobs)
    .where(eq(backgroundJobs.status, 'failed'))
    .orderBy(desc(backgroundJobs.createdAt))
    .limit(1);

  if (jobs.length === 0) {
    console.log('No failed jobs found');
    process.exit(0);
  }

  const job = jobs[0];
  console.log('=== Latest Failed Job ===\n');
  console.log(`ID: ${job.id}`);
  console.log(`Type: ${job.jobType}`);
  console.log(`Created: ${job.createdAt?.toISOString()}`);
  console.log(`Failed: ${job.completedAt?.toISOString()}`);
  console.log(`Progress: ${job.progress}%`);
  console.log(`Current Step: ${job.currentStep}`);
  console.log(`\nERROR MESSAGE:`);
  console.log(job.errorMessage);

  if (job.result) {
    console.log(`\n\nRESULT:`);
    console.log(JSON.stringify(JSON.parse(job.result as string), null, 2));
  }

  process.exit(0);
}

main().catch(console.error);
