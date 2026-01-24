import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { RAGDataClient } from '@/components/rag/rag-data-client';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const metadata: Metadata = {
  title: 'RAG Data | Lead',
  description: 'RAG-Daten für diesen Lead anzeigen und durchsuchen',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RAGDataPage({ params }: PageProps) {
  const { id } = await params;

  // Verify lead exists
  const [lead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.id, id)).limit(1);

  if (!lead) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <RAGDataClient leadId={id} />
    </div>
  );
}
