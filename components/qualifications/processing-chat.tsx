'use client';

import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { memo, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { ProcessingFinding } from './processing-finding';

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { ConfidenceIndicator } from '@/components/ai-elements/confidence-indicator';
import { Loader } from '@/components/ai-elements/loader';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning';
import { Task, TaskTrigger, TaskContent, TaskItem } from '@/components/ai-elements/task';
import type { TaskStatus } from '@/components/ai-elements/task';
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import type { ToolState } from '@/components/ai-elements/tool';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import { useQualificationStream } from '@/hooks/use-qualification-stream';
import type { PhaseStatus } from '@/hooks/use-qualification-stream';

import type { QualificationProcessingEvent } from '@/lib/streaming/qualification-events';
import { QualificationEventType, isVisibleEvent } from '@/lib/streaming/qualification-events';

// ============================================================================
// Props
// ============================================================================

interface ProcessingChatProps {
  qualificationId: string;
}

// ============================================================================
// Helper mappings
// ============================================================================

const phaseStatusToTaskStatus: Record<PhaseStatus, TaskStatus> = {
  pending: 'pending',
  active: 'in_progress',
  completed: 'completed',
  error: 'error',
};

function getToolState(event: QualificationProcessingEvent): ToolState {
  if (event.type === QualificationEventType.TOOL_CALL) {
    return event.data?.toolArgs ? 'input-available' : 'input-streaming';
  }
  if (event.type === QualificationEventType.TOOL_RESULT) {
    return event.data?.error ? 'output-error' : 'output-available';
  }
  return 'input-available';
}

// ============================================================================
// Event renderer
// ============================================================================

const EventItem = memo(function EventItem({ event }: { event: QualificationProcessingEvent }) {
  // Finding events
  if (event.type === QualificationEventType.FINDING && event.data?.finding) {
    return (
      <ProcessingFinding
        type={event.data.finding.type}
        label={event.data.finding.label}
        value={event.data.finding.value}
        confidence={event.data.finding.confidence}
      />
    );
  }

  // Tool events
  if (
    event.type === QualificationEventType.TOOL_CALL ||
    event.type === QualificationEventType.TOOL_RESULT
  ) {
    const toolName = event.data?.toolName || 'tool';
    const state = getToolState(event);
    return (
      <Tool state={state}>
        <ToolHeader toolName={toolName} />
        <ToolContent>
          {event.data?.toolArgs && <ToolInput input={event.data.toolArgs} />}
          {event.data?.toolResult && (
            <ToolOutput output={<MessageResponse>{event.data.toolResult}</MessageResponse>} />
          )}
        </ToolContent>
      </Tool>
    );
  }

  // Agent events with reasoning
  if (event.data?.reasoning) {
    return (
      <div className="space-y-2">
        <Reasoning defaultOpen={false}>
          <ReasoningTrigger />
          <ReasoningContent>{event.data.reasoning}</ReasoningContent>
        </Reasoning>
        {event.data.message && (
          <Message from="assistant">
            <MessageContent>
              <MessageResponse>{event.data.message}</MessageResponse>
            </MessageContent>
          </Message>
        )}
        {event.data.confidence !== undefined && (
          <ConfidenceIndicator confidence={event.data.confidence} size="sm" className="mt-1" />
        )}
      </div>
    );
  }

  // Section quality events
  if (event.type === QualificationEventType.SECTION_QUALITY) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="size-4 text-muted-foreground" />
        <span>{event.data?.sectionLabel || event.data?.sectionId || 'Sektion'}</span>
        {event.data?.confidence !== undefined && (
          <Badge variant="secondary" className="text-xs tabular-nums ml-auto">
            Score: {event.data.confidence}/100
          </Badge>
        )}
      </div>
    );
  }

  // Section events
  if (
    event.type === QualificationEventType.SECTION_COMPLETE ||
    event.type === QualificationEventType.SECTION_START
  ) {
    const label = event.data?.sectionLabel || event.data?.sectionId || 'Sektion';
    const isComplete = event.type === QualificationEventType.SECTION_COMPLETE;
    return (
      <Message from="assistant">
        <MessageContent>
          <div className="flex items-center gap-2 text-sm">
            {isComplete ? (
              <CheckCircle2 className="size-4 text-muted-foreground" />
            ) : (
              <Loader size="xs" />
            )}
            <span>{isComplete ? `${label} abgeschlossen` : `${label} wird erstellt...`}</span>
          </div>
          {isComplete && event.data?.confidence !== undefined && (
            <ConfidenceIndicator confidence={event.data.confidence} size="sm" className="mt-2" />
          )}
        </MessageContent>
      </Message>
    );
  }

  // Default agent message
  if (event.data?.message) {
    return (
      <Message from="assistant">
        <MessageContent>
          <MessageResponse>{event.data.message}</MessageResponse>
          {event.data.confidence !== undefined && (
            <ConfidenceIndicator confidence={event.data.confidence} size="sm" className="mt-2" />
          )}
        </MessageContent>
      </Message>
    );
  }

  return null;
});

// ============================================================================
// Main component
// ============================================================================

export const ProcessingChat = memo(function ProcessingChat({
  qualificationId,
}: ProcessingChatProps) {
  const router = useRouter();
  const { events, phases, isStreaming, isComplete, error, progress, retry } =
    useQualificationStream(qualificationId);

  useEffect(() => {
    if (!isComplete) return;
    const timeout = setTimeout(() => {
      router.push(`/qualifications/${qualificationId}`);
    }, 1500);
    return () => clearTimeout(timeout);
  }, [isComplete, qualificationId, router]);

  const visibleEvents = useMemo(() => events.filter(isVisibleEvent), [events]);

  const completedPhaseCount = phases.filter(p => p.status === 'completed').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          {error ? (
            <AlertCircle className="size-6 text-destructive" />
          ) : isComplete ? (
            <CheckCircle2 className="size-6 text-muted-foreground" />
          ) : (
            <Loader size="md" />
          )}
          <div className="flex-1">
            <CardTitle>
              {error
                ? 'Verarbeitung fehlgeschlagen'
                : isComplete
                  ? 'Verarbeitung abgeschlossen'
                  : 'Verarbeitung läuft...'}
            </CardTitle>
            <CardDescription>
              {error
                ? 'Es ist ein Fehler aufgetreten'
                : isComplete
                  ? 'Die Seite wird aktualisiert...'
                  : `Schritt ${completedPhaseCount + 1} von ${phases.length}`}
            </CardDescription>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Fortschritt</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Conversation className="h-[450px]">
          <ConversationContent className="px-4 pb-4">
            {/* Phase overview as Task list */}
            <Task defaultOpen={false}>
              <TaskTrigger
                title="Verarbeitungsschritte"
                completedCount={completedPhaseCount}
                totalCount={phases.length}
              />
              <TaskContent>
                {phases.map(phase => (
                  <TaskItem key={phase.id} status={phaseStatusToTaskStatus[phase.status]}>
                    <div>
                      <span>{phase.label}</span>
                      {phase.message && phase.status === 'active' && (
                        <p className="text-xs text-muted-foreground mt-0.5">{phase.message}</p>
                      )}
                    </div>
                  </TaskItem>
                ))}
              </TaskContent>
            </Task>

            {/* Agent activity stream */}
            {visibleEvents.map((event, index) => (
              <EventItem key={`${event.type}-${event.timestamp}-${index}`} event={event} />
            ))}

            {/* Live indicator */}
            {isStreaming && !error && (
              <div className="flex items-center gap-2 py-2">
                <Loader size="sm" />
                <span className="text-sm text-muted-foreground">
                  {phases.find(p => p.status === 'active')?.message || 'Wird verarbeitet...'}
                </span>
              </div>
            )}

            {/* Completion */}
            {isComplete && (
              <Alert variant="success">
                <CheckCircle2 className="size-4" />
                <AlertDescription>
                  Die Verarbeitung wurde erfolgreich abgeschlossen. Die Seite wird aktualisiert...
                </AlertDescription>
              </Alert>
            )}

            {/* Error */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Fehler aufgetreten</AlertTitle>
                <AlertDescription>
                  {error}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void retry()}
                    className="mt-3"
                  >
                    <RefreshCw className="size-4 mr-2" />
                    Erneut versuchen
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </CardContent>
    </Card>
  );
});
