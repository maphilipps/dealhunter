'use client';

import { DeepScanProvider } from '@/contexts/deep-scan-context';

interface LeadLayoutClientProps {
  children: React.ReactNode;
  leadId: string;
}

/**
 * Client-side wrapper for Lead layout that provides DeepScan context.
 * This enables the sidebar and audit pages to share the same polling state.
 */
export function LeadLayoutClient({ children, leadId }: LeadLayoutClientProps) {
  return <DeepScanProvider leadId={leadId}>{children}</DeepScanProvider>;
}
