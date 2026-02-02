'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Bot, Send, User, Loader2 } from 'lucide-react';
import { useRef, useEffect, useState, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PitchChatProps {
  pitchId: string;
  onPipelineStarted?: (runId: string) => void;
}

export function PitchChat({ pitchId, onPipelineStarted }: PitchChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const pipelineNotifiedRef = useRef(false);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: `/api/pitches/${pitchId}/chat` }),
    [pitchId]
  );

  const { messages, sendMessage, status, error } = useChat({ transport });

  const isLoading = status === 'streaming' || status === 'submitted';

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

  return (
    <Card className="flex h-[600px] flex-col">
      <CardHeader className="shrink-0 border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-primary" />
          Pitch-Interview
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Beantworte ein paar Fragen, damit wir die Analyse starten können.
        </p>
      </CardHeader>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
              <Bot className="h-8 w-8 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">
                Hallo! Ich werde dir ein paar Fragen zum Projekt stellen, um die Analyse
                vorzubereiten. Los geht&apos;s — erzähl mir einfach vom Projekt.
              </p>
            </div>
          )}

          {messages.map(message => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <Bot className="mt-1 h-6 w-6 shrink-0 text-primary" />
              )}
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${
                  message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}
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
              {message.role === 'user' && (
                <User className="mt-1 h-6 w-6 shrink-0 text-muted-foreground" />
              )}
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-3">
              <Bot className="mt-1 h-6 w-6 shrink-0 text-primary" />
              <div className="rounded-lg bg-muted px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {error && (
        <div className="mx-4 mb-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Fehler: {error.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex shrink-0 gap-2 border-t p-4">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Nachricht eingeben..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}
