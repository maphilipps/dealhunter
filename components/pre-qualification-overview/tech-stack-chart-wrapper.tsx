'use client';

import dynamic from 'next/dynamic';

import { Loader } from '@/components/ai-elements/loader';
import type { TechStack } from '@/lib/quick-scan/schema';

// Dynamic import for Recharts (saves ~155KB bundle)
const TechStackChart = dynamic(() => import('./tech-stack-chart').then(m => m.TechStackChart), {
  ssr: false,
  loading: () => (
    <div className="aspect-square w-full max-w-[200px] flex items-center justify-center">
      <Loader size="md" className="text-muted-foreground" />
    </div>
  ),
});

export function TechStackChartWrapper({ data }: { data: TechStack | null }) {
  return <TechStackChart data={data} />;
}
