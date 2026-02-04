'use client';

import { Loader } from '@/components/ai-elements/loader';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { PipelineProgress } from '@/components/pitches/pipeline-progress';
import { startPitchScan } from '@/lib/pitches/actions';

interface AutoScanStarterProps {
  pitchId: string;
  customerName: string;
  /** If a run already exists, skip auto-start and show progress directly */
  activeRunId: string | null;
}

export function AutoScanStarter({ pitchId, customerName, activeRunId }: AutoScanStarterProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const [started, setStarted] = useState(!!activeRunId);

  useEffect(() => {
    if (activeRunId || startedRef.current) return;
    startedRef.current = true;

    startPitchScan(pitchId).then(result => {
      if (result.success) {
        setStarted(true);
      } else {
        setError(result.error ?? 'Unbekannter Fehler');
      }
    });
  }, [pitchId, activeRunId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{customerName}</h1>
        <p className="text-muted-foreground">
          Pitch-Analyse läuft — die Ergebnisse erscheinen automatisch.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Fehler beim Starten des Scans: {error}
        </div>
      ) : started ? (
        <PipelineProgress pitchId={pitchId} onComplete={() => router.refresh()} />
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader size="sm" />
          <span>Scan wird gestartet...</span>
        </div>
      )}
    </div>
  );
}
