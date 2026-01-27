'use client';

import { Copy, ChevronDown, Check } from 'lucide-react';
import { useState } from 'react';

import { ConfidenceIndicator } from './confidence-indicator';
import { Sources } from './sources';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { AgentEvent } from '@/lib/streaming/event-types';
import { AgentEventType } from '@/lib/streaming/event-types';

interface AgentMessageProps {
  event: AgentEvent;
}

/**
 * TRANS-002 & TRANS-004: Agent Message Component
 * Displays individual agent outputs with:
 * - Agent icon + label
 * - Message content with tool calls
 * - Reasoning (collapsible)
 * - Message actions (Copy, Expand)
 *
 * Best practice: Extract static JSX outside (rendering-hoist-jsx)
 */
export function AgentMessage({ event }: AgentMessageProps) {
  const [copied, setCopied] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);

  // Only render progress and complete events
  if (
    event.type !== AgentEventType.AGENT_PROGRESS &&
    event.type !== AgentEventType.AGENT_COMPLETE
  ) {
    return null;
  }

  const data = event.data as {
    agent: string;
    message?: string;
    details?: string;
    reasoning?: string;
    toolCalls?: Array<{
      name: string;
      args: Record<string, unknown>;
      result?: unknown;
    }>;
    confidence?: number;
    sources?: Array<{
      type: 'reference' | 'competitor' | 'technology';
      title: string;
      content?: string;
    }>;
  };

  const handleCopy = async () => {
    const text = data.message || JSON.stringify(data, null, 2);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getAgentColor = (agent: string) => {
    const colors: Record<string, string> = {
      Coordinator: 'bg-purple-500/10 text-purple-700 border-purple-200',
      Capability: 'bg-blue-500/10 text-blue-700 border-blue-200',
      'Deal Quality': 'bg-green-500/10 text-green-700 border-green-200',
      'Strategic Fit': 'bg-orange-500/10 text-orange-700 border-orange-200',
      Competition: 'bg-red-500/10 text-red-700 border-red-200',
      'Quick Scan': 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
      Qualification: 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
      // Quick Scan Sub-Agents
      'Website Crawler': 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
      Wappalyzer: 'bg-violet-500/10 text-violet-700 border-violet-200',
      'Sitemap Parser': 'bg-teal-500/10 text-teal-700 border-teal-200',
      'Tech Stack Analyzer': 'bg-blue-500/10 text-blue-700 border-blue-200',
      'Content Analyzer': 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
      'Feature Detector': 'bg-amber-500/10 text-amber-700 border-amber-200',
      'Business Analyst': 'bg-rose-500/10 text-rose-700 border-rose-200',
      'AI Reasoning': 'bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-200',
      Error: 'bg-red-500/10 text-red-700 border-red-200',
      // Intelligent Agent Framework - NEW
      Researcher: 'bg-sky-500/10 text-sky-700 border-sky-200',
      Evaluator: 'bg-lime-500/10 text-lime-700 border-lime-200',
      Optimizer: 'bg-orange-500/10 text-orange-700 border-orange-200',
      'Competition Researcher': 'bg-pink-500/10 text-pink-700 border-pink-200',
      'CMS Researcher': 'bg-teal-500/10 text-teal-700 border-teal-200',
    };
    return colors[agent] || 'bg-gray-500/10 text-gray-700 border-gray-200';
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="group py-3 px-4 hover:bg-muted/50 transition-colors rounded-lg">
      <div className="flex items-start gap-3">
        {/* Timestamp */}
        <span className="text-xs text-muted-foreground font-mono min-w-[70px]">
          {formatTime(event.timestamp)}
        </span>

        {/* Agent Badge */}
        <Badge
          variant="outline"
          className={`${getAgentColor(data.agent)} font-medium min-w-[100px] justify-center`}
        >
          {data.agent}
        </Badge>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Message */}
          {data.message && <p className="text-sm text-foreground font-medium">{data.message}</p>}

          {/* Details (Chain of Thought) */}
          {data.details && (
            <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">
              {data.details}
            </p>
          )}

          {/* Confidence Indicator */}
          {data.confidence !== undefined && (
            <div className="mt-2">
              <ConfidenceIndicator confidence={data.confidence} />
            </div>
          )}

          {/* Tool Calls */}
          {data.toolCalls && data.toolCalls.length > 0 && (
            <div className="mt-2 space-y-1">
              {data.toolCalls.map((tool, idx) => (
                <div key={idx} className="text-xs p-2 bg-muted rounded border font-mono">
                  <span className="font-semibold">{tool.name}</span>
                  <span className="text-muted-foreground">
                    ({Object.keys(tool.args).join(', ')})
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Reasoning (Collapsible) */}
          {data.reasoning && (
            <Collapsible open={reasoningOpen} onOpenChange={setReasoningOpen} className="mt-2">
              <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${reasoningOpen ? 'rotate-180' : ''}`}
                />
                Reasoning
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1">
                <div className="text-xs p-3 bg-muted rounded border">
                  <p className="text-muted-foreground whitespace-pre-wrap">{data.reasoning}</p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Sources */}
          {data.sources && <Sources sources={data.sources} />}
        </div>

        {/* Message Actions */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
