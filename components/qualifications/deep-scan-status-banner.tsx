/**
 * Deep Scan Status Banner
 *
 * Displays a banner at the top of the qualification page showing the current
 * deep scan status. Different banner styles based on status:
 *
 * - pending (yellow): "DeepScan noch nicht ausgeführt" + "Jetzt starten" button
 * - running (blue): Progress bar + "Phase 2: 4/7 Experten"
 * - failed (red): Error message + "Erneut versuchen" button
 * - completed: No banner (or optional success message)
 */

'use client';

import {
  Loader2,
  PlayCircle,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  X,
  Settings2,
} from 'lucide-react';
import { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useDeepScan, EXPERT_DISPLAY_NAMES, ALL_EXPERTS } from '@/contexts/deep-scan-context';

// ============================================================================
// Types
// ============================================================================

export interface DeepScanStatusBannerProps {
  /** Show even when completed (default: false) */
  showWhenComplete?: boolean;
  /** Allow dismissing the banner (default: false) */
  dismissible?: boolean;
  /** Callback when selective re-scan is requested */
  onSelectiveRescan?: () => void;
  /** Whether to show compact version (for mobile) */
  compact?: boolean;
}

// ============================================================================
// Phase Labels
// ============================================================================

const PHASE_LABELS: Record<string, string> = {
  scraping: 'Phase 1: Website-Scraping',
  phase2: 'Phase 2: Expert-Analyse',
  phase3: 'Phase 3: Synthese',
  completed: 'Abgeschlossen',
};

// ============================================================================
// Banner Component
// ============================================================================

export function DeepScanStatusBanner({
  showWhenComplete = false,
  dismissible = false,
  onSelectiveRescan,
  compact = false,
}: DeepScanStatusBannerProps) {
  const {
    status,
    job,
    isInProgress,
    currentPhase,
    currentExpert,
    progress,
    completedExperts,
    error,
    startDeepScan,
  } = useDeepScan();

  const [isStarting, setIsStarting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't render if dismissed
  if (isDismissed) return null;

  // Don't render if completed and showWhenComplete is false
  if (status === 'completed' && !showWhenComplete) return null;

  // Don't render if idle (no scan ever started)
  if (status === 'idle') {
    return <PendingBanner onStart={() => handleStart(false)} isStarting={isStarting} compact={compact} />;
  }

  // Handlers
  async function handleStart(forceReset = false) {
    setIsStarting(true);
    try {
      await startDeepScan(forceReset);
    } finally {
      setIsStarting(false);
    }
  }

  async function handleRetry() {
    setIsStarting(true);
    try {
      await startDeepScan(true); // Force reset on retry
    } finally {
      setIsStarting(false);
    }
  }

  // Render based on status
  switch (status) {
    case 'pending':
      return (
        <PendingBanner
          onStart={() => handleStart(false)}
          isStarting={isStarting}
          compact={compact}
          message="DeepScan wartet in der Warteschlange..."
        />
      );

    case 'running':
      return (
        <RunningBanner
          currentPhase={currentPhase}
          currentExpert={currentExpert}
          progress={progress}
          completedExperts={completedExperts}
          compact={compact}
        />
      );

    case 'failed':
      return (
        <FailedBanner
          error={error?.message || job?.errorMessage || 'Unbekannter Fehler'}
          onRetry={handleRetry}
          isRetrying={isStarting}
          dismissible={dismissible}
          onDismiss={() => setIsDismissed(true)}
          compact={compact}
        />
      );

    case 'completed':
      return (
        <CompletedBanner
          dismissible={dismissible}
          onDismiss={() => setIsDismissed(true)}
          onSelectiveRescan={onSelectiveRescan}
          compact={compact}
        />
      );

    default:
      return null;
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

interface PendingBannerProps {
  onStart: () => void;
  isStarting: boolean;
  compact?: boolean;
  message?: string;
}

function PendingBanner({
  onStart,
  isStarting,
  compact,
  message = 'DeepScan noch nicht ausgeführt',
}: PendingBannerProps) {
  return (
    <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <div className="flex flex-1 items-center justify-between">
        <div>
          <AlertTitle className="text-yellow-800 dark:text-yellow-200">{message}</AlertTitle>
          {!compact && (
            <AlertDescription className="text-yellow-700 dark:text-yellow-300">
              Starten Sie den DeepScan, um eine umfassende Analyse der Website zu erhalten.
            </AlertDescription>
          )}
        </div>
        <Button
          onClick={onStart}
          disabled={isStarting}
          className="ml-4 gap-2 bg-yellow-600 hover:bg-yellow-700"
          size={compact ? 'sm' : 'default'}
        >
          {isStarting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PlayCircle className="h-4 w-4" />
          )}
          {compact ? 'Start' : 'Jetzt starten'}
        </Button>
      </div>
    </Alert>
  );
}

interface RunningBannerProps {
  currentPhase: string | null;
  currentExpert: string | null;
  progress: number;
  completedExperts: string[];
  compact?: boolean;
}

function RunningBanner({
  currentPhase,
  currentExpert,
  progress,
  completedExperts,
  compact,
}: RunningBannerProps) {
  const phaseLabel = currentPhase ? PHASE_LABELS[currentPhase] || currentPhase : 'Läuft';
  const expertLabel = currentExpert ? EXPERT_DISPLAY_NAMES[currentExpert] || currentExpert : null;
  const totalExperts = ALL_EXPERTS.length;

  return (
    <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTitle className="text-blue-800 dark:text-blue-200">DeepScan läuft</AlertTitle>
            <Badge variant="outline" className="border-blue-300 text-blue-700">
              {phaseLabel}
            </Badge>
          </div>
          <span className="text-sm font-medium text-blue-700">
            {completedExperts.length}/{totalExperts} Experten
          </span>
        </div>

        {!compact && (
          <>
            <Progress value={progress} className="h-2" />
            {expertLabel && (
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                Aktuell: {expertLabel}
              </AlertDescription>
            )}
          </>
        )}

        {compact && <Progress value={progress} className="h-1.5" />}
      </div>
    </Alert>
  );
}

interface FailedBannerProps {
  error: string;
  onRetry: () => void;
  isRetrying: boolean;
  dismissible?: boolean;
  onDismiss: () => void;
  compact?: boolean;
}

function FailedBanner({
  error,
  onRetry,
  isRetrying,
  dismissible,
  onDismiss,
  compact,
}: FailedBannerProps) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <div className="flex flex-1 items-center justify-between">
        <div>
          <AlertTitle>DeepScan fehlgeschlagen</AlertTitle>
          {!compact && <AlertDescription className="max-w-2xl truncate">{error}</AlertDescription>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={onRetry}
            disabled={isRetrying}
            variant="outline"
            size={compact ? 'sm' : 'default'}
            className="gap-2"
          >
            {isRetrying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {compact ? 'Retry' : 'Erneut versuchen'}
          </Button>
          {dismissible && (
            <Button variant="ghost" size="icon" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );
}

interface CompletedBannerProps {
  dismissible?: boolean;
  onDismiss: () => void;
  onSelectiveRescan?: () => void;
  compact?: boolean;
}

function CompletedBanner({
  dismissible,
  onDismiss,
  onSelectiveRescan,
  compact,
}: CompletedBannerProps) {
  return (
    <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
      <CheckCircle2 className="h-4 w-4 text-green-600" />
      <div className="flex flex-1 items-center justify-between">
        <div>
          <AlertTitle className="text-green-800 dark:text-green-200">
            DeepScan abgeschlossen
          </AlertTitle>
          {!compact && (
            <AlertDescription className="text-green-700 dark:text-green-300">
              Die Analyse ist vollständig. Alle Sektionen sind jetzt verfügbar.
            </AlertDescription>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onSelectiveRescan && (
            <Button
              onClick={onSelectiveRescan}
              variant="outline"
              size={compact ? 'sm' : 'default'}
              className="gap-2"
            >
              <Settings2 className="h-4 w-4" />
              {compact ? 'Re-Scan' : 'Selektiver Re-Scan'}
            </Button>
          )}
          {dismissible && (
            <Button variant="ghost" size="icon" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );
}

// ============================================================================
// Export
// ============================================================================

export default DeepScanStatusBanner;
