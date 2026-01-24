/**
 * Sprint 4.2: Multi-Job SSE Stream API
 *
 * GET /api/jobs/stream?ids=job1,job2,job3
 * Returns Server-Sent Events stream for multiple job progress updates.
 */

import { inArray } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { backgroundJobs } from '@/lib/db/schema';
import { createMultiJobStream } from '@/lib/realtime/event-stream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // SSE requires Node.js runtime

/**
 * GET /api/jobs/stream?ids=job1,job2,job3
 *
 * Returns real-time progress for multiple jobs via Server-Sent Events.
 * Useful for monitoring dashboards that track multiple background jobs.
 *
 * @example
 * ```typescript
 * const eventSource = new EventSource('/api/jobs/stream?ids=abc123,def456,ghi789');
 *
 * eventSource.addEventListener('progress', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log(`Job ${data.jobId}: ${data.progress}%`);
 * });
 *
 * eventSource.addEventListener('complete', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log(`Job ${data.jobId} completed`);
 * });
 * ```
 */
export async function GET(request: NextRequest) {
  // Authenticate user
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse job IDs from query parameter
  const searchParams = request.nextUrl.searchParams;
  const idsParam = searchParams.get('ids');

  if (!idsParam) {
    return new Response(JSON.stringify({ error: 'Missing ids query parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const jobIds = idsParam
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  if (jobIds.length === 0) {
    return new Response(JSON.stringify({ error: 'No valid job IDs provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify all jobs exist and user has access
  const jobs = await db.select().from(backgroundJobs).where(inArray(backgroundJobs.id, jobIds));

  if (jobs.length === 0) {
    return new Response(JSON.stringify({ error: 'No jobs found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Authorization: Verify user owns all jobs
  const unauthorizedJobs = jobs.filter(job => job.userId !== session.user.id);
  if (unauthorizedJobs.length > 0) {
    return new Response(
      JSON.stringify({
        error: 'Access denied',
        details: `No access to ${unauthorizedJobs.length} job(s)`,
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Create multi-job SSE stream
  const stream = createMultiJobStream(jobIds);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
