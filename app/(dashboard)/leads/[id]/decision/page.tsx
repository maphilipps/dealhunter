import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import DecisionForm from './decision-form';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';

export default async function DecisionPage({ params }: { params: Promise<{ id: string }> }) {
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

  return <DecisionForm lead={lead} />;
}
