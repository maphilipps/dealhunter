import { eq } from 'drizzle-orm';
import { ArrowLeft, Users, AlertTriangle, Info } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { StaffingGanttChart, type StaffingEntry } from '@/components/pitches/staffing-gantt-chart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches } from '@/lib/db/schema';

export default async function StaffingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get lead
  const [lead] = await db.select().from(pitches).where(eq(pitches.id, id)).limit(1);

  if (!lead) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Lead nicht gefunden</h1>
        <p className="text-muted-foreground">Der angeforderte Lead konnte nicht gefunden werden.</p>
      </div>
    );
  }

  // TODO: Replace with actual data from Deep Scan Agent
  // This is sample data based on the DEA-148 requirements
  const sampleStaffingData: StaffingEntry[] = [
    // PM Role
    { role: 'PM', phase: 'Konzeption', startMonth: 1, endMonth: 2, pt: 15 },
    { role: 'PM', phase: 'Design', startMonth: 2, endMonth: 3, pt: 10 },
    { role: 'PM', phase: 'Development', startMonth: 3, endMonth: 6, pt: 20 },
    { role: 'PM', phase: 'Testing', startMonth: 6, endMonth: 7, pt: 8 },
    { role: 'PM', phase: 'Launch', startMonth: 7, endMonth: 8, pt: 5 },

    // UX Role
    { role: 'UX', phase: 'Konzeption', startMonth: 1, endMonth: 2, pt: 20 },
    { role: 'UX', phase: 'Design', startMonth: 2, endMonth: 4, pt: 35 },
    { role: 'UX', phase: 'Testing', startMonth: 6, endMonth: 7, pt: 8 },

    // Frontend Role
    { role: 'Frontend', phase: 'Design', startMonth: 3, endMonth: 4, pt: 10 },
    { role: 'Frontend', phase: 'Development', startMonth: 4, endMonth: 7, pt: 50 },
    { role: 'Frontend', phase: 'Testing', startMonth: 6, endMonth: 7, pt: 12 },

    // Backend Role
    { role: 'Backend', phase: 'Konzeption', startMonth: 1, endMonth: 2, pt: 10 },
    { role: 'Backend', phase: 'Development', startMonth: 3, endMonth: 7, pt: 60 },
    { role: 'Backend', phase: 'Testing', startMonth: 6, endMonth: 7, pt: 15 },

    // DevOps Role
    { role: 'DevOps', phase: 'Konzeption', startMonth: 1, endMonth: 2, pt: 8 },
    { role: 'DevOps', phase: 'Development', startMonth: 4, endMonth: 6, pt: 15 },
    { role: 'DevOps', phase: 'Testing', startMonth: 6, endMonth: 7, pt: 10 },
    { role: 'DevOps', phase: 'Launch', startMonth: 7, endMonth: 8, pt: 12 },

    // QA Role
    { role: 'QA', phase: 'Development', startMonth: 5, endMonth: 6, pt: 10 },
    { role: 'QA', phase: 'Testing', startMonth: 6, endMonth: 7, pt: 25 },
    { role: 'QA', phase: 'Launch', startMonth: 7, endMonth: 8, pt: 8 },
  ];

  // Check if staffing data exists (for now using sample data)
  const hasStaffingData = sampleStaffingData.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/pitches/${id}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück zu Lead Overview
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Staffing & Timeline</h1>
          <p className="text-muted-foreground">{lead.customerName}</p>
        </div>
      </div>

      {/* Notice about data source */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Deep Scan Status</AlertTitle>
        <AlertDescription>
          Die Staffing-Daten werden automatisch vom Deep Scan Agent generiert. Die aktuell
          angezeigten Daten sind Beispiel-Daten basierend auf typischen Projekt-Phasen.
        </AlertDescription>
      </Alert>

      {/* Staffing Gantt Chart */}
      {hasStaffingData ? (
        <StaffingGanttChart entries={sampleStaffingData} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Noch keine Staffing-Daten verfügbar
            </CardTitle>
            <CardDescription>
              Die Staffing-Analyse wird automatisch nach dem Deep Scan durchgeführt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Bitte warten Sie, bis die Deep-Scan Agents abgeschlossen sind.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Implementation Notes */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <CardTitle>Wichtige Hinweise</CardTitle>
          </div>
          <CardDescription>Über die Staffing-Planung</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Automatische Generierung:</strong> Die Staffing-Timeline wird vom Deep Scan
            Orchestrator automatisch basierend auf PT-Schätzung und Projekt-Komplexität generiert.
          </p>
          <p>
            <strong>Rollen-Mapping:</strong> Das System identifiziert automatisch benötigte Rollen
            (PM, UX, Frontend, Backend, DevOps, QA) basierend auf dem Tech-Stack und
            Projekt-Anforderungen.
          </p>
          <p>
            <strong>Phasen-Breakdown:</strong> Die Timeline zeigt die Ressourcen-Allokation über
            alle Projekt-Phasen hinweg: Konzeption, Design, Development, Testing, und Launch.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
