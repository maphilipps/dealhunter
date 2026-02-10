import { notFound, redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { getCachedPreQualification } from '@/lib/qualifications/cached-queries';

export default async function FactsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const preQualification = await getCachedPreQualification(id);

  if (!preQualification) {
    notFound();
  }

  if (preQualification.userId !== session.user.id) {
    notFound();
  }

  // Legacy route: facts are shown on the overview/dashboard page.
  redirect(`/qualifications/${id}`);
}
