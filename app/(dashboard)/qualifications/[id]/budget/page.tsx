import { notFound, redirect } from 'next/navigation';

import { PreQualificationSectionPageTemplate } from '@/components/qualifications/section-page-template';
import { auth } from '@/lib/auth';
import { getCachedPreQualification } from '@/lib/qualifications/cached-queries';

export default async function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <PreQualificationSectionPageTemplate
      preQualificationId={id}
      sectionId="budget"
      title="Budget"
      description="Enthält die Ausschreibung Angaben zum Budget, wie hoch ist dieses und wie lange ist die Laufzeit?"
    />
  );
}
