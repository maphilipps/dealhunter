import { eq, or } from 'drizzle-orm';
import { db } from '../lib/db';
import { backgroundJobs } from '../lib/db/schema';

async function checkJob() {
  const qualId = 'pbfognaz7y48hsw3pk7cytg5';

  const jobs = await db
    .select()
    .from(backgroundJobs)
    .where(or(eq(backgroundJobs.pitchId, qualId), eq(backgroundJobs.preQualificationId, qualId)))
    .orderBy(backgroundJobs.createdAt)
    .limit(10);

  console.log('\n=== Background Jobs ===');
  console.log(JSON.stringify(jobs, null, 2));

  process.exit(0);
}

checkJob().catch(console.error);
