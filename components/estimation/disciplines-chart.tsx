'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import type { DisciplineAllocation } from '@/lib/estimations/pt-calculator';

const DISCIPLINE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(220, 70%, 50%)', // fallback blue
];

export function DisciplinesChart({ disciplines }: { disciplines: DisciplineAllocation[] }) {
  return (
    <ChartContainer
      config={{
        hours: {
          label: 'Stunden',
        },
      }}
      className="h-80"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={disciplines}
            dataKey="hours"
            nameKey="role"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ role, percentage }) => `${role}: ${percentage}%`}
            labelLine={true}
          >
            {disciplines.map((_, index) => (
              <Cell key={`cell-${index}`} fill={DISCIPLINE_COLORS[index % DISCIPLINE_COLORS.length]} />
            ))}
          </Pie>
          <ChartTooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload as DisciplineAllocation;
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{data.role}</span>
                      </div>
                      <div className="grid gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Stunden</span>
                          <span className="text-xs font-mono font-medium">{data.hours}h</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Anteil</span>
                          <span className="text-xs font-mono font-medium">{data.percentage}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

export { DISCIPLINE_COLORS };
