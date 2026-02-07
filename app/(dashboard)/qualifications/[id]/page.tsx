import { notFound, redirect } from 'next/navigation';

import { ProcessingProgressCard } from '@/components/bids/processing-progress-card';
import { DashboardPDFExport, QualificationDashboard } from '@/components/dashboard';
import { ExportButton } from '@/components/qualification-scan/export-button';
import { DeleteQualificationButton } from '@/components/qualifications/delete-qualification-button';
import { getAgentResult, hasExpertAgentResults } from '@/lib/agents/expert-agents';
import type { ManagementSummary } from '@/lib/agents/expert-agents/summary-schema';
import { auth } from '@/lib/auth';
import { getCachedPreQualificationWithRelations } from '@/lib/qualifications/cached-queries';
import { isProcessingState } from '@/lib/qualifications/constants';

export default async function QualificationOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get qualification data (cached - shares query with layout)
  const { preQualification, qualificationScan } = await getCachedPreQualificationWithRelations(id);

  if (!preQualification) {
    notFound();
  }

  // Check ownership
  if (preQualification.userId !== session.user.id) {
    notFound();
  }

  // Check for expert agent results (optional summary)
  const hasResults = await hasExpertAgentResults(id);
  const summaryResult = hasResults ? await getAgentResult(id, 'summary_expert') : null;

  // Parse summary if available
  let summary: ManagementSummary | null = null;
  if (summaryResult?.metadata) {
    summary = summaryResult.metadata as unknown as ManagementSummary;
  }

  const isProcessing = isProcessingState(preQualification.status);
  const isScanCompleted =
    preQualification.status === 'completed' && qualificationScan?.status === 'completed';
  const deleteLabel = summary?.headline || preQualification.id;

  return (
    <div className="space-y-6">
      {/* Header with Action */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {summary?.headline || 'Lead Übersicht'}
          </h1>
          {summary?.keyFacts.customer && (
            <p className="mt-1 text-muted-foreground">{summary.keyFacts.customer}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isScanCompleted && <ExportButton qualificationId={id} />}
          {isScanCompleted && <DashboardPDFExport />}
          <DeleteQualificationButton preQualificationId={id} label={deleteLabel} />
        </div>
      </div>

      {/* Processing Progress (shown during processing) */}
      {isProcessing && <ProcessingProgressCard bidId={preQualification.id} />}

      {/* Dashboard Content */}
      {!isProcessing && <QualificationDashboard preQualificationId={id} initialSummary={summary} />}
    </div>
  );
}
