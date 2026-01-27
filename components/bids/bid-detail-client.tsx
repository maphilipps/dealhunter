'use client';

import { Loader2, CheckCircle2, RotateCcw, ArrowRight, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { BaselineComparisonCard } from './baseline-comparison-card';
// BitDecisionActions removed - BID/NO-BID decision is made by BL, not BD
import { BLRoutingCard } from './bl-routing-card';
import { DecisionCard } from './decision-card';
import { DecisionConfidenceBanner } from './decision-confidence-banner';
import { DeepAnalysisCard } from './deep-analysis-card';
import { DuplicateWarning } from './duplicate-warning';
import { ExtractionPreview } from './extraction-preview';
import { LowConfidenceDialog } from './low-confidence-dialog';
import { NotificationCard } from './notification-card';
import { ProcessingProgressCard } from './processing-progress-card';
import { ProjectPlanningCard } from './project-planning-card';
import { QuickScanResults } from './quick-scan-results';
import { TeamBuilder } from './team-builder';
import { TenQuestionsCard } from './ten-questions-card';

import { ActivityStream } from '@/components/ai-elements/activity-stream';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { updateExtractedRequirements } from '@/lib/bids/actions';
import type { DuplicateCheckResult } from '@/lib/bids/duplicate-check';
import {
  calculateAnsweredQuestionsCount,
  buildQuestionsWithStatus,
} from '@/lib/bids/ten-questions';
import { getBitEvaluationResult, retriggerBitEvaluation } from '@/lib/bit-evaluation/actions';
import type { BitEvaluationResult } from '@/lib/bit-evaluation/schema';
import type { PreQualification, QuickScan } from '@/lib/db/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';
import { getQuickScanResult } from '@/lib/quick-scan/actions';

interface BidDetailClientProps {
  bid: PreQualification;
}

export function BidDetailClient({ bid }: BidDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isOverviewPage = pathname === `/pre-qualifications/${bid.id}`;
  const [isExtracting, setIsExtracting] = useState(
    ['processing', 'extracting', 'duplicate_checking', 'quick_scanning'].includes(bid.status)
  );
  const [extractedData, setExtractedData] = useState<ExtractedRequirements | null>(
    bid.extractedRequirements
      ? (JSON.parse(bid.extractedRequirements) as ExtractedRequirements)
      : null
  );
  const [quickScan, setQuickScan] = useState<QuickScan | null>(null);
  const [isLoadingQuickScan, setIsLoadingQuickScan] = useState(false);
  const [bitEvaluationResult, setBitEvaluationResult] = useState<BitEvaluationResult | null>(null);
  const [isLoadingBitEvaluation, setIsLoadingBitEvaluation] = useState(false);
  const [showLowConfidenceDialog, setShowLowConfidenceDialog] = useState(false);
  const [isRetriggeringBit, setIsRetriggeringBit] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateCheckResult | null>(
    bid.duplicateCheckResult ? (JSON.parse(bid.duplicateCheckResult) as DuplicateCheckResult) : null
  );

  // Phase 1.1: Ref to prevent double-start race condition in React Strict Mode

  useEffect(() => {
    const processingStates = [
      'processing',
      'extracting',
      'duplicate_checking',
      'quick_scanning',
    ];
    setIsExtracting(processingStates.includes(bid.status));
  }, [bid.status]);

  const handleRefresh = () => {
    void router.refresh();
    setRefreshKey(prev => prev + 1);
  };

  // Handle requirements confirmation
  const handleConfirmRequirements = async (updatedRequirements: ExtractedRequirements) => {
    toast.info('Speichere Änderungen...');

    try {
      const result = await updateExtractedRequirements(bid.id, updatedRequirements);

      if (result.success) {
        toast.success('Änderungen gespeichert!');
        void router.refresh();
      } else {
        toast.error(result.error || 'Speichern fehlgeschlagen');
      }
    } catch {
      toast.error('Ein Fehler ist aufgetreten');
    }
  };

  // Handle BIT evaluation re-trigger
  const handleRetriggerBitEvaluation = async () => {
    setIsRetriggeringBit(true);
    toast.info('Starte BIT Evaluierung erneut...');

    try {
      const result = await retriggerBitEvaluation(bid.id);

      if (result.success) {
        toast.success('BIT Evaluierung gestartet - bitte warten...');
        // Clear current result so the ActivityStream is shown
        setBitEvaluationResult(null);
        // Refresh server components to show updated state
        void router.refresh();
      } else {
        toast.error(result.error || 'BIT Re-Evaluierung fehlgeschlagen');
        setIsRetriggeringBit(false);
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
      setIsRetriggeringBit(false);
    }
  };

  // Load quick scan if status is quick_scanning or later
  useEffect(() => {
    const loadQuickScan = async () => {
      if (
        [
          'extracting',
          'duplicate_warning',
          'quick_scanning',
          'questions_ready',
          'bit_pending',
          'evaluating',
          'decision_made',
          'routed',
          'full_scanning',
          'bl_reviewing',
          'team_assigned',
          'notified',
          'handed_off',
        ].includes(bid.status)
      ) {
        setIsLoadingQuickScan(true);
        const result = await getQuickScanResult(bid.id);
        if (result.success && result.quickScan) {
          setQuickScan(prevQuickScan => {
            // Only update if status changed to prevent unnecessary re-renders
            if (!prevQuickScan || prevQuickScan.status !== result.quickScan.status) {
              return result.quickScan;
            }
            return prevQuickScan;
          });
          setNeedsWebsiteUrl(false);
        } else if (bid.status === 'quick_scanning') {
          const hasUrl =
            extractedData?.websiteUrl ||
            (extractedData?.websiteUrls && extractedData.websiteUrls.length > 0);
          if (!hasUrl) {
            setNeedsWebsiteUrl(true);
          }
        }
        setIsLoadingQuickScan(false);
      }
    };

    void loadQuickScan();
  }, [bid.id, bid.status, extractedData, refreshKey]);

  // Load BIT evaluation result if status is decision_made or later
  useEffect(() => {
    if (
      [
        'decision_made',
        'routed',
        'full_scanning',
        'bl_reviewing',
        'team_assigned',
        'notified',
        'handed_off',
        'archived',
      ].includes(bid.status)
    ) {
      setIsLoadingBitEvaluation(true);
      void getBitEvaluationResult(bid.id).then(result => {
        if (result.success && result.result) {
          setBitEvaluationResult(prevResult => {
            // Only update if result actually changed
            if (!prevResult) {
              return result.result;
            }

            // Compare decision field to prevent unnecessary updates
            if (
              prevResult.decision.decision !== result.result.decision.decision ||
              prevResult.decision.overallConfidence !== result.result.decision.overallConfidence
            ) {
              return result.result;
            }

            return prevResult;
          });

          // Show low confidence dialog if confidence < 70% and not yet confirmed
          if (result.result.decision.overallConfidence < 70 && bid.status === 'decision_made') {
            setShowLowConfidenceDialog(true);
          }
        }
        setIsLoadingBitEvaluation(false);
      });
    }
  }, [bid.id, bid.status]);

  // Processing state - Show progress card while background processing runs
  if (
    isExtracting ||
    bid.status === 'processing' ||
    bid.status === 'extracting' ||
    bid.status === 'duplicate_checking' ||
    bid.status === 'quick_scanning'
  ) {
    return (
      <div className="space-y-6 max-w-full">
        <ProcessingProgressCard bidId={bid.id} />
      </div>
    );
  }

  // Draft state - Show start extraction button
  if (bid.status === 'draft' && !isExtracting) {
    return (
      <div className="space-y-6 max-w-full">
        <Card>
          <CardHeader>
            <CardTitle>Nächster Schritt</CardTitle>
            <CardDescription>Die Qualification startet automatisch nach dem Anlegen.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Es sind keine manuellen Aktionen erforderlich.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Reviewing state - Show extraction preview and edit form
  if (bid.status === 'reviewing' && extractedData) {
    return (
      <div className="space-y-6 max-w-full">
        {/* Duplicate Warning */}
        {duplicateCheck?.hasDuplicates && (
          <DuplicateWarning
            duplicateCheck={duplicateCheck}
            onDismiss={() => setDuplicateCheck(null)}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Extraktion abgeschlossen
            </CardTitle>
            <CardDescription>Überprüfen und korrigieren Sie die extrahierten Daten</CardDescription>
          </CardHeader>
          <CardContent>
            <ExtractionPreview initialData={extractedData} onConfirm={handleConfirmRequirements} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Qualification or later states - Show results
  if (
    [
      'quick_scanning',
      'questions_ready',
      'bit_pending',
      'evaluating',
      'decision_made',
      'routed',
      'full_scanning',
      'bl_reviewing',
      'team_assigned',
      'notified',
      'handed_off',
      'archived',
    ].includes(bid.status)
  ) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 max-w-full overflow-hidden">
        <div className="space-y-6 min-w-0">
          {/* Extracted Requirements Summary */}
          {extractedData && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Extrahierte Anforderungen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {extractedData.customerName && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Kunde</p>
                      <p className="text-lg">{extractedData.customerName}</p>
                    </div>
                  )}
                  {extractedData.technologies && extractedData.technologies.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Technologien</p>
                      <div className="flex flex-wrap gap-2">
                        {extractedData.technologies.slice(0, 5).map((tech: string, idx: number) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs"
                          >
                            {tech}
                          </span>
                        ))}
                        {extractedData.technologies.length > 5 && (
                          <span className="text-xs text-muted-foreground">
                            +{extractedData.technologies.length - 5} mehr
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Qualification Results */}
          {isLoadingQuickScan && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    Lade Qualification Ergebnisse...
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {quickScan && (
            <QuickScanResults
              quickScan={quickScan}
              bidId={bid.id}
              onRefresh={handleRefresh}
            />
          )}

          {/* BD Qualification Decision (questions_ready or bit_pending status) */}
          {['questions_ready', 'bit_pending'].includes(bid.status) &&
            quickScan &&
            (() => {
              const questionsCount = calculateAnsweredQuestionsCount(quickScan, extractedData);
              const questionsWithStatus = buildQuestionsWithStatus(quickScan, extractedData);

              return (
                <>
                  {/* Decision Confidence Banner (if <70% answered) */}
                  <DecisionConfidenceBanner
                    answeredCount={questionsCount.answered}
                    totalCount={questionsCount.total}
                  />

                  {/* 10 Questions Review Card */}
                  <TenQuestionsCard
                    questions={questionsWithStatus.questions}
                    projectType={questionsWithStatus.projectType}
                    answeredCount={questionsWithStatus.summary.answered}
                    totalCount={questionsWithStatus.summary.total}
                  />

                  {/* BL Routing Action - BID/NO-BID decision is made by BL after routing */}
                  <Card className="border-indigo-200 bg-indigo-50/50">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-indigo-600" />
                        <CardTitle className="text-indigo-900">
                          An Business Line weiterleiten
                        </CardTitle>
                      </div>
                      <CardDescription className="text-indigo-700">
                        Weiterleitung an {quickScan.recommendedBusinessUnit || 'empfohlene BL'}
                        {quickScan.confidence ? ` (${quickScan.confidence}% Konfidenz)` : ''}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Die BID/NO-BID Entscheidung wird vom Bereichsleiter nach dem Routing
                        getroffen.
                      </p>
                      <Link href={`/pre-qualifications/${bid.id}/routing`}>
                        <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Timeline & BL-Routing
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </>
              );
            })()}

          {/* BIT Evaluation Progress (evaluating status) */}
          {bid.status === 'evaluating' && (
            <ActivityStream
              streamUrl={`/api/pre-qualifications/${bid.id}/evaluate/stream`}
              title="BIT/NO BIT Evaluierung"
              onComplete={() => {
                toast.success('BIT Evaluierung abgeschlossen!');
                void handleRefresh();
              }}
              autoStart={true}
            />
          )}

          {/* BIT Evaluation Results (decision_made status) */}
          {bid.status === 'decision_made' && (
            <>
              {isLoadingBitEvaluation && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Lade BIT Evaluierung...</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {bitEvaluationResult && (
                <>
                  <div className="flex items-center justify-between">
                    <div />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetriggerBitEvaluation}
                      disabled={isRetriggeringBit}
                    >
                      {isRetriggeringBit ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-1" />
                      )}
                      Erneut evaluieren
                    </Button>
                  </div>
                  <DecisionCard result={bitEvaluationResult} />

                  {/* Show BL Routing Card for BIT decisions - only on overview page */}
                  {isOverviewPage &&
                    bitEvaluationResult.decision.decision === 'bit' &&
                    quickScan && (
                      <BLRoutingCard
                        bidId={bid.id}
                        recommendation={{
                          primaryBusinessLine:
                            quickScan.recommendedBusinessUnit || 'Technology & Innovation',
                          confidence: quickScan.confidence || 0,
                          reasoning: quickScan.reasoning || '',
                          alternativeBusinessLines: [],
                          requiredSkills: [],
                        }}
                      />
                    )}

                  {/* Show Deep Analysis Card for BIT decisions - only on dedicated subpages */}
                  {!isOverviewPage && bitEvaluationResult.decision.decision === 'bit' && (
                    <DeepAnalysisCard
                      bidId={bid.id}
                      websiteUrl={bid.websiteUrl}
                      existingAnalysis={null}
                    />
                  )}

                  <LowConfidenceDialog
                    open={showLowConfidenceDialog}
                    onOpenChange={setShowLowConfidenceDialog}
                    bidId={bid.id}
                    decision={bitEvaluationResult.decision.decision}
                    confidence={bitEvaluationResult.decision.overallConfidence}
                    reasoning={bitEvaluationResult.decision.reasoning}
                  />
                </>
              )}
            </>
          )}

          {/* Phase 6/7/9: Routed status and later - Show Team Builder, Baseline, Planning, Notifications */}
          {[
            'routed',
            'full_scanning',
            'bl_reviewing',
            'team_assigned',
            'notified',
            'handed_off',
          ].includes(bid.status) &&
            (() => {
              // Check what data is available for the new components
              const hasDeepAnalysis = bid.deepMigrationAnalysisId !== null;
              const hasTeam = bid.assignedTeam !== null;

              // Parse results if available
              let baselineResult = null;
              let projectPlan = null;
              let notificationResults = null;

              if (bid.baselineComparisonResult) {
                try {
                  baselineResult = JSON.parse(bid.baselineComparisonResult);
                } catch {
                  // Ignore parse error
                }
              }
              if (bid.projectPlanningResult) {
                try {
                  projectPlan = JSON.parse(bid.projectPlanningResult);
                } catch {
                  // Ignore parse error
                }
              }
              if (bid.teamNotifications) {
                try {
                  notificationResults = JSON.parse(bid.teamNotifications);
                } catch {
                  // Ignore parse error
                }
              }

              return (
                <>
                  {/* Show BL Routing Card when routed - only on overview page */}
                  {isOverviewPage && bid.status === 'routed' && quickScan && (
                    <BLRoutingCard
                      bidId={bid.id}
                      recommendation={{
                        primaryBusinessLine:
                          quickScan.recommendedBusinessUnit || 'Technology & Innovation',
                        confidence: quickScan.confidence || 0,
                        reasoning: quickScan.reasoning || '',
                        alternativeBusinessLines: [],
                        requiredSkills: [],
                      }}
                    />
                  )}

                  {/* Cards that should NOT appear on overview page - only on dedicated subpages */}
                  {!isOverviewPage && (
                    <>
                      {/* Deep Analysis */}
                      <DeepAnalysisCard
                        bidId={bid.id}
                        websiteUrl={bid.websiteUrl}
                        existingAnalysis={null}
                      />

                      {/* Phase 6: Baseline-Vergleich */}
                      <BaselineComparisonCard
                        bidId={bid.id}
                        initialResult={baselineResult}
                        hasDeepAnalysis={hasDeepAnalysis}
                      />

                      {/* Phase 7: Projekt-Planung */}
                      <ProjectPlanningCard
                        bidId={bid.id}
                        initialPlan={projectPlan}
                        hasDeepAnalysis={hasDeepAnalysis}
                      />

                      {/* Team Builder */}
                      {bid.status === 'routed' && <TeamBuilder bidId={bid.id} />}

                      {/* Team Assignment Summary (if team_assigned or later) */}
                      {['team_assigned', 'notified', 'handed_off'].includes(bid.status) &&
                        bid.assignedTeam && (
                          <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
                            <CardHeader>
                              <CardTitle className="text-green-900 dark:text-green-100">
                                Team zugewiesen
                              </CardTitle>
                              <CardDescription className="text-green-700 dark:text-green-300">
                                Das Team wurde erfolgreich zugewiesen
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <pre className="text-sm overflow-auto">
                                {JSON.stringify(JSON.parse(bid.assignedTeam), null, 2)}
                              </pre>
                            </CardContent>
                          </Card>
                        )}

                      {/* Phase 9: Team-Benachrichtigung */}
                      <NotificationCard
                        bidId={bid.id}
                        hasTeam={hasTeam}
                        initialResults={notificationResults}
                        notifiedAt={bid.teamNotifiedAt}
                      />

                      {/* Workflow Complete Badge */}
                      {bid.status === 'handed_off' && (
                        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                              <CheckCircle2 className="h-5 w-5" />
                              Workflow abgeschlossen
                            </CardTitle>
                            <CardDescription className="text-blue-700 dark:text-blue-300">
                              Alle Phasen wurden erfolgreich durchlaufen. Das Projekt wurde
                              übergeben.
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      )}

                      {/* Archived (NO BIT) Status */}
                      {bid.status === 'archived' && (
                        <Card className="border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/20">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                              <CheckCircle2 className="h-5 w-5" />
                              Opportunity archiviert (NO BIT)
                            </CardTitle>
                            <CardDescription className="text-gray-600 dark:text-gray-400">
                              Diese Opportunity wurde als NO BIT markiert und archiviert.
                              {bid.alternativeRecommendation && (
                                <span className="block mt-2">
                                  <strong>Begründung:</strong> {bid.alternativeRecommendation}
                                </span>
                              )}
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      )}
                    </>
                  )}
                </>
              );
            })()}
        </div>
      </div>
    );
  }

  // Other states - Show extracted data readonly
  if (extractedData) {
    return (
      <div className="space-y-6 max-w-full">
        <Card>
          <CardHeader>
            <CardTitle>Extrahierte Anforderungen</CardTitle>
            <CardDescription>Von AI extrahierte und bestätigte Daten</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {extractedData.customerName && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Kunde</p>
                  <p className="text-lg">{extractedData.customerName}</p>
                </div>
              )}
              {extractedData.projectDescription && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Projektbeschreibung</p>
                  <p>{extractedData.projectDescription}</p>
                </div>
              )}
              {extractedData.technologies && extractedData.technologies.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Technologien</p>
                  <div className="flex flex-wrap gap-2">
                    {extractedData.technologies.map((tech: string, idx: number) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
