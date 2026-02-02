import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { DeliverableCard } from '@/components/pitchdeck/deliverable-card';
import { PitchdeckProgress } from '@/components/pitchdeck/pitchdeck-progress';
import { PitchdeckTeam } from '@/components/pitchdeck/pitchdeck-team';
import { PitchdeckTimeline } from '@/components/pitchdeck/pitchdeck-timeline';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  pitches,
  pitchdecks,
  pitchdeckDeliverables,
  pitchdeckTeamMembers,
  employees,
  preQualifications,
} from '@/lib/db/schema';

export default async function PitchdeckPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Only accessible for BID decisions
  if (lead.blVote !== 'BID') {
    redirect(`/pitches/${id}`);
  }

  // Get pitchdeck
  const [pitchdeck] = await db.select().from(pitchdecks).where(eq(pitchdecks.pitchId, id)).limit(1);

  if (!pitchdeck) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Pitchdeck Assembly</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Kein Pitchdeck verfügbar</CardTitle>
            <CardDescription>Für diesen Lead wurde noch kein Pitchdeck erstellt.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Das Pitchdeck wird automatisch nach der BID-Entscheidung erstellt.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get deliverables
  const deliverables = await db
    .select()
    .from(pitchdeckDeliverables)
    .where(eq(pitchdeckDeliverables.pitchdeckId, pitchdeck.id));

  // Get team members with employee details
  const teamMembers = await db
    .select({
      id: pitchdeckTeamMembers.id,
      pitchdeckId: pitchdeckTeamMembers.pitchdeckId,
      employeeId: pitchdeckTeamMembers.employeeId,
      role: pitchdeckTeamMembers.role,
      createdAt: pitchdeckTeamMembers.createdAt,
      employee: employees,
    })
    .from(pitchdeckTeamMembers)
    .leftJoin(employees, eq(pitchdeckTeamMembers.employeeId, employees.id))
    .where(eq(pitchdeckTeamMembers.pitchdeckId, pitchdeck.id));

  // Filter out team members without employee data (defensive programming)
  const validTeamMembers = teamMembers.filter(member => member.employee !== null) as Array<{
    id: string;
    pitchdeckId: string;
    employeeId: string;
    role: 'pm' | 'ux' | 'frontend' | 'backend' | 'devops' | 'qa';
    createdAt: Date | null;
    employee: NonNullable<(typeof teamMembers)[number]['employee']>;
  }>;

  // Get Pre-Qualification to extract deadline
  const [preQualification] = await db
    .select()
    .from(preQualifications)
    .where(eq(preQualifications.id, lead.preQualificationId))
    .limit(1);

  // Extract Pre-Qualification deadline from Pre-Qualification
  let rfpDeadline: Date | null = null;
  if (preQualification?.extractedRequirements) {
    try {
      const requirements = JSON.parse(preQualification.extractedRequirements) as {
        deadline?: string;
      };
      if (requirements.deadline) {
        rfpDeadline = new Date(requirements.deadline);
      }
    } catch (e) {
      // Invalid JSON or missing deadline - rfpDeadline stays null
      console.error('Failed to parse extractedRequirements:', e);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Pitchdeck Assembly</h1>
      </div>

      {/* Progress Section */}
      <PitchdeckProgress deliverables={deliverables} />

      {/* Team Section */}
      <PitchdeckTeam teamMembers={validTeamMembers} />

      {/* Timeline Section */}
      <PitchdeckTimeline deliverables={deliverables} rfpDeadline={rfpDeadline} />

      {/* Deliverables List */}
      <Card>
        <CardHeader>
          <CardTitle>Deliverables</CardTitle>
          <CardDescription>
            Übersicht aller erforderlichen Liefergegenstände für dieses Pitchdeck.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deliverables.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Deliverables vorhanden.</p>
          ) : (
            <div className="space-y-2">
              {deliverables.map(deliverable => (
                <DeliverableCard key={deliverable.id} deliverable={deliverable} leadId={id} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
