import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  FileText,
  Target,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { BidDetailClient } from '@/components/bids/bid-detail-client';
import { RunExpertAgentsButton } from '@/components/rfps/run-expert-agents-button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getAgentResult, hasExpertAgentResults } from '@/lib/agents/expert-agents';
import type { ManagementSummary } from '@/lib/agents/expert-agents/summary-schema';
import { auth } from '@/lib/auth';
import { getCachedRfp } from '@/lib/rfps/cached-queries';

export default async function BidDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get bid opportunity (cached - shares query with layout)
  const bid = await getCachedRfp(id);

  if (!bid) {
    notFound();
  }

  // Check ownership
  if (bid.userId !== session.user.id) {
    notFound();
  }

  // Check for expert agent results
  const hasResults = await hasExpertAgentResults(id);
  const summaryResult = hasResults ? await getAgentResult(id, 'summary_expert') : null;

  // Parse summary if available
  let summary: ManagementSummary | null = null;
  if (summaryResult?.metadata) {
    // The metadata contains the key fields we need
    summary = summaryResult.metadata as unknown as ManagementSummary;
  }

  return (
    <div className="space-y-6">
      {/* Header with Action */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {summary?.headline || 'RFP Übersicht'}
          </h1>
          <p className="text-muted-foreground">ID: {bid.id}</p>
        </div>
        <RunExpertAgentsButton rfpId={id} hasResults={hasResults} />
      </div>

      {/* Expert Analysis Not Run Yet */}
      {!hasResults && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Expert-Analyse ausstehend</AlertTitle>
          <AlertDescription>
            Klicke auf &quot;Expert-Analyse starten&quot; um detaillierte Insights zu Timing,
            Deliverables, Tech Stack und Legal zu erhalten.
          </AlertDescription>
        </Alert>
      )}

      {/* Management Summary (if available) */}
      {summary && (
        <>
          {/* Executive Summary */}
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

          {/* Top Deliverables & Timeline */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Top Deliverables */}
            {summary.topDeliverables && summary.topDeliverables.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    Top Deliverables
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {summary.topDeliverables.map((d, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        {d.mandatory ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span>{d.name}</span>
                        {d.mandatory && (
                          <Badge variant="outline" className="text-xs">
                            Pflicht
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Timeline Highlights */}
            {summary.timelineHighlights && summary.timelineHighlights.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calendar className="h-4 w-4" />
                    Timeline Highlights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {summary.timelineHighlights.map((t, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span>{t.milestone}</span>
                        <Badge variant="secondary">{t.date}</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Risks & Opportunities */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Top Risks */}
            {summary.topRisks && summary.topRisks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    Top Risiken
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {summary.topRisks.map((r, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        • {r}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Top Opportunities */}
            {summary.topOpportunities && summary.topOpportunities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    Top Chancen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {summary.topOpportunities.map((o, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        • {o}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Status</CardTitle>
            <StatusBadge status={bid.status} />
          </div>
          <CardDescription>
            Erstellt am{' '}
            {bid.createdAt ? new Date(bid.createdAt).toLocaleDateString('de-DE') : 'Unbekannt'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Quelle</p>
              <p className="font-medium">{bid.source === 'reactive' ? 'Reaktiv' : 'Proaktiv'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phase</p>
              <p className="font-medium">
                {bid.stage === 'cold' && 'Cold'}
                {bid.stage === 'warm' && 'Warm'}
                {bid.stage === 'rfp' && 'RFP'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Eingabetyp</p>
              <p className="font-medium">
                {bid.inputType === 'pdf' && 'PDF Upload'}
                {bid.inputType === 'email' && 'E-Mail'}
                {bid.inputType === 'freetext' && 'Texteingabe'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Component for Interactive Features */}
      <BidDetailClient bid={bid} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    // Initial & Extraction
    draft: { label: 'Entwurf', variant: 'secondary' as const },
    extracting: { label: 'Extraktion läuft', variant: 'default' as const },
    reviewing: { label: 'Wird geprüft', variant: 'default' as const },
    // Evaluation
    quick_scanning: { label: 'Quick Scan', variant: 'default' as const },
    evaluating: { label: 'Wird bewertet', variant: 'default' as const },
    decision_made: { label: 'Entschieden', variant: 'default' as const },
    // NO BIT Path
    archived: { label: 'Archiviert', variant: 'outline' as const },
    // BIT Path
    routed: { label: 'Weitergeleitet', variant: 'default' as const },
    full_scanning: { label: 'Deep Analysis', variant: 'default' as const },
    bl_reviewing: { label: 'BL-Review', variant: 'default' as const },
    team_assigned: { label: 'Team zugewiesen', variant: 'default' as const },
    notified: { label: 'Team benachrichtigt', variant: 'default' as const },
    handed_off: { label: 'Abgeschlossen', variant: 'default' as const },
    // Legacy
    analysis_complete: { label: 'Analyse fertig', variant: 'default' as const },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    variant: 'secondary' as const,
  };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
