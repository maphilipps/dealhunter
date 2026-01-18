'use client';

import { Pie, PieChart } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { TechStack } from '@/lib/quick-scan/schema';

const chartConfig = {
  count: { label: 'Technologies' },
  frontend: { label: 'Frontend', color: 'var(--chart-1)' },
  backend: { label: 'Backend', color: 'var(--chart-2)' },
  infrastructure: { label: 'Infrastructure', color: 'var(--chart-3)' },
  analytics: { label: 'Analytics', color: 'var(--chart-4)' },
  marketing: { label: 'Marketing', color: 'var(--chart-5)' },
} satisfies ChartConfig;

export function TechStackChart({ data }: { data: TechStack | null }) {
  if (!data) return null;

  const chartData = [
    {
      category: 'frontend',
      count: (data.framework ? 1 : 0) + (data.libraries?.length ?? 0),
      fill: 'var(--color-frontend)',
    },
    {
      category: 'backend',
      count: data.backend?.length ?? 0,
      fill: 'var(--color-backend)',
    },
    {
      category: 'infrastructure',
      count: (data.cms ? 1 : 0) + (data.hosting ? 1 : 0) + (data.cdn ? 1 : 0),
      fill: 'var(--color-infrastructure)',
    },
    {
      category: 'analytics',
      count: data.analytics?.length ?? 0,
      fill: 'var(--color-analytics)',
    },
    {
      category: 'marketing',
      count: data.marketing?.length ?? 0,
      fill: 'var(--color-marketing)',
    },
  ].filter((d) => d.count > 0);

  if (chartData.length === 0) return null;

  return (
    <ChartContainer config={chartConfig} className="aspect-square">
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="category"
          innerRadius={40}
          strokeWidth={4}
        />
      </PieChart>
    </ChartContainer>
  );
}
