'use client';

import { CornerDownLeft } from 'lucide-react';
import { useRef, useState, useCallback } from 'react';

import { Loader } from '@/components/ai-elements/loader';
import {
  QualificationScanRenderer,
  type RenderTree,
} from '@/components/json-render/qualification-scan-registry';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  renderTree?: RenderTree;
}

interface ScanChatProps {
  pitchId: string;
  suggestedQuestions?: string[];
}

export function ScanChat({ pitchId, suggestedQuestions = [] }: ScanChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(
    async (question: string) => {
      if (!question.trim() || isLoading) return;

      const userMessage: ChatMessage = { role: 'user', content: question };
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);

      try {
        const res = await fetch(`/api/pitches/${pitchId}/scan/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: question }),
        });

        if (!res.ok) {
          throw new Error('Chat-Anfrage fehlgeschlagen');
        }

        const data = (await res.json()) as { content?: string; renderTree?: RenderTree };

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.content ?? '',
          renderTree: data.renderTree,
        };
        setMessages(prev => [...prev, assistantMessage]);
      } catch {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Fehler bei der Verarbeitung. Bitte versuche es erneut.' },
        ]);
      } finally {
        setIsLoading(false);
        // Scroll to bottom
        setTimeout(() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }, 100);
      }
    },
    [pitchId, isLoading]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Rückfragen zum Scan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Suggested questions */}
        {messages.length === 0 && suggestedQuestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map(q => (
              <Button
                key={q}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => handleSubmit(q)}
                disabled={isLoading}
              >
                {q}
              </Button>
            ))}
          </div>
        )}

        {/* Chat messages */}
        {messages.length > 0 && (
          <ScrollArea className="max-h-[400px]" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div
                    className={
                      msg.role === 'user'
                        ? 'max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground'
                        : 'max-w-[90%] space-y-3'
                    }
                  >
                    {msg.role === 'assistant' && msg.renderTree ? (
                      <QualificationScanRenderer tree={msg.renderTree} />
                    ) : (
                      <p className={msg.role === 'assistant' ? 'text-sm text-foreground' : ''}>
                        {msg.content}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader size="sm" />
                  <span className="text-xs">Analysiere...</span>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Input */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSubmit(input);
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Stelle eine Frage zum Scan..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <CornerDownLeft className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
