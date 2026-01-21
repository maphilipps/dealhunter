import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rfps, quickScans, businessUnits } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertCircle, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { RoutingForm } from '@/components/rfps/routing-form';
import type { ProjectTimeline, RiskAnalysis } from '@/lib/timeline/schema';
import { analyzeTimelineRisk, getRiskIcon } from '@/lib/timeline/risk-analyzer';

export default async function RoutingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get RFP
  const [rfp] = await db.select().from(rfps).where(eq(rfps.id, id)).limit(1);

  if (!rfp) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">RFP nicht gefunden</h1>
        <p className="text-muted-foreground">Der angeforderte RFP konnte nicht gefunden werden.</p>
      </div>
    );
  }

  // Check ownership
  if (rfp.userId !== session.user.id) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Keine Berechtigung</h1>
        <p className="text-muted-foreground">
          Sie haben keine Berechtigung, diesen RFP anzuzeigen.
        </p>
      </div>
    );
  }

  // Get Quick Scan with Timeline
  const [quickScan] = rfp.quickScanId
    ? await db.select().from(quickScans).where(eq(quickScans.id, rfp.quickScanId)).limit(1)
    : [null];

  if (!quickScan || !quickScan.timeline) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Timeline nicht verfügbar</h1>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Quick Scan erforderlich</AlertTitle>
          <AlertDescription>
            Der Quick Scan muss zuerst durchgeführt werden, bevor die Timeline-Analyse verfügbar ist.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Parse timeline and BL recommendation
  const timeline = JSON.parse(quickScan.timeline) as ProjectTimeline;
  const blRecommendation = quickScan.recommendedBusinessUnit
    ? {
        primaryBusinessLine: quickScan.recommendedBusinessUnit,
        confidence: quickScan.confidence || 0,
        reasoning: quickScan.reasoning || '',
      }
    : null;

  // Get extracted requirements for deadline
  const extractedReqs = rfp.extractedRequirements
    ? (JSON.parse(rfp.extractedRequirements) as { targetDeadline?: string; deadline?: string })
    : null;
  const rfpDeadline: string | undefined = extractedReqs?.targetDeadline || extractedReqs?.deadline;

  // Analyze risk
  const riskAnalysis: RiskAnalysis = analyzeTimelineRisk(rfpDeadline, timeline);

  // Get all business units for dropdown
  const allBusinessUnits = await db.select().from(businessUnits);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Timeline & BL-Routing</h1>
        <p className="text-muted-foreground">
          AI-generierte Timeline-Schätzung und BL-Empfehlung
        </p>
      </div>

      {/* Risk Warning Banner */}
      {riskAnalysis.risk === 'HIGH' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            {getRiskIcon('HIGH')} Unrealistische Timeline!
          </AlertTitle>
          <AlertDescription>{riskAnalysis.warning}</AlertDescription>
        </Alert>
      )}

      {riskAnalysis.risk === 'MEDIUM' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            {getRiskIcon('MEDIUM')} Timeline knapp
          </AlertTitle>
          <AlertDescription>{riskAnalysis.warning}</AlertDescription>
        </Alert>
      )}

      {/* Timeline Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Projekt-Timeline</CardTitle>
            <Badge variant="outline">
              Konfidenz: {timeline.confidence}%
            </Badge>
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

          {/* Deadline Comparison */}
          {rfpDeadline && (
            <div className="rounded-lg border p-4">
              <h4 className="font-semibold mb-2">Deadline-Vergleich</h4>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">RFP Deadline</p>
                  <p className="font-medium">
                    {rfpDeadline ? new Date(rfpDeadline).toLocaleDateString('de-DE') : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">AI-Schätzung (Ende)</p>
                  <p className="font-medium">
                    {riskAnalysis.aiEstimatedCompletion
                      ? new Date(riskAnalysis.aiEstimatedCompletion).toLocaleDateString('de-DE')
                      : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <p className="text-sm text-muted-foreground">Delta</p>
                <p className={`font-medium ${riskAnalysis.deltaDays < 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {riskAnalysis.deltaDays} Arbeitstage
                  {riskAnalysis.deltaDays < 0 ? ' zu knapp' : ' Buffer'}
                </p>
              </div>
            </div>
          )}

          {/* Phase Breakdown */}
          <div>
            <h4 className="font-semibold mb-2">Phasen-Breakdown</h4>
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
                  <div
                    key={idx}
                    className="flex items-start gap-2 rounded-lg border p-3"
                  >
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
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

      {/* BL Recommendation & Routing */}
      <Card>
        <CardHeader>
          <CardTitle>Business Line Routing</CardTitle>
          <CardDescription>
            Wählen Sie die zuständige Business Line für diesen RFP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RoutingForm
            rfpId={rfp.id}
            blRecommendation={blRecommendation}
            allBusinessUnits={allBusinessUnits}
            userId={session.user.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
