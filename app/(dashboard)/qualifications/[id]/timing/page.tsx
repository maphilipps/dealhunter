import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

import { PreQualificationSectionPageTemplate } from '@/components/qualifications/section-page-template';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';
import { getCachedPreQualification } from '@/lib/qualifications/cached-queries';

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
      description="Fristen, Meilensteine und Ablauf des Vergabeverfahrens inkl. Risiken für die Angebotsplanung."
    >
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href={`/qualifications/${id}/rag-data`}>Quellen prüfen</Link>
        </Button>
      </div>
    </PreQualificationSectionPageTemplate>
  );
}
