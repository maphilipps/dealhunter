'use client';

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

import { ConfidenceIndicator } from './confidence-indicator';
import { getAgentColorClasses, formatAgentTime } from './constants';
import { Reasoning, ReasoningTrigger, ReasoningContent } from './reasoning';
import { Sources } from './sources';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

  return (
    <div className="group py-3 px-4 hover:bg-muted/50 transition-colors rounded-lg">
      <div className="flex items-start gap-3">
        {/* Timestamp */}
        <span className="text-xs text-muted-foreground font-mono min-w-[70px]">
          {formatAgentTime(event.timestamp)}
        </span>

        {/* Agent Badge */}
        <Badge
          variant="outline"
          className={`${getAgentColorClasses(data.agent)} font-medium min-w-[100px] justify-center`}
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

          {/* Reasoning */}
          {data.reasoning && (
            <Reasoning className="mt-2" defaultOpen={false}>
              <ReasoningTrigger
                className="text-xs"
                getThinkingMessage={() => <span>Reasoning</span>}
              />
              <ReasoningContent className="mt-1 text-xs p-3 bg-muted rounded border">
                {data.reasoning}
              </ReasoningContent>
            </Reasoning>
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
