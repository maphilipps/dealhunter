'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
} from 'lucide-react';
import type { AgentEvent } from '@/lib/streaming/event-types';
import { AgentEventType } from '@/lib/streaming/event-types';

interface AgentGroup {
  name: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  events: AgentEvent[];
  startTime?: number;
  endTime?: number;
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

  // Group events by agent name
  const agentGroups = useMemo(() => {
    const groups: Record<string, AgentGroup> = {};

    // Define expected agents for Quick Scan (for progress calculation)
    const expectedAgents = [
      'Website Crawler',
      'Tech Stack Analyzer',
      'Content Analyzer',
      'Feature Detector',
      'Business Analyst',
    ];

    // Initialize expected agents
    expectedAgents.forEach((agent) => {
      groups[agent] = {
        name: agent,
        status: 'pending',
        events: [],
      };
    });

    // Process events
    events.forEach((event) => {
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

    return Object.values(groups).filter((g) => g.events.length > 0 || g.status !== 'pending');
  }, [events]);

  // Calculate overall progress
  const progress = useMemo(() => {
    const completed = agentGroups.filter((g) => g.status === 'complete').length;
    const total = Math.max(agentGroups.length, 5); // At least 5 expected agents
    return Math.round((completed / total) * 100);
  }, [agentGroups]);

  const toggleAgent = (agentName: string) => {
    setExpandedAgents((prev) => {
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
      'Website Crawler': 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
      'Tech Stack Analyzer': 'bg-violet-500/10 text-violet-700 border-violet-200',
      'Content Analyzer': 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
      'Feature Detector': 'bg-amber-500/10 text-amber-700 border-amber-200',
      'Business Analyst': 'bg-rose-500/10 text-rose-700 border-rose-200',
      'AI Reasoning': 'bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-200',
      'Quick Scan': 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
    };
    return colors[agent] || 'bg-gray-500/10 text-gray-700 border-gray-200';
  };

  const formatDuration = (startTime?: number, endTime?: number) => {
    if (!startTime) return null;
    const end = endTime || Date.now();
    const durationMs = end - startTime;
    const seconds = Math.round(durationMs / 1000);
    return `${seconds}s`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
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

        {agentGroups.map((group) => (
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
                  <Badge
                    variant="outline"
                    className={`${getAgentColor(group.name)} font-medium`}
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
                {group.events.map((event) => {
                  const data = event.data as { message?: string };
                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-2 text-sm py-1"
                    >
                      <span className="text-xs text-muted-foreground font-mono min-w-[60px]">
                        {formatTime(event.timestamp)}
                      </span>
                      <span className="text-foreground">
                        {data.message || 'Verarbeitung...'}
                      </span>
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
              <p className="text-sm font-medium text-green-900">
                Analyse abgeschlossen
              </p>
              <p className="text-xs text-green-700">
                {agentGroups.filter((g) => g.status === 'complete').length} von{' '}
                {agentGroups.length} Agents fertig
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
