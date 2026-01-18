'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, CheckCircle2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { updateExtractedRequirements } from '@/lib/bids/actions';
import { startQuickScan, getQuickScanResult } from '@/lib/quick-scan/actions';
import { startBitEvaluation, getBitEvaluationResult, retriggerBitEvaluation } from '@/lib/bit-evaluation/actions';
import type { BidOpportunity, QuickScan } from '@/lib/db/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';
import type { BitEvaluationResult } from '@/lib/bit-evaluation/schema';
import { ExtractionPreview } from './extraction-preview';
import { QuickScanResults } from './quick-scan-results';
import { WebsiteUrlInput } from './website-url-input';
import { ActivityStream } from '@/components/ai-elements/activity-stream';
import { DecisionCard } from './decision-card';
import { LowConfidenceDialog } from './low-confidence-dialog';
import { BLRoutingCard } from './bl-routing-card';
import { TeamBuilder } from './team-builder';
import { DeepAnalysisCard } from './deep-analysis-card';
import { DocumentsSidebar } from './documents-sidebar';
import { BaselineComparisonCard } from './baseline-comparison-card';
import { ProjectPlanningCard } from './project-planning-card';
import { NotificationCard } from './notification-card';

interface BidDetailClientProps {
  bid: BidOpportunity;
}

export function BidDetailClient({ bid }: BidDetailClientProps) {
  const router = useRouter();
  const [isExtracting, setIsExtracting] = useState(bid.status === 'extracting');
  const [extractedData, setExtractedData] = useState(
    bid.extractedRequirements ? JSON.parse(bid.extractedRequirements) : null
  );
  const [quickScan, setQuickScan] = useState<QuickScan | null>(null);
  const [isLoadingQuickScan, setIsLoadingQuickScan] = useState(false);
  const [bitEvaluationResult, setBitEvaluationResult] = useState<BitEvaluationResult | null>(null);
  const [isLoadingBitEvaluation, setIsLoadingBitEvaluation] = useState(false);
  const [showLowConfidenceDialog, setShowLowConfidenceDialog] = useState(false);
  const [needsWebsiteUrl, setNeedsWebsiteUrl] = useState(false);
  const [isSubmittingUrl, setIsSubmittingUrl] = useState(false);
  const [isRetriggeringBit, setIsRetriggeringBit] = useState(false);

  // Handle extraction start - now uses streaming
  const handleStartExtraction = () => {
    setIsExtracting(true);
    toast.info('Starte AI-Extraktion...');
    // The actual extraction happens via ActivityStream SSE endpoint
    // When stream completes, onComplete callback refreshes the page
  };

  // Handle requirements confirmation
  const handleConfirmRequirements = async (updatedRequirements: ExtractedRequirements) => {
    toast.info('Speichere Änderungen...');

    try {
      const result = await updateExtractedRequirements(bid.id, updatedRequirements);

      if (result.success) {
        toast.success('Änderungen gespeichert! Quick Scan wird gestartet...');

        // Start Quick Scan automatically
        setTimeout(async () => {
          const scanResult = await startQuickScan(bid.id);
          if (scanResult.success) {
            toast.success('Quick Scan erfolgreich gestartet!');
            router.refresh();

            // Auto-start BIT evaluation after Quick Scan completes
            // Wait a bit for the router refresh, then poll for completion
            setTimeout(() => {
              checkQuickScanAndStartEvaluation();
            }, 2000);
          } else if (scanResult.needsWebsiteUrl) {
            toast.error('Bitte Website-URL in den Anforderungen angeben');
          } else {
            toast.error(scanResult.error || 'Quick Scan konnte nicht gestartet werden');
          }
        }, 500);
      } else {
        toast.error(result.error || 'Speichern fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
    }
  };

  // Check if Quick Scan completed and start BIT evaluation
  const checkQuickScanAndStartEvaluation = async () => {
    const scanResult = await getQuickScanResult(bid.id);

    if (scanResult.success && scanResult.quickScan?.status === 'completed') {
      toast.info('Quick Scan abgeschlossen! Starte BIT/NO BIT Evaluierung...');

      const evalResult = await startBitEvaluation(bid.id);
      if (evalResult.success) {
        toast.success('BIT Evaluierung abgeschlossen!');
        router.refresh();
      } else {
        toast.error(evalResult.error || 'BIT Evaluierung fehlgeschlagen');
      }
    } else if (scanResult.success && scanResult.quickScan?.status === 'running') {
      // Quick Scan still running, poll again
      setTimeout(() => {
        checkQuickScanAndStartEvaluation();
      }, 3000);
    }
  };

  // Handle URL submission when Quick Scan needs a URL
  const handleUrlSubmit = async (urls: Array<{ url: string; type: string; description?: string; selected: boolean }>) => {
    setIsSubmittingUrl(true);

    try {
      // Update extracted requirements with selected URLs
      const selectedUrls = urls.filter(u => u.selected);
      const primaryUrl = selectedUrls[0]?.url;

      const updatedRequirements = {
        ...extractedData,
        websiteUrls: selectedUrls.map(u => ({
          url: u.url,
          type: u.type,
          description: u.description,
          extractedFromDocument: false,
        })),
        websiteUrl: primaryUrl,
      };

      // Save updated requirements
      const updateResult = await updateExtractedRequirements(bid.id, updatedRequirements);

      if (!updateResult.success) {
        toast.error(updateResult.error || 'Fehler beim Speichern der URLs');
        setIsSubmittingUrl(false);
        return;
      }

      setExtractedData(updatedRequirements);
      toast.success('URLs gespeichert! Quick Scan wird gestartet...');

      // Start Quick Scan
      const scanResult = await startQuickScan(bid.id);
      if (scanResult.success) {
        setNeedsWebsiteUrl(false);
        toast.success('Quick Scan gestartet!');
        router.refresh();

        // Wait and start BIT evaluation
        setTimeout(() => {
          checkQuickScanAndStartEvaluation();
        }, 2000);
      } else {
        toast.error(scanResult.error || 'Quick Scan konnte nicht gestartet werden');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsSubmittingUrl(false);
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
        // Force page reload to show ActivityStream
        window.location.reload();
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
    if (['quick_scanning', 'evaluating', 'decision_made', 'routed', 'full_scanning', 'bl_reviewing', 'team_assigned', 'notified', 'handed_off'].includes(bid.status)) {
      setIsLoadingQuickScan(true);
      getQuickScanResult(bid.id).then(result => {
        if (result.success && result.quickScan) {
          setQuickScan(result.quickScan);
          setNeedsWebsiteUrl(false);
        } else if (bid.status === 'quick_scanning') {
          // Quick Scan status but no results - likely missing URL
          // Check if extractedData has a websiteUrl
          const hasUrl = extractedData?.websiteUrl || (extractedData?.websiteUrls && extractedData.websiteUrls.length > 0);
          if (!hasUrl) {
            setNeedsWebsiteUrl(true);
          }
        }
        setIsLoadingQuickScan(false);
      });
    }
  }, [bid.id, bid.status, extractedData]);

  // Load BIT evaluation result if status is decision_made or later
  useEffect(() => {
    if (['decision_made', 'routed', 'full_scanning', 'bl_reviewing', 'team_assigned', 'notified', 'handed_off'].includes(bid.status)) {
      setIsLoadingBitEvaluation(true);
      getBitEvaluationResult(bid.id).then(result => {
        if (result.success && result.result) {
          setBitEvaluationResult(result.result);

          // Show low confidence dialog if confidence < 70% and not yet confirmed
          if (result.result.decision.overallConfidence < 70 && bid.status === 'decision_made') {
            setShowLowConfidenceDialog(true);
          }
        }
        setIsLoadingBitEvaluation(false);
      });
    }
  }, [bid.id, bid.status]);

  // Draft state - Show raw input and start extraction button
  if (bid.status === 'draft' && !isExtracting) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Rohdaten</CardTitle>
              <CardDescription>
                Extrahierter Text aus dem Dokument
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted p-4">
                <pre className="whitespace-pre-wrap text-sm font-mono">
                  {bid.rawInput.substring(0, 1000)}
                  {bid.rawInput.length > 1000 && '...'}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Nächster Schritt</CardTitle>
              <CardDescription>
                AI-gestützte Extraktion der Anforderungen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleStartExtraction} disabled={isExtracting}>
                <Sparkles className="mr-2 h-4 w-4" />
                AI-Extraktion starten
              </Button>
            </CardContent>
          </Card>
        </div>
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)]">
          <DocumentsSidebar bidId={bid.id} />
        </aside>
      </div>
    );
  }

  // Extracting state - Show ActivityStream with real-time progress
  if (isExtracting || bid.status === 'extracting') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Rohdaten</CardTitle>
              <CardDescription>
                Extrahierter Text aus dem Dokument
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted p-4">
                <pre className="whitespace-pre-wrap text-sm font-mono">
                  {bid.rawInput.substring(0, 500)}
                  {bid.rawInput.length > 500 && '...'}
                </pre>
              </div>
            </CardContent>
          </Card>

          <ActivityStream
            streamUrl={`/api/rfps/${bid.id}/extraction/stream`}
            title="AI-Extraktion"
            onComplete={() => {
              toast.success('Extraktion abgeschlossen!');
              setIsExtracting(false);
              router.refresh();
            }}
            onError={(error) => {
              toast.error(error || 'Extraktion fehlgeschlagen');
              setIsExtracting(false);
            }}
            autoStart={true}
          />
        </div>
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)]">
          <DocumentsSidebar bidId={bid.id} />
        </aside>
      </div>
    );
  }

  // Reviewing state - Show extraction preview and edit form
  if (bid.status === 'reviewing' && extractedData) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Extraktion abgeschlossen
            </CardTitle>
            <CardDescription>
              Überprüfen und korrigieren Sie die extrahierten Daten
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExtractionPreview
              initialData={extractedData}
              onConfirm={handleConfirmRequirements}
            />
          </CardContent>
        </Card>
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)]">
          <DocumentsSidebar bidId={bid.id} />
        </aside>
      </div>
    );
  }

  // Quick Scanning or later states - Show Quick Scan results
  if (['quick_scanning', 'evaluating', 'decision_made', 'routed', 'full_scanning', 'bl_reviewing', 'team_assigned', 'notified', 'handed_off'].includes(bid.status)) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
        {/* Extracted Requirements Summary */}
        {extractedData && (
          <Card>
            <CardHeader>
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

        {/* Website URL Input (when needed) */}
        {needsWebsiteUrl && extractedData && (
          <WebsiteUrlInput
            customerName={extractedData.customerName}
            industry={extractedData.industry}
            projectDescription={extractedData.projectDescription}
            technologies={extractedData.technologies}
            onSubmit={handleUrlSubmit}
            isSubmitting={isSubmittingUrl}
          />
        )}

        {/* Quick Scan Results */}
        {isLoadingQuickScan && !needsWebsiteUrl && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Lade Quick Scan Ergebnisse...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {quickScan && (
          <QuickScanResults
            quickScan={quickScan}
            bidId={bid.id}
            onRefresh={() => router.refresh()}
            extractedData={extractedData}
          />
        )}

        {/* BIT Evaluation Progress (evaluating status) */}
        {bid.status === 'evaluating' && (
          <ActivityStream
            streamUrl={`/api/rfps/${bid.id}/evaluate/stream`}
            title="BIT/NO BIT Evaluierung"
            onComplete={() => {
              toast.success('BIT Evaluierung abgeschlossen!');
              router.refresh();
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

                {/* Show BL Routing Card for BIT decisions */}
                {bitEvaluationResult.decision.decision === 'bit' && quickScan && (
                  <BLRoutingCard
                    bidId={bid.id}
                    recommendation={{
                      primaryBusinessLine: quickScan.recommendedBusinessUnit || 'Technology & Innovation',
                      confidence: quickScan.confidence || 0,
                      reasoning: quickScan.reasoning || '',
                      alternativeBusinessLines: [],
                      requiredSkills: [],
                    }}
                  />
                )}

                {/* Show Deep Analysis Card for BIT decisions */}
                {bitEvaluationResult.decision.decision === 'bit' && (
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
        {['routed', 'full_scanning', 'bl_reviewing', 'team_assigned', 'notified', 'handed_off'].includes(bid.status) && (() => {
          // Check what data is available for the new components
          const hasDeepAnalysis = bid.deepMigrationAnalysisId !== null;
          const hasTeam = bid.assignedTeam !== null;

          // Parse results if available
          let baselineResult = null;
          let projectPlan = null;
          let notificationResults = null;

          if (bid.baselineComparisonResult) {
            try { baselineResult = JSON.parse(bid.baselineComparisonResult); } catch {}
          }
          if (bid.projectPlanningResult) {
            try { projectPlan = JSON.parse(bid.projectPlanningResult); } catch {}
          }
          if (bid.teamNotifications) {
            try { notificationResults = JSON.parse(bid.teamNotifications); } catch {}
          }

          return (
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
              {['team_assigned', 'notified', 'handed_off'].includes(bid.status) && bid.assignedTeam && (
                <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
                  <CardHeader>
                    <CardTitle className="text-green-900 dark:text-green-100">Team zugewiesen</CardTitle>
                    <CardDescription className="text-green-700 dark:text-green-300">
                      Das Team wurde erfolgreich zugewiesen
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm overflow-auto">{JSON.stringify(JSON.parse(bid.assignedTeam), null, 2)}</pre>
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
                      Alle Phasen wurden erfolgreich durchlaufen. Das Projekt wurde übergeben.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </>
          );
        })()}
        </div>
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)]">
          <DocumentsSidebar bidId={bid.id} />
        </aside>
      </div>
    );
  }

  // Other states - Show extracted data readonly
  if (extractedData) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Extrahierte Anforderungen</CardTitle>
            <CardDescription>
              Von AI extrahierte und bestätigte Daten
            </CardDescription>
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
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)]">
          <DocumentsSidebar bidId={bid.id} />
        </aside>
      </div>
    );
  }

  return null;
}
