'use client';

import { JobProgressCard } from '@/components/background-jobs/job-progress-card';
import { useBackgroundJobStatus } from '@/hooks/use-background-job-status';

interface LeadOverviewClientProps {
  leadId: string;
  leadStatus: string;
}

export function LeadOverviewClient({ leadId, leadStatus }: LeadOverviewClientProps) {
  // Only poll when lead is in full_scanning status
  const { job, isLoading } = useBackgroundJobStatus({
    leadId,
    enabled: leadStatus === 'full_scanning',
  });

  // Don't show the card if there's no job and we're not loading
  if (!job && !isLoading && leadStatus !== 'full_scanning') {
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
