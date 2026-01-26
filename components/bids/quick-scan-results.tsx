'use client';

import { Loader2, AlertCircle } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import { BidTabs } from './bid-tabs';
import { DecisionMatrixTab } from './decision-matrix-tab';
import { FactsTab } from './facts-tab';

import { ActivityStream } from '@/components/ai-elements/activity-stream';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { QuickScan } from '@/lib/db/schema';
import { getQuickScanResult } from '@/lib/quick-scan/actions';

interface QuickScanResultsProps {
  quickScan: QuickScan;
  bidId: string;
  onRefresh?: () => void;
}

/**
 * Quick Scan Results Component
 * - Running: Shows live ActivityStream with agent feedback
 * - Completed: Shows 2-tab layout (Fakten, Entscheidungsmatrix)
 * - Failed: Shows error state
 */
export function QuickScanResults({
  quickScan: initialQuickScan,
  bidId,
  onRefresh,
}: QuickScanResultsProps) {
  const [quickScan, setQuickScan] = useState(initialQuickScan);
  const [isPolling, setIsPolling] = useState(false);

  // Poll for QuickScan completion after stream ends
  const pollForCompletion = useCallback(
    (maxAttempts = 20, interval = 2000) => {
      setIsPolling(true);
      let attempts = 0;

      const poll = async () => {
        try {
          const result = await getQuickScanResult(bidId);

          if (result.success && result.quickScan) {
            if (result.quickScan.status === 'completed') {
              // Update local state with completed scan
              setQuickScan(result.quickScan);
              setIsPolling(false);

              // Show success toast
              toast.success('Quick Scan abgeschlossen!', {
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
            } else if (result.quickScan.status === 'failed') {
              setQuickScan(result.quickScan);
              setIsPolling(false);
              toast.error('Quick Scan fehlgeschlagen');
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
            toast.error('Zeitüberschreitung beim Warten auf Quick Scan Ergebnisse');
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
    setQuickScan(initialQuickScan);
  }, [initialQuickScan]);

  // Running state - Show live Activity Stream
  if (quickScan.status === 'running') {
    return (
      <div className="space-y-4">
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <CardTitle className="text-blue-900">Quick Scan läuft</CardTitle>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Live
              </Badge>
            </div>
            <CardDescription className="text-blue-700">
              Analyse der Kunden-Website: {quickScan.websiteUrl}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Live Activity Stream - Grouped by Agent */}
        <ActivityStream
          streamUrl={`/api/pre-qualifications/${bidId}/quick-scan/stream`}
          title="Quick Scan Agent Activity"
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
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                <span className="text-sm text-amber-700">Warte auf Scan-Ergebnisse...</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Failed state
  if (quickScan.status === 'failed') {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-red-900">Quick Scan fehlgeschlagen</CardTitle>
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
  if (quickScan.status === 'pending') {
    return (
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 text-slate-400" />
            <CardTitle className="text-slate-700">Quick Scan ausstehend</CardTitle>
          </div>
          <CardDescription className="text-slate-500">
            Der Quick Scan wird in Kürze gestartet...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Completed state - Show tab-based results
  if (quickScan.status === 'completed') {
    // Facts Tab Content - All audit data with Re-scan button
    const factsContent = <FactsTab quickScan={quickScan} bidId={bidId} />;

    // Decision Matrix Tab Content - CMS Evaluation + BL Forwarding
    const matrixContent = <DecisionMatrixTab quickScan={quickScan} bidId={bidId} />;

    return <BidTabs factsContent={factsContent} matrixContent={matrixContent} />;
  }

  return null;
}
