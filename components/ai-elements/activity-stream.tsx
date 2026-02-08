'use client';

import type { ComponentProps } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';

import { Loader } from './loader';
import { memo, useRef, useEffect } from 'react';

import { AbortButton } from './abort-button';
import { AgentActivityView } from './agent-activity-view';
import { AgentMessage } from './agent-message';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAgentStream } from '@/hooks/use-agent-stream';
import type { AgentEvent, UrlSuggestionData } from '@/lib/streaming/in-process/event-types';
import { AgentEventType } from '@/lib/streaming/in-process/event-types';

// --- Sub-components ---

export type ActivityStreamErrorProps = ComponentProps<'div'> & {
  error: string;
  urlSuggestion?: UrlSuggestionData | null;
  onUrlSuggestion?: (suggestedUrl: string) => void;
};

export const ActivityStreamError = memo(
  ({ error, urlSuggestion, onUrlSuggestion, className, ...props }: ActivityStreamErrorProps) => (
    <div className={cn(className)} {...props}>
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Fehler</AlertTitle>
        <AlertDescription>
          <p className="text-sm">{error}</p>
          {urlSuggestion && (
            <Alert variant="warning" className="mt-3">
              <AlertDescription>
                <p className="text-sm mb-2">
                  <strong>Vorgeschlagene URL:</strong>
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded break-all">
                    {urlSuggestion.suggestedUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onUrlSuggestion?.(urlSuggestion.suggestedUrl)}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Mit dieser URL scannen
                  </Button>
                </div>
                <p className="text-xs mt-2">{urlSuggestion.reason}</p>
              </AlertDescription>
            </Alert>
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
);

ActivityStreamError.displayName = 'ActivityStreamError';

export type ActivityStreamEmptyProps = ComponentProps<'div'> & {
  isStreaming: boolean;
};

export const ActivityStreamEmpty = memo(
  ({ isStreaming, className, ...props }: ActivityStreamEmptyProps) => (
    <div
      className={cn('flex items-center justify-center h-[400px] text-muted-foreground', className)}
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

ActivityStreamEmpty.displayName = 'ActivityStreamEmpty';

export type ActivityStreamCompleteProps = ComponentProps<'div'>;

export const ActivityStreamComplete = memo(
  ({ className, ...props }: ActivityStreamCompleteProps) => (
    <div className={cn('mt-4', className)} {...props}>
      <Alert variant="success">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Analyse abgeschlossen</AlertTitle>
        <AlertDescription>Alle Agenten haben die Verarbeitung abgeschlossen</AlertDescription>
      </Alert>
    </div>
  )
);

ActivityStreamComplete.displayName = 'ActivityStreamComplete';

// --- Root component ---

export interface ActivityStreamProps {
  streamUrl: string;
  title?: string;
  onComplete?: (decision?: unknown) => void;
  onError?: (error: string) => void;
  /** Callback when a URL suggestion is provided (e.g., redirect target) */
  onUrlSuggestion?: (suggestedUrl: string) => void;
  autoStart?: boolean;
  /** Use grouped agent view instead of flat list */
  grouped?: boolean;
}

/**
 * TRANS-001: Activity Stream Component
 * Composition pattern: ActivityStream (Root) + Error + Empty + Complete
 * Real-time agent activity stream with live updates
 * Best practice: Auto-scroll to bottom using ref (no layout shift)
 */
export const ActivityStream = memo(function ActivityStream({
  streamUrl,
  title = 'Agent Activity',
  onComplete,
  onError,
  onUrlSuggestion,
  autoStart = false,
  grouped = false,
}: ActivityStreamProps) {
  const { events, isStreaming, error, decision, urlSuggestion, start, abort } = useAgentStream();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-start on mount if requested
  useEffect(() => {
    if (autoStart && !isStreaming && events.length === 0) {
      start(streamUrl);
    }
  }, [autoStart, streamUrl, start, isStreaming, events.length]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  // Call onComplete callback when streaming finishes successfully
  useEffect(() => {
    if (!isStreaming && events.length > 0 && !error && onComplete) {
      onComplete(decision);
    }
  }, [isStreaming, events.length, decision, error, onComplete]);

  // Call onError callback when an error occurs
  useEffect(() => {
    if (!isStreaming && error && onError) {
      onError(error);
    }
  }, [isStreaming, error, onError]);

  // Filter events to show only relevant ones
  const visibleEvents = events.filter(
    e => e.type === AgentEventType.AGENT_PROGRESS || e.type === AgentEventType.AGENT_COMPLETE
  );

  // Grouped view - shows agents with collapsible sections
  if (grouped) {
    return (
      <div className="space-y-4">
        {error && (
          <ActivityStreamError
            error={error}
            urlSuggestion={urlSuggestion}
            onUrlSuggestion={onUrlSuggestion}
          />
        )}
        <AgentActivityView events={events} isStreaming={isStreaming} />
        <div ref={bottomRef} />
      </div>
    );
  }

  // Flat list view (default)
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {isStreaming && <Loader size="md" />}
            {title}
          </CardTitle>
          {isStreaming && <AbortButton onAbort={abort} />}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-1">
            {visibleEvents.length === 0 && !error && (
              <ActivityStreamEmpty isStreaming={isStreaming} />
            )}

            {error && (
              <ActivityStreamError
                error={error}
                urlSuggestion={urlSuggestion}
                onUrlSuggestion={onUrlSuggestion}
              />
            )}

            {visibleEvents.map((event: AgentEvent) => (
              <AgentMessage key={event.id} event={event} />
            ))}

            {!isStreaming && visibleEvents.length > 0 && !error && <ActivityStreamComplete />}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
});

ActivityStream.displayName = 'ActivityStream';
