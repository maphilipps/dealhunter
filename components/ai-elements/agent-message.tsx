'use client';

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

import { ConfidenceIndicator } from './confidence-indicator';
import { getAgentColorClasses, formatAgentTime } from './constants';
import { Reasoning, ReasoningTrigger, ReasoningContent } from './reasoning';
import { Sources } from './sources';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AgentEvent, AgentProgressData, AgentCompleteData } from '@/lib/streaming/event-types';
import {
  AgentEventType,
  isAgentProgressData,
  isAgentCompleteData,
} from '@/lib/streaming/event-types';

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

  // Only render progress and complete events with valid data
  const isProgress =
    event.type === AgentEventType.AGENT_PROGRESS && isAgentProgressData(event.data);
  const isComplete =
    event.type === AgentEventType.AGENT_COMPLETE && isAgentCompleteData(event.data);

  if (!isProgress && !isComplete) {
    return null;
  }

  // Type-safe access: use AgentProgressData for both since it's a superset
  // AgentCompleteData events may not have message/reasoning/toolCalls
  const progressData = isProgress ? (event.data as AgentProgressData) : null;
  const completeData = isComplete ? (event.data as AgentCompleteData) : null;

  // Common fields (both types have agent)
  const agent = progressData?.agent ?? completeData?.agent ?? 'Unknown';
  // Fields that may only exist on progress events
  const message = progressData?.message;
  const details = progressData?.details;
  const reasoning = progressData?.reasoning;
  const toolCalls = progressData?.toolCalls;
  // Fields available on both (optional)
  const confidence = progressData?.confidence ?? completeData?.confidence;
  const sources = progressData?.sources ?? completeData?.sources;

  const handleCopy = async () => {
    const text = message || JSON.stringify(event.data, null, 2);
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
          className={`${getAgentColorClasses(agent)} font-medium min-w-[100px] justify-center`}
        >
          {agent}
        </Badge>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Message */}
          {message && <p className="text-sm text-foreground font-medium">{message}</p>}

          {/* Details (Chain of Thought) */}
          {details && (
            <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{details}</p>
          )}

          {/* Confidence Indicator */}
          {confidence !== undefined && (
            <div className="mt-2">
              <ConfidenceIndicator confidence={confidence} />
            </div>
          )}

          {/* Tool Calls */}
          {toolCalls && toolCalls.length > 0 && (
            <div className="mt-2 space-y-1">
              {toolCalls.map((tool, idx) => (
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
          {reasoning && (
            <Reasoning className="mt-2" defaultOpen={false}>
              <ReasoningTrigger
                className="text-xs"
                getThinkingMessage={() => <span>Begründung</span>}
              />
              <ReasoningContent className="mt-1 text-xs p-3 bg-muted rounded border">
                {reasoning}
              </ReasoningContent>
            </Reasoning>
          )}

          {/* Sources */}
          {sources && <Sources sources={sources} />}
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
