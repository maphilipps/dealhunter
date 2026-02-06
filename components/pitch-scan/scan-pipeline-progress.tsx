'use client';

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

import { Loader } from '@/components/ai-elements/loader';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  usePitchScanProgress,
  type PhaseStatus,
  type PhaseAgent,
  type PitchScanPhase,
} from '@/hooks/use-pitch-scan-progress';
import { PHASE_DEFINITIONS } from '@/lib/pitch-scan/constants';
import { PITCH_SCAN_SECTION_LABELS, type PitchScanSectionId } from '@/lib/pitch-scan/section-ids';
import { cn } from '@/lib/utils';

interface ScanPipelineProgressProps {
  pitchId: string;
  onComplete?: () => void;
  onRetry?: () => void;
}

// ====== Sub-components ======

function PhaseStatusIcon({ status, className }: { status: PhaseStatus; className?: string }) {
  const base = cn('h-4 w-4 shrink-0', className);

  switch (status) {
    case 'completed':
      return <CheckCircle2 className={cn(base, 'text-green-600')} />;
    case 'active':
      return <Loader size="sm" className={cn(base, 'text-primary')} />;
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
      return <Loader size="sm" className={cn(base, 'text-primary')} />;
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

/** Dependency info for a phase — shows which phases it waits for */
function DependencyInfo({ phaseId }: { phaseId: string }) {
  const phaseDef = PHASE_DEFINITIONS.find(d => d.id === phaseId);
  if (!phaseDef || phaseDef.dependencies.length === 0) return null;

  const depLabels = phaseDef.dependencies
    .map(depId => PITCH_SCAN_SECTION_LABELS[depId as PitchScanSectionId])
    .filter(Boolean);

  if (depLabels.length === 0) return null;

  return (
    <p
      className="text-[10px] text-muted-foreground/60 mt-0.5 truncate"
      title={depLabels.join(', ')}
    >
      Wartet auf: {depLabels.join(', ')}
    </p>
  );
}

function PhaseStep({
  phase,
  isLast,
  currentMessage,
}: {
  phase: PitchScanPhase;
  isLast: boolean;
  currentMessage: string | null;
}) {
  const [collapsed, setCollapsed] = useState(phase.status === 'completed');
  const showMessage = phase.status === 'active' && currentMessage;
  const hasAgents = phase.agents.length > 1;

  // Auto-collapse completed phases, auto-expand active ones
  useEffect(() => {
    if (phase.status === 'active') setCollapsed(false);
    if (phase.status === 'completed') setCollapsed(true);
  }, [phase.status]);

  return (
    <div className="relative">
      {/* Phase header */}
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left hover:bg-muted/50 rounded-sm px-1 -mx-1 py-0.5 transition-colors"
        onClick={() => hasAgents && setCollapsed(c => !c)}
      >
        <PhaseStatusIcon status={phase.status} />
        <span
          className={cn(
            'text-sm font-medium flex-1',
            phase.status === 'completed' && 'text-muted-foreground',
            phase.status === 'active' && 'text-foreground',
            phase.status === 'pending' && 'text-muted-foreground/60',
            phase.status === 'failed' && 'text-destructive'
          )}
        >
          {phase.label}
        </span>
        {hasAgents &&
          (collapsed ? (
            <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
          ))}
      </button>

      {/* Agent rows + connector line */}
      <div className={cn('ml-2 pl-4 pt-0.5 pb-1.5', !isLast && 'border-l border-border')}>
        {/* Dependency info for pending phases */}
        {phase.status === 'pending' && <DependencyInfo phaseId={phase.id} />}

        {/* Agent details (collapsible) */}
        {!collapsed && phase.agents.map(agent => <AgentRow key={agent.name} agent={agent} />)}

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

export function ScanPipelineProgress({ pitchId, onComplete, onRetry }: ScanPipelineProgressProps) {
  const { status, progress, phases, currentMessage, error } = usePitchScanProgress(pitchId, {
    onComplete,
  });

  // Auto-scroll only when the active phase changes (not on every SSE event)
  const activePhaseId = useMemo(() => phases.find(p => p.status === 'active')?.id, [phases]);
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activePhaseId]);

  // Count stats
  const completedCount = phases.filter(p => p.status === 'completed').length;
  const totalCount = phases.length;

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
          <Loader size="sm" />
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
        <span className="text-[10px] tabular-nums text-muted-foreground whitespace-nowrap">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Phase stepper */}
      <ScrollArea className="max-h-[60vh]">
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

      {/* Error display with retry */}
      {error && (
        <div className="mx-3 mb-2 space-y-2">
          <div className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            {error}
          </div>
          {onRetry && (
            <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={onRetry}>
              <RefreshCw className="h-3 w-3" />
              Erneut versuchen
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
