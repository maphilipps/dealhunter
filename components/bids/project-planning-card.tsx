'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Play, Calendar, Users, Clock } from 'lucide-react';
import { triggerProjectPlanning } from '@/lib/project-planning/actions';
import type { ProjectPlan, Discipline, InvolvementLevel } from '@/lib/project-planning/schema';

interface ProjectPlanningCardProps {
  bidId: string;
  initialPlan?: ProjectPlan | null;
  hasDeepAnalysis: boolean;
}

const disciplineLabels: Record<Discipline, string> = {
  PL: 'Projektleitung',
  CON: 'Consulting',
  UX: 'UX/UI Design',
  DEV: 'Development',
  SEO: 'SEO/Content',
  QA: 'Quality Assurance',
  OPS: 'DevOps',
};

const involvementColors: Record<InvolvementLevel, string> = {
  lead: 'bg-blue-600',
  major: 'bg-blue-400',
  support: 'bg-blue-200',
  review: 'bg-gray-200',
  none: 'bg-transparent',
};

export function ProjectPlanningCard({ bidId, initialPlan, hasDeepAnalysis }: ProjectPlanningCardProps) {
  const [plan, setPlan] = useState<ProjectPlan | null>(initialPlan || null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = () => {
    setError(null);
    startTransition(async () => {
      const response = await triggerProjectPlanning(bidId);
      if (response.success && response.plan) {
        setPlan(response.plan);
      } else {
        setError(response.error || 'Unbekannter Fehler');
      }
    });
  };

  // Not ready state
  if (!hasDeepAnalysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Projekt-Planung
          </CardTitle>
          <CardDescription>
            Deep Analysis muss zuerst abgeschlossen sein
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Die Projekt-Planung benötigt die PT-Schätzung aus der Deep Analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  // No plan yet - show generate button
  if (!plan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Projekt-Planung
          </CardTitle>
          <CardDescription>
            Timeline und Disziplinen-Matrix generieren
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Erstellt einen Projekt-Plan mit Phasen, Timeline und Team-Zusammensetzung
            basierend auf der PT-Schätzung.
          </p>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button onClick={handleGenerate} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generiere Plan...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Projekt-Plan erstellen
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show plan
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Projekt-Planung
            </CardTitle>
            <CardDescription>
              {plan.projectName} • {plan.confidence}% Konfidenz
            </CardDescription>
          </div>
          <Badge variant="outline">
            {plan.totalWeeks} Wochen
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border p-4 text-center">
            <Clock className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-2xl font-bold">{plan.totalHours}</p>
            <p className="text-xs text-muted-foreground">Personentage</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <Calendar className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-2xl font-bold">{plan.totalWeeks}</p>
            <p className="text-xs text-muted-foreground">Wochen</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <Users className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-2xl font-bold">{plan.recommendedTeamSize.optimal}</p>
            <p className="text-xs text-muted-foreground">Team-Größe</p>
          </div>
        </div>

        {/* Timeline Visualization */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Timeline</h4>
          <div className="space-y-2">
            {plan.phases.map((phase, idx) => {
              const widthPercent = (phase.durationWeeks / plan.totalWeeks) * 100;
              const leftPercent = (phase.startWeek / plan.totalWeeks) * 100;

              return (
                <div key={idx} className="relative">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-32 truncate font-medium">{phase.name}</span>
                    <div className="relative h-8 flex-1 rounded bg-muted">
                      <div
                        className="absolute h-full rounded bg-primary/80 flex items-center justify-center text-xs text-primary-foreground"
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          minWidth: '40px',
                        }}
                      >
                        {phase.durationWeeks}W
                      </div>
                    </div>
                    <span className="w-20 text-right text-xs text-muted-foreground">
                      W{phase.startWeek + 1}-{phase.endWeek + 1}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Week markers */}
          <div className="flex justify-between text-xs text-muted-foreground pl-36 pr-20">
            <span>W1</span>
            <span>W{Math.ceil(plan.totalWeeks / 2)}</span>
            <span>W{plan.totalWeeks}</span>
          </div>
        </div>

        {/* Discipline Matrix */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Disziplinen-Matrix</h4>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Disziplin</TableHead>
                  {plan.phases.map((phase, idx) => (
                    <TableHead key={idx} className="text-center text-xs">
                      {phase.name.split(' ')[0]}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Gesamt PT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.disciplineMatrix.map((disc) => (
                  <TableRow key={disc.discipline}>
                    <TableCell className="font-medium">
                      <span className="font-mono text-xs">{disc.discipline}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {disciplineLabels[disc.discipline]}
                      </span>
                    </TableCell>
                    {disc.phaseBreakdown.map((pb, idx) => (
                      <TableCell key={idx} className="text-center">
                        {pb.level !== 'none' && (
                          <div
                            className={`mx-auto h-6 w-6 rounded ${involvementColors[pb.level]}`}
                            title={`${pb.hours} PT - ${pb.level}`}
                          />
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-medium">
                      {disc.totalHours}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Legend */}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-blue-600" /> Lead
            </span>
            <span className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-blue-400" /> Major
            </span>
            <span className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-blue-200" /> Support
            </span>
            <span className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-gray-200" /> Review
            </span>
          </div>
        </div>

        {/* Team Size Recommendation */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <h4 className="font-medium">Team-Empfehlung</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Minimum: {plan.recommendedTeamSize.minimum} •{' '}
            <span className="font-medium">Optimal: {plan.recommendedTeamSize.optimal}</span> •{' '}
            Maximum: {plan.recommendedTeamSize.maximum} Personen
          </p>
        </div>

        {/* Assumptions */}
        {plan.assumptions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Annahmen</h4>
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {plan.assumptions.slice(0, 5).map((assumption, idx) => (
                <li key={idx}>{assumption}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
