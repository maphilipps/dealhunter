import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { backgroundJobs } from '@/lib/db/schema';

/**
 * GET /api/jobs/:id/progress - SSE stream for job progress updates
 *
 * Usage:
 * const eventSource = new EventSource('/api/jobs/abc123/progress');
 * eventSource.onmessage = (event) => {
 *   const data = JSON.parse(event.data);
 *   console.log(data.progress, data.currentStep);
 * };
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { id } = await params;

    // Verify job exists and user has access
    const [job] = await db.select().from(backgroundJobs).where(eq(backgroundJobs.id, id)).limit(1);

    if (!job) {
      return new Response('Job not found', { status: 404 });
    }

    if (job.userId !== session.user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Helper to send SSE message
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        // Poll for updates every 1 second
        const pollInterval = setInterval(async () => {
          try {
            const [currentJob] = await db
              .select()
              .from(backgroundJobs)
              .where(eq(backgroundJobs.id, id))
              .limit(1);

            if (!currentJob) {
              clearInterval(pollInterval);
              controller.close();
              return;
            }

            // Send current status
            send({
              id: currentJob.id,
              jobType: currentJob.jobType,
              status: currentJob.status,
              progress: currentJob.progress,
              currentStep: currentJob.currentStep,
              errorMessage: currentJob.errorMessage,
              updatedAt: currentJob.updatedAt,
            });

            // Close stream if job is done
            if (
              currentJob.status === 'completed' ||
              currentJob.status === 'failed' ||
              currentJob.status === 'cancelled'
            ) {
              clearInterval(pollInterval);
              // Send final message
              send({
                ...currentJob,
                done: true,
              });
              controller.close();
            }
          } catch (error) {
            console.error('Error polling job status:', error);
            clearInterval(pollInterval);
            controller.error(error);
          }
        }, 1000);

        // Cleanup on client disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(pollInterval);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error creating SSE stream:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
