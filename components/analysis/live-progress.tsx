'use client';

import { useEffect, useState, useCallback } from 'react';

interface LiveProgressProps {
  analysisId: string;
}

interface ProgressUpdate {
  phase: string;
  progress: number;
  message: string;
  timestamp: string;
  agentActivities?: Array<{
    agentName: string;
    action: string;
    message: string;
    timestamp: string;
  }>;
}

export default function LiveProgress({ analysisId }: LiveProgressProps) {
  const [updates, setUpdates] = useState<ProgressUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let mounted = true;

    const connect = () => {
      try {
        eventSource = new EventSource(`/api/analyses/${analysisId}/stream`);

        eventSource.onmessage = (event) => {
          if (!mounted) return;

          try {
            const data = JSON.parse(event.data) as ProgressUpdate;
            setUpdates((prev) => [...prev, data]);
            setError(null);
          } catch (parseError) {
            console.error('Failed to parse SSE data:', parseError);
            setError('Ungültiges Datenformat empfangen');
          }
        };

        eventSource.onerror = (err) => {
          console.error('SSE error:', err);
          if (mounted) {
            setError('Verbindung unterbrochen. Wiederverbindung...');
          }
          // Close and reconnect after delay
          if (eventSource) {
            eventSource.close();
          }
          if (mounted) {
            setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        console.error('Failed to create EventSource:', err);
        if (mounted) {
          setError('Verbindung fehlgeschlagen');
        }
      }
    };

    connect();

    return () => {
      mounted = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [analysisId]);

  if (error) {
    return (
      <p className="text-sm text-amber-600 dark:text-amber-400 text-center">{error}</p>
    );
  }

  if (updates.length === 0) {
    return <p className="text-sm text-slate-500 text-center">Warte auf Updates...</p>;
  }

  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {updates.slice(-5).map((update, index) => (
        <div key={`${update.timestamp}-${index}`} className="text-sm border-l-2 border-slate-200 pl-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{update.phase}</span>
            <span className="text-xs text-slate-500">{update.progress}%</span>
          </div>
          <p className="text-slate-600 dark:text-slate-400">{update.message}</p>
        </div>
      ))}
    </div>
  );
}
