'use client';

import { AlertCircle } from 'lucide-react';

import { Loader } from '@/components/ai-elements/loader';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import { BidTabs } from './bid-tabs';
import { DecisionMatrixTab } from './decision-matrix-tab';
import { FactsTab } from './facts-tab';

import { ActivityStream } from '@/components/ai-elements/activity-stream';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { LeadScan } from '@/lib/db/schema';
import { getQualificationScanResult } from '@/lib/qualification-scan/actions';

interface QualificationScanResultsProps {
  qualificationScan: LeadScan;
  bidId: string;
  onRefresh?: () => void;
}

/** @deprecated Use QualificationScanResultsProps instead */
type QuickScanResultsProps = QualificationScanResultsProps;

/**
 * Qualification Results Component
 * - Running: Shows live ActivityStream with agent feedback
 * - Completed: Shows 2-tab layout (Fakten, Entscheidungsmatrix)
 * - Failed: Shows error state
 */
export function QualificationScanResults({
  qualificationScan: initialQualificationScan,
  bidId,
  onRefresh,
}: QualificationScanResultsProps) {
  const [qualificationScan, setQualificationScan] = useState(initialQualificationScan);
  const [isPolling, setIsPolling] = useState(false);

  // Poll for QualificationScan completion after stream ends
  const pollForCompletion = useCallback(
    (maxAttempts = 20, interval = 2000) => {
      setIsPolling(true);
      let attempts = 0;

      const poll = async () => {
        try {
          const result = await getQualificationScanResult(bidId);

          if (result.success && result.qualificationScan) {
            if (result.qualificationScan.status === 'completed') {
              // Update local state with completed scan
              setQualificationScan(result.qualificationScan);
              setIsPolling(false);

              // Show success toast
              toast.success('Qualification abgeschlossen!', {
                description:
                  'Die Analyse wurde erfolgreich abgeschlossen. Wechsle zur Entscheidungsmatrix...',
                duration: 5000,
              });

              // Auto-navigate to matrix tab after short delay
              setTimeout(() => {
                const url = new URL(window.location.href);
                url.searchParams.set('tab', 'matrix');
                window.history.pushState({}, '', url.toString());
                // Trigger tab change
                window.dispatchEvent(new PopStateEvent('popstate'));
                // Also call onRefresh to update parent
                onRefresh?.();
              }, 1000);

              return; // Stop polling
            } else if (result.qualificationScan.status === 'failed') {
              setQualificationScan(result.qualificationScan);
              setIsPolling(false);
              toast.error('Qualification fehlgeschlagen');
              return;
            }
          }

          // Still running, continue polling
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(() => {
              void poll();
            }, interval);
          } else {
            setIsPolling(false);
            toast.error('Zeitüberschreitung beim Warten auf Qualification-Ergebnisse');
            onRefresh?.();
          }
        } catch (error) {
          console.error('Polling error:', error);
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(() => {
              void poll();
            }, interval);
          } else {
            setIsPolling(false);
          }
        }
      };

      void poll();
    },
    [bidId, onRefresh]
  );

  // Update local state when prop changes
  useEffect(() => {
    setQualificationScan(initialQualificationScan);
  }, [initialQualificationScan]);

  // Running state - Show live Activity Stream
  if (qualificationScan.status === 'running') {
    return (
      <div className="space-y-4">
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader size="md" className="text-blue-600" />
                <CardTitle className="text-blue-900">Qualification läuft</CardTitle>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Live
              </Badge>
            </div>
            <CardDescription className="text-blue-700">
              Analyse der Kunden-Website: {qualificationScan.websiteUrl}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Live Activity Stream - Grouped by Agent */}
        <ActivityStream
          streamUrl={`/api/qualifications/${bidId}/qualification-scan/stream`}
          title="Qualification Agent Activity"
          autoStart={true}
          grouped={true}
          onComplete={() => {
            // Start polling for completion instead of just refreshing
            toast.info('Stream beendet, prüfe Ergebnisse...');
            void pollForCompletion();
          }}
        />

        {/* Show polling indicator */}
        {isPolling && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-2">
                <Loader size="sm" className="text-amber-600" />
                <span className="text-sm text-amber-700">Warte auf Scan-Ergebnisse...</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Failed state
  if (qualificationScan.status === 'failed') {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-red-900">Qualification fehlgeschlagen</CardTitle>
          </div>
          <CardDescription className="text-red-700">
            Bei der Analyse der Website ist ein Fehler aufgetreten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">
            Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Pending state
  if (qualificationScan.status === 'pending') {
    return (
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Loader size="md" className="text-slate-400" />
            <CardTitle className="text-slate-700">Qualification ausstehend</CardTitle>
          </div>
          <CardDescription className="text-slate-500">
            Die Qualification wird in Kürze gestartet...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Completed state - Show tab-based results
  if (qualificationScan.status === 'completed') {
    // Facts Tab Content - All audit data with Re-scan button
    const factsContent = <FactsTab qualificationScan={qualificationScan} bidId={bidId} />;

    // Decision Matrix Tab Content - CMS Evaluation + BL Forwarding
    const matrixContent = <DecisionMatrixTab qualificationScan={qualificationScan} bidId={bidId} />;

    return <BidTabs factsContent={factsContent} matrixContent={matrixContent} />;
  }

  return null;
}

/** @deprecated Use QualificationScanResults instead */
export const QuickScanResults = QualificationScanResults;
