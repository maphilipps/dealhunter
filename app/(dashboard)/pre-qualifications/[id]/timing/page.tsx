import { notFound, redirect } from 'next/navigation';

import { PreQualificationSectionPageTemplate } from '@/components/pre-qualifications/section-page-template';
import { auth } from '@/lib/auth';
import { getCachedPreQualification } from '@/lib/pre-qualifications/cached-queries';

export default async function TimingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const preQualification = await getCachedPreQualification(id);

  if (!preQualification) {
    notFound();
  }

  // Check ownership
  if (preQualification.userId !== session.user.id) {
    notFound();
  }

  return (
    <PreQualificationSectionPageTemplate
      preQualificationId={id}
      sectionId="timing"
      title="Zeitplan / Verfahren"
      description="Wie lautet die Timeline? Gibt es einen Shortlistingprozess oder ein direktes Vergabeverfahren?"
    />
  );
}
