'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import type { Phase } from '@/lib/estimations/pt-calculator';

export function PhasesChart({ phases }: { phases: Phase[] }) {
  return (
    <ChartContainer
      config={{
        hours: {
          label: 'Stunden',
          color: 'hsl(var(--primary))',
        },
      }}
      className="h-80"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={phases} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="name" type="category" width={150} />
          <ChartTooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload as Phase;
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{data.name}</span>
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
                      <div className="text-xs text-muted-foreground">{data.description}</div>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
