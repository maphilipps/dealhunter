'use client';

import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface RescanButtonProps {
  qualificationId: string;
  stepId: string;
  stepName: string;
  onRescanComplete?: (stepId: string, result: unknown) => void;
}

/**
 * Button to re-scan a single workflow step.
 * Calls the rescan API endpoint and triggers a callback with the new result.
 */
export function RescanButton({
  qualificationId,
  stepId,
  stepName,
  onRescanComplete,
}: RescanButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRescan() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/qualifications/${qualificationId}/qualification-scan/rescan`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stepId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? 'Fehler beim Neu-Scan');
        return;
      }

      if (data.success) {
        onRescanComplete?.(stepId, data.result);
      } else {
        setError(data.error ?? 'Step fehlgeschlagen');
      }
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleRescan}
          disabled={isLoading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="sr-only">{stepName} neu scannen</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : (
          <span>{stepName} neu scannen</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
