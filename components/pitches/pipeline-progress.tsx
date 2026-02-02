'use client';

import { CheckCircle2, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface PipelineProgressProps {
  pitchId: string;
  runId: string;
  onComplete?: () => void;
}

interface RunStatus {
  status: string;
  progress: number;
  currentStep: string | null;
  completedAgents: string[];
}

export function PipelineProgress({ pitchId, runId, onComplete }: PipelineProgressProps) {
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/pitches/${pitchId}/progress`);
        if (!res.ok) return;
        const data = await res.json();

        if (cancelled) return;

        setRunStatus({
          status: data.status ?? 'pending',
          progress: data.progress ?? 0,
          currentStep: data.currentStep ?? null,
          completedAgents: data.completedAgents ? JSON.parse(data.completedAgents) : [],
        });

        if (data.status === 'completed') {
          onComplete?.();
          return;
        }

        if (data.status === 'failed') {
          setError(data.currentStep ?? 'Pipeline fehlgeschlagen');
          return;
        }

        // Continue polling
        setTimeout(() => void poll(), 3000);
      } catch {
        if (!cancelled) {
          setTimeout(() => void poll(), 5000);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [pitchId, runId, onComplete]);

  const statusLabels: Record<string, string> = {
    pending: 'Wartend',
    running: 'Läuft',
    audit_complete: 'Audit abgeschlossen',
    generating: 'Generiert Dokumente',
    waiting_for_user: 'Wartet auf Eingabe',
    review: 'Review',
    completed: 'Abgeschlossen',
    failed: 'Fehlgeschlagen',
  };

  const statusIcon = () => {
    if (!runStatus) return <Clock className="h-4 w-4" />;
    if (runStatus.status === 'completed')
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (runStatus.status === 'failed')
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    return <Loader2 className="h-4 w-4 animate-spin" />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            {statusIcon()}
            Pipeline-Fortschritt
          </span>
          <Badge variant={runStatus?.status === 'completed' ? 'default' : 'secondary'}>
            {statusLabels[runStatus?.status ?? 'pending'] ?? runStatus?.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={runStatus?.progress ?? 0} />

        {runStatus?.currentStep && (
          <p className="text-sm text-muted-foreground">{runStatus.currentStep}</p>
        )}

        {runStatus && runStatus.completedAgents.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {runStatus.completedAgents.map(agent => (
              <Badge key={agent} variant="outline" className="text-xs">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {agent}
              </Badge>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
