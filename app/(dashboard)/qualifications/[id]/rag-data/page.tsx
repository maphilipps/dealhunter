import { notFound, redirect } from 'next/navigation';

import { RAGDataClient } from '@/components/rag/rag-data-client';
import { auth } from '@/lib/auth';
import { getCachedPreQualification } from '@/lib/qualifications/cached-queries';

export default async function QualificationRAGDataPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const preQualification = await getCachedPreQualification(id);
  if (!preQualification) notFound();
  if (preQualification.userId !== session.user.id) notFound();

  return (
    <div className="flex flex-col gap-6 p-6">
      <RAGDataClient preQualificationId={id} />
    </div>
  );
}
