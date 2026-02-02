'use client';

import { Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { PipelineProgress } from '@/components/pitches/pipeline-progress';

interface LeadLayoutClientProps {
  children: React.ReactNode;
  leadId: string;
  /** Pre-resolved from server: ID of an active (non-terminal) run, or null */
  activeRunId: string | null;
}

export function LeadLayoutClient({ children, leadId, activeRunId }: LeadLayoutClientProps) {
  const router = useRouter();

  // No active run → no sidebar, full-width content
  if (!activeRunId) {
    return <div className="h-full w-full">{children}</div>;
  }

  return (
    <div className="flex h-full w-full">
      {/* Main content */}
      <div className="flex-1 min-w-0">{children}</div>

      {/* Pipeline Timeline Sidebar — only shown while a run is active */}
      <div className="shrink-0 w-80 border-l bg-background">
        <div className="flex h-screen flex-col">
          {/* Header */}
          <div className="flex items-center gap-2 border-b px-3 py-2.5">
            <Activity className="h-4 w-4 text-primary" />
            <span className="flex-1 text-sm font-medium">Pipeline-Fortschritt</span>
          </div>

          {/* Timeline */}
          <div className="flex-1 min-h-0">
            <PipelineProgress pitchId={leadId} onComplete={() => router.refresh()} />
          </div>
        </div>
      </div>
    </div>
  );
}
