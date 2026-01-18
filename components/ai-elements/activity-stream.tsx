'use client';

import { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AgentMessage } from './agent-message';
import { AbortButton } from './abort-button';
import { useAgentStream } from '@/hooks/use-agent-stream';
import type { AgentEvent } from '@/lib/streaming/event-types';
import { AgentEventType } from '@/lib/streaming/event-types';

export interface ActivityStreamProps {
  streamUrl: string;
  title?: string;
  onComplete?: (decision?: unknown) => void;
  onError?: (error: string) => void;
  autoStart?: boolean;
}

/**
 * TRANS-001: Activity Stream Component
 * Real-time agent activity stream with live updates
 * Best practice: Auto-scroll to bottom using ref (no layout shift)
 */
export function ActivityStream({
  streamUrl,
  title = 'Agent Activity',
  onComplete,
  onError,
  autoStart = false,
}: ActivityStreamProps) {
  const { events, isStreaming, error, decision, start, abort } =
    useAgentStream();
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
    (e) =>
      e.type === AgentEventType.AGENT_PROGRESS ||
      e.type === AgentEventType.AGENT_COMPLETE
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {isStreaming && <Loader2 className="h-5 w-5 animate-spin" />}
            {title}
          </CardTitle>
          {isStreaming && <AbortButton onAbort={abort} />}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-1">
            {visibleEvents.length === 0 && !error && (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
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

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-900">Fehler</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {visibleEvents.map((event: AgentEvent) => (
              <AgentMessage key={event.id} event={event} />
            ))}

            {!isStreaming && visibleEvents.length > 0 && !error && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg mt-4">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-900">
                    Analyse abgeschlossen
                  </p>
                  <p className="text-sm text-green-700">
                    Alle Agenten haben die Verarbeitung abgeschlossen
                  </p>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
