import { eq, and, desc } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { backgroundJobs, preQualifications } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Processing step configuration with progress ranges
 */
const STEP_CONFIG = {
  processing: { step: 'extracting', minProgress: 0, label: 'Verarbeitung gestartet...' },
  extracting: { step: 'extracting', minProgress: 10, label: 'Extrahiere Dokumente...' },
  duplicate_checking: {
    step: 'duplicate_checking',
    minProgress: 40,
    label: 'Prüfe auf Duplikate...',
  },
  duplicate_warning: { step: 'duplicate_checking', minProgress: 50, label: 'Duplikat gefunden' },
  qualification_scanning: {
    step: 'scanning',
    minProgress: 60,
    label: 'Analysiere Anforderungen...',
  },
  reviewing: { step: 'complete', minProgress: 100, label: 'Bereit zur Überprüfung' },
  extraction_failed: { step: 'extracting', minProgress: 0, label: 'Extraktion fehlgeschlagen' },
} as const;

/**
 * Processing status response type
 */
interface ProcessingStatusResponse {
  step: 'extracting' | 'duplicate_checking' | 'scanning' | 'questions' | 'sections' | 'complete';
  progress: number;
  currentTask: string;
  error?: string;
  isComplete: boolean;
  status: string;
}

/**
 * GET /api/qualifications/[id]/processing-status
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
      'qualification_scanning',
    ];
    const isProcessing = processingStates.includes(status);
    const hasError = status.includes('_failed') || status === 'duplicate_warning';

    // 4. Try to get more detailed progress from Qualification job
    const [qualificationJob] = await db
      .select()
      .from(backgroundJobs)
      .where(
        and(eq(backgroundJobs.preQualificationId, id), eq(backgroundJobs.jobType, 'qualification'))
      )
      .orderBy(desc(backgroundJobs.createdAt))
      .limit(1);

    const jobProgress = qualificationJob?.progress ?? 0;
    let jobError = qualificationJob?.errorMessage ?? undefined;
    const jobStepLabel = qualificationJob?.currentStep ?? null;

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
    let step: ProcessingStatusResponse['step'] = config?.step || 'extracting';
    if (qualificationJob) {
      if (progress >= 90) step = 'sections';
      else if (progress >= 80) step = 'questions';
      else if (progress >= 60) step = 'scanning';
      else if (progress >= 40) step = 'duplicate_checking';
      else step = 'extracting';
    }

    const response: ProcessingStatusResponse = {
      step,
      progress,
      currentTask: jobStepLabel || config?.label || `Status: ${status}`,
      isComplete: qualificationJob
        ? qualificationJob.status === 'completed'
        : !isProcessing && !hasError,
      status,
    };

    if (jobError || hasError) {
      response.error = jobError || `Fehler im Status: ${status}`;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Processing Status API] Error:', error);
    return NextResponse.json({ error: 'Fehler beim Abrufen des Status' }, { status: 500 });
  }
}
