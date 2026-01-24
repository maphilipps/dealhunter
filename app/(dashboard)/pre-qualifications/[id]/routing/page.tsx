import { AlertCircle, AlertTriangle, Calendar, Clock, RefreshCw, Sparkles } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { TenQuestionsCard } from '@/components/bids/ten-questions-card';
import { ReloadTimelineButton } from '@/components/pre-qualifications/reload-timeline-button';
import { RoutingForm } from '@/components/pre-qualifications/routing-form';
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
import {
  buildQuestionsWithStatus,
  type QuestionWithStatus,
  type ProjectType,
} from '@/lib/bids/ten-questions';
import { db } from '@/lib/db';
import { businessUnits } from '@/lib/db/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';
import { getCachedRfpWithRelations } from '@/lib/pre-qualifications/cached-queries';
import { analyzeTimelineRisk, getRiskIcon } from '@/lib/timeline/risk-analyzer';
import type { ProjectTimeline, RiskAnalysis } from '@/lib/timeline/schema';

interface TimelinePhase {
  name: string;
  durationDays: number;
  startDay: number;
  endDay: number;
}

interface TimelineRisk {
  factor: string;
  impact: string;
  likelihood: string;
}

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

  // Get all business units for dropdown - always needed for manual routing
  const allBusinessUnits = await db.select().from(businessUnits);

  // Parse available data (graceful - may be null)
  let timeline: ProjectTimeline | null = null;
  if (quickScan?.timeline) {
    try {
      timeline = JSON.parse(quickScan.timeline) as ProjectTimeline;
    } catch {
      timeline = null;
    }
  }

  const blRecommendation = quickScan?.recommendedBusinessUnit
    ? {
        primaryBusinessLine: quickScan.recommendedBusinessUnit,
        confidence: quickScan.confidence || 0,
        reasoning: quickScan.reasoning || '',
      }
    : null;

  // Get extracted requirements
  let extractedReqs: ExtractedRequirements | null = null;
  if (rfp.extractedRequirements) {
    try {
      extractedReqs = JSON.parse(rfp.extractedRequirements) as ExtractedRequirements;
    } catch {
      extractedReqs = null;
    }
  }
  const rfpDeadline: string | undefined = extractedReqs?.submissionDeadline;

  // Analyze risk (only if timeline available)
  const riskAnalysis: RiskAnalysis | null = timeline
    ? analyzeTimelineRisk(rfpDeadline, timeline)
    : null;

  // Get 10 Questions from Quick Scan (if available)
  let tenQuestionsData: unknown = null;
  if (quickScan?.tenQuestions) {
    try {
      tenQuestionsData = JSON.parse(quickScan.tenQuestions);
    } catch {
      tenQuestionsData = null;
    }
  }
  const questionsResult =
    tenQuestionsData &&
    quickScan &&
    typeof tenQuestionsData === 'object' &&
    tenQuestionsData !== null &&
    'questions' in tenQuestionsData &&
    'answeredCount' in tenQuestionsData &&
    'totalCount' in tenQuestionsData
      ? {
          questions: (tenQuestionsData as Record<string, unknown>).questions,
          summary: {
            answered: (tenQuestionsData as Record<string, unknown>).answeredCount,
            total: (tenQuestionsData as Record<string, unknown>).totalCount,
          },
          projectType:
            ((tenQuestionsData as Record<string, unknown>).projectType as string) || 'migration',
        }
      : quickScan && extractedReqs
        ? buildQuestionsWithStatus(quickScan, extractedReqs)
        : null;

  // Check what data is missing
  const missingData = {
    quickScan: !quickScan,
    timeline: !timeline,
    tenQuestions: !questionsResult,
    blRecommendation: !blRecommendation,
  };

  const hasMissingData = Object.values(missingData).some(Boolean);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">BL Routing & Evaluation</h1>
        <p className="text-muted-foreground">
          AI-Empfehlung, 10-Fragen-Review und Timeline-Analyse
        </p>
      </div>

      {/* Missing Data Alert - only show if quick scan ran but data is missing */}
      {quickScan && hasMissingData && (
        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900">Einige Analysedaten fehlen</AlertTitle>
          <AlertDescription className="text-amber-800">
            <p className="mb-3">
              Der Quick Scan wurde durchgeführt, aber nicht alle Daten konnten extrahiert werden.
              Sie können trotzdem manuell routen.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {missingData.timeline && (
                <Badge variant="outline" className="bg-white">
                  Timeline fehlt
                </Badge>
              )}
              {missingData.tenQuestions && (
                <Badge variant="outline" className="bg-white">
                  10-Fragen fehlen
                </Badge>
              )}
              {missingData.blRecommendation && (
                <Badge variant="outline" className="bg-white">
                  BL-Empfehlung fehlt
                </Badge>
              )}
            </div>
            {missingData.timeline && <ReloadTimelineButton rfpId={rfp.id} />}
          </AlertDescription>
        </Alert>
      )}

      {/* No Quick Scan Alert */}
      {!quickScan && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Quick Scan nicht durchgeführt</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              Der Quick Scan wurde noch nicht gestartet. Sie können trotzdem manuell eine Business
              Line zuweisen.
            </p>
            <a
              href={`/pre-qualifications/${rfp.id}`}
              className="inline-flex items-center gap-2 text-sm font-medium underline"
            >
              <RefreshCw className="h-4 w-4" />
              Zum RFP Overview um Quick Scan zu starten
            </a>
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Scan Summary Card - only show if quickScan exists */}
      {quickScan && (
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
                <p className="text-muted-foreground mb-2 text-sm font-medium">
                  Empfohlene Business Unit
                </p>
                <p className="text-foreground text-lg font-bold">
                  {quickScan.recommendedBusinessUnit || (
                    <span className="text-muted-foreground italic">Nicht ermittelt</span>
                  )}
                </p>
                {quickScan.confidence !== null && quickScan.confidence !== undefined && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={quickScan.confidence >= 70 ? 'default' : 'destructive'}>
                      {quickScan.confidence}% Konfidenz
                    </Badge>
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-white p-4">
                <p className="text-muted-foreground mb-2 text-sm font-medium">
                  BID/NO-BID Bewertung
                </p>
                <p className="text-foreground text-lg font-bold">
                  {rfp.status === 'routed' ||
                  rfp.status === 'full_scanning' ||
                  rfp.status === 'bl_reviewing'
                    ? 'BID'
                    : 'Ausstehend'}
                </p>
                {quickScan.confidence !== null && quickScan.confidence !== undefined && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    Gesamt-Konfidenz: {quickScan.confidence}%
                  </p>
                )}
              </div>
            </div>
            {quickScan.reasoning && (
              <div className="rounded-lg bg-white p-4">
                <p className="text-muted-foreground mb-2 text-sm font-medium">Begründung</p>
                <p className="text-foreground text-sm">{quickScan.reasoning}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 10 Questions Card - only show if data available */}
      {questionsResult && (
        <TenQuestionsCard
          questions={questionsResult.questions as QuestionWithStatus[]}
          projectType={questionsResult.projectType as ProjectType}
          answeredCount={questionsResult.summary.answered as number}
          totalCount={questionsResult.summary.total as number}
        />
      )}

      {/* Risk Warning Banner - only show if timeline and risk available */}
      {riskAnalysis?.risk === 'HIGH' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            {getRiskIcon('HIGH')} Unrealistische Timeline!
          </AlertTitle>
          <AlertDescription>{riskAnalysis.warning}</AlertDescription>
        </Alert>
      )}

      {riskAnalysis?.risk === 'MEDIUM' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            {getRiskIcon('MEDIUM')} Timeline knapp
          </AlertTitle>
          <AlertDescription>{riskAnalysis.warning}</AlertDescription>
        </Alert>
      )}

      {/* Timeline Card - only show if timeline available */}
      {timeline && riskAnalysis && (
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
                <Clock className="text-muted-foreground h-4 w-4" />
                <div>
                  <p className="text-muted-foreground text-sm">Arbeitstage</p>
                  <p className="text-2xl font-bold">{timeline.totalDays}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="text-muted-foreground h-4 w-4" />
                <div>
                  <p className="text-muted-foreground text-sm">Wochen</p>
                  <p className="text-2xl font-bold">{timeline.totalWeeks}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="text-muted-foreground h-4 w-4" />
                <div>
                  <p className="text-muted-foreground text-sm">Monate</p>
                  <p className="text-2xl font-bold">{timeline.totalMonths}</p>
                </div>
              </div>
            </div>

            {/* Deadline Comparison */}
            {rfpDeadline && (
              <div className="rounded-lg border p-4">
                <h4 className="mb-2 font-semibold">Deadline-Vergleich</h4>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-sm">RFP Deadline</p>
                    <p className="font-medium">
                      {rfpDeadline ? new Date(rfpDeadline).toLocaleDateString('de-DE') : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">AI-Schätzung (Ende)</p>
                    <p className="font-medium">
                      {riskAnalysis.aiEstimatedCompletion
                        ? new Date(riskAnalysis.aiEstimatedCompletion).toLocaleDateString('de-DE')
                        : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-muted-foreground text-sm">Delta</p>
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
              <h4 className="mb-2 font-semibold">Phasen-Breakdown</h4>
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
                  {timeline.phases.map((phase: TimelinePhase, idx: number) => (
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
              <h4 className="mb-2 font-semibold">Team-Größe Annahme</h4>
              <p className="text-muted-foreground mb-2 text-sm">
                Diese Schätzung basiert auf folgender Team-Größe:
              </p>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-muted-foreground text-xs">Minimum</p>
                  <p className="font-medium">{timeline.assumedTeamSize.min} Personen</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Optimal</p>
                  <p className="font-medium">{timeline.assumedTeamSize.optimal} Personen</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Maximum</p>
                  <p className="font-medium">{timeline.assumedTeamSize.max} Personen</p>
                </div>
              </div>
            </div>

            {/* Assumptions */}
            {timeline.assumptions.length > 0 && (
              <div>
                <h4 className="mb-2 font-semibold">Annahmen</h4>
                <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                  {timeline.assumptions.map((assumption: string, idx: number) => (
                    <li key={idx}>{assumption}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risks */}
            {timeline.risks && timeline.risks.length > 0 && (
              <div>
                <h4 className="mb-2 font-semibold">Identifizierte Risiken</h4>
                <div className="space-y-2">
                  {timeline.risks.map((risk: TimelineRisk, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 rounded-lg border p-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{risk.factor}</p>
                        <div className="mt-1 flex gap-2">
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

      {/* Timeline Missing Card - show placeholder if timeline is missing */}
      {!timeline && quickScan && (
        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-muted-foreground">Projekt-Timeline</CardTitle>
              <Badge variant="outline" className="text-muted-foreground">
                Nicht verfügbar
              </Badge>
            </div>
            <CardDescription>Die Timeline-Analyse konnte nicht durchgeführt werden</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="text-muted-foreground mb-4 h-12 w-12" />
              <p className="text-muted-foreground mb-4">
                Die AI-basierte Timeline-Schätzung ist nicht verfügbar. Mögliche Gründe:
              </p>
              <ul className="text-muted-foreground mb-4 list-inside list-disc text-sm">
                <li>Keine ausreichenden Projekt-Informationen in der Ausschreibung</li>
                <li>Der Quick Scan konnte die Timeline nicht extrahieren</li>
              </ul>
              <ReloadTimelineButton rfpId={rfp.id} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* BL Recommendation & Routing - ALWAYS VISIBLE */}
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
          />
        </CardContent>
      </Card>
    </div>
  );
}
