'use client';

import { JobProgressCard } from '@/components/background-jobs/job-progress-card';
import { useBackgroundJobStatus } from '@/hooks/use-background-job-status';

interface LeadOverviewClientProps {
  leadId: string;
  leadStatus: string;
}

export function LeadOverviewClient({ leadId, leadStatus }: LeadOverviewClientProps) {
  const { job } = useBackgroundJobStatus({
    leadId,
    enabled: leadStatus === 'full_scanning',
  });

  if (leadStatus !== 'full_scanning' || !job) {
    return null;
  }

  return (
    <JobProgressCard
      job={job}
      title="Analyse Status"
      description="Fortschritt der Website-Analyse"
      showDetails={true}
    />
  );
}
