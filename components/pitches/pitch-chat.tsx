'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Bot, Send, User, Loader2, Sparkles } from 'lucide-react';
import { useRef, useEffect, useState, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const scrollRef = useRef<HTMLDivElement>(null);
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

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-3">
          {visibleMessages.map(message => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <Bot className={`mt-1 shrink-0 text-primary ${compact ? 'h-4 w-4' : 'h-6 w-6'}`} />
              )}
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  compact ? 'max-w-[90%]' : 'max-w-[80%]'
                } ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
              >
                {message.parts.map((part, i) => {
                  if (part.type === 'text') {
                    return (
                      <p key={i} className="whitespace-pre-wrap">
                        {part.text}
                      </p>
                    );
                  }
                  if (part.type === 'dynamic-tool' && part.toolName === 'startPipeline') {
                    return (
                      <div
                        key={i}
                        className="mt-2 flex items-center gap-2 rounded bg-green-50 p-2 text-green-700 dark:bg-green-950 dark:text-green-300"
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs font-medium">Pipeline wird gestartet...</span>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
              {message.role === 'user' && !compact && (
                <User className="mt-1 h-6 w-6 shrink-0 text-muted-foreground" />
              )}
            </div>
          ))}

          {isLoading && visibleMessages[visibleMessages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-2">
              <Bot className={`mt-1 shrink-0 text-primary ${compact ? 'h-4 w-4' : 'h-6 w-6'}`} />
              <div className="rounded-lg bg-muted px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {error && (
        <div className="mx-3 mb-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Fehler: {error.message}
        </div>
      )}

      {/* Suggested prompts for capability discovery */}
      {!compact &&
        !isLoading &&
        visibleMessages.some(m => m.role === 'assistant') &&
        visibleMessages[visibleMessages.length - 1]?.role === 'assistant' && (
          <div className="border-t px-3 py-2">
            <div className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              <span>Schnellantworten</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_PROMPTS.map(prompt => (
                <button
                  key={prompt.label}
                  type="button"
                  onClick={() => {
                    setInput(prompt.description);
                  }}
                  className="rounded-full border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-muted hover:border-primary/50"
                  title={prompt.description}
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        )}

      <form onSubmit={handleSubmit} className="flex shrink-0 gap-2 border-t p-3">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Nachricht eingeben..."
          disabled={isLoading}
          className={compact ? 'h-8 text-sm flex-1' : 'flex-1'}
        />
        <Button
          type="submit"
          size="icon"
          disabled={isLoading || !input.trim()}
          className={compact ? 'h-8 w-8' : ''}
        >
          <Send className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
        </Button>
      </form>
    </div>
  );
}
