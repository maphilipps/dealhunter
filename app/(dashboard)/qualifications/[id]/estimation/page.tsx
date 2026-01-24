import { eq } from 'drizzle-orm';
import {
  ArrowLeft,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Users,
  Clock,
  Target,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { DISCIPLINE_COLORS } from '@/components/estimation/disciplines-chart';
import { DisciplinesChartWrapper } from '@/components/estimation/disciplines-chart-wrapper';
import { PhasesChartWrapper } from '@/components/estimation/phases-chart-wrapper';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { qualifications, ptEstimations } from '@/lib/db/schema';
import type { Phase, DisciplineAllocation } from '@/lib/estimations/pt-calculator';

export default async function PTEstimationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get lead
  const [lead] = await db.select().from(qualifications).where(eq(qualifications.id, id)).limit(1);

  if (!lead) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Lead nicht gefunden</h1>
        <p className="text-muted-foreground">Der angeforderte Lead konnte nicht gefunden werden.</p>
      </div>
    );
  }

  // Get PT Estimation
  const [estimation] = await db
    .select()
    .from(ptEstimations)
    .where(eq(ptEstimations.qualificationId, id))
    .limit(1);

  if (!estimation) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/qualifications/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück zu Lead Overview
            </Link>
          </Button>
        </div>

        <h1 className="text-3xl font-bold tracking-tight">PT Estimation</h1>
        <Card>
          <CardHeader>
            <CardTitle>Noch keine PT-Schätzung verfügbar</CardTitle>
            <CardDescription>
              Die PT-Schätzung wird automatisch nach dem Website Audit berechnet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Bitte warten Sie, bis die Deep-Scan Agents abgeschlossen sind.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Parse JSON fields
  const phases = estimation.phases ? (JSON.parse(estimation.phases) as Phase[]) : [];
  const disciplines = estimation.disciplines
    ? (JSON.parse(estimation.disciplines) as DisciplineAllocation[])
    : [];
  const assumptions = estimation.assumptions
    ? (JSON.parse(estimation.assumptions) as string[])
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/qualifications/${id}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück zu Lead Overview
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">PT Estimation</h1>
          <p className="text-muted-foreground">{lead.customerName}</p>
        </div>
        <ConfidenceBadge level={estimation.confidenceLevel} />
      </div>

      {/* Total PT Card */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Total Person-Tage</CardTitle>
            </div>
            <CardDescription>Gesamtaufwand der Schätzung</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-4xl font-bold">{estimation.totalPT}h</p>
                <p className="text-sm text-muted-foreground mt-1">
                  ≈ {Math.round(estimation.totalPT / 8)} Personentage
                </p>
              </div>

              <Separator />

              {estimation.durationMonths && (
                <div>
                  <p className="text-sm text-muted-foreground">Geschätzte Dauer</p>
                  <p className="text-xl font-semibold">
                    {estimation.durationMonths}{' '}
                    {estimation.durationMonths === 1 ? 'Monat' : 'Monate'}
                  </p>
                </div>
              )}

              {estimation.totalCost && (
                <div>
                  <p className="text-sm text-muted-foreground">Geschätzte Kosten</p>
                  <p className="text-xl font-semibold">
                    {new Intl.NumberFormat('de-DE', {
                      style: 'currency',
                      currency: 'EUR',
                      maximumFractionDigits: 0,
                    }).format(estimation.totalCost)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Risk Buffer Indicator */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Risk Buffer & Confidence</CardTitle>
            </div>
            <CardDescription>Pufferzone basierend auf Projekt-Komplexität</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Risk Buffer</span>
                  <span className="font-medium">{estimation.riskBuffer || 0}%</span>
                </div>
                <Progress value={estimation.riskBuffer || 0} />
                <p className="text-xs text-muted-foreground mt-1">
                  {estimation.riskBuffer &&
                    `${Math.round((estimation.totalPT * estimation.riskBuffer) / 100)}h zusätzlicher Puffer eingerechnet`}
                </p>
              </div>

              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-2">Confidence Level</p>
                  <ConfidenceBadge level={estimation.confidenceLevel} size="large" />
                  <p className="text-xs text-muted-foreground mt-2">
                    {estimation.confidenceLevel === 'high' &&
                      'Sehr verlässliche Schätzung basierend auf bekannter Baseline'}
                    {estimation.confidenceLevel === 'medium' &&
                      'Moderate Unsicherheit durch zusätzliche Komplexität'}
                    {estimation.confidenceLevel === 'low' &&
                      'Hohe Unsicherheit - detaillierte Analyse empfohlen'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Phasen-Breakdown Chart */}
      {phases.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Phasen-Breakdown</CardTitle>
            </div>
            <CardDescription>Aufwand aufgeteilt nach Projektphasen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Chart */}
              <PhasesChartWrapper phases={phases} />

              {/* Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phase</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead className="text-right">Stunden</TableHead>
                    <TableHead className="text-right">Anteil</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phases.map((phase, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{phase.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {phase.description}
                      </TableCell>
                      <TableCell className="text-right font-mono">{phase.hours}h</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{phase.percentage}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell>Gesamt</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-mono">{estimation.totalPT}h</TableCell>
                    <TableCell className="text-right">
                      <Badge>100%</Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Discipline Matrix Chart */}
      {disciplines.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Discipline Matrix</CardTitle>
            </div>
            <CardDescription>Aufwand aufgeteilt nach Rollen/Disziplinen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Pie Chart */}
              <DisciplinesChartWrapper disciplines={disciplines} />

              {/* Table */}
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rolle</TableHead>
                      <TableHead className="text-right">Stunden</TableHead>
                      <TableHead className="text-right">Anteil</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disciplines.map((discipline, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{
                                backgroundColor: DISCIPLINE_COLORS[idx % DISCIPLINE_COLORS.length],
                              }}
                            />
                            {discipline.role}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{discipline.hours}h</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{discipline.percentage}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell>Gesamt</TableCell>
                      <TableCell className="text-right font-mono">{estimation.totalPT}h</TableCell>
                      <TableCell className="text-right">
                        <Badge>100%</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assumptions List */}
      {assumptions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Annahmen & Voraussetzungen</CardTitle>
            </div>
            <CardDescription>
              Grundlage der PT-Schätzung - bitte prüfen und validieren
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assumptions.map((assumption, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <div className="flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-sm">{assumption}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <p className="font-semibold text-yellow-900">Wichtig zu beachten</p>
              </div>
              <p className="text-sm text-yellow-800">
                Diese Annahmen basieren auf automatisierten Website-Analysen. Bitte validieren Sie
                diese mit dem Kunden, bevor Sie ein Angebot erstellen.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline (if available) */}
      {estimation.timeline && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Projekt-Timeline</CardTitle>
            </div>
            <CardDescription>Meilensteine und Zeitplan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {estimation.startDate && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Geplanter Start</p>
                  <p className="text-lg font-semibold">
                    {new Date(estimation.startDate).toLocaleDateString('de-DE', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
              {estimation.endDate && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Geplantes Ende</p>
                  <p className="text-lg font-semibold">
                    {new Date(estimation.endDate).toLocaleDateString('de-DE', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function ConfidenceBadge({
  level,
  size = 'default',
}: {
  level: 'low' | 'medium' | 'high' | null;
  size?: 'default' | 'large';
}) {
  const config = {
    high: { label: 'High Confidence', className: 'bg-green-100 text-green-800 border-green-200' },
    medium: {
      label: 'Medium Confidence',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    },
    low: { label: 'Low Confidence', className: 'bg-red-100 text-red-800 border-red-200' },
  };

  const selectedConfig = level ? config[level] : config.medium;
  const sizeClass = size === 'large' ? 'text-base px-4 py-2' : '';

  return (
    <Badge className={`${selectedConfig.className} ${sizeClass}`}>{selectedConfig.label}</Badge>
  );
}
