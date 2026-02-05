'use client';

import type { ComponentProps } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  Rocket,
  FileStack,
  Search,
  Sparkles,
} from 'lucide-react';

import { Loader } from './loader';
import { memo, useMemo, useState } from 'react';

import {
  getAgentColorClasses,
  getPhaseColorClasses,
  formatAgentTime,
  MIN_EXPECTED_AGENTS,
} from './constants';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { AgentEvent, QuickScanPhase } from '@/lib/streaming/event-types';
import {
  AgentEventType,
  isPhaseStartData,
  isAnalysisCompleteData,
  hasAgentField,
  hasMessageField,
} from '@/lib/streaming/event-types';

// ============================================================================
// Types
// ============================================================================

interface AgentGroup {
  name: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  events: AgentEvent[];
  startTime?: number;
  endTime?: number;
}

interface PhaseInfo {
  phase: QuickScanPhase;
  message: string;
  timestamp: number;
  analyses: Array<{ name: string; success: boolean; duration: number; details?: string }>;
}

export type AgentActivityViewProps = ComponentProps<typeof Card> & {
  events: AgentEvent[];
  isStreaming: boolean;
};

export type AgentActivityHeaderProps = ComponentProps<'div'> & {
  isStreaming: boolean;
  progress: number;
  phaseInfo: PhaseInfo[];
};

export type AgentActivityEmptyProps = ComponentProps<'div'> & {
  isStreaming: boolean;
};

export type AgentActivityGroupProps = ComponentProps<'div'> & {
  group: AgentGroup;
  isExpanded: boolean;
  onToggle: () => void;
  streamStartTime: number;
};

export type AgentActivityCompleteProps = ComponentProps<'div'> & {
  completedCount: number;
  totalCount: number;
};

// ============================================================================
// Helpers
// ============================================================================

function getStatusIcon(status: AgentGroup['status']) {
  switch (status) {
    case 'running':
      return <Loader size="sm" className="text-blue-600" />;
    case 'complete':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function getPhaseIcon(phase: QuickScanPhase) {
  switch (phase) {
    case 'bootstrap':
      return <Rocket className="h-4 w-4" />;
    case 'multi_page':
      return <FileStack className="h-4 w-4" />;
    case 'analysis':
      return <Search className="h-4 w-4" />;
    case 'synthesis':
      return <Sparkles className="h-4 w-4" />;
    default:
      return <Loader size="sm" />;
  }
}

function getPhaseLabel(phase: QuickScanPhase) {
  switch (phase) {
    case 'bootstrap':
      return 'Bootstrap';
    case 'multi_page':
      return 'Multi-Page Fetch';
    case 'analysis':
      return 'Analyse';
    case 'synthesis':
      return 'Synthese';
    default:
      return phase;
  }
}

function formatDuration(streamStartTime: number, _startTime?: number, endTime?: number) {
  if (!endTime && !_startTime) return null;
  const relativeEnd = (endTime || Date.now()) - streamStartTime;
  const durationSec = Math.round(relativeEnd / 1000);
  return `${durationSec}s`;
}

function extractPhaseInfo(events: AgentEvent[]): PhaseInfo[] {
  const phases: PhaseInfo[] = [];
  let currentPhase: PhaseInfo | null = null;

  events.forEach(event => {
    if (event.type === AgentEventType.PHASE_START && isPhaseStartData(event.data)) {
      if (currentPhase) {
        phases.push(currentPhase);
      }
      currentPhase = {
        phase: event.data.phase,
        message: event.data.message,
        timestamp: event.data.timestamp,
        analyses: [],
      };
    } else if (
      event.type === AgentEventType.ANALYSIS_COMPLETE &&
      isAnalysisCompleteData(event.data) &&
      currentPhase
    ) {
      currentPhase.analyses.push({
        name: event.data.analysis,
        success: event.data.success,
        duration: event.data.duration,
        details: event.data.details,
      });
    }
  });

  if (currentPhase) {
    phases.push(currentPhase);
  }

  return phases;
}

const EXPECTED_AGENTS = [
  // Phase 1: Bootstrap
  'Website Crawler',
  'Wappalyzer',
  'Sitemap Parser',
  // Phase 1.2: Multi-Page
  'Link Discovery',
  'Page Sampler',
  'Multi-Page Fetcher',
  'Multi-Page Tech Analyzer',
  'Component Extractor',
  // Phase 1.3: Analysis
  'Tech Stack Analyzer',
  'Content Analyzer',
  'Feature Detector',
  'Coordinator',
  // Intelligent Agent Framework
  'Researcher',
  'Evaluator',
  'Optimizer',
  // Phase 4: Enhanced Audits
  'Playwright',
  'Accessibility Audit',
  'Navigation Analyzer',
  'Performance Analyzer',
  'SEO Audit',
  'Legal Compliance',
  'Company Intelligence',
  'Enhanced Tech Stack',
  'httpx Tech Detection',
  // QuickScan 2.0
  'Content Classifier',
  'Migration Analyzer',
  'Decision Maker Research',
  // Phase 2: Synthesis
  'Business Analyst',
  'AI Reasoning',
];

function groupEventsByAgent(events: AgentEvent[]): AgentGroup[] {
  const groups: Record<string, AgentGroup> = {};

  EXPECTED_AGENTS.forEach(agent => {
    groups[agent] = {
      name: agent,
      status: 'pending',
      events: [],
    };
  });

  events.forEach(event => {
    if (
      event.type !== AgentEventType.AGENT_PROGRESS &&
      event.type !== AgentEventType.AGENT_COMPLETE
    ) {
      return;
    }

    if (!hasAgentField(event.data)) {
      return;
    }

    const agentName = event.data.agent;

    if (!groups[agentName]) {
      groups[agentName] = {
        name: agentName,
        status: 'pending',
        events: [],
      };
    }

    groups[agentName].events.push(event);

    if (!groups[agentName].startTime) {
      groups[agentName].startTime = event.timestamp;
    }

    if (event.type === AgentEventType.AGENT_COMPLETE) {
      groups[agentName].status = 'complete';
      groups[agentName].endTime = event.timestamp;
    } else if (groups[agentName].status !== 'complete') {
      groups[agentName].status = 'running';
    }
  });

  return Object.values(groups).filter(g => g.events.length > 0 || g.status !== 'pending');
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * AgentActivityHeader — Progress bar + phase badges + current phase message.
 */
export const AgentActivityHeader = memo(
  ({ isStreaming, progress, phaseInfo, className, ...props }: AgentActivityHeaderProps) => {
    const currentPhase = phaseInfo.length > 0 ? phaseInfo[phaseInfo.length - 1] : null;

    return (
      <CardHeader className={cn('pb-3', className)} {...props}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            {isStreaming && <Loader size="md" />}
            Agent Aktivität
          </CardTitle>
          <Badge variant="outline" className="font-mono">
            {progress}%
          </Badge>
        </div>
        <Progress value={progress} className="h-2 mt-2" />

        {phaseInfo.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {phaseInfo.map((phase, idx) => {
              const isActive = idx === phaseInfo.length - 1 && isStreaming;
              return (
                <Badge
                  key={phase.phase + '-' + idx}
                  variant="outline"
                  className={`flex items-center gap-1.5 ${getPhaseColorClasses(phase.phase, isActive)}`}
                >
                  {isActive ? <Loader size="xs" /> : getPhaseIcon(phase.phase)}
                  {getPhaseLabel(phase.phase)}
                  {phase.analyses.length > 0 && (
                    <span className="ml-1 text-xs opacity-70">
                      ({phase.analyses.filter(a => a.success).length}/{phase.analyses.length})
                    </span>
                  )}
                </Badge>
              );
            })}
          </div>
        )}

        {currentPhase && (
          <p className="text-sm text-muted-foreground mt-2">{currentPhase.message}</p>
        )}
      </CardHeader>
    );
  }
);
AgentActivityHeader.displayName = 'AgentActivityHeader';

/**
 * AgentActivityEmpty — Loading/idle empty state.
 */
export const AgentActivityEmpty = memo(
  ({ isStreaming, className, ...props }: AgentActivityEmptyProps) => (
    <div
      className={cn('flex items-center justify-center h-32 text-muted-foreground', className)}
      {...props}
    >
      {isStreaming ? (
        <div className="flex flex-col items-center gap-2">
          <Loader size="lg" />
          <p className="text-sm">Starte Analyse...</p>
        </div>
      ) : (
        <p className="text-sm">Noch keine Aktivität</p>
      )}
    </div>
  )
);
AgentActivityEmpty.displayName = 'AgentActivityEmpty';

/**
 * AgentActivityGroup — Single agent collapsible row with expand/collapse.
 */
export const AgentActivityGroup = memo(
  ({
    group,
    isExpanded,
    onToggle,
    streamStartTime,
    className,
    ...props
  }: AgentActivityGroupProps) => (
    <div className={cn(className)} {...props}>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger className="w-full">
          <div
            className={`flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-muted/50 ${
              group.status === 'running'
                ? 'border-[var(--phase-bootstrap-border)] bg-[var(--phase-bootstrap-bg)]/50'
                : ''
            }`}
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(group.status)}
              <Badge
                variant="outline"
                className={`${getAgentColorClasses(group.name)} font-medium`}
              >
                {group.name}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {group.events.length} Nachrichten
              </span>
            </div>
            <div className="flex items-center gap-2">
              {group.startTime && (
                <span className="text-xs text-muted-foreground font-mono">
                  {formatDuration(streamStartTime, group.startTime, group.endTime)}
                </span>
              )}
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-4 mt-1 space-y-1 border-l-2 border-muted pl-4 py-2">
            {group.events.map(event => {
              const message = hasMessageField(event.data)
                ? (event.data as { message?: string }).message
                : undefined;
              return (
                <div key={event.id} className="flex items-start gap-2 text-sm py-1">
                  <span className="text-xs text-muted-foreground font-mono min-w-[60px]">
                    {formatAgentTime(event.timestamp)}
                  </span>
                  <span className="text-foreground">{message || 'Verarbeitung...'}</span>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
);
AgentActivityGroup.displayName = 'AgentActivityGroup';

/**
 * AgentActivityComplete — Completion banner when streaming has finished.
 */
export const AgentActivityComplete = memo(
  ({ completedCount, totalCount, className, ...props }: AgentActivityCompleteProps) => (
    <div
      className={cn(
        'flex items-center gap-3 p-3 bg-[var(--phase-complete-bg)] border border-[var(--phase-complete-border)] rounded-lg mt-4',
        className
      )}
      {...props}
    >
      <CheckCircle2 className="h-5 w-5 text-[var(--phase-complete-text)] flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-[var(--phase-complete-text)]">
          Analyse abgeschlossen
        </p>
        <p className="text-xs text-[var(--phase-complete-text)] opacity-80">
          {completedCount} von {totalCount} Agents fertig
        </p>
      </div>
    </div>
  )
);
AgentActivityComplete.displayName = 'AgentActivityComplete';

// ============================================================================
// Root component
// ============================================================================

/**
 * AgentActivityView — Root component.
 * Groups events by agent name and shows progress per agent.
 */
export const AgentActivityView = memo(function AgentActivityView({
  events,
  isStreaming,
  className,
  ...props
}: AgentActivityViewProps) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  const phaseInfo = useMemo(() => extractPhaseInfo(events), [events]);
  const agentGroups = useMemo(() => groupEventsByAgent(events), [events]);

  const progress = useMemo(() => {
    const completed = agentGroups.filter(g => g.status === 'complete').length;
    const total = Math.max(agentGroups.length, MIN_EXPECTED_AGENTS);
    return Math.round((completed / total) * 100);
  }, [agentGroups]);

  const streamStartTime = useMemo(() => {
    if (events.length === 0) return Date.now();
    return Math.min(...events.map(e => e.timestamp));
  }, [events]);

  const toggleAgent = (agentName: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentName)) {
        next.delete(agentName);
      } else {
        next.add(agentName);
      }
      return next;
    });
  };

  return (
    <Card className={cn(className)} {...props}>
      <AgentActivityHeader isStreaming={isStreaming} progress={progress} phaseInfo={phaseInfo} />
      <CardContent className="space-y-2">
        {agentGroups.length === 0 && <AgentActivityEmpty isStreaming={isStreaming} />}

        {agentGroups.map(group => (
          <AgentActivityGroup
            key={group.name}
            group={group}
            isExpanded={expandedAgents.has(group.name)}
            onToggle={() => toggleAgent(group.name)}
            streamStartTime={streamStartTime}
          />
        ))}

        {!isStreaming && agentGroups.length > 0 && (
          <AgentActivityComplete
            completedCount={agentGroups.filter(g => g.status === 'complete').length}
            totalCount={agentGroups.length}
          />
        )}
      </CardContent>
    </Card>
  );
});
AgentActivityView.displayName = 'AgentActivityView';
