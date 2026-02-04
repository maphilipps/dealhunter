'use client';

import dynamic from 'next/dynamic';

import { Loader } from '@/components/ai-elements/loader';
import type { Phase } from '@/lib/estimations/pt-calculator';

// Dynamic import for Recharts (saves ~150KB bundle)
const PhasesChart = dynamic(() => import('./phases-chart').then(m => m.PhasesChart), {
  ssr: false,
  loading: () => (
    <div className="h-80 w-full flex items-center justify-center">
      <Loader size="md" className="text-muted-foreground" />
    </div>
  ),
});

export function PhasesChartWrapper({ phases }: { phases: Phase[] }) {
  return <PhasesChart phases={phases} />;
}
