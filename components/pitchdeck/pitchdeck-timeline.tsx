'use client';

import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar, AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getDeadlineStatus } from '@/lib/pitchdeck/timeline-calculator';

interface PitchdeckTimelineProps {
  deliverables: Array<{
    id: string;
    deliverableName: string;
    status: string;
    internalDeadline: Date | null;
  }>;
  rfpDeadline: Date | null;
  className?: string;
}

/**
 * Pitchdeck Timeline Gantt Chart
 *
 * Displays deliverables as horizontal bars with color-coded deadlines.
 * Shows RFP deadline as a vertical line marker.
 */
export function PitchdeckTimeline({
  deliverables,
  rfpDeadline,
  className,
}: PitchdeckTimelineProps) {
  // Filter deliverables with deadlines
  const deliverablesWithDeadlines = deliverables.filter(d => d.internalDeadline);

  if (deliverablesWithDeadlines.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timeline
          </CardTitle>
          <CardDescription>Projekt-Timeline mit Meilensteinen</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Keine Deliverables mit Deadlines vorhanden.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate timeline bounds
  const now = new Date();
  const allDates = deliverablesWithDeadlines
    .map(d => d.internalDeadline!)
    .concat(rfpDeadline ? [rfpDeadline] : []);

  const minDate = new Date(Math.min(now.getTime(), ...allDates.map(d => d.getTime())));
  const maxDate = new Date(
    Math.max(...allDates.map(d => d.getTime()), now.getTime() + 30 * 24 * 60 * 60 * 1000)
  );

  const totalDurationMs = maxDate.getTime() - minDate.getTime();

  // Calculate position for "today" marker
  const todayPercent = ((now.getTime() - minDate.getTime()) / totalDurationMs) * 100;

  // Calculate RFP deadline position
  let rfpDeadlinePercent: number | null = null;
  if (rfpDeadline) {
    rfpDeadlinePercent = ((rfpDeadline.getTime() - minDate.getTime()) / totalDurationMs) * 100;
  }

  // Warning if no RFP deadline
  const showRfpWarning = !rfpDeadline;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline
            </CardTitle>
            <CardDescription>Projekt-Timeline mit Meilensteinen</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Warning if no RFP deadline */}
        {showRfpWarning && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warnung:</strong> Keine RFP-Deadline vorhanden. Interne Deadlines können
              möglicherweise nicht korrekt berechnet werden.
            </AlertDescription>
          </Alert>
        )}

        {/* Timeline Legend */}
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-green-500" />
            <span>On Track</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-yellow-500" />
            <span>Bald fällig (&lt;3 Tage)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-red-500" />
            <span>Überfällig</span>
          </div>
        </div>

        {/* Gantt Chart */}
        <div className="space-y-3">
          {deliverablesWithDeadlines.map(deliverable => {
            const deadline = deliverable.internalDeadline!;
            const deadlineStatus = getDeadlineStatus(deadline);

            // Calculate bar position and width
            // Bar starts from "now" and extends to the deadline
            const startPercent = Math.max(
              0,
              ((now.getTime() - minDate.getTime()) / totalDurationMs) * 100
            );
            const endPercent = ((deadline.getTime() - minDate.getTime()) / totalDurationMs) * 100;
            const widthPercent = Math.max(1, endPercent - startPercent);

            // Color based on deadline status
            const barColor =
              deadlineStatus === 'overdue'
                ? 'bg-red-500'
                : deadlineStatus === 'warning'
                  ? 'bg-yellow-500'
                  : 'bg-green-500';

            return (
              <div key={deliverable.id} className="space-y-1">
                {/* Deliverable Name and Deadline */}
                <div className="flex items-center justify-between text-sm">
                  <div className="font-medium">{deliverable.deliverableName}</div>
                  <div className="text-muted-foreground text-xs">
                    {format(deadline, 'dd. MMM yyyy', { locale: de })}
                  </div>
                </div>

                {/* Timeline Bar Container */}
                <div className="relative h-8 bg-muted rounded-md overflow-hidden">
                  {/* Deliverable Bar */}
                  <div
                    className={`absolute h-full ${barColor} transition-all flex items-center px-2 text-white text-xs font-medium`}
                    style={{
                      left: `${startPercent}%`,
                      width: `${widthPercent}%`,
                    }}
                  >
                    {widthPercent > 15 && (
                      <span className="truncate">{deliverable.deliverableName}</span>
                    )}
                  </div>

                  {/* Today Marker */}
                  {todayPercent >= 0 && todayPercent <= 100 && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-blue-600 z-10"
                      style={{ left: `${todayPercent}%` }}
                      title="Heute"
                    />
                  )}

                  {/* RFP Deadline Marker */}
                  {rfpDeadlinePercent !== null &&
                    rfpDeadlinePercent >= 0 &&
                    rfpDeadlinePercent <= 100 && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-purple-600 z-10"
                        style={{ left: `${rfpDeadlinePercent}%` }}
                        title="RFP Deadline"
                      />
                    )}
                </div>

                {/* Status Badge */}
                <div className="text-xs text-muted-foreground">
                  Status: <span className="capitalize">{deliverable.status}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline Axis Labels */}
        <div className="relative h-6 border-t pt-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{format(minDate, 'dd. MMM', { locale: de })}</span>
            {rfpDeadline && (
              <span className="absolute" style={{ left: `${rfpDeadlinePercent}%` }}>
                <span className="relative -left-1/2 text-purple-600 font-medium">
                  RFP: {format(rfpDeadline, 'dd. MMM', { locale: de })}
                </span>
              </span>
            )}
            <span>{format(maxDate, 'dd. MMM', { locale: de })}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
