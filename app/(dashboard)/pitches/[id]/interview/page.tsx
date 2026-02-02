import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches } from '@/lib/db/schema';

import { InterviewClient } from './interview-client';

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const [lead] = await db
    .select({ id: pitches.id, customerName: pitches.customerName, websiteUrl: pitches.websiteUrl })
    .from(pitches)
    .where(eq(pitches.id, id))
    .limit(1);

  if (!lead) {
    redirect('/pitches');
  }

  return <InterviewClient pitchId={lead.id} customerName={lead.customerName} />;
}
