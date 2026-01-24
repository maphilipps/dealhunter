/**
 * Sprint 4.2: SSE Job Progress Stream API
 *
 * GET /api/jobs/[id]/stream
 * Returns Server-Sent Events stream for job progress updates.
 */

import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { backgroundJobs } from '@/lib/db/schema';
import { createJobProgressStream } from '@/lib/realtime/event-stream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // SSE requires Node.js runtime

/**
 * GET /api/jobs/[id]/stream
 *
 * Returns real-time job progress via Server-Sent Events.
 *
 * @example
 * ```typescript
 * const eventSource = new EventSource('/api/jobs/abc123/stream');
 *
 * eventSource.addEventListener('progress', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log('Progress:', data.progress);
 * });
 *
 * eventSource.addEventListener('complete', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log('Completed:', data.result);
 *   eventSource.close();
 * });
 * ```
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params;

  // Authenticate user
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify job exists and user has access
  const [job] = await db.select().from(backgroundJobs).where(eq(backgroundJobs.id, jobId)).limit(1);

  if (!job) {
    return new Response(JSON.stringify({ error: 'Job not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Authorization: Verify user owns this job
  if (job.userId !== session.user.id) {
    return new Response(JSON.stringify({ error: 'Access denied' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create SSE stream
  const stream = createJobProgressStream(jobId);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
