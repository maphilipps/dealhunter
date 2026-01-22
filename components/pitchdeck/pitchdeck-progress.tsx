'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { PitchdeckDeliverable } from '@/lib/db/schema';

interface PitchdeckProgressProps {
  deliverables: PitchdeckDeliverable[];
}

/**
 * Calculate progress percentage based on done deliverables
 * Formula: (done / total) * 100
 */
function calculateProgress(deliverables: PitchdeckDeliverable[]): number {
  if (deliverables.length === 0) return 0;
  const done = deliverables.filter(d => d.status === 'done').length;
  return Math.round((done / deliverables.length) * 100);
}

export function PitchdeckProgress({ deliverables }: PitchdeckProgressProps) {
  const progress = calculateProgress(deliverables);
  const doneCount = deliverables.filter(d => d.status === 'done').length;
  const totalCount = deliverables.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gesamtfortschritt</CardTitle>
        <CardDescription>
          {doneCount} von {totalCount} Deliverables abgeschlossen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Fortschritt</span>
            <span className="text-2xl font-bold">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        {/* Status Breakdown */}
        <div className="grid grid-cols-4 gap-2 pt-2">
          <div className="rounded-lg border bg-gray-50 p-2 text-center">
            <p className="text-xs text-muted-foreground">Offen</p>
            <p className="text-lg font-semibold">
              {deliverables.filter(d => d.status === 'open').length}
            </p>
          </div>
          <div className="rounded-lg border bg-yellow-50 p-2 text-center">
            <p className="text-xs text-muted-foreground">In Arbeit</p>
            <p className="text-lg font-semibold">
              {deliverables.filter(d => d.status === 'in_progress').length}
            </p>
          </div>
          <div className="rounded-lg border bg-blue-50 p-2 text-center">
            <p className="text-xs text-muted-foreground">Review</p>
            <p className="text-lg font-semibold">
              {deliverables.filter(d => d.status === 'review').length}
            </p>
          </div>
          <div className="rounded-lg border bg-green-50 p-2 text-center">
            <p className="text-xs text-muted-foreground">Fertig</p>
            <p className="text-lg font-semibold">{doneCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
