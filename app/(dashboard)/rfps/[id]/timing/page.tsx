import { AlertCircle, Calendar, Clock } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { auth } from '@/lib/auth';
import { getCachedRfpWithRelations } from '@/lib/rfps/cached-queries';
import { parseJsonField } from '@/lib/utils/json';
import type { ProjectTimeline } from '@/lib/timeline/schema';

export default async function TimingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get RFP with relations (cached and parallelized)
  const { rfp, quickScan } = await getCachedRfpWithRelations(id);

  if (!rfp) {
    notFound();
  }

  // Check ownership
  if (rfp.userId !== session.user.id) {
    notFound();
  }

  // Parse timeline
  const timeline = parseJsonField<ProjectTimeline | null>(quickScan?.timeline, null);

  // Get extracted requirements for deadline
  const extractedReqs = parseJsonField<{
    targetDeadline?: string;
    deadline?: string;
    submissionDeadline?: string;
  } | null>(rfp.extractedRequirements, null);
  const submissionDeadline: string | undefined =
    extractedReqs?.submissionDeadline || extractedReqs?.targetDeadline || extractedReqs?.deadline;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Timing & Deadlines</h1>
        <p className="text-muted-foreground">Projekt-Timeline, Meilensteine und wichtige Termine</p>
      </div>

      {/* Submission Deadline Card */}
      {submissionDeadline && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Einreichungsfrist
            </CardTitle>
            <CardDescription>Deadline für die Angebotsabgabe</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Frist</p>
                <p className="text-2xl font-bold">
                  {new Date(submissionDeadline).toLocaleDateString('de-DE', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Verbleibende Zeit</p>
                <p className="text-lg font-semibold">
                  {(() => {
                    const now = new Date();
                    const deadline = new Date(submissionDeadline);
                    const diffTime = deadline.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays < 0) {
                      return <span className="text-destructive">Abgelaufen</span>;
                    } else if (diffDays === 0) {
                      return <span className="text-yellow-600">Heute</span>;
                    } else if (diffDays === 1) {
                      return <span className="text-yellow-600">1 Tag</span>;
                    } else if (diffDays <= 7) {
                      return <span className="text-yellow-600">{diffDays} Tage</span>;
                    } else {
                      return `${diffDays} Tage`;
                    }
                  })()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline Card */}
      {!timeline && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Timeline nicht verfügbar</AlertTitle>
          <AlertDescription>
            Der Quick Scan muss zuerst durchgeführt werden, bevor die Timeline-Analyse verfügbar
            ist.
          </AlertDescription>
        </Alert>
      )}

      {timeline && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Projekt-Timeline</CardTitle>
              <Badge variant="outline">Konfidenz: {timeline.confidence}%</Badge>
            </div>
            <CardDescription>
              AI-basierte Schätzung basierend auf Quick Scan Ergebnissen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Arbeitstage</p>
                  <p className="text-2xl font-bold">{timeline.totalDays}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Wochen</p>
                  <p className="text-2xl font-bold">{timeline.totalWeeks}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Monate</p>
                  <p className="text-2xl font-bold">{timeline.totalMonths}</p>
                </div>
              </div>
            </div>

            {/* Phase Breakdown (Milestones) */}
            <div>
              <h4 className="font-semibold mb-2">Projekt-Phasen & Meilensteine</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phase</TableHead>
                    <TableHead className="text-right">Dauer (Tage)</TableHead>
                    <TableHead className="text-right">Start</TableHead>
                    <TableHead className="text-right">Ende</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeline.phases.map((phase, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{phase.name}</TableCell>
                      <TableCell className="text-right">{phase.durationDays}</TableCell>
                      <TableCell className="text-right">Tag {phase.startDay + 1}</TableCell>
                      <TableCell className="text-right">Tag {phase.endDay + 1}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Team Size Assumption */}
            <div className="rounded-lg border p-4">
              <h4 className="font-semibold mb-2">Team-Größe Annahme</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Diese Schätzung basiert auf folgender Team-Größe:
              </p>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Minimum</p>
                  <p className="font-medium">{timeline.assumedTeamSize.min} Personen</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Optimal</p>
                  <p className="font-medium">{timeline.assumedTeamSize.optimal} Personen</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Maximum</p>
                  <p className="font-medium">{timeline.assumedTeamSize.max} Personen</p>
                </div>
              </div>
            </div>

            {/* Assumptions */}
            {timeline.assumptions.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Annahmen</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {timeline.assumptions.map((assumption, idx) => (
                    <li key={idx}>{assumption}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risks */}
            {timeline.risks && timeline.risks.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Identifizierte Risiken</h4>
                <div className="space-y-2">
                  {timeline.risks.map((risk, idx) => (
                    <div key={idx} className="flex items-start gap-2 rounded-lg border p-3">
                      <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{risk.factor}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            Impact: {risk.impact}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Likelihood: {risk.likelihood}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
