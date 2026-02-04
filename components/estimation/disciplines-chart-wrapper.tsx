'use client';

import dynamic from 'next/dynamic';

import { Loader } from '@/components/ai-elements/loader';
import type { DisciplineAllocation } from '@/lib/estimations/pt-calculator';

// Dynamic import for Recharts (saves ~150KB bundle)
const DisciplinesChart = dynamic(
  () => import('./disciplines-chart').then(m => m.DisciplinesChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-80 w-full flex items-center justify-center">
        <Loader size="md" className="text-muted-foreground" />
      </div>
    ),
  }
);

export function DisciplinesChartWrapper({ disciplines }: { disciplines: DisciplineAllocation[] }) {
  return <DisciplinesChart disciplines={disciplines} />;
}
