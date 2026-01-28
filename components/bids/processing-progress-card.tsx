'use client';

import { CheckCircle2, Circle, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

/**
 * Processing step definition
 */
interface ProcessingStep {
  id: string;
  label: string;
  description: string;
}

/**
 * Processing status from API
 */
interface ProcessingStatus {
  step: 'extracting' | 'duplicate_checking' | 'scanning' | 'questions' | 'sections' | 'complete';
  progress: number;
  currentTask: string;
  error?: string;
  isComplete: boolean;
  status: string;
}

/**
 * Component props
 */
interface ProcessingProgressCardProps {
  bidId: string;
}

/**
 * Processing steps in order
 */
const PROCESSING_STEPS: ProcessingStep[] = [
  {
    id: 'extracting',
    label: 'Dokumente extrahieren',
    description: 'Text aus PDFs und anderen Dokumenten wird extrahiert',
  },
  {
    id: 'duplicate_checking',
    label: 'Duplikate prüfen',
    description: 'Prüft auf bereits vorhandene ähnliche Anfragen',
  },
  {
    id: 'scanning',
    label: 'Anforderungen analysieren',
    description: 'KI analysiert Website und Projektanforderungen',
  },
  {
    id: 'questions',
    label: '10 Fragen beantworten',
    description: 'Schlüsselantworten werden zusammengestellt',
  },
  {
    id: 'sections',
    label: 'Detailseiten erstellen',
    description: 'Agenten generieren die Sektionen und Visualisierung',
  },
  {
    id: 'complete',
    label: 'Fertig',
    description: 'Verarbeitung abgeschlossen',
  },
];

/**
 * Get step index from step ID
 */
function getStepIndex(stepId: string): number {
  return PROCESSING_STEPS.findIndex(s => s.id === stepId);
}

/**
 * ProcessingProgressCard Component
 *
 * Shows real-time progress of background PreQualification processing.
 * Polls the API every 2 seconds until processing is complete.
 */
export function ProcessingProgressCard({ bidId }: ProcessingProgressCardProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  /**
   * Fetch current processing status
   */
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/pre-qualifications/${bidId}/processing-status`);

      if (!response.ok) {
        throw new Error('Fehler beim Abrufen des Status');
      }

      const data = (await response.json()) as ProcessingStatus;
      setStatus(data);
      setError(null);

      // Stop polling if complete or error
      if (data.isComplete || data.error) {
        setIsPolling(false);

        // Redirect to overview page after completion
        if (data.isComplete) {
          setTimeout(() => {
            router.push(`/pre-qualifications/${bidId}`);
          }, 500);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    }
  }, [bidId, router]);

  /**
   * Poll for status updates
   */
  useEffect(() => {
    // Initial fetch
    void fetchStatus();

    // Set up polling interval
    if (isPolling) {
      const interval = setInterval(() => {
        void fetchStatus();
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
    }
  }, [fetchStatus, isPolling]);

  /**
   * Handle retry button click
   */
  const handleRetry = () => {
    setIsPolling(true);
    setError(null);
    void fetchStatus();
  };

  // Get current step index
  const currentStepIndex = status ? getStepIndex(status.step) : 0;

  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          {status?.error ? (
            <AlertCircle className="h-6 w-6 text-red-500" />
          ) : status?.isComplete ? (
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          ) : (
            <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
          )}
          <div>
            <CardTitle className="text-blue-900 dark:text-blue-100">
              {status?.error
                ? 'Verarbeitung fehlgeschlagen'
                : status?.isComplete
                  ? 'Verarbeitung abgeschlossen'
                  : 'Verarbeitung läuft...'}
            </CardTitle>
            <CardDescription className="text-blue-700 dark:text-blue-300">
              {status?.currentTask || 'Initialisiere...'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Fortschritt</span>
            <span className="font-medium">{status?.progress || 0}%</span>
          </div>
          <Progress value={status?.progress || 0} className="h-2" />
        </div>

        {/* Steps List */}
        <div className="space-y-3">
          {PROCESSING_STEPS.map((step, index) => {
            const isActive = index === currentStepIndex && !status?.isComplete && !status?.error;
            const isCompleted = index < currentStepIndex || status?.isComplete;
            const isPending = index > currentStepIndex;

            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : isCompleted
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-gray-50 dark:bg-gray-800/30'
                }`}
              >
                {/* Step Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-300 dark:text-gray-600" />
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium ${
                      isActive
                        ? 'text-blue-900 dark:text-blue-100'
                        : isCompleted
                          ? 'text-green-900 dark:text-green-100'
                          : isPending
                            ? 'text-gray-400 dark:text-gray-500'
                            : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p
                    className={`text-sm ${
                      isActive || isCompleted
                        ? 'text-muted-foreground'
                        : 'text-gray-400 dark:text-gray-600'
                    }`}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error Message */}
        {status?.error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-900 dark:text-red-100">Fehler aufgetreten</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{status.error}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Erneut versuchen
            </Button>
          </div>
        )}

        {/* Network Error */}
        {error && !status?.error && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-900 dark:text-amber-100">Verbindungsproblem</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{error}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Erneut verbinden
            </Button>
          </div>
        )}

        {/* Completion Message */}
        {status?.isComplete && (
          <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <p className="text-green-900 dark:text-green-100">
                Die Verarbeitung wurde erfolgreich abgeschlossen. Die Seite wird aktualisiert...
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
