import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

import { PreQualificationSectionPageTemplate } from '@/components/qualifications/section-page-template';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';
import { getCachedPreQualification } from '@/lib/qualifications/cached-queries';

export default async function DeliverablesPage({ params }: { params: Promise<{ id: string }> }) {
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
      sectionId="deliverables"
      title="Leistungsumfang"
      description="Was sind die geforderten Leistungen? Was muss das Angebotsteam in Teilnahmeantrag und Angebot erarbeiten?"
    >
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href={`/qualifications/${id}/rag-data`}>Quellen prüfen</Link>
        </Button>
      </div>
    </PreQualificationSectionPageTemplate>
  );
}
