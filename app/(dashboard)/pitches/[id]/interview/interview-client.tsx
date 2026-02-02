'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PitchChat } from '@/components/pitches/pitch-chat';
import { PipelineProgress } from '@/components/pitches/pipeline-progress';

interface InterviewClientProps {
  pitchId: string;
  customerName: string;
}

export function InterviewClient({ pitchId, customerName }: InterviewClientProps) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pitch-Interview</h1>
        <p className="text-muted-foreground">
          {customerName} — Die KI stellt Fragen, um die Analyse vorzubereiten.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PitchChat pitchId={pitchId} onPipelineStarted={id => setRunId(id)} />

        {runId && (
          <PipelineProgress
            pitchId={pitchId}
            runId={runId}
            onComplete={() => router.push(`/pitches/${pitchId}`)}
          />
        )}
      </div>
    </div>
  );
}
