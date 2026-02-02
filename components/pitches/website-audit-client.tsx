'use client';

import { JobProgressCard } from '@/components/background-jobs/job-progress-card';
import { useBackgroundJobStatus } from '@/hooks/use-background-job-status';

interface WebsiteAuditClientProps {
  leadId: string;
  auditStatus: string;
}

export function WebsiteAuditClient({ leadId, auditStatus }: WebsiteAuditClientProps) {
  // Poll when audit is running
  const { job, isLoading } = useBackgroundJobStatus({
    leadId,
    enabled: auditStatus === 'running',
  });

  // Don't show if audit is completed or failed (we show status elsewhere)
  if (!job && !isLoading && auditStatus !== 'running') {
    return null;
  }

  return (
    <JobProgressCard
      job={job}
      title="Website Audit Fortschritt"
      description="Live-Status der Deep-Scan Agents"
      showDetails={true}
    />
  );
}
