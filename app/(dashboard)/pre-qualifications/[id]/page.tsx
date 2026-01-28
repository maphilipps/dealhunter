import { Calendar, Target } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { ProcessingProgressCard } from '@/components/bids/processing-progress-card';
import { DeletePreQualificationButton } from '@/components/pre-qualifications/delete-prequalification-button';
import { QuickScanSummaryGrid } from '@/components/pre-qualifications/management-summary';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getAgentResult, hasExpertAgentResults } from '@/lib/agents/expert-agents';
import type { ManagementSummary } from '@/lib/agents/expert-agents/summary-schema';
import { auth } from '@/lib/auth';
import { getCachedPreQualificationWithRelations } from '@/lib/pre-qualifications/cached-queries';

const PROCESSING_STATES = ['processing', 'extracting', 'quick_scanning', 'duplicate_warning'];

export default async function BidDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get bid opportunity with quick scan data (cached - shares query with layout)
  const { preQualification: bid, quickScan } = await getCachedPreQualificationWithRelations(id);

  if (!bid) {
    notFound();
  }

  // Check ownership
  if (bid.userId !== session.user.id) {
    notFound();
  }

  // Check for expert agent results (optional summary)
  const hasResults = await hasExpertAgentResults(id);
  const summaryResult = hasResults ? await getAgentResult(id, 'summary_expert') : null;

  // Parse summary if available
  let summary: ManagementSummary | null = null;
  if (summaryResult?.metadata) {
    // The metadata contains the key fields we need
    summary = summaryResult.metadata as unknown as ManagementSummary;
  }
  const deleteLabel = summary?.headline || bid.id;

  return (
    <div className="space-y-6">
      {/* Header with Action */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {summary?.headline || 'Lead Übersicht'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <DeletePreQualificationButton preQualificationId={id} label={deleteLabel} />
        </div>
      </div>

      {/* Management Summary (if available) */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Management Summary
            </CardTitle>
            <CardDescription>{summary.executiveSummary}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Assessment */}
              <div className="space-y-4">
                <h4 className="font-semibold">Bewertung</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Fit Score</span>
                    <span className="font-medium">{summary.assessment.fitScore}/10</span>
                  </div>
                  <Progress value={summary.assessment.fitScore * 10} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Komplexität</span>
                    <span className="font-medium">{summary.assessment.complexityScore}/10</span>
                  </div>
                  <Progress value={summary.assessment.complexityScore * 10} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Empfehlung:</span>
                  <Badge
                    variant={
                      summary.assessment.recommendation === 'pursue'
                        ? 'default'
                        : summary.assessment.recommendation === 'consider'
                          ? 'secondary'
                          : 'destructive'
                    }
                  >
                    {summary.assessment.recommendation === 'pursue' && 'Verfolgen'}
                    {summary.assessment.recommendation === 'consider' && 'Prüfen'}
                    {summary.assessment.recommendation === 'decline' && 'Ablehnen'}
                  </Badge>
                  <Badge
                    variant={
                      summary.assessment.urgencyLevel === 'critical'
                        ? 'destructive'
                        : summary.assessment.urgencyLevel === 'high'
                          ? 'default'
                          : 'secondary'
                    }
                  >
                    {summary.assessment.urgencyLevel === 'critical' && '🔴 Kritisch'}
                    {summary.assessment.urgencyLevel === 'high' && '🟠 Hoch'}
                    {summary.assessment.urgencyLevel === 'medium' && '🟡 Mittel'}
                    {summary.assessment.urgencyLevel === 'low' && '🟢 Niedrig'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{summary.assessment.reasoning}</p>
              </div>

              {/* Key Facts */}
              <div className="space-y-4">
                <h4 className="font-semibold">Key Facts</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kunde</span>
                    <span className="font-medium">{summary.keyFacts.customer}</span>
                  </div>
                  {summary.keyFacts.industry && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Branche</span>
                      <span>{summary.keyFacts.industry}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Projekttyp</span>
                    <span>{summary.keyFacts.projectType}</span>
                  </div>
                  {summary.keyFacts.submissionDeadline && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Deadline</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {summary.keyFacts.submissionDeadline}
                        {summary.keyFacts.daysRemaining !== undefined && (
                          <Badge variant="outline" className="ml-1">
                            {summary.keyFacts.daysRemaining} Tage
                          </Badge>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick-Scan Summary Grid */}
      <QuickScanSummaryGrid preQualificationId={id} quickScan={quickScan} />

      {/* Processing Progress (must remain visible) */}
      {PROCESSING_STATES.includes(bid.status) && <ProcessingProgressCard bidId={bid.id} />}
    </div>
  );
}
