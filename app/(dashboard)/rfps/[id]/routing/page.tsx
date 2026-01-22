import { AlertCircle, AlertTriangle, Calendar, Clock, Sparkles } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { BLRoutingCard } from '@/components/bids/bl-routing-card';
import { TenQuestionsCard } from '@/components/bids/ten-questions-card';
import { RoutingForm } from '@/components/rfps/routing-form';
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
import { buildQuestionsWithStatus } from '@/lib/bids/ten-questions';
import { db } from '@/lib/db';
import { businessUnits } from '@/lib/db/schema';
import { getCachedRfpWithRelations } from '@/lib/rfps/cached-queries';
import { analyzeTimelineRisk, getRiskIcon } from '@/lib/timeline/risk-analyzer';
import type { ProjectTimeline, RiskAnalysis } from '@/lib/timeline/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

export default async function RoutingPage({ params }: { params: Promise<{ id: string }> }) {
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

  if (!quickScan || !quickScan.timeline) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Timeline nicht verfügbar</h1>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Quick Scan erforderlich</AlertTitle>
          <AlertDescription>
            Der Quick Scan muss zuerst durchgeführt werden, bevor die Timeline-Analyse verfügbar
            ist.
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

  // Get extracted requirements
  const extractedReqs = rfp.extractedRequirements
    ? (JSON.parse(rfp.extractedRequirements) as ExtractedRequirements)
    : null;
  const rfpDeadline: string | undefined = extractedReqs?.submissionDeadline;

  // Analyze risk
  const riskAnalysis: RiskAnalysis = analyzeTimelineRisk(rfpDeadline, timeline);

  // Get all business units for dropdown
  const allBusinessUnits = await db.select().from(businessUnits);

  // Get 10 Questions from Quick Scan
  const tenQuestionsData = quickScan.tenQuestions
    ? JSON.parse(quickScan.tenQuestions)
    : null;
  const result = tenQuestionsData
    ? { questions: tenQuestionsData.questions, summary: { answered: tenQuestionsData.answeredCount, total: tenQuestionsData.totalCount }, projectType: tenQuestionsData.projectType || 'migration' }
    : buildQuestionsWithStatus(quickScan, extractedReqs);

  const { questions, summary, projectType } = result;
  const answeredCount = summary.answered;
  const totalCount = summary.total;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">BL Routing & Evaluation</h1>
        <p className="text-muted-foreground">AI-Empfehlung, 10-Fragen-Review und Timeline-Analyse</p>
      </div>

      {/* Quick Scan Summary Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle className="text-blue-900">Quick Scan Zusammenfassung</CardTitle>
                <CardDescription className="text-blue-700">
                  Ergebnisse der Website-Analyse
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-900">
              Analysiert
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-white p-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">Empfohlene Business Unit</p>
              <p className="text-lg font-bold text-foreground">
                {quickScan.recommendedBusinessUnit || 'Technology & Innovation'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={quickScan.confidence && quickScan.confidence >= 70 ? 'default' : 'destructive'}>
                  {quickScan.confidence || 0}% Konfidenz
                </Badge>
              </div>
            </div>
            <div className="rounded-lg bg-white p-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">BID/NO-BID Bewertung</p>
              <p className="text-lg font-bold text-foreground">
                {rfp.status === 'routed' || rfp.status === 'full_scanning' || rfp.status === 'bl_reviewing'
                  ? 'BID'
                  : 'Ausstehend'}
              </p>
              {quickScan.confidence && (
                <p className="text-sm text-muted-foreground mt-1">
                  Gesamt-Konfidenz: {quickScan.confidence}%
                </p>
              )}
            </div>
          </div>
          {quickScan.reasoning && (
            <div className="rounded-lg bg-white p-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">Begründung</p>
              <p className="text-sm text-foreground">{quickScan.reasoning}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* BL Routing Card */}
      <BLRoutingCard
        bidId={rfp.id}
        recommendation={{
          primaryBusinessLine: quickScan.recommendedBusinessUnit || 'Technology & Innovation',
          confidence: quickScan.confidence || 0,
          reasoning: quickScan.reasoning || '',
          alternativeBusinessLines: [],
          requiredSkills: [],
        }}
      />

      {/* 10 Questions Card */}
      <TenQuestionsCard
        questions={questions}
        projectType={projectType}
        answeredCount={answeredCount}
        totalCount={totalCount}
      />

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
                <p
                  className={`font-medium ${riskAnalysis.deltaDays < 0 ? 'text-destructive' : 'text-green-600'}`}
                >
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
                {timeline.phases.map((phase: { name: string; durationDays: number; startDay: number; endDay: number }, idx: number) => (
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
                {timeline.assumptions.map((assumption: string, idx: number) => (
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
                {timeline.risks.map((risk: { factor: string; impact: string; likelihood: string }, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 rounded-lg border p-3">
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
          <CardDescription>Wählen Sie die zuständige Business Line für diesen RFP</CardDescription>
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
