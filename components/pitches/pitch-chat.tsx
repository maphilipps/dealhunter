'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Bot, Sparkles, User } from 'lucide-react';
import { useRef, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Loader } from '@/components/ai-elements/loader';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';

/**
 * Suggested prompts for capability discovery.
 * Users can click these to quickly send common responses during the interview.
 */
const SUGGESTED_PROMPTS = [
  { label: 'Website-Relaunch', description: 'Wir planen einen kompletten Relaunch' },
  { label: 'CMS-Migration', description: 'Wir möchten unser CMS wechseln' },
  { label: 'Performance verbessern', description: 'Die aktuelle Seite ist zu langsam' },
  { label: 'Barrierefreiheit', description: 'WCAG-Konformität ist wichtig für uns' },
] as const;

interface PitchChatProps {
  pitchId: string;
  onPipelineStarted?: (runId: string) => void;
  /** Compact mode for sidebar embedding (smaller, no card wrapper) */
  compact?: boolean;
}

export function PitchChat({ pitchId, onPipelineStarted, compact }: PitchChatProps) {
  const [input, setInput] = useState('');
  const pipelineNotifiedRef = useRef(false);
  const autoStartedRef = useRef(false);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: `/api/pitches/${pitchId}/chat` }),
    [pitchId]
  );

  const { messages, sendMessage, status, error } = useChat({ transport });

  const isLoading = status === 'streaming' || status === 'submitted';

  // Auto-start: AI asks the first question
  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    void sendMessage({ text: 'Bitte starte das Interview.' });
  }, [sendMessage]);

  // Detect startPipeline tool completion
  useEffect(() => {
    if (pipelineNotifiedRef.current) return;

    for (const msg of messages) {
      for (const part of msg.parts) {
        if (
          part.type === 'dynamic-tool' &&
          part.toolName === 'startPipeline' &&
          part.state === 'output-available' &&
          part.output &&
          typeof part.output === 'object' &&
          'runId' in part.output
        ) {
          pipelineNotifiedRef.current = true;
          onPipelineStarted?.((part.output as { runId: string }).runId);
          return;
        }
      }
    }
  }, [messages, onPipelineStarted]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    void sendMessage({ text: input });
    setInput('');
  };

  // Filter out the auto-start trigger from display
  const visibleMessages = messages.filter(
    (msg, idx) =>
      !(
        idx === 0 &&
        msg.role === 'user' &&
        msg.parts.some(p => p.type === 'text' && p.text === 'Bitte starte das Interview.')
      )
  );

  const wrapperClass = compact
    ? 'flex flex-col h-full'
    : 'flex flex-col h-[600px] rounded-lg border bg-card text-card-foreground shadow-sm';

  const showSuggestedPrompts =
    !compact &&
    !isLoading &&
    visibleMessages.some(m => m.role === 'assistant') &&
    visibleMessages[visibleMessages.length - 1]?.role === 'assistant';

  return (
    <div className={wrapperClass}>
      {!compact && (
        <div className="shrink-0 border-b px-4 py-3">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Bot className="h-5 w-5 text-primary" />
            Pitch-Interview
          </h3>
          <p className="text-sm text-muted-foreground">
            Die KI stellt dir ein paar Fragen, um die Analyse vorzubereiten.
          </p>
        </div>
      )}

      <Conversation className={compact ? 'p-2' : 'p-3'}>
        <ConversationContent className={compact ? 'gap-3' : 'gap-4'}>
          {visibleMessages.map(message => (
            <Message key={message.id} from={message.role}>
              <div
                className={`flex gap-2 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {message.role === 'assistant' && (
                  <Bot
                    className={`mt-1 shrink-0 text-primary ${compact ? 'h-4 w-4' : 'h-6 w-6'}`}
                  />
                )}
                <MessageContent
                  className={`rounded-lg px-3 py-2 ${compact ? 'max-w-[90%]' : 'max-w-[80%]'} ${
                    message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  {message.parts.map((part, i) => {
                    if (part.type === 'text') {
                      return <MessageResponse key={i}>{part.text}</MessageResponse>;
                    }
                    if (part.type === 'dynamic-tool' && part.toolName === 'startPipeline') {
                      return (
                        <div
                          key={i}
                          className="mt-2 flex items-center gap-2 rounded bg-green-50 p-2 text-green-700 dark:bg-green-950 dark:text-green-300"
                        >
                          <Loader size="sm" />
                          <span className="text-xs font-medium">Pipeline wird gestartet...</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
                {message.role === 'user' && !compact && (
                  <User className="mt-1 h-6 w-6 shrink-0 text-muted-foreground" />
                )}
              </div>
            </Message>
          ))}

          {isLoading && visibleMessages[visibleMessages.length - 1]?.role !== 'assistant' && (
            <Message from="assistant">
              <div className="flex gap-2">
                <Bot className={`mt-1 shrink-0 text-primary ${compact ? 'h-4 w-4' : 'h-6 w-6'}`} />
                <div className="rounded-lg bg-muted px-3 py-2">
                  <Loader size="sm" className="p-0" />
                </div>
              </div>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error && (
        <div className="mx-3 mb-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Fehler: {error.message}
        </div>
      )}

      {/* Suggested prompts for capability discovery */}
      {showSuggestedPrompts && (
        <div className="border-t px-3 py-2">
          <div className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span>Schnellantworten</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map(prompt => (
              <Button
                key={prompt.label}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setInput(prompt.description);
                }}
                className="h-auto rounded-full px-2.5 py-1 text-xs hover:border-primary/50"
                title={prompt.description}
              >
                {prompt.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <PromptInput onSubmit={handleSubmit} className="shrink-0 border-t p-3">
        <PromptInputTextarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Nachricht eingeben..."
          disabled={isLoading}
          className={compact ? 'min-h-8 text-sm' : ''}
        />
        <PromptInputSubmit status={status} disabled={isLoading || !input.trim()} />
      </PromptInput>
    </div>
  );
}
