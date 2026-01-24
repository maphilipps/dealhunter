'use client';

import { DeepScanProvider } from '@/contexts/deep-scan-context';

interface LeadLayoutClientProps {
  children: React.ReactNode;
}

/**
 * Client-side wrapper for Lead layout that provides DeepScan context.
 * This enables the sidebar and audit pages to share the same stream state.
 */
export function LeadLayoutClient({ children }: LeadLayoutClientProps) {
  return <DeepScanProvider>{children}</DeepScanProvider>;
}
