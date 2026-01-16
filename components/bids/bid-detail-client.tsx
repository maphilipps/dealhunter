'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { startExtraction, updateExtractedRequirements } from '@/lib/bids/actions';
import { startQuickScan, getQuickScanResult } from '@/lib/quick-scan/actions';
import { startBitEvaluation, getBitEvaluationResult } from '@/lib/bit-evaluation/actions';
import type { BidOpportunity } from '@/lib/db/schema';
import type { BitEvaluationResult } from '@/lib/bit-evaluation/schema';
import { ExtractionPreview } from './extraction-preview';
import { QuickScanResults } from './quick-scan-results';
import { EvaluationProgress } from './evaluation-progress';
import { DecisionCard } from './decision-card';
import { LowConfidenceDialog } from './low-confidence-dialog';
import { BLRoutingCard } from './bl-routing-card';

interface BidDetailClientProps {
  bid: BidOpportunity;
}

export function BidDetailClient({ bid }: BidDetailClientProps) {
  const router = useRouter();
  const [isExtracting, setIsExtracting] = useState(bid.status === 'extracting');
  const [extractedData, setExtractedData] = useState(
    bid.extractedRequirements ? JSON.parse(bid.extractedRequirements) : null
  );
  const [quickScan, setQuickScan] = useState<any>(null);
  const [isLoadingQuickScan, setIsLoadingQuickScan] = useState(false);
  const [bitEvaluationResult, setBitEvaluationResult] = useState<BitEvaluationResult | null>(null);
  const [isLoadingBitEvaluation, setIsLoadingBitEvaluation] = useState(false);
  const [showLowConfidenceDialog, setShowLowConfidenceDialog] = useState(false);

  // Handle extraction start
  const handleStartExtraction = async () => {
    setIsExtracting(true);
    toast.info('Starte AI-Extraktion...');

    try {
      const result = await startExtraction(bid.id);

      if (result.success) {
        toast.success('Extraktion abgeschlossen!');
        setExtractedData(result.requirements);
        setIsExtracting(false);
        router.refresh();
      } else {
        toast.error(result.error || 'Extraktion fehlgeschlagen');
        setIsExtracting(false);
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
      setIsExtracting(false);
    }
  };

  // Handle requirements confirmation
  const handleConfirmRequirements = async (updatedRequirements: any) => {
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

  // Load quick scan if status is quick_scanning or later
  useEffect(() => {
    if (['quick_scanning', 'evaluating', 'bit_decided', 'routed', 'team_assigned'].includes(bid.status)) {
      setIsLoadingQuickScan(true);
      getQuickScanResult(bid.id).then(result => {
        if (result.success && result.quickScan) {
          setQuickScan(result.quickScan);
        }
        setIsLoadingQuickScan(false);
      });
    }
  }, [bid.id, bid.status]);

  // Load BIT evaluation result if status is bit_decided or later
  useEffect(() => {
    if (['bit_decided', 'routed', 'team_assigned'].includes(bid.status)) {
      setIsLoadingBitEvaluation(true);
      getBitEvaluationResult(bid.id).then(result => {
        if (result.success && result.result) {
          setBitEvaluationResult(result.result);

          // Show low confidence dialog if confidence < 70% and not yet confirmed
          if (result.result.decision.overallConfidence < 70 && bid.status === 'bit_decided') {
            setShowLowConfidenceDialog(true);
          }
        }
        setIsLoadingBitEvaluation(false);
      });
    }
  }, [bid.id, bid.status]);

  // Draft state - Show raw input and start extraction button
  if (bid.status === 'draft') {
    return (
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
              {isExtracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extraktion läuft...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI-Extraktion starten
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Extracting state - Show progress
  if (isExtracting || bid.status === 'extracting') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            AI-Extraktion läuft
          </CardTitle>
          <CardDescription>
            Bitte warten, während die AI die Anforderungen analysiert...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full w-2/3 bg-primary animate-pulse" />
              </div>
              <span className="text-sm text-muted-foreground">~30 Sekunden</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Die AI extrahiert Kundenname, Technologien, Anforderungen und weitere Details aus dem Dokument.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Reviewing state - Show extraction preview and edit form
  if (bid.status === 'reviewing' && extractedData) {
    return (
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
    );
  }

  // Quick Scanning or later states - Show Quick Scan results
  if (['quick_scanning', 'evaluating', 'bit_decided', 'routed', 'team_assigned'].includes(bid.status)) {
    return (
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

        {/* Quick Scan Results */}
        {isLoadingQuickScan && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Lade Quick Scan Ergebnisse...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {quickScan && <QuickScanResults quickScan={quickScan} />}

        {/* BIT Evaluation Progress (evaluating status) */}
        {bid.status === 'evaluating' && <EvaluationProgress status="evaluating" />}

        {/* BIT Evaluation Results (bit_decided status) */}
        {bid.status === 'bit_decided' && (
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
                <DecisionCard result={bitEvaluationResult} />

                {/* Show BL Routing Card for BIT decisions */}
                {bitEvaluationResult.decision.decision === 'bit' && quickScan && (
                  <BLRoutingCard
                    bidId={bid.id}
                    recommendation={{
                      primaryBusinessLine: quickScan.recommendedBusinessLine || 'Technology & Innovation',
                      confidence: quickScan.confidence || 0,
                      reasoning: quickScan.reasoning || '',
                      alternativeBusinessLines: [],
                      requiredSkills: [],
                    }}
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
      </div>
    );
  }

  // Other states - Show extracted data readonly
  if (extractedData) {
    return (
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
    );
  }

  return null;
}
