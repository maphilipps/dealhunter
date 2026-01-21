'use client';

import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

import type { DisciplineAllocation } from '@/lib/estimations/pt-calculator';

// Dynamic import for Recharts (saves ~150KB bundle)
const DisciplinesChart = dynamic(() => import('./disciplines-chart').then(m => m.DisciplinesChart), {
  ssr: false,
  loading: () => (
    <div className="h-80 w-full flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

export function DisciplinesChartWrapper({ disciplines }: { disciplines: DisciplineAllocation[] }) {
  return <DisciplinesChart disciplines={disciplines} />;
}
