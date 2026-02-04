'use client';

import { AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';

import { Loader } from './loader';
import { useRef, useEffect } from 'react';

import { AbortButton } from './abort-button';
import { AgentActivityView } from './agent-activity-view';
import { AgentMessage } from './agent-message';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAgentStream } from '@/hooks/use-agent-stream';
import type { AgentEvent } from '@/lib/streaming/event-types';
import { AgentEventType } from '@/lib/streaming/event-types';

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
 * Real-time agent activity stream with live updates
 * Best practice: Auto-scroll to bottom using ref (no layout shift)
 */
export function ActivityStream({
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
          <Card className="border-red-200">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-900">Fehler</p>
                  <p className="text-sm text-red-700">{error}</p>
                  {urlSuggestion && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                      <p className="text-sm text-amber-800 mb-2">
                        <strong>Vorgeschlagene URL:</strong>
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs bg-amber-100 px-2 py-1 rounded break-all">
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
                      <p className="text-xs text-amber-600 mt-2">{urlSuggestion.reason}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
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
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                {isStreaming ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader size="lg" />
                    <p className="text-sm">Starte Analyse...</p>
                  </div>
                ) : (
                  <p className="text-sm">Noch keine Aktivität</p>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-900">Fehler</p>
                  <p className="text-sm text-red-700">{error}</p>
                  {urlSuggestion && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                      <p className="text-sm text-amber-800 mb-2">
                        <strong>Vorgeschlagene URL:</strong>
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs bg-amber-100 px-2 py-1 rounded break-all">
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
                      <p className="text-xs text-amber-600 mt-2">{urlSuggestion.reason}</p>
                    </div>
                  )}
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
                  <p className="text-sm font-medium text-green-900">Analyse abgeschlossen</p>
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
