'use client';

import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { AlertTriangle, Calendar, CheckCircle2, Clock, Info, Users } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProjectTimeline } from '@/lib/timeline/schema';

interface TimelineChartProps {
  timeline: ProjectTimeline;
  className?: string;
}

/**
 * Timeline Visualization Component
 *
 * Displays project timeline with phases, duration, and confidence.
 * Uses ShadCN UI components for consistent styling.
 */
export function TimelineChart({ timeline, className }: TimelineChartProps) {
  // Calculate total width for phase bars
  const maxDay = timeline.totalDays;

  // Confidence color
  const confidenceColor =
    timeline.confidence >= 80
      ? 'text-green-600 dark:text-green-400'
      : timeline.confidence >= 60
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400';

  const confidenceBadgeVariant =
    timeline.confidence >= 80 ? 'default' : timeline.confidence >= 60 ? 'secondary' : 'destructive';

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Projekt-Timeline (Schätzung)
            </CardTitle>
            <CardDescription>
              Basierend auf Qualification Ergebnissen - Detaillierte Planung erfolgt nach BL-Zuweisung
            </CardDescription>
          </div>
          <Badge variant={confidenceBadgeVariant} className="ml-4">
            {timeline.confidence}% Konfidenz
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Gesamtdauer
            </div>
            <div className="text-2xl font-bold">{timeline.totalWeeks} Wochen</div>
            <div className="text-xs text-muted-foreground">{timeline.totalDays} Arbeitstage</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Monate</div>
            <div className="text-2xl font-bold">{timeline.totalMonths.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">ca. Monate</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              Team-Größe
            </div>
            <div className="text-2xl font-bold">{timeline.assumedTeamSize.optimal}</div>
            <div className="text-xs text-muted-foreground">
              {timeline.assumedTeamSize.min}-{timeline.assumedTeamSize.max} Personen
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Phasen</div>
            <div className="text-2xl font-bold">{timeline.phases.length}</div>
            <div className="text-xs text-muted-foreground">Projekt-Phasen</div>
          </div>
        </div>

        {/* Timeline Dates (if available) */}
        {(timeline.estimatedStart || timeline.estimatedGoLive) && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            {timeline.estimatedStart && (
              <div>
                <div className="text-sm font-medium">Geschätzter Start</div>
                <div className="text-lg">
                  {format(new Date(timeline.estimatedStart), 'dd. MMMM yyyy', { locale: de })}
                </div>
              </div>
            )}
            {timeline.estimatedGoLive && (
              <div>
                <div className="text-sm font-medium">Geschätztes Go-Live</div>
                <div className="text-lg">
                  {format(new Date(timeline.estimatedGoLive), 'dd. MMMM yyyy', { locale: de })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Phase Bars (Gantt-like visualization) */}
        <div className="space-y-3">
          <div className="text-sm font-medium">Phasen-Übersicht</div>

          <div className="space-y-2">
            {timeline.phases.map((phase, index) => {
              // Calculate bar width and position
              const startPercent = (phase.startDay / maxDay) * 100;
              const widthPercent = (phase.durationDays / maxDay) * 100;

              // Phase colors (cycle through a palette)
              const colors = [
                'bg-blue-500',
                'bg-purple-500',
                'bg-green-500',
                'bg-orange-500',
                'bg-pink-500',
                'bg-teal-500',
              ];
              const color = colors[index % colors.length];

              return (
                <div key={index} className="space-y-1">
                  {/* Phase Name and Duration */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-medium">{phase.name}</div>
                    <div className="text-muted-foreground">
                      {phase.durationDays} Tage ({Math.ceil(phase.durationDays / 5)} Wochen)
                    </div>
                  </div>

                  {/* Timeline Bar */}
                  <div className="relative h-8 bg-muted rounded-md overflow-hidden">
                    <div
                      className={`absolute h-full ${color} transition-all flex items-center px-2 text-white text-xs font-medium`}
                      style={{
                        left: `${startPercent}%`,
                        width: `${widthPercent}%`,
                      }}
                    >
                      {widthPercent > 20 && <span className="truncate">{phase.name}</span>}
                    </div>
                  </div>

                  {/* Key Activities (collapsible) */}
                  {phase.keyActivities && phase.keyActivities.length > 0 && (
                    <div className="text-xs text-muted-foreground pl-2">
                      {phase.keyActivities.slice(0, 2).join(' • ')}
                      {phase.keyActivities.length > 2 &&
                        ` +${phase.keyActivities.length - 2} weitere`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Calculation Basis */}
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <div className="text-sm font-medium flex items-center gap-2">
            <Info className="h-4 w-4" />
            Berechnungsgrundlage
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Content-Volumen:</span>
              <span className="ml-2">{timeline.calculationBasis.contentVolume}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Komplexität:</span>
              <span className="ml-2 capitalize">{timeline.calculationBasis.complexity}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Integrationen:</span>
              <span className="ml-2">{timeline.calculationBasis.integrations}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Kritische Deadline:</span>
              <span className="ml-2">
                {timeline.calculationBasis.hasCriticalDeadline ? 'Ja' : 'Nein'}
              </span>
            </div>
          </div>
        </div>

        {/* Assumptions */}
        {timeline.assumptions && timeline.assumptions.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Annahmen
            </div>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {timeline.assumptions.map((assumption, index) => (
                <li key={index}>{assumption}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Risks */}
        {timeline.risks && timeline.risks.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Timeline-Risiken
            </div>
            <div className="space-y-2">
              {timeline.risks.map((risk, index) => (
                <Alert key={index} variant={risk.impact === 'high' ? 'destructive' : 'default'}>
                  <AlertDescription className="text-sm">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <span className="font-medium">{risk.factor}</span>
                        <div className="text-xs text-muted-foreground mt-1">
                          Impact: {risk.impact} • Wahrscheinlichkeit: {risk.likelihood}
                        </div>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}

        {/* Low Confidence Warning */}
        {timeline.confidence < 60 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Niedrige Konfidenz:</strong> Diese Timeline-Schätzung basiert auf limitierten
              Informationen aus der Qualification. Eine detaillierte Planung erfolgt nach der
              BL-Zuweisung und Deep Analysis.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact Timeline Display
 * For use in lists or sidebars
 */
export function TimelineCompact({ timeline }: TimelineChartProps) {
  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{timeline.totalWeeks}w</span>
      </div>
      <div className="flex items-center gap-1">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span>{timeline.assumedTeamSize.optimal}p</span>
      </div>
      <Badge variant="outline" className="text-xs">
        {timeline.confidence}%
      </Badge>
    </div>
  );
}
