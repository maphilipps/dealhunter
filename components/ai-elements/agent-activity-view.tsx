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
  ListChecks,
  Brain,
  Layers,
  Wrench,
} from 'lucide-react';

import { Loader } from './loader';
import { memo, useMemo, useState } from 'react';
import type { AgentPhase, ActivityTab } from './types';

import { getAgentColorClasses, formatAgentTime, MIN_EXPECTED_AGENTS } from './constants';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { AgentEvent } from '@/lib/streaming/in-process/event-types';
import {
  AgentEventType,
  isPhaseStartData,
  isAnalysisCompleteData,
  hasAgentField,
  hasMessageField,
} from '@/lib/streaming/in-process/event-types';

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

export type AgentActivityViewProps = ComponentProps<typeof Card> & {
  events: AgentEvent[];
  isStreaming: boolean;
  /** Pre-computed phases from any scan type (overrides event-based phase extraction) */
  phases?: AgentPhase[];
  /** Expected agent names for progress calculation (overrides built-in list) */
  expectedAgents?: string[];
  /** Active tab (default: 'agents') */
  defaultTab?: ActivityTab;
};

export type AgentActivityHeaderProps = ComponentProps<'div'> & {
  isStreaming: boolean;
  progress: number;
  phases: AgentPhase[];
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
// Phase icon/label helpers (generic, string-based)
// ============================================================================

const PHASE_ICON_MAP: Record<string, typeof Rocket> = {
  bootstrap: Rocket,
  multi_page: FileStack,
  analysis: Search,
  synthesis: Sparkles,
};

const PHASE_LABEL_MAP: Record<string, string> = {
  bootstrap: 'Bootstrap',
  multi_page: 'Multi-Page Fetch',
  analysis: 'Analyse',
  synthesis: 'Synthese',
};

function getPhaseIcon(phaseId: string) {
  const Icon = PHASE_ICON_MAP[phaseId];
  if (Icon) return <Icon className="h-4 w-4" />;
  return <Loader size="sm" />;
}

function getPhaseLabel(phase: AgentPhase): string {
  return phase.label || PHASE_LABEL_MAP[phase.id] || phase.id;
}

function getPhaseColorClass(phase: AgentPhase, isActive: boolean): string {
  if (!isActive) {
    return 'bg-[var(--phase-complete-bg)] text-[var(--phase-complete-text)] border-[var(--phase-complete-border)]';
  }
  const phaseColorMap: Record<string, string> = {
    bootstrap:
      'bg-[var(--phase-bootstrap-bg)] text-[var(--phase-bootstrap-text)] border-[var(--phase-bootstrap-border)]',
    multi_page:
      'bg-[var(--phase-multipage-bg)] text-[var(--phase-multipage-text)] border-[var(--phase-multipage-border)]',
    analysis:
      'bg-[var(--phase-analysis-bg)] text-[var(--phase-analysis-text)] border-[var(--phase-analysis-border)]',
    synthesis:
      'bg-[var(--phase-synthesis-bg)] text-[var(--phase-synthesis-text)] border-[var(--phase-synthesis-border)]',
  };
  return (
    phaseColorMap[phase.id] ||
    'bg-[var(--phase-complete-bg)] text-[var(--phase-complete-text)] border-[var(--phase-complete-border)]'
  );
}

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

function formatDuration(streamStartTime: number, _startTime?: number, endTime?: number) {
  if (!endTime && !_startTime) return null;
  const relativeEnd = (endTime || Date.now()) - streamStartTime;
  const durationSec = Math.round(relativeEnd / 1000);
  return `${durationSec}s`;
}

/**
 * Extract phases from raw SSE events.
 * Used as fallback when no pre-computed `phases` prop is provided.
 */
function extractPhasesFromEvents(events: AgentEvent[]): AgentPhase[] {
  const phases: AgentPhase[] = [];
  let current: AgentPhase | null = null;

  events.forEach(event => {
    if (event.type === AgentEventType.PHASE_START && isPhaseStartData(event.data)) {
      if (current) {
        current.status = 'complete';
        phases.push(current);
      }
      current = {
        id: event.data.phase,
        label: PHASE_LABEL_MAP[event.data.phase] || event.data.phase,
        status: 'running',
        analyses: [],
        startedAt: event.data.timestamp,
      };
    } else if (
      event.type === AgentEventType.ANALYSIS_COMPLETE &&
      isAnalysisCompleteData(event.data) &&
      current
    ) {
      current.analyses!.push({
        name: event.data.analysis,
        success: event.data.success,
        duration: event.data.duration,
        details: event.data.details,
      });
    }
  });

  if (current) {
    phases.push(current);
  }

  return phases;
}

const DEFAULT_EXPECTED_AGENTS = [
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
  // QualificationScan 2.0
  'Content Classifier',
  'Migration Analyzer',
  'Decision Maker Research',
  // Phase 2: Synthesis
  'Business Analyst',
  'AI Reasoning',
];

function groupEventsByAgent(events: AgentEvent[], expectedAgents: string[]): AgentGroup[] {
  const groups: Record<string, AgentGroup> = {};

  expectedAgents.forEach(agent => {
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
// Tab icon map
// ============================================================================

const TAB_CONFIG: { id: ActivityTab; label: string; icon: typeof Layers }[] = [
  { id: 'agents', label: 'Agents', icon: Layers },
  { id: 'queue', label: 'Queue', icon: ListChecks },
  { id: 'reasoning', label: 'Reasoning', icon: Brain },
  { id: 'tools', label: 'Tools', icon: Wrench },
];

// ============================================================================
// Sub-components
// ============================================================================

/**
 * AgentActivityHeader — Progress bar + phase badges + current phase message.
 * Now accepts generic AgentPhase[] instead of scan-specific types.
 */
export const AgentActivityHeader = memo(
  ({ isStreaming, progress, phases, className, ...props }: AgentActivityHeaderProps) => {
    const currentPhase = phases.length > 0 ? phases[phases.length - 1] : null;

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

        {phases.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {phases.map((phase, idx) => {
              const isActive = idx === phases.length - 1 && isStreaming;
              return (
                <Badge
                  key={phase.id + '-' + idx}
                  variant="outline"
                  className={`flex items-center gap-1.5 ${getPhaseColorClass(phase, isActive)}`}
                >
                  {isActive ? <Loader size="xs" /> : getPhaseIcon(phase.id)}
                  {getPhaseLabel(phase)}
                  {phase.analyses && phase.analyses.length > 0 && (
                    <span className="ml-1 text-xs opacity-70">
                      ({phase.analyses.filter(a => a.success).length}/{phase.analyses.length})
                    </span>
                  )}
                </Badge>
              );
            })}
          </div>
        )}

        {currentPhase && currentPhase.status === 'running' && (
          <p className="text-sm text-muted-foreground mt-2">{currentPhase.label}</p>
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

/**
 * AgentActivityQueueTab — Placeholder for queue view.
 */
const AgentActivityQueueTab = memo(() => (
  <div className="flex items-center justify-center h-32 text-muted-foreground">
    <p className="text-sm">Queue-Ansicht wird in einem zukünftigen Update verfügbar sein.</p>
  </div>
));
AgentActivityQueueTab.displayName = 'AgentActivityQueueTab';

/**
 * AgentActivityReasoningTab — Placeholder for reasoning view.
 */
const AgentActivityReasoningTab = memo(() => (
  <div className="flex items-center justify-center h-32 text-muted-foreground">
    <p className="text-sm">Reasoning-Ansicht wird in einem zukünftigen Update verfügbar sein.</p>
  </div>
));
AgentActivityReasoningTab.displayName = 'AgentActivityReasoningTab';

/**
 * AgentActivityToolsTab — Placeholder for tools view.
 */
const AgentActivityToolsTab = memo(() => (
  <div className="flex items-center justify-center h-32 text-muted-foreground">
    <p className="text-sm">Tools-Ansicht wird in einem zukünftigen Update verfügbar sein.</p>
  </div>
));
AgentActivityToolsTab.displayName = 'AgentActivityToolsTab';

// ============================================================================
// Root component
// ============================================================================

/**
 * AgentActivityView — Root component.
 *
 * Unified view that works with any scan type:
 * - Pass `events` for event-based progress (lead scan / qualifications scan)
 * - Pass `phases` for pre-computed phase data (audit scan)
 * - Pass `expectedAgents` to customize which agents are shown
 *
 * Includes tabs: Agents (default), Queue, Reasoning, Tools
 */
export const AgentActivityView = memo(function AgentActivityView({
  events,
  isStreaming,
  phases: externalPhases,
  expectedAgents,
  defaultTab = 'agents',
  className,
  ...props
}: AgentActivityViewProps) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  // Use external phases if provided, otherwise extract from events
  const phases = useMemo(
    () => externalPhases ?? extractPhasesFromEvents(events),
    [externalPhases, events]
  );

  const agents = expectedAgents ?? DEFAULT_EXPECTED_AGENTS;
  const agentGroups = useMemo(() => groupEventsByAgent(events, agents), [events, agents]);

  const progress = useMemo(() => {
    // If external phases provided, calculate from phase completion
    if (externalPhases) {
      const completed = externalPhases.filter(p => p.status === 'complete').length;
      const total = Math.max(externalPhases.length, 1);
      return Math.round((completed / total) * 100);
    }
    // Otherwise calculate from agent completion
    const completed = agentGroups.filter(g => g.status === 'complete').length;
    const total = Math.max(agentGroups.length, MIN_EXPECTED_AGENTS);
    return Math.round((completed / total) * 100);
  }, [externalPhases, agentGroups]);

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
      <AgentActivityHeader isStreaming={isStreaming} progress={progress} phases={phases} />
      <CardContent className="space-y-2">
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-3">
            {TAB_CONFIG.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-1.5">
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="agents">
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
          </TabsContent>

          <TabsContent value="queue">
            <AgentActivityQueueTab />
          </TabsContent>

          <TabsContent value="reasoning">
            <AgentActivityReasoningTab />
          </TabsContent>

          <TabsContent value="tools">
            <AgentActivityToolsTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
});
AgentActivityView.displayName = 'AgentActivityView';
