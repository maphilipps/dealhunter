'use client';

import { CheckCircle2, AlertCircle, Lightbulb } from 'lucide-react';
import { memo, useMemo } from 'react';

import { ScanResultCard } from './scan-result-card';

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Loader } from '@/components/ai-elements/loader';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Task, TaskContent, TaskItem, TaskTrigger } from '@/components/ai-elements/task';
import type { TaskStatus } from '@/components/ai-elements/task';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { PitchScanProgressState, PhaseStatus } from '@/hooks/use-pitch-scan-progress';
import {
  PitchScanEventType,
  type PitchScanRawEvent,
} from '@/lib/streaming/in-process/pitch-scan-events';
import { cn } from '@/lib/utils';

const phaseStatusToTaskStatus: Record<PhaseStatus, TaskStatus> = {
  pending: 'pending',
  active: 'in_progress',
  completed: 'completed',
  failed: 'error',
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

const EventItem = memo(function EventItem({
  pitchId,
  type,
  raw,
}: {
  pitchId: string;
  type: string;
  raw: PitchScanRawEvent;
}) {
  if (type === PitchScanEventType.SECTION_RESULT) {
    const sectionId = asString(raw.sectionId) ?? asString(raw.phase) ?? 'unknown-section';
    const label = asString(raw.label) ?? asString(raw.sectionLabel) ?? sectionId;
    const status = (asString(raw.status) as 'completed' | 'failed' | null) ?? 'completed';
    const confidence =
      typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)
        ? raw.confidence
        : undefined;
    const errorMessage = asString(raw.error);

    return (
      <Message from="assistant">
        <MessageContent className="w-full">
          <ScanResultCard
            pitchId={pitchId}
            sectionId={sectionId}
            label={label}
            confidence={confidence}
            status={status}
            errorMessage={errorMessage ?? undefined}
          />
        </MessageContent>
      </Message>
    );
  }

  if (type === PitchScanEventType.PHASE_START) {
    const label = asString(raw.label) ?? asString(raw.phase) ?? 'Phase';
    return (
      <Message from="assistant">
        <MessageContent>
          <div className="flex items-center gap-2 text-sm">
            <Loader size="xs" />
            <span>{label} wird analysiert...</span>
          </div>
        </MessageContent>
      </Message>
    );
  }

  if (type === PitchScanEventType.ERROR) {
    const msg = asString(raw.message) ?? 'Fehler im Pitch Scan';
    return (
      <Message from="assistant">
        <MessageContent>
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Fehler</AlertTitle>
            <AlertDescription>{msg}</AlertDescription>
          </Alert>
        </MessageContent>
      </Message>
    );
  }

  if (type === PitchScanEventType.COMPLETE) {
    const msg = asString(raw.message) ?? 'Pitch Scan abgeschlossen';
    return (
      <Message from="assistant">
        <MessageContent>
          <Alert variant="success">
            <CheckCircle2 className="size-4" />
            <AlertDescription>{msg}</AlertDescription>
          </Alert>
        </MessageContent>
      </Message>
    );
  }

  if (type === PitchScanEventType.CHAT_MESSAGE) {
    const msg = asString(raw.text) ?? asString(raw.message);
    if (!msg) return null;
    return (
      <Message from="assistant">
        <MessageContent>
          <MessageResponse>{msg}</MessageResponse>
        </MessageContent>
      </Message>
    );
  }

  if (type === PitchScanEventType.PLAN_CREATED) {
    const summary = asString(raw.summaryText);
    const enabled = Array.isArray(raw.enabledPhases) ? raw.enabledPhases : null;
    const lines: string[] = [];
    if (summary) lines.push(summary);
    if (enabled && enabled.length > 0) {
      const names = enabled
        .map(p =>
          p && typeof p === 'object' && 'label' in p ? (p as { label?: string }).label : null
        )
        .filter((x): x is string => typeof x === 'string' && x.length > 0);
      if (names.length > 0) lines.push(`Geplante Sektionen: ${names.join(', ')}`);
    }
    const msg = lines.join('\n\n') || 'Analyse-Plan erstellt.';
    return (
      <Message from="assistant">
        <MessageContent>
          <MessageResponse>{msg}</MessageResponse>
        </MessageContent>
      </Message>
    );
  }

  if (type === PitchScanEventType.AGENT_THINKING) {
    const msg = asString(raw.message) ?? asString(raw.text);
    if (!msg) return null;
    const reasoning = asString(raw.reasoning);
    return (
      <Message from="assistant">
        <MessageContent>
          <MessageResponse>{msg}</MessageResponse>
          {reasoning && <p className="mt-1 text-xs text-muted-foreground">{reasoning}</p>}
        </MessageContent>
      </Message>
    );
  }

  if (type === PitchScanEventType.AGENT_FINDING) {
    const msg = asString(raw.message) ?? asString(raw.text);
    if (!msg) return null;
    const confidence =
      typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)
        ? raw.confidence
        : undefined;
    return (
      <Message from="assistant">
        <MessageContent>
          <div className="flex items-start gap-2">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-yellow-500" />
            <div>
              <MessageResponse>{msg}</MessageResponse>
              {confidence !== undefined && (
                <p className="mt-1 text-xs text-muted-foreground">Konfidenz: {confidence}%</p>
              )}
            </div>
          </div>
        </MessageContent>
      </Message>
    );
  }

  // AGENT_COMPLETE etc. are handled implicitly via SECTION_RESULT.
  return null;
});

export const ScanProgressChat = memo(function ScanProgressChat({
  pitchId,
  progress,
}: {
  pitchId: string;
  progress: PitchScanProgressState;
}) {
  const { status, phases, events, error: streamError, progress: percentage } = progress;

  const completedPhaseCount = phases.filter(p => p.status === 'completed').length;

  const visibleEvents = useMemo(() => events, [events]);

  const headerIcon =
    status === 'error' ? (
      <AlertCircle className="size-6 text-destructive" />
    ) : status === 'completed' ? (
      <CheckCircle2 className="size-6 text-muted-foreground" />
    ) : (
      <Loader size="md" />
    );

  const title =
    status === 'error'
      ? 'Pitch Scan fehlgeschlagen'
      : status === 'completed'
        ? 'Pitch Scan abgeschlossen'
        : 'Pitch Scan läuft...';

  const description =
    status === 'error'
      ? 'Es ist ein Fehler aufgetreten'
      : status === 'completed'
        ? 'Ergebnisse werden angezeigt'
        : `Schritt ${Math.min(completedPhaseCount + 1, phases.length)} von ${phases.length}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          {headerIcon}
          <div className="flex-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Fortschritt</span>
            <span className="font-medium">{percentage}%</span>
          </div>
          <Progress
            value={percentage}
            className={cn('h-2', status === 'error' && 'bg-destructive/20')}
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Conversation className="h-[520px]">
          <ConversationContent className="px-4 pb-4">
            <Task defaultOpen={false}>
              <TaskTrigger
                title="Analyse-Schritte"
                completedCount={completedPhaseCount}
                totalCount={phases.length}
              />
              <TaskContent>
                {phases.map(phase => (
                  <TaskItem key={phase.id} status={phaseStatusToTaskStatus[phase.status]}>
                    <div className="min-w-0">
                      <span className="truncate">{phase.label}</span>
                      {phase.status === 'active' && progress.currentMessage && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {progress.currentMessage}
                        </p>
                      )}
                    </div>
                  </TaskItem>
                ))}
              </TaskContent>
            </Task>

            {visibleEvents.map((ev, idx) => (
              <EventItem
                key={`${ev.type}-${ev.timestampMs}-${idx}`}
                pitchId={pitchId}
                type={ev.type}
                raw={ev.raw}
              />
            ))}

            {status === 'running' && (
              <div className="flex items-center gap-2 py-2">
                <Loader size="sm" />
                <span className="text-sm text-muted-foreground">
                  {phases.find(p => p.status === 'active')?.label || 'Wird verarbeitet...'}
                </span>
              </div>
            )}

            {streamError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Fehler aufgetreten</AlertTitle>
                <AlertDescription>{streamError}</AlertDescription>
              </Alert>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </CardContent>
    </Card>
  );
});
