'use client';

import { PlayCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { JobProgressCard } from '@/components/background-jobs/job-progress-card';
import { Button } from '@/components/ui/button';
import { useBackgroundJobStatus } from '@/hooks/use-background-job-status';

interface LeadOverviewClientProps {
  leadId: string;
  leadStatus: string;
}

export function LeadOverviewClient({ leadId, leadStatus }: LeadOverviewClientProps) {
  const router = useRouter();

  const { job, isLoading } = useBackgroundJobStatus({
    leadId,
    enabled: leadStatus === 'full_scanning',
  });

  async function handleStartDeepScan() {
    try {
      const response = await fetch(`/api/leads/${leadId}/deep-scan`, {
        method: 'POST',
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to start deep scan:', error);
    }
  }

  if (leadStatus !== 'full_scanning') {
    return (
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold leading-none tracking-tight">Deep Analysis</h3>
            <p className="text-sm text-muted-foreground">
              {leadStatus === 'completed'
                ? 'Analyse abgeschlossen. Klicken Sie zum erneuten Starten.'
                : 'Starten Sie die detaillierte Analyse (13 Agents)'}
            </p>
          </div>
          <Button onClick={handleStartDeepScan} disabled={isLoading}>
            <PlayCircle className="mr-2 h-4 w-4" />
            {leadStatus === 'completed' ? 'Deep Scan erneut starten' : 'Deep Scan starten'}
          </Button>
        </div>
      </div>
    );
  }

  if (!job && !isLoading && leadStatus !== 'full_scanning' && leadStatus !== 'failed') {
    return null;
  }

  return (
    <JobProgressCard
      job={job}
      title="Deep Analysis Status"
      description="Fortschritt der Website-Analyse und Deep-Scan Agents"
      showDetails={true}
    />
  );
}
