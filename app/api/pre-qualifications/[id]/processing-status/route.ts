import { eq, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getPreQualProcessingJob } from '@/lib/bullmq/queues';
import { db } from '@/lib/db';
import { preQualifications } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Processing step configuration with progress ranges
 */
const STEP_CONFIG = {
  processing: { step: 'extracting', minProgress: 0, label: 'Verarbeitung gestartet...' },
  extracting: { step: 'extracting', minProgress: 10, label: 'Extrahiere Dokumente...' },
  duplicate_checking: { step: 'duplicate_checking', minProgress: 40, label: 'Prüfe auf Duplikate...' },
  duplicate_warning: { step: 'duplicate_checking', minProgress: 50, label: 'Duplikat gefunden' },
  quick_scanning: { step: 'scanning', minProgress: 60, label: 'Analysiere Anforderungen...' },
  reviewing: { step: 'complete', minProgress: 100, label: 'Bereit zur Überprüfung' },
  extraction_failed: { step: 'extracting', minProgress: 0, label: 'Extraktion fehlgeschlagen' },
} as const;

/**
 * Processing status response type
 */
interface ProcessingStatusResponse {
  step: 'extracting' | 'duplicate_checking' | 'scanning' | 'timeline' | 'complete';
  progress: number;
  currentTask: string;
  error?: string;
  isComplete: boolean;
  status: string;
}

/**
 * GET /api/pre-qualifications/[id]/processing-status
 *
 * Returns the current processing status for a PreQualification.
 * Used by the detail page to poll for updates during background processing.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse<ProcessingStatusResponse | { error: string }>> {
  // 1. Verify authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    // 2. Fetch PreQualification and verify ownership
    const [prequal] = await db
      .select()
      .from(preQualifications)
      .where(and(eq(preQualifications.id, id), eq(preQualifications.userId, session.user.id)));

    if (!prequal) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 3. Determine processing status
    const status = prequal.status;
    const config = STEP_CONFIG[status as keyof typeof STEP_CONFIG];

    // Check if processing is complete (not in a processing state)
    const processingStates = [
      'processing',
      'extracting',
      'duplicate_checking',
      'quick_scanning',
    ];
    const isProcessing = processingStates.includes(status);
    const hasError = status.includes('_failed') || status === 'duplicate_warning';

    // 4. Try to get more detailed progress from BullMQ job
    let jobProgress = 0;
    let jobError: string | undefined;

    try {
      const job = await getPreQualProcessingJob(id);
      if (job) {
        // Get job progress (0-100)
        const progress = job.progress;
        if (typeof progress === 'number') {
          jobProgress = progress;
        } else if (typeof progress === 'object' && progress !== null) {
          jobProgress = (progress as { progress?: number }).progress || 0;
        }

        // Check for job failure
        const state = await job.getState();
        if (state === 'failed') {
          jobError = job.failedReason || 'Verarbeitung fehlgeschlagen';
        }
      }
    } catch {
      // BullMQ job not found or error - use DB status only
    }

    // 5. Parse agent errors if present
    if (prequal.agentErrors && !jobError) {
      try {
        const errors = JSON.parse(prequal.agentErrors) as Array<{ error: string }>;
        if (errors.length > 0) {
          jobError = errors[errors.length - 1].error;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // 6. Calculate final progress
    const baseProgress = config?.minProgress || 0;
    const progress = Math.max(baseProgress, jobProgress);

    // 7. Build response
    const response: ProcessingStatusResponse = {
      step: config?.step || 'extracting',
      progress,
      currentTask: config?.label || `Status: ${status}`,
      isComplete: !isProcessing && !hasError,
      status,
    };

    if (jobError || hasError) {
      response.error = jobError || `Fehler im Status: ${status}`;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Processing Status API] Error:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abrufen des Status' },
      { status: 500 }
    );
  }
}
