'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PipelineProgress } from '@/components/pitches/pipeline-progress';
import { PitchChat } from '@/components/pitches/pitch-chat';

interface InterviewClientProps {
  pitchId: string;
  customerName: string;
  /** If a run is already active, show its progress instead of starting a new chat */
  activeRunId: string | null;
}

export function InterviewClient({ pitchId, customerName, activeRunId }: InterviewClientProps) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(activeRunId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pitch-Interview</h1>
        <p className="text-muted-foreground">
          {customerName} — Die KI stellt Fragen, um die Analyse vorzubereiten.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Only show chat if no run is active yet */}
        {!runId ? (
          <PitchChat pitchId={pitchId} onPipelineStarted={id => setRunId(id)} />
        ) : (
          <PipelineProgress
            pitchId={pitchId}
            onComplete={() => router.push(`/pitches/${pitchId}`)}
          />
        )}
      </div>
    </div>
  );
}
