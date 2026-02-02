'use client';

import { Bot, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PipelineProgress } from '@/components/pitches/pipeline-progress';
import { PitchChat } from '@/components/pitches/pitch-chat';
import { Button } from '@/components/ui/button';

interface LeadLayoutClientProps {
  children: React.ReactNode;
  leadId: string;
}

export function LeadLayoutClient({ children, leadId }: LeadLayoutClientProps) {
  const router = useRouter();
  const [chatOpen, setChatOpen] = useState(true);
  const [runId, setRunId] = useState<string | null>(null);

  return (
    <div className="flex h-full w-full">
      {/* Main content + nav sidebar (passed as children) */}
      <div className="flex-1 min-w-0">{children}</div>

      {/* Chat Sidebar (third sidebar) */}
      <div
        className={`shrink-0 border-l bg-background transition-all duration-200 ${
          chatOpen ? 'w-80' : 'w-10'
        }`}
      >
        {chatOpen ? (
          <div className="flex h-screen flex-col">
            {/* Chat Header */}
            <div className="flex items-center gap-2 border-b px-3 py-2.5">
              <Bot className="h-4 w-4 text-primary" />
              <span className="flex-1 text-sm font-medium">Pitch-Interview</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setChatOpen(false)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Pipeline Progress (when active) */}
            {runId && (
              <div className="border-b px-3 py-2">
                <PipelineProgress
                  pitchId={leadId}
                  runId={runId}
                  compact
                  onComplete={() => router.push(`/pitches/${leadId}`)}
                />
              </div>
            )}

            {/* Chat */}
            <div className="flex-1 min-h-0">
              <PitchChat pitchId={leadId} compact onPipelineStarted={id => setRunId(id)} />
            </div>
          </div>
        ) : (
          <div className="flex h-screen flex-col items-center pt-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setChatOpen(true)}
              title="Pitch-Interview öffnen"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="mt-2 [writing-mode:vertical-lr] text-xs text-muted-foreground">
              Pitch-Interview
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
