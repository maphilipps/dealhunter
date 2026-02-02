'use client';

import { CheckCircle2, Circle, Loader2, AlertTriangle } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  usePitchProgress,
  type PhaseStatus,
  type PhaseAgent,
  type PipelinePhase,
} from '@/hooks/use-pitch-progress';
import { cn } from '@/lib/utils';

interface PipelineProgressProps {
  pitchId: string;
  onComplete?: () => void;
}

// ====== Sub-components ======

function PhaseStatusIcon({ status, className }: { status: PhaseStatus; className?: string }) {
  const base = cn('h-4 w-4 shrink-0', className);

  switch (status) {
    case 'completed':
      return <CheckCircle2 className={cn(base, 'text-green-600')} />;
    case 'active':
      return <Loader2 className={cn(base, 'animate-spin text-primary')} />;
    case 'failed':
      return <AlertTriangle className={cn(base, 'text-destructive')} />;
    default:
      return <Circle className={cn(base, 'text-muted-foreground/40')} />;
  }
}

function AgentStatusIcon({ status, className }: { status: PhaseStatus; className?: string }) {
  const base = cn('h-3 w-3 shrink-0', className);

  switch (status) {
    case 'completed':
      return <CheckCircle2 className={cn(base, 'text-green-600')} />;
    case 'active':
      return <Loader2 className={cn(base, 'animate-spin text-primary')} />;
    case 'failed':
      return <AlertTriangle className={cn(base, 'text-destructive')} />;
    default:
      return <Circle className={cn(base, 'text-muted-foreground/30')} />;
  }
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  return (
    <Badge variant="secondary" className="ml-auto h-4 px-1.5 text-[10px] font-normal tabular-nums">
      {Math.round(confidence)}%
    </Badge>
  );
}

function AgentRow({ agent }: { agent: PhaseAgent }) {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <AgentStatusIcon status={agent.status} />
      <span
        className={cn(
          'text-xs',
          agent.status === 'completed' && 'text-muted-foreground',
          agent.status === 'active' && 'text-foreground',
          agent.status === 'pending' && 'text-muted-foreground/60',
          agent.status === 'failed' && 'text-destructive'
        )}
      >
        {agent.label}
      </span>
      {agent.confidence != null && agent.status === 'completed' && (
        <ConfidenceBadge confidence={agent.confidence} />
      )}
    </div>
  );
}

function PhaseStep({
  phase,
  isLast,
  currentMessage,
}: {
  phase: PipelinePhase;
  isLast: boolean;
  currentMessage: string | null;
}) {
  const showMessage = phase.status === 'active' && currentMessage;

  return (
    <div className="relative">
      {/* Phase header */}
      <div className="flex items-center gap-2">
        <PhaseStatusIcon status={phase.status} />
        <span
          className={cn(
            'text-sm font-medium',
            phase.status === 'completed' && 'text-muted-foreground',
            phase.status === 'active' && 'text-foreground',
            phase.status === 'pending' && 'text-muted-foreground/60',
            phase.status === 'failed' && 'text-destructive'
          )}
        >
          {phase.label}
        </span>
      </div>

      {/* Agent rows + connector line */}
      <div className={cn('ml-2 pl-4 pt-1 pb-2', !isLast && 'border-l border-border')}>
        {phase.agents.map(agent => (
          <AgentRow key={agent.name} agent={agent} />
        ))}

        {/* Live AI status message */}
        {showMessage && (
          <p className="mt-1 text-[11px] italic text-muted-foreground animate-pulse truncate">
            {currentMessage}
          </p>
        )}
      </div>
    </div>
  );
}

// ====== Main component ======

export function PipelineProgress({ pitchId, onComplete }: PipelineProgressProps) {
  const { status, progress, phases, currentMessage, error } = usePitchProgress(pitchId, {
    onComplete,
  });

  // Auto-scroll only when the active phase changes (not on every SSE event)
  const activePhaseId = useMemo(() => phases.find(p => p.status === 'active')?.id, [phases]);
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activePhaseId]);

  // Connecting or waiting for first event
  if (status === 'idle' || status === 'connecting') {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full w-1/4 rounded-full bg-primary/50 animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-4 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Verbindung zur Pipeline wird hergestellt...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Progress bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              status === 'error' ? 'bg-destructive' : 'bg-primary'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground w-7 text-right">
          {progress}%
        </span>
      </div>

      {/* Phase stepper */}
      <ScrollArea className="max-h-[40vh]">
        <div className="px-3 py-3 space-y-0">
          {phases.map((phase, idx) => (
            <div key={phase.id} ref={phase.status === 'active' ? activeRef : undefined}>
              <PhaseStep
                phase={phase}
                isLast={idx === phases.length - 1}
                currentMessage={currentMessage}
              />
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Error display */}
      {error && (
        <div className="mx-3 mb-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
