'use client';

import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  Rocket,
  FileStack,
  Search,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import type {
  AgentEvent,
  PhaseStartData,
  AnalysisCompleteData,
  QuickScanPhase,
} from '@/lib/streaming/event-types';
import { AgentEventType } from '@/lib/streaming/event-types';

interface AgentGroup {
  name: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  events: AgentEvent[];
  startTime?: number;
  endTime?: number;
}

// Phase info for 2-phase workflow display
interface PhaseInfo {
  phase: QuickScanPhase;
  message: string;
  timestamp: number;
  analyses: Array<{ name: string; success: boolean; duration: number; details?: string }>;
}

interface AgentActivityViewProps {
  events: AgentEvent[];
  isStreaming: boolean;
}

/**
 * Grouped Agent Activity View
 * Groups events by agent name and shows progress per agent
 */
export function AgentActivityView({ events, isStreaming }: AgentActivityViewProps) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  // Extract phase information from events
  const phaseInfo = useMemo(() => {
    const phases: PhaseInfo[] = [];
    let currentPhase: PhaseInfo | null = null;

    events.forEach(event => {
      if (event.type === AgentEventType.PHASE_START && event.data) {
        const data = event.data as PhaseStartData;
        // Save previous phase if exists
        if (currentPhase) {
          phases.push(currentPhase);
        }
        currentPhase = {
          phase: data.phase,
          message: data.message,
          timestamp: data.timestamp,
          analyses: [],
        };
      } else if (event.type === AgentEventType.ANALYSIS_COMPLETE && event.data && currentPhase) {
        const data = event.data as AnalysisCompleteData;
        currentPhase.analyses.push({
          name: data.analysis,
          success: data.success,
          duration: data.duration,
          details: data.details,
        });
      }
    });

    // Add current phase if exists
    if (currentPhase) {
      phases.push(currentPhase);
    }

    return phases;
  }, [events]);

  // Get current phase for header display
  const currentPhase = phaseInfo.length > 0 ? phaseInfo[phaseInfo.length - 1] : null;

  // Group events by agent name
  const agentGroups = useMemo(() => {
    const groups: Record<string, AgentGroup> = {};

    // Define expected agents for Quick Scan (for progress calculation)
    // Includes all agents from 2-Phase QuickScan Workflow
    const expectedAgents = [
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

    // Initialize expected agents
    expectedAgents.forEach(agent => {
      groups[agent] = {
        name: agent,
        status: 'pending',
        events: [],
      };
    });

    // Process events
    events.forEach(event => {
      if (
        event.type !== AgentEventType.AGENT_PROGRESS &&
        event.type !== AgentEventType.AGENT_COMPLETE
      ) {
        return;
      }

      const data = event.data as { agent: string; message?: string };
      const agentName = data.agent;

      if (!groups[agentName]) {
        groups[agentName] = {
          name: agentName,
          status: 'pending',
          events: [],
        };
      }

      groups[agentName].events.push(event);

      // Track timing
      if (!groups[agentName].startTime) {
        groups[agentName].startTime = event.timestamp;
      }

      // Update status
      if (event.type === AgentEventType.AGENT_COMPLETE) {
        groups[agentName].status = 'complete';
        groups[agentName].endTime = event.timestamp;
      } else if (groups[agentName].status !== 'complete') {
        groups[agentName].status = 'running';
      }
    });

    return Object.values(groups).filter(g => g.events.length > 0 || g.status !== 'pending');
  }, [events]);

  // Calculate overall progress
  const progress = useMemo(() => {
    const completed = agentGroups.filter(g => g.status === 'complete').length;
    const total = Math.max(agentGroups.length, 5); // At least 5 expected agents
    return Math.round((completed / total) * 100);
  }, [agentGroups]);

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

  const getStatusIcon = (status: AgentGroup['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getAgentColor = (agent: string) => {
    const colors: Record<string, string> = {
      // Phase 1: Bootstrap
      'Website Crawler': 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
      Wappalyzer: 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
      'Sitemap Parser': 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
      // Phase 1.2: Multi-Page
      'Link Discovery': 'bg-purple-500/10 text-purple-700 border-purple-200',
      'Page Sampler': 'bg-purple-500/10 text-purple-700 border-purple-200',
      'Multi-Page Fetcher': 'bg-purple-500/10 text-purple-700 border-purple-200',
      'Multi-Page Tech Analyzer': 'bg-purple-500/10 text-purple-700 border-purple-200',
      'Component Extractor': 'bg-purple-500/10 text-purple-700 border-purple-200',
      // Phase 1.3: Analysis
      'Tech Stack Analyzer': 'bg-violet-500/10 text-violet-700 border-violet-200',
      'Content Analyzer': 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
      'Feature Detector': 'bg-amber-500/10 text-amber-700 border-amber-200',
      Coordinator: 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
      // Intelligent Agent Framework
      Researcher: 'bg-sky-500/10 text-sky-700 border-sky-200',
      Evaluator: 'bg-lime-500/10 text-lime-700 border-lime-200',
      Optimizer: 'bg-orange-500/10 text-orange-700 border-orange-200',
      // Phase 4: Enhanced Audits
      Playwright: 'bg-teal-500/10 text-teal-700 border-teal-200',
      'Accessibility Audit': 'bg-teal-500/10 text-teal-700 border-teal-200',
      'Navigation Analyzer': 'bg-teal-500/10 text-teal-700 border-teal-200',
      'Performance Analyzer': 'bg-teal-500/10 text-teal-700 border-teal-200',
      'SEO Audit': 'bg-teal-500/10 text-teal-700 border-teal-200',
      'Legal Compliance': 'bg-teal-500/10 text-teal-700 border-teal-200',
      'Company Intelligence': 'bg-blue-500/10 text-blue-700 border-blue-200',
      'Enhanced Tech Stack': 'bg-violet-500/10 text-violet-700 border-violet-200',
      'httpx Tech Detection': 'bg-violet-500/10 text-violet-700 border-violet-200',
      // QuickScan 2.0
      'Content Classifier': 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
      'Migration Analyzer': 'bg-amber-500/10 text-amber-700 border-amber-200',
      'Decision Maker Research': 'bg-blue-500/10 text-blue-700 border-blue-200',
      // Phase 2: Synthesis
      'Business Analyst': 'bg-rose-500/10 text-rose-700 border-rose-200',
      'AI Reasoning': 'bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-200',
      'Quick Scan': 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
    };
    return colors[agent] || 'bg-gray-500/10 text-gray-700 border-gray-200';
  };

  // Calculate earliest timestamp from all events for relative timing
  const streamStartTime = useMemo(() => {
    if (events.length === 0) return Date.now();
    return Math.min(...events.map(e => e.timestamp));
  }, [events]);

  const formatDuration = (_startTime?: number, endTime?: number) => {
    if (!endTime && !_startTime) return null;
    // Calculate duration relative to stream start for meaningful times
    // This ensures agents show their completion time from scan start
    const relativeEnd = (endTime || Date.now()) - streamStartTime;
    const durationSec = Math.round(relativeEnd / 1000);
    // Show completion time from stream start, not internal duration
    return `${durationSec}s`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getPhaseIcon = (phase: QuickScanPhase) => {
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
        return <Loader2 className="h-4 w-4" />;
    }
  };

  const getPhaseLabel = (phase: QuickScanPhase) => {
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
  };

  const getPhaseColor = (phase: QuickScanPhase, isActive: boolean) => {
    if (!isActive) return 'bg-green-100 text-green-800 border-green-200';
    switch (phase) {
      case 'bootstrap':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'multi_page':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'analysis':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'synthesis':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            {isStreaming && <Loader2 className="h-5 w-5 animate-spin" />}
            Agent Aktivität
          </CardTitle>
          <Badge variant="outline" className="font-mono">
            {progress}%
          </Badge>
        </div>
        <Progress value={progress} className="h-2 mt-2" />

        {/* Phase Indicators - 2-Phase Workflow */}
        {phaseInfo.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {phaseInfo.map((phase, idx) => {
              const isActive = idx === phaseInfo.length - 1 && isStreaming;
              return (
                <Badge
                  key={phase.phase + '-' + idx}
                  variant="outline"
                  className={`flex items-center gap-1.5 ${getPhaseColor(phase.phase, isActive)}`}
                >
                  {isActive ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    getPhaseIcon(phase.phase)
                  )}
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

        {/* Current Phase Message */}
        {currentPhase && (
          <p className="text-sm text-muted-foreground mt-2">{currentPhase.message}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {agentGroups.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            {isStreaming ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Starte Analyse...</p>
              </div>
            ) : (
              <p className="text-sm">Noch keine Aktivität</p>
            )}
          </div>
        )}

        {agentGroups.map(group => (
          <Collapsible
            key={group.name}
            open={expandedAgents.has(group.name)}
            onOpenChange={() => toggleAgent(group.name)}
          >
            <CollapsibleTrigger className="w-full">
              <div
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-muted/50 ${
                  group.status === 'running' ? 'border-blue-200 bg-blue-50/50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(group.status)}
                  <Badge variant="outline" className={`${getAgentColor(group.name)} font-medium`}>
                    {group.name}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {group.events.length} Nachrichten
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {group.startTime && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatDuration(group.startTime, group.endTime)}
                    </span>
                  )}
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      expandedAgents.has(group.name) ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-muted pl-4 py-2">
                {group.events.map(event => {
                  const data = event.data as { message?: string };
                  return (
                    <div key={event.id} className="flex items-start gap-2 text-sm py-1">
                      <span className="text-xs text-muted-foreground font-mono min-w-[60px]">
                        {formatTime(event.timestamp)}
                      </span>
                      <span className="text-foreground">{data.message || 'Verarbeitung...'}</span>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}

        {!isStreaming && agentGroups.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg mt-4">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-900">Analyse abgeschlossen</p>
              <p className="text-xs text-green-700">
                {agentGroups.filter(g => g.status === 'complete').length} von {agentGroups.length}{' '}
                Agents fertig
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
