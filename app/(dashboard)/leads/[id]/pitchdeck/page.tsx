import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { PitchdeckProgress } from '@/components/pitchdeck/pitchdeck-progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leads, pitchdecks, pitchdeckDeliverables } from '@/lib/db/schema';

export default async function PitchdeckPage({
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
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);

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
    redirect(`/leads/${id}`);
  }

  // Get pitchdeck
  const [pitchdeck] = await db
    .select()
    .from(pitchdecks)
    .where(eq(pitchdecks.leadId, id))
    .limit(1);

  if (!pitchdeck) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Pitchdeck Assembly</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Kein Pitchdeck verfügbar</CardTitle>
            <CardDescription>
              Für diesen Lead wurde noch kein Pitchdeck erstellt.
            </CardDescription>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Pitchdeck Assembly</h1>
      </div>

      {/* Progress Section */}
      <PitchdeckProgress deliverables={deliverables} />

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
                <div
                  key={deliverable.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{deliverable.deliverableName}</p>
                    <p className="text-xs text-muted-foreground">Status: {deliverable.status}</p>
                  </div>
                  <div
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      deliverable.status === 'done'
                        ? 'bg-green-100 text-green-700'
                        : deliverable.status === 'review'
                          ? 'bg-blue-100 text-blue-700'
                          : deliverable.status === 'in_progress'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {deliverable.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
