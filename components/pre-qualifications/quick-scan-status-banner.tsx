/**
 * Qualification Status Banner
 *
 * Displays a banner showing the current qualification status.
 * Similar to DeepScanStatusBanner but for Qualifications.
 */

'use client';

import { Loader2, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useQuickScan } from '@/contexts/quick-scan-context';

export interface QuickScanStatusBannerProps {
  showWhenComplete?: boolean;
  dismissible?: boolean;
  compact?: boolean;
}

export function QuickScanStatusBanner({
  showWhenComplete = false,
  dismissible = false,
  compact = false,
}: QuickScanStatusBannerProps) {
  const { status, job, isInProgress, progress, currentStep, error } = useQuickScan();
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;
  if (status === 'completed' && !showWhenComplete) return null;

  // Idle state - Qualification not started yet
  if (status === 'idle') {
    return (
      <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <div className="flex flex-1 items-center justify-between">
          <div>
            <AlertTitle className="text-yellow-800 dark:text-yellow-200">
              Qualification läuft noch nicht
            </AlertTitle>
            {!compact && (
              <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                Die Qualification wird automatisch gestartet, sobald Daten vorliegen.
              </AlertDescription>
            )}
          </div>
        </div>
      </Alert>
    );
  }

  // Pending state
  if (status === 'pending') {
    return (
      <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
        <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
        <div>
          <AlertTitle className="text-yellow-800 dark:text-yellow-200">
            Qualification wartet in der Warteschlange...
          </AlertTitle>
        </div>
      </Alert>
    );
  }

  // Running state
  if (status === 'running') {
    return (
      <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-center justify-between">
            <AlertTitle className="text-blue-800 dark:text-blue-200">
              Qualification läuft
            </AlertTitle>
            <span className="text-sm font-medium text-blue-700">{progress}%</span>
          </div>

          {!compact && (
            <>
              <Progress value={progress} className="h-2" />
              {currentStep && (
                <AlertDescription className="text-blue-700 dark:text-blue-300">
                  {currentStep}
                </AlertDescription>
              )}
            </>
          )}

          {compact && <Progress value={progress} className="h-1.5" />}
        </div>
      </Alert>
    );
  }

  // Failed state
  if (status === 'failed') {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <div className="flex flex-1 items-center justify-between">
          <div>
            <AlertTitle>Qualification fehlgeschlagen</AlertTitle>
            {!compact && (
              <AlertDescription className="max-w-2xl truncate">
                {error?.message || job?.errorMessage || 'Unbekannter Fehler'}
              </AlertDescription>
            )}
          </div>
          {dismissible && (
            <button
              className="ml-4 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
              onClick={() => setIsDismissed(true)}
              aria-label="Banner schließen"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </Alert>
    );
  }

  // Completed state
  if (status === 'completed') {
    return (
      <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <div className="flex flex-1 items-center justify-between">
          <div>
            <AlertTitle className="text-green-800 dark:text-green-200">
              Qualification abgeschlossen
            </AlertTitle>
            {!compact && (
              <AlertDescription className="text-green-700 dark:text-green-300">
                Die Analyse ist vollständig.
              </AlertDescription>
            )}
          </div>
          {dismissible && (
            <button
              className="ml-4 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
              onClick={() => setIsDismissed(true)}
              aria-label="Banner schließen"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </Alert>
    );
  }

  return null;
}

export default QuickScanStatusBanner;
