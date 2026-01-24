/**
 * Sprint 4.2: Deep Scan Progress UI
 *
 * Real-time progress display for Deep Scan background jobs.
 * Uses SSE via useJobProgress hook.
 */

'use client';

import { useJobProgress } from '@/hooks/use-job-progress';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, PlayCircle, StopCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface DeepScanProgressProps {
  jobId: string;
  leadId: string;
  onComplete?: () => void;
  onCancel?: () => void;
  showCancelButton?: boolean;
}

/**
 * Deep Scan Progress Card
 *
 * Displays real-time progress for a Deep Scan job.
 *
 * @example
 * ```tsx
 * <DeepScanProgress
 *   jobId={job.id}
 *   leadId={lead.id}
 *   onComplete={() => router.refresh()}
 *   showCancelButton
 * />
 * ```
 */
export function DeepScanProgress({
  jobId,
  leadId,
  onComplete,
  onCancel,
  showCancelButton = false,
}: DeepScanProgressProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);

  const { progress, currentStep, phase, completedSteps, status, error, isConnected } =
    useJobProgress(jobId, {
      autoConnect: true,
      onComplete: result => {
        console.log('Deep Scan completed:', result);
        router.refresh(); // Refresh to show results
        onComplete?.();
      },
      onError: error => {
        console.error('Deep Scan error:', error);
      },
      debug: process.env.NODE_ENV === 'development',
    });

  const handleCancel = async () => {
    if (!onCancel || isCancelling) return;

    setIsCancelling(true);
    try {
      await onCancel();
      router.refresh();
    } catch (error) {
      console.error('Failed to cancel job:', error);
    } finally {
      setIsCancelling(false);
    }
  };

  // Status badge
  const StatusBadge = () => {
    switch (status) {
      case 'connecting':
        return (
          <Badge variant="outline" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Verbinde...
          </Badge>
        );
      case 'running':
        return (
          <Badge variant="default" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Läuft
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="gap-1 bg-green-500">
            <CheckCircle2 className="h-3 w-3" />
            Abgeschlossen
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Fehler
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <PlayCircle className="h-3 w-3" />
            Bereit
          </Badge>
        );
    }
  };

  // Phase badge
  const PhaseBadge = () => {
    if (!phase) return null;

    const phaseLabels: Record<string, string> = {
      scraping: 'Phase 1: Scraping',
      phase2: 'Phase 2: Analyse',
      phase3: 'Phase 3: Synthese',
    };

    return (
      <Badge variant="outline" className="ml-2">
        {phaseLabels[phase] || phase}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Deep Scan</CardTitle>
            <StatusBadge />
            <PhaseBadge />
          </div>

          {showCancelButton && status === 'running' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isCancelling}
              className="gap-2"
            >
              {isCancelling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <StopCircle className="h-4 w-4" />
              )}
              Abbrechen
            </Button>
          )}
        </div>

        <CardDescription>
          {status === 'running' && (
            <>
              Umfassende Website-Analyse läuft...
              {!isConnected && (
                <span className="ml-2 text-amber-600">(Verbindung wird wiederhergestellt...)</span>
              )}
            </>
          )}
          {status === 'completed' && 'Analyse erfolgreich abgeschlossen'}
          {status === 'error' && 'Analyse fehlgeschlagen'}
          {status === 'idle' && 'Bereit zum Start'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {status !== 'idle' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Fortschritt</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Current Step */}
        {currentStep && status === 'running' && (
          <div className="rounded-lg bg-muted p-3">
            <div className="flex items-start gap-2">
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">Aktueller Schritt</p>
                <p className="text-sm text-muted-foreground">{currentStep}</p>
              </div>
            </div>
          </div>
        )}

        {/* Completed Steps */}
        {completedSteps.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Abgeschlossene Schritte</p>
            <div className="space-y-1">
              {completedSteps.map((step, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && status === 'error' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Completion Message */}
        {status === 'completed' && (
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-900">
              Deep Scan erfolgreich abgeschlossen. Die Ergebnisse sind jetzt verfügbar.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Inline Progress Bar (for compact display in tables/lists)
 *
 * @example
 * ```tsx
 * <DeepScanProgressInline jobId={job.id} />
 * ```
 */
export function DeepScanProgressInline({ jobId }: { jobId: string }) {
  const { progress, currentStep, status } = useJobProgress(jobId, {
    autoConnect: true,
  });

  if (status === 'idle' || status === 'completed') return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {status === 'running' ? currentStep || 'In Bearbeitung...' : 'Verbinde...'}
          </span>
          <span className="font-medium">{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>
      {status === 'running' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
    </div>
  );
}

/**
 * Mini Progress Badge (for sidebar/notifications)
 *
 * @example
 * ```tsx
 * <DeepScanProgressBadge jobId={job.id} />
 * ```
 */
export function DeepScanProgressBadge({ jobId }: { jobId: string }) {
  const { progress, status } = useJobProgress(jobId, {
    autoConnect: true,
  });

  if (status === 'idle') return null;

  if (status === 'completed') {
    return (
      <Badge variant="default" className="gap-1 bg-green-500">
        <CheckCircle2 className="h-3 w-3" />
        Fertig
      </Badge>
    );
  }

  if (status === 'error') {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        Fehler
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1">
      <Loader2 className="h-3 w-3 animate-spin" />
      {progress}%
    </Badge>
  );
}
