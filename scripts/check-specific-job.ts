import { db } from '../lib/db';
import { backgroundJobs } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const jobId = process.argv[2];
  if (!jobId) {
    console.error('Usage: npx tsx scripts/check-specific-job.ts <job-id>');
    process.exit(1);
  }

  const jobs = await db.select().from(backgroundJobs).where(eq(backgroundJobs.id, jobId));

  if (jobs.length === 0) {
    console.log(`Job ${jobId} not found`);
    process.exit(0);
  }

  const job = jobs[0];
  console.log('=== Job Details ===\n');
  console.log(`ID: ${job.id}`);
  console.log(`Type: ${job.jobType}`);
  console.log(`Status: ${job.status}`);
  console.log(`Created: ${job.createdAt?.toISOString()}`);
  console.log(`Updated: ${job.updatedAt?.toISOString()}`);
  console.log(`Completed: ${job.completedAt?.toISOString() || 'N/A'}`);
  console.log(`Progress: ${job.progress}%`);
  console.log(`Current Step: ${job.currentStep || 'N/A'}`);

  if (job.errorMessage) {
    console.log(`\nERROR MESSAGE:`);
    console.log(job.errorMessage);
  }

  if (job.result) {
    console.log(`\n\nRESULT:`);
    console.log(JSON.stringify(JSON.parse(job.result as string), null, 2));
  }

  process.exit(0);
}

main().catch(console.error);
