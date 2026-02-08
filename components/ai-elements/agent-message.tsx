'use client';

import type { ComponentProps } from 'react';
import { Copy, Check } from 'lucide-react';
import { memo, useState } from 'react';

import { ConfidenceIndicator } from './confidence-indicator';
import { getAgentColorClasses, formatAgentTime } from './constants';
import { Reasoning, ReasoningTrigger, ReasoningContent } from './reasoning';
import { Sources } from './sources';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AgentEvent, AgentProgressData, AgentCompleteData } from '@/lib/streaming/event-types';
import {
  AgentEventType,
  isAgentProgressData,
  isAgentCompleteData,
} from '@/lib/streaming/event-types';

// --- Extracted data helper ---

function extractEventData(event: AgentEvent) {
  const isProgress =
    event.type === AgentEventType.AGENT_PROGRESS && isAgentProgressData(event.data);
  const isComplete =
    event.type === AgentEventType.AGENT_COMPLETE && isAgentCompleteData(event.data);

  if (!isProgress && !isComplete) return null;

  const progressData = isProgress ? (event.data as AgentProgressData) : null;
  const completeData = isComplete ? (event.data as AgentCompleteData) : null;

  return {
    agent: progressData?.agent ?? completeData?.agent ?? 'Unknown',
    message: progressData?.message,
    details: progressData?.details,
    reasoning: progressData?.reasoning,
    toolCalls: progressData?.toolCalls,
    confidence: progressData?.confidence ?? completeData?.confidence,
    sources: progressData?.sources ?? completeData?.sources,
  };
}

// --- Sub-components ---

export type AgentMessageHeaderProps = ComponentProps<'div'> & {
  agent: string;
  timestamp: number;
};

export const AgentMessageHeader = memo(
  ({ agent, timestamp, className, ...props }: AgentMessageHeaderProps) => (
    <div className={cn('flex items-center gap-3', className)} {...props}>
      <span className="text-xs text-muted-foreground font-mono min-w-[70px]">
        {formatAgentTime(timestamp)}
      </span>
      <Badge
        variant="outline"
        className={`${getAgentColorClasses(agent)} font-medium min-w-[100px] justify-center`}
      >
        {agent}
      </Badge>
    </div>
  )
);

AgentMessageHeader.displayName = 'AgentMessageHeader';

export type AgentMessageContentProps = ComponentProps<'div'> & {
  message?: string;
  details?: string;
  confidence?: number;
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  reasoning?: string;
  sources?: Array<{
    type: 'reference' | 'competitor' | 'technology';
    title: string;
    content?: string;
  }>;
};

export const AgentMessageContent = memo(
  ({
    message,
    details,
    confidence,
    toolCalls,
    reasoning,
    sources,
    className,
    ...props
  }: AgentMessageContentProps) => (
    <div className={cn('flex-1 min-w-0', className)} {...props}>
      {message && <p className="text-sm text-foreground font-medium">{message}</p>}

      {details && (
        <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{details}</p>
      )}

      {confidence !== undefined && (
        <div className="mt-2">
          <ConfidenceIndicator confidence={confidence} />
        </div>
      )}

      {toolCalls && toolCalls.length > 0 && (
        <div className="mt-2 space-y-1">
          {toolCalls.map((tool, idx) => (
            <div key={idx} className="text-xs p-2 bg-muted rounded border font-mono">
              <span className="font-semibold">{tool.name}</span>
              <span className="text-muted-foreground">({Object.keys(tool.args).join(', ')})</span>
            </div>
          ))}
        </div>
      )}

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

      {sources && <Sources sources={sources} />}
    </div>
  )
);

AgentMessageContent.displayName = 'AgentMessageContent';

export type AgentMessageActionsProps = ComponentProps<'div'> & {
  onCopy: () => void;
  copied: boolean;
};

export const AgentMessageActions = memo(
  ({ onCopy, copied, className, ...props }: AgentMessageActionsProps) => (
    <div className={cn(className)} {...props}>
      <Button
        variant="ghost"
        size="icon"
        onClick={onCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
      >
        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  )
);

AgentMessageActions.displayName = 'AgentMessageActions';

// --- Root component ---

export interface AgentMessageProps {
  event: AgentEvent;
}

/**
 * TRANS-002 & TRANS-004: Agent Message Component
 * Composition pattern: AgentMessage (Root) + Header + Content + Actions
 */
export const AgentMessage = memo(function AgentMessage({ event }: AgentMessageProps) {
  const [copied, setCopied] = useState(false);

  const data = extractEventData(event);
  if (!data) return null;

  const handleCopy = async () => {
    const text = data.message || JSON.stringify(event.data, null, 2);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group py-3 px-4 hover:bg-muted/50 transition-colors rounded-lg">
      <div className="flex items-start gap-3">
        <AgentMessageHeader agent={data.agent} timestamp={event.timestamp} />

        <AgentMessageContent
          message={data.message}
          details={data.details}
          confidence={data.confidence}
          toolCalls={data.toolCalls}
          reasoning={data.reasoning}
          sources={data.sources}
        />

        <AgentMessageActions onCopy={handleCopy} copied={copied} />
      </div>
    </div>
  );
});

AgentMessage.displayName = 'AgentMessage';
